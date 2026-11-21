export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
}

export interface ChatOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatResult {
  text: string;
  model: string;
  provider: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  model: string;
  provider: string;
}

/**
 * Provider abstraction. Swap Groq for any OpenAI-compatible endpoint (or a new
 * implementation) without touching tutor, vision or voice services.
 */
export interface AIProvider {
  readonly name: string;
  readonly live: boolean;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  vision(prompt: string, imageDataUrl: string, options?: ChatOptions): Promise<ChatResult>;
  transcribe(file: { buffer: Buffer; filename: string; mimeType: string }, language?: string): Promise<TranscriptionResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code: 'NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'NETWORK' = 'PROVIDER_ERROR',
  ) {
    super(message);
  }
}
