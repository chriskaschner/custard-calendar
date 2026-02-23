/**
 * Dynamic SVG social card generator.
 *
 * Generates 1200×630 OG-image-compatible SVG cards for individual
 * store/date combos. Cards show the flavor name, store, and metrics
 * (frequency, streak) when available from D1.
 *
 * Endpoint: GET /v1/og/{slug}/{date}.svg
 */

/**
 * Route handler for social card requests.
 * @param {string} path - Canonical path (already normalized from /api/ prefix)
 * @param {Object} env - Worker env bindings
 * @param {Object} corsHeaders
 * @returns {Promise<Response|null>} Response if matched, null otherwise
 */
export async function handleSocialCard(path, env, corsHeaders) {
  // Match /og/{slug}/{date}.svg
  const match = path.match(/^\/og\/([a-z0-9][a-z0-9_-]+)\/(\d{4}-\d{2}-\d{2})\.svg$/);
  if (!match) return null;

  const [, slug, date] = match;
  const db = env.DB;

  // Look up flavor from D1 snapshot.
  let flavor = null;
  let description = '';
  if (db) {
    try {
      const snap = await db.prepare(
        'SELECT flavor, description FROM snapshots WHERE slug = ? AND date = ? LIMIT 1'
      ).bind(slug, date).first();
      if (snap) {
        flavor = snap.flavor || null;
        description = snap.description || '';
      }
    } catch {
      // Snapshot lookup is best-effort; render fallback card on query failure.
    }
  }

  // Look up metrics from D1 if available
  let appearances = 0;
  let storeCount = 0;
  if (db && flavor) {
    const normalized = flavor.toLowerCase()
      .replace(/\u00ae/g, '').replace(/\u2122/g, '').replace(/\u00a9/g, '')
      .replace(/\s+/g, ' ').trim();
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
 * Render a 1200×630 SVG social card.
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Accent bar -->
  <rect y="0" width="1200" height="8" fill="#e94560"/>

  <!-- Ice cream cone emoji (text) -->
  <text x="100" y="280" font-size="120" font-family="sans-serif">🍦</text>

  <!-- Flavor name -->
  <text x="280" y="240" font-size="64" font-weight="bold" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(displayFlavor)}</text>

  <!-- Store name -->
  <text x="280" y="310" font-size="36" fill="#a8a8b3" font-family="system-ui, -apple-system, sans-serif">${esc(storeName)}</text>

  <!-- Date -->
  <text x="280" y="370" font-size="32" fill="#e94560" font-family="system-ui, -apple-system, sans-serif">${esc(dateDisplay)}</text>

  <!-- Metrics -->
  ${metricsLine ? `<text x="280" y="430" font-size="28" fill="#6c6c80" font-family="system-ui, -apple-system, sans-serif">${esc(metricsLine)}</text>` : ''}

  <!-- Branding -->
  <text x="100" y="580" font-size="24" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif">custard.chriskaschner.com</text>
  <text x="1100" y="580" font-size="24" fill="#4a4a5a" font-family="system-ui, -apple-system, sans-serif" text-anchor="end">Custard Calendar</text>
</svg>`;
}
