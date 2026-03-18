---
phase: 24-cone-rendering-quality
plan: 02
subsystem: rendering
tags: [svg, pixel-art, scatter, prng, golden-baselines, service-worker, hero-png]

# Dependency graph
requires:
  - phase: 24-01
    provides: "_CANONICAL_TOPPING_SHAPES, _CANONICAL_SHAPE_MAP, resolveHeroToppingList, hero scatter renderer"
provides:
  - "HD scatter renderer with shaped toppings (resolveHDScatterToppingList + updated renderConeHDSVG)"
  - "Client-side HD renderer synced with worker (cone-renderer.js)"
  - "94 regenerated hero cone PNGs from updated renderer pipeline"
  - "376 green golden baselines at zero pixelmatch tolerance"
  - "SW cache v20 for fresh asset delivery"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HD scatter renderer: Mulberry32 PRNG + _CANONICAL_SHAPE_MAP collision-detected placement"
    - "Client-side sync: var-style vanilla JS mirroring ES module worker renderer"

key-files:
  created: []
  modified:
    - "worker/src/flavor-colors.js"
    - "docs/cone-renderer.js"
    - "docs/sw.js"
    - "docs/assets/cones/*.png (94 files)"
    - "worker/test/fixtures/goldens/hd/*.png (94 files)"
    - "worker/test/flavor-colors.test.js"
    - "worker/test/png-asset-count.test.js"

key-decisions:
  - "HD scatter uses 10/12/14/10 piece counts (scaled down from hero's 16/20/24/16 to fit smaller grid)"
  - "HD shapes render at full resolution (dot 2x2, chunk 3x2, sliver 1x3, flake 3x1) -- grid is large enough"
  - "Client-side uses object literal {} instead of Set for occupied tracking (ES5 compat, no build step)"

patterns-established:
  - "_HD_SCOOP_ROWS constant: extracted scoop geometry used by both base fill and scatter bounds checking"
  - "HD scatter render order: base fill -> highlight -> scatter toppings -> ribbon -> cone -> tip"

requirements-completed: [CONE-01, CONE-02, CONE-03, CONE-04]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 24 Plan 02: HD Scatter Upgrade Summary

**HD cone renderer upgraded with Mulberry32 scatter + canonical shapes, client-side synced, 94 hero PNGs regenerated, 376 golden baselines green, SW cache v20**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T03:05:42Z
- **Completed:** 2026-03-18T03:11:56Z
- **Tasks:** 2
- **Files modified:** 178

## Accomplishments
- HD renderer upgraded from 8 fixed 1x1 topping slots to Mulberry32 PRNG scatter placement with per-type shaped toppings and collision detection
- Client-side cone-renderer.js fully synced with worker HD renderer (canonical shapes, scatter, PRNG, darkenHex)
- All 376 golden baselines regenerated and passing at zero pixelmatch tolerance
- All 94 hero cone PNGs regenerated at 144x168px 300 DPI
- Service worker cache bumped to v20 for fresh asset delivery

## Task Commits

Each task was committed atomically:

1. **Task 1: HD renderer scatter upgrade + client-side sync** (TDD)
   - `f5eac18` (test) - Failing tests for resolveHDScatterToppingList + scatter renderer
   - `7b430b5` (feat) - HD scatter implementation + client-side sync + golden hash update
2. **Task 2: Regenerate goldens + hero PNGs + SW cache bump** - `241e3cc` (feat)

## Files Created/Modified
- `worker/src/flavor-colors.js` - Added resolveHDScatterToppingList, _HD_SCOOP_ROWS, updated renderConeHDSVG with scatter
- `docs/cone-renderer.js` - Added _CANONICAL_TOPPING_SHAPES, _CANONICAL_SHAPE_MAP, _mulberry32, darkenHex, resolveHDScatterToppingList, updated renderMiniConeHDSVG
- `docs/sw.js` - Cache version bumped from v19 to v20
- `docs/assets/cones/*.png` - 94 hero cone PNGs regenerated
- `worker/test/fixtures/goldens/{mini,hd,premium,hero}/*.png` - 376 golden baselines regenerated
- `worker/test/flavor-colors.test.js` - Added resolveHDScatterToppingList tests, updated HD renderer tests, updated golden hashes
- `worker/test/png-asset-count.test.js` - Updated CACHE_VERSION assertion to v20

## Decisions Made
- HD scatter uses 10/12/14/10 piece counts (standard/double/explosion/overload), scaled proportionally from hero's 16/20/24/16 to fit the smaller 18x21 grid
- HD shapes render at full resolution (all 5 canonical shapes) since even the 14-column scoop width accommodates chunk (3x2) and flake (3x1)
- Client-side occupied tracking uses plain object `{}` instead of Set for ES5 compatibility (no build step)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vanilla pure density test false positive**
- **Found during:** Task 1 (TDD RED)
- **Issue:** Test checking for zero topping-colored rects in vanilla (pure) found `pecan=#8B5A2B` matching the cone tip color
- **Fix:** Excluded topping colors that collide with structural colors (CONE_TIP_COLOR, base color) from the assertion
- **Files modified:** worker/test/flavor-colors.test.js
- **Verification:** Test passes correctly for pure density flavors
- **Committed in:** 7b430b5 (Task 1 commit)

**2. [Rule 1 - Bug] Updated png-asset-count test for new cache version**
- **Found during:** Task 2 (SW cache bump)
- **Issue:** Existing test hardcoded `custard-v19` assertion, failing after bump to v20
- **Fix:** Updated test to expect `custard-v20`
- **Files modified:** worker/test/png-asset-count.test.js
- **Verification:** Full test suite passes (1377 tests)
- **Committed in:** 241e3cc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for test correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 24 (Cone Rendering Quality) complete: all 4 tiers now use canonical shape vocabulary
- Hero, HD, and premium tiers use scatter placement; mini tier remains fixed-slot (appropriate for 9x11 grid)
- All 376 golden baselines green, all 94 hero PNGs fresh, SW cache forces refresh

---
*Phase: 24-cone-rendering-quality*
*Completed: 2026-03-17*
