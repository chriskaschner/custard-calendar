/**
 * Dynamic SVG social card generator.
 *
 * Generates 1200x630 OG-image-compatible SVG cards for:
 *   - Per-store/date flavor cards:  GET /og/{slug}/{date}.svg
 *   - Per-page static cards:        GET /og/page/{page-slug}.svg
 *   - Trivia/Did-you-know cards:    GET /og/trivia/{slug}.svg
 *
 * All cards embed pixel-art cones colored to the flavor profile.
 */

import { normalize } from './flavor-matcher.js';
import { getFlavorProfile, renderConeHDSVG, BASE_COLORS, CONE_COLORS, TOPPING_COLORS, RIBBON_COLORS } from './flavor-colors.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';

const MONTH_NAMES_TRIVIA = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TRIVIA_CARD_DEFS = {
  'top-flavor': (seed) => {
    const top = seed?.top_flavors?.[0];
    if (!top || typeof top.title !== 'string') return null;
    return {
      headline: `${top.title} is the most-served flavor`,
      fact: `Appeared across ${top.store_count || 'hundreds of'} tracked stores in our database.`,
      flavorName: top.title,
    };
  },
  'rarest-flavor': (seed) => {
    const spotlights = Array.isArray(seed?.seasonal_spotlights) ? seed.seasonal_spotlights : [];
    const total = Number(seed?.dataset_summary?.rows) || 0;
    if (spotlights.length === 0) return null;
    const rarest = [...spotlights]
      .filter((s) => typeof s?.title === 'string')
      .sort((a, b) => Number(a.appearances || 0) - Number(b.appearances || 0))[0];
    if (!rarest) return null;
    const pct = total > 0 ? ((Number(rarest.appearances || 0) / total) * 100).toFixed(2) : null;
    return {
      headline: `${rarest.title} is one of our rarest tracked flavors`,
      fact: pct ? `Appears less than ${pct}% of the time in our full database.` : 'One of the rarest flavors in our historical data.',
      flavorName: rarest.title,
    };
  },
  'hnbc-season': (seed) => {
    const hnbc = seed?.hnbc;
    if (!hnbc?.by_month || typeof hnbc.by_month !== 'object') return null;
    const entries = Object.entries(hnbc.by_month)
      .map(([m, c]) => ({ month: Number(m), count: Number(c) }))
      .filter((e) => Number.isFinite(e.month) && e.month >= 1 && e.month <= 12)
      .sort((a, b) => b.count - a.count);
    if (entries.length === 0) return null;
    const monthName = MONTH_NAMES_TRIVIA[entries[0].month] || 'Unknown';
    return {
      headline: 'Hot-N-Buffalo Chicken Custard has a season',
      fact: `Appears most often in ${monthName} in our historical database.`,
      flavorName: null,
    };
  },
  'top-store': (seed) => {
    const top = seed?.top_stores?.[0];
    if (!top || typeof top.store_slug !== 'string') return null;
    const storeName = top.city && top.state ? `${top.city}, ${top.state}` : top.store_slug;
    return {
      headline: `${storeName} leads in tracked flavor days`,
      fact: 'More historical flavor observations than any other store in our database.',
      flavorName: top.top_flavor || null,
    };
  },
};

// ---------------------------------------------------------------------------
// Page-level OG cards
// One card per site page: /og/page/{slug}.svg
// ---------------------------------------------------------------------------

const PAGE_CARD_DEFS = {
  forecast: {
    headline: "Today's Flavor Forecast",
    subhead: 'Live schedules from six Wisconsin custard brands.',
    flavorName: 'Turtle',
  },
  calendar: {
    headline: 'Subscribe to Your Store',
    subhead: 'Daily updates in Google, Apple, or any .ics client.',
    flavorName: 'Vanilla',
  },
  alerts: {
    headline: 'Never Miss Your Favorite',
    subhead: 'Email alerts when your flavor hits the schedule.',
    flavorName: 'Mint Explosion',
  },
  map: {
    headline: 'Find Your Nearest Flavor',
    subhead: 'Confirmed schedules on an interactive store map.',
    flavorName: 'Caramel Cashew',
  },
  quiz: {
    headline: 'Find Your Custard Match',
    subhead: 'Six quiz modes matched to today\'s live schedule.',
    flavorName: "Really Reese's",
  },
  radar: {
    headline: 'Scan for Nearby Flavors',
    subhead: 'Nearby flavors ranked by distance, right now.',
    flavorName: 'Chocolate Volcano',
  },
  siri: {
    headline: "Ask Siri What's Scooping",
    subhead: 'Siri Shortcut for hands-free flavor checks.',
    flavorName: 'Butter Pecan',
  },
  widget: {
    headline: "Today's Flavor at a Glance",
    subhead: "Today's flavor, right on your iOS home screen.",
    flavorName: 'Dark Chocolate Decadence',
  },
  fronts: {
    headline: 'Track Flavor Fronts',
    subhead: 'Regional flavor patterns visualized as weather fronts.',
    flavorName: 'Blackberry Cobbler',
  },
};

function renderPageCard({ headline, subhead, flavorName }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const profile = getFlavorProfile(flavorName || '');
  const accentColor = BASE_COLORS[profile.base] || '#005696';
  const coneGroup = flavorName ? renderConeGroup(flavorName, 1050, 130, 6) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect y="0" width="1200" height="8" fill="${accentColor}"/>
  ${coneGroup}
  <text x="80" y="220" font-size="52" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(headline)}</text>
  <text x="80" y="310" font-size="28" fill="#9EC5E8" font-family="system-ui, -apple-system, sans-serif">${esc(subhead)}</text>
  <text x="80" y="590" font-size="22" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
</svg>`;
}

function handlePageCard(pageSlug, corsHeaders) {
  const def = PAGE_CARD_DEFS[pageSlug];
  if (!def) {
    return new Response(JSON.stringify({ error: 'Page card not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const svg = renderPageCard(def);
  return new Response(svg, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

function renderTriviaCard({ headline, fact, flavorName }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coneGroup = flavorName ? renderConeGroup(flavorName, 1050, 160, 6) : '';
  const maxLen = 52;
  const displayHeadline = headline.length > maxLen ? headline.slice(0, maxLen - 1) + '\u2026' : headline;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#003A6B"/>
      <stop offset="100%" stop-color="#005696"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect y="0" width="1200" height="8" fill="#9EC5E8"/>
  ${coneGroup}
  <text x="80" y="130" font-size="32" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">Did you know?</text>
  <text x="80" y="220" font-size="52" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(displayHeadline)}</text>
  <text x="80" y="310" font-size="28" fill="#9EC5E8" font-family="system-ui, -apple-system, sans-serif">${esc(fact)}</text>
  <text x="80" y="590" font-size="22" fill="#5E8FC8" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
</svg>`;
}

function handleTriviaCard(slug, corsHeaders) {
  const def = TRIVIA_CARD_DEFS[slug];
  if (!def) {
    return new Response(JSON.stringify({ error: 'Trivia card not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const cardData = def(TRIVIA_METRICS_SEED);
  if (!cardData) {
    return new Response(JSON.stringify({ error: 'Seed data unavailable for this card.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const svg = renderTriviaCard(cardData);
  return new Response(svg, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Route handler for social card requests.
 * @param {string} path - Canonical path (already normalized from /api/ prefix)
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response|null>} Response if matched, null otherwise
 */
export async function handleSocialCard(path, env, corsHeaders) {
  // Match /og/page/{slug}.svg — page-level static cards
  const pageMatch = path.match(/^\/og\/page\/([\w-]+)\.svg$/);
  if (pageMatch) return handlePageCard(pageMatch[1], corsHeaders);

  // Match /og/trivia/{slug}.svg — must be checked before the store/date pattern
  const triviaMatch = path.match(/^\/og\/trivia\/([\w-]+)\.svg$/);
  if (triviaMatch) return handleTriviaCard(triviaMatch[1], corsHeaders);

  // Match /og/{slug}/{date}.svg
  const match = path.match(/^\/og\/([a-z0-9][a-z0-9_-]+)\/(\d{4}-\d{2}-\d{2})\.svg$/);
  if (!match) return null;

  const [, slug, date] = match;
  const db = env.DB;

  // Look up flavor from D1 snapshot.
  let flavor = null;
  if (db) {
    try {
      const snap = await db.prepare(
        'SELECT flavor FROM snapshots WHERE slug = ? AND date = ? LIMIT 1'
      ).bind(slug, date).first();
      if (snap) {
        flavor = snap.flavor || null;
      }
    } catch {
      // Snapshot lookup is best-effort; render fallback card on query failure.
    }
  }

  // Look up metrics from D1 if available
  let appearances = 0;
  let storeCount = 0;
  if (db && flavor) {
    const normalized = normalize(flavor);
    try {
      const [freqResult, storeResult] = await Promise.all([
        db.prepare('SELECT COUNT(*) as n FROM snapshots WHERE normalized_flavor = ?')
          .bind(normalized).first(),
        db.prepare('SELECT COUNT(DISTINCT slug) as n FROM snapshots WHERE normalized_flavor = ?')
          .bind(normalized).first(),
      ]);
      appearances = freqResult?.n || 0;
      storeCount = storeResult?.n || 0;
    } catch {
      // Metrics unavailable — card still works without them
    }
  }

  // Format store name from slug
  const storeName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Format date display
  const dateObj = new Date(date + 'T12:00:00Z');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateDisplay = `${dayNames[dateObj.getUTCDay()]}, ${monthNames[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}`;

  const svg = renderCard({
    flavor: flavor || 'No flavor data',
    storeName,
    dateDisplay,
    appearances,
    storeCount,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Render a pixel-art cone SVG group for embedding in the social card.
 * Extracts the inner SVG content from renderConeSVG and wraps it in a <g>.
 */
function renderConeGroup(flavorName, x, y, scale) {
  const svg = renderConeHDSVG(flavorName, scale);
  // Extract inner content between <svg...> and </svg>
  const inner = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
  return `<g transform="translate(${x},${y})">${inner}</g>`;
}

/**
 * Render a 1200x630 SVG social card.
 */
function renderCard({ flavor, storeName, dateDisplay, appearances, storeCount }) {
  // Escape XML special characters
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build metrics line if data available
  let metricsLine = '';
  if (appearances > 0) {
    const parts = [];
    parts.push(`Seen ${appearances} time${appearances === 1 ? '' : 's'}`);
    if (storeCount > 1) {
      parts.push(`at ${storeCount} stores`);
    }
    metricsLine = parts.join(' ');
  }

  // Truncate long flavor names
  const maxFlavorLen = 30;
  const displayFlavor = flavor.length > maxFlavorLen
    ? flavor.slice(0, maxFlavorLen - 1) + '\u2026'
    : flavor;

  // Get flavor base color for accent bar
  const profile = getFlavorProfile(flavor);
  const accentColor = BASE_COLORS[profile.base] || '#e94560';

  // Render HD pixel-art cone (scale=6 -> 108x132 pixels)
  const coneGroup = renderConeGroup(flavor, 70, 160, 6);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Accent bar (tinted to flavor base color) -->
  <rect y="0" width="1200" height="8" fill="${accentColor}"/>

  <!-- Pixel-art cone -->
  ${coneGroup}

  <!-- Flavor name -->
  <text x="280" y="240" font-size="64" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(displayFlavor)}</text>

  <!-- Store name -->
  <text x="280" y="310" font-size="36" fill="#a8a8b3" font-family="system-ui, -apple-system, sans-serif">${esc(storeName)}</text>

  <!-- Date -->
  <text x="280" y="370" font-size="32" fill="${accentColor}" font-family="system-ui, -apple-system, sans-serif">${esc(dateDisplay)}</text>

  <!-- Metrics -->
  ${metricsLine ? `<text x="280" y="430" font-size="28" fill="#6c6c80" font-family="system-ui, -apple-system, sans-serif">${esc(metricsLine)}</text>` : ''}

  <!-- Branding -->
  <text x="100" y="580" font-size="24" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
  <text x="1100" y="580" font-size="24" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif" text-anchor="end">Custard Calendar</text>
</svg>`;
}
