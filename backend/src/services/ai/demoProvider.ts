import { AIProvider, AIProviderError, ChatMessage, ChatResult, TranscriptionResult } from './types';

/**
 * DEMO MODE — used only when AI_API_KEY is empty.
 * It does not imitate an AI model. The tutor service detects `live === false`
 * and builds an honest, deterministic reply (lesson excerpt + calculator check)
 * that is clearly labelled as demo mode in the UI.
 */
export class DemoProvider implements AIProvider {
  readonly name = 'demo';
  readonly live = false;

  async chat(_messages: ChatMessage[]): Promise<ChatResult> {
    throw new AIProviderError('AI is not configured (demo mode).', 503);
  }

  async vision(): Promise<ChatResult> {
    throw new AIProviderError('Reading photos needs an AI key. Type the question instead.', 503);
  }

  async transcribe(): Promise<TranscriptionResult> {
    throw new AIProviderError('Server speech-to-text needs an AI key. Use your browser microphone or type instead.', 503);
  }
}
