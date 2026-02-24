const MAX_STRING_LEN = 120;
const MAX_QUIZ_ID_LEN = 64;
const MAX_TRAITS = 24;
const DEFAULT_INDEX_DAYS = 7;
const MAX_INDEX_DAYS = 90;

function cleanText(value, maxLen = MAX_STRING_LEN) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[^\w\s.'-]/g, '');
  return stripped.slice(0, maxLen) || null;
}

function cleanQuizId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(trimmed)) return null;
  return trimmed.slice(0, MAX_QUIZ_ID_LEN);
}

function cleanSlug(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(trimmed)) return null;
  return trimmed;
}

function cleanMiles(value, { min = 0, max = 500 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(Math.max(n, min), max);
  return Math.round(clamped * 10) / 10;
}

function cleanRadius(value) {
  const n = cleanMiles(value, { min: 1, max: 200 });
  return n == null ? null : Math.round(n);
}

function cleanTraits(rawTraits) {
  if (!rawTraits || typeof rawTraits !== 'object' || Array.isArray(rawTraits)) return {};
  const entries = Object.entries(rawTraits).slice(0, MAX_TRAITS);
  const cleaned = {};
  for (const [trait, rawValue] of entries) {
    const key = cleanText(String(trait).toLowerCase(), 32);
    if (!key) continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    cleaned[key] = Math.max(-10, Math.min(10, Math.round(value * 100) / 100));
  }
  return cleaned;
}

function jsonResponse(payload, corsHeaders, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

async function handleQuizEventIngest(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, corsHeaders, 405);
  }
  if (!env.DB) {
    return jsonResponse({ error: 'Quiz telemetry unavailable: D1 not configured.' }, corsHeaders, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, corsHeaders, 400);
  }

  const eventType = cleanText(body?.event_type, 32) || 'quiz_result';
  if (!['quiz_result', 'availability_match'].includes(eventType)) {
    return jsonResponse({ error: 'Invalid event_type. Use "quiz_result" or "availability_match".' }, corsHeaders, 400);
  }

  const quizId = cleanQuizId(body?.quiz_id);
  if (!quizId) {
    return jsonResponse({ error: 'Invalid or missing quiz_id.' }, corsHeaders, 400);
  }

  const archetype = cleanText(body?.archetype, 48);
  const resultFlavor = cleanText(body?.result_flavor, 96);
  const matchedFlavor = cleanText(body?.matched_flavor, 96);
  const matchedStoreSlug = cleanSlug(body?.matched_store_slug);
  const matchedDistanceMiles = cleanMiles(body?.matched_distance_miles, { min: 0, max: 500 });
  const radiusMiles = cleanRadius(body?.radius_miles);
  const hasRadiusMatch = Boolean(body?.has_radius_match);
  const traitScores = cleanTraits(body?.trait_scores);

  const cf = request.cf || {};
  const city = cleanText(cf.city, 80);
  const region = cleanText(cf.regionCode || cf.region, 80);
  const country = cleanText(cf.country, 8);
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO quiz_events (
        event_type,
        quiz_id,
        archetype,
        result_flavor,
        matched_flavor,
        matched_store_slug,
        matched_distance_miles,
        radius_miles,
        has_radius_match,
        trait_scores_json,
        cf_city,
        cf_region,
        cf_country,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventType,
      quizId,
      archetype,
      resultFlavor,
      matchedFlavor,
      matchedStoreSlug,
      matchedDistanceMiles,
      radiusMiles,
      hasRadiusMatch ? 1 : 0,
      JSON.stringify(traitScores),
      city,
      region,
      country,
      createdAt,
    ).run();
  } catch (err) {
    return jsonResponse({ error: `Failed to persist quiz event: ${err.message}` }, corsHeaders, 500);
  }

  return jsonResponse({ ok: true }, corsHeaders, 202);
}

function parseDaysParam(url) {
  const raw = Number(url.searchParams.get('days'));
  if (!Number.isFinite(raw)) return DEFAULT_INDEX_DAYS;
  const rounded = Math.round(raw);
  return Math.min(Math.max(rounded, 1), MAX_INDEX_DAYS);
}

async function handlePersonalityIndex(url, env, corsHeaders) {
  if (!env.DB) {
    return jsonResponse({ error: 'Personality index unavailable: D1 not configured.' }, corsHeaders, 503);
  }

  const days = parseDaysParam(url);
  const sinceExpr = `-${days} day`;
  const quizId = cleanQuizId(url.searchParams.get('quiz_id') || '');

  const filterSql = quizId ? ' AND quiz_id = ?' : '';
  const bindArgs = quizId ? [sinceExpr, quizId] : [sinceExpr];

  try {
    const totals = await env.DB.prepare(
      `SELECT
         COUNT(*) AS events,
         SUM(CASE WHEN has_radius_match = 1 THEN 1 ELSE 0 END) AS matched_events
       FROM quiz_events
       WHERE datetime(created_at) >= datetime('now', ?)` + filterSql
    ).bind(...bindArgs).first();

    const archetypes = await env.DB.prepare(
      `SELECT archetype, COUNT(*) AS count
       FROM quiz_events
       WHERE datetime(created_at) >= datetime('now', ?)
         AND event_type = 'quiz_result'
         AND archetype IS NOT NULL` + filterSql + `
       GROUP BY archetype
       ORDER BY count DESC
       LIMIT 10`
    ).bind(...bindArgs).all();

    const flavors = await env.DB.prepare(
      `SELECT result_flavor AS flavor, COUNT(*) AS count
       FROM quiz_events
       WHERE datetime(created_at) >= datetime('now', ?)
         AND event_type = 'quiz_result'
         AND result_flavor IS NOT NULL` + filterSql + `
       GROUP BY result_flavor
       ORDER BY count DESC
       LIMIT 15`
    ).bind(...bindArgs).all();

    const matchedFlavors = await env.DB.prepare(
      `SELECT matched_flavor AS flavor, COUNT(*) AS count
       FROM quiz_events
       WHERE datetime(created_at) >= datetime('now', ?)
         AND matched_flavor IS NOT NULL` + filterSql + `
       GROUP BY matched_flavor
       ORDER BY count DESC
       LIMIT 15`
    ).bind(...bindArgs).all();

    const regions = await env.DB.prepare(
      `SELECT
         COALESCE(cf_region, 'unknown') AS region,
         COALESCE(cf_country, 'unknown') AS country,
         COUNT(*) AS events
       FROM quiz_events
       WHERE datetime(created_at) >= datetime('now', ?)` + filterSql + `
       GROUP BY region, country
       ORDER BY events DESC
       LIMIT 20`
    ).bind(...bindArgs).all();

    return jsonResponse({
      window_days: days,
      quiz_id: quizId || null,
      totals: {
        events: Number(totals?.events || 0),
        matched_events: Number(totals?.matched_events || 0),
      },
      top_archetypes: archetypes?.results || [],
      top_results: flavors?.results || [],
      top_matched_flavors: matchedFlavors?.results || [],
      top_regions: regions?.results || [],
    }, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: `Failed to compute personality index: ${err.message}` }, corsHeaders, 500);
  }
}

export async function handleQuizRoute(canonical, url, request, env, corsHeaders) {
  if (canonical === '/api/quiz/events') {
    return handleQuizEventIngest(request, env, corsHeaders);
  }
  if (canonical === '/api/quiz/personality-index') {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed. Use GET.' }, corsHeaders, 405);
    }
    return handlePersonalityIndex(url, env, corsHeaders);
  }
  return null;
}
