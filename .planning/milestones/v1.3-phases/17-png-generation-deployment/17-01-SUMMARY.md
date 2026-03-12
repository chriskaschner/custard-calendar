---
phase: 17-png-generation-deployment
plan: 01
subsystem: assets
tags: [png, sharp, hero-cone, alias-resolution, ci-test]

# Dependency graph
requires:
  - phase: 16-bulk-profile-authoring
    provides: "94 FLAVOR_PROFILES + 37 FLAVOR_ALIASES covering all known flavors"
  - phase: 13-rendering-quality-fixes
    provides: "300 DPI supersample + nearest-neighbor rasterization pipeline"
provides:
  - "94 Hero cone PNGs in docs/assets/cones/ (one per FLAVOR_PROFILES key)"
  - "heroConeSrc() with alias resolution via FALLBACK_FLAVOR_ALIASES"
  - "CI test for PNG count drift and alias structure correctness"
affects: [17-02-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "alias resolution at lookup time, not generation time (94 PNGs, not 131)"
    - "CI PNG count test prevents asset drift from FLAVOR_PROFILES"

key-files:
  created:
    - "worker/test/png-asset-count.test.js"
  modified:
    - "docs/cone-renderer.js"
    - "docs/assets/cones/*.png (54 new, 14 modified)"

key-decisions:
  - "heroConeSrc uses normalizeFlavorKey + FALLBACK_FLAVOR_ALIASES for alias resolution before slugifying"
  - "Clean-slate PNG regeneration: deleted all existing PNGs before regenerating to reflect Phase 13-16 improvements"
  - "CACHE_VERSION test intentionally fails (v18 vs v19) -- deferred to Plan 02 as designed"

patterns-established:
  - "PNG count CI test: readdirSync(docs/assets/cones) count === Object.keys(FLAVOR_PROFILES).length"
  - "Slug consistency: generate script and heroConeSrc use identical regex for filename resolution"

requirements-completed: [PNGS-01]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 17 Plan 01: PNG Generation & Deployment Summary

**94 Hero cone PNGs regenerated from Phase 13-16 improved profiles, with alias resolution in heroConeSrc() and CI count test**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T00:43:44Z
- **Completed:** 2026-03-11T00:46:08Z
- **Tasks:** 2
- **Files modified:** 70 (1 JS + 1 test + 68 PNGs)

## Accomplishments
- heroConeSrc() now resolves aliased flavor names via normalizeFlavorKey + FALLBACK_FLAVOR_ALIASES before building PNG path
- All 94 Hero cone PNGs regenerated from scratch reflecting Phase 13-16 color/contrast/profile improvements
- CI test prevents PNG count drift (asserts file count === FLAVOR_PROFILES key count)
- Slug consistency test verifies generate script and heroConeSrc use identical regex patterns
- Golden baselines pass (376/376), full suite 1350/1351 (only CACHE_VERSION test pending for Plan 02)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests** - `d9f1234` (test)
2. **Task 1 (GREEN): Implement heroConeSrc alias resolution** - `0bc246e` (feat)
3. **Task 2: Regenerate all 94 Hero cone PNGs** - `e3769a8` (feat)

_Note: TDD task has RED and GREEN commits. No REFACTOR needed -- implementation was clean._

## Files Created/Modified
- `worker/test/png-asset-count.test.js` - CI test: PNG count, alias structure, slug consistency, CACHE_VERSION
- `docs/cone-renderer.js` - heroConeSrc() updated with normalizeFlavorKey + FALLBACK_FLAVOR_ALIASES alias resolution
- `docs/assets/cones/*.png` - 94 Hero cone PNGs (54 new, 14 modified, 26 unchanged)

## Decisions Made
- heroConeSrc uses normalizeFlavorKey for unicode normalization before FALLBACK_FLAVOR_ALIASES lookup, matching the resolution chain established in Phase 15
- Clean-slate regeneration: all 40 existing PNGs deleted before regeneration to ensure every PNG reflects current profiles
- CACHE_VERSION test (custard-v19) intentionally left failing -- will go green in Plan 02 when sw.js is bumped

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 94 PNGs committed and tracked by git
- heroConeSrc() alias resolution ready for production
- Plan 02 can proceed: bump CACHE_VERSION to custard-v19, CACHE_VERSION test goes green
- Full test suite green except expected CACHE_VERSION test (by design)

## Self-Check: PASSED

- worker/test/png-asset-count.test.js: FOUND
- docs/cone-renderer.js: FOUND
- docs/assets/cones/*.png: 94 files FOUND
- Commit d9f1234: FOUND
- Commit 0bc246e: FOUND
- Commit e3769a8: FOUND
- SUMMARY.md: FOUND

---
*Phase: 17-png-generation-deployment*
*Completed: 2026-03-10*
