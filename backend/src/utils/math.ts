/**
 * Small, safe arithmetic evaluator (no eval). Supports + − × ÷ ^ ( ), sqrt/√, π,
 * superscript ² ³, implicit multiplication (2x, 3(4)), and an optional variable.
 * Used to grade numeric answers and to independently check AI final answers.
 */

const SUPERSCRIPTS: Record<string, string> = { '²': '^2', '³': '^3' };

export function normaliseExpression(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/[²³]/g, (c) => SUPERSCRIPTS[c] ?? c);
  s = s
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π|pi/g, 'p')
    .replace(/√|sqrt/g, 'r')
    .replace(/\s+/g, '')
    .replace(/°/g, '');
  return s;
}

type Token = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'var' } | { t: 'fn'; v: 'r' } | { t: 'pi' };

function tokenize(s: string, variable?: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = Number(s.slice(i, j));
      if (Number.isNaN(num)) throw new Error('bad number');
      out.push({ t: 'num', v: num });
      i = j;
    } else if ('+-*/^()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else if (c === 'p') {
      out.push({ t: 'pi' });
      i++;
    } else if (c === 'r') {
      out.push({ t: 'fn', v: 'r' });
      i++;
    } else if (variable && c === variable) {
      out.push({ t: 'var' });
      i++;
    } else {
      throw new Error(`unexpected "${c}"`);
    }
  }
  // insert implicit multiplication: 2x, 2(…), )(, x(, 2π, )√
  const result: Token[] = [];
  for (let k = 0; k < out.length; k++) {
    const prev = result[result.length - 1];
    const cur = out[k];
    const prevEndsValue = prev && (prev.t === 'num' || prev.t === 'var' || prev.t === 'pi' || (prev.t === 'op' && prev.v === ')'));
    const curStartsValue = cur.t === 'num' || cur.t === 'var' || cur.t === 'pi' || cur.t === 'fn' || (cur.t === 'op' && cur.v === '(');
    if (prevEndsValue && curStartsValue) result.push({ t: 'op', v: '*' });
    result.push(cur);
  }
  return result;
}

class Parser {
  private i = 0;
  constructor(
    private tokens: Token[],
    private x: number,
  ) {}

  parse(): number {
    const v = this.expr();
    if (this.i !== this.tokens.length) throw new Error('trailing input');
    return v;
  }

  private peek() {
    return this.tokens[this.i];
  }
  private isOp(v: string) {
    const t = this.peek();
    return t?.t === 'op' && t.v === v;
  }

  private expr(): number {
    let v = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.tokens[this.i++] as { v: string }).v;
      const r = this.term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  private term(): number {
    let v = this.unary();
    while (this.isOp('*') || this.isOp('/')) {
      const op = (this.tokens[this.i++] as { v: string }).v;
      const r = this.unary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }

  private unary(): number {
    if (this.isOp('-')) {
      this.i++;
      return -this.unary();
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.isOp('^')) {
      this.i++;
      const exp = this.unary();
      return Math.pow(base, exp);
    }
    return base;
  }

  private primary(): number {
    const t = this.tokens[this.i++];
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') return t.v;
    if (t.t === 'pi') return Math.PI;
    if (t.t === 'var') return this.x;
    if (t.t === 'fn') return Math.sqrt(this.power());
    if (t.t === 'op' && t.v === '(') {
      const v = this.expr();
      if (!this.isOp(')')) throw new Error('missing )');
      this.i++;
      return v;
    }
    throw new Error('unexpected token');
  }
}

export function evaluate(expression: string, variable?: string, value = 0): number | null {
  try {
    const tokens = tokenize(normaliseExpression(expression), variable);
    if (tokens.length === 0) return null;
    const v = new Parser(tokens, value).parse();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Parses a student's numeric answer: "5", "-2.5", "−5/2", "x = 4", "55°". */
export function parseNumericAnswer(raw: string): number | null {
  const cleaned = raw.replace(/^[a-z]\s*=\s*/i, '').replace(/[₹,]/g, '').replace(/(cm|m|sq|units?|सेमी|मी|वर्ग|इकाई)\.?/gi, '');
  return evaluate(cleaned);
}

export function numbersMatch(a: number, b: number): boolean {
  const tol = Math.max(1e-6, Math.abs(b) * 1e-3);
  return Math.abs(a - b) <= tol;
}

/**
 * Solve a linear equation in one variable (e.g. "2x + 3 = 7") by evaluating
 * f(v) = lhs − rhs at two points. Returns null if not linear or unsolvable.
 */
export function solveLinear(equation: string, variable = 'x'): number | null {
  const parts = equation.split('=');
  if (parts.length !== 2) return null;
  const f = (v: number) => {
    const l = evaluate(parts[0], variable, v);
    const r = evaluate(parts[1], variable, v);
    return l === null || r === null ? null : l - r;
  };
  const f0 = f(0);
  const f1 = f(1);
  const f2 = f(2);
  if (f0 === null || f1 === null || f2 === null) return null;
  const slope = f1 - f0;
  // linearity check: second difference ≈ 0
  if (Math.abs(f2 - 2 * f1 + f0) > 1e-9 || Math.abs(slope) < 1e-12) return null;
  return -f0 / slope;
}
