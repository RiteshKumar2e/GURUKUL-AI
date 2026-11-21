import { AIProviderError } from '../ai/types';
import { LOCALE, type TtsProvider, type TtsResult, type VoiceLanguage } from '../voice/types';
import { providerJson } from './providerHttp';
import { concatWav } from './wav';

interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  speaker: string;
  timeoutMs: number;
}

/** Longest text sent in one request. Kept well under Sarvam's documented per-request limit. */
export const MAX_CHUNK = 450;
/** Longest text the endpoint will voice at all (a tutor reply summary). */
export const MAX_TEXT = 1500;

/** Splits text at sentence boundaries (., ?, !, Hindi danda ।) into chunks of at most `max` chars. */
export function chunkText(text: string, max = MAX_CHUNK): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.?!।])\s+/)
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (s.length > max) {
      if (current) chunks.push(current);
      current = '';
      for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max));
      continue;
    }
    if ((current ? current.length + 1 : 0) + s.length > max) {
      chunks.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Sarvam AI text-to-speech ("Bulbul" models): natural Telugu, Hindi and Indian-English voices.
 * API: POST {base}/text-to-speech, JSON { text, target_language_code, speaker, model }, header
 * `api-subscription-key`; response { audios: [base64 WAV] }.
 * Request format follows Sarvam's public docs; it has not been verified against the live API in this repo.
 */
export class SarvamTtsProvider implements TtsProvider {
  readonly name = 'sarvam';
  readonly live: boolean;

  constructor(private cfg: Config) {
    this.live = cfg.apiKey.trim().length > 0;
  }

  async synthesize(text: string, language: VoiceLanguage): Promise<TtsResult> {
    if (!this.live) throw new AIProviderError('Sarvam text-to-speech is not configured.', 503, 'NOT_CONFIGURED');
    const chunks = chunkText(text.slice(0, MAX_TEXT));
    if (chunks.length === 0) throw new AIProviderError('Nothing to speak.', 400, 'PROVIDER_ERROR');

    const clips: Buffer[] = [];
    for (const chunk of chunks) {
      const data = await providerJson<{ audios?: string[] }>(
        'Sarvam',
        `${this.cfg.baseUrl.replace(/\/$/, '')}/text-to-speech`,
        {
          method: 'POST',
          headers: { 'api-subscription-key': this.cfg.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chunk,
            target_language_code: LOCALE[language],
            speaker: this.cfg.speaker,
            model: this.cfg.model,
            pace: 0.95,
            enable_preprocessing: true,
          }),
        },
        this.cfg.timeoutMs,
      );
      const b64 = data.audios?.[0];
      if (!b64) throw new AIProviderError('Sarvam returned no audio.', 502, 'PROVIDER_ERROR');
      clips.push(...(data.audios ?? []).map((a) => Buffer.from(a, 'base64')));
    }

    let audio: Buffer;
    try {
      audio = concatWav(clips);
    } catch {
      throw new AIProviderError('Sarvam returned audio in an unexpected format.', 502, 'PROVIDER_ERROR');
    }
    return { audio, mimeType: 'audio/wav', provider: this.name, model: this.cfg.model };
  }
}
