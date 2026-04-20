import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { STORE_COORDS as DEFAULT_STORE_COORDS } from './store-coords.js';
import { isValidSlug } from './slug-validation.js';
import { getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';

const CACHE_MAX_AGE = 3600; // 1 hour

/**
 * Madison-metro launch slugs -- the initial set of stores getting SEO landing pages.
 * Start small, prove indexing works, then scale.
 */
export const LAUNCH_SLUGS = new Set([
  'cottage-grove-wi-landmark-dr', 'cross-plains', 'deforest',
  'madison-cottage-grove', 'madison-east-towne', 'madison-northport',
  'madison-todd-drive', 'madison-wi-mineral-point-rd', 'mcfarland',
  'middleton', 'mt-horeb', 'oregon-park-st', 'sauk-city',
  'sun-prairie', 'sun-prairie-oxford-place', 'verona', 'waunakee',
]);

// URL path pattern: /store/{state}/{city}/{slug}/
const STORE_PATH_RE = /^\/store\/([a-z]{2})\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/;

/**
 * Handle /store/{state}/{city}/{slug}/ requests.
 * Returns a fully rendered HTML page with today's flavor, week-ahead schedule,
 * store address, and FastFoodRestaurant JSON-LD structured data.
 */
export async function handleStorePage(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
  const isOverride = fetchFlavorsFn !== defaultFetchFlavors;
  const validSlugs = env._validSlugsOverride || DEFAULT_VALID_SLUGS;
  const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
  const storeCoords = env._storeCoordsOverride || DEFAULT_STORE_COORDS;

  // Parse URL path
  const match = url.pathname.match(STORE_PATH_RE);
  if (!match) {
    return errorPage(404, 'Page not found', 'The URL format is not recognized.', corsHeaders);
  }

  const [, urlState, urlCity, slug] = match;

  // Validate slug is in the launch set
  if (!LAUNCH_SLUGS.has(slug)) {
    return errorPage(404, 'Store not found', 'This store does not have a landing page yet.', corsHeaders);
  }

  // Look up store metadata
  const storeEntry = storeIndex.find(s => s.slug === slug);
  if (!storeEntry) {
    return errorPage(404, 'Store not found', 'Store metadata not available.', corsHeaders);
  }

  // Validate city in URL matches the store's actual city
  const expectedCity = slugifyCity(storeEntry.city);
  if (urlCity !== expectedCity) {
    return errorPage(404, 'Store not found', 'The city in the URL does not match this store.', corsHeaders);
  }

  // Validate state in URL matches
  if (urlState !== storeEntry.state.toLowerCase()) {
    return errorPage(404, 'Store not found', 'The state in the URL does not match this store.', corsHeaders);
  }

  // Get coordinates and address
  const coords = storeCoords.get(slug);
  const address = coords ? coords.address : '';
  const lat = coords ? coords.lat : null;
  const lng = coords ? coords.lng : null;

  // Fetch flavor data
  let data;
  try {
    data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
  } catch (err) {
    return errorPage(502, 'Temporarily unavailable',
      'We could not load flavor data for this store. Please try again shortly.', corsHeaders);
  }

  const brand = getBrandForSlug(slug);
  const today = new Date().toISOString().slice(0, 10);

  // Find today's flavor
  const todayFlavors = data.flavors.filter(f => f.date === today);
  if (todayFlavors.length === 0) {
    const firstDate = data.flavors[0]?.date;
    if (firstDate) todayFlavors.push(...data.flavors.filter(f => f.date === firstDate));
  }
  const todayFlavor = todayFlavors[0] || null;

  // Future flavors for the week-ahead schedule
  const futureFlavors = data.flavors
    .filter(f => f.date && todayFlavor && f.date > todayFlavor.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const storeName = `${brand} of ${storeEntry.city}`;
  const flavorName = todayFlavor ? todayFlavor.title : 'No flavor listed';
  const flavorDesc = todayFlavor ? (todayFlavor.description || '') : '';
  const flavorSlug = flavorToSlug(flavorName);
  const coneImgUrl = `https://custard.chriskaschner.com/assets/cones/${flavorSlug}.png`;

  // Canonical URL for this page
  const canonicalUrl = `https://custard.chriskaschner.com/store/${storeEntry.state.toLowerCase()}/${slugifyCity(storeEntry.city)}/${slug}/`;

  const pageTitle = `Today's Flavor at ${storeName} | Custard Calendar`;
  const pageDescription = todayFlavor
    ? `Today's Flavor of the Day at ${storeName} is ${escapeHtml(flavorName)}. ${escapeHtml(flavorDesc)}`
    : `Check today's Flavor of the Day at ${storeName}.`;

  // Build JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FastFoodRestaurant',
    'name': storeName,
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': address,
      'addressLocality': storeEntry.city,
      'addressRegion': storeEntry.state,
      'addressCountry': 'US',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': lat,
      'longitude': lng,
    },
    'url': canonicalUrl,
  };

  if (todayFlavor) {
    jsonLd.hasMenu = {
      '@type': 'Menu',
      'hasMenuSection': {
        '@type': 'MenuSection',
        'name': 'Flavor of the Day',
        'hasMenuItem': {
          '@type': 'MenuItem',
          'name': todayFlavor.title,
          'description': todayFlavor.description || '',
        },
      },
    };
  }

  // Build schedule HTML
  let scheduleHtml = '';
  if (futureFlavors.length > 0) {
    scheduleHtml = `
    <h2>This Week</h2>
    <ul class="schedule">
      ${futureFlavors.map(f => `<li><span>${escapeHtml(formatWeekday(f.date))}</span><span>${escapeHtml(f.title)}</span></li>`).join('\n      ')}
    </ul>`;
  }

  // Build Google Maps link
  const mapsLink = lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : '#';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 16px; color: #1a1a1a; }
    .hero { background: #005696; color: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .flavor-name { font-size: 1.5rem; font-weight: 700; margin: 0 0 8px; }
    .flavor-desc { font-size: 1rem; opacity: 0.9; margin: 0; }
    .cone-img { width: 120px; height: auto; display: block; margin: 16px auto; }
    .schedule { list-style: none; padding: 0; }
    .schedule li { padding: 12px 0; border-bottom: 1px solid #e5e5e5; display: flex; justify-content: space-between; }
    .store-info { background: #f5f5f5; border-radius: 8px; padding: 16px; margin-top: 24px; }
    .store-info a { color: #005696; }
    .footer { text-align: center; margin-top: 32px; padding: 16px 0; color: #666; font-size: 0.875rem; }
    .footer a { color: #005696; }
  </style>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <div class="hero">
    <p class="flavor-name">${escapeHtml(flavorName)}</p>
    <p class="flavor-desc">${escapeHtml(flavorDesc)}</p>
    <img class="cone-img" src="${escapeHtml(coneImgUrl)}" alt="${escapeHtml(flavorName)} cone" loading="lazy">
  </div>
  ${scheduleHtml}
  <div class="store-info">
    <p><strong>${escapeHtml(storeName)}</strong></p>
    <p>${escapeHtml(address)}</p>
    <p>${escapeHtml(storeEntry.city)}, ${escapeHtml(storeEntry.state)}</p>
    <p><a href="${escapeHtml(mapsLink)}" target="_blank" rel="noopener">Open in Google Maps</a></p>
  </div>
  <div class="footer">
    <p>Powered by <a href="https://custard.chriskaschner.com">Custard Calendar</a></p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
    },
  });
}

// --- Helpers ---

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyCity(city) {
  return String(city || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function flavorToSlug(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatWeekday(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Render an error page with a user-friendly message. Never exposes internal details.
 */
function errorPage(status, heading, message, corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(heading)} | Custard Calendar</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 16px; color: #1a1a1a; text-align: center; }
    h1 { color: #005696; margin-top: 48px; }
    p { color: #666; }
    a { color: #005696; }
  </style>
</head>
<body>
  <h1>${escapeHtml(heading)}</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="https://custard.chriskaschner.com">Back to Custard Calendar</a></p>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
