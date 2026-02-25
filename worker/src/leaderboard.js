/**
 * State and regional flavor leaderboards.
 *
 * Returns per-state top flavor rankings from D1 snapshot history.
 * Falls back to metrics seed national rankings when D1 is unavailable
 * or the requested states have no data in the window.
 *
 * Endpoint: GET /api/v1/leaderboard/state
 *   ?days=90        — lookback window (7–730, default 90)
 *   &states=WI,IL   — comma-separated state codes to include (optional; omit for all)
 *   &limit=5        — top N flavors per state (1–10, default 5)
 */

import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';

const DEFAULT_DAYS = 90;
const MAX_DAYS = 730;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function parseBoundedInt(url, key, defaultValue, min, max) {
  const raw = Number(url.searchParams.get(key));
  if (!Number.isFinite(raw)) return defaultValue;
  return Math.min(Math.max(Math.round(raw), min), max);
}

function parseStateFilter(url) {
  const raw = String(url.searchParams.get('states') || '').trim();
  if (!raw) return [];
  return raw.split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s))
    .slice(0, 10);
}

async function handleStateLeaderboard(url, env, corsHeaders) {
  const days = parseBoundedInt(url, 'days', DEFAULT_DAYS, 7, MAX_DAYS);
  const limit = parseBoundedInt(url, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT);
  const stateFilter = parseStateFilter(url);
  const sinceExpr = `-${days} day`;
  const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
  const storeMetaBySlug = new Map(storeIndex.map((row) => [row.slug, row]));

  let groupedRows = [];
  let source = 'fallback';

  if (env.DB) {
    try {
      const result = await env.DB.prepare(
        `SELECT slug, normalized_flavor, MAX(flavor) AS flavor, COUNT(*) AS count
         FROM snapshots
         WHERE date >= date('now', ?)
         GROUP BY slug, normalized_flavor`
      ).bind(sinceExpr).all();
      groupedRows = result?.results || [];
      source = 'd1_snapshots';
    } catch (err) {
      console.error(`Leaderboard D1 query failed: ${err.message}`);
    }
  }

  // Aggregate counts by state -> flavor
  const stateFlavorMap = new Map();

  for (const row of groupedRows) {
    const slug = String(row.slug || '').trim();
    const normalizedFlavor = String(row.normalized_flavor || '').trim();
    const flavorLabel = String(row.flavor || row.normalized_flavor || '').trim();
    const count = Number(row.count || 0);
    if (!slug || !normalizedFlavor || count <= 0) continue;

    const state = storeMetaBySlug.get(slug)?.state;
    if (!state) continue;
    if (stateFilter.length > 0 && !stateFilter.includes(state)) continue;

    if (!stateFlavorMap.has(state)) stateFlavorMap.set(state, new Map());
    const flavorMap = stateFlavorMap.get(state);
    if (!flavorMap.has(normalizedFlavor)) {
      flavorMap.set(normalizedFlavor, { flavor: flavorLabel, count: 0 });
    }
    flavorMap.get(normalizedFlavor).count += count;
  }

  // Rank results per state
  const stateLeaders = {};
  for (const [state, flavorMap] of stateFlavorMap) {
    stateLeaders[state] = [...flavorMap.values()]
      .sort((a, b) => b.count - a.count || a.flavor.localeCompare(b.flavor))
      .slice(0, limit)
      .map((entry, idx) => ({ rank: idx + 1, flavor: entry.flavor, count: entry.count }));
  }

  // Fall back to national metrics seed when no D1 data returned
  if (Object.keys(stateLeaders).length === 0) {
    const topFlavors = Array.isArray(TRIVIA_METRICS_SEED?.top_flavors)
      ? TRIVIA_METRICS_SEED.top_flavors.slice(0, limit)
      : [];
    if (topFlavors.length > 0) {
      stateLeaders['national'] = topFlavors.map((f, idx) => ({
        rank: idx + 1,
        flavor: f.title,
        count: f.appearances || 0,
      }));
      source = 'metrics_seed';
    }
  }

  return Response.json({
    window_days: days,
    source,
    state_leaders: stateLeaders,
    states_returned: Object.keys(stateLeaders).length,
  }, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=900',
    },
  });
}

export async function handleLeaderboardRoute(canonical, url, request, env, corsHeaders) {
  if (canonical !== '/api/leaderboard/state') return null;
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed. Use GET.' },
      { status: 405, headers: corsHeaders }
    );
  }
  return handleStateLeaderboard(url, env, corsHeaders);
}
