import { describe, it, expect, vi } from 'vitest';
import { recordSnapshot, recordSnapshots } from '../src/snapshot-writer.js';

function createMockKV() {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
  };
}

function createMockDb() {
  const run = vi.fn(async () => ({}));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare }, prepare, bind, run };
}

describe('recordSnapshot (D1-only)', () => {
  it('writes one row to D1 with normalized flavor', async () => {
    const kv = createMockKV();
    const { db, prepare, bind, run } = createMockDb();

    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'OREO\u00ae Cookie Cheesecake', 'desc', {
      db,
      brand: "Culver's",
    });

    expect(prepare).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenCalledWith(
      "Culver's",
      'mt-horeb',
      '2026-02-22',
      'OREO\u00ae Cookie Cheesecake',
      'oreo cookie cheesecake',
      'desc',
      expect.any(String),
    );
    expect(run).toHaveBeenCalledOnce();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('no-ops when db binding is missing', async () => {
    const kv = createMockKV();
    await recordSnapshot(kv, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc', {});
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('no-ops when required fields are missing', async () => {
    const { db, run } = createMockDb();
    await recordSnapshot(null, '', '2026-02-22', 'Mint', '', { db });
    await recordSnapshot(null, 'mt-horeb', '', 'Mint', '', { db });
    await recordSnapshot(null, 'mt-horeb', '2026-02-22', '', '', { db });
    expect(run).not.toHaveBeenCalled();
  });

  it('does not throw when D1 write fails', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => { throw new Error('D1 unavailable'); }),
        })),
      })),
    };

    await expect(
      recordSnapshot(null, 'mt-horeb', '2026-02-22', 'Mint Explosion', 'desc', { db, brand: "Culver's" })
    ).resolves.toBeUndefined();
  });
});

describe('recordSnapshots (D1-only)', () => {
  it('writes all flavors via recordSnapshot pipeline', async () => {
    const { db, run } = createMockDb();
    const data = {
      name: 'Mt. Horeb',
      flavors: [
        { date: '2026-02-22', title: 'Mint Explosion', description: 'Mint custard.' },
        { date: '2026-02-23', title: 'Butter Pecan', description: 'Pecan custard.' },
      ],
    };

    await recordSnapshots(null, 'mt-horeb', data, { db, brand: "Culver's" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('skips when flavors array is missing', async () => {
    const { db, run } = createMockDb();
    await recordSnapshots(null, 'mt-horeb', { name: 'Mt. Horeb' }, { db });
    await recordSnapshots(null, 'mt-horeb', null, { db });
    expect(run).not.toHaveBeenCalled();
  });
});
