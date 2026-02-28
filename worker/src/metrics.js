/**
 * Metrics endpoints — queryable flavor intelligence from D1 snapshots.
 *
 * Three views:
 *   GET /api/v1/metrics/intelligence      — historical metrics seed summary
 *   GET /api/v1/metrics/flavor/{normalized}  — frequency, recency, store count
 *   GET /api/v1/metrics/store/{slug}         — diversity, flavor history, streaks
 *   GET /api/v1/metrics/trending             — most/least common this week vs historical
 *   GET /api/v1/analytics/geo-eda           — geographic EDA: exclusive flavors, cadence variance, outlier stores
 */

import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';
import { STORE_INDEX } from './store-index.js';
import { WI_METRO_MAP } from './leaderboard.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
let cachedFlavorRank = null;

function normalizeFlavorKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122\u00a9]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getSourceWindow(seed) {
  return {
    start: seed?.dataset_summary?.min_date || null,
    end: seed?.dataset_summary?.max_date || null,
  };
}

function getFlavorRank(seed) {
  const cacheKey = `${seed?.generated_at || 'na'}:${seed?.as_of || 'na'}`;
  if (cachedFlavorRank && cachedFlavorRank.key === cacheKey) return cachedFlavorRank.value;

  const flavorLookup = seed?.planner_features?.flavor_lookup && typeof seed.planner_features.flavor_lookup === 'object'
    ? seed.planner_features.flavor_lookup
    : {};
  const rows = Object.entries(flavorLookup)
    .map(([normalized, row]) => ({ normalized, appearances: Number(row?.appearances || 0) }))
    .filter((row) => row.normalized && row.appearances > 0)
    .sort((a, b) => b.appearances - a.appearances);

  const byNormalized = {};
  for (let i = 0; i < rows.length; i++) {
    byNormalized[rows[i].normalized] = i + 1;
  }

  const value = { byNormalized, total: rows.length };
  cachedFlavorRank = { key: cacheKey, value };
  return value;
}

// ---------------------------------------------------------------------------
// Flavor hierarchy helpers
// ---------------------------------------------------------------------------

/**
 * Compute appearances + avg_gap_days from a sorted array of date strings.
 * Dates must be sorted ASC; duplicates are allowed (collapsed to same-day).
 */
function computeGapStats(dates) {
  const deduped = [...new Set(dates)].sort();
  const appearances = deduped.length;
  if (appearances < 2) return { appearances, avg_gap_days: null };
  let totalGap = 0;
  for (let i = 1; i < deduped.length; i++) {
    totalGap += (new Date(deduped[i]) - new Date(deduped[i - 1])) / 86400000;
  }
  return { appearances, avg_gap_days: Math.round(totalGap / (deduped.length - 1)) };
}

/**
 * Query all appearance rows {slug, date} for a flavor across a set of slugs.
 * Batches into groups of 98 slugs to stay under D1's 100-bind limit.
 */
async function queryDatesForSlugs(db, slugs, normalizedFlavor) {
  if (!db || !slugs.length) return [];
  const SLUG_BATCH = 98; // leave 2 slots: 1 for flavor, 1 safety margin
  const allRows = [];
  for (let i = 0; i < slugs.length; i += SLUG_BATCH) {
    const batch = slugs.slice(i, i + SLUG_BATCH);
    const placeholders = batch.map(() => '?').join(',');
    try {
      const result = await db.prepare(
        `SELECT slug, date FROM snapshots WHERE slug IN (${placeholders}) AND normalized_flavor = ? ORDER BY date ASC`,
      ).bind(...batch, normalizedFlavor).all();
      for (const row of (result?.results || [])) {
        allRows.push({ slug: row.slug, date: row.date });
      }
    } catch {
      // Partial failure: continue with what we have
    }
  }
  return allRows;
}

/**
 * Compute appearances + avg_gap_days across multiple stores.
 *
 * Groups rows by slug, computes per-store avg_gap, then averages those gaps.
 * This avoids the deduplication error in computeGapStats where same-day
 * appearances from different stores collapse into one calendar date.
 *
 * appearances = total store-day count (not deduped calendar days).
 * avg_gap_days = mean of per-store avg_gap_days (only stores with >= 2 appearances).
 */
function computeGapStatsPerSlug(rows) {
  if (!rows.length) return { appearances: 0, avg_gap_days: null };
  const bySlug = new Map();
  for (const { slug, date } of rows) {
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(date);
  }
  const slugGaps = [];
  for (const dates of bySlug.values()) {
    const stats = computeGapStats(dates);
    if (stats.avg_gap_days !== null) slugGaps.push(stats.avg_gap_days);
  }
  const avg_gap_days =
    slugGaps.length > 0
      ? Math.round(slugGaps.reduce((a, b) => a + b, 0) / slugGaps.length)
      : null;
  return { appearances: rows.length, avg_gap_days };
}

/**
 * GET /api/v1/metrics/flavor-hierarchy?flavor=X&slug=Y
 *
 * Returns avg_gap_days + appearances at 4 scopes (store, metro, state, national)
 * for a flavor+store pair. effective_scope = first scope with >= 30 appearances.
 *
 * Scopes:
 *   store    — appearances at this specific store (D1)
 *   metro    — appearances across WI metro area (D1; WI stores only)
 *   state    — appearances across all stores in the same state (D1)
 *   national — from TRIVIA_METRICS_SEED planner_features.flavor_lookup
 */
async function handleFlavorHierarchyMetrics(rawFlavor, rawSlug, env, corsHeaders) {
  const flavor = String(rawFlavor || '').trim();
  const slug = String(rawSlug || '').trim().toLowerCase();
  const normalizedFlavor = normalizeFlavorKey(flavor);

  if (!flavor || !slug || !normalizedFlavor) {
    return Response.json(
      { error: 'flavor and slug query params are required' },
      { status: 400, headers: corsHeaders },
    );
  }

  // --- Store entry lookup ---
  const storeEntry = STORE_INDEX.find((s) => s.slug === slug);
  const storeCity = (storeEntry?.city || '').toLowerCase().trim();
  const storeState = storeEntry?.state || null;

  const db = env.DB || null;
  const scopes = {};

  // --- Store scope ---
  // Single store: extract dates from rows, use computeGapStats (dedup is correct for one store).
  {
    const rows = db ? await queryDatesForSlugs(db, [slug], normalizedFlavor) : [];
    const stats = computeGapStats(rows.map((r) => r.date));
    scopes.store = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days };
  }

  // --- Metro scope (WI only) ---
  // Multiple stores: use computeGapStatsPerSlug to avoid collapsing same-day
  // appearances from different stores into a single calendar date.
  const metro = storeCity ? (WI_METRO_MAP[storeCity] || null) : null;
  if (metro && metro !== 'other') {
    const metroSlugs = STORE_INDEX
      .filter((s) => WI_METRO_MAP[(s.city || '').toLowerCase().trim()] === metro)
      .map((s) => s.slug);
    const rows = db ? await queryDatesForSlugs(db, metroSlugs, normalizedFlavor) : [];
    const stats = computeGapStatsPerSlug(rows);
    scopes.metro = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days, metro };
  } else {
    scopes.metro = null;
  }

  // --- State scope ---
  // Multiple stores: use computeGapStatsPerSlug (same reason as metro).
  if (storeState) {
    const stateSlugs = STORE_INDEX
      .filter((s) => s.state === storeState)
      .map((s) => s.slug);
    const rows = db ? await queryDatesForSlugs(db, stateSlugs, normalizedFlavor) : [];
    const stats = computeGapStatsPerSlug(rows);
    scopes.state = { appearances: stats.appearances, avg_gap_days: stats.avg_gap_days, state: storeState };
  } else {
    scopes.state = null;
  }

  // --- National scope (from seed; no D1 query) ---
  {
    const seed = TRIVIA_METRICS_SEED || {};
    const lookup = seed?.planner_features?.flavor_lookup || {};
    const seedRow = lookup[normalizedFlavor] || null;
    if (seedRow) {
      const appearances = Number(seedRow.appearances || 0);
      const storeCount = Number(seedRow.store_count || 1);
      const summary = seed.dataset_summary || {};
      let avg_gap_days = null;
      if (appearances > 0 && storeCount > 0 && summary.min_date && summary.max_date) {
        const spanDays = (new Date(summary.max_date) - new Date(summary.min_date)) / 86400000;
        // Avg appearances per store = appearances / store_count
        // Avg gap at a typical store = span_days / (appearances / store_count)
        const appsPerStore = appearances / storeCount;
        if (appsPerStore > 0) {
          avg_gap_days = Math.round(spanDays / appsPerStore);
        }
      }
      scopes.national = { appearances, avg_gap_days };
    } else {
      scopes.national = null;
    }
  }

  // --- effective_scope: first scope with >= 30 appearances ---
  const SCOPE_ORDER = ['store', 'metro', 'state', 'national'];
  const MIN_APPEARANCES = 30;
  let effectiveScope = 'national';
  for (const scope of SCOPE_ORDER) {
    const s = scopes[scope];
    if (s && Number(s.appearances || 0) >= MIN_APPEARANCES) {
      effectiveScope = scope;
      break;
    }
  }

  return Response.json(
    { flavor, slug, scopes, effective_scope: effectiveScope },
    { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } },
  );
}

/**
 * GET /api/v1/metrics/health/{slug}
 *
 * Returns D1 row count, date range, and gap statistics for a given store slug.
 * Useful for diagnosing D1 vs local backfill discrepancies after uploads.
 */
async function handleHealthMetrics(db, slug, corsHeaders) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!cleanSlug) {
    return Response.json({ error: 'slug is required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const summary = await db.prepare(
      'SELECT COUNT(*) AS row_count, MIN(date) AS min_date, MAX(date) AS max_date FROM snapshots WHERE slug = ?',
    ).bind(cleanSlug).first();

    const rowCount = Number(summary?.row_count || 0);
    const minDate = summary?.min_date || null;
    const maxDate = summary?.max_date || null;

    let gapsGt14d = [];
    let gapCount = 0;
    if (rowCount > 1) {
      const dateRows = await db.prepare(
        'SELECT DISTINCT date FROM snapshots WHERE slug = ? ORDER BY date ASC',
      ).bind(cleanSlug).all();
      const dates = (dateRows?.results || []).map((r) => r.date);
      for (let i = 1; i < dates.length; i++) {
        const days = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (days > 14) {
          gapCount++;
          if (gapsGt14d.length < 20) {
            gapsGt14d.push({ from: dates[i - 1], to: dates[i], days: Math.round(days) });
          }
        }
      }
    }

    const seed = TRIVIA_METRICS_SEED || {};
    const generatedAt = seed.generated_at || null;
    let seedAgeDays = null;
    if (generatedAt) {
      seedAgeDays = Math.round((Date.now() - new Date(generatedAt).getTime()) / 86400000);
    }

    return Response.json(
      {
        slug: cleanSlug,
        d1: { row_count: rowCount, date_range: { min: minDate, max: maxDate }, gap_count: gapCount, gaps_gt_14d: gapsGt14d },
        metrics_seed_age_days: seedAgeDays,
      },
      { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch (err) {
    return Response.json(
      { error: 'D1 query failed', request_id: corsHeaders['X-Request-ID'] || null },
      { status: 503, headers: corsHeaders },
    );
  }
}

/**
 * Route a metrics request to the appropriate handler.
 * @param {string} path - Canonical path (already normalized)
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @param {URL|null} url - Full request URL (for query param access)
 * @returns {Promise<Response|null>}
 */
export async function handleMetricsRoute(path, env, corsHeaders, url = null) {
  // /api/metrics/intelligence
  // Served from generated metrics seed; does not require D1.
  if (path === '/api/metrics/intelligence') {
    return handleIntelligenceMetrics(corsHeaders);
  }

  // /api/metrics/flavor-hierarchy?flavor=X&slug=Y
  if (path === '/api/metrics/flavor-hierarchy') {
    return handleFlavorHierarchyMetrics(
      url?.searchParams?.get('flavor') || '',
      url?.searchParams?.get('slug') || '',
      env,
      corsHeaders,
    );
  }

  const contextFlavorMatch = path.match(/^\/api\/metrics\/context\/flavor\/(.+)$/);
  if (contextFlavorMatch) {
    return handleFlavorContextMetrics(decodeURIComponent(contextFlavorMatch[1]), corsHeaders);
  }

  const contextStoreMatch = path.match(/^\/api\/metrics\/context\/store\/(.+)$/);
  if (contextStoreMatch) {
    return handleStoreContextMetrics(decodeURIComponent(contextStoreMatch[1]), corsHeaders, env.DB);
  }

  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: 'Metrics not available — D1 database not configured', request_id: env?._requestId || null },
      { status: 503, headers: corsHeaders },
    );
  }

  // /api/metrics/flavor/{normalized}
  const flavorMatch = path.match(/^\/api\/metrics\/flavor\/(.+)$/);
  if (flavorMatch) {
    return handleFlavorMetrics(db, decodeURIComponent(flavorMatch[1]), corsHeaders);
  }

  // /api/metrics/store/{slug}
  const storeMatch = path.match(/^\/api\/metrics\/store\/(.+)$/);
  if (storeMatch) {
    return handleStoreMetrics(db, decodeURIComponent(storeMatch[1]), corsHeaders);
  }

  // /api/metrics/trending
  if (path === '/api/metrics/trending') {
    return handleTrending(db, corsHeaders);
  }

  // /api/metrics/accuracy/{slug}
  const accuracyStoreMatch = path.match(/^\/api\/metrics\/accuracy\/(.+)$/);
  if (accuracyStoreMatch) {
    return handleAccuracyByStore(db, decodeURIComponent(accuracyStoreMatch[1]), corsHeaders);
  }

  // /api/metrics/accuracy
  if (path === '/api/metrics/accuracy') {
    return handleAccuracy(db, corsHeaders);
  }

  // /api/metrics/coverage
  if (path === '/api/metrics/coverage') {
    return handleCoverage(db, corsHeaders);
  }

  // /api/metrics/health/{slug}
  const healthMatch = path.match(/^\/api\/metrics\/health\/(.+)$/);
  if (healthMatch) {
    return handleHealthMetrics(db, decodeURIComponent(healthMatch[1]), corsHeaders);
  }

  return null;
}

function trimList(list, limit) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, limit);
}

function handleIntelligenceMetrics(corsHeaders) {
  const seed = TRIVIA_METRICS_SEED || {};
  const topFlavors = trimList(seed.top_flavors, 10);
  const topStores = trimList(seed.top_stores, 10);
  const seasonalSpotlights = trimList(seed.seasonal_spotlights, 10);
  const topStates = trimList(seed?.coverage?.top_state_coverage, 12);
  const hnbc = seed?.hnbc || {};
  const hnbcByMonth = hnbc.by_month && typeof hnbc.by_month === 'object' ? hnbc.by_month : {};
  const hnbcPeakMonth = Object.entries(hnbcByMonth)
    .map(([month, count]) => ({ month: Number(month), count: Number(count) }))
    .filter((row) => Number.isFinite(row.month) && row.month >= 1 && row.month <= 12 && Number.isFinite(row.count))
    .sort((a, b) => b.count - a.count)[0] || null;

  return Response.json({
    contract_version: Number(seed.version || 1),
    source: 'trivia_metrics_seed',
    generated_at: seed.generated_at || null,
    as_of: seed.as_of || null,
    dataset_summary: seed.dataset_summary || null,
    coverage: {
      manifest_total: Number(seed?.coverage?.manifest_total || 0),
      current_covered: Number(seed?.coverage?.current_covered || 0),
      wayback_covered: Number(seed?.coverage?.wayback_covered || 0),
      overall_covered: Number(seed?.coverage?.overall_covered || 0),
      missing_overall_count: Number(seed?.coverage?.missing_overall_count || 0),
      pending_non_wi_count: Number(seed?.coverage?.pending_non_wi_count || 0),
      top_state_coverage: topStates,
    },
    highlights: {
      top_flavors: topFlavors,
      top_stores: topStores,
      seasonal_spotlights: seasonalSpotlights,
      how_now_brown_cow: {
        count: Number(hnbc.count || 0),
        peak_month: hnbcPeakMonth ? hnbcPeakMonth.month : null,
        peak_month_count: hnbcPeakMonth ? hnbcPeakMonth.count : null,
        by_month: hnbcByMonth,
        by_year: hnbc.by_year && typeof hnbc.by_year === 'object' ? hnbc.by_year : {},
      },
    },
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

function handleFlavorContextMetrics(inputFlavor, corsHeaders) {
  const seed = TRIVIA_METRICS_SEED || {};
  const normalized = normalizeFlavorKey(inputFlavor);
  const lookup = seed?.planner_features?.flavor_lookup && typeof seed.planner_features.flavor_lookup === 'object'
    ? seed.planner_features.flavor_lookup
    : {};
  const rank = getFlavorRank(seed);
  const row = normalized ? lookup[normalized] : null;
  const peakMonth = Number(row?.peak_month || 0);
  const defaultMonthName = peakMonth >= 1 && peakMonth <= 12 ? MONTH_NAMES[peakMonth - 1] : null;

  return Response.json({
    source: 'trivia_metrics_seed',
    as_of: seed?.as_of || null,
    source_window: getSourceWindow(seed),
    normalized_flavor: normalized || null,
    found: !!row,
    rank: row ? (rank.byNormalized[normalized] || null) : null,
    total_ranked_flavors: rank.total,
    flavor: row ? {
      title: row.title || inputFlavor,
      appearances: Number(row.appearances || 0),
      store_count: Number(row.store_count || 0),
      peak_month: peakMonth || null,
      peak_month_name: row.peak_month_name || defaultMonthName,
      seasonal_concentration: Number(row.seasonal_concentration || 0),
    } : null,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Compute which flavor a store serves disproportionately vs. the national average.
 * Returns the top row if specialty_ratio >= 1.2, else null.
 */
async function computeStoreSpecialtyFromD1(slug, db) {
  if (!db || !slug) return null;
  try {
    const result = await db.prepare(
      `WITH store_counts AS (
        SELECT normalized_flavor, MAX(flavor) AS display_flavor, COUNT(*) AS cnt
        FROM snapshots
        WHERE slug = ? AND date >= date('now', '-365 days')
        GROUP BY normalized_flavor
        HAVING cnt >= 3
      ),
      national_counts AS (
        SELECT normalized_flavor, COUNT(*) AS cnt
        FROM snapshots
        WHERE date >= date('now', '-365 days')
        GROUP BY normalized_flavor
      ),
      store_total AS (SELECT COUNT(*) AS n FROM snapshots WHERE slug = ? AND date >= date('now', '-365 days')),
      national_total AS (SELECT COUNT(*) AS n FROM snapshots WHERE date >= date('now', '-365 days'))
      SELECT
        s.normalized_flavor, s.display_flavor, s.cnt AS store_count,
        n.cnt AS national_count, st.n AS store_total, nt.n AS national_total,
        ROUND(CAST(s.cnt AS REAL) / st.n / (CAST(n.cnt AS REAL) / nt.n), 2) AS specialty_ratio
      FROM store_counts s
      JOIN national_counts n ON s.normalized_flavor = n.normalized_flavor
      CROSS JOIN store_total st
      CROSS JOIN national_total nt
      WHERE st.n > 0 AND nt.n > 0
      ORDER BY specialty_ratio DESC
      LIMIT 3`
    ).bind(slug, slug).all();
    const rows = result?.results || [];
    const top = rows[0];
    if (!top || Number(top.specialty_ratio) < 1.2) return null;
    return {
      title: top.display_flavor,
      ratio: Number(top.specialty_ratio),
      store_count: Number(top.store_count),
    };
  } catch {
    return null;
  }
}

async function handleStoreContextMetrics(inputSlug, corsHeaders, db) {
  const seed = TRIVIA_METRICS_SEED || {};
  const slug = String(inputSlug || '').trim().toLowerCase();
  const lookup = seed?.planner_features?.store_lookup && typeof seed.planner_features.store_lookup === 'object'
    ? seed.planner_features.store_lookup
    : {};
  const row = slug ? lookup[slug] : null;
  const rank = getFlavorRank(seed);
  const topFlavorKey = row?.top_flavor ? normalizeFlavorKey(row.top_flavor) : '';

  const specialty_flavor = db ? await computeStoreSpecialtyFromD1(slug, db) : null;

  return Response.json({
    source: 'trivia_metrics_seed',
    as_of: seed?.as_of || null,
    source_window: getSourceWindow(seed),
    slug: slug || null,
    found: !!row,
    store: row ? {
      city: row.city || null,
      state: row.state || null,
      observations: Number(row.observations || 0),
      distinct_flavors: Number(row.distinct_flavors || 0),
      top_flavor: row.top_flavor || null,
      top_flavor_count: Number(row.top_flavor_count || 0),
      top_flavor_rank: topFlavorKey ? (rank.byNormalized[topFlavorKey] || null) : null,
    } : null,
    specialty_flavor,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Flavor metrics: how often does this flavor appear, at how many stores, when was it last seen?
 */
async function handleFlavorMetrics(db, normalized, corsHeaders) {
  const normalizedFlavor = normalizeFlavorKey(normalized);
  const rank = getFlavorRank(TRIVIA_METRICS_SEED || {});
  const globalRank = rank.byNormalized[normalizedFlavor] || null;
  const globalPercentile = (globalRank && rank.total > 1)
    ? Math.round((((globalRank - 1) / (rank.total - 1)) * 100) * 10) / 10
    : null;

  const [frequencyResult, recentResult, storeCountResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as total_appearances FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalizedFlavor).first(),
    db.prepare(
      `SELECT date, slug, flavor FROM snapshots WHERE normalized_flavor = ? ORDER BY date DESC LIMIT 10`
    ).bind(normalizedFlavor).all(),
    db.prepare(
      `SELECT COUNT(DISTINCT slug) as store_count FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalizedFlavor).first(),
  ]);

  return Response.json({
    normalized_flavor: normalizedFlavor,
    global_rank: globalRank,
    total_ranked_flavors: rank.total,
    global_percentile: globalPercentile,
    total_appearances: frequencyResult?.total_appearances || 0,
    store_count: storeCountResult?.store_count || 0,
    recent: (recentResult?.results || []).map(r => ({
      date: r.date,
      slug: r.slug,
      flavor: r.flavor,
    })),
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Store metrics: how many unique flavors has this store had, recent history, streaks.
 */
async function handleStoreMetrics(db, slug, corsHeaders) {
  const [diversityResult, historyResult, totalResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(DISTINCT normalized_flavor) as unique_flavors FROM snapshots WHERE slug = ?`
    ).bind(slug).first(),
    db.prepare(
      `SELECT date, flavor, normalized_flavor FROM snapshots WHERE slug = ? ORDER BY date DESC LIMIT 30`
    ).bind(slug).all(),
    db.prepare(
      `SELECT COUNT(*) as total_days FROM snapshots WHERE slug = ?`
    ).bind(slug).first(),
  ]);

  // Detect streaks (consecutive days with same flavor)
  const history = historyResult?.results || [];
  const streaks = detectStreaks(history);

  return Response.json({
    slug,
    unique_flavors: diversityResult?.unique_flavors || 0,
    total_days: totalResult?.total_days || 0,
    recent_history: history.map(r => ({
      date: r.date,
      flavor: r.flavor,
    })),
    active_streaks: streaks,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Trending: most and least common flavors this week vs overall.
 */
async function handleTrending(db, corsHeaders) {
  // This week = last 7 days, capped at today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const [thisWeekResult, allTimeResult] = await Promise.all([
    db.prepare(
      `SELECT normalized_flavor, flavor, COUNT(*) as count
       FROM snapshots WHERE date >= ? AND date <= ?
       GROUP BY normalized_flavor
       ORDER BY count DESC
       LIMIT 10`
    ).bind(weekAgoStr, todayStr).all(),
    db.prepare(
      `SELECT normalized_flavor, flavor, COUNT(*) as count
       FROM snapshots
       GROUP BY normalized_flavor
       ORDER BY count DESC
       LIMIT 10`
    ).all(),
  ]);

  return Response.json({
    this_week: (thisWeekResult?.results || []).map(r => ({
      flavor: r.flavor,
      normalized: r.normalized_flavor,
      count: r.count,
    })),
    all_time: (allTimeResult?.results || []).map(r => ({
      flavor: r.flavor,
      normalized: r.normalized_flavor,
      count: r.count,
    })),
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Accuracy metrics: all stores or grouped overview.
 */
async function handleAccuracy(db, corsHeaders) {
  const result = await db.prepare(
    `SELECT slug, window, top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, computed_at
     FROM accuracy_metrics ORDER BY slug, window`
  ).all();

  const rows = result?.results || [];
  // Group by slug
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.slug]) grouped[row.slug] = {};
    grouped[row.slug][row.window] = {
      top_1_hit_rate: row.top_1_hit_rate,
      top_5_hit_rate: row.top_5_hit_rate,
      avg_log_loss: row.avg_log_loss,
      n_samples: row.n_samples,
      computed_at: row.computed_at,
    };
  }

  return Response.json(grouped, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Accuracy metrics for a single store.
 */
async function handleAccuracyByStore(db, slug, corsHeaders) {
  const result = await db.prepare(
    `SELECT window, top_1_hit_rate, top_5_hit_rate, avg_log_loss, n_samples, computed_at
     FROM accuracy_metrics WHERE slug = ? ORDER BY window`
  ).bind(slug).all();

  const rows = result?.results || [];
  const metrics = {};
  for (const row of rows) {
    metrics[row.window] = {
      top_1_hit_rate: row.top_1_hit_rate,
      top_5_hit_rate: row.top_5_hit_rate,
      avg_log_loss: row.avg_log_loss,
      n_samples: row.n_samples,
      computed_at: row.computed_at,
    };
  }

  return Response.json({ slug, metrics }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Coverage: how many forecast slugs exist and which have recent snapshot backing.
 */
async function handleCoverage(db, corsHeaders) {
  const [forecastResult, snapshotResult] = await Promise.all([
    db.prepare(
      `SELECT slug, generated_at FROM forecasts ORDER BY slug`
    ).all(),
    db.prepare(
      `SELECT DISTINCT slug FROM snapshots
       WHERE date >= date('now', '-2 days')
       AND fetched_at >= datetime('now', '-48 hours')`
    ).all(),
  ]);

  const forecastRows = forecastResult?.results || [];
  const snapshotSlugs = new Set((snapshotResult?.results || []).map(r => r.slug));

  const forecastSlugs = forecastRows.map(r => r.slug);
  const lastGenerated = forecastRows.length > 0
    ? forecastRows.reduce((latest, r) => (r.generated_at > latest ? r.generated_at : latest), forecastRows[0].generated_at)
    : null;

  const withSnapshot = forecastSlugs.filter(s => snapshotSlugs.has(s));
  const missingSlugs = forecastSlugs.filter(s => !snapshotSlugs.has(s));

  return Response.json({
    forecast_slugs: forecastSlugs,
    total_forecasts: forecastSlugs.length,
    snapshot_coverage: {
      stores_with_recent_snapshots: snapshotSlugs.size,
      stores_with_forecast_and_snapshot: withSnapshot.length,
    },
    last_generated: lastGenerated,
    missing_slugs: missingSlugs,
  }, {
    headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
  });
}

/**
 * Detect streaks of consecutive appearances of the same flavor.
 * @param {Array<{date: string, normalized_flavor: string}>} history - Sorted desc by date
 * @returns {Array<{flavor: string, length: number, start: string, end: string}>}
 */
function detectStreaks(history) {
  if (history.length === 0) return [];

  const streaks = [];
  let currentFlavor = history[0].normalized_flavor;
  let currentName = history[0].flavor;
  let streakLen = 1;
  let streakEnd = history[0].date;
  let streakStart = history[0].date;

  for (let i = 1; i < history.length; i++) {
    if (history[i].normalized_flavor === currentFlavor) {
      streakLen++;
      streakStart = history[i].date;
    } else {
      if (streakLen >= 2) {
        streaks.push({ flavor: currentName, length: streakLen, start: streakStart, end: streakEnd });
      }
      currentFlavor = history[i].normalized_flavor;
      currentName = history[i].flavor;
      streakLen = 1;
      streakEnd = history[i].date;
      streakStart = history[i].date;
    }
  }
  if (streakLen >= 2) {
    streaks.push({ flavor: currentName, length: streakLen, start: streakStart, end: streakEnd });
  }

  return streaks;
}

// ---------------------------------------------------------------------------
// Geographic EDA endpoint
// ---------------------------------------------------------------------------

/**
 * Resolve the set of slugs that belong to a given scope+region.
 *
 * scope = 'national' → all slugs in STORE_INDEX
 * scope = 'state'    → region is a two-letter state code, e.g. "WI"
 * scope = 'metro'    → region is a metro slug, e.g. "madison" or "milwaukee"
 *                      (currently WI-only via WI_METRO_MAP)
 *
 * Returns { scopeSlugs, label } or null when the region yields no stores.
 */
function resolveScopeSlugs(scope, region, storeIndex) {
  if (scope === 'national') {
    return { scopeSlugs: storeIndex.map((s) => s.slug), label: 'national' };
  }

  if (scope === 'state') {
    const stateUpper = String(region || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(stateUpper)) return null;
    const slugs = storeIndex.filter((s) => s.state === stateUpper).map((s) => s.slug);
    return slugs.length > 0 ? { scopeSlugs: slugs, label: stateUpper } : null;
  }

  if (scope === 'metro') {
    const metroKey = String(region || '').trim().toLowerCase();
    if (!metroKey) return null;
    // Metro mapping: use WI_METRO_MAP (city → metro slug)
    const slugs = storeIndex
      .filter((s) => WI_METRO_MAP[(s.city || '').toLowerCase().trim()] === metroKey)
      .map((s) => s.slug);
    return slugs.length > 0 ? { scopeSlugs: slugs, label: metroKey } : null;
  }

  return null;
}

/**
 * Compute mean and population standard deviation of a numeric array.
 * Returns { mean, stddev } — stddev is 0 when fewer than 2 elements.
 */
function computeStats(values) {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return { mean, stddev: 0 };
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * GET /api/v1/analytics/geo-eda
 *
 * Query params:
 *   scope  = metro | state | national  (default: national)
 *   region = metro slug or state code when scope is metro/state
 *
 * Response:
 *   exclusive_flavors  — top flavors whose appearances are concentrated in this scope
 *   cadence_variance   — flavors with the widest gap between scope avg_gap and national avg_gap
 *   outlier_stores     — stores whose monthly unique-flavor count is a statistical outlier vs scope peers
 *
 * Cache-Control: public, max-age=86400 (24 h — batch/exploratory, not real-time)
 */
export async function handleGeoEDA(url, env, corsHeaders) {
  const scope = (url?.searchParams?.get('scope') || 'national').toLowerCase().trim();
  const region = (url?.searchParams?.get('region') || '').trim();

  const VALID_SCOPES = ['national', 'state', 'metro'];
  if (!VALID_SCOPES.includes(scope)) {
    return Response.json(
      { error: `Invalid scope "${scope}". Must be one of: national, state, metro` },
      { status: 400, headers: corsHeaders },
    );
  }

  const storeIndex = env._storeIndexOverride || STORE_INDEX;
  const resolved = resolveScopeSlugs(scope, region, storeIndex);

  if (!resolved) {
    return Response.json(
      { error: `Region "${region}" not found for scope "${scope}"` },
      { status: 400, headers: corsHeaders },
    );
  }

  const { scopeSlugs, label } = resolved;

  const db = env.DB || null;
  if (!db) {
    return Response.json(
      { error: 'Analytics not available — D1 database not configured', request_id: env?._requestId || null },
      { status: 503, headers: corsHeaders },
    );
  }

  const [exclusiveFlavors, cadenceVariance, outlierStores] = await Promise.all([
    computeExclusiveFlavors(db, scopeSlugs, scope, storeIndex),
    computeCadenceVariance(db, scopeSlugs, scope),
    computeOutlierStores(db, scopeSlugs, storeIndex),
  ]);

  return Response.json(
    {
      scope,
      region: scope === 'national' ? null : label,
      generated_at: new Date().toISOString(),
      store_count: scopeSlugs.length,
      exclusive_flavors: exclusiveFlavors,
      cadence_variance: cadenceVariance,
      outlier_stores: outlierStores,
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}

/**
 * Flavors appearing at >= 50% of stores in this scope, sorted by appearances desc.
 * "Exclusive" here means "scope-concentrated" — common within the scope.
 * For sub-national scopes we include pct_of_scope_stores to surface regional concentration.
 *
 * D1 100-bind limit: batch slug lists in groups of 98.
 */
async function computeExclusiveFlavors(db, scopeSlugs, scope, storeIndex) {
  if (!scopeSlugs.length) return [];

  const SLUG_BATCH = 98;
  // Aggregate: { [normalized_flavor]: { flavor, count, storeSet } }
  const flavorAgg = new Map();

  try {
    for (let i = 0; i < scopeSlugs.length; i += SLUG_BATCH) {
      const batch = scopeSlugs.slice(i, i + SLUG_BATCH);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.prepare(
        `SELECT normalized_flavor, MAX(flavor) AS flavor, slug, COUNT(*) AS cnt
         FROM snapshots
         WHERE slug IN (${placeholders})
         GROUP BY normalized_flavor, slug`,
      ).bind(...batch).all();

      for (const row of (result?.results || [])) {
        const nf = row.normalized_flavor;
        if (!nf) continue;
        if (!flavorAgg.has(nf)) {
          flavorAgg.set(nf, { flavor: row.flavor || nf, appearances: 0, storeSet: new Set() });
        }
        const entry = flavorAgg.get(nf);
        entry.appearances += Number(row.cnt || 0);
        entry.storeSet.add(row.slug);
      }
    }
  } catch {
    return [];
  }

  const totalStores = scopeSlugs.length;
  const minStores = Math.max(1, Math.ceil(totalStores * 0.5));

  const results = [];
  for (const [, entry] of flavorAgg) {
    if (entry.storeSet.size >= minStores) {
      results.push({
        flavor: entry.flavor,
        appearances: entry.appearances,
        pct_of_scope_stores: totalStores > 0
          ? Math.round((entry.storeSet.size / totalStores) * 1000) / 1000
          : 0,
      });
    }
  }

  results.sort((a, b) => b.appearances - a.appearances || a.flavor.localeCompare(b.flavor));
  return results.slice(0, 20);
}

/**
 * Flavors with the largest absolute difference between scope avg_gap_days and national avg_gap_days.
 * Only includes flavors with >= 5 appearances in the scope and a known national avg.
 */
async function computeCadenceVariance(db, scopeSlugs, scope) {
  if (!scopeSlugs.length) return [];

  const SLUG_BATCH = 98;

  // Per-flavor date lists for scope
  const scopeDates = new Map(); // normalized_flavor → Set<date>
  const scopeFlavorNames = new Map(); // normalized_flavor → display name

  try {
    for (let i = 0; i < scopeSlugs.length; i += SLUG_BATCH) {
      const batch = scopeSlugs.slice(i, i + SLUG_BATCH);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.prepare(
        `SELECT normalized_flavor, MAX(flavor) AS flavor, date
         FROM snapshots
         WHERE slug IN (${placeholders})
         GROUP BY normalized_flavor, date`,
      ).bind(...batch).all();

      for (const row of (result?.results || [])) {
        const nf = row.normalized_flavor;
        if (!nf) continue;
        if (!scopeDates.has(nf)) scopeDates.set(nf, new Set());
        scopeDates.get(nf).add(row.date);
        if (!scopeFlavorNames.has(nf)) scopeFlavorNames.set(nf, row.flavor || nf);
      }
    }
  } catch {
    return [];
  }

  // National avg_gap from seed
  const seed = TRIVIA_METRICS_SEED || {};
  const lookup = seed?.planner_features?.flavor_lookup || {};
  const summary = seed?.dataset_summary || {};
  const spanDays = (summary.min_date && summary.max_date)
    ? (new Date(summary.max_date) - new Date(summary.min_date)) / 86400000
    : null;

  const results = [];

  for (const [nf, dateSet] of scopeDates) {
    const sortedDates = [...dateSet].sort();
    const appearances = sortedDates.length;
    if (appearances < 5) continue;

    // Scope avg_gap: average gap between consecutive calendar dates (deduped across stores)
    let scopeAvgGap = null;
    if (appearances >= 2) {
      let totalGap = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        totalGap += (new Date(sortedDates[i]) - new Date(sortedDates[i - 1])) / 86400000;
      }
      scopeAvgGap = Math.round(totalGap / (appearances - 1));
    }

    if (scopeAvgGap === null) continue;

    // National avg_gap from seed
    const seedRow = lookup[nf];
    let nationalAvgGap = null;
    if (seedRow) {
      const seedApps = Number(seedRow.appearances || 0);
      const seedStores = Number(seedRow.store_count || 1);
      if (seedApps > 0 && seedStores > 0 && spanDays !== null) {
        const appsPerStore = seedApps / seedStores;
        if (appsPerStore > 0) nationalAvgGap = Math.round(spanDays / appsPerStore);
      }
    }

    if (nationalAvgGap === null || nationalAvgGap === 0) continue;

    const varianceRatio = Math.round((scopeAvgGap / nationalAvgGap) * 100) / 100;

    // Only surface flavors with meaningful divergence (ratio outside 0.5–2.0)
    if (varianceRatio < 0.3 || varianceRatio > 10) continue;

    results.push({
      flavor: scopeFlavorNames.get(nf) || nf,
      normalized_flavor: nf,
      avg_gap_days: scopeAvgGap,
      national_avg_gap_days: nationalAvgGap,
      variance_ratio: varianceRatio,
    });
  }

  // Sort by absolute deviation from 1.0 (most divergent first)
  results.sort((a, b) => {
    const devA = Math.abs(a.variance_ratio - 1);
    const devB = Math.abs(b.variance_ratio - 1);
    return devB - devA;
  });

  return results.slice(0, 20);
}

/**
 * Stores that are statistical outliers in avg_unique_flavors_per_month vs their scope peers.
 * Requires >= 2 months of data per store to be included.
 * z_score computed against scope mean/stddev; |z| >= 1.5 = outlier.
 */
async function computeOutlierStores(db, scopeSlugs, storeIndex) {
  if (!scopeSlugs.length) return [];

  const SLUG_BATCH = 98;
  // monthly unique-flavor counts per store
  const storeMonthly = new Map(); // slug → Map<yearmonth, Set<normalized_flavor>>

  try {
    for (let i = 0; i < scopeSlugs.length; i += SLUG_BATCH) {
      const batch = scopeSlugs.slice(i, i + SLUG_BATCH);
      const placeholders = batch.map(() => '?').join(',');
      const result = await db.prepare(
        `SELECT slug, strftime('%Y-%m', date) AS yearmonth, normalized_flavor
         FROM snapshots
         WHERE slug IN (${placeholders})`,
      ).bind(...batch).all();

      for (const row of (result?.results || [])) {
        const { slug, yearmonth, normalized_flavor: nf } = row;
        if (!slug || !yearmonth || !nf) continue;
        if (!storeMonthly.has(slug)) storeMonthly.set(slug, new Map());
        const monthMap = storeMonthly.get(slug);
        if (!monthMap.has(yearmonth)) monthMap.set(yearmonth, new Set());
        monthMap.get(yearmonth).add(nf);
      }
    }
  } catch {
    return [];
  }

  // Compute avg_unique_flavors_per_month per store (require >= 2 months)
  const storeAvgs = [];
  for (const [slug, monthMap] of storeMonthly) {
    if (monthMap.size < 2) continue;
    const monthCounts = [...monthMap.values()].map((s) => s.size);
    const avg = monthCounts.reduce((a, b) => a + b, 0) / monthCounts.length;
    storeAvgs.push({ slug, avg: Math.round(avg * 10) / 10, months: monthMap.size });
  }

  if (storeAvgs.length < 3) return []; // too few stores to compute meaningful z-scores

  const { mean: scopeMean, stddev: scopeStddev } = computeStats(storeAvgs.map((s) => s.avg));
  const scopeMedian = (() => {
    const sorted = storeAvgs.map((s) => s.avg).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  })();

  if (scopeStddev === 0) return [];

  // Build store name lookup from storeIndex (already resolved by caller)
  const storeNameMap = new Map((storeIndex || STORE_INDEX).map((s) => [s.slug, s.name]));

  const outliers = [];
  for (const { slug, avg, months } of storeAvgs) {
    const zScore = Math.round(((avg - scopeMean) / scopeStddev) * 100) / 100;
    if (Math.abs(zScore) >= 1.5) {
      outliers.push({
        slug,
        name: storeNameMap.get(slug) || slug,
        avg_unique_flavors_per_month: avg,
        scope_median: Math.round(scopeMedian * 10) / 10,
        z_score: zScore,
        months_observed: months,
      });
    }
  }

  // Sort by |z_score| descending
  outliers.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
  return outliers.slice(0, 20);
}

export { detectStreaks };
