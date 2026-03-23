---
estimated_steps: 5
estimated_files: 4
skills_used: []
---

# T01: Redirect forecast-map.html and update production files

**Slice:** S03 — Page Consolidation
**Milestone:** M002

## Description

Replace the 945-line forecast-map.html with a minimal redirect stub that sends users to index.html (preserving query params and hash). Remove the dead "Flavor Fronts" section from fun.html. Update sw.js to stop precaching forecast-map.html and bump the cache version so returning users pick up the change.

## Steps

1. Replace `docs/forecast-map.html` with the established redirect stub pattern. The stub must: use `<meta http-equiv="refresh" content="0;url=index.html">`, include a JS fallback that preserves `window.location.search` and `window.location.hash`, be under 1000 bytes, and NOT include shared-nav.js, style.css, or planner-shared.js. Use the exact same pattern as `docs/scoop.html` (read it as a reference).

2. Remove the entire `<section id="fronts-section" class="fun-section">...</section>` block from `docs/fun.html`. This section is at approximately lines 140-146 and contains a card linking to forecast-map.html with "Flavor Fronts" heading and "View Map" CTA. Remove the section and its contents but leave all other sections intact (quiz-modes, mad-libs, group-vote).

3. In `docs/sw.js`, remove `'./forecast-map.html'` from the `STATIC_ASSETS` array (currently line 5). Change `CACHE_VERSION` from `'custard-v25'` to `'custard-v26'` on line 1.

4. In `worker/test/png-asset-count.test.js`, update the cache version expectation from `custard-v25` to `custard-v26` (line ~48-50, the string `'custard-v25'` in the `toContain` assertion).

5. Verify all changes: confirm forecast-map.html is a stub under 1000 bytes with correct meta-refresh, sw.js has no forecast-map reference and says custard-v26, fun.html has no fronts-section.

## Must-Haves

- [ ] forecast-map.html is a redirect stub under 1000 bytes with `content="0;url=index.html"` meta-refresh
- [ ] forecast-map.html JS fallback preserves query params and hash fragments
- [ ] forecast-map.html does NOT reference shared-nav.js, style.css, or planner-shared.js
- [ ] fun.html `<section id="fronts-section">` completely removed
- [ ] sw.js STATIC_ASSETS does not contain `./forecast-map.html`
- [ ] sw.js CACHE_VERSION is `custard-v26`
- [ ] png-asset-count.test.js expects `custard-v26`

## Verification

- `grep -q 'content="0;url=index.html"' docs/forecast-map.html` — redirect target correct
- `wc -c < docs/forecast-map.html | awk '{exit ($1 > 1000)}'` — stub under 1000 bytes
- `! grep -q 'shared-nav.js\|style.css\|planner-shared.js' docs/forecast-map.html` — no forbidden resources
- `! grep -q 'forecast-map.html' docs/sw.js` — removed from precache
- `grep -q 'custard-v26' docs/sw.js` — cache version bumped
- `! grep -q 'fronts-section' docs/fun.html` — Fronts section removed
- `grep -q 'custard-v26' worker/test/png-asset-count.test.js` — test expectation updated

## Inputs

- `docs/forecast-map.html` — current 945-line full page to be replaced with redirect stub
- `docs/scoop.html` — reference redirect stub to copy the pattern from
- `docs/fun.html` — current page with `#fronts-section` to remove
- `docs/sw.js` — STATIC_ASSETS array and CACHE_VERSION to update
- `worker/test/png-asset-count.test.js` — cache version expectation to update

## Expected Output

- `docs/forecast-map.html` — replaced with redirect stub (<1000 bytes)
- `docs/fun.html` — Fronts section removed
- `docs/sw.js` — forecast-map.html removed from STATIC_ASSETS, CACHE_VERSION bumped to custard-v26
- `worker/test/png-asset-count.test.js` — expects custard-v26
