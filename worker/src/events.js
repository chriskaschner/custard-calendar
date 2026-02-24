const MAX_STRING_LEN = 120;
const MAX_ACTION_LEN = 64;
const MAX_PAGE_LEN = 48;
const MAX_BATCH = 20;
const DEFAULT_SUMMARY_DAYS = 7;
const MAX_SUMMARY_DAYS = 90;
const ALLOWED_EVENT_TYPES = new Set(['cta_click', 'signal_view', 'popup_open']);
const ALLOWED_CERTAINTY = new Set(['confirmed', 'watch', 'estimated', 'none']);

function jsonResponse(payload, corsHeaders, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function cleanText(value, maxLen = MAX_STRING_LEN) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[^\w\s.'-]/g, '');
  return stripped.slice(0, maxLen) || null;
}

function cleanSlug(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(trimmed)) return null;
  return trimmed;
}

function cleanAction(value) {
  const action = cleanText(value, MAX_ACTION_LEN);
  return action ? action.toLowerCase().replace(/\s+/g, '_') : null;
}

function cleanPage(value) {
  const page = cleanText(value, MAX_PAGE_LEN);
  return page ? page.toLowerCase().replace(/\s+/g, '_') : null;
}

function cleanPageLoadId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(trimmed)) return null;
  return trimmed;
}

function cleanCertainty(value) {
  const certainty = cleanText(value, 16);
  if (!certainty) return null;
  const lower = certainty.toLowerCase();
  return ALLOWED_CERTAINTY.has(lower) ? lower : null;
}

function cleanEventType(value) {
  const eventType = cleanText(value, 32);
  if (!eventType) return null;
  const lower = eventType.toLowerCase();
  return ALLOWED_EVENT_TYPES.has(lower) ? lower : null;
}

function normalizePayload(raw, defaults) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const eventType = cleanEventType(raw.event_type);
  if (!eventType) return null;

  return {
    event_type: eventType,
    page: cleanPage(raw.page) || defaults.page,
    action: cleanAction(raw.action),
    store_slug: cleanSlug(raw.store_slug),
    flavor: cleanText(raw.flavor, 96),
    certainty_tier: cleanCertainty(raw.certainty_tier),
    page_load_id: cleanPageLoadId(raw.page_load_id) || defaults.page_load_id,
  };
}

function extractBatch(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.events)) return body.events;
  return [body];
}

function parseDays(url) {
  const raw = Number(url.searchParams.get('days'));
  if (!Number.isFinite(raw)) return DEFAULT_SUMMARY_DAYS;
  const rounded = Math.round(raw);
  return Math.min(Math.max(rounded, 1), MAX_SUMMARY_DAYS);
}

async function handleEventIngest(request, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ error: 'Interaction telemetry unavailable: D1 not configured.' }, corsHeaders, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, corsHeaders, 400);
  }

  const rawEvents = extractBatch(body);
  if (!rawEvents.length) {
    return jsonResponse({ error: 'No events provided.' }, corsHeaders, 400);
  }
  if (rawEvents.length > MAX_BATCH) {
    return jsonResponse({ error: `Too many events in one payload. Max ${MAX_BATCH}.` }, corsHeaders, 400);
  }

  const defaultPage = cleanPage(body?.page) || 'unknown';
  const defaultPageLoadId = cleanPageLoadId(body?.page_load_id) || null;
  const defaults = {
    page: defaultPage,
    page_load_id: defaultPageLoadId,
  };

  const events = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const event = normalizePayload(rawEvents[i], defaults);
    if (!event) {
      return jsonResponse({ error: `Invalid event at index ${i}.` }, corsHeaders, 400);
    }
    events.push(event);
  }

  const cf = request.cf || {};
  const city = cleanText(cf.city, 80);
  const region = cleanText(cf.regionCode || cf.region, 80);
  const country = cleanText(cf.country, 8);
  const createdAt = new Date().toISOString();

  try {
    for (const event of events) {
      await env.DB.prepare(`
        INSERT INTO interaction_events (
          event_type,
          page,
          action,
          store_slug,
          flavor,
          certainty_tier,
          page_load_id,
          cf_city,
          cf_region,
          cf_country,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.event_type,
        event.page,
        event.action,
        event.store_slug,
        event.flavor,
        event.certainty_tier,
        event.page_load_id,
        city,
        region,
        country,
        createdAt,
      ).run();
    }
  } catch (err) {
    return jsonResponse({ error: `Failed to persist interaction events: ${err.message}` }, corsHeaders, 500);
  }

  return jsonResponse({ ok: true, ingested: events.length }, corsHeaders, 202);
}

async function handleEventSummary(url, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ error: 'Interaction summary unavailable: D1 not configured.' }, corsHeaders, 503);
  }

  const days = parseDays(url);
  const filterEventType = cleanEventType(url.searchParams.get('event_type'));
  const filterPage = cleanPage(url.searchParams.get('page'));
  const filterAction = cleanAction(url.searchParams.get('action'));

  const whereClauses = [`datetime(created_at) >= datetime('now', ?)`];
  const bindValues = [`-${days} day`];

  if (filterEventType) {
    whereClauses.push('event_type = ?');
    bindValues.push(filterEventType);
  }
  if (filterPage) {
    whereClauses.push('page = ?');
    bindValues.push(filterPage);
  }
  if (filterAction) {
    whereClauses.push('action = ?');
    bindValues.push(filterAction);
  }

  const whereSql = whereClauses.join(' AND ');

  try {
    const totals = await env.DB.prepare(
      `SELECT
         COUNT(*) AS events,
         SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS cta_clicks,
         SUM(CASE WHEN event_type = 'signal_view' THEN 1 ELSE 0 END) AS signal_views,
         SUM(CASE WHEN event_type = 'popup_open' THEN 1 ELSE 0 END) AS popup_opens
       FROM interaction_events
       WHERE ${whereSql}`
    ).bind(...bindValues).first();

    const byType = await env.DB.prepare(
      `SELECT event_type, COUNT(*) AS count
       FROM interaction_events
       WHERE ${whereSql}
       GROUP BY event_type
       ORDER BY count DESC`
    ).bind(...bindValues).all();

    const byPage = await env.DB.prepare(
      `SELECT page, COUNT(*) AS count
       FROM interaction_events
       WHERE ${whereSql}
       GROUP BY page
       ORDER BY count DESC
       LIMIT 20`
    ).bind(...bindValues).all();

    const byAction = await env.DB.prepare(
      `SELECT COALESCE(action, 'unknown') AS action, COUNT(*) AS count
       FROM interaction_events
       WHERE ${whereSql}
       GROUP BY action
       ORDER BY count DESC
       LIMIT 20`
    ).bind(...bindValues).all();

    const topStores = await env.DB.prepare(
      `SELECT store_slug, COUNT(*) AS count
       FROM interaction_events
       WHERE ${whereSql} AND store_slug IS NOT NULL
       GROUP BY store_slug
       ORDER BY count DESC
       LIMIT 20`
    ).bind(...bindValues).all();

    const topFlavors = await env.DB.prepare(
      `SELECT flavor, COUNT(*) AS count
       FROM interaction_events
       WHERE ${whereSql} AND flavor IS NOT NULL
       GROUP BY flavor
       ORDER BY count DESC
       LIMIT 20`
    ).bind(...bindValues).all();

    return jsonResponse({
      window_days: days,
      filters: {
        event_type: filterEventType,
        page: filterPage,
        action: filterAction,
      },
      totals: {
        events: Number(totals?.events || 0),
        cta_clicks: Number(totals?.cta_clicks || 0),
        signal_views: Number(totals?.signal_views || 0),
        popup_opens: Number(totals?.popup_opens || 0),
      },
      by_event_type: byType?.results || [],
      by_page: byPage?.results || [],
      by_action: byAction?.results || [],
      top_stores: topStores?.results || [],
      top_flavors: topFlavors?.results || [],
    }, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: `Failed to compute interaction summary: ${err.message}` }, corsHeaders, 500);
  }
}

export async function handleEventsRoute(canonical, url, request, env, corsHeaders) {
  if (canonical === '/api/events') {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed. Use POST.' }, corsHeaders, 405);
    }
    return handleEventIngest(request, env, corsHeaders);
  }

  if (canonical === '/api/events/summary') {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed. Use GET.' }, corsHeaders, 405);
    }
    return handleEventSummary(url, env, corsHeaders);
  }

  return null;
}
