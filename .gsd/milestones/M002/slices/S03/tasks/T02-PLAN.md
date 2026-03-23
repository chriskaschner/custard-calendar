---
estimated_steps: 5
estimated_files: 5
skills_used:
  - test
---

# T02: Update tests for forecast-map redirect and run full suite

**Slice:** S03 — Page Consolidation
**Milestone:** M002

## Description

Multiple Python and Playwright test files reference forecast-map.html as a full page with Leaflet, inline styles, and interactive content. Now that T01 replaced it with a redirect stub, these tests will fail. This task updates the test suite to match the new reality and verifies the entire project passes green.

## Steps

1. **Add forecast-map.html to test_redirects.py**: Open `tests/test_redirects.py`. Add `"forecast-map.html": "index.html"` to the `REDIRECT_MAP` dict. Add a new test method `test_forecast_map_redirects_to_index` in `TestRedirectStubs` class following the same pattern as the other redirect tests (read file, assert `'content="0;url=index.html"' in content`). Also ensure forecast-map.html is covered by the generic `TestRedirectFileSize`, `TestRedirectNoForbiddenResources`, `TestRedirectQueryParamForwarding`, and `TestRedirectHashForwarding` test classes that iterate over `REDIRECT_MAP` — it should be automatic since they iterate the dict.

2. **Delete forecast-fronts.spec.mjs**: Remove `worker/test/browser/forecast-fronts.spec.mjs` entirely. This 93-line Playwright spec tests interactive forecast-map.html features that no longer exist (the page is a redirect stub).

3. **Update fun-page.spec.mjs**: In `worker/test/browser/fun-page.spec.mjs`, delete the `FUN-05: Fronts card links to forecast-map.html` test (line ~42). This test checks for the `a[href="forecast-map.html"]` link in the Fronts section, which T01 removed from fun.html. Keep all other tests (FUN-01 through FUN-04) intact.

4. **Update test_static_assets.py**: In `tests/test_static_assets.py`, find the `test_leaflet_heat_is_vendored_locally` test (around line 125). This test reads forecast-map.html and asserts `"vendor/leaflet-heat-0.2.0.js" in forecast_map`. Since forecast-map.html is now a redirect stub, delete this entire test method. Do not touch other tests in this file.

5. **Update test_inline_style_elimination.py**: In `tests/test_inline_style_elimination.py`, find and delete these two test functions that reference forecast-map.html:
   - `test_forecast_map_zero_inline_styles` (around line 68) — asserts forecast-map.html HTML has zero inline style= attributes
   - `test_no_style_assignments_in_forecast_map_js` (around line 168) — asserts forecast-map.html inline JS has zero .style.* assignments
   
   Delete both functions entirely. Do NOT touch the compare-related tests (`test_compare_zero_inline_styles`, `test_no_style_display_in_compare_js`) — compare.html is still a live page.

6. **Run full test suite and fix any remaining failures**:
   - `cd worker && npm test` — expect all Worker tests to pass (png-asset-count now expects custard-v26 from T01)
   - `uv run pytest tests/ -v` — expect all Python tests to pass with updated redirect/static/inline tests
   - `cd worker && npm run test:browser -- --workers=1` — Playwright specs should pass (forecast-fronts deleted, FUN-05 deleted, nav-clickthrough unchanged since nav still has 4 items)
   
   If any test fails due to a forecast-map.html reference not caught above, fix it. Do NOT modify any test that still passes.

## Must-Haves

- [ ] test_redirects.py REDIRECT_MAP includes `"forecast-map.html": "index.html"`
- [ ] test_redirects.py has `test_forecast_map_redirects_to_index` test method
- [ ] worker/test/browser/forecast-fronts.spec.mjs deleted
- [ ] worker/test/browser/fun-page.spec.mjs FUN-05 test deleted, FUN-01 through FUN-04 intact
- [ ] test_static_assets.py `test_leaflet_heat_is_vendored_locally` deleted
- [ ] test_inline_style_elimination.py forecast-map tests deleted, compare tests untouched
- [ ] `cd worker && npm test` passes
- [ ] `uv run pytest tests/ -v` passes

## Verification

- `cd worker && npm test` — all Worker tests pass
- `uv run pytest tests/ -v` — all Python tests pass
- `grep -q 'forecast-map.html' tests/test_redirects.py` — redirect test coverage exists
- `test -f worker/test/browser/forecast-fronts.spec.mjs && echo FAIL || echo PASS` — spec deleted
- `! grep -q 'test_leaflet_heat_is_vendored_locally' tests/test_static_assets.py` — dead test removed
- `! grep -q 'test_forecast_map_zero_inline_styles' tests/test_inline_style_elimination.py` — dead test removed

## Inputs

- `docs/forecast-map.html` — T01 output: now a redirect stub (needed by test_redirects assertions)
- `docs/sw.js` — T01 output: CACHE_VERSION is custard-v26 (needed by png-asset-count test)
- `docs/fun.html` — T01 output: Fronts section removed
- `worker/test/png-asset-count.test.js` — T01 output: expects custard-v26
- `tests/test_redirects.py` — existing test file to update with forecast-map.html entry
- `tests/test_static_assets.py` — existing test file with leaflet heat test to delete
- `tests/test_inline_style_elimination.py` — existing test file with forecast-map tests to delete
- `worker/test/browser/forecast-fronts.spec.mjs` — existing spec file to delete
- `worker/test/browser/fun-page.spec.mjs` — existing spec file, FUN-05 test to delete

## Expected Output

- `tests/test_redirects.py` — forecast-map.html added to REDIRECT_MAP and test method added
- `tests/test_static_assets.py` — test_leaflet_heat_is_vendored_locally removed
- `tests/test_inline_style_elimination.py` — forecast-map test functions removed
- `worker/test/browser/forecast-fronts.spec.mjs` — deleted
- `worker/test/browser/fun-page.spec.mjs` — FUN-05 test removed
