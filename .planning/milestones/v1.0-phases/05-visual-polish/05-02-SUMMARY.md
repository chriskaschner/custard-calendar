---
phase: 05-visual-polish
plan: 02
subsystem: ui
tags: [pixel-art, png, service-worker, cone-renderer, hero-card, stale-while-revalidate]

# Dependency graph
requires:
  - phase: 05-01
    provides: Card system (.card base class), design tokens, seasonal rarity suppression
provides:
  - heroConeSrc() and renderHeroCone() functions for PNG-first hero rendering
  - 40 pre-rendered hero cone PNGs in docs/assets/cones/
  - Runtime stale-while-revalidate cone PNG caching in service worker
  - SVG fallback for newly added flavors without a pre-rendered PNG
affects: []

# Tech tracking
tech-stack:
  added: [sips (macOS native, used for SVG-to-PNG rasterization in generation script)]
  patterns: [PNG-first with onerror SVG fallback, runtime stale-while-revalidate for non-static assets, renderConeHeroSVG at scale 4 for hero PNGs]

key-files:
  created:
    - docs/assets/cones/*.png (40 hero cone PNGs)
    - worker/test/browser/vizp-cone-tiers.spec.mjs
    - scripts/generate-hero-cones.mjs
  modified:
    - docs/cone-renderer.js
    - docs/today-page.js
    - docs/sw.js
    - docs/style.css
    - .gitignore
    - worker/test/browser/today-hero.spec.mjs

key-decisions:
  - "Generated PNGs for 40 flavors in FLAVOR_PROFILES (canonical visual profiles), not ~176 (broader catalog); remaining flavors use SVG fallback"
  - "Used macOS sips for SVG-to-PNG rasterization (available natively, no npm dependency needed)"
  - "Hero PNGs rendered at 36x42 grid scale 4 (144x168px SVG) resized to 120px width"
  - "Added .gitignore exception for docs/assets/cones/*.png (*.png is globally ignored)"

patterns-established:
  - "PNG-first hero rendering: heroConeSrc() for path lookup, renderHeroCone() for DOM insertion with onerror fallback"
  - "Runtime cone cache pattern: service worker intercepts /assets/cones/*.png before general stale-while-revalidate handler"
  - "Hero PNG generation: scripts/generate-hero-cones.mjs uses Worker's renderConeHeroSVG and rasterizes via sips"

requirements-completed: [VIZP-01, VIZP-04]

# Metrics
duration: 12min
completed: 2026-03-08
---

# Phase 5 Plan 02: Hero Cone Asset Pipeline Summary

**Pre-rendered pixel art hero cone PNGs for 40 profiled flavors with PNG-first rendering, onerror SVG fallback, and runtime stale-while-revalidate service worker caching**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-08T21:22:12Z
- **Completed:** 2026-03-08T21:34:26Z
- **Tasks:** 2
- **Files modified:** 7 (+ 40 PNG assets created)

## Accomplishments
- heroConeSrc() and renderHeroCone() added to cone-renderer.js for PNG-first hero rendering with automatic SVG fallback
- 40 hero cone PNGs generated from renderConeHeroSVG (36x42 grid) covering all FLAVOR_PROFILES entries
- Today page hero card now renders PNG <img> instead of inline HD SVG, with onerror fallback to renderMiniConeHDSVG
- Service worker bumped to custard-v15 with dedicated runtime cache handler for assets/cones/*.png
- Compact contexts (Compare cells, multi-store row, week-ahead strip) unchanged -- still use SVG renderer
- 5 new Playwright tests for VIZP-01 and VIZP-04 requirements, all passing
- Full browser suite: 91 passed, 5 skipped, 0 failed

## Task Commits

Each task was committed atomically:

1. **Task 1: Hero cone PNG lookup, fallback rendering, and full asset generation** - `a80cd04` (feat + test)
2. **Task 2: Service worker runtime cone caching and cache version bump** - `4731189` (feat)

_TDD task 1 had RED phase test commit `69cd7b3` followed by GREEN phase implementation commit `a80cd04`._

## Files Created/Modified
- `docs/cone-renderer.js` - Added heroConeSrc() and renderHeroCone() functions
- `docs/today-page.js` - Hero card now calls renderHeroCone() instead of renderMiniConeHDSVG()
- `docs/sw.js` - CACHE_VERSION bumped to custard-v15, runtime cone PNG cache handler
- `docs/style.css` - Added .hero-cone-img rule with image-rendering: pixelated
- `docs/assets/cones/*.png` - 40 pre-rendered hero cone PNGs (~320KB total)
- `scripts/generate-hero-cones.mjs` - Generation script using Worker's renderConeHeroSVG + sips
- `.gitignore` - Added exception for docs/assets/cones/*.png
- `worker/test/browser/vizp-cone-tiers.spec.mjs` - 5 Playwright tests for VIZP-01/04
- `worker/test/browser/today-hero.spec.mjs` - Updated to use dynamic dates and accept img|svg cone

## Decisions Made
- Generated PNGs for 40 flavors (FLAVOR_PROFILES entries) rather than ~176 (broader catalog). The 40 flavors have defined visual profiles (base colors, toppings, ribbons, density). The remaining ~136 flavors in the broader catalog would render as generic vanilla cones. SVG fallback handles them adequately.
- Used macOS sips for SVG-to-PNG rasterization instead of installing sharp as a project dependency. Available natively on the build machine.
- Added .gitignore exception because *.png is globally ignored (for Tidbyt renders/screenshots). Hero cone PNGs need to be committed for GitHub Pages serving.
- Updated today-hero.spec.mjs to use dynamic dates (matching vizp-card-system.spec.mjs pattern) instead of hardcoded 2026-03-07 dates that break when the date changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .gitignore exception for docs/assets/cones/*.png**
- **Found during:** Task 1 (PNG asset generation and commit)
- **Issue:** *.png is globally ignored in .gitignore for Tidbyt renders. Hero cone PNGs could not be staged for commit.
- **Fix:** Added `!docs/assets/cones/*.png` exception to .gitignore, following existing pattern for `!docs/og-*.png` and `!docs/screenshots/*.png`
- **Files modified:** .gitignore
- **Verification:** `git check-ignore docs/assets/cones/vanilla.png` returns exit code 1 (not ignored)
- **Committed in:** a80cd04 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed time-dependent today-hero.spec.mjs test dates**
- **Found during:** Task 1 verification (regression check)
- **Issue:** today-hero.spec.mjs used hardcoded dates (2026-03-07) which caused TDAY-01 to show "Butter Pecan" (2026-03-08 flavor) instead of "Chocolate Eclair" (2026-03-07) because today is 2026-03-08.
- **Fix:** Replaced hardcoded dates with dynamic date computation (same pattern as vizp-card-system.spec.mjs and other test files)
- **Files modified:** worker/test/browser/today-hero.spec.mjs
- **Verification:** All 5 TDAY tests pass
- **Committed in:** a80cd04 (Task 1 commit)

**3. [Rule 1 - Bug] Updated TDAY-01 cone assertion for PNG rendering**
- **Found during:** Task 1 verification (regression check)
- **Issue:** TDAY-01 test asserted `coneHtml.toContain("svg")` which fails when hero card renders a PNG <img> tag
- **Fix:** Changed assertion to `coneHtml.toMatch(/svg|img/)` to accept either rendering mode
- **Files modified:** worker/test/browser/today-hero.spec.mjs
- **Verification:** TDAY-01 passes with PNG rendering active
- **Committed in:** a80cd04 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bug fixes, 1 blocking issue)
**Impact on plan:** All auto-fixes necessary for correctness. The .gitignore exception was required to commit assets. The test fixes were required because our PNG rendering change broke an existing test assertion and exposed a pre-existing time-dependent bug.

## Issues Encountered
- Plan specified "~176 flavors" but FLAVOR_PROFILES (canonical visual profiles) contains 40 entries. The broader SEED_CATALOG has ~39 flavors. The "176" number likely refers to accumulated KV flavors. Generated PNGs for all 40 profiled flavors; remaining flavors get the SVG fallback.
- sharp not available as a direct import (only as a transitive dependency of miniflare). Used macOS sips as fallback, which worked correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 is now complete (2 of 2 plans done)
- All VIZP requirements verified: card system, design tokens, seasonal rarity suppression, cone tier rendering
- 91 browser tests passing, full regression suite clean
- Project is at 100% plan completion for the v1.0 milestone

## Self-Check: PASSED

- All 8 key files verified present
- 40 PNG assets in docs/assets/cones/
- Commit 69cd7b3: TDD RED phase tests
- Commit a80cd04: Task 1 implementation (46 files)
- Commit 4731189: Task 2 service worker updates

---
*Phase: 05-visual-polish*
*Completed: 2026-03-08*
