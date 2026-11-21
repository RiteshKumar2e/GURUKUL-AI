import { evaluate, numbersMatch, parseNumericAnswer, solveLinear } from '../../utils/math';

export type Verification = 'verified' | 'mismatch' | 'unchecked';

export interface CheckSpec {
  kind: 'arithmetic' | 'linear';
  expression?: string;
  equation?: string;
  variable?: string;
  claimed: string;
}

/**
 * Independently recomputes the AI's claimed result. "verified" means a calculator
 * agrees with the claimed number for the stated expression — not that the whole
 * explanation is correct, which the UI states plainly.
 */
export function verifyCheck(check: CheckSpec | null | undefined): { status: Verification; computed?: number } {
  if (!check) return { status: 'unchecked' };
  const claimed = parseNumericAnswer(String(check.claimed ?? ''));
  if (claimed === null) return { status: 'unchecked' };

  if (check.kind === 'arithmetic' && check.expression) {
    const v = evaluate(check.expression);
    if (v === null) return { status: 'unchecked' };
    return { status: numbersMatch(claimed, v) ? 'verified' : 'mismatch', computed: v };
  }
  if (check.kind === 'linear' && check.equation) {
    const variable = (check.variable || 'x').toLowerCase().slice(0, 1);
    const v = solveLinear(check.equation, variable);
    if (v === null) return { status: 'unchecked' };
    return { status: numbersMatch(claimed, v) ? 'verified' : 'mismatch', computed: v };
  }
  return { status: 'unchecked' };
}

/** For demo mode: try to compute something useful from the student's own text. */
export function calculatorFromText(text: string): { kind: 'arithmetic' | 'linear'; input: string; result: number } | null {
  const candidate = text
    .replace(/[^\d+\-−*/×÷^().=x√²³πa-z\s]/gi, ' ')
    .match(/[\dx(√π][\d\sx+\-−*/×÷^().√²³π]*(=[\d\sx+\-−*/×÷^().√²³π]+)?/i)?.[0]
    ?.trim();
  if (!candidate || candidate.length < 3) return null;
  if (candidate.includes('=') && /x/i.test(candidate)) {
    const r = solveLinear(candidate, 'x');
    return r === null ? null : { kind: 'linear', input: candidate, result: r };
  }
  if (!/[+\-−*/×÷^√²³]/.test(candidate)) return null;
  const r = evaluate(candidate.replace(/=.*$/, ''));
  return r === null ? null : { kind: 'arithmetic', input: candidate.replace(/=.*$/, '').trim(), result: r };
}
