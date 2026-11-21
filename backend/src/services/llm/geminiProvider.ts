import { OpenAICompatibleProvider } from '../ai/openaiCompatibleProvider';
import { AIProviderError, type ChatMessage, type ChatOptions, type ChatResult, type TranscriptionResult } from '../ai/types';

interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/**
 * Google Gemini through its OpenAI-compatible endpoint
 * (https://generativelanguage.googleapis.com/v1beta/openai, Bearer API key).
 * Gemini models accept images, so the same model handles photo questions.
 *
 * JSON mode is requested through the prompt rather than `response_format`, because support for
 * that field on the compatibility layer varies by model; the tutor already extracts JSON from text.
 * Not verified against the live API in this repo (no key was available during development).
 */
export class GeminiProvider extends OpenAICompatibleProvider {
  constructor(cfg: Config) {
    super({ name: 'gemini', apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, visionModel: cfg.model, sttModel: '', timeoutMs: cfg.timeoutMs });
  }

  chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    return super.chat(messages, { ...options, json: false });
  }

  async transcribe(): Promise<TranscriptionResult> {
    throw new AIProviderError('Gemini is not used for speech-to-text here. Configure Sarvam or Groq.', 503, 'NOT_CONFIGURED');
  }
}
