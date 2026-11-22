import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { toHinglish } from './hinglish';

describe('Hinglish UI text', () => {
  it('translates plain strings', () => {
    expect(toHinglish('Send')).toBe('Bhejo');
    expect(toHinglish('Next question')).toBe('Agla sawaal');
  });

  it('fills templates in order, preferring the most specific one', () => {
    expect(toHinglish('3 of 5 correct')).toBe('3 mein se 5 sahi');
    expect(toHinglish('This session: 4/6 correct')).toBe('Is session mein: 4/6 sahi');
    expect(toHinglish('4/6 correct')).toBe('4/6 sahi');
    expect(toHinglish('Welcome back, Riya!')).toBe('Welcome back, Riya!');
  });

  it('returns undefined for unknown text so the caller falls back to English', () => {
    expect(toHinglish('Some text that is not in the dictionary')).toBeUndefined();
  });

  it('is written in Roman letters only', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'hinglish.ts'), 'utf8');
    const values = [...src.matchAll(/:\s*'([^']*)'/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(500);
    expect(values.filter((v) => /[ऀ-ॿ]/.test(v))).toEqual([]);
  });
});
