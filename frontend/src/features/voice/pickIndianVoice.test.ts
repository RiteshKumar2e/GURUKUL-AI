import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ api: vi.fn(), apiBlob: vi.fn() }));
vi.mock('@/lib/offlineDb', () => ({ offlineDb: {} }));
const { pickIndianVoice } = await import('./useVoicePlayback');

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

describe('Indian voice choice', () => {
  const us = v('Google US English', 'en-US', false);
  const uk = v('Microsoft George - English (United Kingdom)', 'en-GB');
  const enIn = v('Microsoft Ravi - English (India)', 'en-IN');
  const enInNatural = v('Microsoft Neerja Online (Natural) - English (India)', 'en-IN', false);
  const hi = v('Google हिन्दी', 'hi-IN', false);

  it('never picks a US or UK voice when an Indian English one exists', () => {
    expect(pickIndianVoice('en', [us, uk, enIn])).toBe(enIn);
  });
  it('prefers the natural Indian voice', () => {
    expect(pickIndianVoice('en', [us, enIn, enInNatural])).toBe(enInNatural);
  });
  it('reads English with a Hindi voice when there is no Indian English voice', () => {
    expect(pickIndianVoice('en', [us, uk, hi])).toBe(hi);
  });
  it('picks the Hindi voice for Hindi', () => {
    expect(pickIndianVoice('hi', [us, enIn, hi])).toBe(hi);
  });
  it('falls back to any voice of the language', () => {
    expect(pickIndianVoice('en', [us])).toBe(us);
  });
});
