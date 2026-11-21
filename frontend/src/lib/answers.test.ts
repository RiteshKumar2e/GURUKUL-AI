import { describe, expect, it } from 'vitest';
import { checkAnswer, parseNumber } from './answers';
import { compressedSize } from '@/utils/image';

describe('offline answer checking', () => {
  it('parses common answer forms', () => {
    expect(parseNumber('-5/2')).toBe(-2.5);
    expect(parseNumber('−2.5')).toBe(-2.5);
    expect(parseNumber('x = 4')).toBe(4);
    expect(parseNumber('55°')).toBe(55);
    expect(parseNumber('12,500')).toBe(12500);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1/0')).toBeNull();
  });
  it('reads mixed numbers, units and Indian digit grouping like the server', () => {
    expect(parseNumber('2 1/2')).toBe(2.5);
    expect(parseNumber('-2 1/2')).toBe(-2.5);
    expect(parseNumber('12 cm')).toBe(12);
    expect(parseNumber('5 sq units')).toBe(5);
    expect(parseNumber('20 वर्ग सेमी')).toBe(20);
    expect(parseNumber('₹1,00,000')).toBe(100000);
    // ambiguous: never guessed as 23
    expect(parseNumber('2 3')).toBeNull();
    expect(checkAnswer('NUMERIC', '5/2', '2 1/2')).toBe(true);
  });
  it('matches the server rules', () => {
    expect(checkAnswer('NUMERIC', '-5/2', '-2.5')).toBe(true);
    expect(checkAnswer('NUMERIC', '35', '36')).toBe(false);
    expect(checkAnswer('MCQ', 'b', 'B')).toBe(true);
    expect(checkAnswer('MCQ', 'b', '')).toBe(false);
  });
});

describe('image sizing', () => {
  it('keeps aspect ratio within the max edge', () => {
    expect(compressedSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(compressedSize(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(compressedSize(1000, 3000, 1280)).toEqual({ width: 427, height: 1280 });
  });
});
