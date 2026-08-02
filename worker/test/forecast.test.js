import { describe, it, expect, vi } from 'vitest';
import {
  handleForecast,
  getForecastData,
  annotateForecastAge,
  FORECAST_STALE_HOURS,
  FORECAST_HARD_LIMIT_HOURS,
} from '../src/forecast.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};

function createMockKV(data = {}) {
  return {
    get: vi.fn(async (key) => data[key] || null),
    put: vi.fn(async () => {}),
  };
}

function createMockD1(rowsBySlug = {}) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn((slug) => ({
        first: vi.fn(async () => rowsBySlug[slug] || null),
      })),
    })),
  };
}

describe('getForecastData', () => {
  it('prefers D1 over KV when both are present', async () => {
    const env = {
      DB: createMockD1({
        'mt-horeb': { data: JSON.stringify({ store_slug: 'mt-horeb', source: 'd1' }) },
      }),
      FLAVOR_CACHE: createMockKV({
        'forecast:mt-horeb': JSON.stringify({ store_slug: 'mt-horeb', source: 'kv' }),
      }),
    };

    const result = await getForecastData('mt-horeb', env);
    expect(result.forecast.source).toBe('d1');
    expect(result.source).toBe('d1');
  });

  it('falls back to KV when D1 has no row', async () => {
    const env = {
      DB: createMockD1({}),
      FLAVOR_CACHE: createMockKV({
        'forecast:mt-horeb': JSON.stringify({ store_slug: 'mt-horeb', source: 'kv' }),
      }),
    };

    const result = await getForecastData('mt-horeb', env);
    expect(result.forecast.source).toBe('kv');
    expect(result.source).toBe('kv');
  });
});

describe('handleForecast', () => {
  it('returns 503 when neither D1 nor KV are configured', async () => {
    const resp = await handleForecast('mt-horeb', {}, corsHeaders);
    expect(resp.status).toBe(503);
    const body = await resp.json();
    expect(body.error).toContain('neither D1 nor KV');
  });

  it('returns 404 when no forecast exists for slug', async () => {
    const env = { DB: createMockD1({}), FLAVOR_CACHE: createMockKV() };
    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error).toContain('No forecast available');
  });

  it('returns forecast JSON from D1 when available', async () => {
    const forecast = {
      store_slug: 'mt-horeb',
      date: '2026-02-23',
      predictions: [
        { flavor: 'Turtle', probability: 0.08 },
        { flavor: 'Caramel Cashew', probability: 0.07 },
      ],
      total_probability: 1.0,
      prose: "Sunday's Flavor Forecast for Mt Horeb...",
    };
    const env = {
      DB: createMockD1({ 'mt-horeb': { data: JSON.stringify(forecast) } }),
      FLAVOR_CACHE: createMockKV(),
    };

    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.store_slug).toBe('mt-horeb');
    expect(body.predictions).toHaveLength(2);
    expect(body.predictions[0].flavor).toBe('Turtle');
  });

  it('falls back to KV when D1 is missing slug', async () => {
    const forecast = { store_slug: 'mt-horeb', predictions: [] };
    const env = {
      DB: createMockD1({}),
      FLAVOR_CACHE: createMockKV({ 'forecast:mt-horeb': JSON.stringify(forecast) }),
    };
    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.store_slug).toBe('mt-horeb');
  });

  it('returns 500 when D1 row is corrupted and KV fallback is absent', async () => {
    const env = {
      DB: createMockD1({ 'mt-horeb': { data: '{invalid json' } }),
      FLAVOR_CACHE: createMockKV(),
    };
    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(500);
  });

  it('returns 500 when KV row is corrupted and D1 fallback is absent', async () => {
    const env = {
      DB: createMockD1({}),
      FLAVOR_CACHE: createMockKV({ 'forecast:mt-horeb': '{invalid json' }),
    };
    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(500);
  });

  it('sets cache headers on success', async () => {
    const forecast = { store_slug: 'mt-horeb', predictions: [] };
    const env = {
      DB: createMockD1({ 'mt-horeb': { data: JSON.stringify(forecast) } }),
      FLAVOR_CACHE: createMockKV(),
    };
    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('passes through multi-day forecast shape', async () => {
    const forecast = {
      store_slug: 'mt-horeb',
      // Relative, not a fixed date: this test is about shape passthrough, and a
      // hardcoded timestamp silently becomes "expired" once enough wall-clock
      // time passes, which is what the staleness guard then strips.
      generated_at: new Date().toISOString(),
      history_depth: 485,
      days: [
        {
          date: '2026-02-23',
          predictions: [
            { flavor: 'Turtle', probability: 0.0834, certainty_tier: 'estimated' },
            { flavor: 'Caramel Cashew', probability: 0.0712, certainty_tier: 'estimated' },
          ],
          overdue_flavors: [{ flavor: 'Mint Explosion', days_since: 45, avg_gap: 38.5 }],
          prose: "Sunday's Flavor Forecast...",
        },
        {
          date: '2026-02-24',
          predictions: [{ flavor: 'Butter Pecan', probability: 0.0901, certainty_tier: 'estimated' }],
          overdue_flavors: [],
          prose: "Monday's Flavor Forecast...",
        },
      ],
    };
    const env = {
      DB: createMockD1({ 'mt-horeb': { data: JSON.stringify(forecast) } }),
      FLAVOR_CACHE: createMockKV(),
    };

    const resp = await handleForecast('mt-horeb', env, corsHeaders);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.days).toHaveLength(2);
    expect(body.days[0].predictions[0].certainty_tier).toBe('estimated');
  });
});

describe('forecast staleness', () => {
  const HOUR = 36e5;
  const NOW = Date.parse('2026-08-02T12:00:00Z');

  function forecastAgedHours(hours, days = 2) {
    return {
      store_slug: 'mt-horeb',
      generated_at: new Date(NOW - hours * HOUR).toISOString(),
      history_depth: 400,
      days: Array.from({ length: days }, (_, i) => ({
        date: `2026-08-0${i + 3}`,
        predictions: [{ flavor: 'Butter Pecan', probability: 0.09 }],
        overdue_flavors: [],
      })),
    };
  }

  it('reports age and leaves a fresh forecast intact', () => {
    const out = annotateForecastAge(forecastAgedHours(6), NOW);
    expect(out.age_hours).toBe(6);
    expect(out.stale).toBe(false);
    expect(out.days[0].predictions).toHaveLength(1);
    expect(out.stale_reason).toBeUndefined();
  });

  it('flags stale past the threshold but still serves predictions', () => {
    // Between the soft and hard limits the forecast is degraded, not useless.
    const out = annotateForecastAge(forecastAgedHours(FORECAST_STALE_HOURS + 24), NOW);
    expect(out.stale).toBe(true);
    expect(out.days[0].predictions).toHaveLength(1);
  });

  it('withholds predictions once past the hard limit', () => {
    // This is the real guard: a months-old forecast rendered as "Estimated" is
    // worse than showing nothing, because it looks authoritative.
    const out = annotateForecastAge(forecastAgedHours(FORECAST_HARD_LIMIT_HOURS + 1), NOW);
    expect(out.stale).toBe(true);
    expect(out.stale_reason).toBe('expired');
    expect(out.days.every(d => d.predictions.length === 0)).toBe(true);
    expect(out.days).toHaveLength(2); // shape preserved, not a bare 404
  });

  it('covers the real production case -- Feb 23 data served in August', () => {
    const out = annotateForecastAge(
      { store_slug: 'mt-horeb', generated_at: '2026-02-23T11:21:46.864972', days: [
        { date: '2026-02-24', predictions: [{ flavor: 'Lemon Berry Layer Cake', probability: 0.081 }] },
      ] },
      NOW,
    );
    expect(out.age_hours).toBeGreaterThan(3800);
    expect(out.stale_reason).toBe('expired');
    expect(out.days[0].predictions).toEqual([]);
  });

  it('treats a missing or unparseable generated_at as stale, not fresh', () => {
    expect(annotateForecastAge({ days: [] }, NOW).stale).toBe(true);
    expect(annotateForecastAge({ days: [] }, NOW).stale_reason).toBe('unknown_generated_at');
    expect(annotateForecastAge({ generated_at: 'nonsense', days: [] }, NOW).stale).toBe(true);
  });

  it('does not mutate the input', () => {
    const input = forecastAgedHours(FORECAST_HARD_LIMIT_HOURS + 1);
    const before = JSON.stringify(input);
    annotateForecastAge(input, NOW);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('clamps a future generated_at to zero rather than reporting negative age', () => {
    expect(annotateForecastAge(forecastAgedHours(-50), NOW).age_hours).toBe(0);
  });

  it('annotates the served response end to end', async () => {
    const forecast = forecastAgedHours(FORECAST_HARD_LIMIT_HOURS + 100);
    const env = {
      DB: createMockD1({ 'mt-horeb': { data: JSON.stringify(forecast) } }),
      FLAVOR_CACHE: createMockKV(),
    };
    const body = await (await handleForecast('mt-horeb', env, corsHeaders)).json();
    expect(body.stale).toBe(true);
    expect(body.stale_reason).toBe('expired');
    expect(body.days[0].predictions).toEqual([]);
  });

  it('tolerates a non-object payload', () => {
    expect(annotateForecastAge(null, NOW)).toBeNull();
  });
});
