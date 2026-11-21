import { AIProviderError } from '../ai/types';

/**
 * fetch with a timeout and consistent error mapping for external AI/speech APIs.
 * Error messages never include the API key or request body.
 */
export async function providerFetch(provider: string, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
        detail = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? detail;
      } catch {
        /* keep raw text */
      }
      throw new AIProviderError(`${provider} error (${res.status}): ${detail}`, res.status, 'PROVIDER_ERROR');
    }
    return res;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if ((err as Error).name === 'AbortError') throw new AIProviderError(`${provider} took too long to respond.`, 504, 'TIMEOUT');
    throw new AIProviderError(`Could not reach ${provider}: ${(err as Error).message}`, 502, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

export async function providerJson<T>(provider: string, url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const res = await providerFetch(provider, url, init, timeoutMs);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AIProviderError(`${provider} returned a response that is not JSON.`, 502, 'PROVIDER_ERROR');
  }
}
