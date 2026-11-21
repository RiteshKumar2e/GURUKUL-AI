import { AIProviderError } from '../ai/types';
import { LOCALE, type AudioInput, type SttProvider, type SttResult, type VoiceLanguage } from '../voice/types';
import { providerJson } from './providerHttp';

interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/**
 * Sarvam AI speech-to-text ("Saarika" models), strong on Indian languages including Telugu and Hindi.
 * API: POST {base}/speech-to-text, multipart (file, model, language_code), header `api-subscription-key`.
 * Request format follows Sarvam's public docs; it has not been verified against the live API in this repo.
 * The synchronous endpoint accepts short clips (about 30 s), so the frontend limits recordings to 30 s.
 */
export class SarvamSttProvider implements SttProvider {
  readonly name = 'sarvam';
  readonly live: boolean;

  constructor(private cfg: Config) {
    this.live = cfg.apiKey.trim().length > 0;
  }

  async transcribe(input: AudioInput, language: VoiceLanguage): Promise<SttResult> {
    if (!this.live) throw new AIProviderError('Sarvam speech-to-text is not configured.', 503, 'NOT_CONFIGURED');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename);
    form.append('model', this.cfg.model);
    form.append('language_code', LOCALE[language]);

    const data = await providerJson<{ transcript?: string; language_code?: string }>(
      'Sarvam',
      `${this.cfg.baseUrl.replace(/\/$/, '')}/speech-to-text`,
      { method: 'POST', headers: { 'api-subscription-key': this.cfg.apiKey }, body: form },
      this.cfg.timeoutMs,
    );
    return { text: (data.transcript ?? '').trim(), language: data.language_code ?? LOCALE[language], provider: this.name, model: this.cfg.model };
  }
}
