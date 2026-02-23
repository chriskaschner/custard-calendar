/**
 * Metrics endpoints — queryable flavor intelligence from D1 snapshots.
 *
 * Three views:
 *   GET /api/v1/metrics/flavor/{normalized}  — frequency, recency, store count
 *   GET /api/v1/metrics/store/{slug}         — diversity, flavor history, streaks
 *   GET /api/v1/metrics/trending             — most/least common this week vs historical
 */

/**
 * Route a metrics request to the appropriate handler.
 * @param {string} path - Canonical path (already normalized)
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response|null>}
 */
export async function handleMetricsRoute(path, env, corsHeaders) {
  const db = env.DB;
  if (!db) {
    return Response.json(
      { error: 'Metrics not available — D1 database not configured' },
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

  return null;
}

/**
 * Flavor metrics: how often does this flavor appear, at how many stores, when was it last seen?
 */
async function handleFlavorMetrics(db, normalized, corsHeaders) {
  const [frequencyResult, recentResult, storeCountResult] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as total_appearances FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalized).first(),
    db.prepare(
      `SELECT date, slug, flavor FROM snapshots WHERE normalized_flavor = ? ORDER BY date DESC LIMIT 10`
    ).bind(normalized).all(),
    db.prepare(
      `SELECT COUNT(DISTINCT slug) as store_count FROM snapshots WHERE normalized_flavor = ?`
    ).bind(normalized).first(),
  ]);

  return Response.json({
    normalized_flavor: normalized,
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

export { detectStreaks };
