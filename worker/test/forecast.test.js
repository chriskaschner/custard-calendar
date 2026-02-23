import { describe, it, expect, vi } from 'vitest';
import { handleForecast, getForecastData } from '../src/forecast.js';

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
      generated_at: '2026-02-22T14:00:00',
      history_depth: 485,
      days: [
        {
          date: '2026-02-23',
          predictions: [
            { flavor: 'Turtle', probability: 0.0834, confidence: 'medium' },
            { flavor: 'Caramel Cashew', probability: 0.0712, confidence: 'medium' },
          ],
          overdue_flavors: [{ flavor: 'Mint Explosion', days_since: 45, avg_gap: 38.5 }],
          prose: "Sunday's Flavor Forecast...",
        },
        {
          date: '2026-02-24',
          predictions: [{ flavor: 'Butter Pecan', probability: 0.0901, confidence: 'medium' }],
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
    expect(body.days[0].predictions[0].confidence).toBe('medium');
  });
});
