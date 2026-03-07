# Phase 2: Today Page - Research

**Researched:** 2026-03-07
**Domain:** Frontend page restructure -- vanilla JS IIFE extraction, HTML simplification, `<details>` progressive disclosure, multi-store row, rarity badges (GitHub Pages, no build step)
**Confidence:** HIGH

## Summary

Phase 2 radically simplifies `docs/index.html` from a ~1,093-line page with ~875 lines of inline JS down to a clean HTML shell backed by a new `today-page.js` IIFE module. The work is a presentation-layer refactor -- no new API endpoints, no new dependencies, no build step. Every API call and data shape already exists; the task is rearranging what renders and extracting the inline script block.

The current index.html contains five major sections that must be removed or restructured: (1) the Today's Drive section (HTML + script + CustardDrive.mount call), (2) the calendar preview section (Google/Apple calendar mock-ups), (3) the prediction bars in the hero card, (4) the store name/freshness meta in the hero, and (5) the existing calendar CTA. In their place, the simplified page order is: hero card (cone + name + description + rarity badge) > flavor signal nudge > multi-store glance row > collapsed `<details>` week-ahead > "Want this every day?" CTA.

The JS extraction is straightforward: the inline `<script>` tag (lines 217-1091 of the current file) becomes `today-page.js` as a `window.CustardToday` IIFE. The module loads stores, loads flavor colors, builds the timeline, renders the hero card, renders the week strip inside a `<details>`, manages the multi-store row, and listens for `sharednav:storechange` events. All data-fetching functions (`loadForecast`, `fetchSignals`) already exist and call existing Worker API endpoints.

**Primary recommendation:** Split the work into three ordered plans: (1) extract inline JS to `today-page.js` IIFE + simplify HTML to remove clutter, (2) add multi-store glance row + `<details>` week-ahead + rarity badge + signal nudge, (3) update sw.js, CSS cleanup, and browser smoke tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hero card layout: Cone left (~120px), text right: flavor name, description, rarity badge
- Rarity badge sits visually with the hero content (placement is Claude's discretion)
- No certainty/prediction badges -- if the data exists, it's confirmed from the source
- Remove the `today-predictions` div entirely
- Remove store name and freshness timestamp from the hero card above-fold area
- Page structure below fold order: hero card > flavor signal nudge > multi-store glance row > collapsed week-ahead > "Want this every day?" CTA
- Remove completely: Today's Drive section (HTML + script tag + CustardDrive.mount call), calendar preview section, score badges, predictions
- todays-drive.js stays in the repo (other pages may use it) but is no longer loaded on index.html
- Replace existing calendar CTA with "Want this every day?" CTA linking to future Get Updates page (Phase 4); until that page exists, link to calendar.html as interim
- Extract ~1,050 lines of inline JS into a separate today-page.js file
- Follow IIFE Revealing Module pattern (window.CustardToday or similar)
- index.html becomes mostly HTML with script tags
- Multi-store glance row: mini cone (renderMiniConeSVG) + flavor name + store city/name per cell; horizontal scroll at 375px; tapping switches hero card and fires sharednav:storechange; data from CustardPlanner.getDrivePreferences activeRoute.stores; only shown when 2+ saved stores
- Week-ahead section: convert to `<details>` element, collapsed by default; content stays the same (day cards with cone + flavor name)
- Flavor signal: one contextual signal inline when relevant; existing signals-section HTML can be adapted

### Claude's Discretion
- Rarity badge visual design and exact placement within hero card
- CTA visual treatment (card style, button style, etc.)
- Whether to keep calendar CTA alongside new "Want this every day?" CTA or replace entirely
- Flavor signal visual treatment
- Loading skeleton updates for the simplified page
- Error state updates
- Empty state updates (first-visit hero still needed)
- Animation/transition details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TDAY-01 | User sees today's flavor at their store above the fold at 375px (cone image, flavor name, description) | Hero card already exists at `#today-section` with `.today-card`. Current layout is cone-left/text-right at `.today-flavor-body` (flex, gap 1rem). Cone uses `renderMiniConeSVG()` -- for ~120px hero, use `renderMiniConeHDSVG()` from cone-renderer.js (18x22 grid, scale 5 = 90x105px). Remove `today-meta`, `today-predictions` divs. Remove `today-badge` (confirmed/estimated). At 375px with 1rem body padding + card padding, content area is ~311px -- cone 120px + 1rem gap + ~175px text fits. |
| TDAY-02 | Rarity tag displays on today's flavor card when the flavor is rare | `/api/v1/today?slug=X` returns `rarity: { appearances, avg_gap_days, label }` where label is "Ultra Rare" (>120d gap) or "Rare" (>60d gap) or null. Existing `renderRarity()` function (lines 686-707) already handles this, using the `#today-rarity` div. CSS classes `.rarity-badge-ultra-rare`, `.rarity-badge-rare` etc. already exist. The text "Shows up roughly every N days at your store" is already implemented. Extract to today-page.js. |
| TDAY-03 | Week-ahead section is a collapsed `<details>` element, not visible by default | Current `#week-section` is a visible section with `.week-strip` (flex horizontal scroll). Wrap in `<details><summary>Week Ahead</summary>...</details>`. Existing CSS `details` styles at line 275 already provide cursor:pointer, color:#005696 for summary. `renderWeekStrip()` function populates `.week-strip` with day cards -- no logic change needed, only HTML structure change. |
| TDAY-04 | If user has multiple stores saved, a compact multi-store row shows today's flavor at each | Data source: `CustardPlanner.getDrivePreferences().activeRoute.stores` returns array of slugs from localStorage `custard:v1:preferences`. For each store slug, need to fetch today's flavor from `/api/v1/today?slug=X`. Use `renderMiniConeSVG()` for mini cones. Store metadata (city, name) from the stores manifest (loaded by `loadStores()` or SharedNav). Horizontal scroll container at 375px. Each cell taps to fire `document.dispatchEvent(new CustomEvent('sharednav:storechange', { detail: { slug } }))` and also call `selectStore()` internally. |
| TDAY-05 | One contextual flavor signal displays inline when relevant (e.g., "peaks on Sundays") | `CustardPlanner.fetchSignals(workerBase, slug, section, list, limit)` already exists (planner-shared.js line 1568). Called with limit=1. Renders into `#signals-section` / `#signals-list`. CSS classes `.hero-signal`, `.signal-card`, `.signal-headline`, `.signal-explanation` all exist. The function calls `/api/v1/signals/{slug}?limit=1`. |
| TDAY-06 | "Want this every day?" CTA links to Get Updates page | New HTML element replaces the `#calendar-cta` section. Until Phase 4 creates the Get Updates page, link to `calendar.html` as interim destination. Decision on whether to keep both CTAs or just the new one is Claude's discretion. |
| TDAY-07 | Page does not contain Drive ranking cards, hero card duplication, calendar preview, mini-map, or score badges | Remove: `#todays-drive-section` (HTML div at line 158-160), `<script src="todays-drive.js">` tag (line 216), `CustardDrive.mount()` call (lines 1038-1051), `#calendar-preview-section` (lines 162-197), `today-predictions` rendering, `today-badge` (confirmed/estimated badges), `today-meta` (store name + freshness), any references to `driveController`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES5/var) | N/A | All page logic | No build step, established codebase pattern |
| IIFE Revealing Module | N/A | Module pattern for today-page.js | Matches `window.CustardPlanner`, `window.CustardDrive`, `window.SharedNav` |
| `<details>/<summary>` | HTML5 | Collapsible week-ahead section | Native progressive disclosure, no JS library needed |
| CSS custom properties | N/A | Brand colors, spacing | Already in use via `:root` variables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cone-renderer.js | N/A | `renderMiniConeSVG()` for mini cones, `renderMiniConeHDSVG()` for hero cone | Every cone rendering |
| planner-shared.js | N/A | `getDrivePreferences()`, `buildTimeline()`, `fetchSignals()`, `getPrimaryStoreSlug()` | Data access and timeline building |
| shared-nav.js | N/A | `sharednav:storechange` event, store indicator | Cross-component store changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<details>` | JS-powered accordion | `<details>` is zero-JS, accessible by default, already styled in style.css |
| Horizontal scroll for multi-store | CSS grid wrap | Horizontal scroll is the established pattern in `.week-strip` and works at 375px |

**Installation:**
```bash
# No installation needed -- vanilla JS, no build step
```

## Architecture Patterns

### Recommended Project Structure
```
docs/
  index.html          # Simplified HTML shell (~200 lines)
  today-page.js       # NEW: extracted page logic IIFE (~600-700 lines)
  planner-shared.js   # Unchanged (utility functions)
  shared-nav.js       # Unchanged (nav + store indicator)
  cone-renderer.js    # Unchanged (SVG cone rendering)
  todays-drive.js     # Unchanged but NO LONGER loaded on index.html
  style.css           # Updated with new/modified rules
  sw.js               # CACHE_VERSION bumped, today-page.js added to STATIC_ASSETS
```

### Pattern 1: IIFE Revealing Module
**What:** All page-level JS modules follow the IIFE pattern that exposes methods via a global.
**When to use:** Every new .js file in docs/.
**Example:**
```javascript
// Source: Established codebase pattern (CustardPlanner, CustardDrive, SharedNav)
var CustardToday = (function () {
  'use strict';

  // Private state
  var _currentSlug = null;
  var _allStores = [];

  // Private functions
  function loadForecast(slug) { /* ... */ }
  function renderHeroCard(day, slug, todayData) { /* ... */ }

  // Public API
  return {
    init: init,
    selectStore: selectStore,
  };
})();
```

### Pattern 2: CustomEvent Communication
**What:** Components communicate via CustomEvent on document.
**When to use:** When multi-store row tap needs to update the hero card and other components.
**Example:**
```javascript
// Source: shared-nav.js established pattern (line from Phase 1)
// Multi-store row cell tap dispatches store change
document.dispatchEvent(new CustomEvent('sharednav:storechange', {
  detail: { slug: storeSlug }
}));
```

### Pattern 3: Data Fetching (Multiple Parallel API Calls)
**What:** Today page fetches from three endpoints simultaneously for the hero card.
**When to use:** On store selection and page load.
**Example:**
```javascript
// Source: Current index.html loadForecast() (lines 611-675)
var [flavorsResp, forecastResp, todayResp] = await Promise.all([
  fetch(WORKER_BASE + '/api/v1/flavors?slug=' + encodeURIComponent(slug)),
  fetch(WORKER_BASE + '/api/v1/forecast/' + encodeURIComponent(slug)),
  fetch(WORKER_BASE + '/api/v1/today?slug=' + encodeURIComponent(slug)),
]);
```

### Pattern 4: Multi-Store Row Fetching
**What:** For each saved store (2-5), fetch today's flavor in parallel.
**When to use:** When rendering the multi-store glance row.
**Example:**
```javascript
// Fetch today's data for each saved store in parallel
var prefs = CustardPlanner.getDrivePreferences({ stores: allStores });
var storeSlugs = prefs.activeRoute.stores;
if (storeSlugs.length >= 2) {
  var fetchPromises = storeSlugs.map(function(slug) {
    return fetch(WORKER_BASE + '/api/v1/today?slug=' + encodeURIComponent(slug))
      .then(function(r) { return r.ok ? r.json() : null; })
      .catch(function() { return null; });
  });
  Promise.all(fetchPromises).then(function(results) {
    renderMultiStoreRow(storeSlugs, results);
  });
}
```

### Anti-Patterns to Avoid
- **Loading todays-drive.js on index.html:** The `<script src="todays-drive.js">` tag and `CustardDrive.mount()` call must be removed. todays-drive.js stays in the repo for other pages (scoop.html).
- **Mixing `let`/`const` with `var`:** The current inline JS uses both. The new today-page.js IIFE must use `var` throughout to match the codebase convention (no build step, ES5 compat).
- **Direct localStorage access for multi-store data:** Use `CustardPlanner.getDrivePreferences()` which handles parsing, defaults, and validation. Do not read `custard:v1:preferences` directly.
- **Building custom accordion JS:** Use native `<details>/<summary>` elements. CSS is already in style.css.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible section | Custom JS accordion | `<details>/<summary>` HTML5 | Zero JS, accessible, already styled |
| Timeline building | Custom date iteration | `CustardPlanner.buildTimeline()` | Handles confirmed/predicted/none with forecast fallback |
| Store preferences | Direct localStorage parsing | `CustardPlanner.getDrivePreferences()` | Handles migration, validation, sanitization of legacy formats |
| Signal fetching | Custom API call + rendering | `CustardPlanner.fetchSignals()` | Handles IntersectionObserver tracking, card HTML, error swallowing |
| Rarity label logic | Custom gap-to-label mapping | Use the label from `/api/v1/today` response | Server already computes "Ultra Rare"/"Rare" from D1 data |
| Cone rendering | Custom SVG | `renderMiniConeSVG()` and `renderMiniConeHDSVG()` | Profile-aware pixel art with toppings, ribbons, highlights |
| Store change events | Custom pub/sub | `CustomEvent('sharednav:storechange')` | Established cross-component pattern |
| HTML escaping | Manual replace chains | `CustardPlanner.escapeHtml()` | Already handles &, <, >, " |

**Key insight:** Almost every piece of functionality needed for the Today page already exists as a function in `planner-shared.js` or `cone-renderer.js`. The work is reorganizing what gets called and when, not building new capabilities.

## Common Pitfalls

### Pitfall 1: Stale Service Worker Serving Old index.html
**What goes wrong:** After restructuring index.html and adding today-page.js, the service worker serves the old cached version. Users see the old page until cache expires.
**Why it happens:** sw.js has `CACHE_VERSION = 'custard-v11'` and `STATIC_ASSETS` list. New files must be added and version bumped.
**How to avoid:** Bump `CACHE_VERSION` to `'custard-v12'` (or higher if other changes intervened). Add `'./today-page.js'` to `STATIC_ASSETS` array. Remove `'./todays-drive.js'` from the array since index.html no longer loads it (but keep the file in the repo).
**Warning signs:** Browser shows old layout after deployment. Check Application > Service Workers in DevTools.

### Pitfall 2: CustardDrive.mount() Fails When Script Not Loaded
**What goes wrong:** If `todays-drive.js` is removed from the script tags but the inline JS still references `CustardDrive`, a ReferenceError crashes the page.
**Why it happens:** The current init() function calls `CustardDrive.mount()` (line 1038). The new today-page.js must not reference CustardDrive at all.
**How to avoid:** When extracting to today-page.js, remove all references to `driveController`, `CustardDrive.mount()`, and the `onPrimaryStoreChange` callback.
**Warning signs:** Console error "CustardDrive is not defined". Hero card never renders.

### Pitfall 3: Multi-Store Row Data Race
**What goes wrong:** `CustardPlanner.getDrivePreferences()` returns store slugs from localStorage, but the stores manifest hasn't loaded yet, so store metadata (city, name) is unavailable.
**Why it happens:** `getDrivePreferences()` reads from localStorage synchronously, but store metadata comes from `stores.json` fetch.
**How to avoid:** Wait for stores manifest to load before rendering multi-store row. The existing pattern waits for `loadStores()` in `init()` via `Promise.all([loadStores(), loadFlavorColors()])`.
**Warning signs:** Multi-store cells show slug strings instead of city names.

### Pitfall 4: Above-the-Fold Height Exceeds 375px Viewport
**What goes wrong:** The hero card with cone + name + description + rarity badge exceeds the viewport height on a 375x667 iPhone SE screen.
**Why it happens:** Header (h1 + subtitle + shared-nav) takes ~140px. Hero card with 120px cone, text, and rarity badge adds another ~200px. Total must be under ~550px (667px minus browser chrome).
**How to avoid:** Measure the rendered height at 375px width. Header + hero card should fit within ~500px. The current hero card is already compact -- removing predictions and meta makes it shorter. Test with Chrome DevTools responsive mode at 375x667.
**Warning signs:** Description or rarity badge pushed below the fold.

### Pitfall 5: `var` vs `let`/`const` Inconsistency
**What goes wrong:** The current inline JS mixes `let`/`const` (modern) with `var` (ES5). The codebase convention for external .js files is `var` throughout.
**Why it happens:** The inline JS was written incrementally without strict convention enforcement.
**How to avoid:** The new today-page.js must use `var` throughout, matching `planner-shared.js`, `shared-nav.js`, `cone-renderer.js`, and `todays-drive.js`.
**Warning signs:** Code review inconsistency. Not a runtime error, but violates established pattern.

### Pitfall 6: Orphaned CSS Rules
**What goes wrong:** Removing HTML sections (calendar preview, drive section, predictions) leaves dead CSS in style.css, adding weight without purpose.
**Why it happens:** CSS rules for `.calendar-preview-*`, `.prediction-*` are no longer used by any element on index.html.
**How to avoid:** Do NOT remove the CSS rules that may be used by other pages (e.g., `todays-drive.js` styles are used on scoop.html). Only clean up rules specific to index.html sections that no other page uses. The calendar-preview CSS can be removed since it only appeared on index.html.
**Warning signs:** style.css grows without bound. Run a CSS coverage check in DevTools.

### Pitfall 7: Multi-Store Row Shows for Single-Store Users
**What goes wrong:** The multi-store row renders with a single store cell, which is redundant with the hero card.
**Why it happens:** `getDrivePreferences()` may return a 1-store array if the user only has a primary store.
**How to avoid:** Only render the multi-store row when `storeSlugs.length >= 2`. The CONTEXT.md explicitly states "Only shown when user has 2+ saved stores."
**Warning signs:** A single-cell row that duplicates the hero card flavor.

## Code Examples

Verified patterns from the existing codebase:

### Hero Card Rendering (current, to be adapted)
```javascript
// Source: docs/index.html lines 749-828
function renderTodayCard(day, slug, fetchedAt, forecast, todayData) {
  var store = allStores.find(function(s) { return s.slug === slug; });
  var brand = brandFromSlug(slug);
  var color = BRAND_COLORS[brand] || '#005696';

  if (day.type === 'confirmed') {
    todayCard.style.borderLeftColor = color;
    // Use HD cone for hero (~120px)
    todayCone.innerHTML = renderMiniConeHDSVG(day.flavor);
    todayCone.hidden = false;
    todayFlavor.textContent = day.flavor;
    todayDesc.textContent = day.description || '';
    todayDesc.hidden = !day.description;
    renderRarity(todayData && todayData.rarity);
  }
  // ... no-data state ...
  todaySection.hidden = false;
}
```

### Rarity Badge Rendering (existing, extract to today-page.js)
```javascript
// Source: docs/index.html lines 686-707
function renderRarity(rarity) {
  if (!rarity) {
    todayRarity.hidden = true;
    return;
  }
  var html = '';
  if (rarity.label) {
    var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
    html += '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
    if (rarity.avg_gap_days) {
      html += 'Shows up roughly every ' + rarity.avg_gap_days + ' days at your store';
    }
  }
  if (html) {
    todayRarity.innerHTML = html;
    todayRarity.hidden = false;
  } else {
    todayRarity.hidden = true;
  }
}
```

### Multi-Store Data Source (existing API)
```javascript
// Source: docs/planner-shared.js getDrivePreferences()
// Returns: { activeRoute: { stores: ['mt-horeb', 'verona', 'madison-east'] }, ... }
var prefs = CustardPlanner.getDrivePreferences({ stores: allStores });
var savedStores = prefs.activeRoute.stores; // array of slugs
```

### Collapsed Week-Ahead HTML Structure
```html
<!-- New structure: <details> wrapping existing week-strip -->
<details id="week-section">
  <summary>
    <h2 style="display:inline;">Week Ahead</h2>
  </summary>
  <div class="week-strip" id="week-strip"></div>
</details>
```

### Multi-Store Row HTML Structure
```html
<!-- New section: multi-store glance row -->
<section id="multi-store-section" hidden>
  <div class="multi-store-row" id="multi-store-row">
    <!-- JS-rendered cells:
    <button class="multi-store-cell" data-slug="verona">
      <div class="multi-store-cone">[mini cone SVG]</div>
      <div class="multi-store-flavor">Chocolate Eclair</div>
      <div class="multi-store-name">Verona, WI</div>
    </button>
    -->
  </div>
</section>
```

### "Want This Every Day?" CTA
```html
<!-- Replaces #calendar-cta -->
<section id="updates-cta" hidden>
  <div class="updates-cta-card">
    <strong>Want this every day?</strong>
    <p>Get daily flavors in your calendar, on your phone, or via email.</p>
    <a href="calendar.html" class="btn-primary" id="updates-cta-link">Set it up</a>
  </div>
</section>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 875+ lines inline JS in index.html | External today-page.js IIFE | Phase 2 (this phase) | Maintainability, testability, caching |
| Always-visible week strip | `<details>` collapsed by default | Phase 2 (this phase) | Content above fold, progressive disclosure |
| Today's Drive ranking cards on homepage | Removed from index, kept on scoop.html | Phase 2 (this phase) | Simplified single-flavor answer |
| Calendar preview mock-ups on homepage | Removed entirely | Phase 2 (this phase) | Reduced clutter |
| Prediction bars for estimated flavors | No prediction UI (data is confirmed or absent) | Phase 2 (this phase) | Simpler mental model |

**Deprecated/outdated:**
- `today-predictions` div: Removing entirely. Predictions added complexity without user value since data is ~30 days confirmed.
- `calendar-preview-section`: Moving setup flows to Phase 4 Get Updates page.
- `CustardDrive.mount()` on index.html: Drive features live on other surfaces.

## Open Questions

1. **HD Cone Size for Hero Card**
   - What we know: `renderMiniConeHDSVG(flavorName, scale)` with default scale=5 produces 90x105px. With scale=6, it produces 108x126px.
   - What's unclear: Whether scale 5 (90px wide) or scale 6 (~108px wide) best fits the "~120px" cone target.
   - Recommendation: Use scale 6 for closest to 120px target. Can be adjusted during implementation.

2. **Multi-Store API Call Volume**
   - What we know: For a user with 5 saved stores, the multi-store row triggers 5 additional `/api/v1/today` calls. Each is cached at the edge for 1 hour.
   - What's unclear: Whether 5 parallel API calls add noticeable latency on slow connections.
   - Recommendation: Fire them in parallel (`Promise.all`), render progressively as each resolves, show skeleton cells initially. If all 5 fail, hide the row gracefully.

3. **Empty State After Restructuring**
   - What we know: Current empty state (`#empty-state`) shows "New here?" hero with "Find your store" button and quick-start stores. This still makes sense after restructuring.
   - What's unclear: Whether the empty state needs visual updates to match the simplified page feel.
   - Recommendation: Keep existing empty state as-is for Phase 2. Visual polish is Phase 5 scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via worker/node_modules, config at worker/playwright.config.mjs) |
| Config file | worker/playwright.config.mjs |
| Quick run command | `cd custard-calendar/worker && npx playwright test test/browser/FILE.spec.mjs --workers=1` |
| Full suite command | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TDAY-01 | Hero card shows cone + flavor name + description above fold at 375px | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` | No -- Wave 0 |
| TDAY-02 | Rarity badge displays when flavor is rare | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` (same file, separate test) | No -- Wave 0 |
| TDAY-03 | Week-ahead is collapsed `<details>`, not visible by default | browser/e2e | `npx playwright test test/browser/today-week-ahead.spec.mjs --workers=1` | No -- Wave 0 |
| TDAY-04 | Multi-store row shows when 2+ stores saved | browser/e2e | `npx playwright test test/browser/today-multistore.spec.mjs --workers=1` | No -- Wave 0 |
| TDAY-05 | Signal nudge displays when relevant | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` (test within hero file) | No -- Wave 0 |
| TDAY-06 | "Want this every day?" CTA present and links correctly | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` | No -- Wave 0 |
| TDAY-07 | Removed sections are absent (Drive, calendar preview, etc.) | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs --workers=1` (negative assertions) | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx playwright test test/browser/today-hero.spec.mjs test/browser/today-multistore.spec.mjs test/browser/today-week-ahead.spec.mjs --workers=1`
- **Per wave merge:** `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Phase gate:** Full browser suite + `cd custard-calendar/worker && npm test` (574 worker tests) green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `worker/test/browser/today-hero.spec.mjs` -- covers TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07
- [ ] `worker/test/browser/today-multistore.spec.mjs` -- covers TDAY-04
- [ ] `worker/test/browser/today-week-ahead.spec.mjs` -- covers TDAY-03
- [ ] Framework install: none needed -- Playwright already installed in worker/node_modules

### Test Pattern Reference
The existing `worker/test/browser/shared-nav-store.spec.mjs` provides the canonical browser test pattern:
1. Mock API routes via `context.route()` (stores.json, /api/v1/today, /api/v1/geolocate, /api/v1/signals)
2. Navigate to `/index.html`
3. Manipulate localStorage to set store state
4. Assert DOM elements visible/hidden
5. Assert text content matches expected flavor data

## Sources

### Primary (HIGH confidence)
- `docs/index.html` (1,093 lines) -- full current page, all inline JS examined
- `docs/planner-shared.js` (1,624 lines) -- getDrivePreferences(), buildTimeline(), fetchSignals(), actionCTAsHTML()
- `docs/cone-renderer.js` (324 lines) -- renderMiniConeSVG(), renderMiniConeHDSVG()
- `docs/shared-nav.js` (575 lines) -- sharednav:storechange event pattern
- `docs/todays-drive.js` (1,118 lines) -- CustardDrive module to be removed from index.html
- `docs/sw.js` (78 lines) -- CACHE_VERSION, STATIC_ASSETS list
- `docs/style.css` (3,340 lines) -- existing .today-*, .rarity-*, .week-*, .signal-*, details/summary styles
- `worker/src/route-today.js` (172 lines) -- /api/v1/today response shape including rarity
- `worker/test/browser/shared-nav-store.spec.mjs` -- browser test pattern
- `worker/playwright.config.mjs` -- test framework config

### Secondary (MEDIUM confidence)
- MDN `<details>` element docs -- native collapsible, no polyfill needed for target browsers
- Phase 1 CONTEXT.md/RESEARCH.md -- established patterns and decisions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing codebase patterns
- Architecture: HIGH -- direct extraction of existing code into established IIFE pattern
- Pitfalls: HIGH -- all pitfalls identified from direct code reading of current index.html
- Validation: HIGH -- Playwright test infrastructure already exists with established patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable codebase, no external dependency drift)
