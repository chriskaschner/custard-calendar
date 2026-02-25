import { describe, it, expect, vi } from 'vitest';
import {
  SIGNAL_TYPES,
  MIN_APPEARANCES,
  OVERDUE_RATIO,
  MIN_DOW_APPEARANCES,
  MIN_DOW_DISTINCT_DAYS,
  MIN_DOW_PEAK_PCT,
  MAX_DOW_PEAK_PCT,
  MIN_DOW_PEAK_LIFT_PCT,
  MAX_BASELINE_PEAK_PCT,
  CHI_SQUARED_CRITICAL,
  CHI_SQUARED_CRITICAL_BY_DF,
  SEASONAL_CONCENTRATION,
  MIN_STREAK_DAYS,
  MAX_RARE_STORES,
  detectOverdue,
  detectDowPatterns,
  detectSeasonal,
  detectStreaks,
  detectRareFind,
  buildFlavorHistory,
  computeSignals,
  handleSignals,
} from '../src/signals.js';

// --- Helpers ---

function makeDates(startDate, count, gapDays = 7) {
  const dates = [];
  const start = new Date(startDate).getTime();
  for (let i = 0; i < count; i++) {
    dates.push(new Date(start + i * gapDays * 86400000).toISOString().slice(0, 10));
  }
  return dates;
}

// --- Constants ---

describe('signal type constants', () => {
  it('exports five signal types', () => {
    expect(Object.keys(SIGNAL_TYPES)).toHaveLength(5);
    expect(SIGNAL_TYPES.OVERDUE).toBe('overdue');
    expect(SIGNAL_TYPES.DOW_PATTERN).toBe('dow_pattern');
    expect(SIGNAL_TYPES.SEASONAL).toBe('seasonal');
    expect(SIGNAL_TYPES.ACTIVE_STREAK).toBe('active_streak');
    expect(SIGNAL_TYPES.RARE_FIND).toBe('rare_find');
  });

  it('exports threshold constants', () => {
    expect(MIN_APPEARANCES).toBe(3);
    expect(OVERDUE_RATIO).toBe(1.5);
    expect(MIN_DOW_APPEARANCES).toBe(12);
    expect(MIN_DOW_DISTINCT_DAYS).toBe(2);
    expect(MIN_DOW_PEAK_PCT).toBe(45);
    expect(MAX_DOW_PEAK_PCT).toBe(90);
    expect(MIN_DOW_PEAK_LIFT_PCT).toBe(20);
    expect(MAX_BASELINE_PEAK_PCT).toBe(65);
    expect(CHI_SQUARED_CRITICAL).toBe(12.592);
    expect(CHI_SQUARED_CRITICAL_BY_DF[6]).toBe(12.592);
    expect(SEASONAL_CONCENTRATION).toBe(0.5);
    expect(MIN_STREAK_DAYS).toBe(2);
    expect(MAX_RARE_STORES).toBe(3);
  });
});

// --- detectOverdue ---

describe('detectOverdue', () => {
  it('detects overdue flavor when days_since > 1.5x avg_gap', () => {
    // 4 appearances every ~10 days, last one 20 days ago
    const dates = ['2026-01-01', '2026-01-11', '2026-01-21', '2026-01-31'];
    const signals = detectOverdue(
      [{ flavor: 'Butter Pecan', dates }],
      '2026-02-20' // 20 days since last = 2x avg gap of 10
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('overdue');
    expect(signals[0].flavor).toBe('Butter Pecan');
    expect(signals[0].action).toBe('alert');
    expect(signals[0].evidence.days_since).toBe(20);
    expect(signals[0].evidence.avg_gap_days).toBe(10);
    expect(signals[0].evidence.ratio).toBeGreaterThanOrEqual(1.5);
  });

  it('skips flavor with too few appearances', () => {
    const signals = detectOverdue(
      [{ flavor: 'Rare', dates: ['2026-01-01', '2026-01-15'] }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(0);
  });

  it('skips flavor that is not overdue', () => {
    // Last seen 5 days ago with avg gap of 10 = ratio 0.5
    const dates = ['2026-01-01', '2026-01-11', '2026-01-21', '2026-02-15'];
    const signals = detectOverdue(
      [{ flavor: 'Turtle', dates }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(0);
  });

  it('sorts by overdue ratio descending', () => {
    const signals = detectOverdue([
      { flavor: 'A', dates: makeDates('2025-11-01', 5, 10) }, // avg gap 10, last Nov 11 -> ~101 days overdue
      { flavor: 'B', dates: makeDates('2025-12-01', 5, 10) }, // avg gap 10, last Dec 11 -> ~71 days overdue
    ], '2026-02-20');
    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals[0].flavor).toBe('A');
  });
});

// --- detectDowPatterns ---

describe('detectDowPatterns', () => {
  it('detects significant DOW bias', () => {
    // 12 Tuesdays + 2 Thursdays: still strong Tuesday bias, but not single-day cadence.
    const dates = [
      '2026-01-06', '2026-01-13', '2026-01-20', '2026-01-27',
      '2026-02-03', '2026-02-10', '2026-02-17', '2026-02-24',
      '2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24',
      '2026-01-08', '2026-03-12',
    ];
    const signals = detectDowPatterns([{ flavor: 'Turtle', dates }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('dow_pattern');
    expect(signals[0].evidence.peak_name).toBe('Tuesday');
    expect(signals[0].evidence.peak_pct).toBeGreaterThanOrEqual(80);
    expect(signals[0].action).toBe('calendar');
  });

  it('skips evenly distributed flavors', () => {
    // Spread across all days relatively evenly
    const dates = makeDates('2026-01-01', 14, 1); // 14 consecutive days, 2 per DOW
    const signals = detectDowPatterns([{ flavor: 'Balanced', dates }]);
    expect(signals).toHaveLength(0);
  });

  it('skips flavor with too few appearances', () => {
    const signals = detectDowPatterns([{ flavor: 'Rare', dates: ['2026-01-06', '2026-01-13'] }]);
    expect(signals).toHaveLength(0);
  });

  it('suppresses cadence artifacts when store baseline is one weekday', () => {
    const mondays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date('2026-01-05'); // Monday
      d.setUTCDate(d.getUTCDate() + i * 7);
      return d.toISOString().slice(0, 10);
    });
    const signals = detectDowPatterns(
      [{ flavor: 'Cadence Artifact', dates: mondays }],
      {
        baselineDowCounts: [0, 28, 0, 0, 0, 0, 0],
        baselineTotal: 28,
      }
    );
    expect(signals).toHaveLength(0);
  });

  it('suppresses single-day flavor cadence even without baseline data', () => {
    const tuesdaysOnly = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 6));
      d.setUTCDate(d.getUTCDate() + i * 7);
      return d.toISOString().slice(0, 10);
    });
    const signals = detectDowPatterns([{ flavor: 'Every Tuesday', dates: tuesdaysOnly }]);
    expect(signals).toHaveLength(0);
  });

  it('suppresses DOW pattern when store baseline is already heavily concentrated', () => {
    const mondaysWithOneTuesday = [
      '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26',
      '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
      '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
      '2026-03-30', '2026-03-31',
    ];
    const signals = detectDowPatterns(
      [{ flavor: 'Baseline Dominated', dates: mondaysWithOneTuesday }],
      {
        baselineDowCounts: [2, 70, 8, 8, 6, 5, 1],
        baselineTotal: 100,
      }
    );
    expect(signals).toHaveLength(0);
  });

  it('suppresses weak lift over a strong baseline weekday', () => {
    const mostlyMondays = [
      '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26',
      '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
      '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
      '2026-03-30', '2026-04-01',
    ];
    const signals = detectDowPatterns(
      [{ flavor: 'Baseline Monday Flavor', dates: mostlyMondays }],
      {
        baselineDowCounts: [0, 70, 5, 5, 5, 5, 5],
        baselineTotal: 95,
      }
    );
    expect(signals).toHaveLength(0);
  });

  it('suppresses near-single-day patterns even when one outlier weekday exists', () => {
    const almostAllMondays = [
      '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26',
      '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
      '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
      '2026-03-30', '2026-04-01',
    ];
    const signals = detectDowPatterns([{ flavor: 'Almost Monday Only', dates: almostAllMondays }]);
    expect(signals).toHaveLength(0);
  });
});

// --- detectSeasonal ---

describe('detectSeasonal', () => {
  it('detects seasonal concentration', () => {
    // 8 appearances, 7 in Dec-Feb
    const dates = [
      '2025-12-01', '2025-12-15', '2026-01-05', '2026-01-20',
      '2026-02-01', '2026-02-10', '2026-02-20', '2025-07-15',
    ];
    const signals = detectSeasonal([{ flavor: 'Mint Explosion', dates }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('seasonal');
    expect(signals[0].flavor).toBe('Mint Explosion');
    expect(signals[0].evidence.concentration).toBeGreaterThanOrEqual(0.5);
    expect(signals[0].action).toBe('alert');
  });

  it('skips evenly distributed flavor', () => {
    // 12 appearances, 1 per month
    const dates = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-15`);
    const signals = detectSeasonal([{ flavor: 'Vanilla', dates }]);
    expect(signals).toHaveLength(0);
  });

  it('requires minimum 6 appearances', () => {
    const signals = detectSeasonal([{ flavor: 'Rare', dates: ['2026-01-01', '2026-01-15', '2026-02-01'] }]);
    expect(signals).toHaveLength(0);
  });
});

// --- detectStreaks ---

describe('detectStreaks', () => {
  it('detects active streak', () => {
    const signals = detectStreaks(
      [{ flavor: 'Chocolate Fudge', dates: ['2026-02-18', '2026-02-19', '2026-02-20'] }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('active_streak');
    expect(signals[0].evidence.streak_days).toBe(3);
    expect(signals[0].action).toBe('directions');
  });

  it('detects streak ending yesterday', () => {
    const signals = detectStreaks(
      [{ flavor: 'Turtle', dates: ['2026-02-18', '2026-02-19'] }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].evidence.streak_days).toBe(2);
  });

  it('skips inactive streak (last seen 3 days ago)', () => {
    const signals = detectStreaks(
      [{ flavor: 'Old', dates: ['2026-02-15', '2026-02-16', '2026-02-17'] }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(0);
  });

  it('skips single-day appearance', () => {
    const signals = detectStreaks(
      [{ flavor: 'Once', dates: ['2026-02-20'] }],
      '2026-02-20'
    );
    expect(signals).toHaveLength(0);
  });
});

// --- detectRareFind ---

describe('detectRareFind', () => {
  it('returns signal for flavor at 1 store', () => {
    const signal = detectRareFind('Georgia Peach', 1);
    expect(signal).not.toBeNull();
    expect(signal.type).toBe('rare_find');
    expect(signal.explanation).toContain('1 store');
    expect(signal.action).toBe('directions');
  });

  it('returns signal for flavor at 3 stores', () => {
    const signal = detectRareFind('Blackberry Cobbler', 3);
    expect(signal).not.toBeNull();
    expect(signal.evidence.store_count).toBe(3);
  });

  it('returns null for flavor at 4+ stores', () => {
    expect(detectRareFind('Vanilla', 10)).toBeNull();
  });

  it('returns null when no flavor', () => {
    expect(detectRareFind(null, 1)).toBeNull();
    expect(detectRareFind('', 1)).toBeNull();
  });

  it('returns null when storeCount is not a number', () => {
    expect(detectRareFind('Turtle', undefined)).toBeNull();
  });
});

// --- buildFlavorHistory ---

describe('buildFlavorHistory', () => {
  it('groups rows by flavor', () => {
    const rows = [
      { flavor: 'Turtle', date: '2026-01-01' },
      { flavor: 'Turtle', date: '2026-01-15' },
      { flavor: 'Vanilla', date: '2026-01-10' },
    ];
    const history = buildFlavorHistory(rows);
    expect(history).toHaveLength(2);
    const turtle = history.find((h) => h.flavor === 'Turtle');
    expect(turtle.dates).toEqual(['2026-01-01', '2026-01-15']);
  });

  it('skips rows without flavor or date', () => {
    const rows = [
      { flavor: '', date: '2026-01-01' },
      { flavor: 'Turtle', date: null },
      { flavor: 'Valid', date: '2026-01-01' },
    ];
    const history = buildFlavorHistory(rows);
    expect(history).toHaveLength(1);
    expect(history[0].flavor).toBe('Valid');
  });

  it('returns empty for empty input', () => {
    expect(buildFlavorHistory([])).toEqual([]);
  });
});

// --- computeSignals ---

describe('computeSignals', () => {
  it('returns top signals sorted by score', () => {
    const rows = [
      // Overdue flavor: 5 appearances every 10 days, last 30 days ago
      ...makeDates('2025-11-01', 5, 10).map((d) => ({ flavor: 'Overdue One', date: d })),
      // Active streak
      { flavor: 'Streaking', date: '2026-02-18' },
      { flavor: 'Streaking', date: '2026-02-19' },
      { flavor: 'Streaking', date: '2026-02-20' },
    ];
    const signals = computeSignals({
      snapshotRows: rows,
      today: '2026-02-20',
      todayFlavor: 'Streaking',
      todayFlavorStoreCount: 1,
    });
    expect(signals.length).toBeGreaterThanOrEqual(2);
    // Should have overdue, streak, and rare_find
    const types = signals.map((s) => s.type);
    expect(types).toContain('overdue');
    expect(types).toContain('active_streak');
    expect(types).toContain('rare_find');
  });

  it('respects limit parameter', () => {
    const rows = makeDates('2025-06-01', 20, 10).map((d) => ({ flavor: 'A', date: d }));
    const signals = computeSignals({
      snapshotRows: rows,
      today: '2026-02-20',
      limit: 1,
    });
    expect(signals.length).toBeLessThanOrEqual(1);
  });

  it('returns empty for empty history', () => {
    const signals = computeSignals({ snapshotRows: [], today: '2026-02-20' });
    expect(signals).toEqual([]);
  });

  it('uses store weekday baseline to avoid false Monday bias', () => {
    const snapshotRows = Array.from({ length: 28 }, (_, i) => {
      const d = new Date('2025-10-06'); // Monday
      d.setUTCDate(d.getUTCDate() + i * 7);
      return {
        flavor: i % 2 === 0 ? 'Flavor A' : 'Flavor B',
        date: d.toISOString().slice(0, 10),
      };
    });
    const signals = computeSignals({
      snapshotRows,
      today: '2026-02-17',
      limit: 10,
    });
    expect(signals.some((s) => s.type === 'dow_pattern')).toBe(false);
  });
});

// --- handleSignals API ---

describe('handleSignals', () => {
  function makeUrl(path, params = {}) {
    const u = new URL('https://test.com' + path);
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
    return u;
  }

  const cors = { 'Access-Control-Allow-Origin': '*' };

  it('returns 400 if no slug', async () => {
    const resp = await handleSignals(makeUrl('/api/v1/signals/'), {}, cors);
    expect(resp.status).toBe(400);
  });

  it('returns 503 if no DB', async () => {
    const resp = await handleSignals(makeUrl('/api/v1/signals/mt-horeb'), {}, cors);
    expect(resp.status).toBe(503);
  });

  it('returns empty signals for store with no history', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [] })),
        })),
      })),
    };
    const resp = await handleSignals(makeUrl('/api/v1/signals/mt-horeb'), { DB: db }, cors);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.signals).toEqual([]);
  });

  it('returns signals for store with history', async () => {
    const rows = [
      // Create overdue pattern
      ...makeDates('2025-10-01', 5, 10).map((d) => ({ flavor: 'Turtle', date: d })),
    ];
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: rows })),
          first: vi.fn(async () => null),
        })),
      })),
    };
    const resp = await handleSignals(makeUrl('/api/v1/signals/mt-horeb'), { DB: db }, cors);
    expect(resp.status).toBe(200);
    const json = await resp.json();
    expect(json.slug).toBe('mt-horeb');
    expect(json.signals.length).toBeGreaterThanOrEqual(1);
  });
});
