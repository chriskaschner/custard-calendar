---
phase: 12-feature-development
plan: 03
subsystem: ui
tags: [localStorage, compare-page, state-isolation, playwright]

# Dependency graph
requires:
  - phase: 11-monolith-refactoring
    provides: IIFE sub-module pattern with CustardPlanner shared API
provides:
  - Isolated localStorage key for compare page store selections
  - Compare page no longer modifies custard:v1:preferences
  - 6 new Playwright tests for localStorage isolation (CMPR-01)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [page-scoped localStorage keys for cross-page state isolation]

key-files:
  created:
    - custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs
  modified:
    - custard-calendar/docs/compare-page.js
    - custard-calendar/worker/test/browser/compare-picker.spec.mjs
    - custard-calendar/worker/test/browser/compare-filter.spec.mjs
    - custard-calendar/worker/test/browser/compare-grid.spec.mjs
    - custard-calendar/worker/test/browser/compare-expand.spec.mjs
    - custard-calendar/worker/test/browser/vizp-card-system.spec.mjs
    - custard-calendar/worker/test/browser/vizp-cone-tiers.spec.mjs
    - custard-calendar/worker/test/browser/vizp-seasonal-rarity.spec.mjs

key-decisions:
  - "Compare page uses plain JSON array in custard:compare:stores (not nested under activeRoute.stores)"
  - "Clean start for existing users -- no migration from old key"
  - "Primary store fallback preserved for first-time compare visitors"

patterns-established:
  - "Page-scoped localStorage keys: each page that persists state uses its own namespaced key to prevent cross-page leaking"

requirements-completed: [CMPR-01]

# Metrics
duration: 7min
completed: 2026-03-09
---

# Phase 12 Plan 03: Compare localStorage Isolation Summary

**Isolated compare page store selections into dedicated localStorage key (custard:compare:stores), eliminating cross-page state leaking with custard:v1:preferences**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-09T22:23:40Z
- **Completed:** 2026-03-09T22:30:44Z
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments
- Compare page reads/writes store selections exclusively from `custard:compare:stores` key
- Today page drive preferences (`custard:v1:preferences`) are never modified by compare page
- 6 new Playwright tests verify key isolation, old key non-interference, primary fallback, and multi-store grid
- All 30 compare-related browser tests pass (6 new + 24 existing updated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing Playwright tests for compare localStorage isolation** - `62730bb` (test)
2. **Task 2: Isolate compare-page.js localStorage key and update existing tests** - `c178745` (feat)

## Files Created/Modified
- `custard-calendar/worker/test/browser/compare-localstorage-isolation.spec.mjs` - 6 new CMPR-01 isolation tests
- `custard-calendar/docs/compare-page.js` - New COMPARE_STORES_KEY constant, rewritten getSavedStoreSlugs/saveStoreSlugs
- `custard-calendar/worker/test/browser/compare-picker.spec.mjs` - Updated setupComparePage and persistence test for new key
- `custard-calendar/worker/test/browser/compare-filter.spec.mjs` - Updated setupComparePage for new key
- `custard-calendar/worker/test/browser/compare-grid.spec.mjs` - Updated setupComparePage for new key
- `custard-calendar/worker/test/browser/compare-expand.spec.mjs` - Updated setupComparePage for new key
- `custard-calendar/worker/test/browser/vizp-card-system.spec.mjs` - Updated compare page setup for new key
- `custard-calendar/worker/test/browser/vizp-cone-tiers.spec.mjs` - Updated compare page setup for new key
- `custard-calendar/worker/test/browser/vizp-seasonal-rarity.spec.mjs` - Updated compare page setup for new key

## Decisions Made
- Used plain JSON array format in new key (simpler than nested activeRoute.stores structure)
- Clean start for existing users: no migration logic from old key (per CONTEXT.md decision)
- Preserved primary store fallback via CustardPlanner.getPrimaryStoreSlug() for first-time visitors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 3 additional test files not listed in plan**
- **Found during:** Task 2 (implementation)
- **Issue:** compare-grid.spec.mjs, compare-expand.spec.mjs, and 3 vizp-*.spec.mjs files also set up compare page localStorage using the old key format, which would cause them to break
- **Fix:** Updated all 5 additional test files to use `custard:compare:stores` with plain array format
- **Files modified:** compare-grid.spec.mjs, compare-expand.spec.mjs, vizp-card-system.spec.mjs, vizp-cone-tiers.spec.mjs, vizp-seasonal-rarity.spec.mjs
- **Verification:** All tests pass
- **Committed in:** c178745 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Additional test file updates were necessary to prevent breaking existing tests. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Compare page localStorage isolation complete
- Today page drive preferences remain untouched
- All compare-related tests updated and passing

## Self-Check: PASSED

- All created/modified files verified on disk
- Both task commits (62730bb, c178745) verified in git log

---
*Phase: 12-feature-development*
*Completed: 2026-03-09*
