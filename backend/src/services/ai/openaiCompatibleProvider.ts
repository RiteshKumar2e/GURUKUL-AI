import { AIProvider, AIProviderError, ChatMessage, ChatOptions, ChatResult, TranscriptionResult } from './types';

interface Config {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel: string;
  sttModel: string;
  timeoutMs: number;
}

/**
 * Works with Groq (https://api.groq.com/openai/v1) and other OpenAI-compatible APIs.
 * Uses fetch directly so there is no vendor SDK lock-in.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly live = true;
  readonly name: string;

  constructor(private cfg: Config) {
    this.name = cfg.name;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.cfg.apiKey}`, ...(init.headers ?? {}) },
      });
      const text = await res.text();
      if (!res.ok) {
        let detail = text.slice(0, 300);
        try {
          detail = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? detail;
        } catch {
          /* keep raw text */
        }
        throw new AIProviderError(`AI provider error (${res.status}): ${detail}`, res.status);
      }
      return JSON.parse(text);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if ((err as Error).name === 'AbortError') throw new AIProviderError('The AI service took too long to respond.');
      throw new AIProviderError(`Could not reach the AI service: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this.cfg.model;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1200,
    };
    if (options.json) body.response_format = { type: 'json_object' };
    const data = (await this.request('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AIProviderError('The AI service returned an empty answer.');
    return { text, model: data.model ?? model, provider: this.name };
  }

  vision(prompt: string, imageDataUrl: string, options: ChatOptions = {}): Promise<ChatResult> {
    return this.chat(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      { ...options, model: options.model ?? this.cfg.visionModel },
    );
  }

  async transcribe(file: { buffer: Buffer; filename: string; mimeType: string }, language?: string): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);
    form.append('model', this.cfg.sttModel);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (language) form.append('language', language);
    const data = (await this.request('/audio/transcriptions', { method: 'POST', body: form })) as { text?: string };
    return { text: (data.text ?? '').trim(), language, model: this.cfg.sttModel, provider: this.name };
  }
}
