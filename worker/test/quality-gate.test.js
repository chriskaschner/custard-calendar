// RED phase: these tests target functions to be implemented in Plan 02
import { describe, it, expect } from 'vitest';
import { isKnownFlavor, detectDuplicateDays, isStaleStore } from '../src/kv-cache.js';

// ---------------------------------------------------------------------------
// D-05a: Unknown flavor detection
// ---------------------------------------------------------------------------

describe('D-05a: unknown flavor detection', () => {
  it('recognizes a profiled flavor by exact name', () => {
    expect(isKnownFlavor('Butter Pecan')).toBe(true);
  });

  it('recognizes another profiled flavor', () => {
    expect(isKnownFlavor('Chocolate Volcano')).toBe(true);
  });

  it('rejects a totally unknown flavor', () => {
    expect(isKnownFlavor('Totally Made Up Flavor 9000')).toBe(false);
  });

  it('handles trademark stripping (Andes Mint Avalanche with symbols)', () => {
    expect(isKnownFlavor('Andes Mint Avalanche\u00ae')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isKnownFlavor('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isKnownFlavor(null)).toBe(false);
  });

  it('recognizes an aliased flavor (cookie dough craze -> crazy for cookie dough)', () => {
    expect(isKnownFlavor('Cookie Dough Craze')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D-05b: Duplicate same-day detection
// ---------------------------------------------------------------------------

describe('D-05b: duplicate same-day detection', () => {
  it('returns empty array when no duplicates exist', () => {
    const entries = [
      { date: '2026-04-01', title: 'Butter Pecan' },
      { date: '2026-04-02', title: 'Turtle' },
    ];
    expect(detectDuplicateDays(entries)).toEqual([]);
  });

  it('detects a single duplicate date', () => {
    const entries = [
      { date: '2026-04-01', title: 'Butter Pecan' },
      { date: '2026-04-01', title: 'Turtle' },
    ];
    expect(detectDuplicateDays(entries)).toEqual(['2026-04-01']);
  });

  it('detects multiple duplicate dates', () => {
    const entries = [
      { date: '2026-04-01', title: 'Butter Pecan' },
      { date: '2026-04-01', title: 'Turtle' },
      { date: '2026-04-02', title: 'Caramel Cashew' },
      { date: '2026-04-03', title: 'Mint Cookie' },
      { date: '2026-04-03', title: 'Dark Chocolate Decadence' },
    ];
    const result = detectDuplicateDays(entries);
    expect(result).toContain('2026-04-01');
    expect(result).toContain('2026-04-03');
    expect(result).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(detectDuplicateDays([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D-05c: Stale data detection
// ---------------------------------------------------------------------------

describe('D-05c: stale data detection', () => {
  it('returns false when data is 3 days old (threshold 7)', () => {
    const now = new Date('2026-04-06T00:00:00Z');
    const lastDate = '2026-04-03';
    expect(isStaleStore(lastDate, now, 7)).toBe(false);
  });

  it('returns true when data is 8 days old (threshold 7)', () => {
    const now = new Date('2026-04-06T00:00:00Z');
    const lastDate = '2026-03-29';
    expect(isStaleStore(lastDate, now, 7)).toBe(true);
  });

  it('returns false when data is exactly 7 days old (boundary: <=7 is OK)', () => {
    const now = new Date('2026-04-07T00:00:00Z');
    const lastDate = '2026-03-31';
    expect(isStaleStore(lastDate, now, 7)).toBe(false);
  });

  it('returns true when lastFlavorDate is null (no data = stale)', () => {
    const now = new Date('2026-04-06T00:00:00Z');
    expect(isStaleStore(null, now, 7)).toBe(true);
  });

  it('respects custom threshold of 3 days', () => {
    const now = new Date('2026-04-06T00:00:00Z');
    expect(isStaleStore('2026-04-04', now, 3)).toBe(false); // 2 days ago
    expect(isStaleStore('2026-04-02', now, 3)).toBe(true);  // 4 days ago
  });
});
