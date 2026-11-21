import { env } from '../../config/env';
import { DemoProvider } from './demoProvider';
import { OpenAICompatibleProvider } from './openaiCompatibleProvider';
import { GeminiProvider } from '../llm/geminiProvider';
import type { AIProvider } from './types';

let provider: AIProvider | null = null;
let groq: OpenAICompatibleProvider | null | undefined;

/** Groq (or another OpenAI-compatible API) when AI_API_KEY is set. Also used for Whisper speech-to-text. */
export function getGroqProvider(): OpenAICompatibleProvider | null {
  if (groq !== undefined) return groq;
  groq = env.aiEnabled
    ? new OpenAICompatibleProvider({
        name: env.AI_PROVIDER,
        apiKey: env.AI_API_KEY,
        baseUrl: env.AI_BASE_URL,
        model: env.AI_MODEL,
        visionModel: env.AI_VISION_MODEL,
        sttModel: env.AI_STT_MODEL,
        timeoutMs: env.AI_TIMEOUT_MS,
      })
    : null;
  return groq;
}

function gemini(): GeminiProvider | null {
  return env.geminiEnabled ? new GeminiProvider({ apiKey: env.GEMINI_API_KEY, baseUrl: env.GEMINI_BASE_URL, model: env.GEMINI_MODEL, timeoutMs: env.AI_TIMEOUT_MS }) : null;
}

/**
 * The tutor/vision model, chosen by LLM_PROVIDER:
 *   auto   → Groq if AI_API_KEY, else Gemini if GEMINI_API_KEY, else demo
 *   groq   → Groq or demo
 *   gemini → Gemini or demo
 */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const choice = env.LLM_PROVIDER;
  const picked = choice === 'groq' ? getGroqProvider() : choice === 'gemini' ? gemini() : getGroqProvider() ?? gemini();
  provider = picked ?? new DemoProvider();
  return provider;
}

/** Test hook */
export function setAIProvider(p: AIProvider | null) {
  provider = p;
}

/** Clears cached providers so tests can change env-driven configuration. */
export function resetAIProviders() {
  provider = null;
  groq = undefined;
}

export function aiStatus() {
  const p = getAIProvider();
  const model = p.name === 'gemini' ? env.GEMINI_MODEL : env.AI_MODEL;
  return {
    mode: p.live ? 'live' : 'demo',
    provider: p.name,
    model: p.live ? model : null,
    visionModel: p.live ? (p.name === 'gemini' ? env.GEMINI_MODEL : env.AI_VISION_MODEL) : null,
    sttModel: getGroqProvider() ? env.AI_STT_MODEL : null,
  };
}

export * from './types';
