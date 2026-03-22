/**
 * Dynamic social card generator.
 *
 * Generates 1200x630 OG-image-compatible cards for:
 *   - Per-store/date flavor cards:  GET /og/{slug}/{date}.svg   (SVG)
 *   - Per-page static cards:        GET /og/page/{page-slug}.svg (SVG)
 *   - Trivia/Did-you-know cards:    GET /og/trivia/{slug}.svg   (SVG)
 *   - Quiz result cards:            GET /og/quiz/{archetype}/{flavor}.png (PNG)
 *   - Flavor rarity cards:          GET /og/flavor/{flavor-name}.png     (PNG)
 *
 * SVG cards embed L5 AI PNG cones as base64 <image> elements.
 * PNG cards are generated via workers-og (satori + resvg-wasm) so social
 * platforms (Twitter, Facebook, iMessage) can actually render them.
 *
 * Note: SVG og:image is NOT supported by Twitter, Facebook, iMessage, WhatsApp,
 * Discord, or Slack. New quiz/flavor endpoints use .png to ensure actual rendering.
 */

import { normalize } from './flavor-matcher.js';
import { getFlavorProfile, renderConeSVG, BASE_COLORS, CONE_COLORS, TOPPING_COLORS, RIBBON_COLORS } from './flavor-colors.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';
import { ImageResponse } from 'workers-og';

const MONTH_NAMES_TRIVIA = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// PNG cone embedding helpers
// ---------------------------------------------------------------------------

const CONE_PNG_BASE = 'https://custard.chriskaschner.com/assets/cones';

/**
 * Convert a flavor name to a URL-safe slug matching the PNG filename convention.
 * E.g. "Really Reese's" -> "really-reese-s", "Mint Explosion" -> "mint-explosion"
 */
function flavorToSlug(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Fetch a cone PNG from the GitHub Pages CDN and return as base64 string.
 * Returns null on any failure (404, network error, etc.) so callers can fall back.
 */
async function fetchConePngBase64(flavorName) {
  const slug = flavorToSlug(flavorName);
  if (!slug) return null;
  try {
    const resp = await fetch(`${CONE_PNG_BASE}/${slug}.png`);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

/**
 * Render a cone embed element for the social card SVG.
 * Attempts L5 PNG first; falls back to L0 mini SVG cone on failure.
 *
 * @param {string} flavorName
 * @param {number} x - X position in SVG
 * @param {number} y - Y position in SVG
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<string>} SVG markup (<image> or <g> with rects)
 */
async function renderConeEmbed(flavorName, x, y, width, height) {
  const b64 = await fetchConePngBase64(flavorName);
  if (b64) {
    return `<image x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${b64}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  // Fallback: L0 mini SVG cone scaled to fit
  const svg = renderConeSVG(flavorName, Math.round(width / 9));
  const inner = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
  return `<g transform="translate(${x},${y})">${inner}</g>`;
}

// ---------------------------------------------------------------------------
// Trivia card definitions
// ---------------------------------------------------------------------------

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
  scoop: {
    headline: "Today's Top Picks",
    subhead: 'Route-first flavor ranking for your stores, right now.',
    flavorName: 'Lemon Berry Crisp',
  },
  group: {
    headline: 'Where Are We Going?',
    subhead: 'Group vote on today\'s flavors. Let the car decide.',
    flavorName: 'Vanilla',
  },
};

async function renderPageCard({ headline, subhead, flavorName }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const profile = getFlavorProfile(flavorName || '');
  const accentColor = BASE_COLORS[profile.base] || '#005696';
  const coneMarkup = flavorName ? await renderConeEmbed(flavorName, 1000, 100, 150, 175) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect y="0" width="1200" height="8" fill="${accentColor}"/>
  ${coneMarkup}
  <text x="80" y="220" font-size="52" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(headline)}</text>
  <text x="80" y="310" font-size="28" fill="#9EC5E8" font-family="system-ui, -apple-system, sans-serif">${esc(subhead)}</text>
  <text x="80" y="590" font-size="22" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
</svg>`;
}

async function handlePageCard(pageSlug, corsHeaders) {
  const def = PAGE_CARD_DEFS[pageSlug];
  if (!def) {
    return new Response(JSON.stringify({ error: 'Page card not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const svg = await renderPageCard(def);
  return new Response(svg, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

async function renderTriviaCard({ headline, fact, flavorName }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coneMarkup = flavorName ? await renderConeEmbed(flavorName, 1000, 130, 150, 175) : '';
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
  ${coneMarkup}
  <text x="80" y="130" font-size="32" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">Did you know?</text>
  <text x="80" y="220" font-size="52" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(displayHeadline)}</text>
  <text x="80" y="310" font-size="28" fill="#9EC5E8" font-family="system-ui, -apple-system, sans-serif">${esc(fact)}</text>
  <text x="80" y="590" font-size="22" fill="#5E8FC8" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
</svg>`;
}

async function handleTriviaCard(slug, corsHeaders) {
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
  const svg = await renderTriviaCard(cardData);
  return new Response(svg, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ---------------------------------------------------------------------------
// Rarity classification (mirrors rarityLabelFromGapDays in planner-domain.js)
// ---------------------------------------------------------------------------

/**
 * Returns a rarity label given the average gap in days between appearances.
 * Mirrors the client-side logic in docs/planner-domain.js.
 * @param {number|null} avgGapDays
 * @returns {string|null}
 */
function rarityLabel(avgGapDays) {
  const days = Math.round(Number(avgGapDays));
  if (!Number.isFinite(days) || days < 2) return null;
  if (days > 120) return 'Ultra Rare';
  if (days > 60) return 'Rare';
  return null;
}

// ---------------------------------------------------------------------------
// Quiz result OG card (PNG via workers-og)
// Endpoint: GET /og/quiz/{archetype}/{flavor}.png
// ---------------------------------------------------------------------------

/**
 * Render a 1200x630 PNG OG card for a quiz result.
 * Archetype name appears as the headline, flavor name as subhead,
 * cone art is embedded as base64.
 *
 * @param {Object} params
 * @param {string} params.archetypeName  Display name, e.g. "Cool Front"
 * @param {string} params.flavorName     Matched flavor, e.g. "Andes Mint Avalanche"
 * @param {string|null} params.conePngBase64  Pre-fetched cone PNG as base64 (or null)
 * @param {string} params.accentColor    Hex color for accent bar
 * @returns {Promise<Response>} PNG image response
 */
async function renderQuizCardPng({ archetypeName, flavorName, conePngBase64, accentColor }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coneImg = conePngBase64
    ? `<img src="data:image/png;base64,${conePngBase64}" width="150" height="175" style="object-fit:contain;" />`
    : '';
  const html = `
    <div style="display:flex; flex-direction:column; width:1200px; height:630px;
                background:linear-gradient(180deg,#1a1a2e,#16213e); position:relative;">
      <div style="height:8px; background:${esc(accentColor)}; width:100%;"></div>
      <div style="display:flex; flex-direction:row; padding:60px 80px; align-items:center; flex:1;">
        <div style="display:flex; margin-right:40px;">${coneImg}</div>
        <div style="display:flex; flex-direction:column;">
          <div style="font-size:28px; color:#9EC5E8; font-family:sans-serif; margin-bottom:12px;">
            Your custard personality is…
          </div>
          <div style="font-size:60px; font-weight:bold; color:#ffffff; font-family:sans-serif; margin-bottom:16px; line-height:1.1;">
            ${esc(archetypeName)}
          </div>
          <div style="font-size:36px; color:#9EC5E8; font-family:sans-serif; margin-bottom:24px;">
            Matched with: ${esc(flavorName)}
          </div>
          <div style="font-size:22px; color:#4a4a5a; font-family:sans-serif;">
            Take the quiz at custard.chriskaschner.com
          </div>
        </div>
      </div>
    </div>`;
  return new ImageResponse(html, { width: 1200, height: 630 });
}

async function handleQuizCard(archetypeSlug, flavorSlug, corsHeaders) {
  // Validate archetype slug
  const VALID_ARCHETYPES = new Set([
    'cool-front', 'bold-storm', 'steady-classic', 'candy-burst',
    'berry-sunrise', 'caramel-architect', 'cheesecake-signal', 'explorer-jetstream',
  ]);
  if (!VALID_ARCHETYPES.has(archetypeSlug)) {
    return new Response(JSON.stringify({ error: 'Unknown archetype.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Derive display name from slug: cool-front → Cool Front
  const archetypeName = archetypeSlug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Decode flavor name from URL slug
  const flavorName = decodeURIComponent(flavorSlug.replace(/-/g, ' '));

  // Get accent color from flavor profile
  const profile = getFlavorProfile(flavorName);
  const accentColor = BASE_COLORS[profile.base] || '#005696';

  // Pre-fetch cone PNG (best-effort; null triggers text-only fallback)
  const conePngBase64 = await fetchConePngBase64(flavorName);

  const response = await renderQuizCardPng({ archetypeName, flavorName, conePngBase64, accentColor });

  // Return with appropriate headers (ImageResponse is already a Response)
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Flavor rarity OG card (PNG via workers-og)
// Endpoint: GET /og/flavor/{flavor-name}.png
// ---------------------------------------------------------------------------

/**
 * Render a 1200x630 PNG OG card for a flavor's rarity stats.
 * Shows flavor name, rarity label, appearance count, and cone art.
 *
 * @param {Object} params
 * @param {string} params.flavorName        Display name, e.g. "Mint Explosion"
 * @param {string|null} params.rarityTag    Label from rarityLabel() or null
 * @param {number} params.appearances       Total appearance count from D1
 * @param {number} params.avgGapDays        Average gap between appearances
 * @param {string|null} params.conePngBase64 Pre-fetched cone PNG as base64
 * @param {string} params.accentColor       Hex color for accent bar
 * @returns {Promise<Response>} PNG image response
 */
async function renderFlavorRarityCardPng({ flavorName, rarityTag, appearances, avgGapDays, conePngBase64, accentColor }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coneImg = conePngBase64
    ? `<img src="data:image/png;base64,${conePngBase64}" width="150" height="175" style="object-fit:contain;" />`
    : '';

  // Build rarity badge
  const rarityBadge = rarityTag
    ? `<div style="display:inline-flex; background:${esc(accentColor)}; color:#fff; font-size:22px; font-weight:bold;
                   font-family:sans-serif; padding:6px 18px; border-radius:4px; margin-bottom:16px;">
         ${esc(rarityTag)}
       </div>`
    : '';

  // Build stats line
  let statsLine = '';
  if (appearances > 0) {
    statsLine = `<div style="font-size:26px; color:#6c6c80; font-family:sans-serif; margin-top:12px;">
      Seen ${appearances} time${appearances === 1 ? '' : 's'} in our database
    </div>`;
    if (avgGapDays > 0) {
      statsLine += `<div style="font-size:22px; color:#4a4a5a; font-family:sans-serif; margin-top:8px;">
        Appears about every ${Math.round(avgGapDays)} days
      </div>`;
    }
  }

  const html = `
    <div style="display:flex; flex-direction:column; width:1200px; height:630px;
                background:linear-gradient(180deg,#1a1a2e,#16213e);">
      <div style="height:8px; background:${esc(accentColor)}; width:100%;"></div>
      <div style="display:flex; flex-direction:row; padding:60px 80px; align-items:center; flex:1;">
        <div style="display:flex; margin-right:40px;">${coneImg}</div>
        <div style="display:flex; flex-direction:column;">
          <div style="font-size:24px; color:#9EC5E8; font-family:sans-serif; margin-bottom:12px;">
            Flavor Rarity
          </div>
          <div style="font-size:56px; font-weight:bold; color:#ffffff; font-family:sans-serif;
                       margin-bottom:16px; line-height:1.1;">
            ${esc(flavorName)}
          </div>
          ${rarityBadge}
          ${statsLine}
          <div style="font-size:20px; color:#4a4a5a; font-family:sans-serif; margin-top:16px;">
            custard.chriskaschner.com
          </div>
        </div>
      </div>
    </div>`;
  return new ImageResponse(html, { width: 1200, height: 630 });
}

async function handleFlavorCard(flavorSlug, env, corsHeaders) {
  // Decode flavor name from URL slug (reverse of flavorToSlug)
  const flavorName = decodeURIComponent(flavorSlug.replace(/-/g, ' '));
  if (!flavorName.trim()) {
    return new Response(JSON.stringify({ error: 'Missing flavor name.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Look up network-wide stats from D1
  let appearances = 0;
  let avgGapDays = 0;
  const db = env.DB;
  if (db) {
    const normalized = normalize(flavorName);
    try {
      const [countResult, gapResult] = await Promise.all([
        db.prepare('SELECT COUNT(*) as n FROM snapshots WHERE normalized_flavor = ?')
          .bind(normalized).first(),
        db.prepare(
          'SELECT AVG(gap_days) as avg_gap FROM (' +
          '  SELECT slug, julianday(date) - julianday(lag(date) OVER (PARTITION BY slug ORDER BY date)) AS gap_days' +
          '  FROM snapshots WHERE normalized_flavor = ?' +
          ') WHERE gap_days IS NOT NULL'
        ).bind(normalized).first(),
      ]);
      appearances = countResult?.n || 0;
      avgGapDays = gapResult?.avg_gap || 0;
    } catch {
      // Stats unavailable — card still renders without them
    }
  }

  const rarityTag = rarityLabel(avgGapDays);
  const profile = getFlavorProfile(flavorName);
  const accentColor = BASE_COLORS[profile.base] || '#005696';
  const conePngBase64 = await fetchConePngBase64(flavorName);

  const response = await renderFlavorRarityCardPng({
    flavorName,
    rarityTag,
    appearances,
    avgGapDays,
    conePngBase64,
    accentColor,
  });

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(response.body, {
    status: response.status,
    headers,
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
  // Match /og/quiz/{archetype-slug}/{flavor-slug}.png -- quiz result PNG cards
  const quizMatch = path.match(/^\/og\/quiz\/([\w-]+)\/(.+)\.png$/);
  if (quizMatch) return handleQuizCard(quizMatch[1], quizMatch[2], corsHeaders);

  // Match /og/flavor/{flavor-slug}.png -- flavor rarity PNG cards
  const flavorMatch = path.match(/^\/og\/flavor\/(.+)\.png$/);
  if (flavorMatch) return handleFlavorCard(flavorMatch[1], env, corsHeaders);

  // Match /og/page/{slug}.svg -- page-level static cards
  const pageMatch = path.match(/^\/og\/page\/([\w-]+)\.svg$/);
  if (pageMatch) return handlePageCard(pageMatch[1], corsHeaders);

  // Match /og/trivia/{slug}.svg -- must be checked before the store/date pattern
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
      // Metrics unavailable -- card still works without them
    }
  }

  // Format store name from slug
  const storeName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Format date display
  const dateObj = new Date(date + 'T12:00:00Z');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateDisplay = `${dayNames[dateObj.getUTCDay()]}, ${monthNames[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}`;

  const svg = await renderCard({
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
 * Render a 1200x630 SVG social card with L5 PNG cone art.
 */
async function renderCard({ flavor, storeName, dateDisplay, appearances, storeCount }) {
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

  // Embed L5 PNG cone (or L0 SVG fallback)
  const coneMarkup = await renderConeEmbed(flavor, 50, 120, 150, 175);

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

  <!-- Cone art (L5 PNG or L0 SVG fallback) -->
  ${coneMarkup}

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
