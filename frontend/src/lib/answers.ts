/**
 * Local answer checking for offline practice. Mirrors the server's rules for the
 * answer forms used in the question bank (integers, decimals, fractions, negatives).
 * The server re-grades every synced answer; this is only for instant feedback.
 */
export function parseNumber(raw: string): number | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]\s*=\s*/, '')
    .replace(/[−–—]/g, '-')
    .replace(/[₹,°\s]/g, '')
    .replace(/(cm|m|sq|units?|सेमी|मी|वर्ग|इकाई)\.?/g, '');
  if (!s) return null;
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function checkAnswer(type: 'MCQ' | 'NUMERIC', correct: string, given: string): boolean {
  if (!given.trim()) return false;
  if (type === 'MCQ') return given.trim().toLowerCase() === correct.trim().toLowerCase();
  const a = parseNumber(given);
  const b = parseNumber(correct);
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-3);
}
