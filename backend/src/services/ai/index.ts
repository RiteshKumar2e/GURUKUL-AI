import { env } from '../../config/env';
import { DemoProvider } from './demoProvider';
import { OpenAICompatibleProvider } from './openaiCompatibleProvider';
import { GeminiProvider } from '../llm/geminiProvider';
import { AIProviderError, type AIProvider } from './types';

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
  // When Groq is the main model, a busy or rate-limited call tries a second Groq model (it has its
  // own per-model limit) and then Gemini if configured, instead of failing the student's question.
  provider = picked && picked.name !== 'gemini' ? withFallback(picked, choice === 'groq' ? null : gemini()) : picked ?? new DemoProvider();
  return provider;
}

/** 429 (rate limit), 5xx, timeouts and network errors are worth another model; 4xx request errors are not. */
const retryable = (e: unknown) => e instanceof AIProviderError && (e.code === 'TIMEOUT' || e.code === 'NETWORK' || e.status === 429 || (e.status ?? 0) >= 500);

export function withFallback(primary: AIProvider, backup: AIProvider | null): AIProvider {
  const fallbackModel = env.AI_FALLBACK_MODEL && env.AI_FALLBACK_MODEL !== env.AI_MODEL ? env.AI_FALLBACK_MODEL : null;
  return {
    name: primary.name,
    live: primary.live,
    async chat(messages, options = {}) {
      try {
        return await primary.chat(messages, options);
      } catch (e) {
        if (!retryable(e)) throw e;
        if (fallbackModel && !options.model) {
          try {
            return await primary.chat(messages, { ...options, model: fallbackModel });
          } catch (e2) {
            if (!retryable(e2) || !backup) throw e2;
          }
        }
        if (!backup) throw e;
        console.warn(`[ai] ${primary.name} unavailable, answering with ${backup.name}`);
        return backup.chat(messages, { ...options, model: undefined });
      }
    },
    vision: (prompt, image, options) => primary.vision(prompt, image, options),
    transcribe: (file, language) => primary.transcribe(file, language),
  };
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
