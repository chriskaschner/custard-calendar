# Phase 1: Foundation - Research

**Researched:** 2026-03-07
**Domain:** Shared navigation, store persistence, geolocation, service worker caching (vanilla JS, static GitHub Pages)
**Confidence:** HIGH

## Summary

Phase 1 extracts duplicated nav HTML from 14+ pages into a single JS-rendered shared-nav.js IIFE, adds a persistent store indicator to the header, wires up the geolocation flow (IP-based first, then optional browser Geolocation API refinement), and ensures the service worker handles deployments without serving stale content.

The codebase is vanilla JS with no build step. All modules use the IIFE Revealing Module pattern (`window.X = (function() { ... })()`). Store preferences are persisted via localStorage under `custard-primary` (slug string), `custard-secondary` (JSON array), and `custard:v1:preferences` (full preferences object). Geolocation currently exists only in index.html inline JS -- it tries browser geolocation first via `navigator.geolocation.getCurrentPosition`, falls back to `ip-api.com/json`, and sorts stores by haversine distance. The service worker uses stale-while-revalidate for static assets with a `CACHE_VERSION` string and `STATIC_ASSETS` array.

**Primary recommendation:** Create `shared-nav.js` as an IIFE that reads `CustardPlanner.getPrimaryStoreSlug()` on load, renders the nav + store indicator into a placeholder `<div id="shared-nav">` on every page, and provides a `showStorePicker()` method. Extract the geolocation logic from index.html inline JS into the shared module so all pages can offer "use precise location" refinement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Store indicator must fit at 375px width without overflow
- Store indicator must include a "change" link/tap target
- Show IP-based result first, then offer "use precise location" to refine
- Do NOT prompt for browser geolocation permission immediately on load
- First visit must show a confirmation prompt: "Showing flavors for [store] -- change?"
- Store search must use type-ahead search with live filtering (current approach works)
- Full 1,000+ store picker only appears when user actively taps "change"
- Store picker is hidden by default on all pages
- Nav is JS-rendered from a shared-nav.js IIFE module (not duplicated HTML)
- One file controls nav for all 14+ pages
- During Phase 1, nav still shows current/legacy items -- Phase 4 activates the 4-item nav
- Store indicator lives inside the shared nav component
- sw.js must be updated when pages change to prevent stale content
- CACHE_VERSION must be bumped on every deployment that changes HTML/JS/CSS

### Claude's Discretion
- Store indicator visual design details (text badge vs mini cone + text)
- Nav visual style (top bar vs bottom tab bar)
- Multi-store indicator treatment (primary only vs count badge)
- Geolocation denial fallback (show picker, show popular stores, etc.)
- Store change interaction pattern (inline/modal/drawer)
- Animation/transition details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOR-01 | First-time visitor is geolocated to nearest store automatically on page load | Geolocation flow exists in index.html inline JS (lines 574-610); needs extraction into shared module. IP fallback via ip-api.com/json already works. haversineMiles from CustardPlanner sorts stores by distance. |
| STOR-02 | First-visit geolocation shows confirmation prompt ("Showing flavors for [store] -- change?") | New UI element in shared-nav.js store indicator. No existing implementation -- must be built. |
| STOR-03 | User sees compact store indicator in header showing current store name and city | CustardPlanner.getPrimaryStoreSlug() returns saved slug; store metadata (name, city) available from /api/v1/stores manifest. Indicator rendered by shared-nav.js. |
| STOR-04 | User can tap "change" on store indicator to open full store picker on demand | Existing store search/filter logic in index.html (lines 405-445) renders filtered dropdown. Needs extraction into shared-nav.js so it works on all pages. |
| STOR-05 | Store selection persists across pages via existing localStorage mechanism | Already works via `custard-primary` localStorage key + CustardPlanner.setPrimaryStoreSlug(). shared-nav.js reads this on every page load. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES5-compatible IIFE) | N/A | All module code | Existing pattern -- no build step, no framework |
| Browser Geolocation API | Web standard | Precise location refinement | Built into all modern browsers, no library needed |
| localStorage | Web standard | Store preference persistence | Already in use (`custard-primary`, `custard:v1:preferences`) |
| Service Worker (Cache API) | Web standard | Offline support, asset caching | Already in sw.js with stale-while-revalidate |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ip-api.com/json | External API | IP-based geolocation fallback | When browser geolocation is denied/unavailable |
| CustardPlanner IIFE | Existing | Store state, haversine, brand utils | All store-related operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IIFE pattern | ES modules | Would require build step or `type="module"` -- breaks existing pattern |
| ip-api.com | ipinfo.io | ip-api.com already in codebase, free tier sufficient |

## Architecture Patterns

### Recommended Project Structure
```
docs/
  shared-nav.js          # NEW: IIFE module for nav + store indicator
  planner-shared.js      # EXISTING: store prefs, haversine, utilities
  sw.js                  # EXISTING: updated STATIC_ASSETS + CACHE_VERSION
  style.css              # EXISTING: add nav/indicator styles
  *.html                 # ALL: replace inline nav with <div id="shared-nav">
```

### Pattern 1: IIFE Module with DOM Injection
**What:** shared-nav.js declares `window.SharedNav = (function() { ... })()` which auto-initializes on DOMContentLoaded and injects nav HTML into a placeholder element.
**When to use:** For any new JS module in this codebase.
**Example:**
```javascript
// shared-nav.js -- follows existing CustardPlanner pattern
var SharedNav = (function() {
  'use strict';

  var NAV_CONTAINER_ID = 'shared-nav';
  var NAV_ITEMS = [
    { href: 'index.html', label: 'Forecast' },
    { href: 'calendar.html', label: 'Calendar' },
    { href: 'map.html', label: 'Map' },
    { href: 'radar.html', label: 'Radar' },
    { href: 'alerts.html', label: 'Alerts' },
    { href: 'siri.html', label: 'Siri' },
    { href: 'forecast-map.html', label: 'Fronts' },
    { href: 'quiz.html', label: 'Quiz' },
    { href: 'widget.html', label: 'Widget' },
    { href: 'scoop.html', label: 'The Scoop' },
    { href: 'group.html', label: 'Group' },
  ];

  function getCurrentPage() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return file;
  }

  function renderNav(container) {
    var currentPage = getCurrentPage();
    var storeSlug = CustardPlanner.getPrimaryStoreSlug();
    // Build store indicator HTML
    var storeIndicatorHTML = buildStoreIndicator(storeSlug);
    // Build nav links HTML
    var navHTML = '<nav class="nav-links">';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var activeClass = (item.href === currentPage) ? ' class="nav-active"' : '';
      navHTML += '<a href="' + item.href + '"' + activeClass + '>' + item.label + '</a>';
    }
    navHTML += '</nav>';
    container.innerHTML = storeIndicatorHTML + navHTML;
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', function() {
    var el = document.getElementById(NAV_CONTAINER_ID);
    if (el) renderNav(el);
  });

  return { renderNav: renderNav };
})();
```

### Pattern 2: Geolocation Progressive Enhancement
**What:** Show IP-based store result immediately. Offer "use precise location" button that triggers `navigator.geolocation.getCurrentPosition()` only on user action.
**When to use:** First-visit flow for STOR-01/STOR-02.
**Example:**
```javascript
// Step 1: On first visit (no custard-primary in localStorage)
// Fetch IP geolocation passively
fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName')
  .then(function(r) { return r.json(); })
  .then(function(geo) {
    // Find nearest store using CustardPlanner.haversineMiles
    var nearest = findNearestStore(geo.lat, geo.lon, allStores);
    // Show confirmation: "Showing flavors for [store] -- change?"
    showFirstVisitPrompt(nearest);
  });

// Step 2: User taps "use precise location" (NOT auto-triggered)
function refinePreciseLocation() {
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var nearest = findNearestStore(pos.coords.latitude, pos.coords.longitude, allStores);
      CustardPlanner.setPrimaryStoreSlug(nearest.slug);
      updateStoreIndicator(nearest);
    },
    function(err) {
      // Fallback: show store picker or popular stores
      showStorePicker();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
  );
}
```

### Pattern 3: HTML Page Simplification
**What:** Each HTML page replaces its inline nav block with a single `<div id="shared-nav"></div>` placeholder and adds `<script src="shared-nav.js"></script>`.
**When to use:** All 14+ HTML pages during Phase 1.
**Example (before):**
```html
<header>
  <h1>Page Title</h1>
  <nav class="nav-links">
    <a href="index.html">Forecast</a>
    <a href="calendar.html">Calendar</a>
    <!-- ... 9 more links ... -->
  </nav>
</header>
```
**Example (after):**
```html
<header>
  <h1>Page Title</h1>
  <div id="shared-nav"></div>
</header>
<script src="planner-shared.js"></script>
<script src="shared-nav.js"></script>
```

### Anti-Patterns to Avoid
- **Inline nav HTML in individual pages:** The entire point of Phase 1 is to eliminate this. Never add nav HTML directly to a page.
- **Auto-prompting for browser geolocation:** CONTEXT.md explicitly forbids this. Only trigger on explicit user action ("use precise location" button).
- **Forgetting to update STATIC_ASSETS in sw.js:** Every new JS/CSS file must be added to the array, and CACHE_VERSION must be bumped.
- **Using ES module syntax:** No `import/export` -- this codebase has no build step and relies on IIFE + window globals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haversine distance | Custom geo math | `CustardPlanner.haversineMiles()` | Already tested and in use across the codebase |
| Store slug persistence | Custom localStorage wrapper | `CustardPlanner.getPrimaryStoreSlug()` / `setPrimaryStoreSlug()` | Handles edge cases (undefined localStorage, cleanup) |
| HTML escaping | Template literals | `CustardPlanner.escapeHtml()` | Already exists, prevents XSS |
| Store search/filter | New search implementation | Extract existing search logic from index.html | 400+ lines of tested search/filter already working |
| IP geolocation | New geolocation service | Existing ip-api.com integration | Already implemented and working in index.html |

**Key insight:** Most of the functionality for STOR-01 through STOR-05 already exists in index.html inline JS and planner-shared.js. The work is extraction and consolidation, not invention.

## Common Pitfalls

### Pitfall 1: Service Worker Caching Stale Pages
**What goes wrong:** After deployment, returning users see old HTML/JS because the service worker serves from cache. The stale-while-revalidate strategy means the FIRST load after deployment shows stale content; only the SECOND load shows fresh content.
**Why it happens:** sw.js uses stale-while-revalidate -- it serves cached content immediately while fetching fresh in the background. If CACHE_VERSION is not bumped, the old cache name persists and the activate handler never clears it.
**How to avoid:** ALWAYS bump `CACHE_VERSION` (e.g., `custard-v7` -> `custard-v8`) when any HTML/JS/CSS changes. Add `shared-nav.js` to `STATIC_ASSETS` array. The activate handler will then delete old caches. Users get fresh content within one page load cycle (stale on first hit, fresh on second).
**Warning signs:** Users reporting they see old nav after deployment.

### Pitfall 2: Race Condition Between IP Geolocation and Store List Fetch
**What goes wrong:** IP geolocation response arrives before the store list is loaded, so `findNearestStore()` has no stores to search.
**Why it happens:** Both are async fetches. The store manifest comes from the Worker API and may be slower.
**How to avoid:** Ensure store list is fetched and cached before attempting nearest-store lookup. Use a Promise-based guard: `storesReady.then(function(stores) { findNearest(lat, lng, stores); })`.
**Warning signs:** First-visit users seeing empty store indicator or fallback instead of nearest store.

### Pitfall 3: FOUC (Flash of Unstyled Content) During JS Nav Render
**What goes wrong:** Page loads with empty `<div id="shared-nav">`, waits for JS to parse and execute, then nav pops in.
**Why it happens:** Nav rendering depends on DOMContentLoaded + JS execution.
**How to avoid:** Keep shared-nav.js small and load it synchronously (not `defer` or `async`). Place the script tag right after the placeholder div. Add a CSS min-height to `#shared-nav` to prevent layout shift.
**Warning signs:** Visible jump when nav renders, CLS (Cumulative Layout Shift) in Lighthouse.

### Pitfall 4: index.html Has Unique Store Search UI
**What goes wrong:** index.html has a full location-bar with search input, geo button, dropdown, and "current store badge" that other pages don't have. Extracting the shared nav must handle index.html's richer UI separately.
**Why it happens:** index.html was the primary entry point and got all the store UX; other pages just have nav links.
**How to avoid:** shared-nav.js renders the compact store indicator on ALL pages. index.html keeps its hero/empty-state/location-bar for first-visit discovery but delegates the header store indicator to shared-nav.js. The "change" tap in the store indicator opens the same picker logic.
**Warning signs:** Duplicate store pickers on index.html, or other pages missing store functionality.

### Pitfall 5: Geolocation Permission Scope
**What goes wrong:** `navigator.geolocation.getCurrentPosition` prompts the user for permission. If denied, the permission is remembered per-origin and subsequent calls fail silently.
**Why it happens:** Browser security model -- permission grant is sticky.
**How to avoid:** Always code the denial path. Check `navigator.permissions.query({name: 'geolocation'})` if available to know state before prompting. Provide manual store picker as fallback. Never assume geolocation will succeed.
**Warning signs:** Users who denied once can never use precise location without clearing site settings.

## Code Examples

### Reading Current Store on Any Page
```javascript
// Source: planner-shared.js lines 461-466
var slug = CustardPlanner.getPrimaryStoreSlug();
// Returns string slug like "mt-horeb" or null if no store saved
```

### Saving Store Selection
```javascript
// Source: planner-shared.js lines 471-474
CustardPlanner.setPrimaryStoreSlug('mt-horeb');
// Writes to localStorage key 'custard-primary'
```

### Current Nav HTML Pattern (duplicated in every page)
```html
<!-- Source: every docs/*.html file -->
<nav class="nav-links" style="margin-top:0.75rem;">
  <a href="index.html">Forecast</a>
  <a href="calendar.html">Calendar</a>
  <a href="map.html">Map</a>
  <a href="radar.html">Radar</a>
  <a href="alerts.html">Alerts</a>
  <a href="siri.html">Siri</a>
  <a href="forecast-map.html">Fronts</a>
  <a href="quiz.html">Quiz</a>
  <a href="widget.html">Widget</a>
  <a href="scoop.html">The Scoop</a>
  <a href="group.html">Group</a>
</nav>
```

### Existing Geolocation Flow (index.html inline, lines 574-610)
```javascript
// Source: index.html lines 574-610
async function geolocateAndSort() {
  geoBtn.disabled = true;
  try {
    // Try browser geolocation first
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('No geolocation'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
  } catch (e) {
    // Fall back to IP-based
    try {
      const geoResp = await fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName');
      const geo = await geoResp.json();
      if (geo.lat && geo.lon) { userLat = geo.lat; userLng = geo.lon; }
    } catch (err) { console.debug('Geolocation unavailable:', err); }
  }
  geoBtn.disabled = false;
  // Sort stores by distance...
}
```
**Note for Phase 1:** The CONTEXT.md decision REVERSES this order: show IP-based first passively, then offer browser geolocation as refinement. The existing code tries browser geolocation first (which triggers a permission prompt). shared-nav.js must flip this order.

### Service Worker Static Assets (sw.js)
```javascript
// Source: sw.js lines 1-21
const CACHE_VERSION = 'custard-v7';
const STATIC_ASSETS = [
  './', './index.html', './calendar.html', './forecast-map.html',
  './quiz.html', './widget.html', './quizzes/engine.js',
  // ... quiz data files ...
  './planner-shared.js', './cone-renderer.js', './todays-drive.js',
  './style.css', './manifest.json', './icon-192.svg', './icon-512.svg',
];
// Phase 1 must add: './shared-nav.js'
// Phase 1 must bump: 'custard-v7' -> 'custard-v8'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Duplicated nav in each HTML file | JS-rendered shared nav (Phase 1 goal) | Phase 1 | Single source of truth for nav items |
| Browser geolocation first (prompt on load) | IP geolocation first, browser as refinement | Phase 1 | No permission prompt until user opts in |
| Static CACHE_VERSION bumped manually | Still manual but documented as required step | Ongoing | Must be part of deployment checklist |

**Key existing assets that should NOT be rewritten:**
- `CustardPlanner` IIFE and its public API -- extend, don't replace
- Store search/filter logic in index.html -- extract into shared module
- sw.js stale-while-revalidate strategy -- correct pattern, just needs discipline

## Open Questions

1. **Store manifest loading strategy for non-index pages**
   - What we know: index.html fetches store list from `/api/v1/stores` or similar endpoint. Other pages don't currently load the full store list.
   - What's unclear: Should shared-nav.js fetch the store manifest on every page, or only when user taps "change"? Fetching on every page adds a network request; fetching on demand adds latency to the picker.
   - Recommendation: Fetch on demand (when user taps "change") to avoid unnecessary API calls on pages where user just wants to read content. Cache the response in sessionStorage for the duration of the visit.

2. **IP geolocation on non-index pages for first visit**
   - What we know: Currently only index.html does IP geolocation. First-time visitors to other pages (e.g., direct link to map.html) won't have a stored store.
   - What's unclear: Should shared-nav.js trigger IP geolocation on ANY page if no store is saved?
   - Recommendation: Yes -- if no `custard-primary` in localStorage, shared-nav.js should passively fetch IP geolocation and suggest nearest store on any page. This satisfies STOR-01 regardless of entry point.

3. **ip-api.com uses HTTP not HTTPS on free tier**
   - What we know: The existing code uses `http://ip-api.com/json/`. The free tier does not support HTTPS.
   - What's unclear: Whether this causes mixed-content warnings on the HTTPS site.
   - Recommendation: Investigate during implementation. If blocked, consider switching to a free HTTPS geolocation API (e.g., ipapi.co offers free HTTPS) or using the Worker as a proxy.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (browser smoke tests) + pytest |
| Config file | `worker/package.json` (npm run test:browser) |
| Quick run command | `cd /Users/chriskaschner/Documents/GitHub/custard/worker && npm run test:browser -- --workers=1` |
| Full suite command | `cd /Users/chriskaschner/Documents/GitHub/custard/worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | First-time visitor geolocated to nearest store | smoke (browser) | Playwright test: load page with no localStorage, verify store indicator appears | -- Wave 0 |
| STOR-02 | First-visit shows confirmation prompt | smoke (browser) | Playwright test: verify "Showing flavors for [store] -- change?" prompt visible | -- Wave 0 |
| STOR-03 | Compact store indicator in header | smoke (browser) | Playwright test: verify `#shared-nav` contains store name element | -- Wave 0 |
| STOR-04 | Tap "change" opens store picker | smoke (browser) | Playwright test: click change button, verify picker visible | -- Wave 0 |
| STOR-05 | Store persists across pages | smoke (browser) | Playwright test: set store on index.html, navigate to calendar.html, verify same store in indicator | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worker && npm run test:browser -- --workers=1`
- **Per wave merge:** `cd worker && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_shared_nav.py` or equivalent Playwright spec -- covers STOR-01 through STOR-05 browser behavior
- [ ] Verify existing Playwright config supports testing GitHub Pages files locally (may need a local HTTP server)
- [ ] Ensure ip-api.com calls can be mocked/stubbed in test environment

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `planner-shared.js` (IIFE pattern, store API, haversine, localStorage keys)
- Direct codebase inspection: `sw.js` (CACHE_VERSION = 'custard-v7', STATIC_ASSETS array, stale-while-revalidate)
- Direct codebase inspection: `index.html` (inline geolocation flow lines 574-610, store search lines 405-445, nav structure line 47-59)
- Direct codebase inspection: All 14 HTML files confirmed to have duplicated `<nav class="nav-links">` blocks

### Secondary (MEDIUM confidence)
- Browser Geolocation API: well-known Web standard, `navigator.geolocation.getCurrentPosition()` with permission model
- ip-api.com free tier: HTTP-only, returns lat/lon/city/regionName

### Tertiary (LOW confidence)
- ip-api.com HTTPS limitation on free tier: needs verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all vanilla JS, no external dependencies, patterns verified in codebase
- Architecture: HIGH - IIFE pattern, DOM injection, and localStorage persistence all confirmed from source
- Pitfalls: HIGH - service worker caching behavior verified from sw.js source; geolocation flow verified from index.html source
- Geolocation flow reversal: HIGH - CONTEXT.md explicitly requires IP-first, browser-second (opposite of current code)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- vanilla JS codebase with no dependency churn)
