---
phase: 24-cone-rendering-quality
plan: 01
subsystem: rendering
tags: [svg, pixel-art, prng, scatter, cone-renderer, golden-baselines]

# Dependency graph
requires:
  - phase: 17-png-generation
    provides: "94 hero PNGs, golden baseline infrastructure, pixelmatch tests"
provides:
  - "Canonical 5-shape topping vocabulary shared across all tiers"
  - "Hero scatter renderer with Mulberry32 PRNG + collision detection"
  - "Hero density resolver (pure/standard/double/explosion/overload)"
  - "Premium tier integration with canonical shape map"
  - "376 refreshed golden baselines at zero pixelmatch tolerance"
affects: [24-02-PLAN, cone-renderer.js, generate-hero-cones.mjs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seeded scatter placement with collision detection (ported from premium to hero)"
    - "Canonical shape map shared across rendering tiers"
    - "Density-to-piece-count resolution per tier"

key-files:
  created: []
  modified:
    - worker/src/flavor-colors.js
    - worker/test/flavor-colors.test.js
    - worker/test/fixtures/goldens/hero/
    - worker/test/fixtures/goldens/premium/

key-decisions:
  - "33 TOPPING_COLORS keys (not 36 as plan estimated) -- all mapped in canonical shape map"
  - "Hero scoop rows use pr * 100 + pc hash for collision detection (same formula as premium)"
  - "Premium renderer switched to canonical maps; old _PREM_SHAPE_MAP/_PREM_TOPPING_SHAPES kept as dead code"

patterns-established:
  - "Canonical shape map: _CANONICAL_SHAPE_MAP assigns one of 5 shape types to every topping key"
  - "Hero density resolution: resolveHeroToppingList returns flat topping lists sized by density tier"

requirements-completed: [CONE-01, CONE-02, CONE-03]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 24 Plan 01: Cone Rendering Quality Summary

**Hero scatter renderer with 5-shape vocabulary, seeded PRNG placement, collision detection, and density-based piece counts replacing 8 fixed 2x2 topping slots**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T02:57:28Z
- **Completed:** 2026-03-18T03:01:50Z
- **Tasks:** 2 (TDD task + golden baseline regeneration)
- **Files modified:** 145 (2 source/test + 143 golden baseline PNGs)

## Accomplishments
- Canonical 5-shape topping vocabulary (dot 2x2, chunk 3x2, sliver 1x3, flake 3x1, scatter 1x1+1x1) shared across tiers
- Hero renderer upgraded from 8 fixed 2x2 topping slots to seeded Mulberry32 scatter with collision detection -- toppings now fill center columns that were previously empty
- Hero density resolver produces correct piece counts per tier: pure(0), standard(16), double(20), explosion(24), overload(16)
- Premium renderer integrated with canonical shape map (gains flake and scatter shapes it didn't have before)
- All 376 golden baselines regenerated and verified at zero pixelmatch tolerance

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `7f45f98` (test)
2. **Task 1 (GREEN): Implementation** - `a1e20c5` (feat)
3. **Task 2: Regenerate golden baselines** - `d6ca7e2` (chore)

## Files Created/Modified
- `worker/src/flavor-colors.js` - Added _CANONICAL_TOPPING_SHAPES, _CANONICAL_SHAPE_MAP, resolveHeroToppingList; rewrote renderConeHeroSVG scatter logic; updated renderConePremiumSVG to use canonical maps
- `worker/test/flavor-colors.test.js` - Added 15 new tests for shapes, shape map coverage, density resolver, scatter renderer behavior; updated 6 golden hashes
- `worker/test/fixtures/goldens/hero/*.png` - 94 hero baselines regenerated (scatter toppings)
- `worker/test/fixtures/goldens/premium/*.png` - 94 premium baselines regenerated (canonical shape map)

## Decisions Made
- Plan referenced 36 TOPPING_COLORS keys but codebase has 33 -- mapped all 33 with full coverage
- Kept _PREM_TOPPING_SHAPES and _PREM_SHAPE_MAP as dead code (plan specified "do NOT delete")
- Used pr * 100 + pc formula for collision detection hash (matches premium tier pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TOPPING_COLORS key count mismatch**
- **Found during:** Task 1 (canonical shape map authoring)
- **Issue:** Plan specified 36 TOPPING_COLORS keys but codebase has 33
- **Fix:** Mapped all 33 actual keys; adjusted test to check against TOPPING_COLORS rather than hardcoded count
- **Files modified:** worker/src/flavor-colors.js, worker/test/flavor-colors.test.js
- **Verification:** _CANONICAL_SHAPE_MAP test verifies all TOPPING_COLORS keys are covered
- **Committed in:** a1e20c5

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor -- plan had an incorrect count estimate. All actual keys mapped correctly. No scope creep.

## Issues Encountered
None -- implementation followed plan pattern precisely.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 24-02 (HD scatter upgrade + PNG regeneration + SW cache bump) can proceed
- Hero renderer is complete and tested
- Canonical shape map is ready for HD tier integration
- docs/cone-renderer.js needs syncing (Plan 02 scope)

## Self-Check: PASSED

All files found, all commits verified.

---
*Phase: 24-cone-rendering-quality*
*Completed: 2026-03-17*
