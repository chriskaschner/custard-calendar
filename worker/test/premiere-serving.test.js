/**
 * Serving-layer purity for premiere placeholders.
 *
 * The whole design rests on one invariant: placeholders are added on the way OUT
 * of getFlavorsCached, after every write, so they can never enter KV, D1, the
 * rarity corpus, or the unknown-flavor counter. These tests pin that invariant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/snapshot-writer.js', () => ({
  recordSnapshots: vi.fn(async () => {}),
}));

import { recordSnapshots } from '../src/snapshot-writer.js';
import {
  getFlavorsCached,
  makeFlavorCacheRecord,
  recordUnknownFlavorNames,
  MAX_UNKNOWN_FLAVOR_NAMES,
  UNKNOWN_FLAVOR_NAMES_KEY,
} from '../src/kv-cache.js';
import { resetPremiereDateCache, PREMIERE_TITLE } from '../src/flavor-overrides.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    _store: store,
  };
}

// Spans the seeded premiere date 2026-08-05, which upstream withholds.
function upstreamPayload() {
  return {
    name: "Culver's of Mt. Horeb, WI",
    flavors: [
      { date: '2026-08-04', title: 'Caramel Turtle', description: 'Pecans.' },
      { date: '2026-08-06', title: 'Butter Pecan', description: 'Classic.' },
    ],
  };
}

describe('premiere placeholders never reach persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPremiereDateCache();
  });

  it('serves the placeholder on a cache miss but caches only upstream data', async () => {
    const kv = createMockKV();
    const fetcher = vi.fn(async () => upstreamPayload());

    const result = await getFlavorsCached('mt-horeb', kv, fetcher, true, {});

    // Served: placeholder present.
    expect(result.flavors.map(f => f.date)).toEqual(['2026-08-04', '2026-08-05', '2026-08-06']);
    const premiere = result.flavors.find(f => f.date === '2026-08-05');
    expect(premiere.title).toBe(PREMIERE_TITLE);
    expect(premiere.source).toBe('premiere');

    // Cached: placeholder absent.
    const cached = JSON.parse(kv._store.get('flavors:mt-horeb'));
    expect(cached.data.flavors.map(f => f.date)).toEqual(['2026-08-04', '2026-08-06']);
  });

  it('writes no synthetic entry to D1', async () => {
    const kv = createMockKV();
    const fetcher = vi.fn(async () => upstreamPayload());

    await getFlavorsCached('mt-horeb', kv, fetcher, true, {});

    expect(recordSnapshots).toHaveBeenCalledOnce();
    const persisted = recordSnapshots.mock.calls[0][2];
    expect(persisted.flavors.map(f => f.date)).toEqual(['2026-08-04', '2026-08-06']);
    expect(persisted.flavors.some(f => f.source)).toBe(false);
  });

  it('does not count its own placeholder as an unknown flavor', async () => {
    const kv = createMockKV();
    const fetcher = vi.fn(async () => upstreamPayload());

    await getFlavorsCached('mt-horeb', kv, fetcher, true, {});

    const today = new Date().toISOString().slice(0, 10);
    expect(kv._store.has(`meta:unknown-flavor-count:${today}`)).toBe(false);
  });

  it('applies the placeholder on the cache-hit path too', async () => {
    const kv = createMockKV();
    kv._store.set('flavors:mt-horeb', makeFlavorCacheRecord(upstreamPayload(), 'mt-horeb', false));

    const fetcher = vi.fn();
    const result = await getFlavorsCached('mt-horeb', kv, fetcher, true, {});

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.flavors.map(f => f.date)).toEqual(['2026-08-04', '2026-08-05', '2026-08-06']);
  });

  it('records only upstream data when a cache hit re-records snapshots', async () => {
    const kv = createMockKV();
    kv._store.set('flavors:mt-horeb', makeFlavorCacheRecord(upstreamPayload(), 'mt-horeb', false));

    await getFlavorsCached('mt-horeb', kv, vi.fn(), true, { DB: {} }, { recordOnHit: true });

    expect(recordSnapshots).toHaveBeenCalledOnce();
    const persisted = recordSnapshots.mock.calls[0][2];
    expect(persisted.flavors.some(f => f.source === 'premiere')).toBe(false);
  });

  it('yields to upstream once the real premiere flavor is published', async () => {
    const kv = createMockKV();
    const published = upstreamPayload();
    published.flavors.push({
      date: '2026-08-05',
      title: 'Peanut Butter Fudge Brownie',
      description: 'The real one.',
    });

    const result = await getFlavorsCached('mt-horeb', kv, vi.fn(async () => published), true, {});

    const aug5 = result.flavors.filter(f => f.date === '2026-08-05');
    expect(aug5).toHaveLength(1);
    expect(aug5[0].title).toBe('Peanut Butter Fudge Brownie');
    expect(aug5[0].source).toBeUndefined();
  });

  it('leaves non-Culver brands alone', async () => {
    const kv = createMockKV();
    const fetcher = vi.fn(async () => upstreamPayload());

    const result = await getFlavorsCached('kopps-greenfield', kv, fetcher, true, {});

    expect(result.flavors.map(f => f.date)).toEqual(['2026-08-04', '2026-08-06']);
  });
});

describe('recordUnknownFlavorNames', () => {
  const DAY = '2026-08-05';
  const KEY = `${UNKNOWN_FLAVOR_NAMES_KEY}:${DAY}`;
  const read = (kv) => JSON.parse(kv._store.get(KEY));

  beforeEach(() => vi.clearAllMocks());

  it('records the name, store, and date the operator needs to act', async () => {
    const kv = createMockKV();
    await recordUnknownFlavorNames(
      kv,
      [{ title: 'Peanut Butter Fudge Brownie', slug: 'mt-horeb', date: DAY }],
      DAY
    );

    expect(read(kv)).toEqual([
      { title: 'Peanut Butter Fudge Brownie', slug: 'mt-horeb', date: DAY },
    ]);
  });

  it('records a chain-wide debut once, not once per store', async () => {
    const kv = createMockKV();
    for (const slug of ['mt-horeb', 'verona', 'madison-todd-drive']) {
      await recordUnknownFlavorNames(kv, [{ title: 'Brand New Flavor', slug, date: DAY }], DAY);
    }

    const stored = read(kv);
    expect(stored).toHaveLength(1);
    expect(stored[0].slug).toBe('mt-horeb');
  });

  it('dedupes across trademark and curly-quote variants', async () => {
    const kv = createMockKV();
    await recordUnknownFlavorNames(kv, [{ title: "Really Reese's", slug: 'a', date: DAY }], DAY);
    await recordUnknownFlavorNames(kv, [{ title: 'Really Reese’s®', slug: 'b', date: DAY }], DAY);

    expect(read(kv)).toHaveLength(1);
  });

  it('caps the list so one bad upstream day cannot grow it unbounded', async () => {
    const kv = createMockKV();
    const many = Array.from({ length: MAX_UNKNOWN_FLAVOR_NAMES + 15 }, (_, i) => ({
      title: `Flavor ${i}`, slug: 'mt-horeb', date: DAY,
    }));
    await recordUnknownFlavorNames(kv, many, DAY);

    expect(read(kv)).toHaveLength(MAX_UNKNOWN_FLAVOR_NAMES);
  });

  it('starts fresh rather than throwing on a corrupt value', async () => {
    const kv = createMockKV({ [KEY]: 'not json' });
    await expect(
      recordUnknownFlavorNames(kv, [{ title: 'New One', slug: 'mt-horeb', date: DAY }], DAY)
    ).resolves.toBeUndefined();

    expect(read(kv)).toEqual([{ title: 'New One', slug: 'mt-horeb', date: DAY }]);
  });

  it('is a no-op without KV or sightings', async () => {
    await expect(recordUnknownFlavorNames(null, [{ title: 'x' }], DAY)).resolves.toBeUndefined();
    const kv = createMockKV();
    await recordUnknownFlavorNames(kv, [], DAY);
    expect(kv.put).not.toHaveBeenCalled();
  });
});
