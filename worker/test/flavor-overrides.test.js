import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyFlavorOverrides,
  detectBlackoutDates,
  getPremiereDates,
  writePremiereDates,
  resetPremiereDateCache,
  isoPlusDays,
  KNOWN_PREMIERE_DATES,
  PREMIERE_TITLE,
  PREMIERE_BRAND,
  PREMIERE_DATES_KV_KEY,
} from '../src/flavor-overrides.js';

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    _store: store,
  };
}

/** Payload shaped like a real Culver's month with 2026-08-05 withheld. */
function augustPayload() {
  return {
    name: "Culver's of Mt. Horeb, WI",
    flavors: [
      { date: '2026-08-03', title: 'Caramel Pecan', description: 'Salted caramel.' },
      { date: '2026-08-04', title: 'Caramel Turtle', description: 'Pecans and chocolate.' },
      { date: '2026-08-06', title: 'OREO Cookie Cheesecake', description: 'Cheesecake pieces.' },
      { date: '2026-08-07', title: 'Dark Chocolate PB Crunch', description: 'Peanut butter.' },
    ],
  };
}

describe('applyFlavorOverrides — premiere placeholders', () => {
  it('fills a withheld premiere date inside the covered horizon', () => {
    const result = applyFlavorOverrides(augustPayload(), 'mt-horeb', {
      premiereDates: ['2026-08-05'],
    });

    const dates = result.flavors.map(f => f.date);
    expect(dates).toEqual(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']);

    const premiere = result.flavors.find(f => f.date === '2026-08-05');
    expect(premiere.title).toBe(PREMIERE_TITLE);
    expect(premiere.source).toBe('premiere');
    expect(premiere.description).toBeTruthy();
  });

  it('yields to upstream once the real flavor is published', () => {
    const payload = augustPayload();
    payload.flavors.push({
      date: '2026-08-05',
      title: 'Peanut Butter Fudge Brownie',
      description: 'The real thing.',
    });

    const result = applyFlavorOverrides(payload, 'mt-horeb', { premiereDates: ['2026-08-05'] });

    const aug5 = result.flavors.filter(f => f.date === '2026-08-05');
    expect(aug5).toHaveLength(1);
    expect(aug5[0].title).toBe('Peanut Butter Fudge Brownie');
    expect(aug5[0].source).toBeUndefined();
  });

  it('does not placeholder a date outside the store horizon', () => {
    const payload = {
      name: 'Short Horizon',
      flavors: [
        { date: '2026-08-01', title: 'Turtle', description: '' },
        { date: '2026-08-02', title: 'Butter Pecan', description: '' },
      ],
    };
    const result = applyFlavorOverrides(payload, 'mt-horeb', { premiereDates: ['2026-08-05'] });
    expect(result.flavors).toHaveLength(2);
  });

  it('skips non-Culver brands, which have no premiere blackout', () => {
    const result = applyFlavorOverrides(augustPayload(), 'kopps-greenfield', {
      premiereDates: ['2026-08-05'],
      brand: "Kopp's",
    });
    expect(result.flavors.map(f => f.date)).not.toContain('2026-08-05');
  });

  it('returns the input untouched when nothing applies', () => {
    const payload = augustPayload();
    const result = applyFlavorOverrides(payload, 'mt-horeb', { premiereDates: [] });
    expect(result).toBe(payload);
  });

  it('never mutates the input payload', () => {
    const payload = augustPayload();
    const before = JSON.stringify(payload);

    const result = applyFlavorOverrides(payload, 'mt-horeb', { premiereDates: ['2026-08-05'] });

    expect(JSON.stringify(payload)).toBe(before);
    expect(payload.flavors).toHaveLength(4);
    expect(result.flavors).toHaveLength(5);
    expect(result.flavors).not.toBe(payload.flavors);
  });

  it('tolerates a malformed payload', () => {
    expect(applyFlavorOverrides(null, 'mt-horeb', {})).toBeNull();
    expect(applyFlavorOverrides({ name: 'x' }, 'mt-horeb', {})).toEqual({ name: 'x' });
  });
});

describe('applyFlavorOverrides — manual overrides', () => {
  const pin = [{ date: '2026-08-05', scope: 'all', title: 'Peanut Butter Fudge Brownie' }];

  it('fills a gap and wins over the premiere placeholder', () => {
    const result = applyFlavorOverrides(augustPayload(), 'mt-horeb', {
      premiereDates: ['2026-08-05'],
      overrides: pin,
    });

    const aug5 = result.flavors.filter(f => f.date === '2026-08-05');
    expect(aug5).toHaveLength(1);
    expect(aug5[0].title).toBe('Peanut Butter Fudge Brownie');
    expect(aug5[0].source).toBe('override');
  });

  it('defaults to fill-gap, so upstream still wins', () => {
    const payload = augustPayload();
    payload.flavors.push({ date: '2026-08-05', title: 'Real Flavor', description: '' });

    const result = applyFlavorOverrides(payload, 'mt-horeb', { overrides: pin });
    expect(result.flavors.find(f => f.date === '2026-08-05').title).toBe('Real Flavor');
  });

  it('replaces upstream when mode is replace', () => {
    const result = applyFlavorOverrides(augustPayload(), 'mt-horeb', {
      overrides: [{ date: '2026-08-04', scope: 'all', title: 'Corrected Name', mode: 'replace' }],
    });

    const aug4 = result.flavors.find(f => f.date === '2026-08-04');
    expect(aug4.title).toBe('Corrected Name');
    expect(aug4.source).toBe('override');
  });

  it('honors slug scope', () => {
    const scoped = [{ date: '2026-08-05', scope: ['madison-todd-drive'], title: 'Scoped' }];

    const applied = applyFlavorOverrides(augustPayload(), 'madison-todd-drive', { overrides: scoped });
    expect(applied.flavors.find(f => f.date === '2026-08-05').title).toBe('Scoped');

    const skipped = applyFlavorOverrides(augustPayload(), 'mt-horeb', { overrides: scoped });
    expect(skipped.flavors.map(f => f.date)).not.toContain('2026-08-05');
  });

  it('ignores entries with a bad date or no title', () => {
    const result = applyFlavorOverrides(augustPayload(), 'mt-horeb', {
      overrides: [
        { date: 'not-a-date', title: 'Nope' },
        { date: '2026-08-05', title: '' },
      ],
    });
    expect(result.flavors).toHaveLength(4);
  });
});

describe('detectBlackoutDates', () => {
  /** Dense chain-wide coverage with `missing` omitted entirely, as D1 would report. */
  function coverage(start, days, missing = [], stores = 500) {
    const rows = [];
    for (let i = 0; i < days; i++) {
      const date = isoPlusDays(start, i);
      if (missing.includes(date)) continue;
      rows.push({ date, stores });
    }
    return rows;
  }

  it('flags a date with no rows while neighbours are fully covered', () => {
    const rows = coverage('2026-07-29', 20, ['2026-08-05']);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual(['2026-08-05']);
  });

  it('finds two premieres a month apart without either masking the other', () => {
    const rows = coverage('2026-07-29', 45, ['2026-08-05', '2026-09-02']);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-09-10' });
    expect(found).toEqual(['2026-08-05', '2026-09-02']);
  });

  it('ignores a date that merely has fewer stores', () => {
    const rows = coverage('2026-07-29', 20);
    for (const row of rows) {
      if (row.date === '2026-08-05') row.stores = 380;
    }
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual([]);
  });

  it('ignores gaps when the sample is too small to trust', () => {
    const rows = coverage('2026-07-29', 20, ['2026-08-05'], 4);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual([]);
  });

  it('still detects across the month-boundary coverage cliff', () => {
    // Real production shape: stores publish through end of month, so 2026-08-31
    // sits near 71 stores and 2026-09-01 onward near 18. Premieres fall on the
    // first Wednesday, which is always inside that thin zone.
    const rows = [];
    for (let i = 0; i < 40; i++) {
      const date = isoPlusDays('2026-08-20', i);
      if (date === '2026-09-02') continue;
      rows.push({ date, stores: date >= '2026-09-01' ? 18 : 72 });
    }
    const found = detectBlackoutDates(rows, { start: '2026-08-25', end: '2026-09-20' });
    expect(found).toEqual(['2026-09-02']);
  });

  it('discards a multi-day outage instead of calling it a premiere run', () => {
    const missing = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07',
      '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11'];
    const rows = coverage('2026-07-20', 40, missing);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual([]);
  });

  it('discards even a two-day gap, since premieres are always single days', () => {
    const rows = coverage('2026-07-29', 20, ['2026-08-05', '2026-08-06']);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual([]);
  });

  it('returns nothing when too many isolated gaps appear at once', () => {
    const missing = ['2026-08-02', '2026-08-04', '2026-08-06', '2026-08-08',
      '2026-08-10', '2026-08-12', '2026-08-14'];
    const rows = coverage('2026-07-25', 30, missing);
    const found = detectBlackoutDates(rows, { start: '2026-08-01', end: '2026-08-14' });
    expect(found).toEqual([]);
  });

  it('returns nothing on empty or malformed input', () => {
    expect(detectBlackoutDates([], { start: '2026-08-01', end: '2026-08-14' })).toEqual([]);
    expect(detectBlackoutDates(null, { start: '2026-08-01', end: '2026-08-14' })).toEqual([]);
    expect(detectBlackoutDates(coverage('2026-08-01', 10), { start: 'bad', end: '2026-08-14' })).toEqual([]);
  });
});

describe('premiere date storage', () => {
  beforeEach(() => resetPremiereDateCache());

  it('unions the seed list with detected dates', async () => {
    const kv = createMockKV({
      [PREMIERE_DATES_KV_KEY]: JSON.stringify({ dates: ['2026-10-07'] }),
    });

    const dates = await getPremiereDates(kv);
    expect(dates).toContain('2026-10-07');
    for (const seed of KNOWN_PREMIERE_DATES) expect(dates).toContain(seed);
  });

  it('falls back to the seed list when KV is empty or broken', async () => {
    expect(await getPremiereDates(createMockKV())).toEqual([...KNOWN_PREMIERE_DATES].sort());

    resetPremiereDateCache();
    const broken = createMockKV({ [PREMIERE_DATES_KV_KEY]: 'not json' });
    expect(await getPremiereDates(broken)).toEqual([...KNOWN_PREMIERE_DATES].sort());
  });

  it('reads KV once per isolate per day', async () => {
    const kv = createMockKV();
    await getPremiereDates(kv);
    await getPremiereDates(kv);
    await getPremiereDates(kv);
    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it('writes detected dates and invalidates the cache', async () => {
    const kv = createMockKV();
    await getPremiereDates(kv);
    await writePremiereDates(kv, ['2026-11-04']);

    const written = JSON.parse(kv._store.get(PREMIERE_DATES_KV_KEY));
    expect(written.dates).toEqual(['2026-11-04']);
    expect(written.updatedAt).toBeTruthy();

    expect(await getPremiereDates(kv)).toContain('2026-11-04');
  });

  it('survives a KV write failure', async () => {
    const kv = createMockKV();
    kv.put = vi.fn(async () => { throw new Error('KV down'); });
    await expect(writePremiereDates(kv, ['2026-11-04'])).resolves.toBeUndefined();
  });
});

describe('isoPlusDays', () => {
  it('crosses month and year boundaries in UTC', () => {
    expect(isoPlusDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(isoPlusDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(isoPlusDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isoPlusDays('2026-08-05', 0)).toBe('2026-08-05');
  });
});

describe('PREMIERE_BRAND', () => {
  it('matches the brand string the registry produces for Culver stores', () => {
    expect(PREMIERE_BRAND).toBe("Culver's");
  });
});
