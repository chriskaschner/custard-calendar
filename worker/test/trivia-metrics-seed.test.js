import { describe, expect, it } from 'vitest';
import { TRIVIA_METRICS_SEED } from '../src/trivia-metrics-seed.js';

describe('TRIVIA_METRICS_SEED contract', () => {
  it('has required top-level fields and expected version', () => {
    expect(TRIVIA_METRICS_SEED).toBeTruthy();
    expect(TRIVIA_METRICS_SEED.version).toBe(1);
    expect(TRIVIA_METRICS_SEED.generated_at).toBeTruthy();
    expect(TRIVIA_METRICS_SEED.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TRIVIA_METRICS_SEED.dataset_summary).toBeTruthy();
    expect(TRIVIA_METRICS_SEED.coverage).toBeTruthy();
    expect(Array.isArray(TRIVIA_METRICS_SEED.top_flavors)).toBe(true);
    expect(Array.isArray(TRIVIA_METRICS_SEED.top_stores)).toBe(true);
    expect(Array.isArray(TRIVIA_METRICS_SEED.seasonal_spotlights)).toBe(true);
  });

  it('is fresh enough for release cadence (<= 45 days old)', () => {
    const generatedMs = Date.parse(TRIVIA_METRICS_SEED.generated_at);
    expect(Number.isFinite(generatedMs)).toBe(true);
    const ageMs = Date.now() - generatedMs;
    const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
    expect(ageMs).toBeLessThanOrEqual(maxAgeMs);
  });
});
