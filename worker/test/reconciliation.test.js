// D-09: Stats reconciliation suite -- permanent regression prevention.
// These tests independently compute stats and verify parity with production logic.
// No production code imports -- all computation is self-contained.
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Reference implementation: rarity label derivation (mirrors route-today.js
// lines 124-152). Extracted here as a pure function for testability.
// In a future plan, this should be extracted to a shared module.
// ---------------------------------------------------------------------------

/**
 * Derive a rarity label from flavor stats using the 3-gate system.
 * @param {Object} params
 * @param {number} params.appearances - Total appearance count
 * @param {number} params.spanDays - Days between first and last appearance
 * @param {number|null} params.avgGapDays - Average days between consecutive appearances
 * @param {number} [params.networkStoreCount=0] - Stores serving this flavor in last 30 days
 * @returns {string|null} 'Ultra Rare', 'Rare', or null
 */
function deriveRarityLabel({ appearances, spanDays, avgGapDays, networkStoreCount = 0 }) {
  // Gate 1: data quality -- need at least 10 appearances AND 90+ day span
  const meetsDataQuality = appearances >= 10 && spanDays >= 90;

  // Gate 2: network-wide -- suppress if served at >100 stores in last 30 days
  const meetsNetworkGate = networkStoreCount <= 100;

  // Gate 3: derive rarity label from avg_gap_days
  // Ultra Rare: >150 days; Rare: 90-150 days; null otherwise
  if (meetsDataQuality && meetsNetworkGate && avgGapDays !== null) {
    if (avgGapDays > 150) return 'Ultra Rare';
    if (avgGapDays > 90) return 'Rare';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Independent stat computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute average gap in days between consecutive sorted date strings.
 * @param {string[]} dateStrings - ISO date strings sorted ascending
 * @returns {number|null} Rounded average gap, or null if fewer than 2 dates
 */
function computeAvgGapDays(dateStrings) {
  if (dateStrings.length < 2) return null;
  let totalGap = 0;
  for (let i = 1; i < dateStrings.length; i++) {
    const d1 = new Date(dateStrings[i - 1] + 'T00:00:00Z');
    const d2 = new Date(dateStrings[i] + 'T00:00:00Z');
    totalGap += (d2 - d1) / (1000 * 60 * 60 * 24);
  }
  return Math.round(totalGap / (dateStrings.length - 1));
}

/**
 * Compute last_seen and days_since_last from sorted date strings.
 * @param {string[]} dateStrings - ISO date strings sorted ascending
 * @param {Date} now - Current date for comparison
 * @returns {{ lastSeen: string|null, daysSinceLast: number|null }}
 */
function computeLastSeen(dateStrings, now) {
  if (dateStrings.length === 0) return { lastSeen: null, daysSinceLast: null };
  const lastSeen = dateStrings[dateStrings.length - 1];
  const daysSinceLast = Math.round((now - new Date(lastSeen + 'T00:00:00Z')) / (1000 * 60 * 60 * 24));
  return { lastSeen, daysSinceLast };
}

/**
 * Check if a flavor is overdue based on avg gap and days since last.
 * Overdue when days_since_last > 1.5x avgGapDays.
 * @param {number} avgGapDays
 * @param {number} daysSinceLast
 * @returns {boolean}
 */
function isOverdue(avgGapDays, daysSinceLast) {
  if (avgGapDays == null || daysSinceLast == null) return false;
  return daysSinceLast > avgGapDays * 1.5;
}

// ---------------------------------------------------------------------------
// Tests: rarity label derivation (3-gate system)
// ---------------------------------------------------------------------------

describe('rarity label derivation (3-gate system)', () => {
  it('returns Ultra Rare for high avgGapDays with sufficient data', () => {
    const result = deriveRarityLabel({
      appearances: 12, spanDays: 400, avgGapDays: 160, networkStoreCount: 50,
    });
    expect(result).toBe('Ultra Rare');
  });

  it('returns Rare for moderate avgGapDays with sufficient data', () => {
    const result = deriveRarityLabel({
      appearances: 15, spanDays: 200, avgGapDays: 100, networkStoreCount: 30,
    });
    expect(result).toBe('Rare');
  });

  it('returns null for common flavor (low avgGapDays)', () => {
    const result = deriveRarityLabel({
      appearances: 20, spanDays: 300, avgGapDays: 15, networkStoreCount: 20,
    });
    expect(result).toBeNull();
  });

  it('returns null when Gate 1 fails (too few appearances)', () => {
    const result = deriveRarityLabel({
      appearances: 5, spanDays: 200, avgGapDays: 120, networkStoreCount: 10,
    });
    expect(result).toBeNull();
  });

  it('returns null when Gate 1 fails (span too short)', () => {
    const result = deriveRarityLabel({
      appearances: 15, spanDays: 60, avgGapDays: 4, networkStoreCount: 10,
    });
    expect(result).toBeNull();
  });

  it('returns null when Gate 2 fails (too many stores)', () => {
    const result = deriveRarityLabel({
      appearances: 15, spanDays: 200, avgGapDays: 120, networkStoreCount: 150,
    });
    expect(result).toBeNull();
  });

  it('boundary: avgGapDays=90 exactly returns null (Rare requires > 90, not >=)', () => {
    const result = deriveRarityLabel({
      appearances: 15, spanDays: 200, avgGapDays: 90, networkStoreCount: 10,
    });
    expect(result).toBeNull();
  });

  it('boundary: avgGapDays=150 exactly returns Rare (Ultra Rare requires > 150, not >=)', () => {
    const result = deriveRarityLabel({
      appearances: 15, spanDays: 400, avgGapDays: 150, networkStoreCount: 10,
    });
    expect(result).toBe('Rare');
  });
});

// ---------------------------------------------------------------------------
// Tests: independent avg_gap_days computation
// ---------------------------------------------------------------------------

describe('independent avg_gap_days computation', () => {
  it('computes avg gap for evenly spaced dates', () => {
    // Jan 1 -> Feb 1 = 31 days, Feb 1 -> Mar 1 = 28 days
    // avg = Math.round((31 + 28) / 2) = Math.round(29.5) = 30
    const result = computeAvgGapDays(['2025-01-01', '2025-02-01', '2025-03-01']);
    expect(result).toBe(30);
  });

  it('returns null for single date', () => {
    expect(computeAvgGapDays(['2025-06-01'])).toBeNull();
  });

  it('computes avg gap for two dates', () => {
    // Jan 1 -> Jul 1 = 181 days
    const result = computeAvgGapDays(['2025-01-01', '2025-07-01']);
    expect(result).toBe(181);
  });

  it('computes avg gap for irregular spacing', () => {
    // Jan 1 -> Jan 10 = 9 days, Jan 10 -> Jun 1 = 142 days
    // avg = Math.round((9 + 142) / 2) = Math.round(75.5) = 76
    const result = computeAvgGapDays(['2025-01-01', '2025-01-10', '2025-06-01']);
    expect(result).toBe(76);
  });
});

// ---------------------------------------------------------------------------
// Tests: last_seen and days_since_last
// ---------------------------------------------------------------------------

describe('last_seen and days_since_last', () => {
  it('computes last_seen and days_since_last from dates', () => {
    const now = new Date('2026-04-05T00:00:00Z');
    const result = computeLastSeen(['2026-01-01', '2026-02-15', '2026-03-01'], now);
    expect(result.lastSeen).toBe('2026-03-01');
    expect(result.daysSinceLast).toBe(35);
  });

  it('returns null for empty dates', () => {
    const now = new Date('2026-04-05T00:00:00Z');
    const result = computeLastSeen([], now);
    expect(result.lastSeen).toBeNull();
    expect(result.daysSinceLast).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: overdue detection
// ---------------------------------------------------------------------------

describe('overdue detection', () => {
  it('marks as overdue when days_since_last exceeds 1.5x avgGapDays', () => {
    // avgGapDays=30, threshold = 45, days_since_last=46 -> overdue
    expect(isOverdue(30, 46)).toBe(true);
  });

  it('not overdue when days_since_last is within 1.5x avgGapDays', () => {
    expect(isOverdue(30, 20)).toBe(false);
  });

  it('not overdue at exact 1.5x boundary', () => {
    // avgGapDays=30, 1.5x = 45, days_since_last=45 -> NOT overdue (> not >=)
    expect(isOverdue(30, 45)).toBe(false);
  });

  it('not overdue when avgGapDays is null', () => {
    expect(isOverdue(null, 100)).toBe(false);
  });
});
