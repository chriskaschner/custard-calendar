---
phase: 11-monolith-refactoring
plan: 02
subsystem: frontend
tags: [vanilla-js, service-worker, html-wiring, playwright, regression-gate]

# Dependency graph
requires:
  - phase: 11-monolith-refactoring
    plan: 01
    provides: "3 IIFE sub-modules (planner-data.js, planner-domain.js, planner-ui.js) and slimmed facade"
provides:
  - "All 9 HTML pages load the full 4-module planner stack in correct order"
  - "Service worker pre-caches 3 new JS files with CACHE_VERSION custard-v18"
  - "Zero regressions: 81 browser tests pass, 14 pre-existing failures unchanged"
affects: [12-compare-multi-store]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Uniform 4-script loading across all pages (shared -> data -> domain -> ui)"]

key-files:
  created: []
  modified:
    - "custard-calendar/docs/index.html"
    - "custard-calendar/docs/map.html"
    - "custard-calendar/docs/compare.html"
    - "custard-calendar/docs/fun.html"
    - "custard-calendar/docs/updates.html"
    - "custard-calendar/docs/quiz.html"
    - "custard-calendar/docs/forecast-map.html"
    - "custard-calendar/docs/group.html"
    - "custard-calendar/docs/privacy.html"
    - "custard-calendar/docs/sw.js"

key-decisions:
  - "All 3 sub-modules loaded on every page (no selective loading) per CONTEXT.md decision"
  - "14 pre-existing browser test failures documented as out-of-scope (drive/quiz/map tests failing before monolith split)"

patterns-established:
  - "Script load order: planner-shared.js -> planner-data.js -> planner-domain.js -> planner-ui.js -> shared-nav.js -> page-specific JS"

requirements-completed: [ARCH-01, ARCH-02]

# Metrics
duration: 12min
completed: 2026-03-09
---

# Phase 11 Plan 02: HTML Wiring + SW Update Summary

**Wired 3 IIFE sub-modules into all 9 HTML pages, bumped SW to custard-v18, and confirmed zero regressions across 81 passing browser tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-09T18:52:18Z
- **Completed:** 2026-03-09T19:04:37Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added planner-data.js, planner-domain.js, planner-ui.js script tags to all 9 production HTML pages in correct load order after planner-shared.js
- Bumped service worker CACHE_VERSION from custard-v17 to custard-v18 and added 3 new files to STATIC_ASSETS
- API surface smoke test passes (all 60 CustardPlanner exports verified with correct types)
- Full Playwright regression suite: 81 passed, 11 skipped, 14 pre-existing failures (not regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sub-module script tags to all 9 HTML pages** - `6b1b43f` (feat)
2. **Task 2: Update SW STATIC_ASSETS and bump CACHE_VERSION** - `365a399` (feat)

## Files Created/Modified
- `custard-calendar/docs/index.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/map.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/compare.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/fun.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/updates.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/quiz.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/forecast-map.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/group.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/privacy.html` - Added 3 sub-module script tags after planner-shared.js
- `custard-calendar/docs/sw.js` - Bumped CACHE_VERSION to custard-v18, added 3 new STATIC_ASSETS entries

## Decisions Made
- All 3 sub-modules load on every page uniformly (no selective per-page loading), following the CONTEXT.md decision to keep wiring simple
- 14 browser test failures confirmed as pre-existing (failing identically against Phase 10 pre-split code) -- not regressions from the monolith refactoring
- No changes required to any page-specific JS files (today-page.js, compare-page.js, etc.) -- facade pattern works as designed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 14 browser tests fail (drive-preferences, index-drive-minimap-sync, index-todays-drive, map-pan-stability, quiz-personality, quiz-trivia-dynamic). Verified against Phase 10 commit (1e15c28) that all 14 were already failing before the monolith split. Root causes: todays-drive.js not loaded from index.html (drive tests), quiz API mocking issues (quiz tests), map test infrastructure. These are out-of-scope pre-existing issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monolith refactoring complete (ARCH-01 + ARCH-02 satisfied)
- Phase 12 (Compare Multi-Store) can proceed with the clean 4-module architecture
- Pre-existing test failures in drive/quiz/map specs should be addressed in a future maintenance pass

## Self-Check: PASSED

All 10 modified files verified on disk. Task commits 6b1b43f and 365a399 verified in git log.

---
*Phase: 11-monolith-refactoring*
*Completed: 2026-03-09*
