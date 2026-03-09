# Phase 11: Monolith Refactoring - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Split planner-shared.js (1,639 lines) into focused modules preserving the exact `window.CustardPlanner` public API (~60 exports). All existing Playwright tests must pass with zero regressions. New JS files are added to the SW STATIC_ASSETS list with a CACHE_VERSION bump. Requirements: ARCH-01, ARCH-02.

</domain>

<decisions>
## Implementation Decisions

### Split boundaries
- 3 broad modules + facade (matches STATE.md "3-file approach")
- **planner-shared.js** (~200 lines): facade + core utilities (escapeHtml, normalizeStringList, buildStoreLookup, parseLegacySecondaryStores, WORKER_BASE, localStorage keys)
- **planner-data.js** (~500 lines): brand constants (BRAND_COLORS, BRAND_DISPLAY), brand resolution functions, normalize, haversine, similarity groups, flavor families, seasonal detection
- **planner-domain.js** (~400 lines): certainty vocabulary, timeline building, rarity labels, reliability fetching/banners, store persistence (get/setPrimaryStoreSlug, getSavedStore, favorites), drive preferences (get/save/flush/reset, pickDefaultDriveStores, URL state), historical context fetching
- **planner-ui.js** (~500 lines): action CTAs (HTML generation, directions/calendar/alert URLs), signals (cards, fetch, IntersectionObserver tracking), share button (Web Share API + clipboard fallback), telemetry (emitPageView, emitInteractionEvent, pageLoadId)

### Facade strategy
- planner-shared.js remains as the base IIFE that creates `window.CustardPlanner` with core utils
- Sub-modules extend CustardPlanner via `Object.assign(window.CustardPlanner, { ...newExports })` inside their own IIFEs
- All 16 consuming HTML/JS files keep their existing `<script src="planner-shared.js">` tag unchanged
- 3 new `<script>` tags added after planner-shared.js on every page that currently loads it
- Consumer code (CustardPlanner.escapeHtml, CustardPlanner.haversineMiles, etc.) requires zero changes

### Script loading
- All pages that currently load planner-shared.js get all 3 new scripts (no selective loading)
- No per-page audit of which modules are needed -- consistency over micro-optimization
- Browser caching means the extra scripts are free after first page load

### Migration approach
- Big-bang: extract all 3 modules, update all HTML pages, test, commit in one pass
- The facade pattern makes this low-risk since consumer code doesn't change
- API surface smoke test added to verify every expected key exists on window.CustardPlanner after all modules load
- Zero regressions policy: if any Playwright test fails, fix the split before merging (ARCH-02 is a hard gate)

### Claude's Discretion
- Load order between sub-modules (whether data must precede domain must precede UI, or all can be independent)
- File naming convention (planner-*.js vs custard-*.js -- choose based on codebase conventions)
- Exact line counts per module (approximate targets given, final split follows logical boundaries)
- API surface test implementation (Playwright test vs standalone script)
- CACHE_VERSION numbering

</decisions>

<specifics>
## Specific Ideas

- Sub-module pattern: each file is a self-contained IIFE that reads `window.CustardPlanner` and extends it via Object.assign
- Core utils stay in the facade to avoid circular dependencies -- sub-modules can call `CP.escapeHtml()` etc. via the already-constructed base object
- The beforeunload listener for flushDrivePreferences should stay with the drive preferences code (planner-domain.js)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/planner-shared.js`: The monolith being split (1,639 lines, IIFE pattern, `var CustardPlanner = (function() { ... })()`)
- `docs/sw.js`: Service worker with STATIC_ASSETS array, currently at custard-v16+, needs new files added
- Existing page-specific modules follow the same IIFE pattern: `today-page.js`, `compare-page.js`, `updates-page.js`, `todays-drive.js`

### Established Patterns
- IIFE module pattern: `var ModuleName = (function() { 'use strict'; ... return { ... }; })();`
- No build step, no ES modules -- vanilla JS loaded via script tags
- Script load order matters: planner-shared.js loads before page-specific modules
- Sub-modules already exist that extend globals (e.g., shared-nav.js checks `typeof CustardPlanner !== 'undefined'`)

### Integration Points
- 16 files reference CustardPlanner: index.html, map.html, compare.html, fun.html, updates.html, quiz.html, forecast-map.html, group.html, privacy.html + shared-nav.js, today-page.js, compare-page.js, updates-page.js, todays-drive.js, quizzes/engine.js, planner-shared.js itself
- `docs/sw.js` STATIC_ASSETS: add 3 new JS files, bump CACHE_VERSION
- All HTML pages with `<script src="planner-shared.js">`: add 3 new script tags after it

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 11-monolith-refactoring*
*Context gathered: 2026-03-09*
