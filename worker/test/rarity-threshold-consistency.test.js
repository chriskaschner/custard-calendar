/**
 * Rarity threshold consistency test
 *
 * Pins boundary values for rarityLabel() in social-card.js and ensures
 * they match the thresholds used in:
 *   - worker/src/route-today.js  (>150 Ultra Rare, >90 Rare — inline logic ~line 148-149)
 *   - docs/planner-domain.js     (>150 Ultra Rare, >90 Rare — rarityLabelFromGapDays ~line 94-95)
 *
 * Do NOT import from planner-domain.js (IIFE, not an ES module) or
 * route-today.js (inline logic, not an exported function). The source-of-truth
 * for all three files is: Ultra Rare > 150 days, Rare > 90 days.
 */

import { rarityLabel } from '../src/social-card.js';
import { describe, it, expect } from 'vitest';

describe('rarityLabel() — threshold consistency (must match route-today.js and planner-domain.js)', () => {
  // ----- Ultra Rare boundary (threshold: > 150) -----
  it('returns "Ultra Rare" for 151 days (just above Ultra Rare threshold)', () => {
    expect(rarityLabel(151)).toBe('Ultra Rare');
  });

  it('returns "Rare" for 150 days (150 is NOT > 150)', () => {
    expect(rarityLabel(150)).toBe('Rare');
  });

  it('returns "Rare" for 149 days', () => {
    expect(rarityLabel(149)).toBe('Rare');
  });

  it('returns "Ultra Rare" for 200 days (well above threshold)', () => {
    expect(rarityLabel(200)).toBe('Ultra Rare');
  });

  // ----- Rare boundary (threshold: > 90) -----
  it('returns "Rare" for 91 days (just above Rare threshold)', () => {
    expect(rarityLabel(91)).toBe('Rare');
  });

  it('returns null for 90 days (90 is NOT > 90)', () => {
    expect(rarityLabel(90)).toBe(null);
  });

  it('returns null for 89 days', () => {
    expect(rarityLabel(89)).toBe(null);
  });

  // ----- Key case: 130 days was incorrectly "Ultra Rare" with old thresholds -----
  it('returns "Rare" for 130 days (was incorrectly "Ultra Rare" with old >120 threshold)', () => {
    expect(rarityLabel(130)).toBe('Rare');
  });

  // ----- Guard conditions -----
  it('returns null for 0 days', () => {
    expect(rarityLabel(0)).toBe(null);
  });

  it('returns null for 1 day (< 2 guard)', () => {
    expect(rarityLabel(1)).toBe(null);
  });

  it('returns null for null input', () => {
    expect(rarityLabel(null)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(rarityLabel(undefined)).toBe(null);
  });

  it('returns null for non-numeric string input', () => {
    expect(rarityLabel('banana')).toBe(null);
  });
});
