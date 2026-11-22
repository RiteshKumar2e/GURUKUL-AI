import { describe, expect, it } from 'vitest';
import { AIProviderError, withFallback, type AIProvider, type ChatOptions } from '../src/services/ai';

function fake(name: string, behaviour: (o: ChatOptions) => string | Error): AIProvider & { calls: ChatOptions[] } {
  const calls: ChatOptions[] = [];
  return {
    name,
    live: true,
    calls,
    async chat(_m, o = {}) {
      calls.push(o);
      const r = behaviour(o);
      if (r instanceof Error) throw r;
      return { text: r, model: o.model ?? `${name}-main`, provider: name };
    },
    vision: async () => ({ text: '', model: '', provider: name }),
    transcribe: async () => ({ text: '', model: '', provider: name }),
  };
}

const rateLimited = () => new AIProviderError('rate limit', 429);

describe('AI fallback when the main model is rate-limited', () => {
  it('uses the second Groq model on 429', async () => {
    const groq = fake('groq', (o) => (o.model ? 'from fallback' : rateLimited()));
    const r = await withFallback(groq, null).chat([{ role: 'user', content: 'x' }]);
    expect(r.text).toBe('from fallback');
    expect(groq.calls).toHaveLength(2);
  });

  it('goes to Gemini when both Groq models are busy', async () => {
    const groq = fake('groq', () => rateLimited());
    const gemini = fake('gemini', () => 'from gemini');
    const r = await withFallback(groq, gemini).chat([{ role: 'user', content: 'x' }]);
    expect(r.provider).toBe('gemini');
  });

  it('does not retry a bad request', async () => {
    const groq = fake('groq', () => new AIProviderError('bad request', 400));
    await expect(withFallback(groq, fake('gemini', () => 'no')).chat([{ role: 'user', content: 'x' }])).rejects.toThrow('bad request');
    expect(groq.calls).toHaveLength(1);
  });
});
