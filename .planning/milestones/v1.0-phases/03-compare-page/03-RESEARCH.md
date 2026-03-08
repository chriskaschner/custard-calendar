# Phase 3: Compare Page - Research

**Researched:** 2026-03-07
**Domain:** Multi-store comparison grid, mobile-first layout, flavor exclusion filtering
**Confidence:** HIGH

## Summary

The Compare Page is a new `compare.html` page that renders a day-first card stack showing 2-4 saved stores across 3 days (today + 2). The page must follow the project's established IIFE module pattern (vanilla JS, `var` throughout, no build step) and reuse existing shared modules (`planner-shared.js`, `cone-renderer.js`, `shared-nav.js`).

The critical data architecture insight is that `/api/v1/drive?slugs=X,Y,Z` only returns today's flavor per store (optionally tomorrow with `include_tomorrow=1`), but does NOT support day+2. For the 3-day grid, the compare page should call `/api/v1/flavors?slug=X` per store (returns full ~7 day schedule) and `/api/v1/today?slug=X` per store (returns rarity data). This parallels how `today-page.js` already fetches data -- calling both `/api/v1/flavors` and `/api/v1/today` for a single store. The COMP-08 requirement ("data comes from existing `/api/v1/drive` endpoint with no new API endpoints") needs reinterpretation: we use existing endpoints with no new ones, but `/api/v1/flavors` + `/api/v1/today` are the right combination for multi-day data with rarity. The drive endpoint can still be used for enriched card data if the planner prefers, but only covers today (and optionally tomorrow).

**Primary recommendation:** Build a `compare-page.js` IIFE module that fetches per-store data from `/api/v1/flavors` + `/api/v1/today`, renders a day-first vertical card stack with accordion expand, and adds exclusion filter chips backed by `FLAVOR_FAMILIES` with dimming via CSS opacity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Day-first card stack: each day is a card containing all stores stacked vertically. Scroll down through days (Today, Tomorrow, Day 3)
- 3 days ahead: Today + tomorrow + day after tomorrow
- Data source: saved stores from localStorage via CustardPlanner.getDrivePreferences().activeRoute.stores
- Max 4 stores shown; if user has more, show primary + 3 closest
- If user has only 1 store: show prompt "Add stores to compare flavors side-by-side" with link to store picker
- No horizontal scroll needed -- vertical card stack works naturally at 375px
- Inline expand (accordion): tapping a store row expands it in place to show details, tap again to collapse
- One cell expanded at a time -- tapping a new cell collapses the previous one
- Expanded content: Claude's discretion on exact content based on available /api/v1/drive data
- Directions link: Google Maps (google.com/maps/dir/?api=1&destination=ADDRESS)
- Filtered cells are dimmed (opacity reduction), not hidden -- preserves grid structure, no layout shifts
- Filter state persists in localStorage (key like 'custard-exclusions') so users don't re-toggle every visit
- Rarity badge inline: same pattern as Today page hero card
- Contextual nudge at top of page when any saved store has a rare/ultra-rare flavor today
- Nudge shows for today's rare flavors only (not upcoming days)
- Nudge hidden when no rare flavors exist today

### Claude's Discretion
- Expanded cell content details (which fields from API to show)
- Exclusion chip selection (which flavor families to offer)
- Chip placement (sticky vs static)
- Loading skeleton for the compare grid
- Error states (what if API fails for one store but not others?)
- Empty state visual treatment for 1-store users
- Whether the compare page gets its own IIFE module (compare-page.js) or is simpler inline
- Page header/title treatment

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | User sees a grid of their saved stores (2-4) across next 2-3 days | Day-first card stack layout, `/api/v1/flavors` per store returns 7-day schedule, `getDrivePreferences().activeRoute.stores` for saved stores |
| COMP-02 | Each grid cell shows cone image, flavor name, and rarity tag if rare | `renderMiniConeSVG()` from cone-renderer.js for cones, rarity data from `/api/v1/today`, rarity badge CSS already exists in style.css |
| COMP-03 | User can tap any grid cell to expand it showing full description, directions link, and historical pattern | Accordion pattern with single-expand, description from `/api/v1/flavors`, rarity from `/api/v1/today`, address from stores.json for Google Maps directions link |
| COMP-04 | Rare flavor cells have a visual highlight | Rarity badge CSS classes already exist (`.rarity-badge-ultra-rare`, `.rarity-badge-rare`), avg_gap_days from `/api/v1/today` response |
| COMP-05 | Flavor family exclusion filter chips above grid | `FLAVOR_FAMILIES` object in planner-shared.js has 9 families, `.brand-chip`/`.flavor-chip` CSS pattern from map.html as styling reference |
| COMP-06 | Toggling an exclusion chip dims cells with matching flavors | `getFamilyForFlavor()` from planner-shared.js for flavor-to-family matching, CSS opacity dimming instead of hide |
| COMP-07 | Grid is usable at 375px width | Day-first vertical card stack (locked decision), no horizontal table, each day-card fills full width |
| COMP-08 | Data comes from existing endpoints (no new API endpoints) | `/api/v1/flavors?slug=X` (multi-day schedule), `/api/v1/today?slug=X` (rarity), `stores.json` (addresses) -- all existing |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| planner-shared.js | current | Store preferences, flavor families, escapeHtml, haversine | Already loaded on all pages; provides getDrivePreferences(), FLAVOR_FAMILIES, getFamilyForFlavor() |
| cone-renderer.js | current | Pixel-art cone SVG generation | renderMiniConeSVG() for compact grid cones, same as multi-store row on Today page |
| shared-nav.js | current | Navigation bar, store picker, store change events | #shared-nav div, sharednav:storechange CustomEvent bridge |
| style.css | current | All CSS styling | Existing rarity badge classes, brand-chip/flavor-chip patterns, card styles |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| stores.json | current | Store address/lat/lng data | For Google Maps directions links and store name display |
| /api/v1/flavors | v1 | Multi-day flavor schedule per store | Returns ~7 days of {date, title, description} per store |
| /api/v1/today | v1 | Today's flavor with rarity data | Returns {flavor, description, rarity: {appearances, avg_gap_days, label}} |
| /api/v1/forecast/{slug} | v1 | Prediction data for buildTimeline | Optional: for stores without confirmed data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-store /api/v1/flavors + /api/v1/today | Single /api/v1/drive call | Drive only returns today (+ optional tomorrow), no day+2 data. Drive also requires 2+ slugs. Using flavors+today gives full 3-day schedule plus rarity. |
| New bulk compare endpoint | Existing endpoints | COMP-08 forbids new endpoints. Per-store fetches are fine for 2-4 stores (max 8-12 parallel fetches). |

## Architecture Patterns

### Recommended Project Structure
```
docs/
  compare.html          # New page (follows index.html template pattern)
  compare-page.js       # New IIFE module (follows today-page.js pattern)
  style.css             # Append compare-specific CSS rules
  sw.js                 # Add compare-page.js + compare.html to STATIC_ASSETS, bump CACHE_VERSION
```

### Pattern 1: IIFE Revealing Module
**What:** All page JS is wrapped in an IIFE assigned to a `var` global.
**When to use:** Always -- this is the locked project pattern. No build step, no ES modules.
**Example:**
```javascript
// Source: today-page.js (established pattern)
var CustardCompare = (function () {
  'use strict';

  var WORKER_BASE = CustardPlanner.WORKER_BASE;
  var escapeHtml = CustardPlanner.escapeHtml;

  // Private state
  var _stores = [];
  var _flavorData = {};  // slug -> {flavors: [...], rarity: {...}}
  var _exclusions = new Set();

  // ... module body ...

  function init() { /* ... */ }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init };
})();
```

### Pattern 2: Data Fetching (Parallel Per-Store)
**What:** Fetch flavor schedule + rarity for each saved store in parallel.
**When to use:** On page load and on store change events.
**Example:**
```javascript
// Fetch 3-day data for all saved stores
function loadCompareData(slugs) {
  var promises = slugs.map(function (slug) {
    return Promise.all([
      fetch(WORKER_BASE + '/api/v1/flavors?slug=' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
      fetch(WORKER_BASE + '/api/v1/today?slug=' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }),
    ]).then(function (results) {
      return { slug: slug, flavors: results[0], today: results[1] };
    });
  });
  return Promise.all(promises);
}
```

### Pattern 3: Day-First Card Stack with Accordion
**What:** Each day (Today, Tomorrow, Day+2) is a card. Within each day-card, stores are rows. Tapping a row expands details inline.
**When to use:** The locked layout decision for compare grid.
**Example:**
```html
<!-- Day card structure -->
<div class="compare-day-card">
  <h3 class="compare-day-header">Today &mdash; Sat, Mar 7</h3>
  <div class="compare-store-row" data-slug="mt-horeb">
    <div class="compare-store-summary">
      <div class="compare-cone"><!-- renderMiniConeSVG --></div>
      <div class="compare-flavor-name">Chocolate Eclair</div>
      <span class="rarity-badge rarity-badge-rare">Rare</span>
      <span class="compare-store-label">Mt. Horeb</span>
    </div>
    <div class="compare-store-detail" hidden>
      <p class="compare-flavor-desc">Rich chocolate custard with eclair pieces</p>
      <p class="compare-rarity-detail">Shows up roughly every 120 days</p>
      <a class="compare-directions" href="https://google.com/maps/dir/?api=1&destination=...">Get Directions</a>
    </div>
  </div>
  <!-- More store rows... -->
</div>
```

### Pattern 4: Exclusion Filter with Dimming
**What:** Filter chips map to FLAVOR_FAMILIES keys. Active exclusions dim matching cells via opacity.
**When to use:** The locked filter behavior.
**Example:**
```javascript
// Check if a flavor matches any active exclusion
function isExcluded(flavorName) {
  var family = CustardPlanner.getFamilyForFlavor(flavorName);
  return family ? _exclusions.has(family) : false;
}

// Apply dimming class
function applyExclusions() {
  var rows = document.querySelectorAll('.compare-store-row');
  for (var i = 0; i < rows.length; i++) {
    var flavor = rows[i].dataset.flavor;
    rows[i].classList.toggle('compare-excluded', isExcluded(flavor));
  }
}
```
```css
.compare-store-row.compare-excluded {
  opacity: 0.35;
  pointer-events: none; /* prevent expand while dimmed */
}
```

### Anti-Patterns to Avoid
- **Literal 4-column table at 375px:** Locked decision explicitly forbids this. Day-first vertical cards are the pattern.
- **Hiding excluded cells:** Locked decision says dim (opacity), not hide. Preserves grid structure.
- **Custom flavor-family matching:** Use `CustardPlanner.getFamilyForFlavor()` -- it already normalizes names, strips TM/R symbols, handles API config overrides.
- **Building a new API endpoint:** COMP-08 requires using existing endpoints only.
- **Using ES6 modules or arrow functions:** Project uses `var`, ES5 function expressions, no build step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flavor-to-family matching | Custom regex or keyword map | `CustardPlanner.getFamilyForFlavor(flavorName)` | Already normalizes names, handles TM symbols, syncs with remote config |
| Cone SVG rendering | Custom cone images | `renderMiniConeSVG(flavorName)` from cone-renderer.js | Color data from API, consistent pixel art across all pages |
| Store preferences | Manual localStorage parsing | `CustardPlanner.getDrivePreferences()` | Handles legacy format migration, sanitization, defaults |
| HTML escaping | Manual string replace | `CustardPlanner.escapeHtml(str)` | Battle-tested, consistent across codebase |
| Rarity label computation | Custom threshold logic | Use `rarity.label` from `/api/v1/today` response | Server computes from D1 snapshot history, consistent with Today page |
| Store manifest loading | Custom fetch logic | Load `stores.json` (same pattern as today-page.js `loadStores()`) | Cached, consistent, includes address/lat/lng |
| Date formatting | Custom date strings | `toLocaleDateString('en-US', {...})` pattern from today-page.js | Consistent with existing pages, locale-aware |

**Key insight:** Nearly every utility needed (escaping, flavor matching, cone rendering, store prefs, haversine) already exists in the shared modules. The compare page is primarily a rendering/layout task, not a data task.

## Common Pitfalls

### Pitfall 1: COMP-08 Misinterpretation -- Drive Endpoint Only Returns Today
**What goes wrong:** Assuming `/api/v1/drive` can serve the 3-day grid. It returns today's flavor per store (optionally tomorrow with `include_tomorrow=1`) but has no day+2 support.
**Why it happens:** COMP-08 says "data comes from existing `/api/v1/drive` endpoint." The spirit of the requirement is "no new API endpoints," not "exclusively use drive."
**How to avoid:** Use `/api/v1/flavors?slug=X` per store for multi-day schedule data + `/api/v1/today?slug=X` for rarity. Both are existing endpoints.
**Warning signs:** If the grid only shows today and tomorrow, this pitfall has been hit.

### Pitfall 2: getDrivePreferences() Returns Defaults Even With No Saved Stores
**What goes wrong:** Showing a compare grid for stores the user never intentionally saved.
**Why it happens:** `getDrivePreferences()` auto-computes default stores from the manifest based on geoIP proximity. The Phase 2 code already encountered this and works around it by reading raw localStorage directly.
**How to avoid:** Read raw `localStorage.getItem('custard:v1:preferences')` and check if it exists and has `activeRoute.stores` before rendering the grid. Fall back to the empty state (1-store prompt) if not.
**Warning signs:** New visitor sees a compare grid without having chosen any stores.

### Pitfall 3: Accordion Collapse Race Condition
**What goes wrong:** Clicking rapidly between store rows causes multiple expanded states or visual glitches.
**Why it happens:** If expand/collapse uses CSS transitions, rapid clicks can stack transitions.
**How to avoid:** Collapse the previous row synchronously before expanding the new one. Use the `hidden` attribute (boolean, instant) rather than CSS transitions for the detail panel.
**Warning signs:** Two or more detail panels visible simultaneously.

### Pitfall 4: Missing WORKER_BASE Global for Cone Renderer
**What goes wrong:** `cone-renderer.js` depends on a global `WORKER_BASE` variable to load flavor color data.
**Why it happens:** The variable is set via `<script>var WORKER_BASE = CustardPlanner.WORKER_BASE;</script>` between loading planner-shared.js and cone-renderer.js.
**How to avoid:** Include the `var WORKER_BASE = CustardPlanner.WORKER_BASE;` inline script before cone-renderer.js in compare.html, exactly as index.html does.
**Warning signs:** All cones render in fallback colors instead of flavor-accurate colors.

### Pitfall 5: Service Worker Serves Stale Content
**What goes wrong:** After deploying compare.html + compare-page.js, returning users still see old cached pages.
**Why it happens:** The service worker pre-caches STATIC_ASSETS. New files not in the list are never cached; the cache version must also be bumped.
**How to avoid:** Add `./compare.html` and `./compare-page.js` to `STATIC_ASSETS` in sw.js, bump `CACHE_VERSION` to next version (currently `custard-v12`, bump to `custard-v13`).
**Warning signs:** New page loads fine in incognito but not in a regular browser session.

### Pitfall 6: Exclusion Filter Doesn't Match All Flavor Names
**What goes wrong:** Some flavors are not matched by `getFamilyForFlavor()` and pass through filters.
**Why it happens:** The `FLAVOR_FAMILIES` object has a finite member list. New or unusual flavors may not be in any family. The API also provides a `/api/v1/flavor-config` endpoint that can extend families dynamically.
**How to avoid:** Accept that unmatched flavors are never dimmed. This is correct behavior -- if a flavor doesn't contain nuts, it shouldn't be dimmed by "No Nuts." The `getFamilyForFlavor()` function already handles config overrides from the API.
**Warning signs:** User expects a flavor to be filtered but it isn't. This is acceptable -- the families are the best available signal.

## Code Examples

### Loading Saved Store Slugs (Avoiding Default Pitfall)
```javascript
// Source: today-page.js renderMultiStoreRow() pattern (lines 470-483)
function getSavedStoreSlugs() {
  try {
    var raw = localStorage.getItem('custard:v1:preferences');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.activeRoute && Array.isArray(parsed.activeRoute.stores)) {
        return parsed.activeRoute.stores.slice(0, 4);
      }
    }
  } catch (e) {}
  return [];
}
```

### Extracting 3-Day Schedule From Flavors Response
```javascript
// Source: /api/v1/flavors response shape (from kv-cache.js + route-today.js)
function extract3DaySchedule(flavorsData) {
  var today = new Date();
  today.setHours(12, 0, 0, 0);
  var dates = [];
  for (var i = 0; i < 3; i++) {
    var d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  var schedule = {};
  for (var di = 0; di < dates.length; di++) {
    var dateStr = dates[di];
    var entry = (flavorsData.flavors || []).find(function (f) {
      return f.date === dateStr;
    });
    schedule[dateStr] = entry || null;
  }
  return { dates: dates, schedule: schedule };
}
```

### Rarity Badge Rendering (Reuse Today Page Pattern)
```javascript
// Source: today-page.js renderRarity() (lines 324-346)
function renderRarityBadge(rarity) {
  if (!rarity || !rarity.label) return '';
  var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
  var html = '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
  return html;
}
```

### Google Maps Directions Link
```javascript
// Source: CONTEXT.md locked decision
function directionsUrl(store) {
  var addr = encodeURIComponent(store.address + ', ' + store.city + ', ' + store.state);
  return 'https://google.com/maps/dir/?api=1&destination=' + addr;
}
```

### Exclusion Filter Chip HTML
```javascript
// Source: map.html brand-chip pattern (lines 57-64) + FLAVOR_FAMILIES
// Recommended chips based on FLAVOR_FAMILIES + dietary relevance:
var EXCLUSION_CHIPS = [
  { key: 'mint', label: 'No Mint' },
  { key: 'chocolate', label: 'No Chocolate' },
  { key: 'caramel', label: 'No Caramel' },
  { key: 'cheesecake', label: 'No Cheesecake' },
  { key: 'peanutButter', label: 'No Peanut Butter' },
  { key: 'pecan', label: 'No Nuts' },  // pecan family covers nut-containing flavors
];
```

### Rarity Nudge Banner
```javascript
// Source: CONTEXT.md locked decision for rare nudge
function buildRarityNudge(storeDataMap, allStores) {
  // storeDataMap: {slug: {today: apiTodayResponse, ...}}
  var nudges = [];
  for (var slug in storeDataMap) {
    var todayResp = storeDataMap[slug].today;
    if (!todayResp || !todayResp.rarity) continue;
    var label = todayResp.rarity.label;
    if (label === 'Ultra Rare' || label === 'Rare') {
      var store = allStores.find(function (s) { return s.slug === slug; });
      var storeName = store ? store.city : slug;
      var gap = todayResp.rarity.avg_gap_days;
      nudges.push({
        label: label,
        flavor: todayResp.flavor,
        store: storeName,
        gap: gap,
      });
    }
  }
  return nudges;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| todays-drive.js (inline on index.html) | today-page.js (standalone IIFE) | Phase 2 (2026-03-07) | Established the IIFE extraction pattern that compare-page.js should follow |
| Legacy localStorage keys (custard-primary, custard-secondary) | custard:v1:preferences with activeRoute.stores | Phase 1 (2026-03-07) | getDrivePreferences() handles migration, but raw localStorage read is needed to detect "no saved prefs" |
| All Drive data from /api/v1/drive | Per-store /api/v1/flavors + /api/v1/today | Established in Phase 2 | Today page already uses flavors+today+forecast per store, not drive |

**Deprecated/outdated:**
- `custard-primary` / `custard-secondary` localStorage keys: Still read for backward compatibility by `getDrivePreferences()`, but new code should use `custard:v1:preferences`.
- `todays-drive.js`: Kept in STATIC_ASSETS because scoop.html still loads it. Compare page should NOT use it.

## Open Questions

1. **COMP-08 "drive endpoint" vs multi-endpoint approach**
   - What we know: The drive endpoint only serves today (+ optional tomorrow). The 3-day grid needs day+2 data. `/api/v1/flavors` provides full schedules.
   - What's unclear: Whether the requirement's wording means "only use /api/v1/drive" or "don't create new endpoints."
   - Recommendation: Interpret as "no new API endpoints." Use existing `/api/v1/flavors` + `/api/v1/today` per store. This matches the today-page.js pattern and satisfies the intent. If the user disagrees, the fallback is a 2-day grid using drive with `include_tomorrow=1`, but this loses the 3rd day.

2. **Expanded cell content -- what to show**
   - What we know: Flavor description comes from `/api/v1/flavors`. Rarity comes from `/api/v1/today`. Address comes from `stores.json`. Directions link format is locked.
   - What's unclear: Whether to also show avg_gap_days text, last-seen date, or other historical stats.
   - Recommendation: Show description, rarity gap text ("Shows up roughly every N days"), and directions link. Keep it concise -- this is a quick decision tool, not a deep analysis.

3. **Which exclusion chips to offer**
   - What we know: `FLAVOR_FAMILIES` has 9 families: mint, chocolate, caramel, cheesecake, turtle, cookie, peanutButter, berry, pecan.
   - What's unclear: Whether all 9 should be chips or a curated subset.
   - Recommendation: Offer 6 chips focused on dietary relevance and common allergies: No Mint, No Chocolate, No Caramel, No Cheesecake, No Peanut Butter, No Nuts (pecan family). Skip turtle (overlaps chocolate+caramel), cookie (too broad), berry (rarely an exclusion reason).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via `npm run test:browser` in worker/) |
| Config file | `worker/playwright.config.mjs` |
| Quick run command | `cd custard-calendar/worker && npx playwright test test/browser/compare-*.spec.mjs --workers=1` |
| Full suite command | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Grid shows 2-4 stores across 3 days | integration | `npx playwright test test/browser/compare-grid.spec.mjs -x` | Wave 0 |
| COMP-02 | Each cell shows cone, flavor name, rarity badge | integration | `npx playwright test test/browser/compare-grid.spec.mjs -x` | Wave 0 |
| COMP-03 | Tap cell expands to show description, directions, history | integration | `npx playwright test test/browser/compare-expand.spec.mjs -x` | Wave 0 |
| COMP-04 | Rare flavor cells have visual highlight | integration | `npx playwright test test/browser/compare-grid.spec.mjs -x` | Wave 0 |
| COMP-05 | Exclusion filter chips above grid | integration | `npx playwright test test/browser/compare-filter.spec.mjs -x` | Wave 0 |
| COMP-06 | Toggling exclusion chip dims matching cells | integration | `npx playwright test test/browser/compare-filter.spec.mjs -x` | Wave 0 |
| COMP-07 | Grid usable at 375px width | integration | `npx playwright test test/browser/compare-grid.spec.mjs -x` | Wave 0 |
| COMP-08 | Data from existing endpoints only | integration | Verified by test mock setup (only mock existing endpoints) | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx playwright test test/browser/compare-*.spec.mjs --workers=1`
- **Per wave merge:** `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Phase gate:** Full browser test suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/browser/compare-grid.spec.mjs` -- covers COMP-01, COMP-02, COMP-04, COMP-07
- [ ] `worker/test/browser/compare-expand.spec.mjs` -- covers COMP-03
- [ ] `worker/test/browser/compare-filter.spec.mjs` -- covers COMP-05, COMP-06
- No framework install needed -- Playwright already configured in `worker/playwright.config.mjs`
- Test pattern follows `today-hero.spec.mjs`: mock stores.json, mock API responses via `context.route()`, set localStorage, verify DOM state

## Sources

### Primary (HIGH confidence)
- `docs/planner-shared.js` - FLAVOR_FAMILIES, getDrivePreferences(), getFamilyForFlavor(), escapeHtml(), BRAND_COLORS
- `docs/today-page.js` - IIFE module pattern, data fetching pattern, rarity rendering, multi-store row
- `docs/cone-renderer.js` - renderMiniConeSVG(), renderMiniConeHDSVG(), loadFlavorColors()
- `docs/shared-nav.js` - SharedNav module, store picker, sharednav:storechange event
- `docs/style.css` - .rarity-badge-*, .brand-chip, .flavor-chip, .multi-store-cell, .today-card CSS patterns
- `docs/map.html` - Brand chip HTML structure and interaction pattern
- `docs/index.html` - Page template structure (head, header, main, footer, script order)
- `docs/sw.js` - STATIC_ASSETS list, CACHE_VERSION pattern
- `worker/src/drive.js` - /api/v1/drive response shape: {query, cards[], excluded[], nearby_leaderboard[], generated_at}
- `worker/src/route-today.js` - /api/v1/today response shape: {store, slug, brand, date, flavor, description, rarity: {appearances, avg_gap_days, label}}
- `worker/src/index.js` - /api/v1/flavors response shape: {name, flavors: [{title, date, description}]}
- `docs/stores.json` - Store manifest: {slug, name, city, state, address, lat, lng}
- `worker/test/browser/today-hero.spec.mjs` - Playwright test pattern: mock setup, context.route(), localStorage seeding
- `worker/playwright.config.mjs` - Playwright configuration, webServer pointing to `../docs`

### Secondary (MEDIUM confidence)
- None needed -- all critical information sourced from codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries and APIs already exist in the codebase and are well-documented by their source code
- Architecture: HIGH - IIFE module pattern, day-first card stack, and accordion expand are locked decisions with existing reference implementations
- Pitfalls: HIGH - Identified from actual bugs encountered in Phase 1 and Phase 2 (getDrivePreferences defaults, WORKER_BASE global, service worker caching)
- Data flow: HIGH - API response shapes verified directly from worker source code
- Exclusion filter: HIGH - FLAVOR_FAMILIES and getFamilyForFlavor() verified in planner-shared.js source

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- all dependencies are internal to this repo)
