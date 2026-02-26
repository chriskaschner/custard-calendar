import { describe, it, expect, vi } from 'vitest';
import {
  getForecastSlugs,
  getSubscriptionSlugs,
  resolveSnapshotTargets,
  getCronCursor,
  setCronCursor,
} from '../src/snapshot-targets.js';

function createMockDb(forecastSlugs = []) {
  const store = new Map();
  return {
    _store: store,
    prepare: vi.fn((sql) => {
      if (sql.includes('FROM forecasts')) {
        return {
          all: vi.fn(async () => ({
            results: forecastSlugs.map(s => ({ slug: s })),
          })),
          bind: vi.fn(() => ({
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({})),
          })),
        };
      }
      // cron_state queries
      return {
        bind: vi.fn((...args) => ({
          first: vi.fn(async () => {
            if (sql.includes('SELECT value FROM cron_state')) {
              const row = store.get(args[0]);
              return row ? { value: row } : null;
            }
            return null;
          }),
          run: vi.fn(async () => {
            if (sql.includes('INSERT INTO cron_state')) {
              store.set(args[0], args[1]);
            }
            return {};
          }),
        })),
      };
    }),
  };
}

function createMockKV(subscriptions = {}) {
  const store = new Map(Object.entries(subscriptions));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    list: vi.fn(async (opts) => {
      const prefix = opts?.prefix || '';
      const keys = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          keys.push({ name: key });
        }
      }
      return { keys, list_complete: true };
    }),
  };
}

describe('resolveSnapshotTargets', () => {
  it('returns union of forecast + subscription slugs, deduplicated and sorted', async () => {
    const db = createMockDb(['mt-horeb', 'madison-todd-drive']);
    const kv = createMockKV({
      'alert:sub:abc': JSON.stringify({
        slug: 'mt-horeb',
        email: 'a@b.com',
        favorites: [],
        unsubToken: 'tok-1',
        createdAt: '2026-02-23T00:00:00.000Z',
      }),
      'alert:sub:def': JSON.stringify({
        slug: 'middleton',
        email: 'c@d.com',
        favorites: [],
        unsubToken: 'tok-2',
        createdAt: '2026-02-23T00:00:00.000Z',
      }),
    });

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual(['madison-todd-drive', 'middleton', 'mt-horeb']);
  });

  it('returns forecast slugs only when no subscriptions', async () => {
    const db = createMockDb(['mt-horeb', 'madison-todd-drive']);
    const kv = createMockKV({});

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual(['madison-todd-drive', 'mt-horeb']);
  });

  it('returns subscription slugs only when no forecasts', async () => {
    const db = createMockDb([]);
    const kv = createMockKV({
      'alert:sub:abc': JSON.stringify({
        slug: 'middleton',
        email: 'a@b.com',
        favorites: [],
        unsubToken: 'tok-1',
        createdAt: '2026-02-23T00:00:00.000Z',
      }),
    });

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual(['middleton']);
  });

  it('reads subscription slugs from materialized index when available', async () => {
    const db = createMockDb([]);
    const kv = createMockKV({
      'alert:index:subscriptions:v1': JSON.stringify([
        {
          id: 'abc',
          email: 'a@b.com',
          slug: 'middleton',
          favorites: ['Turtle'],
          frequency: 'daily',
          unsubToken: 'tok-1',
          createdAt: '2026-02-23T00:00:00.000Z',
        },
      ]),
    });

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual(['middleton']);
  });

  it('returns empty for empty inputs', async () => {
    const db = createMockDb([]);
    const kv = createMockKV({});

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual([]);
  });
});

describe('getCronCursor / setCronCursor', () => {
  it('read-after-write returns correct value', async () => {
    const db = createMockDb();
    await setCronCursor(db, 'snapshot_harvest', 42);
    const value = await getCronCursor(db, 'snapshot_harvest');
    expect(value).toBe(42);
  });
});

describe('error paths — catch branches', () => {
  it('getSubscriptionSlugs returns [] when KV list throws', async () => {
    const badKV = {
      list: vi.fn(async () => { throw new Error('KV unavailable'); }),
      get: vi.fn(async () => null),
    };
    const result = await getSubscriptionSlugs(badKV);
    expect(result).toEqual([]);
  });

  it('getCronCursor returns 0 when db is null', async () => {
    const result = await getCronCursor(null, 'snapshot_harvest');
    expect(result).toBe(0);
  });

  it('getCronCursor returns 0 when db.prepare throws', async () => {
    const badDb = { prepare: vi.fn(() => { throw new Error('DB error'); }) };
    const result = await getCronCursor(badDb, 'snapshot_harvest');
    expect(result).toBe(0);
  });

  it('setCronCursor is a no-op when db is null', async () => {
    // Should not throw
    await expect(setCronCursor(null, 'snapshot_harvest', 5)).resolves.toBeUndefined();
  });

  it('setCronCursor swallows errors when db.prepare throws', async () => {
    const badDb = { prepare: vi.fn(() => { throw new Error('DB write error'); }) };
    // Should not throw — error is caught internally
    await expect(setCronCursor(badDb, 'snapshot_harvest', 5)).resolves.toBeUndefined();
  });
});

describe('batch cursor progression', () => {
  it('two calls advance through sorted list without skip or starve', async () => {
    const db = createMockDb(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    const kv = createMockKV({});

    const targets = await resolveSnapshotTargets(db, kv);
    expect(targets).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);

    // Simulate batch size of 2
    const BATCH_SIZE = 2;

    // First batch: cursor=0, take [0,2)
    let cursor = await getCronCursor(db, 'snapshot_harvest');
    expect(cursor).toBe(0);
    let batch = targets.slice(cursor, cursor + BATCH_SIZE);
    expect(batch).toEqual(['alpha', 'bravo']);
    let next = cursor + batch.length >= targets.length ? 0 : cursor + batch.length;
    await setCronCursor(db, 'snapshot_harvest', next);

    // Second batch: cursor=2, take [2,4)
    cursor = await getCronCursor(db, 'snapshot_harvest');
    expect(cursor).toBe(2);
    batch = targets.slice(cursor, cursor + BATCH_SIZE);
    expect(batch).toEqual(['charlie', 'delta']);
    next = cursor + batch.length >= targets.length ? 0 : cursor + batch.length;
    await setCronCursor(db, 'snapshot_harvest', next);

    // Third batch: cursor=4, take [4,5) — wraps to 0
    cursor = await getCronCursor(db, 'snapshot_harvest');
    expect(cursor).toBe(4);
    batch = targets.slice(cursor, cursor + BATCH_SIZE);
    expect(batch).toEqual(['echo']);
    next = cursor + batch.length >= targets.length ? 0 : cursor + batch.length;
    expect(next).toBe(0);
  });
});
