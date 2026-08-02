# Phase 37: SEO Landing Pages - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 5 (3 new, 2 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/route-store-page.js` (NEW) | route-handler | request-response | `worker/src/route-today.js` + `worker/src/index.js` (buildCrawlerHtml) | exact |
| `worker/src/sitemap.js` (NEW) | route-handler | request-response | `worker/src/route-calendar.js` | role-match |
| `worker/src/index.js` (MODIFY) | router | request-response | self (existing route dispatch block) | exact |
| `worker/test/route-store-page.test.js` (NEW) | test | unit | `worker/test/crawler.test.js` + `worker/test/route-today-rarity.test.js` | exact |
| `worker/test/sitemap.test.js` (NEW) | test | unit | `worker/test/widget-routes.test.js` | role-match |

## Pattern Assignments

### `worker/src/route-store-page.js` (route-handler, request-response)

**Analog:** `worker/src/route-today.js` (data fetching + response shape) and `worker/src/index.js` lines 297-319 (HTML generation)

This file renders full HTML pages (not JSON). It combines the data-fetching pattern from route-today.js with the HTML-generation pattern from buildCrawlerHtml/alert-routes.js.

**Imports pattern** (route-today.js lines 1-8):
```javascript
import { fetchFlavors as defaultFetchFlavors } from './flavor-fetcher.js';
import { VALID_SLUGS as DEFAULT_VALID_SLUGS } from './valid-slugs.js';
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
import { normalize } from './flavor-matcher.js';
import { isValidSlug } from './slug-validation.js';
import { getBrandForSlug } from './brand-registry.js';
import { getFlavorsCached } from './kv-cache.js';
```

**Store data shape** (store-index.js, store-coords.js):
STORE_INDEX entries: `{ slug: "mt-horeb", name: "Mt. Horeb, WI", city: "Mt. Horeb", state: "WI" }`
STORE_COORDS is a `Map<slug, {lat, lng, name, address}>` with entries like:
`["mt-horeb", {"lat":43.0069,"lng":-89.7390,"name":"Mt. Horeb, WI","address":"150 Springdale St"}]`

Both are needed for the landing page: STORE_INDEX for city/state, STORE_COORDS for lat/lng/address.

**Slug validation pattern** (route-today.js lines 24-37):
```javascript
const slug = url.searchParams.get('slug');
if (!slug) {
  return Response.json(
    { error: 'Missing required "slug" parameter. Usage: /api/today?slug=<store-slug>' },
    { status: 400, headers: corsHeaders }
  );
}

const check = isValidSlug(slug, validSlugs);
if (!check.valid) {
  return Response.json(
    { error: `Invalid store: ${check.reason}` },
    { status: 400, headers: corsHeaders }
  );
}
```

**Data fetching pattern** (route-today.js lines 39-42):
```javascript
try {
  const data = await getFlavorsCached(slug, env.FLAVOR_CACHE, fetchFlavorsFn, isOverride, env);
  const brand = getBrandForSlug(slug);
  const today = new Date().toISOString().slice(0, 10);
```

**HTML escape utility** (index.js line 298):
```javascript
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
```

Alert-routes.js has a more complete version at line 462:
```javascript
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

**Full HTML page generation pattern** (index.js buildCrawlerHtml, lines 297-319):
```javascript
function buildCrawlerHtml({ title, description, imageUrl, canonicalUrl }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(imageUrl)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
</head>
<body></body>
</html>`;
}
```

**Styled HTML page pattern** (alert-routes.js lines 429-457):
```javascript
function htmlResponse(bodyContent, status, corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custard Calendar Alerts</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
    h2 { color: #003366; }
    a { color: #003366; }
  </style>
</head>
<body>
  ${bodyContent}
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
```

**HTML response construction** (index.js lines 366-373):
```javascript
return new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  },
});
```

**Rarity data fetching for context** (route-today.js lines 118-238):
The rarity computation logic is extensive. The store page should reuse the rarity computation from route-today.js or extract it into a shared function. Key thresholds: `>150 days = Ultra Rare`, `>90 days = Rare`.

**Error handling pattern** (route-today.js lines 275-280):
```javascript
} catch (err) {
  return Response.json(
    { error: 'Failed to fetch flavor data. Please try again later.' },
    { status: 502, headers: corsHeaders }
  );
}
```

**Export pattern** (route-today.js line 19, route-calendar.js line 35):
```javascript
export async function handleApiToday(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
export async function handleCalendar(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
```
Named export, async, accepts (url, env, corsHeaders, optional fetchFlavorsFn for testing).

**Function signature for store page handler:**
```javascript
export async function handleStorePage(url, env, corsHeaders, fetchFlavorsFn = defaultFetchFlavors) {
```

---

### `worker/src/sitemap.js` (route-handler, request-response)

**Analog:** `worker/src/route-calendar.js` (generates structured text content) and `worker/src/widget-routes.js` (static content serving)

**Imports pattern** (minimal -- needs store list only):
```javascript
import { STORE_INDEX as DEFAULT_STORE_INDEX } from './store-index.js';
```

**Static content serving pattern** (widget-routes.js lines 16-17, used for robots.txt):
```javascript
export const WIDGET_VERSION = "1.0";
export const WIDGET_UPDATED = "2026-03-25";
```

**XML content response pattern** (adapted from route-calendar.js lines 119-128):
```javascript
return new Response(ics, {
  status: 200,
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/calendar; charset=utf-8',
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
  },
});
```
For sitemap.xml, replace Content-Type with `application/xml; charset=utf-8`.
For robots.txt, use `text/plain; charset=utf-8`.

**Export pattern:**
```javascript
export function handleSitemap(corsHeaders, storeIndex) {
export function handleRobotsTxt(corsHeaders) {
```

---

### `worker/src/index.js` (MODIFY - router, request-response)

**Analog:** Self -- follow the existing route dispatch block.

**Import pattern** (index.js line 38-42):
```javascript
import { handleCalendar } from './route-calendar.js';
import { handleApiToday } from './route-today.js';
import { handleApiNearbyFlavors } from './route-nearby.js';
import { applyIpRateLimit, _resetRateLimitState } from './rate-limit.js';
import { handleGroupRoute } from './group-routes.js';
```
Add: `import { handleStorePage } from './route-store-page.js';`
Add: `import { handleSitemap, handleRobotsTxt } from './sitemap.js';`

**Route dispatch pattern** (index.js lines 607-706):
Routes are matched by `canonical` path using `===` for exact matches or `.startsWith()` / `.match()` for prefix/regex patterns.

The store page route uses a path pattern like `/store/wi/{city}/{slug}/`. Add before the final 404 block using regex match:
```javascript
} else if (canonical.match(/^\/store\/[a-z]{2}\/[a-z0-9-]+\/[a-z0-9-]+\/?$/)) {
  response = await handleStorePage(url, env, corsHeaders, fetchFlavorsFn);
} else if (canonical === '/sitemap.xml') {
  response = handleSitemap(corsHeaders);
} else if (canonical === '/robots.txt') {
  response = handleRobotsTxt(corsHeaders);
}
```

**404 error message pattern** (index.js lines 713-718):
The 404 route list string must be updated to include the new routes.

---

### `worker/test/route-store-page.test.js` (test, unit)

**Analog:** `worker/test/crawler.test.js` (HTML content assertions) + `worker/test/route-today-rarity.test.js` (mock env with D1)

**Test framework pattern** (crawler.test.js line 10-11):
```javascript
import { describe, it, expect } from 'vitest';
import { isSocialCrawler, buildCrawlerHtml, handleCrawlerInterception } from '../src/index.js';
```

**Mock env construction** (route-today-rarity.test.js lines 25-62):
```javascript
function makeEnv(overrides = {}) {
  const { appearances = 15, gapDays = 200, networkCount = 2, today = '2026-03-22' } = overrides;
  return {
    DB: {
      prepare: vi.fn((sql) => ({
        bind: vi.fn((...args) => ({
          all: vi.fn(async () => { /* return mock results based on sql */ }),
          first: vi.fn(async () => { /* return mock result */ }),
        })),
      })),
    },
    FLAVOR_CACHE: null,
    _validSlugsOverride: new Set(['mt-horeb']),
  };
}
```

**Mock KV construction** (route-today-rarity.test.js lines 64-70):
```javascript
function makeKV() {
  const store = new Map();
  return {
    get: vi.fn(async (k) => store.get(k) || null),
    put: vi.fn(async (k, v) => store.set(k, v)),
  };
}
```

**Mock fetch function** (route-today-rarity.test.js lines 72-77):
```javascript
function mockFetchFlavors(today) {
  return vi.fn(async (_slug) => ({
    name: 'Mt. Horeb',
    flavors: [{ date: today, title: 'Turtle', description: 'Caramel pecan custard.' }],
  }));
}
```

**HTML content assertion pattern** (crawler.test.js lines 82-133):
```javascript
it('includes og:title', () => {
  const html = buildCrawlerHtml(params);
  expect(html).toContain('og:title');
  expect(html).toContain('Cool Front: Mint Cookie');
});

it('returns a valid HTML string starting with <!DOCTYPE html>', () => {
  const html = buildCrawlerHtml(params);
  expect(html.trim()).toMatch(/^<!DOCTYPE html>/);
});
```

**Response shape assertions** (crawler.test.js lines 178-185):
```javascript
it('returns HTML for crawler requesting quiz.html?archetype=X&flavor=Y', async () => {
  const req = makeRequest(QUIZ_URL, 'facebookexternalhit/1.1');
  const url = new URL(QUIZ_URL);
  const res = handleCrawlerInterception(req, url);
  expect(res).not.toBeNull();
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toMatch(/text\/html/);
});
```

**JSON-LD test pattern** (new -- no existing analog, assert with JSON.parse on extracted script block):
```javascript
it('includes valid JSON-LD structured data', async () => {
  const html = await res.text();
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(jsonLdMatch).not.toBeNull();
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  expect(jsonLd['@type']).toBe('FastFoodRestaurant');
  expect(jsonLd.name).toBeTruthy();
});
```

---

### `worker/test/sitemap.test.js` (test, unit)

**Analog:** `worker/test/widget-routes.test.js`

**Test structure pattern** (widget-routes.test.js lines 1-7):
```javascript
import { describe, expect, it } from 'vitest';
import { handleWidgetScript, handleWidgetVersion, WIDGET_VERSION, WIDGET_UPDATED } from '../src/widget-routes.js';

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
```

**Response shape assertions** (widget-routes.test.js lines 12-25):
```javascript
describe('handleWidgetScript', () => {
  it('returns status 200', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.status).toBe(200);
  });

  it('returns Content-Type: text/javascript; charset=utf-8', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
  });

  it('returns Cache-Control: public, max-age=86400', async () => {
    const res = handleWidgetScript(corsHeaders);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});
```

**Content assertions for sitemap:**
```javascript
it('returns valid XML with urlset root', async () => {
  const res = handleSitemap(corsHeaders);
  const body = await res.text();
  expect(body).toContain('<?xml');
  expect(body).toContain('<urlset');
  expect(body).toContain('</urlset>');
});

it('Content-Type is application/xml', async () => {
  const res = handleSitemap(corsHeaders);
  expect(res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
});
```

---

## Shared Patterns

### HTML Escaping
**Source:** `worker/src/index.js` line 298, `worker/src/alert-routes.js` lines 462-470
**Apply to:** `route-store-page.js`
```javascript
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### Cache Headers
**Source:** Multiple route files (route-today.js line 12, route-calendar.js line 8)
**Apply to:** All new route handlers
```javascript
const CACHE_MAX_AGE = 3600; // 1 hour
// Used in response headers:
'Cache-Control': `public, max-age=${CACHE_MAX_AGE}`
```

### CORS Headers Pass-through
**Source:** All route handlers (route-today.js line 73, route-calendar.js line 120)
**Apply to:** `route-store-page.js`, `sitemap.js`
```javascript
return new Response(content, {
  status: 200,
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  },
});
```

### Test Mock Construction
**Source:** `worker/test/route-today-rarity.test.js` lines 25-77, `worker/test/integration.test.js` lines 27-49
**Apply to:** All new test files
```javascript
// Mock KV
function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => store.get(key) || null),
    put: vi.fn(async (key, value, opts) => store.set(key, value)),
    _store: store,
  };
}

// Mock fetchFlavors
function createMockFetchFlavors() {
  return vi.fn(async (slug) => ({
    name: 'Mt. Horeb',
    flavors: [{ date: '2026-04-19', title: 'Turtle', description: 'Caramel pecan custard.' }],
  }));
}
```

### Valid Slugs Override (Test Isolation)
**Source:** `worker/test/integration.test.js` lines 24, 59
**Apply to:** All new test files that need slug validation
```javascript
const TEST_VALID_SLUGS = new Set(['mt-horeb', 'madison-todd-drive']);
// In env:
env = { FLAVOR_CACHE: mockKV, _validSlugsOverride: TEST_VALID_SLUGS };
```

### Store Index Override (Test Isolation)
**Source:** `worker/src/route-today.js` lines 80-81
**Apply to:** `route-store-page.test.js`
```javascript
const storeIndex = env._storeIndexOverride || DEFAULT_STORE_INDEX;
const storeEntry = storeIndex.find(s => s.slug === slug);
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | - | - | All files have close analogs in the existing codebase |

**New patterns required (no existing codebase analog):**
- JSON-LD structured data generation (FastFoodRestaurant schema) -- no existing JSON-LD in the codebase. Follow schema.org spec directly.
- sitemap.xml generation -- no existing XML generation in the worker. Follow standard sitemap protocol.
- robots.txt generation -- trivial text response, follows widget-routes static-content pattern.
- URL path parsing for `/store/wi/{city}/{slug}/` -- use regex match pattern consistent with existing `/api/forecast/{slug}` pattern in index.js line 646.

## Metadata

**Analog search scope:** `worker/src/`, `worker/test/`
**Files scanned:** 14 source files, 8 test files
**Pattern extraction date:** 2026-04-19
