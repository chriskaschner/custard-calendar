# S03: Page Consolidation

**Goal:** Zero-traffic pages consolidated or redirected; navigation reflects reduced page count (≤4 items).
**Demo:** `forecast-map.html` redirects to `index.html` preserving query params/hash. Fun page no longer links to Flavor Fronts. Service worker no longer precaches forecast-map.html. Nav stays at 4 items. All tests pass.

## Must-Haves

- forecast-map.html replaced with redirect stub (same pattern as scoop.html/radar.html)
- fun.html `#fronts-section` removed (dead link to forecast-map eliminated)
- sw.js STATIC_ASSETS no longer includes `./forecast-map.html`; CACHE_VERSION bumped to `custard-v26`
- `worker/test/png-asset-count.test.js` updated to expect `custard-v26`
- test_redirects.py includes forecast-map.html → index.html in REDIRECT_MAP
- Playwright `forecast-fronts.spec.mjs` deleted (tests a page that no longer exists)
- Python tests referencing forecast-map.html content updated or removed
- All existing test suites pass: Worker (npm test), Python (pytest), Playwright browser specs
- compare.html and fun.html remain as live pages in nav (not redirected)
- radar.html NOT touched (S05 share URLs depend on it)

## Proof Level

- This slice proves: operational
- Real runtime required: no (static file changes verified by existing test suites)
- Human/UAT required: no

## Verification

- `cd worker && npm test` — all Worker tests pass (including updated png-asset-count expecting custard-v26)
- `uv run pytest tests/ -v` — all Python tests pass (redirects, design tokens, inline styles, static assets)
- `cd worker && npm run test:browser -- --workers=1` — Playwright nav-clickthrough and remaining page specs pass
- `grep -c 'forecast-map.html' docs/sw.js` returns `0` — forecast-map removed from SW precache
- `grep -q 'custard-v26' docs/sw.js` — cache version bumped
- `grep -q 'forecast-map.html' tests/test_redirects.py` — redirect stub is covered by redirect test suite
- `test -f worker/test/browser/forecast-fronts.spec.mjs && echo FAIL || echo PASS` — forecast-fronts spec deleted
- `grep -q 'content="0;url=index.html"' docs/forecast-map.html` — redirect stub has correct meta-refresh
- `wc -c < docs/forecast-map.html | awk '{exit ($1 > 1000)}'` — redirect stub under 1000 bytes (failure-path: detects if stub accidentally kept full 945-line page)

## Observability / Diagnostics

- Runtime signals: Service worker cache version `custard-v26` — returning users will redownload asset list on next visit, evicting stale `custard-v25` cache entries including forecast-map.html
- Inspection surfaces: `grep CACHE_VERSION docs/sw.js` shows current version; `grep forecast-map docs/sw.js` confirms absence from precache; `wc -c docs/forecast-map.html` confirms stub size
- Failure visibility: If forecast-map.html is still a full page (not a stub), `wc -c` will return >1000. If sw.js still precaches it, `grep` will find it. If cache version isn't bumped, `png-asset-count.test.js` will fail.
- Redaction constraints: none

## Integration Closure

- Upstream surfaces consumed: `docs/shared-nav.js` (NAV_ITEMS — unchanged, already 4 items), `docs/sw.js` (STATIC_ASSETS + CACHE_VERSION), `docs/fun.html` (Fronts section removal)
- New wiring introduced in this slice: none — this slice removes wiring (forecast-map from precache and fun.html link)
- What remains before the milestone is truly usable end-to-end: nothing — S03 is the final slice in M002

## Tasks

- [ ] **T01: Redirect forecast-map.html and update production files** `est:25m`
  - Why: Implements the core consolidation — replaces forecast-map.html with a redirect stub, removes the dead Fronts section from fun.html, and updates sw.js to stop precaching the old page.
  - Files: `docs/forecast-map.html`, `docs/fun.html`, `docs/sw.js`, `worker/test/png-asset-count.test.js`
  - Do: (1) Replace docs/forecast-map.html with the established redirect stub pattern (meta-refresh to index.html, JS fallback forwarding query+hash, under 1000 bytes, no shared-nav/style.css/planner-shared.js). (2) Remove the entire `<section id="fronts-section">` block from docs/fun.html. (3) Remove `'./forecast-map.html'` from STATIC_ASSETS array in docs/sw.js. (4) Bump CACHE_VERSION from `custard-v25` to `custard-v26` in docs/sw.js. (5) Update worker/test/png-asset-count.test.js to expect `custard-v26` instead of `custard-v25`. **Constraint:** Do NOT touch radar.html, compare.html, fun-page.js, shared-nav.js NAV_ITEMS, or any compare-related files.
  - Verify: `grep -q 'content="0;url=index.html"' docs/forecast-map.html && grep -q 'custard-v26' docs/sw.js && ! grep -q 'forecast-map.html' docs/sw.js && ! grep -q 'fronts-section' docs/fun.html`
  - Done when: forecast-map.html is a redirect stub, fun.html has no Fronts section, sw.js precache excludes forecast-map and is at v26, png-asset-count test expects v26

- [ ] **T02: Update tests for forecast-map redirect and run full suite** `est:30m`
  - Why: Multiple Python and Playwright test files reference forecast-map.html as a full page. These must be updated to reflect the redirect stub, and new redirect coverage added. The full test suite must pass green.
  - Files: `tests/test_redirects.py`, `tests/test_static_assets.py`, `tests/test_inline_style_elimination.py`, `worker/test/browser/forecast-fronts.spec.mjs`, `worker/test/browser/fun-page.spec.mjs`
  - Do: (1) Add `"forecast-map.html": "index.html"` to REDIRECT_MAP in tests/test_redirects.py and add a `test_forecast_map_redirects_to_index` test method. (2) Delete worker/test/browser/forecast-fronts.spec.mjs (tests a page that's now a stub). (3) In worker/test/browser/fun-page.spec.mjs, delete the `FUN-05: Fronts card links to forecast-map.html` test (line ~42) — the Fronts section was removed from fun.html in T01. Keep all other FUN-01 through FUN-04 tests intact. (4) Update tests/test_static_assets.py: delete the `test_leaflet_heat_is_vendored_locally` test (~line 125) since forecast-map.html is now a redirect stub. (5) Update tests/test_inline_style_elimination.py: delete only the forecast-map.html tests: `test_forecast_map_zero_inline_styles` (~line 68) and `test_no_style_assignments_in_forecast_map_js` (~line 168). Do NOT touch compare tests. (6) Run `cd worker && npm test`, `uv run pytest tests/ -v`, and `cd worker && npm run test:browser -- --workers=1`. **Constraint:** Do NOT modify compare-related tests. Do NOT modify nav-clickthrough NAV_LINKS or ALL_PAGES (they're correct as-is).
  - Verify: `cd worker && npm test && cd .. && uv run pytest tests/ -v`
  - Done when: All Worker tests pass, all Python tests pass, forecast-fronts spec deleted, test_redirects covers forecast-map.html

## Files Likely Touched

- `docs/forecast-map.html`
- `docs/fun.html`
- `docs/sw.js`
- `worker/test/png-asset-count.test.js`
- `tests/test_redirects.py`
- `tests/test_static_assets.py`
- `tests/test_inline_style_elimination.py`
- `worker/test/browser/forecast-fronts.spec.mjs`
- `worker/test/browser/fun-page.spec.mjs`
