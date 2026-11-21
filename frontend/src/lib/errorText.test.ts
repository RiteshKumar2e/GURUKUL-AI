import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localiseError } from './errorText';

function serverMessages(): string[] {
  const root = join(__dirname, '../../../backend/src');
  const files: string[] = [];
  const walk = (d: string) =>
    readdirSync(d).forEach((f) => {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    });
  walk(root);
  const found = new Set<string>();
  const patterns = [/(?:badRequest|unauthorized|forbidden|notFound|conflict|unavailable)\('([^']+)'/g, /message(?:: |\()'([^']+)'\)?/g];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const re of patterns) for (const m of text.matchAll(re)) found.add(m[1]);
  }
  return [...found].filter((m) => !/^Use HTTPS/.test(m) && !/^\s*$/.test(m));
}

describe('Hindi error messages', () => {
  it('translates known server messages', () => {
    expect(localiseError('Username or password is incorrect.', 401, 'hi')).toBe('यूज़रनेम या पासवर्ड गलत है।');
    expect(localiseError('File is too large (max 6 MB).', 400, 'hi')).toContain('6 MB');
  });
  it('keeps English when the interface is English, and leaves Hindi text alone', () => {
    expect(localiseError('Password is incorrect.', 400, 'en')).toBe('Password is incorrect.');
    expect(localiseError('AI ट्यूटर अभी उपलब्ध नहीं है।', 503, 'hi')).toBe('AI ट्यूटर अभी उपलब्ध नहीं है।');
  });
  it('falls back to a Hindi sentence by status for unknown messages', () => {
    expect(localiseError('Some new error', 503, 'hi')).toMatch(/[ऀ-ॿ]/);
    expect(localiseError('Some new error', 0, 'hi')).toMatch(/इंटरनेट/);
  });
  it('has a Hindi translation for every error message the API can send', () => {
    const missing = serverMessages().filter((m) => !/[ऀ-ॿ]/.test(localiseError(m, 400, 'hi')) || localiseError(m, 400, 'hi') === localiseError('zz', 400, 'hi'));
    expect(missing).toEqual([]);
  });
});
