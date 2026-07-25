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

  it('records the newest data date it was built from', () => {
    // Seeds predating the D1-backed generator lack this field, so their age
    // cannot be checked. Absence is a failure, not a pass.
    expect(TRIVIA_METRICS_SEED.data_max_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is built from data fresh enough for release cadence (<= 45 days old)', () => {
    // Asserts on data age, NOT generated_at. Re-running the generator over an
    // unchanged corpus used to reset generated_at and silence this gate while
    // the underlying data stayed months stale. data_max_date only advances when
    // the corpus does.
    const dataMs = Date.parse(TRIVIA_METRICS_SEED.data_max_date);
    expect(Number.isFinite(dataMs)).toBe(true);
    const ageMs = Date.now() - dataMs;
    const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
    expect(ageMs).toBeLessThanOrEqual(maxAgeMs);
  });
});
