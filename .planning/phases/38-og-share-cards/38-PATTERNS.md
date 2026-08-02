# Phase 38: OG Share Cards - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 4 (3 modify, 1 new)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `worker/src/social-card.js` (MODIFY) | service | request-response | Self (flavor rarity PNG card at lines 507-620) | exact |
| `worker/src/route-store-page.js` (MODIFY) | controller | request-response | Self (og:title/og:description pattern at lines 168-173) | exact |
| `worker/src/index.js` (MODIFY) | controller | request-response | Self (handleCrawlerInterception at lines 337-408) | exact |
| `worker/test/social-card-store.test.js` (NEW) | test | request-response | `worker/test/social-card.test.js` (flavor rarity section at lines 406-494) | exact |

## Pattern Assignments

### `worker/src/social-card.js` (MODIFY - add store-today PNG card type)

**Analog:** Self -- the `handleFlavorCard` + `renderFlavorRarityCardPng` pattern (lines 489-621) is the closest match for a new "store today" PNG card. It uses workers-og ImageResponse, fetches cone PNG, queries D1, and returns a PNG with CORS headers.

**Imports pattern** (lines 20-23):
```javascript
import { normalize } from './flavor-matcher.js';
import { getFlavorProfile, renderConeSVG, BASE_COLORS, CONE_COLORS, TOPPING_COLORS, RIBBON_COLORS } from './flavor-colors.js';
import { TRIVIA_METRICS_SEED } from './trivia-metrics-seed.js';
import { ImageResponse } from 'workers-og';
```

**PNG render function pattern** -- copy `renderFlavorRarityCardPng` (lines 507-561) as template for `renderStoreCardPng`. Key structure:
```javascript
async function renderFlavorRarityCardPng({ flavorName, rarityTag, appearances, avgGapDays, conePngBase64, accentColor, scopeLabel }) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coneImg = conePngBase64
    ? `<img src="data:image/png;base64,${conePngBase64}" width="150" height="175" style="object-fit:contain;" />`
    : '';
  // ... HTML layout string with inline styles (satori constraint) ...
  const html = `
    <div style="display:flex; flex-direction:column; width:1200px; height:630px;
                background:linear-gradient(180deg,#1a1a2e,#16213e);">
      <div style="height:8px; background:${esc(accentColor)}; width:100%;"></div>
      <div style="display:flex; flex-direction:row; padding:60px 80px; align-items:center; flex:1;">
        <div style="display:flex; margin-right:40px;">${coneImg}</div>
        <div style="display:flex; flex-direction:column;">
          <!-- content divs here -->
        </div>
      </div>
    </div>`;
  return new ImageResponse(html, { width: 1200, height: 630 });
}
```

**Handler function pattern** -- copy `handleFlavorCard` (lines 563-621) as template for `handleStoreCard`. Key structure:
```javascript
async function handleFlavorCard(flavorSlug, env, corsHeaders) {
  // 1. Decode slug from URL
  const flavorName = decodeURIComponent(flavorSlug.replace(/-/g, ' '));
  if (!flavorName.trim()) {
    return new Response(JSON.stringify({ error: 'Missing flavor name.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Look up data from D1 (best-effort, card renders without it)
  let appearances = 0;
  const db = env.DB;
  if (db) {
    try {
      // ... D1 queries ...
    } catch {
      // Stats unavailable -- card still renders without them
    }
  }

  // 3. Get visual properties
  const profile = getFlavorProfile(flavorName);
  const accentColor = BASE_COLORS[profile.base] || '#005696';
  const conePngBase64 = await fetchConePngBase64(flavorName);

  // 4. Render PNG
  const response = await renderStoreCardPng({ ... });

  // 5. Set headers and return
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(response.body, { status: response.status, headers });
}
```

**Route registration pattern** -- copy how existing PNG routes are matched in `handleSocialCard` (lines 630-653). New route should be added before existing patterns:
```javascript
export async function handleSocialCard(path, env, corsHeaders) {
  // Match /og/quiz/{archetype-slug}/{flavor-slug}.png -- quiz result PNG cards
  const quizMatch = path.match(/^\/og\/quiz\/([\w-]+)\/(.+)\.png$/);
  if (quizMatch) return handleQuizCard(quizMatch[1], quizMatch[2], corsHeaders);

  // Match /og/flavor/{flavor-slug}.png -- flavor rarity PNG cards
  const flavorMatch = path.match(/^\/og\/flavor\/(.+)\.png$/);
  if (flavorMatch) return handleFlavorCard(flavorMatch[1], env, corsHeaders);

  // NEW: Match /og/store/{store-slug}.png -- per-store today PNG cards
  // const storeMatch = path.match(/^\/og\/store\/([\w-]+)\.png$/);
  // if (storeMatch) return handleStoreCard(storeMatch[1], env, corsHeaders);
  // ...
```

**Cone PNG fetch helper** -- reuse existing `fetchConePngBase64` (lines 48-62) and `flavorToSlug` (lines 40-42). Already exported at module scope.

---

### `worker/src/route-store-page.js` (MODIFY - add og:image meta tag)

**Analog:** Self -- the existing `<head>` block (lines 168-173) already has og:title, og:description, og:url but lacks og:image. Also needs twitter card meta tags.

**Current OG meta tags** (lines 168-173):
```javascript
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
```

**Pattern to add** -- insert og:image and twitter card meta tags directly after the existing og:url tag. The og:image URL should point to the new `/og/store/{slug}.png` endpoint:
```javascript
  <meta property="og:image" content="https://custard.chriskaschner.com/og/store/${escapeHtml(slug)}.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="https://custard.chriskaschner.com/og/store/${escapeHtml(slug)}.png">
```

**Note:** The `slug` variable is already in scope at line 44 (`const [, urlState, urlCity, slug] = match;`) and `escapeHtml` is defined at line 220.

---

### `worker/src/index.js` (MODIFY - add crawler interception for store pages)

**Analog:** Self -- `handleCrawlerInterception` (lines 337-408) already intercepts `/quiz.html` and `/radar.html` for social crawlers. The store page interception follows the same pattern.

**Crawler interception pattern** (lines 337-408):
```javascript
function handleCrawlerInterception(request, url) {
  if (!isSocialCrawler(request)) return null;

  const BASE = 'https://custard.chriskaschner.com';
  const pathname = url.pathname;

  // Quiz result share: /quiz.html?archetype=X&flavor=Y
  if (pathname === '/quiz.html' || pathname === '/quiz') {
    const archetype = url.searchParams.get('archetype');
    const flavor = url.searchParams.get('flavor');
    if (!archetype || !flavor) return null;

    const imageUrl = `${BASE}/og/quiz/${archetypeSlug}/${flavorSlug}.png`;
    const canonicalUrl = `${BASE}/quiz.html?...`;

    const html = buildCrawlerHtml({ title, description, imageUrl, canonicalUrl });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Crawler-Intercepted': 'quiz',
      },
    });
  }
  // ... more pathname checks ...
  return null;
}
```

**IMPORTANT design consideration:** The store page at `/store/{state}/{city}/{slug}/` already renders full HTML with og:title and og:description. If we add og:image to that HTML (in route-store-page.js), social crawlers will pick it up without needing interception in index.js. Crawler interception is only needed when the page is a static HTML file served from GitHub Pages (like quiz.html, radar.html) that cannot dynamically set meta tags. Since store pages are Worker-rendered, crawler interception may NOT be needed -- the og:image tag in the rendered HTML is sufficient.

**If interception IS needed** (e.g., to avoid the full flavor-fetch cost for crawlers), the pattern would add a new pathname check inside `handleCrawlerInterception`:
```javascript
  // Store page share: /store/{state}/{city}/{slug}/
  const storeMatch = pathname.match(/^\/store\/([a-z]{2})\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  if (storeMatch) {
    const [, state, city, slug] = storeMatch;
    const imageUrl = `${BASE}/og/store/${slug}.png`;
    const canonicalUrl = `${BASE}/store/${state}/${city}/${slug}/`;
    const html = buildCrawlerHtml({
      title: `Today's Flavor at Culver's of ${city} | Custard Calendar`,
      description: `Check today's Flavor of the Day.`,
      imageUrl,
      canonicalUrl,
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Crawler-Intercepted': 'store',
      },
    });
  }
```

**`buildCrawlerHtml` helper** (lines 299-321) is already available and handles all og:image, twitter:card, og:image:width/height meta tags.

**`isSocialCrawler` function** (lines 282-285) already detects: facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Slackbot, Discordbot, TelegramBot, iframely, embedly.

**Rate limit config** -- `/og/` routes are already rate-limited at 60 req/hour in `getExpensiveReadLimitConfig` (lines 127-131). The new `/og/store/{slug}.png` route will automatically be covered.

---

### `worker/test/social-card-store.test.js` (NEW - test for store OG card)

**Analog:** `worker/test/social-card.test.js` -- the flavor rarity PNG card section (lines 406-494) is the closest match. It tests a PNG card type that queries D1 and returns ImageResponse.

**Test file structure** (lines 1-13 -- shared setup):
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSocialCard } from '../src/social-card.js';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// Minimal valid 1x1 transparent PNG for mocking fetch responses
const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
function tinyPngBuffer() {
  const binary = atob(TINY_PNG_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
```

**Mock D1 factory pattern** (lines 15-31 for general, lines 418-431 for flavor-specific):
```javascript
function createFlavorD1({ appearances = 0, avgGap = 0, failQuery = false } = {}) {
  return {
    prepare: vi.fn((sql) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (failQuery) throw new Error('D1 query failed');
          if (sql.includes('COUNT(*) as n')) return { n: appearances };
          if (sql.includes('AVG(gap_days)')) return { avg_gap: avgGap };
          return null;
        }),
      })),
    })),
  };
}
```

**Fetch mock helpers** (lines 34-52):
```javascript
function mockFetchSuccess() {
  return vi.fn(async (url) => {
    if (typeof url === 'string' && url.includes('/assets/cones/')) {
      return { ok: true, arrayBuffer: async () => tinyPngBuffer() };
    }
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  });
}

function mockFetch404() {
  return vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
}
```

**Test lifecycle pattern** (lines 409-416):
```javascript
describe('handleSocialCard - store today PNG card', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchSuccess();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });
```

**Test case patterns to copy** from flavor rarity section (lines 433-494):
1. `returns null for non-matching path` -- verify path regex rejects bad input
2. `returns a PNG for a valid store slug` -- verify status 200 and Content-Type image/png
3. `sets 24h cache TTL` -- verify Cache-Control header
4. `includes CORS headers in response` -- verify CORS passthrough
5. `renders PNG without D1 bindings` -- verify graceful degradation
6. `renders PNG when D1 query throws` -- verify error resilience
7. `falls back gracefully when cone PNG fetch fails` -- verify cone fallback
8. `does not interfere with existing routes` -- verify no route collision

**Additional store-specific test** -- the new card needs to fetch today's flavor from KV/upstream (similar to route-store-page.js). The mock should provide flavor data via a mock fetchFlavors or D1 snapshot query. See `worker/test/route-store-page.test.js` lines 6-33 for the KV mock and fetchFlavors mock patterns.

---

## Shared Patterns

### HTML Escaping
**Source:** Used identically in both `social-card.js` (line 508) and `route-store-page.js` (lines 220-228)
**Apply to:** Both modified files and any new render functions
```javascript
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
```

### Cone PNG Embedding
**Source:** `worker/src/social-card.js` lines 48-62 (`fetchConePngBase64`) and lines 40-42 (`flavorToSlug`)
**Apply to:** The new store card render function
```javascript
const conePngBase64 = await fetchConePngBase64(flavorName);
const coneImg = conePngBase64
  ? `<img src="data:image/png;base64,${conePngBase64}" width="150" height="175" style="object-fit:contain;" />`
  : '';
```

### ImageResponse (workers-og) PNG Generation
**Source:** `worker/src/social-card.js` line 296 and line 560
**Apply to:** The new store card render function
```javascript
return new ImageResponse(html, { width: 1200, height: 630 });
```

### Response Header Assembly for PNG Cards
**Source:** `worker/src/social-card.js` lines 612-620 (used identically in all PNG handlers)
**Apply to:** The new store card handler
```javascript
const headers = new Headers(response.headers);
for (const [k, v] of Object.entries(corsHeaders)) {
  headers.set(k, v);
}
headers.set('Cache-Control', 'public, max-age=86400');
return new Response(response.body, { status: response.status, headers });
```

### Flavor Color Accent Bar
**Source:** `worker/src/social-card.js` lines 597-599
**Apply to:** The new store card render function
```javascript
const profile = getFlavorProfile(flavorName);
const accentColor = BASE_COLORS[profile.base] || '#005696';
```

## No Analog Found

No files without analogs -- all four files have exact matches in the existing codebase.

## Metadata

**Analog search scope:** `worker/src/`, `worker/test/`
**Files scanned:** 6 (social-card.js, route-store-page.js, index.js, social-card.test.js, route-store-page.test.js, quiz-routes.test.js)
**Pattern extraction date:** 2026-04-19
