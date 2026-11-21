import { env } from '../../config/env';
import { AIProviderError, getAIProvider, getGroqProvider, resetAIProviders, type AIProvider } from '../ai';
import { SarvamSttProvider } from '../speech/sarvamStt';
import { SarvamTtsProvider } from '../speech/sarvamTts';
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
      sttCache = (env.sarvamEnabled ? sarvamStt() : null) ?? groqStt() ?? noStt;
  }
  return sttCache;
}

export function getLlmProvider(): LlmProvider {
  return getAIProvider();
}

/**
 * Server text-to-speech, chosen by TTS_PROVIDER. Returns null when the browser's own voice should be used.
 *   auto → Sarvam if SARVAM_API_KEY, else null
 */
export function getTtsProvider(): TtsProvider | null {
  if (ttsCache !== undefined) return ttsCache;
  const wantSarvam = env.TTS_PROVIDER === 'sarvam' || (env.TTS_PROVIDER === 'auto' && env.sarvamEnabled);
  ttsCache =
    wantSarvam && env.sarvamEnabled
      ? new SarvamTtsProvider({ apiKey: env.SARVAM_API_KEY, baseUrl: env.SARVAM_BASE_URL, model: env.SARVAM_TTS_MODEL, speaker: env.SARVAM_TTS_SPEAKER, timeoutMs: env.VOICE_TIMEOUT_MS })
      : null;
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
