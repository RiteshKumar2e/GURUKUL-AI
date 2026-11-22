import { env } from '../../config/env';
import { AIProviderError, getAIProvider, getGroqProvider, resetAIProviders, type AIProvider } from '../ai';
import { SarvamSttProvider } from '../speech/sarvamStt';
import { SarvamTtsProvider } from '../speech/sarvamTts';
import { GeminiTtsProvider, ttsChain } from '../speech/geminiTts';
import type { SttProvider, TtsProvider, VoiceLanguage } from './types';

/** The tutor's language model. Same object the text tutor uses (see services/ai). */
export type LlmProvider = Pick<AIProvider, 'name' | 'live' | 'chat'>;

let sttCache: SttProvider | undefined;
let ttsCache: TtsProvider | null | undefined;

const noStt: SttProvider = {
  name: 'none',
  live: false,
  async transcribe() {
    throw new AIProviderError('Server speech recognition is not configured. Use the browser microphone or type your question.', 503, 'NOT_CONFIGURED');
  },
};

function sarvamStt() {
  return new SarvamSttProvider({ apiKey: env.SARVAM_API_KEY, baseUrl: env.SARVAM_BASE_URL, model: env.SARVAM_STT_MODEL, timeoutMs: env.VOICE_TIMEOUT_MS });
}

function groqStt(): SttProvider | null {
  const groq = getGroqProvider();
  if (!groq) return null;
  return {
    name: 'groq',
    live: true,
    async transcribe(input, language) {
      // Whisper accepts ISO-639-1 codes ('hi', 'en', 'te'); its Telugu accuracy is weaker than Sarvam's.
      const r = await groq.transcribe(input, language);
      return { text: r.text, language, provider: 'groq', model: r.model };
    },
  };
}

/**
 * Speech-to-text, chosen by STT_PROVIDER:
 *   auto   → Sarvam if SARVAM_API_KEY, else Groq Whisper if AI_API_KEY, else none (browser STT only)
 */
export function getSttProvider(): SttProvider {
  if (sttCache) return sttCache;
  switch (env.STT_PROVIDER) {
    case 'sarvam':
      sttCache = env.sarvamEnabled ? sarvamStt() : noStt;
      break;
    case 'groq':
      sttCache = groqStt() ?? noStt;
      break;
    case 'none':
      sttCache = noStt;
      break;
    default:
      sttCache = withSttFallback(env.sarvamEnabled ? sarvamStt() : null, groqStt()) ?? noStt;
  }
  return sttCache;
}

/**
 * Sarvam first (better with Indian accents), Groq Whisper when Sarvam fails, for example when the
 * Sarvam account has run out of credits, so asking by voice keeps working.
 */
function withSttFallback(primary: SttProvider | null, backup: SttProvider | null): SttProvider | null {
  if (!primary || !backup) return primary ?? backup;
  return {
    name: primary.name,
    live: true,
    async transcribe(input, language) {
      try {
        return await primary.transcribe(input, language);
      } catch (e) {
        if (!(e instanceof AIProviderError)) throw e;
        console.warn(`[voice] ${primary.name} transcription failed (${e.message.slice(0, 120)}), using ${backup.name}`);
        return backup.transcribe(input, language);
      }
    },
  };
}

export function getLlmProvider(): LlmProvider {
  return getAIProvider();
}

/**
 * Server text-to-speech, chosen by TTS_PROVIDER. Returns null when the browser's own voice should be used.
 *   auto   → Gemini, then Sarvam if Gemini fails (each only when its key is set), else null
 *   gemini → Gemini only; sarvam → Sarvam only; browser → null
 * If every server voice fails, the app falls back to the device voice.
 */
export function getTtsProvider(): TtsProvider | null {
  if (ttsCache !== undefined) return ttsCache;
  const gemini = env.geminiEnabled
    ? new GeminiTtsProvider({ apiKey: env.GEMINI_API_KEY, baseUrl: env.GEMINI_TTS_BASE_URL, model: env.GEMINI_TTS_MODEL, voice: env.GEMINI_TTS_VOICE, timeoutMs: env.VOICE_TIMEOUT_MS })
    : null;
  const sarvam = env.sarvamEnabled
    ? new SarvamTtsProvider({ apiKey: env.SARVAM_API_KEY, baseUrl: env.SARVAM_BASE_URL, model: env.SARVAM_TTS_MODEL, speaker: env.SARVAM_TTS_SPEAKER, timeoutMs: env.VOICE_TIMEOUT_MS })
    : null;
  const pick: Array<TtsProvider | null> = { auto: [gemini, sarvam], gemini: [gemini], sarvam: [sarvam], browser: [] }[env.TTS_PROVIDER];
  ttsCache = ttsChain(pick.filter((p): p is TtsProvider => !!p));
  return ttsCache;
}

/** Non-secret summary of the active voice providers, for the capabilities endpoint. */
export function voiceProviderStatus() {
  const stt = getSttProvider();
  const llm = getLlmProvider();
  const tts = getTtsProvider();
  return {
    stt: { provider: stt.name, live: stt.live },
    llm: { provider: llm.name, live: llm.live },
    tts: tts ? { provider: tts.name, live: tts.live } : { provider: 'browser', live: false },
  };
}

/** Clears cached singletons so tests can re-read env-driven configuration. */
export function resetVoiceProvidersForTests(): void {
  sttCache = undefined;
  ttsCache = undefined;
  resetAIProviders();
}

export type { VoiceLanguage };
