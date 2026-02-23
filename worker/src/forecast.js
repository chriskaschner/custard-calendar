/**
 * Forecast endpoint — serves pre-computed flavor predictions.
 *
 * Source priority:
 *   1. D1 forecasts table (primary durable store)
 *   2. KV `forecast:{slug}` (temporary backward-compat fallback)
 *
 * GET /api/v1/forecast/{slug}
 *   → { store_slug, date, predictions: [{flavor, probability}], prose }
 */

async function readForecastFromD1(db, slug) {
  if (!db) return { found: false, forecast: null, corrupted: false };
  try {
    const row = await db.prepare(
      'SELECT data FROM forecasts WHERE slug = ? LIMIT 1'
    ).bind(slug).first();
    if (!row || !row.data) {
      return { found: false, forecast: null, corrupted: false };
    }
    try {
      return { found: true, forecast: JSON.parse(row.data), corrupted: false };
    } catch (err) {
      console.error(`Corrupted forecast JSON in D1 for slug=${slug}: ${err.message}`);
      return { found: true, forecast: null, corrupted: true };
    }
  } catch (err) {
    // D1 read failures are non-fatal; caller can fall back to KV.
    console.error(`Forecast D1 read failed for slug=${slug}: ${err.message}`);
    return { found: false, forecast: null, corrupted: false };
  }
}

async function readForecastFromKv(kv, slug) {
  if (!kv) return { found: false, forecast: null, corrupted: false };
  try {
    const cached = await kv.get(`forecast:${slug}`);
    if (!cached) {
      return { found: false, forecast: null, corrupted: false };
    }
    try {
      return { found: true, forecast: JSON.parse(cached), corrupted: false };
    } catch (err) {
      console.error(`Corrupted forecast JSON in KV for slug=${slug}: ${err.message}`);
      return { found: true, forecast: null, corrupted: true };
    }
  } catch (err) {
    console.error(`Forecast KV read failed for slug=${slug}: ${err.message}`);
    return { found: false, forecast: null, corrupted: false };
  }
}

/**
 * Resolve forecast data for a store slug.
 * Returns D1-first with KV fallback.
 * @param {string} slug
 * @param {Object} env
 * @returns {Promise<{ forecast: Object|null, source: string|null, corrupted: boolean }>}
 */
export async function getForecastData(slug, env) {
  const d1Result = await readForecastFromD1(env.DB || null, slug);
  if (d1Result.found && d1Result.forecast) {
    return { forecast: d1Result.forecast, source: 'd1', corrupted: false };
  }

  const kvResult = await readForecastFromKv(env.FLAVOR_CACHE || null, slug);
  if (kvResult.found && kvResult.forecast) {
    return { forecast: kvResult.forecast, source: 'kv', corrupted: false };
  }

  return {
    forecast: null,
    source: null,
    corrupted: Boolean(d1Result.corrupted || kvResult.corrupted),
  };
}

/**
 * Handle forecast route.
 * @param {string} slug - Store slug from URL path
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handleForecast(slug, env, corsHeaders) {
  const hasDb = Boolean(env.DB);
  const hasKv = Boolean(env.FLAVOR_CACHE);
  if (!hasDb && !hasKv) {
    return Response.json(
      { error: 'Forecast data not available — neither D1 nor KV is configured' },
      { status: 503, headers: corsHeaders },
    );
  }

  const { forecast, corrupted } = await getForecastData(slug, env);
  if (!forecast && corrupted) {
    return Response.json(
      { error: 'Forecast data corrupted' },
      { status: 500, headers: corsHeaders },
    );
  }

  if (!forecast) {
    return Response.json(
      { error: `No forecast available for "${slug}". Forecasts are generated daily by the batch pipeline.` },
      { status: 404, headers: corsHeaders },
    );
  }

  return Response.json(forecast, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'public, max-age=3600', // 1 hour
    },
  });
}
