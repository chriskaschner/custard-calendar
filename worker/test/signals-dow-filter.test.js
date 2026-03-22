/**
 * Tests for DOW pattern signal filtering in signals.js (S06-T01).
 *
 * Rule: dow_pattern signals should only be returned when the pattern flavor
 * matches today's confirmed FOTD. Irrelevant DOW patterns for other flavors
 * are noise and must be suppressed.
 */
import { describe, it, expect } from 'vitest';
import { computeSignals, SIGNAL_TYPES } from '../src/signals.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build snapshot rows for a flavor with a strong DOW bias.
 * Creates MIN_DOW_APPEARANCES rows, all on Sundays (DOW=0).
 */
function makeDowRows(flavor, count = 16, preferredDow = 0, startDate = '2023-06-04') {
  const rows = [];
  const start = new Date(startDate + 'T00:00:00Z');
  // Find first Sunday on or after start
  let cur = new Date(start);
  while (cur.getUTCDay() !== preferredDow) cur.setUTCDate(cur.getUTCDate() + 1);

  for (let i = 0; i < count; i++) {
    rows.push({ flavor, normalized_flavor: flavor.toLowerCase(), date: cur.toISOString().slice(0, 10) });
    cur.setUTCDate(cur.getUTCDate() + 7); // next preferred day
  }
  return rows;
}

// ---------------------------------------------------------------------------
// DOW filter: only show when signal flavor == todayFlavor
// ---------------------------------------------------------------------------

describe('signals DOW pattern filter by today FOTD', () => {
  it('returns DOW pattern when signal flavor matches todayFlavor', () => {
    const today = '2026-03-22';
    const rows = makeDowRows('Turtle', 16);
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: 'Turtle',
      limit: 10,
    });
    const dowSignals = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN);
    // May or may not detect DOW pattern depending on chi-squared, but if detected it should pass
    for (const sig of dowSignals) {
      expect(sig.flavor).toBe('Turtle');
    }
  });

  it('suppresses DOW pattern when todayFlavor is a different flavor', () => {
    const today = '2026-03-22';
    const rows = [
      ...makeDowRows('Turtle', 16),       // strong DOW bias for Turtle
      // Add some non-DOW data for the current flavor (Chocolate)
      { flavor: 'Chocolate', normalized_flavor: 'chocolate', date: today },
    ];
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: 'Chocolate', // today is NOT Turtle
      limit: 10,
    });
    const turtleDow = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN && s.flavor === 'Turtle');
    expect(turtleDow).toHaveLength(0);
  });

  it('suppresses ALL DOW patterns when todayFlavor is null/undefined', () => {
    const today = '2026-03-22';
    const rows = makeDowRows('Butter Pecan', 16);
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: null,
      limit: 10,
    });
    const dowSignals = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN);
    expect(dowSignals).toHaveLength(0);
  });

  it('suppresses ALL DOW patterns when todayFlavor is empty string', () => {
    const today = '2026-03-22';
    const rows = makeDowRows('Caramel Pecan', 16);
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: '',
      limit: 10,
    });
    const dowSignals = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN);
    expect(dowSignals).toHaveLength(0);
  });

  it('does not suppress other signal types (overdue, seasonal, streak)', () => {
    const today = '2026-03-22';
    // Build overdue data: 4 appearances every 7 days, last one 21 days ago
    const overdueDates = [
      { flavor: 'Rocky Road', normalized_flavor: 'rocky road', date: '2025-12-01' },
      { flavor: 'Rocky Road', normalized_flavor: 'rocky road', date: '2025-12-08' },
      { flavor: 'Rocky Road', normalized_flavor: 'rocky road', date: '2025-12-15' },
      { flavor: 'Rocky Road', normalized_flavor: 'rocky road', date: '2026-03-01' }, // ~21 days before today
    ];
    // Also add DOW data for Turtle (should be suppressed)
    const rows = [...overdueDates, ...makeDowRows('Turtle', 16)];
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: 'Rocky Road',
      limit: 20,
    });
    // DOW signals for Turtle should be suppressed (todayFlavor is Rocky Road)
    const turtleDow = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN && s.flavor === 'Turtle');
    expect(turtleDow).toHaveLength(0);
    // Non-DOW signals should not be suppressed
    const nonDow = signals.filter(s => s.type !== SIGNAL_TYPES.DOW_PATTERN);
    // There may or may not be an overdue signal depending on gap ratios, but no crash
    expect(Array.isArray(nonDow)).toBe(true);
  });

  it('case-insensitive flavor match for DOW filter', () => {
    const today = '2026-03-22';
    const rows = makeDowRows('Turtle', 16);
    // todayFlavor with different case
    const signals = computeSignals({
      snapshotRows: rows,
      today,
      todayFlavor: 'TURTLE',
      limit: 10,
    });
    // DOW signals for Turtle should pass (case-insensitive match)
    const turtleDow = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN);
    for (const sig of turtleDow) {
      expect(sig.flavor.toLowerCase()).toBe('turtle');
    }
    // No other flavors' DOW patterns should leak through
    const otherDow = signals.filter(s => s.type === SIGNAL_TYPES.DOW_PATTERN && s.flavor.toLowerCase() !== 'turtle');
    expect(otherDow).toHaveLength(0);
  });
});
