import { describe, expect, it, vi } from 'vitest';
import { handleEventsRoute } from '../src/events.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

function makeRequest(path, method = 'GET', body = null) {
  const init = { method };
  if (body != null) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request(`https://example.com${path}`, init);
}

function createMockD1(resolver = () => null) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn((...args) => ({
        run: vi.fn(async () => resolver({ sql, args, method: 'run' }) || { success: true }),
        first: vi.fn(async () => resolver({ sql, args, method: 'first' })),
        all: vi.fn(async () => resolver({ sql, args, method: 'all' }) || { results: [] }),
      })),
      first: vi.fn(async () => resolver({ sql, args: [], method: 'first' })),
      all: vi.fn(async () => resolver({ sql, args: [], method: 'all' }) || { results: [] }),
    })),
  };
}

describe('handleEventsRoute /api/events', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = makeRequest('/api/v1/events');
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events', url, req, { DB: createMockD1() }, CORS);
    expect(res.status).toBe(405);
  });

  it('returns 503 when DB is not configured', async () => {
    const req = makeRequest('/api/v1/events', 'POST', { event_type: 'cta_click', page: 'index' });
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events', url, req, {}, CORS);
    expect(res.status).toBe(503);
  });

  it('returns 400 for invalid event payload', async () => {
    const req = makeRequest('/api/v1/events', 'POST', { event_type: 'bad', page: 'index' });
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events', url, req, { DB: createMockD1() }, CORS);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid event/i);
  });

  it('stores sanitized event payload and returns 202', async () => {
    const inserts = [];
    const db = createMockD1((ctx) => {
      if (ctx.method === 'run') inserts.push(ctx);
      return null;
    });

    const req = makeRequest('/api/v1/events', 'POST', {
      event_type: 'cta_click',
      page: 'Index',
      action: 'Directions!',
      store_slug: 'mt-horeb',
      flavor: 'Andes Mint Avalanche',
      certainty_tier: 'confirmed',
      page_load_id: 'pl_abc123',
    });
    req.cf = { city: 'Madison', regionCode: 'WI', country: 'US' };
    const url = new URL(req.url);

    const res = await handleEventsRoute('/api/events', url, req, { DB: db }, CORS);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ingested).toBe(1);
    expect(inserts).toHaveLength(1);

    const args = inserts[0].args;
    expect(args[0]).toBe('cta_click');
    expect(args[1]).toBe('index');
    expect(args[2]).toBe('directions');
    expect(args[3]).toBe('mt-horeb');
    expect(args[4]).toBe('Andes Mint Avalanche');
    expect(args[5]).toBe('confirmed');
    expect(args[6]).toBe('pl_abc123');
    expect(args[7]).toBe('Madison');
    expect(args[8]).toBe('WI');
    expect(args[9]).toBe('US');
  });

  it('accepts batched events and applies root defaults', async () => {
    const inserts = [];
    const db = createMockD1((ctx) => {
      if (ctx.method === 'run') inserts.push(ctx);
      return null;
    });

    const req = makeRequest('/api/v1/events', 'POST', {
      page: 'radar',
      page_load_id: 'batch_987654',
      events: [
        { event_type: 'signal_view', action: 'overdue', store_slug: 'mt-horeb' },
        { event_type: 'popup_open', action: 'store_popup', flavor: 'Turtle' },
      ],
    });
    const url = new URL(req.url);

    const res = await handleEventsRoute('/api/events', url, req, { DB: db }, CORS);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ingested).toBe(2);

    expect(inserts).toHaveLength(2);
    expect(inserts[0].args[1]).toBe('radar');
    expect(inserts[1].args[1]).toBe('radar');
    expect(inserts[0].args[6]).toBe('batch_987654');
    expect(inserts[1].args[6]).toBe('batch_987654');
  });
});

describe('handleEventsRoute /api/events/summary', () => {
  it('returns 405 for non-GET requests', async () => {
    const req = makeRequest('/api/v1/events/summary', 'POST', {});
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events/summary', url, req, { DB: createMockD1() }, CORS);
    expect(res.status).toBe(405);
  });

  it('returns summary payload with filters and aggregates', async () => {
    const db = createMockD1(({ sql, method }) => {
      if (method === 'first' && sql.includes('SUM(CASE WHEN event_type = \'cta_click\'')) {
        return { events: 12, cta_clicks: 7, signal_views: 3, popup_opens: 2 };
      }
      if (method === 'all' && sql.includes('GROUP BY event_type')) {
        return { results: [{ event_type: 'cta_click', count: 7 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY page')) {
        return { results: [{ page: 'index', count: 9 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY action')) {
        return { results: [{ action: 'directions', count: 4 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY store_slug')) {
        return { results: [{ store_slug: 'mt-horeb', count: 5 }] };
      }
      if (method === 'all' && sql.includes('GROUP BY flavor')) {
        return { results: [{ flavor: 'Turtle', count: 2 }] };
      }
      return null;
    });

    const req = makeRequest('/api/v1/events/summary?days=14&page=index&event_type=cta_click&action=directions');
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events/summary', url, req, { DB: db }, CORS);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.window_days).toBe(14);
    expect(body.filters.page).toBe('index');
    expect(body.filters.event_type).toBe('cta_click');
    expect(body.filters.action).toBe('directions');
    expect(body.totals.events).toBe(12);
    expect(body.totals.cta_clicks).toBe(7);
    expect(body.by_event_type[0].event_type).toBe('cta_click');
    expect(body.by_page[0].page).toBe('index');
    expect(body.by_action[0].action).toBe('directions');
    expect(body.top_stores[0].store_slug).toBe('mt-horeb');
    expect(body.top_flavors[0].flavor).toBe('Turtle');
  });
});

describe('handleEventsRoute fallback', () => {
  it('returns null for unknown events route', async () => {
    const req = makeRequest('/api/v1/events/unknown');
    const url = new URL(req.url);
    const res = await handleEventsRoute('/api/events/unknown', url, req, { DB: createMockD1() }, CORS);
    expect(res).toBeNull();
  });
});
