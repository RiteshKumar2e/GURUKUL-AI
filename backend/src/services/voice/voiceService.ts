import fs from 'fs';
import { AIProviderError } from '../ai';
import { removeFile } from '../../middleware/upload';
import { badRequest, unavailable } from '../../utils/errors';
import { getSttProvider, getTtsProvider, voiceProviderStatus } from './registry';
import { VOICE_LANGUAGES, type VoiceLanguage } from './types';

/** Speech removes formatting characters that sound odd when read aloud. */
export function speakable(text: string) {
  return text
    .replace(/[*#_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const voiceService = {
  capabilities() {
    const status = voiceProviderStatus();
    return {
      // Kept for older clients
      serverTranscription: status.stt.live,
      serverSpeech: status.tts.live,
      sttProvider: status.stt.provider,
      ttsProvider: status.tts.provider,
      llm: status.llm,
      languages: VOICE_LANGUAGES,
      // The synchronous STT endpoints handle short clips; the client stops recording at this length.
      maxRecordingSeconds: status.stt.provider === 'sarvam' ? 30 : 60,
    };
  },

  async transcribe(file: Express.Multer.File, language: VoiceLanguage = 'hi') {
    try {
      const stt = getSttProvider();
      if (!stt.live) throw unavailable('Server speech-to-text is not configured. Use the browser microphone or type your question.');
      const buffer = await fs.promises.readFile(file.path);
      try {
        const r = await stt.transcribe({ buffer, filename: file.filename, mimeType: file.mimetype.split(';')[0] }, language);
        return { text: r.text, language: r.language, provider: r.provider, model: r.model ?? null };
      } catch (err) {
        if (err instanceof AIProviderError) {
          console.warn(`[voice] transcription failed: ${err.message}`);
          throw unavailable('Could not understand the recording right now. Please try again or type your question.');
        }
        throw err;
      }
    } finally {
      await removeFile(file.path); // voice recordings are never stored
    }
  },

  async speak(textRaw: string, language: VoiceLanguage) {
    const tts = getTtsProvider();
    if (!tts?.live) throw unavailable('Server text-to-speech is not configured. The app will use the device voice instead.');
    const text = speakable(textRaw);
    if (!text) throw badRequest('Nothing to read aloud.');
    try {
      return await tts.synthesize(text, language);
    } catch (err) {
      if (err instanceof AIProviderError) {
        console.warn(`[voice] speech synthesis failed: ${err.message}`);
        throw unavailable('Could not create the audio right now. The app will use the device voice instead.');
      }
      throw err;
    }
  },
};
