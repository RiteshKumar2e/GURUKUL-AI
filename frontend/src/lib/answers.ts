/**
 * Local answer checking for offline practice. Mirrors the server's rules for the
 * answer forms used in the question bank (integers, decimals, fractions, negatives).
 * The server re-grades every synced answer; this is only for instant feedback.
 */
const UNIT_TAIL = /\s*(?:sq\.?|square|वर्ग)?\s*(?:cm|mm|km|m|units?|सेमी|मिमी|किमी|मीटर|मी|इकाई)\.?\s*(?:²|³|\^\s*[23])?\s*$/i;
const SQ_TAIL = /\s*(?:sq\.?|square|वर्ग)\s*$/i;

export function parseNumber(raw: string): number | null {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]\s*=\s*/, '')
    .replace(/[−–—]/g, '-')
    .replace(/[₹°]/g, '')
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1');
  s = s.replace(UNIT_TAIL, '').replace(SQ_TAIL, '').trim();
  // Mixed number: "2 1/2" is 2.5, not 21/2
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const d = Number(mixed[4]);
    if (d === 0) return null;
    const v = Number(mixed[2]) + Number(mixed[3]) / d;
    return mixed[1] ? -v : v;
  }
  // Any other space between digits is ambiguous ("2 3"), so it is not guessed
  if (/\d\s+\d/.test(s)) return null;
  s = s.replace(/\s+/g, '');
  if (!s) return null;
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
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
