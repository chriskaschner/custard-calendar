import { matchesFlavor, findSimilarFlavors, normalize } from './flavor-matcher.js';
import { safeKvPut } from './kv-cache.js';

const LOCATOR_CACHE_TTL = 3600; // 1 hour
const NEARBY_CACHE_MAX_AGE = 3600; // 1 hour

/**
 * Transform Culver's locator API response into our store format.
 * The locator API returns geofences with restaurant details.
 * @param {Object} data - Raw locator API response
 * @returns {Array<{slug: string, name: string, address: string, lat: number, lon: number, flavor: string, description: string, rank: number}>}
 */
function transformLocatorData(data) {
  const geofences = data?.data?.geofences || [];
  return geofences.map((g, i) => {
    const meta = g.metadata || {};
    const slug = meta.slug || '';
    const city = meta.city || '';
    const state = meta.state || '';
    const street = meta.street || '';
    return {
      slug,
      name: city && state ? `${city}, ${state}` : city || slug,
      address: street,
      lat: g.geometryCenter?.coordinates?.[1] || 0,
      lon: g.geometryCenter?.coordinates?.[0] || 0,
      flavor: meta.flavorOfDayName || '',
      description: meta.flavorOfTheDayDescription || '',
      rank: i + 1,
    };
  });
}

/**
 * Handle /api/nearby-flavors?location=<zip>&flavor=<name>&limit=<n> requests.
 * Proxies to Culver's locator API server-side (bypasses CORS), caches in KV,
 * and optionally filters/ranks by flavor match + similarity.
 */
export async function handleApiNearbyFlavors(url, env, corsHeaders) {
  const location = url.searchParams.get('location');
  if (!location || !location.trim()) {
    return Response.json(
      { error: 'Missing required "location" parameter. Usage: /api/nearby-flavors?location=<zip|city|lat,lon>' },
      { status: 400, headers: corsHeaders }
    );
  }

  const flavorQuery = url.searchParams.get('flavor') || '';
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 50, 1), 100);

  // Check KV cache for this location+limit combo
  const kv = env.FLAVOR_CACHE;
  const cacheKey = `locator:${location.trim().toLowerCase()}:${limit}`;
  let locatorData;

  const cached = kv ? await kv.get(cacheKey) : null;
  if (cached) {
    locatorData = JSON.parse(cached);
  } else {
    // Fetch from Culver's locator API
    const locatorUrl = `https://www.culvers.com/api/locator/getLocations?location=${encodeURIComponent(location.trim())}&limit=${limit}`;
    let resp;
    const fetchFn = env._fetchOverride || globalThis.fetch;
    try {
      resp = await fetchFn(locatorUrl);
    } catch (err) {
      return Response.json(
        { error: 'Failed to reach upstream locator API. Please try again later.' },
        { status: 502, headers: corsHeaders }
      );
    }

    if (!resp.ok) {
      return Response.json(
        { error: `Culver's locator API returned ${resp.status}` },
        { status: 502, headers: corsHeaders }
      );
    }

    locatorData = await resp.json();

    // Cache in KV (best-effort)
    await safeKvPut(kv, cacheKey, JSON.stringify(locatorData), {
      expirationTtl: LOCATOR_CACHE_TTL,
    });
  }

  // Transform locator response into our format
  const stores = transformLocatorData(locatorData);

  // Build response
  const allFlavorsToday = [...new Set(stores.map(s => s.flavor).filter(Boolean))].sort();
  let matches = [];
  let nearby = [];
  let suggestions = [];

  if (flavorQuery.trim()) {
    for (const store of stores) {
      if (matchesFlavor(store.flavor, flavorQuery, store.description)) {
        matches.push(store);
      } else {
        nearby.push(store);
      }
    }

    // Build suggestions from similarity groups
    const similarNormalized = findSimilarFlavors(flavorQuery, allFlavorsToday);
    const suggestionMap = new Map();

    for (const normName of similarNormalized) {
      // Find the original-cased name from stores
      for (const store of nearby) {
        if (normalize(store.flavor) === normName) {
          if (!suggestionMap.has(normName)) {
            suggestionMap.set(normName, { flavor: store.flavor, count: 0, closest_rank: Infinity });
          }
          const entry = suggestionMap.get(normName);
          entry.count++;
          entry.closest_rank = Math.min(entry.closest_rank, store.rank);
          break; // only need one for the name
        }
      }
      // Count additional stores
      if (suggestionMap.has(normName)) {
        const entry = suggestionMap.get(normName);
        entry.count = nearby.filter(s => normalize(s.flavor) === normName).length;
        entry.closest_rank = Math.min(...nearby.filter(s => normalize(s.flavor) === normName).map(s => s.rank));
      }
    }

    suggestions = [...suggestionMap.values()].sort((a, b) => a.closest_rank - b.closest_rank);
  } else {
    // No flavor filter — all stores go in nearby
    nearby = stores;
  }

  return Response.json({
    query: { location: location.trim(), flavor: flavorQuery.trim() || null },
    matches,
    nearby,
    suggestions,
    all_flavors_today: allFlavorsToday,
  }, {
    headers: {
      ...corsHeaders,
      'Cache-Control': `public, max-age=${NEARBY_CACHE_MAX_AGE}`,
    },
  });
}
