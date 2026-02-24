import { describe, it, expect } from 'vitest';
import {
  TIERS,
  MIN_PROBABILITY,
  MIN_HISTORY_DEPTH,
  MAX_FORECAST_AGE_HOURS,
  determineCertaintyTier,
  certaintyCap,
  tierLabel,
} from '../src/certainty.js';

describe('TIERS constants', () => {
  it('has four tiers', () => {
    expect(Object.keys(TIERS)).toHaveLength(4);
    expect(TIERS.CONFIRMED).toBe('confirmed');
    expect(TIERS.WATCH).toBe('watch');
    expect(TIERS.ESTIMATED).toBe('estimated');
    expect(TIERS.NONE).toBe('none');
  });
});

describe('threshold constants', () => {
  it('exports sensible defaults', () => {
    expect(MIN_PROBABILITY).toBe(0.02);
    expect(MIN_HISTORY_DEPTH).toBe(14);
    expect(MAX_FORECAST_AGE_HOURS).toBe(168);
  });
});

describe('determineCertaintyTier', () => {
  it('returns CONFIRMED for confirmed data with good reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'confirmed' })
    ).toBe('confirmed');
  });

  it('returns CONFIRMED for confirmed data with no reliability info', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true })
    ).toBe('confirmed');
  });

  it('returns WATCH for confirmed data with watch reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'watch' })
    ).toBe('watch');
  });

  it('returns WATCH for confirmed data with unreliable reliability', () => {
    expect(
      determineCertaintyTier({ hasConfirmed: true, reliabilityTier: 'unreliable' })
    ).toBe('watch');
  });

  it('returns ESTIMATED for forecast with high probability and depth', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.3,
        historyDepth: 50,
      })
    ).toBe('estimated');
  });

  it('returns NONE for forecast with insufficient history depth', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.1,
        historyDepth: 13, // below MIN_HISTORY_DEPTH (14)
      })
    ).toBe('none');
  });

  it('returns NONE for forecast with probability below threshold', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.019, // below MIN_PROBABILITY (0.02)
        historyDepth: 30,
      })
    ).toBe('none');
  });

  it('returns ESTIMATED at exact threshold boundaries', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: MIN_PROBABILITY, // exactly 0.02
        historyDepth: MIN_HISTORY_DEPTH, // exactly 14
      })
    ).toBe('estimated');
  });

  it('returns NONE for stale forecast', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.3,
        historyDepth: 50,
        forecastAgeHours: 169, // > MAX_FORECAST_AGE_HOURS (168)
      })
    ).toBe('none');
  });

  it('returns ESTIMATED for non-stale forecast', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.3,
        historyDepth: 50,
        forecastAgeHours: 168, // exactly at threshold = not stale (> check)
      })
    ).toBe('estimated');
  });

  it('ignores forecastAgeHours when not a number', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: false,
        hasForecast: true,
        probability: 0.3,
        historyDepth: 50,
        forecastAgeHours: undefined,
      })
    ).toBe('estimated');
  });

  it('returns NONE when no data at all', () => {
    expect(determineCertaintyTier({})).toBe('none');
  });

  it('returns NONE with defaults', () => {
    expect(determineCertaintyTier()).toBe('none');
  });

  it('confirmed overrides forecast', () => {
    expect(
      determineCertaintyTier({
        hasConfirmed: true,
        hasForecast: true,
        probability: 0.9,
      })
    ).toBe('confirmed');
  });
});

describe('certaintyCap', () => {
  it('returns 1.0 for CONFIRMED', () => {
    expect(certaintyCap('confirmed')).toBe(1.0);
  });

  it('returns 0.7 for WATCH', () => {
    expect(certaintyCap('watch')).toBe(0.7);
  });

  it('returns probability*5 capped at 0.5 for ESTIMATED', () => {
    expect(certaintyCap('estimated', 0.05)).toBeCloseTo(0.25, 5);
    expect(certaintyCap('estimated', 0.2)).toBeCloseTo(0.5, 5);
    expect(certaintyCap('estimated', 0.5)).toBe(0.5); // capped
  });

  it('returns 0 for NONE', () => {
    expect(certaintyCap('none')).toBe(0);
  });

  it('returns 0 for unknown tier', () => {
    expect(certaintyCap('unknown')).toBe(0);
  });

  it('returns 0 for ESTIMATED with 0 probability', () => {
    expect(certaintyCap('estimated', 0)).toBe(0);
  });

  it('Confirmed > Watch > Estimated > None ordering', () => {
    const c = certaintyCap('confirmed');
    const w = certaintyCap('watch');
    const e = certaintyCap('estimated', 1.0); // max possible
    const n = certaintyCap('none');
    expect(c).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(e);
    expect(e).toBeGreaterThan(n);
  });
});

describe('tierLabel', () => {
  it('returns human labels', () => {
    expect(tierLabel('confirmed')).toBe('Confirmed');
    expect(tierLabel('watch')).toBe('Watch');
    expect(tierLabel('estimated')).toBe('Estimated');
  });

  it('returns empty string for none', () => {
    expect(tierLabel('none')).toBe('');
  });

  it('returns empty string for unknown', () => {
    expect(tierLabel('bogus')).toBe('');
  });
});
