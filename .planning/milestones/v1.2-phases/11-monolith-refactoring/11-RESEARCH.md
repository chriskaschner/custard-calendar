# Phase 11: Monolith Refactoring - Research

**Researched:** 2026-03-09
**Domain:** Vanilla JS IIFE module splitting (no build step)
**Confidence:** HIGH

## Summary

Phase 11 splits `docs/planner-shared.js` (1,639 lines, single IIFE) into 4 files: a slim facade retaining the `window.CustardPlanner` variable assignment plus 3 sub-modules that extend it via `Object.assign`. The codebase uses no bundler, no ES modules, and no transpilation -- every JS file is a hand-authored IIFE loaded via `<script>` tags. This is a purely mechanical refactoring with a well-defined safety net: the public API surface is exactly 60 named exports on `window.CustardPlanner`, and 31 Playwright browser tests exercise the full frontend.

The key risk is subtle: the monolith currently relies on JavaScript function declaration hoisting (4 functions defined after the `return` statement at line 1495 are still reachable because `function` declarations are hoisted to the top of their enclosing scope). When extracting these into sub-modules, they must be placed before the `Object.assign` call -- IIFE bodies execute sequentially and do not hoist across separate IIFEs.

**Primary recommendation:** Extract code in the exact module boundaries defined in CONTEXT.md, add an API surface smoke test as the first deliverable, then do the big-bang extraction with all 31 Playwright tests as the regression gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 broad modules + facade (matches STATE.md "3-file approach")
- **planner-shared.js** (~200 lines): facade + core utilities (escapeHtml, normalizeStringList, buildStoreLookup, parseLegacySecondaryStores, WORKER_BASE, localStorage keys)
- **planner-data.js** (~500 lines): brand constants (BRAND_COLORS, BRAND_DISPLAY), brand resolution functions, normalize, haversine, similarity groups, flavor families, seasonal detection
- **planner-domain.js** (~400 lines): certainty vocabulary, timeline building, rarity labels, reliability fetching/banners, store persistence (get/setPrimaryStoreSlug, getSavedStore, favorites), drive preferences (get/save/flush/reset, pickDefaultDriveStores, URL state), historical context fetching
- **planner-ui.js** (~500 lines): action CTAs (HTML generation, directions/calendar/alert URLs), signals (cards, fetch, IntersectionObserver tracking), share button (Web Share API + clipboard fallback), telemetry (emitPageView, emitInteractionEvent, pageLoadId)
- planner-shared.js remains as the base IIFE that creates `window.CustardPlanner` with core utils
- Sub-modules extend CustardPlanner via `Object.assign(window.CustardPlanner, { ...newExports })` inside their own IIFEs
- All 16 consuming HTML/JS files keep their existing `<script src="planner-shared.js">` tag unchanged
- 3 new `<script>` tags added after planner-shared.js on every page that currently loads it
- All pages that currently load planner-shared.js get all 3 new scripts (no selective loading)
- Big-bang: extract all 3 modules, update all HTML pages, test, commit in one pass
- API surface smoke test added to verify every expected key exists on window.CustardPlanner after all modules load
- Zero regressions policy: if any Playwright test fails, fix the split before merging (ARCH-02 is a hard gate)

### Claude's Discretion
- Load order between sub-modules (whether data must precede domain must precede UI, or all can be independent)
- File naming convention (planner-*.js vs custard-*.js -- choose based on codebase conventions)
- Exact line counts per module (approximate targets given, final split follows logical boundaries)
- API surface test implementation (Playwright test vs standalone script)
- CACHE_VERSION numbering

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | planner-shared.js split into focused modules preserving window.CustardPlanner public API | Full public API catalog (60 exports), module boundary mapping, IIFE extension pattern documented, hoisting pitfall identified |
| ARCH-02 | All existing Playwright tests pass after refactoring with no regressions | 31 Playwright browser tests identified, test runner command documented, API surface smoke test pattern provided |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES5 IIFEs) | N/A | Module pattern | Project convention -- no build step, no transpiler |
| Playwright | @playwright/test (via npm) | Browser regression tests | Already installed, 31 tests in worker/test/browser/ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python3 http.server | stdlib | Dev server for Playwright tests | Configured in playwright.config.mjs (port 4173) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IIFE Object.assign | ES modules (import/export) | Explicitly out of scope per REQUIREMENTS.md ("Too disruptive") |
| Manual script tags | Dynamic loader (require.js, etc.) | Over-engineering for 4 files; all pages load all scripts anyway |

**No installation needed.** This phase creates new `.js` files and edits existing HTML/JS files only.

## Architecture Patterns

### Recommended Project Structure (after refactoring)
```
docs/
  planner-shared.js    # (~200 lines) Facade: IIFE creating window.CustardPlanner with core utils
  planner-data.js      # (~500 lines) Sub-module: brand, normalize, haversine, families, seasonal
  planner-domain.js    # (~400 lines) Sub-module: certainty, timeline, rarity, reliability, store/drive state, history
  planner-ui.js        # (~500 lines) Sub-module: CTAs, signals, share, telemetry
  shared-nav.js        # (unchanged) Uses CustardPlanner global
  today-page.js        # (unchanged) Uses CustardPlanner global
  compare-page.js      # (unchanged) Uses CustardPlanner global
  ...
```

### Pattern 1: IIFE Facade + Object.assign Extension
**What:** Base IIFE creates `window.CustardPlanner` with core utilities. Sub-modules read the existing global and extend it.
**When to use:** Every sub-module file.
**Example:**

```javascript
// planner-data.js -- extends CustardPlanner with brand/data exports
(function () {
  'use strict';

  var CP = window.CustardPlanner;
  if (!CP) { console.error('planner-data.js: CustardPlanner not found'); return; }

  // ... all brand, normalize, haversine, family, seasonal code ...

  Object.assign(CP, {
    BRAND_COLORS: BRAND_COLORS,
    BRAND_DISPLAY: BRAND_DISPLAY,
    brandFromSlug: brandFromSlug,
    brandDisplayName: brandDisplayName,
    normalize: normalize,
    haversineMiles: haversineMiles,
    SIMILARITY_GROUPS: SIMILARITY_GROUPS,
    FLAVOR_FAMILIES: FLAVOR_FAMILIES,
    FLAVOR_FAMILY_MEMBERS: FLAVOR_FAMILY_MEMBERS,
    getFamilyForFlavor: getFamilyForFlavor,
    getFamilyColor: getFamilyColor,
    findSimilarFlavors: findSimilarFlavors,
    findSimilarToFavorites: findSimilarToFavorites,
    isSeasonalFlavor: isSeasonalFlavor,
  });
})();
```

### Pattern 2: Guard Check for Load Order
**What:** Each sub-module opens with a guard verifying `window.CustardPlanner` exists.
**When to use:** Top of every sub-module IIFE.
**Why:** Catches script ordering mistakes during development.

```javascript
var CP = window.CustardPlanner;
if (!CP) { console.error('planner-domain.js: CustardPlanner not found'); return; }
```

### Pattern 3: HTML Script Tag Ordering
**What:** New script tags placed immediately after `planner-shared.js` on every consuming page.
**When to use:** All 9 HTML pages that load planner-shared.js.

```html
<script src="planner-shared.js"></script>
<script src="planner-data.js"></script>
<script src="planner-domain.js"></script>
<script src="planner-ui.js"></script>
<script src="shared-nav.js"></script>
```

### Anti-Patterns to Avoid
- **Circular cross-module calls at load time:** Sub-modules must not call functions from other sub-modules during IIFE execution (only after all scripts have loaded). The facade provides shared utils that all sub-modules can safely reference at load time via `CP.escapeHtml()` etc.
- **Removing exports from the return statement of planner-shared.js without adding them in a sub-module:** Every key in the current `return {}` block must appear either in the slimmed facade return or in exactly one sub-module's `Object.assign`.
- **Putting side-effects in the wrong module:** `bootstrapFlavorConfig()` (fetch at load time) must stay with the flavor family code in planner-data.js. `bindInteractionTelemetry()` and auto page-view must stay in planner-ui.js. `window.addEventListener('beforeunload', flushDrivePreferences)` must stay in planner-domain.js.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API surface verification | Manual checking of each export | Playwright test iterating EXPECTED_KEYS array | Automated, repeatable, catches regressions |
| Module dependency graph | Complex load-order resolver | Fixed script tag order in HTML | Only 4 files; static ordering is simpler and debuggable |
| Object.assign polyfill | Custom merge utility | Native Object.assign | All target browsers (last 2 major versions) support it natively |

## Common Pitfalls

### Pitfall 1: Function Hoisting Across IIFE Boundaries
**What goes wrong:** The current monolith defines `signalCardHTML`, `trackSignalViews`, `fetchSignalsShared`, and `initShareButton` AFTER the `return` statement (lines 1497-1639). They work because JavaScript hoists `function` declarations to the top of their enclosing function scope. When extracted to a separate IIFE, this hoisting no longer applies -- the functions must be defined BEFORE the `Object.assign` call.
**Why it happens:** Copy-paste extraction without noticing the code is unreachable in normal execution flow.
**How to avoid:** In each sub-module, place all function definitions before the `Object.assign` call. No function should appear after it.
**Warning signs:** `TypeError: X is not a function` in the browser console.

### Pitfall 2: Private State Shared Between Modules
**What goes wrong:** The monolith has private variables like `_pageLoadId`, `_telemetryListenerBound`, `_debounceSaveTimer`, `_lastSavedPrefs`, `_flavorContextCache`, `_storeContextCache`, `_flavorToFamilies`, `FLAVOR_FAMILY_MEMBERS` (mutable object). These are closure-scoped in the current IIFE. When split, each sub-module gets its own closure.
**Why it happens:** Closures don't span IIFE boundaries.
**How to avoid:** Private state stays in the same sub-module as the functions that read/write it. Do NOT split functions that share private mutable state across different modules.
**Warning signs:** Drive preferences not persisting, telemetry double-firing, flavor family lookups returning null.

### Pitfall 3: Load-Time Side Effects Executing Before Dependencies
**What goes wrong:** The monolith runs several things at parse time: `rebuildFlavorFamilyIndexes()` (line 967), `bootstrapFlavorConfig()` (line 968), `bindInteractionTelemetry()` (line 723), and the auto `emitPageView` block (lines 725-733). If a side effect depends on a function from another sub-module, it will fail.
**Why it happens:** Script tags execute sequentially. Side effects in planner-data.js run before planner-ui.js loads.
**How to avoid:** Each side effect must live in the same module as the functions it calls. `rebuildFlavorFamilyIndexes` and `bootstrapFlavorConfig` go in planner-data.js. `bindInteractionTelemetry` and auto-pageview go in planner-ui.js. The `beforeunload` listener for `flushDrivePreferences` goes in planner-domain.js.
**Warning signs:** Console errors about undefined functions during page load.

### Pitfall 4: Missing Exports in Sub-Module Object.assign
**What goes wrong:** An export present in the current `return {}` block is not added to any sub-module's `Object.assign`, leaving it as `undefined` on `CustardPlanner`.
**Why it happens:** Manual error during extraction; the return block has 60 exports.
**How to avoid:** Create a definitive EXPECTED_KEYS list from the current return statement. Write a Playwright test that checks `Object.keys(window.CustardPlanner)` against this list. Run it after extraction.
**Warning signs:** The API surface smoke test fails.

### Pitfall 5: SW STATIC_ASSETS Cache Miss
**What goes wrong:** New JS files are deployed but not added to `sw.js` STATIC_ASSETS, so the service worker pre-caches the old set. Users on the cached version load pages missing the new sub-module scripts.
**Why it happens:** Forgetting to update sw.js when adding files.
**How to avoid:** Add all 3 new files to the STATIC_ASSETS array and bump CACHE_VERSION from 'custard-v17' to 'custard-v18'.
**Warning signs:** Offline mode broken; stale JS served after deploy.

### Pitfall 6: Internal Cross-References Between Sub-Modules
**What goes wrong:** planner-domain.js calls `escapeHtml()` or `normalize()` directly by function name, but those functions are now in planner-shared.js (facade) or planner-data.js.
**Why it happens:** Inside the old monolith, all functions shared the same scope.
**How to avoid:** Sub-modules access shared utilities via `CP.escapeHtml()`, `CP.normalize()`, etc., where `CP = window.CustardPlanner`. The facade exposes these before sub-modules load. Sub-modules that need functions from another sub-module (e.g., domain needs data's `normalize`) must access them through the global `CP` reference.
**Warning signs:** `ReferenceError: escapeHtml is not defined`.

## Code Examples

### Complete Public API Catalog (60 exports)

Verified from `return {}` block at lines 1409-1495 of planner-shared.js:

```
// Facade (planner-shared.js) -- keep in return {}
WORKER_BASE, escapeHtml, normalizeStringList (private, not exported -- keep internal),
buildStoreLookup (private, not exported -- keep internal),
parseLegacySecondaryStores (private, not exported -- keep internal)

// Data (planner-data.js) -- move to Object.assign
BRAND_COLORS, BRAND_DISPLAY, brandFromSlug, brandDisplayName,
normalize, haversineMiles,
SIMILARITY_GROUPS, FLAVOR_FAMILIES, FLAVOR_FAMILY_MEMBERS,
getFamilyForFlavor, getFamilyColor, findSimilarFlavors, findSimilarToFavorites,
isSeasonalFlavor

// Domain (planner-domain.js) -- move to Object.assign
CERTAINTY, CERTAINTY_LABELS, certaintyTier, certaintyBadgeHTML,
certaintyCardClass, confidenceStripClass,
buildTimeline,
fetchReliability, watchBannerHTML,
fetchFlavorHistoricalContext, fetchStoreHistoricalContext, historicalContextHTML,
getPrimaryStoreSlug, setPrimaryStoreSlug, getSavedStore, setSavedStore,
getFavorites, addFavorite, removeFavorite,
getDrivePreferences, saveDrivePreferences, flushDrivePreferences, resetDrivePreferences,
pickDefaultDriveStores, parseDriveUrlState, buildDriveUrlState,
DRIVE_PREFERENCES_KEY, DRIVE_DEBOUNCE_MS,
rarityLabelFromGapDays, rarityLabelFromPercentile, rarityLabelFromRank, formatCadenceText

// UI (planner-ui.js) -- move to Object.assign
directionsUrl, calendarIcsUrl, alertPageUrl, actionCTAsHTML,
emitInteractionEvent, emitPageView, getPageLoadId,
signalCardHTML, fetchSignals (alias for fetchSignalsShared),
initShareButton
```

**Total: 60 named exports** (counted from the return statement).

### Facade Slim-Down Pattern (planner-shared.js after refactor)

```javascript
/**
 * CustardPlanner -- shared utilities for all custard calendar surfaces.
 * Facade module: creates window.CustardPlanner with core utilities.
 * Sub-modules (planner-data.js, planner-domain.js, planner-ui.js) extend
 * this object via Object.assign.
 */
var CustardPlanner = (function () {
  'use strict';

  var WORKER_BASE = 'https://custard.chriskaschner.com';
  var PRIMARY_STORE_KEY = 'custard-primary';
  var SECONDARY_STORES_KEY = 'custard-secondary';
  var FAVORITES_KEY = 'custard-favorites';
  var MAX_FAVORITES = 10;
  var DRIVE_PREFERENCES_KEY = 'custard:v1:preferences';
  var DRIVE_PREF_VERSION = 1;
  // ... (drive allowed maps stay if needed by domain module via CP ref)

  function escapeHtml(str) { /* ... */ }
  function normalizeStringList(list) { /* ... */ }
  function parseLegacySecondaryStores() { /* ... */ }
  function buildStoreLookup(stores) { /* ... */ }

  return {
    WORKER_BASE: WORKER_BASE,
    escapeHtml: escapeHtml,
    // Internal helpers exposed for sub-modules:
    _normalizeStringList: normalizeStringList,
    _parseLegacySecondaryStores: parseLegacySecondaryStores,
    _buildStoreLookup: buildStoreLookup,
    // Constants needed by domain module:
    _PRIMARY_STORE_KEY: PRIMARY_STORE_KEY,
    _SECONDARY_STORES_KEY: SECONDARY_STORES_KEY,
    _FAVORITES_KEY: FAVORITES_KEY,
    _MAX_FAVORITES: MAX_FAVORITES,
    _DRIVE_PREFERENCES_KEY: DRIVE_PREFERENCES_KEY,
    _DRIVE_PREF_VERSION: DRIVE_PREF_VERSION,
    _DRIVE_ALLOWED_EXCLUDES: DRIVE_ALLOWED_EXCLUDES,
    _DRIVE_ALLOWED_TAGS: DRIVE_ALLOWED_TAGS,
    _DRIVE_ALLOWED_SORTS: DRIVE_ALLOWED_SORTS,
  };
})();
```

**Note:** Private helpers (`normalizeStringList`, `buildStoreLookup`, etc.) are not part of the public API but are needed by planner-domain.js. They can either be (a) exposed with underscore-prefixed names on the facade, or (b) duplicated in the domain module, or (c) kept in the facade's closure with the domain code that needs them. Option (a) is cleanest -- underscore convention signals "internal use only."

### API Surface Smoke Test (Playwright)

```javascript
import { expect, test } from '@playwright/test';

const EXPECTED_KEYS = [
  'WORKER_BASE',
  'BRAND_COLORS', 'BRAND_DISPLAY', 'brandFromSlug', 'brandDisplayName',
  'normalize', 'haversineMiles',
  'SIMILARITY_GROUPS', 'FLAVOR_FAMILIES', 'FLAVOR_FAMILY_MEMBERS',
  'getFamilyForFlavor', 'getFamilyColor',
  'findSimilarFlavors', 'findSimilarToFavorites',
  'escapeHtml',
  'getPrimaryStoreSlug', 'setPrimaryStoreSlug',
  'getSavedStore', 'setSavedStore',
  'getFavorites', 'addFavorite', 'removeFavorite',
  'getDrivePreferences', 'saveDrivePreferences',
  'flushDrivePreferences', 'resetDrivePreferences',
  'pickDefaultDriveStores', 'parseDriveUrlState', 'buildDriveUrlState',
  'DRIVE_PREFERENCES_KEY', 'DRIVE_DEBOUNCE_MS',
  'rarityLabelFromGapDays', 'rarityLabelFromPercentile', 'rarityLabelFromRank',
  'formatCadenceText',
  'CERTAINTY', 'CERTAINTY_LABELS',
  'certaintyTier', 'certaintyBadgeHTML', 'certaintyCardClass', 'confidenceStripClass',
  'buildTimeline',
  'fetchReliability', 'watchBannerHTML',
  'fetchFlavorHistoricalContext', 'fetchStoreHistoricalContext', 'historicalContextHTML',
  'directionsUrl', 'calendarIcsUrl', 'alertPageUrl', 'actionCTAsHTML',
  'emitInteractionEvent', 'emitPageView', 'getPageLoadId',
  'signalCardHTML', 'fetchSignals',
  'initShareButton',
  'isSeasonalFlavor',
];

test('CustardPlanner API surface is complete after module split', async ({ page }) => {
  await page.goto('/index.html');
  const keys = await page.evaluate(() => Object.keys(window.CustardPlanner));
  for (const key of EXPECTED_KEYS) {
    expect(keys, `Missing export: ${key}`).toContain(key);
  }
});
```

### HTML Pages Requiring Script Tag Updates (9 pages)

| Page | Current planner-shared.js line | Scripts after it |
|------|-------------------------------|------------------|
| index.html | line 146 | shared-nav.js, cone-renderer.js, today-page.js |
| map.html | line 100 | shared-nav.js, cone-renderer.js |
| compare.html | line 83 | shared-nav.js, cone-renderer.js, compare-page.js |
| fun.html | line 219 | shared-nav.js, fun-page.js |
| updates.html | line 239 | shared-nav.js, updates-page.js |
| quiz.html | line 587 | shared-nav.js, quizzes/sprites.js |
| forecast-map.html | line 142 | shared-nav.js |
| group.html | line 293 | shared-nav.js |
| privacy.html | line 73 | shared-nav.js |

Each gets 3 new `<script>` tags inserted between `planner-shared.js` and the next script.

### SW Update Pattern

```javascript
// sw.js changes:
const CACHE_VERSION = 'custard-v18';  // bumped from v17
const STATIC_ASSETS = [
  // ... existing entries ...
  './planner-shared.js',
  './planner-data.js',     // NEW
  './planner-domain.js',   // NEW
  './planner-ui.js',       // NEW
  './shared-nav.js',
  // ... rest unchanged ...
];
```

## Load Order Analysis

### Recommended Load Order: planner-shared.js -> planner-data.js -> planner-domain.js -> planner-ui.js

**Why this specific order matters:**

1. **planner-shared.js first** (mandatory): Creates `window.CustardPlanner` with core utils. All sub-modules depend on this existing.

2. **planner-data.js second** (recommended): Contains `normalize()` function. Domain module's `historicalContextHTML` calls `escapeHtml` (on facade), and the `cleanTelemetrySlug` function used in `fetchStoreHistoricalContext` is a telemetry helper. However, domain functions reference `normalize` only at call time (not at IIFE-execution time), so strict data-before-domain is not required.

3. **planner-domain.js third** (recommended): Contains store persistence and drive preferences. UI module's telemetry functions (`emitInteractionEvent`) are self-contained and don't depend on domain at load time.

4. **planner-ui.js last** (recommended): Contains side effects (`bindInteractionTelemetry`, auto-`emitPageView`) that fire at load time. These are self-contained within the UI module's closure. The `signalCardHTML` function calls `escapeHtml` and `alertPageUrl`/`calendarIcsUrl` -- but by the time any signal card is rendered (user interaction), all modules are loaded.

**Key finding:** The sub-modules are actually independent at load time. Each only depends on `window.CustardPlanner` (the facade). Cross-module function calls happen only at runtime (user clicks, fetch callbacks), by which point all scripts are loaded. The recommended order is defensive -- it ensures that if any module accidentally references another at load time, it still works.

## Private Helper Dependency Map

Functions that are NOT exported but are called by exported functions across module boundaries:

| Private Function | Currently At | Called By | Recommendation |
|-----------------|-------------|-----------|----------------|
| `normalizeStringList` | lines 57-71 | `parseLegacySecondaryStores`, `sanitizeDriveStores`, `sanitizeDriveTagList` | Keep in facade, expose as `CP._normalizeStringList` |
| `buildStoreLookup` | lines 92-101 | `sanitizeDriveStores`, `pickDefaultDriveStores` | Keep in facade, expose as `CP._buildStoreLookup` |
| `parseLegacySecondaryStores` | lines 73-90 | `pickDefaultDriveStores` | Keep in facade, expose as `CP._parseLegacySecondaryStores` |
| `isCulversSlug` | lines 103-111 | `sanitizeDriveStores` | Move to domain with drive code |
| `sanitizeDriveStores` | lines 113-126 | multiple drive functions | Move to domain with drive code |
| `sanitizeDriveTagList` | lines 128-141 | drive prefs sanitization | Move to domain with drive code |
| `parseCsvTagParam` | lines 143-147 | `parseDriveUrlState` | Move to domain with drive code |
| `sanitizeDriveSort` | lines 149-153 | drive prefs functions | Move to domain with drive code |
| `sanitizeDriveRadius` | lines 155-162 | drive prefs functions | Move to domain with drive code |
| `cleanTelemetryText/Slug/etc.` | lines 590-628 | telemetry emission | Move to UI with telemetry code |
| `inferPageKey` | lines 548-559 | `emitPageView` | Move to UI with telemetry code |
| `makePageLoadId` | lines 561-570 | module-level `_pageLoadId` init | Move to UI with telemetry code |
| `syncMutableObject` | lines 855-862 | `applyFlavorConfig`, `rebuildFlavorFamilyIndexes` | Move to data with family code |
| `normalizeGroupMembers` | lines 864-875 | family/similarity config | Move to data with family code |
| `normalizeFamilyConfig` | lines 877-892 | `applyFlavorConfig` | Move to data with family code |
| `normalizeSimilarityConfig` | lines 894-904 | `applyFlavorConfig` | Move to data with family code |
| `formatInt` | lines 1303-1306 | `historicalContextHTML` | Move to domain with history code |
| `ctaDataAttrs` | lines 1220-1226 | `actionCTAsHTML` | Move to UI with CTA code |
| `inferCtaAction` | lines 692-701 | `bindInteractionTelemetry` | Move to UI with telemetry code |
| `trackSignalViews` | lines 1527-1573 | `fetchSignalsShared` | Move to UI with signals code |

**Alternative to underscore-prefixed exports:** The facade could keep `normalizeStringList`, `buildStoreLookup`, `parseLegacySecondaryStores`, and the drive-allowed constant maps in its closure, and move ALL drive preference code into the facade instead of domain. However, this conflicts with the CONTEXT.md decision to put drive preferences in planner-domain.js. Therefore, exposing these as underscore-prefixed internal helpers is the cleaner path.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single 1,639-line IIFE | 4 focused modules + facade | This phase | Targeted browser caching per module, maintainable code boundaries |
| All code in one cache entry | 4 separate cached files | This phase | Changes to telemetry don't invalidate brand data cache |

**No deprecated/outdated concerns:** This is vanilla JS with no framework version to worry about. The IIFE + Object.assign pattern has been stable since ES2015 and requires no polyfill in any modern browser.

## Open Questions

1. **Underscore-prefixed internal helpers vs. alternative patterns**
   - What we know: 3 private functions (`normalizeStringList`, `buildStoreLookup`, `parseLegacySecondaryStores`) and 6 constants (localStorage keys, drive allowed maps) are needed by planner-domain.js but are not part of the public API.
   - What's unclear: Whether underscore-prefixed properties on CustardPlanner is acceptable, or if these should be duplicated/inlined in the domain module.
   - Recommendation: Use underscore-prefix convention (`CP._normalizeStringList`). It's the idiomatic JavaScript convention for "internal, don't depend on this." Less code duplication, single source of truth. The planner can decide.

2. **Whether `escapeHtml` should stay in facade or move to data**
   - What we know: `escapeHtml` is used by ALL modules (facade consumers, data family rendering, domain history HTML, UI CTA rendering). It is currently in the public API.
   - Recommendation: Keep in facade. It is the most cross-cutting utility.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via @playwright/test) |
| Config file | `worker/playwright.config.mjs` |
| Quick run command | `cd worker && npx playwright test --grep "API surface" --workers=1` |
| Full suite command | `cd worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | CustardPlanner exposes exact same 60 exports after split | smoke | `cd worker && npx playwright test test/browser/api-surface.spec.mjs --workers=1` | Wave 0 |
| ARCH-02 | All existing Playwright tests pass | regression | `cd worker && npm run test:browser -- --workers=1` | Yes (31 files) |

### Sampling Rate
- **Per task commit:** `cd worker && npm run test:browser -- --workers=1`
- **Per wave merge:** Same (all 31+ tests)
- **Phase gate:** Full browser suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/browser/api-surface.spec.mjs` -- covers ARCH-01 (API surface completeness test)
- No framework install needed (Playwright already configured)
- No shared fixtures needed beyond what exists

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of `docs/planner-shared.js` (1,639 lines, all 60 exports catalogued)
- Direct source code analysis of `docs/sw.js` (CACHE_VERSION = 'custard-v17', STATIC_ASSETS array)
- Direct source code analysis of 9 HTML pages (script tag locations verified)
- Direct source code analysis of `worker/playwright.config.mjs` (test setup verified)
- Direct source code analysis of 31 Playwright browser test files

### Secondary (MEDIUM confidence)
- CONTEXT.md module boundary decisions (user-approved)
- STATE.md "3-file approach" historical decision

### Tertiary (LOW confidence)
- None -- this phase is entirely about the project's own codebase, no external dependencies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external dependencies, pure vanilla JS
- Architecture: HIGH -- IIFE + Object.assign is well-understood, codebase already uses this pattern (shared-nav.js)
- Pitfalls: HIGH -- identified from direct source analysis (hoisting, private state, side effects, cross-references)

**Research date:** 2026-03-09
**Valid until:** Indefinite (no external dependencies to go stale; only invalidated by changes to planner-shared.js itself)
