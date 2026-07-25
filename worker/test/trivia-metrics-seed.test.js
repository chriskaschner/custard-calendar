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

  it('records both the collection time and the schedule horizon', () => {
    // Seeds predating the D1-backed generator lack these, so their age cannot
    // be checked. Absence is a failure, not a pass.
    expect(TRIVIA_METRICS_SEED.data_max_fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TRIVIA_METRICS_SEED.data_max_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('was built from data collected recently (<= 45 days)', () => {
    // Asserts on data_max_fetched_at (when rows were last collected), NOT on
    // generated_at (when the generator last ran) and NOT on data_max_date
    // (how far the published schedule runs, routinely a future date). Only
    // collection time actually tracks whether ingestion is alive.
    const fetchedMs = Date.parse(TRIVIA_METRICS_SEED.data_max_fetched_at);
    expect(Number.isFinite(fetchedMs)).toBe(true);
    const ageMs = Date.now() - fetchedMs;
    const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
    expect(ageMs).toBeLessThanOrEqual(maxAgeMs);
  });
});
