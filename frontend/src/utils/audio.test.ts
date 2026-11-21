import { describe, expect, it } from 'vitest';
import { audioCacheKey, encodeWav } from './audio';

describe('encodeWav', () => {
  it('writes a valid 16-bit mono PCM header', () => {
    const buf = encodeWav(new Float32Array([0, 0.5, -1, 1]), 16000);
    const v = new DataView(buf);
    const str = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(str(0)).toBe('RIFF');
    expect(str(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(8);
    expect(buf.byteLength).toBe(44 + 8);
    expect(v.getInt16(46, true)).toBe(Math.floor(0.5 * 0x7fff));
    expect(v.getInt16(48, true)).toBe(-0x8000);
  });
});

describe('audioCacheKey', () => {
  it('is stable and language-specific', async () => {
    expect(await audioCacheKey('నమస్తే', 'te')).toBe(await audioCacheKey('నమస్తే', 'te'));
    expect(await audioCacheKey('नमस्ते', 'hi')).not.toBe(await audioCacheKey('नमस्ते', 'te'));
  });
});
