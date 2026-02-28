import { describe, it, expect, vi } from 'vitest';
import { getFlavorsCached, sanitizeFlavorPayload } from '../src/kv-cache.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
    _store: store,
  };
}

describe('sanitizeFlavorPayload', () => {
  it('keeps valid flavor rows unchanged', () => {
    const payload = {
      name: 'Mt. Horeb',
      flavors: [
        { date: '2026-02-28', title: 'Butter Pecan', description: 'Classic butter pecan.' },
        { date: '2026-03-01', title: 'Turtle', description: '' },
      ],
    };

    const result = sanitizeFlavorPayload(payload);
    expect(result.dropped).toBe(0);
    expect(result.rawCount).toBe(2);
    expect(result.data.name).toBe('Mt. Horeb');
    expect(result.data.flavors).toHaveLength(2);
  });

  it('drops malformed entries and preserves only trusted fields', () => {
    const payload = {
      name: 'Mt. Horeb<script>',
      flavors: [
        { date: '2026-02-28', title: 'Butter Pecan', description: 'Valid' },
        { date: '2026-13-28', title: 'Bad Date', description: 'Nope' },
        { date: '2026-03-01', title: 'Bad <script>', description: 'Nope' },
      ],
    };

    const result = sanitizeFlavorPayload(payload);
    expect(result.rawCount).toBe(3);
    expect(result.dropped).toBe(2);
    expect(result.data.name).toBe('Unknown');
    expect(result.data.flavors).toEqual([
      { date: '2026-02-28', title: 'Butter Pecan', description: 'Valid' },
    ]);
  });
});

describe('getFlavorsCached sanitization flow', () => {
  it('throws and avoids cache persistence when all upstream rows are invalid', async () => {
    const kv = createMockKV();
    const fetcher = vi.fn(async () => ({
      name: 'Mt. Horeb',
      flavors: [
        { date: 'bad-date', title: 'Bad Row', description: 'x' },
        { date: '2026-02-28', title: '<script>alert(1)</script>', description: 'x' },
      ],
    }));

    await expect(getFlavorsCached('mt-horeb', kv, fetcher)).rejects.toThrow(/No valid flavor entries/);

    const today = new Date().toISOString().slice(0, 10);
    expect(kv._store.get(`meta:payload-anomaly-count:${today}`)).toBe('1');
    expect(kv._store.get(`meta:parse-fail-count:${today}`)).toBe('1');
    expect(kv._store.has('flavors:mt-horeb')).toBe(false);
  });
});
