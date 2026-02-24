/**
 * Shared planner engine for the custard intelligence platform.
 *
 * Answers: "Where should I go, within my radius and time window,
 * for flavors I care about?" Used by Forecast, Map, Radar, Fronts, Quiz.
 *
 * Score components (explicit, consistent, testable):
 *   - certainty  (40%) -- Confirmed > Watch > Estimated > None
 *   - distance   (30%) -- closer is better
 *   - rarity     (20%) -- rarer flavors score higher
 *   - preference (10%) -- bonus for matching user's preferred flavors
 */

import { determineCertaintyTier, certaintyCap, TIERS, tierLabel } from './certainty.js';
import { getReliability } from './reliability.js';
import { getForecastData } from './forecast.js';
import { normalize, matchesFlavor } from './flavor-matcher.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';

// --- Geo utilities ---

const EARTH_RADIUS_MILES = 3958.8;

function normalizeFlavorKey(flavor) {
  return normalize(flavor || '');
}

function buildHistoricalMetricsIndex(seed) {
  const datasetStores = Number(seed?.dataset_summary?.stores || 0);
  const plannerFeatures = seed?.planner_features || {};

  const rawFlavorLookup = plannerFeatures.flavor_lookup || {};
  const rawStoreLookup = plannerFeatures.store_lookup || {};

  const flavorLookup = new Map();
  for (const [key, value] of Object.entries(rawFlavorLookup)) {
    if (!key || !value || typeof value !== 'object') continue;
    flavorLookup.set(String(key), {
      title: String(value.title || ''),
      appearances: Number(value.appearances || 0),
      store_count: Number(value.store_count || 0),
      peak_month: Number(value.peak_month || 0),
      seasonal_concentration: Number(value.seasonal_concentration || 0),
    });
  }

  // Backward-compatible fallback when only top_flavors is present.
  if (flavorLookup.size === 0 && Array.isArray(seed?.top_flavors)) {
    for (const row of seed.top_flavors) {
      const key = normalizeFlavorKey(row?.title);
      if (!key) continue;
      flavorLookup.set(key, {
        title: String(row?.title || ''),
        appearances: Number(row?.appearances || 0),
        store_count: Number(row?.store_count || 0),
        peak_month: Number(row?.peak_month || 0),
        seasonal_concentration: Number(row?.seasonal_concentration || 0),
      });
    }
  }

  const storeLookup = new Map();
  for (const [slug, value] of Object.entries(rawStoreLookup)) {
    if (!slug || !value || typeof value !== 'object') continue;
    storeLookup.set(String(slug), {
      observations: Number(value.observations || 0),
      distinct_flavors: Number(value.distinct_flavors || 0),
      state: String(value.state || ''),
      city: String(value.city || ''),
      top_flavor: String(value.top_flavor || ''),
      top_flavor_count: Number(value.top_flavor_count || 0),
    });
  }

  // Backward-compatible fallback when only top_stores is present.
  if (storeLookup.size === 0 && Array.isArray(seed?.top_stores)) {
    for (const row of seed.top_stores) {
      const slug = String(row?.store_slug || '').trim();
      if (!slug) continue;
      storeLookup.set(slug, {
        observations: Number(row?.observations || 0),
        distinct_flavors: Number(row?.distinct_flavors || 0),
        state: String(row?.state || ''),
        city: String(row?.city || ''),
        top_flavor: String(row?.top_flavor || ''),
        top_flavor_count: Number(row?.top_flavor_count || 0),
      });
    }
  }

  const maxStoreObservations = Number(plannerFeatures.max_store_observations || 0) || Math.max(
    ...[...storeLookup.values()].map((row) => Number(row.observations || 0)),
    0,
  );

  return {
    datasetStores,
    flavorLookup,
    storeLookup,
    maxStoreObservations,
  };
}

const DEFAULT_HISTORICAL_METRICS = buildHistoricalMetricsIndex(TRIVIA_METRICS_SEED);

/**
 * Historical tie-breaker score, intentionally bounded so certainty/distance dominate.
 * Returns 0-0.35 and is fed through the existing rarity score channel.
 */
export function historicalTieBreakerScore({
  flavor,
  slug,
  month = new Date().getUTCMonth() + 1,
  historicalMetrics = DEFAULT_HISTORICAL_METRICS,
}) {
  if (!historicalMetrics) return 0;

  const flavorKey = normalizeFlavorKey(flavor);
  const flavorMeta = historicalMetrics.flavorLookup.get(flavorKey);
  const storeMeta = historicalMetrics.storeLookup.get(String(slug || ''));

  const datasetStores = Math.max(Number(historicalMetrics.datasetStores || 0), 1);
  const maxObs = Math.max(Number(historicalMetrics.maxStoreObservations || 0), 1);

  // Rarer flavors (served at fewer stores) get a higher score.
  const rarity = flavorMeta
    ? Math.max(0, Math.min(1, 1 - (Number(flavorMeta.store_count || 0) / datasetStores)))
    : 0;

  // Seasonal concentration is strongest when in peak month; small residual value otherwise.
  let seasonal = 0;
  if (flavorMeta) {
    const concentration = Math.max(0, Math.min(1, Number(flavorMeta.seasonal_concentration || 0)));
    seasonal = Number(flavorMeta.peak_month) === Number(month) ? concentration : concentration * 0.25;
  }

  // High-observation stores are slightly favored as tie-breakers.
  const depth = storeMeta
    ? Math.max(0, Math.min(1, Number(storeMeta.observations || 0) / maxObs))
    : 0;

  const composite = rarity * 0.5 + seasonal * 0.3 + depth * 0.2;
  return Math.max(0, Math.min(0.35, composite));
}

/**
 * Haversine distance between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in miles
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Scoring ---

/**
 * Score a single recommendation. Pure function, no I/O.
 *
 * @param {Object} opts
 * @param {number} opts.certaintyScore  - From certaintyCap() (0-1)
 * @param {number} opts.distanceMiles   - Distance from user
 * @param {number} opts.maxRadius       - Search radius (for normalization)
 * @param {number} opts.rarityPercentile - 0-1, higher = rarer
 * @param {boolean} opts.preferenceMatch - Whether flavor matches user prefs
 * @returns {number} Composite score (0-1)
 */
export function scoreRecommendation({
  certaintyScore = 0,
  distanceMiles = 0,
  maxRadius = 25,
  rarityPercentile = 0,
  preferenceMatch = false,
}) {
  const distanceNorm = Math.min(distanceMiles / Math.max(maxRadius, 1), 1.0);
  return (
    certaintyScore * 0.4 +
    (1 - distanceNorm) * 0.3 +
    rarityPercentile * 0.2 +
    (preferenceMatch ? 0.1 : 0)
  );
}

// --- Recommendation builder ---

/**
 * Build scored recommendations from assembled data.
 * Pure function -- all data pre-fetched and passed in.
 *
 * @param {Object} opts
 * @param {Array} opts.stores - [{slug, name, address, lat, lon, flavor, description, rank}]
 * @param {number} opts.userLat
 * @param {number} opts.userLon
 * @param {number} opts.maxRadius - Miles
 * @param {Map<string,Object>} opts.reliabilityMap - slug -> reliability record
 * @param {Map<string,Object>} opts.forecastMap - slug -> forecast data
 * @param {string[]} opts.preferredFlavors - User's flavor preferences (optional)
 * @param {Object} opts.historicalMetrics - Historical seed index (optional)
 * @param {number} opts.referenceMonth - 1-12 override for deterministic tests (optional)
 * @returns {Object} { recommendations, alternatives }
 */
export function buildRecommendations({
  stores = [],
  userLat,
  userLon,
  maxRadius = 25,
  reliabilityMap = new Map(),
  forecastMap = new Map(),
  preferredFlavors = [],
  historicalMetrics = DEFAULT_HISTORICAL_METRICS,
  referenceMonth,
}) {
  const prefNorms = preferredFlavors.map((f) => normalize(f));
  const recommendations = [];
  const scoringMonth = Number(referenceMonth) >= 1 && Number(referenceMonth) <= 12
    ? Number(referenceMonth)
    : new Date().getUTCMonth() + 1;

  for (const store of stores) {
    const dist = haversine(userLat, userLon, store.lat, store.lon);
    if (dist > maxRadius) continue;

    const reliability = reliabilityMap.get(store.slug);
    const reliabilityTier = reliability?.reliability_tier || null;

    // Today's confirmed flavor
    if (store.flavor) {
      const tier = determineCertaintyTier({
        hasConfirmed: true,
        reliabilityTier,
      });
      const certaintyScore = certaintyCap(tier);
      const prefMatch =
        prefNorms.length > 0 &&
        prefNorms.some((p) => matchesFlavor(store.flavor, p, store.description));
      const historicalScore = historicalTieBreakerScore({
        flavor: store.flavor,
        slug: store.slug,
        month: scoringMonth,
        historicalMetrics,
      });

      const score = scoreRecommendation({
        certaintyScore,
        distanceMiles: dist,
        maxRadius,
        rarityPercentile: historicalScore,
        preferenceMatch: prefMatch,
      });

      recommendations.push({
        slug: store.slug,
        name: store.name,
        address: store.address,
        flavor: store.flavor,
        description: store.description,
        date: todayStr(),
        distance_miles: Math.round(dist * 10) / 10,
        certainty_tier: tier,
        certainty_label: tierLabel(tier),
        certainty_score: certaintyScore,
        reliability_tier: reliabilityTier,
        preference_match: prefMatch,
        historical_tie_breaker: Math.round(historicalScore * 1000) / 1000,
        score: Math.round(score * 1000) / 1000,
        source: 'confirmed',
        actions: ['directions', 'alert', 'calendar'],
      });
    }

    // Forecast predictions (future days)
    const forecast = forecastMap.get(store.slug);
    if (forecast?.predictions) {
      const forecastAgeHours = forecastAgeInHours(forecast.generated_at);
      for (const pred of forecast.predictions.slice(0, 5)) {
        const tier = determineCertaintyTier({
          hasConfirmed: false,
          hasForecast: true,
          probability: pred.probability || 0,
          historyDepth: forecast.history_depth || 0,
          forecastAgeHours,
          reliabilityTier,
        });
        if (tier === TIERS.NONE) continue;

        const certaintyScore = certaintyCap(tier, pred.probability);
        const prefMatch =
          prefNorms.length > 0 &&
          prefNorms.some((p) => matchesFlavor(pred.flavor, p));
        const historicalScore = historicalTieBreakerScore({
          flavor: pred.flavor,
          slug: store.slug,
          month: scoringMonth,
          historicalMetrics,
        });

        const score = scoreRecommendation({
          certaintyScore,
          distanceMiles: dist,
          maxRadius,
          rarityPercentile: historicalScore,
          preferenceMatch: prefMatch,
        });

        recommendations.push({
          slug: store.slug,
          name: store.name,
          address: store.address,
          flavor: pred.flavor,
          description: '',
          date: forecast.date || null,
          distance_miles: Math.round(dist * 10) / 10,
          certainty_tier: tier,
          certainty_label: tierLabel(tier),
          certainty_score: certaintyScore,
          reliability_tier: reliabilityTier,
          preference_match: prefMatch,
          historical_tie_breaker: Math.round(historicalScore * 1000) / 1000,
          probability: pred.probability,
          score: Math.round(score * 1000) / 1000,
          source: 'forecast',
          actions: ['alert', 'calendar'],
        });
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Top results + alternatives
  const top = recommendations.slice(0, 10);
  const alts = recommendations.slice(10, 20);

  return { recommendations: top, alternatives: alts };
}

// --- Enrichment helpers ---

/**
 * Batch-fetch reliability data for a set of slugs.
 * @param {Object} db - D1 binding
 * @param {string[]} slugs
 * @returns {Promise<Map<string,Object>>}
 */
export async function fetchReliabilityMap(db, slugs) {
  const map = new Map();
  if (!db) return map;

  // Fetch in parallel, swallow individual errors
  const results = await Promise.allSettled(
    slugs.map((slug) => getReliability(db, slug).then((r) => [slug, r]))
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value[1]) {
      map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

/**
 * Batch-fetch forecast data for a set of slugs.
 * @param {Object} env - Worker env bindings
 * @param {string[]} slugs
 * @returns {Promise<Map<string,Object>>}
 */
export async function fetchForecastMap(env, slugs) {
  const map = new Map();
  const results = await Promise.allSettled(
    slugs.map((slug) =>
      getForecastData(slug, env).then((r) => [slug, r?.forecast])
    )
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value[1]) {
      map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

// --- API handler ---

/**
 * Handle GET /api/plan requests.
 *
 * Required params:
 *   location - zip, city, or "lat,lon"
 *
 * Optional params:
 *   radius   - miles (default 25, max 100)
 *   flavors  - comma-separated preferred flavors
 *   limit    - max stores from locator (default 25, max 50)
 *
 * @param {URL} url
 * @param {Object} env
 * @param {Object} corsHeaders
 * @returns {Promise<Response>}
 */
export async function handlePlan(url, env, corsHeaders) {
  const location = url.searchParams.get('location');
  if (!location || !location.trim()) {
    return Response.json(
      { error: 'Missing required "location" parameter. Usage: /api/v1/plan?location=<zip|city|lat,lon>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const radius = Math.min(Math.max(parseFloat(url.searchParams.get('radius')) || 25, 1), 100);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 25, 1), 50);
  const flavorsParam = url.searchParams.get('flavors') || '';
  const preferredFlavors = flavorsParam
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  // Step 1: Get nearby stores from locator API (with today's confirmed flavor)
  const kv = env.FLAVOR_CACHE;
  const cacheKey = `locator:${location.trim().toLowerCase()}:${limit}`;
  let locatorData;

  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    locatorData = JSON.parse(cached);
  } else {
    const locatorUrl = `https://www.culvers.com/api/locator/getLocations?location=${encodeURIComponent(location.trim())}&limit=${limit}`;
    const fetchFn = env._fetchOverride || globalThis.fetch;
    let resp;
    try {
      resp = await fetchFn(locatorUrl);
    } catch {
      return Response.json(
        { error: 'Failed to reach upstream locator API' },
        { status: 502, headers: corsHeaders }
      );
    }
    if (!resp.ok) {
      return Response.json(
        { error: `Upstream locator returned ${resp.status}` },
        { status: 502, headers: corsHeaders }
      );
    }
    locatorData = await resp.json();

    if (kv) {
      try {
        await kv.put(cacheKey, JSON.stringify(locatorData), { expirationTtl: 3600 });
      } catch { /* best-effort */ }
    }
  }

  // Transform into our store format
  const stores = transformLocatorStores(locatorData);
  if (stores.length === 0) {
    return Response.json(
      { query: { location: location.trim(), radius, flavors: preferredFlavors }, recommendations: [], alternatives: [] },
      { headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' } }
    );
  }

  // Resolve user lat/lon from first store (locator returns by proximity)
  const userLat = parseFloat(url.searchParams.get('lat')) || stores[0].lat;
  const userLon = parseFloat(url.searchParams.get('lon')) || stores[0].lon;

  // Step 2: Enrich with reliability + forecast
  const slugs = stores.map((s) => s.slug);
  const [reliabilityMap, forecastMap] = await Promise.all([
    fetchReliabilityMap(env.DB, slugs),
    fetchForecastMap(env, slugs),
  ]);

  // Step 3: Score and rank
  const result = buildRecommendations({
    stores,
    userLat,
    userLon,
    maxRadius: radius,
    reliabilityMap,
    forecastMap,
    preferredFlavors,
  });

  return Response.json(
    {
      query: { location: location.trim(), radius, flavors: preferredFlavors, lat: userLat, lon: userLon },
      ...result,
    },
    {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300',
      },
    }
  );
}

// --- Internal helpers ---

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculate hours since a forecast was generated.
 * @param {string|undefined} generatedAt - ISO timestamp
 * @returns {number|undefined} Hours elapsed, or undefined if no timestamp
 */
function forecastAgeInHours(generatedAt) {
  if (!generatedAt) return undefined;
  const ms = Date.now() - new Date(generatedAt).getTime();
  return ms / (1000 * 60 * 60);
}

/**
 * Transform locator API response into planner store format.
 * Same shape as index.js transformLocatorData but kept local to avoid coupling.
 */
function transformLocatorStores(data) {
  const geofences = data?.data?.geofences || [];
  return geofences.map((g, i) => {
    const meta = g.metadata || {};
    const city = meta.city || '';
    const state = meta.state || '';
    return {
      slug: meta.slug || '',
      name: city && state ? `${city}, ${state}` : city || meta.slug || '',
      address: meta.street || '',
      lat: g.geometryCenter?.coordinates?.[1] || 0,
      lon: g.geometryCenter?.coordinates?.[0] || 0,
      flavor: meta.flavorOfDayName || '',
      description: meta.flavorOfTheDayDescription || '',
      rank: i + 1,
    };
  });
}
