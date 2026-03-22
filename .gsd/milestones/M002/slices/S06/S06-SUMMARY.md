---
id: S06
parent: M002
milestone: M002
provides:
  - getDisplayName() utility in planner-domain.js — slug-derived store disambiguation for multi-store cities
  - Three-gate rarity system in worker/src/route-today.js — eliminates false-positive Rare badges
  - DOW signal filter in worker/src/signals.js — only surfaces day-of-week patterns for today's actual FOTD
  - buildRarityNudge removed from compare-page.js — no more duplicate rarity banners
  - Week Ahead strip renders L5 hero PNGs via renderHeroCone() with L0 SVG fallback
  - Widget getConeImage() diagnostic logging on PNG load failure
  - sw.js cache bumped to custard-v23
requires:
  - slice: S04
    provides: Cache-first hero rendering, stale-while-revalidate API pattern
affects:
  - S05
key_files:
  - docs/planner-domain.js
  - docs/compare-page.js
  - docs/today-page.js
  - docs/style.css
  - docs/sw.js
  - worker/src/route-today.js
  - worker/src/signals.js
  - widgets/custard-today.js
  - docs/assets/custard-today.js
  - worker/test/route-today-rarity.test.js
  - worker/test/signals-dow-filter.test.js
  - worker/test/store-display-name.test.js
  - worker/test/png-asset-count.test.js
  - worker/test/integration.test.js
key_decisions:
  - getDisplayName() derives street segment from slug (city-state-street pattern) rather than address field — slug parsing is faster and always available
  - Three-gate rarity requires ALL gates to pass — Gate 1 (≥10 appearances AND ≥90-day span), Gate 2 (≤100 DISTINCT slugs in 30 days), Gate 3 (Ultra Rare >150d avg gap, Rare 90–150d)
  - DOW filter applied at computeSignals() level so alert-checker and other consumers benefit, not just the rendering path
  - buildRarityNudge kept as no-op stub to prevent JS reference errors from any future callers
  - Week Ahead uses post-append querySelector pattern — card built with empty .week-day-cone placeholder in innerHTML, appended to DOM, then renderHeroCone() called on the live element
  - Widget getConeImage renamed local var to coneSlug for clarity; added console.log diagnostic on PNG load failure
  - sw.js cache version bumped from v22 to v23 to force clients to re-fetch updated assets
patterns_established:
  - Slug-to-street extraction: strip city-state prefix from slug, title-case remainder ("mineral-point-rd" → "Mineral Point Rd")
  - Multi-gate rarity: each gate independently logged in rarity response for diagnosability (appearances, avg_gap_days always present; label reflects all gates)
  - Signal filtering by FOTD: contextual signals filtered at computation time, not rendering time
  - Post-append renderHeroCone pattern: build card HTML with placeholder div, append to DOM, then call renderHeroCone on the live element
observability_surfaces:
  - /api/v1/today?slug=X returns rarity.appearances + rarity.avg_gap_days + rarity.label; null label reveals gate rejection
  - /api/v1/signals/{slug} omits dow_pattern entries for flavors != todayFlavor; .today field shows reference date
  - Compare page store chips show street-qualified names for cities with multiple stores
  - Widget console.log("[custard] getConeImage failed for '...'") in Scriptable's in-app console
  - sw.js CACHE_VERSION = 'custard-v23'
drill_down_paths:
  - .gsd/milestones/M002/slices/S06/tasks/T01-SUMMARY.md
  - .gsd/milestones/M002/slices/S06/tasks/T02-SUMMARY.md
duration: ~80 min (T01 ~55 min, T02 ~25 min)
verification_result: passed
completed_at: 2026-03-22
---

# S06: Bug Fixes — Store Disambiguation, Rarity, Art, Signals

**Shipped three-gate rarity suppression (eliminates false-positive Rare badges on Turtle/Caramel Pecan), slug-derived store disambiguation across all surfaces, Week Ahead L5 PNG cone art with SVG fallback, FOTD-only DOW signal filtering, and widget diagnostic logging — 7 user-reported bugs fixed across Compare, Today, Widget, and Worker.**

## What Happened

Two tasks delivered all seven bug fixes:

**T01 — Store disambiguation + rarity system overhaul (~55 min).** Examined the full store manifest (1012 stores, 140 cities with multiple locations) and confirmed slug patterns. Madison WI has 5 stores with slugs like `madison-wi-mineral-point-rd`; single-store cities like Verona have bare slugs. Built `getDisplayName()` in planner-domain.js that counts stores with matching city+state from allStores, returning a street-qualified name for ambiguous cities and a bare city name for unique ones. Applied it to Compare page chips, Compare grid row labels, Today hero meta footer, and near-me cards.

The three-gate rarity system in route-today.js ensures a flavor only gets a Rare/Ultra Rare badge when: (1) it has ≥10 appearances spanning ≥90 days (data quality), (2) ≤100 distinct stores served it in the last 30 days (not a chain-wide promotion), and (3) avg gap between appearances exceeds 90 days for Rare or 150 days for Ultra Rare (tightened from 60/120). This directly eliminates the false-positive Rare badges on commonly-served flavors like Turtle and Caramel Pecan.

The `buildRarityNudge` function body was gutted to a no-op (stub kept to prevent reference errors), removing the duplicate rarity banner on Compare. DOW signal filtering was added at the `computeSignals()` level — day-of-week pattern insights are now only shown when the pattern flavor matches today's actual FOTD, preventing irrelevant scheduling insights.

**T02 — Week Ahead art migration + widget fix (~25 min).** Replaced `renderMiniConeSVG()` calls in the week-ahead strip with `renderHeroCone()` using a post-append pattern: cards are built with an empty `.week-day-cone` placeholder, appended to the DOM, then `renderHeroCone()` is called on the live element with fallbackScale=3 (27×30px SVG on PNG miss). A CSS rule constrains `.hero-cone-img` to 40px inside `.week-day-cone` context.

Widget `getConeImage()` got a renamed local variable (`coneSlug` instead of `slug`) and diagnostic logging on PNG load failure. The `drawConeIcon()` triangle fallback was already correct — no change needed. Service worker cache bumped from v22 to v23 to force fresh asset delivery.

## Verification

Full worker test suite: **1034 passed, 4 skipped, 0 failed.**

New tests added across both tasks:
- 12 tests in `route-today-rarity.test.js` — all three rarity gates and edge cases
- 6 tests in `signals-dow-filter.test.js` — FOTD matching, null handling, non-DOW passthrough
- 22 tests in `store-display-name.test.js` — slug parsing, address fallback, single-store cities, edge cases
- 5 tests in `png-asset-count.test.js` — updated to match custard-v23 cache version

Integration test 64 mock D1 fixed to support `.first()` method for the new network count query. Widget files confirmed byte-for-byte identical between `widgets/` and `docs/assets/`.

## New Requirements Surfaced

- none

## Deviations

- Task plans had empty `## Steps` sections; steps were inferred from descriptions and Must-Haves.
- T01 summary reported 32 store-display-name tests; actual count is 22 (the test file was likely consolidated during implementation).
- Widget `drawConeIcon()` already rendered a proper triangular cone — the plan may have been written against an older version. The actual fix delivered was diagnostic logging + variable rename.
- The pre-existing sw.js cache version test failure (expecting v21 when sw.js had v22) was resolved as part of T02's cache bump to v23.

## Known Limitations

- `getDisplayName()` does O(n) `_allStores.find()` per near-me card render — acceptable at ≤5 cards × 1012 stores but would need indexing if allStores grows significantly.
- Gate 2 network count has no explicit field surfaced in the API response — diagnosing gate 2 rejections requires a direct D1 query. A future enhancement could add `network_store_count` to the rarity response object.

## Follow-ups

- none

## Files Created/Modified

- `docs/planner-domain.js` — Added `getDisplayName()`, `_streetFromSlug()`, `_streetFromAddress()` helpers; updated `rarityLabelFromGapDays()` thresholds; exported via Object.assign
- `docs/compare-page.js` — Gutted `buildRarityNudge` body (no-op stub); applied `getDisplayName()` to store chips and grid row labels
- `docs/today-page.js` — Applied `getDisplayName()` to hero meta footer and near-me cards; replaced `renderMiniConeSVG()` with post-append `renderHeroCone()` in week-ahead strip
- `docs/style.css` — Added `.week-day-cone .hero-cone-img { width: 40px !important; }` rule
- `docs/sw.js` — Cache version bumped: v22 → v23
- `worker/src/route-today.js` — Three-gate rarity system with new network count D1 query; tightened thresholds
- `worker/src/signals.js` — DOW pattern filter at `computeSignals()` level; only passes dow_pattern signals matching todayFlavor
- `widgets/custard-today.js` — Renamed local slug → coneSlug in `getConeImage()`; added diagnostic console.log on failure
- `docs/assets/custard-today.js` — Same changes (kept in sync with widgets/)
- `worker/test/route-today-rarity.test.js` — New: 12 tests covering all three rarity gates
- `worker/test/signals-dow-filter.test.js` — New: 6 tests for DOW signal FOTD filtering
- `worker/test/store-display-name.test.js` — New: 22 tests for getDisplayName() and helpers
- `worker/test/png-asset-count.test.js` — Updated cache version assertion to custard-v23
- `worker/test/integration.test.js` — Fixed mock D1 to support `.first()` for network count query

## Forward Intelligence

### What the next slice should know
- The rarity response object always includes `appearances` and `avg_gap_days` when D1 data exists, even when `label` is null. Social sharing (S05) can use these numeric fields to build rarity stat cards regardless of whether the label threshold is met.
- `getDisplayName()` is exported on `CustardPlanner` and available on all pages that load planner-domain.js. S05 social cards and S03 page consolidation can reuse it directly.
- Service worker is now at v23 — any further asset changes need another cache bump.

### What's fragile
- The post-append `renderHeroCone()` pattern in week-ahead strip relies on cards being appended to a live DOM element before `querySelector` runs. If the rendering flow changes to batch-insert or use DocumentFragment, the cone elements won't be queryable and PNGs won't load. The guard (`day.flavor && typeof renderHeroCone === 'function'`) prevents errors but would silently show empty cones.
- `buildRarityNudge` is a no-op stub — if someone adds a call to it expecting the old banner behavior, nothing visible will happen. The function should eventually be fully deleted once all callers are confirmed removed.

### Authoritative diagnostics
- `curl $WORKER/api/v1/today?slug=mt-horeb | jq .rarity` — shows gate results (appearances, avg_gap_days, label). Null label means at least one gate rejected.
- `curl $WORKER/api/v1/signals/mt-horeb | jq '.signals[] | select(.type=="dow_pattern")'` — empty result means either no DOW pattern detected or FOTD doesn't match the pattern flavor.
- `grep CACHE_VERSION docs/sw.js` — must show custard-v23 after this slice.

### What assumptions changed
- Original rarity thresholds (60d Rare, 120d Ultra Rare) were too aggressive — commonly-served flavors like Turtle and Caramel Pecan triggered false positives. Tightened to 90d/150d with two additional prerequisite gates.
- Store display name was assumed to come from address fields — slug parsing turned out to be more reliable and always available (1012/1012 stores have parseable slugs).
- The plan listed 7 bugs; all 7 were fixed across 2 tasks without needing the originally planned 3-task breakdown.
