import { generateIcs } from './ics-generator.js';
import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { isValidSlug } from './slug-validation.js';
import { getFetcherForSlug, getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';

const CACHE_MAX_AGE = 3600; // 1 hour (browser + edge cache)
const MAX_SECONDARY = 3;

/**
 * Generate fallback flavor events when scraping fails for a store.
 * @param {string} slug
 * @param {string[]} [dates] - dates to cover (defaults to today)
 */
function makeFallbackFlavors(slug, dates) {
  const { url, brand } = getFetcherForSlug(slug);
  if (!dates || dates.length === 0) {
    dates = [new Date().toISOString().slice(0, 10)];
  }
  return {
    name: slug,
    address: '',
    flavors: dates.map(date => ({
      date,
      title: `See ${brand} website for today's flavor`,
      description: `Visit ${url}`,
    })),
  };
}

/**
 * Handle /calendar.ics requests.
 */
export async function handleCalendar(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
  // When a custom fetcher is passed (testing), it overrides all brand routing
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
  // Resolve the valid slugs set (allow test override)
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;

  // Parse and validate query params
  const primarySlug = url.searchParams.get('primary');
  if (!primarySlug) {
    return Response.json(
      { error: 'Missing required "primary" parameter. Usage: /calendar.ics?primary=<store-slug>' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate primary slug
  const primaryCheck = isValidSlug(primarySlug, validSlugs);
  if (!primaryCheck.valid) {
    return Response.json(
      { error: `Invalid primary store: ${primaryCheck.reason}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const secondarySlugs = url.searchParams.get('secondary')
    ? url.searchParams.get('secondary').split(',').filter(Boolean)
    : [];

  if (secondarySlugs.length > MAX_SECONDARY) {
    return Response.json(
      { error: `Too many secondary stores. Maximum ${MAX_SECONDARY} allowed.` },
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate all secondary slugs
  for (const slug of secondarySlugs) {
    const check = isValidSlug(slug, validSlugs);
    if (!check.valid) {
      return Response.json(
        { error: `Invalid secondary store "${slug}": ${check.reason}` },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // Fetch flavor data for all stores (with per-store fallback)
  const stores = [];
  const flavorsBySlug = {};

  // Fetch primary — use fallback on failure
  try {
    const primaryData = await getFlavorsCached(primarySlug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
    const brandUrl = getFetcherForSlug(primarySlug, fetchFlavorsFn).url;
    stores.push({ slug: primarySlug, name: primaryData.name, address: primaryData.address || '', url: brandUrl, role: 'primary' });
    flavorsBySlug[primarySlug] = primaryData.flavors;
  } catch (err) {
    const fallback = makeFallbackFlavors(primarySlug);
    stores.push({ slug: primarySlug, name: fallback.name, address: '', url: getFetcherForSlug(primarySlug).url, role: 'primary' });
    flavorsBySlug[primarySlug] = fallback.flavors;
  }

  // Collect primary dates for secondary fallback coverage
  const primaryDates = (flavorsBySlug[primarySlug] || []).map(f => f.date);

  // Fetch secondaries — use fallback on failure
  for (const slug of secondarySlugs) {
    try {
      const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
      const brandUrl = getFetcherForSlug(slug, fetchFlavorsFn).url;
      stores.push({ slug, name: data.name, address: data.address || '', url: brandUrl, role: 'secondary' });
      flavorsBySlug[slug] = data.flavors;
    } catch (err) {
      const fallback = makeFallbackFlavors(slug, primaryDates);
      stores.push({ slug, name: fallback.name, address: '', url: getFetcherForSlug(slug).url, role: 'secondary' });
      flavorsBySlug[slug] = fallback.flavors;
    }
  }

  // Generate .ics with brand-aware calendar name
  const primaryBrand = getBrandForSlug(primarySlug);
  const calendarName = `${primaryBrand} FOTD - ${stores[0].name}`;
  const ics = generateIcs({ calendarName, stores, flavorsBySlug });

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      'Content-Disposition': 'inline; filename="custard-calendar.ics"',
    },
  });
}
