import { describe, expect, it } from 'vitest';
import { AIProviderError } from '../src/services/ai/types';
import { pcmToWav, ttsChain } from '../src/services/speech/geminiTts';
import { parseWav } from '../src/services/speech/wav';
import type { TtsProvider } from '../src/services/voice/types';

const fake = (name: string, ok: boolean, live = true): TtsProvider & { calls: number } => {
  const p = {
    name,
    live,
    calls: 0,
    async synthesize() {
      p.calls++;
      if (!ok) throw new AIProviderError(`${name} failed`, 402);
      return { audio: Buffer.from(name), mimeType: 'audio/wav' as const, provider: name };
    },
  };
  return p;
};

describe('read-aloud voice chain', () => {
  it('uses Gemini first', async () => {
    const gemini = fake('gemini', true);
    const sarvam = fake('sarvam', true);
    expect((await ttsChain([gemini, sarvam])!.synthesize('x', 'hi')).provider).toBe('gemini');
    expect(sarvam.calls).toBe(0);
  });
  it('falls back to Sarvam when Gemini fails', async () => {
    const r = await ttsChain([fake('gemini', false), fake('sarvam', true)])!.synthesize('x', 'en');
    expect(r.provider).toBe('sarvam');
  });
  it('reports the error when every voice fails, so the app uses the device voice', async () => {
    await expect(ttsChain([fake('gemini', false), fake('sarvam', false)])!.synthesize('x', 'te')).rejects.toThrow('sarvam failed');
  });
  it('skips providers without a key', () => {
    expect(ttsChain([fake('gemini', true, false), fake('sarvam', true)])!.name).toBe('sarvam');
    expect(ttsChain([])).toBeNull();
  });
  it('wraps Gemini PCM as a valid WAV file', () => {
    const pcm = Buffer.alloc(4800);
    const wav = parseWav(pcmToWav(pcm, 24000));
    expect(wav.data.length).toBe(4800);
    expect(wav.fmt.readUInt32LE(4)).toBe(24000);
  });
});
