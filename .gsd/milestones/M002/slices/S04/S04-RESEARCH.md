# Phase 33: Performance - Research

**Researched:** 2026-03-19
**Domain:** Frontend performance optimization (static site + API dependency)
**Confidence:** HIGH

## Summary

The homepage LCP bottleneck is a waterfall of sequential network requests, not a single "cold start" as initially described. The critical rendering path requires HTML -> CSS + JS -> `stores.json` + `flavor-colors` API -> 3 parallel flavor API calls -> hero cone PNG. That is a minimum of 3 sequential network rounds before the hero card renders, with the Worker API calls adding 400-1500ms each depending on KV cache state.

Cloudflare Workers themselves have near-zero cold starts (V8 isolates boot in <5ms). The real latency comes from KV/D1 cache misses on the Worker side -- first reads from a region go through multiple tiers before hitting central storage, adding 500-1500ms per uncached KV read. With 3-4 API calls in the critical path, this compounds to the observed ~10s LCP on a cold scenario.

The fix is to break the API dependency on the critical rendering path. The service worker currently skips caching ALL requests to `workers.dev` hostnames, but the API calls go to `custard.chriskaschner.com` (same origin) -- so the SW bypass at line 57 of `sw.js` does NOT actually apply. However, the SW also bypasses `/api/` and `/v1/` paths (lines 59-60), which DOES prevent API response caching. The solution: add stale-while-revalidate caching for API responses (show last-known flavor data instantly, refresh in background) combined with a localStorage "last known flavor" fallback for the very first service worker install.

**Primary recommendation:** Cache Worker API responses in the service worker with stale-while-revalidate and cache the last-known hero card data in localStorage for instant render on return visits.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | LCP P90 under 3 seconds (currently 10s due to Worker cold starts) | Service worker API caching + localStorage instant render eliminates API dependency from critical path. Skeleton already prevents CLS. Verified asset sizes are small enough for sub-3s when API is cached. |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. This phase uses only browser-native APIs already available in the codebase.

| API/Feature | Purpose | Why Standard |
|-------------|---------|--------------|
| Service Worker Cache API | Cache API responses with stale-while-revalidate | Already in use for static assets in `sw.js` |
| localStorage | Store last-known hero card data for instant render | Already used for store slug persistence |
| `fetchpriority="high"` | Prioritize hero cone PNG loading | Native browser hint, no polyfill needed |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Lighthouse CLI | Measure LCP before and after changes | Verification of PERF-01 success criteria |
| Playwright | Browser test for cached render behavior | Validate hero card renders from cache |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SW API caching | Build-time API snapshot (fetch at deploy) | Stale data for hours; SW approach is fresher |
| localStorage hero cache | IndexedDB | Overkill for one JSON blob; localStorage is synchronous and simpler |
| Manual SW caching | Workbox library | Adds build step and dependency; manual SW is already working and small |

## Architecture Patterns

### Current Critical Rendering Path (BEFORE)

```
HTML (5KB)
  -> CSS (75KB / 13KB gz) [render-blocking]
  -> JS chain at </body> (121KB / 26KB gz total, 7 files)
     -> DOMContentLoaded: init()
        -> localStorage read (sync, ~0ms)
        -> show skeleton
        -> stores.json (214KB / 40KB gz) + /api/v1/flavor-colors [parallel]
        -> /api/v1/flavors + /api/v1/forecast + /api/v1/today [parallel, 3 calls]
        -> render hero card
        -> hero cone PNG (~130KB)
```

**Problem:** 3 sequential network rounds before hero card content visible. Each API call = 50-1500ms depending on KV cache state.

### Target Critical Rendering Path (AFTER)

```
HTML (5KB)
  -> CSS (75KB / 13KB gz) [render-blocking]
  -> JS chain at </body> (121KB / 26KB gz total)
     -> DOMContentLoaded: init()
        -> localStorage read (sync, ~0ms)
        -> READ localStorage "last-known-flavor" (sync, ~0ms)
        -> render hero card from cached data IMMEDIATELY
        -> hero cone PNG from SW cache (~0ms if cached)
        -> BACKGROUND: SW serves cached API + revalidates
        -> IF fresh data differs: update hero card
```

**Result:** Hero card visible after JS parse + 1 synchronous localStorage read. No network dependency.

### Pattern 1: localStorage Instant Render

**What:** After each successful API response, write the hero card data (flavor name, description, rarity, date, fetched_at) to a known localStorage key. On next page load, render from this cache first, then fetch fresh data and update if different.

**When to use:** Returning users with a saved store slug.

**Example:**
```javascript
// After successful API response in loadForecast():
var cachePayload = {
  slug: slug,
  flavor: day.flavor,
  description: day.description || '',
  date: day.date,
  type: day.type,
  fetchedAt: fetchedAt,
  cachedAt: new Date().toISOString()
};
try {
  localStorage.setItem('custard-hero-cache', JSON.stringify(cachePayload));
} catch (e) {}

// In init(), before any async work:
var heroCache = null;
try {
  var raw = localStorage.getItem('custard-hero-cache');
  if (raw) heroCache = JSON.parse(raw);
} catch (e) {}

if (heroCache && heroCache.slug === savedSlug) {
  // Render hero card immediately from cache
  renderHeroCard(heroCache, savedSlug, heroCache.fetchedAt, null, null);
  // Still fetch fresh data in background and update if different
}
```

### Pattern 2: Service Worker API Response Caching

**What:** Extend `sw.js` to cache `/api/v1/flavors`, `/api/v1/forecast/`, `/api/v1/today`, and `/api/v1/flavor-colors` responses with stale-while-revalidate. Exclude write endpoints and geolocate.

**When to use:** All API GET requests that return flavor data.

**Example:**
```javascript
// In sw.js fetch handler, before the "Never cache" block:

// Stale-while-revalidate for flavor API reads
var CACHEABLE_API = ['/api/v1/flavors', '/api/v1/forecast/', '/api/v1/today', '/api/v1/flavor-colors'];
var isCacheableApi = CACHEABLE_API.some(function(prefix) {
  return url.pathname.startsWith(prefix);
});

if (event.request.method === 'GET' && isCacheableApi) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetched = fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetched;
    })
  );
  return;
}
```

### Pattern 3: Cone PNG Preload

**What:** Once the hero cache is read from localStorage, immediately insert a `<link rel="preload">` for the cone PNG to start loading before the full JS executes.

**When to use:** Returning users with a cached flavor name.

### Anti-Patterns to Avoid

- **Preloading all cone PNGs:** There are 94 cone PNGs totaling ~11MB. Only preload the one matching the cached flavor.
- **Aggressive cache TTL:** Don't set a max-age on cached API responses. Stale-while-revalidate means always serve cached then refresh -- the data is inherently time-bound (today's flavor), so staleness of a few minutes is acceptable; staleness of a day is not. Cache should be refreshed on every visit.
- **Removing the skeleton:** The skeleton is still needed for first-visit users and for the brief moment before localStorage is read. Keep it.
- **Caching write endpoints:** Only cache GET requests for flavor data. Never cache POST/PUT endpoints, geolocate, nearby-flavors, or any endpoint that takes location data (privacy).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API response caching | Custom XHR interceptor | Service Worker Cache API | SW already exists, Cache API is purpose-built |
| Offline flavor display | Custom offline page | Cached API responses + localStorage | Same data, no extra page needed |
| LCP measurement | Manual timing code | Lighthouse CLI / PageSpeed Insights | Standard tool, matches PERF-01 success criteria exactly |
| Cache invalidation | Time-based expiry logic | Stale-while-revalidate pattern | Fresh fetch on every visit handles invalidation automatically |

**Key insight:** The existing service worker is 90% of the solution. It already implements stale-while-revalidate for static assets and cone PNGs. The only change needed is extending this to cover API response paths.

## Common Pitfalls

### Pitfall 1: Cache Key Mismatch for API Requests

**What goes wrong:** The Cache API matches on full request URL including query parameters. If the slug has different encoding between cached and fresh requests, you get cache misses.
**Why it happens:** `encodeURIComponent()` is used in some places but not others.
**How to avoid:** Use the Request object from the fetch event directly as the cache key (this is the default behavior of `caches.match(event.request)`).
**Warning signs:** Cache hit rate is unexpectedly low.

### Pitfall 2: Stale Data Displayed All Day

**What goes wrong:** A user visits at midnight, gets yesterday's flavor cached, and sees it all day because the cache never refreshes.
**Why it happens:** Stale-while-revalidate serves cached first. If the background revalidation fails silently (network error), cached data persists.
**How to avoid:** In the localStorage cache, store the `date` field. In init(), compare cached date to today's date. If stale (different day), show skeleton instead of cached data and wait for fresh fetch.
**Warning signs:** Users report seeing yesterday's flavor.

### Pitfall 3: Service Worker Not Active on First Visit

**What goes wrong:** The service worker registers on first visit but doesn't intercept requests until the second page load (or after `clients.claim()`).
**Why it happens:** Service workers don't control the page that registered them by default.
**How to avoid:** The existing SW already calls `self.skipWaiting()` and `self.clients.claim()`, which is correct. But first-visit users will still not benefit from SW API caching until their second visit. The localStorage approach handles this: even without SW, the second visit reads from localStorage.
**Warning signs:** First visit always slow (expected and unavoidable without build-time data embedding).

### Pitfall 4: CORS and Opaque Responses in Cache

**What goes wrong:** If API requests are cross-origin, the Cache API stores opaque responses that can't be inspected.
**Why it happens:** Cross-origin fetch without CORS returns opaque responses.
**How to avoid:** The API is same-origin (`custard.chriskaschner.com` serves both pages and API), so this should not be an issue. Verify that the CORS headers don't cause opaque responses.
**Warning signs:** Cached API responses return empty bodies.

### Pitfall 5: Bumping CACHE_VERSION Clears API Cache

**What goes wrong:** The existing SW deletes all caches except `CACHE_VERSION` on activate. If the version is bumped, all cached API responses are lost.
**Why it happens:** The cleanup logic in the `activate` handler deletes old cache names.
**How to avoid:** Either use the same cache name for API responses (acceptable since SWR refreshes anyway) or use a separate cache name for API responses and don't delete it on activate.
**Warning signs:** After deploy, all users experience slow first load.

## Code Examples

### Example 1: Modified sw.js Fetch Handler

```javascript
// After the existing cone PNG handler, before the "Never cache" block.
// Add stale-while-revalidate for flavor API reads.

var CACHEABLE_API_PREFIXES = [
  '/api/v1/flavors',
  '/api/v1/forecast/',
  '/api/v1/today',
  '/api/v1/flavor-colors',
  '/api/v1/flavor-config'
];

function isCacheableApiRequest(url) {
  if (url.hostname !== self.location.hostname) return false;
  for (var i = 0; i < CACHEABLE_API_PREFIXES.length; i++) {
    if (url.pathname.startsWith(CACHEABLE_API_PREFIXES[i])) return true;
  }
  return false;
}
```

### Example 2: localStorage Hero Cache Write

```javascript
// At end of loadForecast().then() in today-page.js, after renderHeroCard():
function cacheHeroData(slug, day, fetchedAt) {
  try {
    localStorage.setItem('custard-hero-cache', JSON.stringify({
      slug: slug,
      flavor: day.flavor || '',
      description: day.description || '',
      date: day.date,
      type: day.type,
      fetchedAt: fetchedAt,
      ts: Date.now()
    }));
  } catch (e) {}
}
```

### Example 3: localStorage Hero Cache Read (in init)

```javascript
// In init(), after reading savedSlug, before any async work:
function readHeroCache(slug) {
  try {
    var raw = localStorage.getItem('custard-hero-cache');
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || data.slug !== slug) return null;
    // Only use cache if it's from today
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var todayStr = today.toISOString().slice(0, 10);
    if (data.date !== todayStr) return null;
    return data;
  } catch (e) {
    return null;
  }
}
```

### Example 4: Lighthouse CLI Measurement

```bash
# Install lighthouse globally
npm install -g lighthouse

# Run against the live site with mobile throttling
lighthouse https://custard.chriskaschner.com/ \
  --only-categories=performance \
  --preset=perf \
  --throttling-method=simulate \
  --output=json \
  --output-path=./lighthouse-report.json

# Extract LCP from the report
node -e "
  var r = require('./lighthouse-report.json');
  var lcp = r.audits['largest-contentful-paint'];
  console.log('LCP:', lcp.displayValue, '(', lcp.numericValue, 'ms)');
"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Network-only for API data | Stale-while-revalidate via SW | Established pattern, Workbox popularized ~2019 | Instant repeat visits |
| Skeleton shows until API returns | Cache + immediate render, update if changed | SWR pattern widely adopted for SPAs ~2020 | Sub-second perceived load |
| Generic service worker tutorials | Browser-native Cache API with no library | 2024+ trend away from Workbox for simple cases | Fewer dependencies, smaller SW |

**No deprecated/outdated concerns:** All APIs used (Cache API, Service Worker, localStorage, `fetchpriority`) are stable, widely supported web platform features.

## Asset Size Budget

| Asset | Raw | Gzipped | Notes |
|-------|-----|---------|-------|
| index.html | 5KB | 1.7KB | Small, fast |
| style.css | 75KB | 13KB | Render-blocking but cacheable |
| JS total (7 files) | 121KB | 26KB | Parser-blocking at `</body>` -- acceptable |
| stores.json | 214KB | 40KB | Loaded async, not on critical path for cached render |
| Hero cone PNG | ~130KB | N/A (binary) | Single image, SW-cacheable |
| **Total critical path** | **~201KB** | **~41KB** | **Well within 3s budget on 3G** |

The 41KB gzipped critical path (HTML + CSS + JS) would load in ~0.8s on simulated slow 3G (400kbps). The remaining time budget is for API calls. With SW caching eliminating API latency, total LCP should be well under 3s.

## Open Questions

1. **Exact LCP element identity**
   - What we know: The hero card text or cone image is likely the LCP element
   - What's unclear: Is LCP the `.today-flavor-name` text, the `.hero-cone-img`, or the skeleton itself?
   - Recommendation: Run Lighthouse once before any changes to identify the exact LCP element. This determines whether preloading the cone PNG matters for LCP.

2. **Same-origin verification**
   - What we know: `WORKER_BASE` is `https://custard.chriskaschner.com`, same as the site domain
   - What's unclear: Whether the DNS routing actually makes API calls same-origin or if there's a redirect/proxy that makes them cross-origin
   - Recommendation: Inspect a live API request in DevTools to verify no CORS preflight or redirect. If cross-origin, the SW hostname check may need adjustment.

3. **Cache storage quota**
   - What we know: Each cached API response is <10KB JSON. Cone PNGs are ~130KB each. localStorage limit is ~5MB.
   - What's unclear: How many unique API responses accumulate over time in the cache
   - Recommendation: Not a concern for this volume. Even 100 cached responses would be <1MB.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (via worker/test/browser/) |
| Config file | `worker/playwright.config.mjs` |
| Quick run command | `cd worker && npx playwright test test/browser/homepage-redesign.spec.mjs --workers=1` |
| Full suite command | `cd worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01a | Hero card renders from localStorage cache without network | browser/e2e | `cd worker && npx playwright test test/browser/perf-cached-render.spec.mjs --workers=1` | No -- Wave 0 |
| PERF-01b | Service worker caches API responses with SWR | browser/e2e | `cd worker && npx playwright test test/browser/perf-sw-api-cache.spec.mjs --workers=1` | No -- Wave 0 |
| PERF-01c | Stale cache from yesterday shows skeleton, not old data | browser/e2e | `cd worker && npx playwright test test/browser/perf-stale-guard.spec.mjs --workers=1` | No -- Wave 0 |
| PERF-01d | LCP under 3s with simulated mobile throttling | manual | `lighthouse https://custard.chriskaschner.com/ --only-categories=performance --preset=perf` | No -- manual verification |

### Sampling Rate

- **Per task commit:** `cd worker && npx playwright test test/browser/homepage-redesign.spec.mjs test/browser/today-hero.spec.mjs --workers=1` (existing tests still pass)
- **Per wave merge:** `cd worker && npm run test:browser -- --workers=1` (full browser suite)
- **Phase gate:** Full suite green + Lighthouse LCP < 3s before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `worker/test/browser/perf-cached-render.spec.mjs` -- covers PERF-01a: hero card renders instantly from localStorage cache
- [ ] `worker/test/browser/perf-sw-api-cache.spec.mjs` -- covers PERF-01b: SW caches and serves API responses (may need to mock SW registration in Playwright)
- [ ] `worker/test/browser/perf-stale-guard.spec.mjs` -- covers PERF-01c: yesterday's cache triggers skeleton not stale render

Note: PERF-01d (Lighthouse LCP measurement) is manual-only because Lighthouse requires a live deployed site and simulated throttling. It cannot be meaningfully tested against a local dev server.

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** -- direct inspection of `docs/index.html`, `docs/sw.js`, `docs/today-page.js`, `docs/planner-shared.js`, `docs/planner-data.js`, `docs/cone-renderer.js`
- [Strategies for service worker caching - Chrome Developers](https://developer.chrome.com/docs/workbox/caching-strategies-overview) -- SWR pattern reference
- [MDN: Caching - Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) -- Cache API reference
- [web.dev: Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp) -- LCP optimization strategies

### Secondary (MEDIUM confidence)

- [Cloudflare Blog: Eliminating Cold Starts](https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/) -- Workers cold start is near-zero; real latency is KV/D1 cache misses
- [Cloudflare Community: D1 latency from worker high](https://community.cloudflare.com/t/d1-latency-from-worker-high/582711) -- KV/D1 first-read latency 500-1500ms confirmed by community reports
- [Cloudflare Community: High Latency in Worker KV write and D1 Insert/Select](https://community.cloudflare.com/t/high-latency-in-worker-kv-write-and-d1-insert-select/737421) -- Corroborates KV cold-read latency findings
- [web.dev: Service worker caching and HTTP caching](https://web.dev/articles/service-worker-caching-and-http-caching) -- Interaction between SW cache and browser HTTP cache

### Tertiary (LOW confidence)

- None. All findings are from codebase inspection or verified official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all browser-native APIs
- Architecture: HIGH -- direct codebase analysis of the actual loading waterfall
- Pitfalls: HIGH -- derived from known Cache API behaviors and observed codebase patterns

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable browser APIs, no version-sensitive findings)