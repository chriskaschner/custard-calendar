import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordSnapshot, recordSnapshots } from '../src/snapshot-writer.js';

function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => store.set(key, value)),
    _store: store,
  };
}

describe('recordSnapshot', () => {
  let kv;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('writes three keys for a new observation', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'Mint custard with fudge.');

    // Store key
    const storeVal = JSON.parse(kv._store.get('snap:mt-horeb:2026-02-22'));
    expect(storeVal.flavor).toBe('Mint Explosion');
    expect(storeVal.description).toBe('Mint custard with fudge.');
    expect(storeVal.fetchedAt).toBeTruthy();

    // Date index
    const dateVal = JSON.parse(kv._store.get('snap:date:2026-02-22'));
    expect(dateVal).toEqual([{ slug: 'mt-horeb', flavor: 'Mint Explosion' }]);

    // Flavor index (normalized)
    const flavorVal = JSON.parse(kv._store.get('snap:flavor:mint explosion'));
    expect(flavorVal).toEqual([{ slug: 'mt-horeb', date: '2026-02-22', original: 'Mint Explosion' }]);
  });

  it('skips duplicate store+date observations', async () => {
    // First write
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc');

    // Second write for same store+date
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Different Flavor', 'other desc');

    // Store key still has original value
    const storeVal = JSON.parse(kv._store.get('snap:mt-horeb:2026-02-22'));
    expect(storeVal.flavor).toBe('Mint Explosion');

    // Date index should only have one entry
    const dateVal = JSON.parse(kv._store.get('snap:date:2026-02-22'));
    expect(dateVal).toHaveLength(1);
  });

  it('appends to date index for different stores on same date', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', '');
    await recordSnapshot(kv, 'madison-todd-drive', '2026-02-22', 'Butter Pecan', '');

    const dateVal = JSON.parse(kv._store.get('snap:date:2026-02-22'));
    expect(dateVal).toHaveLength(2);
    expect(dateVal[0].slug).toBe('mt-horeb');
    expect(dateVal[1].slug).toBe('madison-todd-drive');
  });

  it('appends to flavor index for same flavor at different stores', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', '');
    await recordSnapshot(kv, 'madison-todd-drive', '2026-02-23', 'Mint Explosion', '');

    const flavorVal = JSON.parse(kv._store.get('snap:flavor:mint explosion'));
    expect(flavorVal).toHaveLength(2);
    expect(flavorVal[0].slug).toBe('mt-horeb');
    expect(flavorVal[1].slug).toBe('madison-todd-drive');
  });

  it('normalizes flavor names with trademark symbols', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'OREO\u00ae Cookie Cheesecake', '');

    // Should normalize to lowercase, stripped trademark
    const flavorKey = 'snap:flavor:oreo cookie cheesecake';
    const flavorVal = JSON.parse(kv._store.get(flavorKey));
    expect(flavorVal).toHaveLength(1);
    expect(flavorVal[0].original).toBe('OREO\u00ae Cookie Cheesecake');
  });

  it('skips when kv is null or missing required params', async () => {
    // No KV
    await recordSnapshot(null, 'mt-horeb', '2026-02-22', 'Mint', '');
    // No slug
    await recordSnapshot(kv, '', '2026-02-22', 'Mint', '');
    // No date
    await recordSnapshot(kv, 'mt-horeb', '', 'Mint', '');
    // No flavor
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', '', '');

    expect(kv.put).not.toHaveBeenCalled();
  });

  it('handles missing description gracefully', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion');

    const storeVal = JSON.parse(kv._store.get('snap:mt-horeb:2026-02-22'));
    expect(storeVal.description).toBe('');
  });
});

describe('recordSnapshots', () => {
  let kv;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('records all flavors from a store response', async () => {
    const data = {
      name: 'Mt. Horeb',
      flavors: [
        { date: '2026-02-22', title: 'Mint Explosion', description: 'Mint custard.' },
        { date: '2026-02-23', title: 'Butter Pecan', description: 'Pecan custard.' },
      ],
    };

    await recordSnapshots(kv, 'mt-horeb', data);

    // Both store keys written
    expect(kv._store.has('snap:mt-horeb:2026-02-22')).toBe(true);
    expect(kv._store.has('snap:mt-horeb:2026-02-23')).toBe(true);

    // Date indices written
    const date22 = JSON.parse(kv._store.get('snap:date:2026-02-22'));
    expect(date22).toHaveLength(1);
    const date23 = JSON.parse(kv._store.get('snap:date:2026-02-23'));
    expect(date23).toHaveLength(1);
  });

  it('skips when data has no flavors', async () => {
    await recordSnapshots(kv, 'mt-horeb', { name: 'Mt. Horeb' });
    await recordSnapshots(kv, 'mt-horeb', null);
    await recordSnapshots(null, 'mt-horeb', { flavors: [] });

    expect(kv.put).not.toHaveBeenCalled();
  });
});

describe('D1 dual-write', () => {
  let kv;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('writes to D1 when db binding is provided', async () => {
    const mockRun = vi.fn(async () => ({}));
    const mockBind = vi.fn(() => ({ run: mockRun }));
    const mockPrepare = vi.fn(() => ({ bind: mockBind }));
    const db = { prepare: mockPrepare };

    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc', { db, brand: "Culver's" });

    expect(mockPrepare).toHaveBeenCalledOnce();
    expect(mockBind).toHaveBeenCalledWith(
      "Culver's", 'mt-horeb', '2026-02-22', 'Mint Explosion', 'mint explosion', 'desc',
      expect.any(String),
    );
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('does not fail when D1 write errors', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => { throw new Error('D1 unavailable'); }),
        })),
      })),
    };

    // Should not throw — D1 failures are non-fatal
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc', { db, brand: "Culver's" });

    // KV writes should still succeed
    expect(kv.put).toHaveBeenCalled();
  });

  it('skips D1 write when no db binding', async () => {
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc', {});

    // KV writes should succeed
    expect(kv.put).toHaveBeenCalled();
  });
});
