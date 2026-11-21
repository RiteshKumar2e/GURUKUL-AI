import { describe, expect, it } from 'vitest';
import { evaluate, parseNumericAnswer, solveLinear } from '../src/utils/math';
import { gradeAnswer } from '../src/utils/grading';
import { nextProgress } from '../src/services/adaptive-learning/adaptiveService';
import { calculatorFromText, verifyCheck } from '../src/services/tutor/verifier';
import { streakDays } from '../src/services/progressService';

describe('math evaluator', () => {
  it('handles precedence, powers, roots and unicode symbols', () => {
    expect(evaluate('2 + 3 × 4')).toBe(14);
    expect(evaluate('2^3 * 2^2')).toBe(32);
    expect(evaluate('16^(3/4)')).toBeCloseTo(8);
    expect(evaluate('√(25 − 9)')).toBe(4);
    expect(evaluate('3²')).toBe(9);
    expect(evaluate('2(3+4)')).toBe(14);
    expect(evaluate('22/7*7*10')).toBeCloseTo(220);
  });
  it('rejects unsafe or invalid input', () => {
    expect(evaluate('process.exit()')).toBeNull();
    expect(evaluate('2 +')).toBeNull();
    expect(evaluate('')).toBeNull();
  });
  it('parses student answers', () => {
    expect(parseNumericAnswer('-5/2')).toBe(-2.5);
    expect(parseNumericAnswer('−2.5')).toBe(-2.5);
    expect(parseNumericAnswer('x = 4')).toBe(4);
    expect(parseNumericAnswer('55°')).toBe(55);
    expect(parseNumericAnswer('₹12,500')).toBe(12500);
  });
  it('solves linear equations in one variable', () => {
    expect(solveLinear('2x + 3 = 7')).toBe(2);
    expect(solveLinear('3x = x + 40')).toBe(20);
    expect(solveLinear('x^2 = 4')).toBeNull();
  });
});

describe('grading', () => {
  it('grades MCQ by option id', () => {
    expect(gradeAnswer('MCQ', 'b', 'B')).toBe(true);
    expect(gradeAnswer('MCQ', 'b', 'c')).toBe(false);
  });
  it('accepts equivalent numeric forms', () => {
    expect(gradeAnswer('NUMERIC', '-5/2', '-2.5')).toBe(true);
    expect(gradeAnswer('NUMERIC', '19404', '19404')).toBe(true);
    expect(gradeAnswer('NUMERIC', '35', '36')).toBe(false);
    expect(gradeAnswer('NUMERIC', '35', '')).toBe(false);
  });
});

describe('adaptive progress', () => {
  const start = { attempts: 0, correct: 0, mastery: 0, currentDifficulty: 1, streak: 0 };
  it('raises difficulty after two correct answers', () => {
    const a = nextProgress(start, true, 1);
    const b = nextProgress(a, true, 1);
    expect(b.currentDifficulty).toBe(2);
    expect(b.correct).toBe(2);
    expect(b.mastery).toBeGreaterThan(a.mastery);
  });
  it('lowers difficulty after two wrong answers', () => {
    const s = { ...start, currentDifficulty: 3, mastery: 0.8 };
    const b = nextProgress(nextProgress(s, false, 3), false, 3);
    expect(b.currentDifficulty).toBe(2);
    expect(b.mastery).toBeLessThan(0.8);
  });
  it('keeps mastery in [0,1]', () => {
    let s = start;
    for (let i = 0; i < 50; i++) s = nextProgress(s, true, 3);
    expect(s.mastery).toBeLessThanOrEqual(1);
  });
});

describe('AI answer verification', () => {
  it('verifies a correct arithmetic claim', () => {
    expect(verifyCheck({ kind: 'arithmetic', expression: '103*97', claimed: '9991' }).status).toBe('verified');
  });
  it('flags a wrong claim', () => {
    expect(verifyCheck({ kind: 'arithmetic', expression: '103*97', claimed: '9981' }).status).toBe('mismatch');
    expect(verifyCheck({ kind: 'linear', equation: '2x+5=0', variable: 'x', claimed: '2.5' }).status).toBe('mismatch');
  });
  it('is unchecked when nothing can be verified', () => {
    expect(verifyCheck(null).status).toBe('unchecked');
  });
  it('finds a calculation inside a Hindi sentence (demo mode)', () => {
    expect(calculatorFromText('मुझे 2x + 3 = 7 हल करना है')?.result).toBe(2);
    expect(calculatorFromText('103 × 97 कितना होगा?')?.result).toBe(9991);
    expect(calculatorFromText('बहुपद क्या है?')).toBeNull();
  });
});

describe('streak', () => {
  it('counts consecutive IST days', () => {
    const now = new Date('2026-11-21T06:00:00Z');
    expect(streakDays(new Set(['2026-11-21', '2026-11-20', '2026-11-19', '2026-11-17']), now)).toBe(3);
    expect(streakDays(new Set(['2026-11-20']), now)).toBe(1);
    expect(streakDays(new Set([]), now)).toBe(0);
  });
});
