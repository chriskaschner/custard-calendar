---
phase: 03-compare-page
plan: 01
subsystem: ui
tags: [compare, grid, card-stack, playwright, iife, vanilla-js, mobile-first]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: shared-nav.js, planner-shared.js, cone-renderer.js, service worker
provides:
  - compare.html page with day-first card stack grid
  - compare-page.js CustardCompare IIFE module
  - Playwright test scaffolds for all 8 COMP requirements
  - compare-specific CSS rules in style.css
affects: [03-compare-page, 04-supporting-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [day-first card stack layout, per-store parallel fetch, raw localStorage preference reading]

key-files:
  created:
    - custard-calendar/docs/compare.html
    - custard-calendar/docs/compare-page.js
    - custard-calendar/worker/test/browser/compare-grid.spec.mjs
    - custard-calendar/worker/test/browser/compare-expand.spec.mjs
    - custard-calendar/worker/test/browser/compare-filter.spec.mjs
  modified:
    - custard-calendar/docs/style.css

key-decisions:
  - "Used /api/v1/flavors + /api/v1/today per store for 3-day data (not /api/v1/drive which only covers today+tomorrow)"
  - "Test date computation uses setHours(12,0,0,0) + toISOString to match page logic across timezones"

patterns-established:
  - "Compare IIFE module: CustardCompare follows same revealing module pattern as CustardToday"
  - "Day-first card stack: each date is a card, stores are rows within the card"
  - "Per-store parallel fetch: Promise.all over slugs array for /api/v1/flavors and /api/v1/today"

requirements-completed: [COMP-01, COMP-02, COMP-04, COMP-07, COMP-08]

# Metrics
duration: 19min
completed: 2026-03-08
---

# Phase 3 Plan 01: Compare Page Foundation Summary

**Day-first card stack grid with per-store flavor/rarity fetching, cone SVGs, rarity badges, and 7 passing Playwright tests covering COMP-01/02/04/07/08**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-08T03:31:42Z
- **Completed:** 2026-03-08T03:51:00Z
- **Tasks:** 2 (TDD: red tests, then green implementation)
- **Files modified:** 6

## Accomplishments
- Created compare.html with SharedNav, loading/error/empty states, and grid container
- Built compare-page.js IIFE module that fetches 3-day flavor schedules and rarity data per store
- Renders day-first card stack with cone SVGs, flavor names, rarity badges, and store labels
- Rarity nudge banner highlights rare/ultra-rare flavors at saved stores
- Single-store users see empty state prompt instead of grid
- 7 compare-grid tests pass; 3 expand + 4 filter tests exist as RED stubs for Plan 02
- No regressions in existing 57 browser tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Playwright test scaffolds** - `5e0da26` (test) - RED phase: 3 test files
   - Date fix commit: `b17b85e` (fix) - timezone-safe date computation
2. **Task 2: Create compare.html, compare-page.js, CSS** - `fd383c0` (feat) - GREEN phase: implementation

## Files Created/Modified
- `custard-calendar/docs/compare.html` - Compare page HTML shell with shared nav, states, grid container
- `custard-calendar/docs/compare-page.js` - CustardCompare IIFE: data fetching, 3-day schedule, grid rendering, rarity nudge
- `custard-calendar/docs/style.css` - Compare-specific CSS: day cards, store rows, cones, nudge banner, filter chips, skeleton
- `custard-calendar/worker/test/browser/compare-grid.spec.mjs` - 7 tests: COMP-01/02/04/07/08 + single-store
- `custard-calendar/worker/test/browser/compare-expand.spec.mjs` - 3 tests: COMP-03 accordion (RED until Plan 02)
- `custard-calendar/worker/test/browser/compare-filter.spec.mjs` - 4 tests: COMP-05/06 exclusion filters (RED until Plan 02)

## Decisions Made
- Used /api/v1/flavors + /api/v1/today per store (not /api/v1/drive) because drive only returns today and optionally tomorrow, no day+2
- Test mock dates use setHours(12,0,0,0) + toISOString() to match the page's UTC date computation, avoiding timezone mismatches between Node.js test runner and browser
- Added flavor-config mock route in tests because planner-shared.js fetches it on load
- Expanded COMP-08 allowed endpoint list to include shared module endpoints (flavor-config, stores, events)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone-sensitive date mismatch in test mocks**
- **Found during:** Task 1/2 (GREEN phase verification)
- **Issue:** Mock data used `new Date().toISOString().slice(0,10)` which gives UTC date, but page computes dates with `setHours(12,0,0,0)` (local noon) then converts to ISO. These disagreed at night in US timezones.
- **Fix:** Changed mock date computation to use same setHours(12,0,0,0) pattern as page code
- **Files modified:** compare-grid.spec.mjs, compare-expand.spec.mjs, compare-filter.spec.mjs
- **Verification:** All 7 compare-grid tests pass consistently
- **Committed in:** b17b85e

**2. [Rule 3 - Blocking] Added missing flavor-config mock route**
- **Found during:** Task 2 (COMP-08 test failure)
- **Issue:** planner-shared.js fetches /api/v1/flavor-config on load, which wasn't mocked or in the allowed endpoints list
- **Fix:** Added mock route and expanded COMP-08 allowed patterns list
- **Files modified:** compare-grid.spec.mjs, compare-expand.spec.mjs, compare-filter.spec.mjs
- **Verification:** COMP-08 test passes
- **Committed in:** b17b85e

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- compare.html and compare-page.js are ready for Plan 02 to add accordion expand and exclusion filter chips
- 3 expand tests and 4 filter tests are written and waiting to go GREEN
- Service worker update (add compare assets, bump cache version) is planned for Plan 03

---
*Phase: 03-compare-page*
*Completed: 2026-03-08*
