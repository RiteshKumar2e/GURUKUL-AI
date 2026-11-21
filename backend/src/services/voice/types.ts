/** Languages the voice tutor understands and speaks. */
export type VoiceLanguage = 'hi' | 'en' | 'te';

export const VOICE_LANGUAGES: VoiceLanguage[] = ['hi', 'en', 'te'];

/** BCP-47 codes used by Sarvam and by browsers. */
export const LOCALE: Record<VoiceLanguage, string> = { hi: 'hi-IN', en: 'en-IN', te: 'te-IN' };

export interface AudioInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface SttResult {
  text: string;
  /** Language the provider detected or was told to use */
  language: VoiceLanguage | string;
  provider: string;
  model?: string;
}

export interface SttProvider {
  readonly name: string;
  readonly live: boolean;
  transcribe(input: AudioInput, language: VoiceLanguage): Promise<SttResult>;
}

export interface TtsResult {
  audio: Buffer;
  mimeType: 'audio/wav';
  provider: string;
  model?: string;
}

export interface TtsProvider {
  readonly name: string;
  readonly live: boolean;
  synthesize(text: string, language: VoiceLanguage): Promise<TtsResult>;
}
