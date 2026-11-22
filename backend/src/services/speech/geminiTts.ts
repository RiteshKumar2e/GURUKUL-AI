import { AIProviderError } from '../ai/types';
import type { TtsProvider, TtsResult, VoiceLanguage } from '../voice/types';
import { providerJson } from './providerHttp';
import { buildWav } from './wav';

interface Config {
  apiKey: string;
  /** Native Gemini API, e.g. https://generativelanguage.googleapis.com/v1beta */
  baseUrl: string;
  model: string;
  voice: string;
  timeoutMs: number;
}

/** Longest text voiced in one reply (a tutor reply summary), same limit as Sarvam. */
const MAX_TEXT = 1500;

/**
 * How to say it. Gemini speech follows a spoken style instruction, so every language is read the
 * way an Indian school teacher speaks: Indian English, standard Hindi, Telugu.
 */
const STYLE: Record<VoiceLanguage, string> = {
  hi: 'Read this aloud in a warm, clear voice, like a kind Indian school teacher, with natural Hindi pronunciation (Hindi written in Roman letters is still Hindi):',
  en: 'Read this aloud in a warm, clear voice with a natural Indian English accent, like a kind Indian school teacher:',
  te: 'Read this aloud in a warm, clear voice, like a kind school teacher from Andhra Pradesh or Telangana, with natural Telugu pronunciation:',
};

/** Gemini returns raw 16-bit mono PCM (audio/L16;rate=24000). Wraps it as a playable WAV file. */
export function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); // PCM
  fmt.writeUInt16LE(1, 2); // mono
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * 2, 8); // byte rate
  fmt.writeUInt16LE(2, 12); // block align
  fmt.writeUInt16LE(16, 14); // bits per sample
  return buildWav(fmt, pcm);
}

/**
 * Google Gemini text-to-speech (generateContent with responseModalities AUDIO).
 * API: POST {base}/models/{model}:generateContent, header x-goog-api-key;
 * response candidates[0].content.parts[].inlineData { mimeType: 'audio/L16;codec=pcm;rate=24000', data: base64 }.
 */
export class GeminiTtsProvider implements TtsProvider {
  readonly name = 'gemini';
  readonly live: boolean;

  constructor(private cfg: Config) {
    this.live = cfg.apiKey.trim().length > 0;
  }

  async synthesize(text: string, language: VoiceLanguage): Promise<TtsResult> {
    if (!this.live) throw new AIProviderError('Gemini text-to-speech is not configured.', 503, 'NOT_CONFIGURED');
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!clean) throw new AIProviderError('Nothing to speak.', 400, 'PROVIDER_ERROR');

    const data = await providerJson<{ candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }>(
      'Gemini',
      `${this.cfg.baseUrl.replace(/\/$/, '')}/models/${this.cfg.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': this.cfg.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${STYLE[language]}\n${clean}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.cfg.voice } } },
          },
        }),
      },
      this.cfg.timeoutMs,
    );
    const parts = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.inlineData).filter((d): d is { mimeType?: string; data?: string } => !!d?.data);
    if (!parts.length) throw new AIProviderError('Gemini returned no audio.', 502, 'PROVIDER_ERROR');
    const rate = Number(/rate=(\d+)/.exec(parts[0].mimeType ?? '')?.[1] ?? 24000);
    const pcm = Buffer.concat(parts.map((p) => Buffer.from(p.data!, 'base64')));
    return { audio: pcmToWav(pcm, rate), mimeType: 'audio/wav', provider: this.name, model: this.cfg.model };
  }
}

/** Tries each provider in order; the next one is used when one fails (quota, outage, bad key). */
export function ttsChain(providers: TtsProvider[]): TtsProvider | null {
  const live = providers.filter((p) => p.live);
  if (live.length <= 1) return live[0] ?? null;
  return {
    name: live.map((p) => p.name).join('+'),
    live: true,
    async synthesize(text, language) {
      let last: unknown;
      for (const p of live) {
        try {
          return await p.synthesize(text, language);
        } catch (e) {
          if (!(e instanceof AIProviderError)) throw e;
          console.warn(`[voice] ${p.name} speech failed (${e.message.slice(0, 120)}), trying the next provider`);
          last = e;
        }
      }
      throw last;
    },
  };
}
