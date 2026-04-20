/**
 * Sitemap XML and robots.txt generators for SEO landing pages.
 *
 * GET /sitemap.xml  -- XML sitemap listing all launch store page URLs (24h cache)
 * GET /robots.txt   -- Crawl directives allowing /store/ paths, blocking /api/ (24h cache)
 *
 * Both endpoints are static (no KV reads, no upstream fetches) and can be
 * served at the edge with aggressive caching.
 */

import { LAUNCH_SLUGS } from './route-store-page.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';

/**
 * Slugify a city name for URL path segments.
 * Same logic as route-store-page.js to ensure URL consistency.
 */
function slugifyCity(city) {
  return String(city || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Generate a sitemap.xml response listing all launch store page URLs.
 *
 * @param {Object} corsHeaders - CORS headers to include in response
 * @param {Array} [storeIndex] - Optional store index override for testing
 * @returns {Response}
 */
export function handleSitemap(corsHeaders, storeIndex) {
  const index = storeIndex || DEFAULT_STORE_INDEX;
  const today = new Date().toISOString().slice(0, 10);

  const urls = [];
  for (const slug of LAUNCH_SLUGS) {
    const entry = index.find(s => s.slug === slug);
    if (!entry) continue;

    const state = entry.state.toLowerCase();
    const city = slugifyCity(entry.city);
    const loc = `https://custard.chriskaschner.com/store/${state}/${city}/${slug}/`;

    urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Generate a robots.txt response allowing crawling of /store/ paths.
 *
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response}
 */
export function handleRobotsTxt(corsHeaders) {
  const body = `User-agent: *
Allow: /store/
Disallow: /api/
Disallow: /health

Sitemap: https://custard.chriskaschner.com/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
