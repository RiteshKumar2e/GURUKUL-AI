import { describe, expect, it } from 'vitest';
import { cachedContent, forgetContent } from '../src/utils/contentCache';

describe('content cache', () => {
  it('reads once, shares concurrent misses and returns copies', async () => {
    let calls = 0;
    const load = cachedContent('t.read', async (id: string) => {
      calls++;
      return { id, list: [1, 2] };
    }, 60_000);
    const [a, b] = await Promise.all([load('x'), load('x')]);
    expect(calls).toBe(1);
    a.list.push(3);
    expect((await load('x')).list).toEqual([1, 2]);
    expect(b).not.toBe(a);
    await load('y');
    expect(calls).toBe(2);
  });

  it('does not cache failures', async () => {
    let calls = 0;
    const load = cachedContent('t.fail', async () => {
      calls++;
      if (calls === 1) throw new Error('db down');
      return 'ok';
    }, 60_000);
    await expect(load()).rejects.toThrow('db down');
    expect(await load()).toBe('ok');
  });

  it('forgets one entry on demand', async () => {
    let n = 0;
    const load = cachedContent('t.forget', async (id: string) => `${id}-${++n}`, 60_000);
    expect(await load('s')).toBe('s-1');
    expect(await load('s')).toBe('s-1');
    forgetContent('t.forget', 's');
    expect(await load('s')).toBe('s-2');
  });
});
