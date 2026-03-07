---
phase: 02-today-page
plan: 01
subsystem: ui
tags: [vanilla-js, iife, playwright, html, progressive-disclosure]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: shared-nav.js store indicator, sharednav:storechange event, planner-shared.js utilities
provides:
  - today-page.js IIFE module (window.CustardToday) with hero card, rarity, signals, multi-store row
  - Simplified index.html (~158 lines, no inline JS block)
  - Playwright test scaffolds for TDAY-01 through TDAY-07
affects: [02-today-page, 03-compare-page, 04-supporting-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [CustardToday IIFE revealing module, native details/summary for progressive disclosure, raw localStorage check for multi-store prefs]

key-files:
  created:
    - custard-calendar/docs/today-page.js
    - custard-calendar/worker/test/browser/today-hero.spec.mjs
    - custard-calendar/worker/test/browser/today-multistore.spec.mjs
    - custard-calendar/worker/test/browser/today-week-ahead.spec.mjs
  modified:
    - custard-calendar/docs/index.html
    - custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs
    - custard-calendar/worker/test/browser/index-drive-defaults.spec.mjs
    - custard-calendar/worker/test/browser/index-drive-error-recovery.spec.mjs

key-decisions:
  - "Read raw localStorage for multi-store row instead of getDrivePreferences() defaults (defaults include manifest stores even without explicit user prefs)"
  - "Restored global var WORKER_BASE for cone-renderer.js compatibility (loadFlavorColors needs it as a global)"
  - "Skipped 5 existing browser tests for removed features (calendar preview, Drive on index) instead of deleting them"

patterns-established:
  - "CustardToday IIFE: init() auto-runs on DOMContentLoaded, exposes selectStore() and init() publicly"
  - "Native details/summary for collapsible sections (no JS accordion)"
  - "Multi-store row only renders when user has explicitly saved 2+ stores in custard:v1:preferences"

requirements-completed: [TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07]

# Metrics
duration: 15min
completed: 2026-03-07
---

# Phase 2 Plan 01: Today Page Core Restructuring Summary

**Extracted ~875 lines of inline JS to today-page.js IIFE, simplified index.html from 1093 to 158 lines, added hero card with HD cone + rarity badge, multi-store row, collapsed week-ahead details, signal nudge, and "Want this every day?" CTA**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-07T19:52:04Z
- **Completed:** 2026-03-07T20:07:05Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created today-page.js as window.CustardToday IIFE (648 lines, var throughout, no CustardDrive references)
- Simplified index.html to a clean HTML shell with no inline script block
- Removed 5 sections: Drive, calendar preview, predictions, badge, meta
- Added 4 new sections: multi-store row, details week-ahead, signal nudge, "Want this every day?" CTA
- Created 3 Playwright test files covering all 7 TDAY requirements (9 tests total, all passing)
- Full browser test suite: 50 passing, 5 skipped (removed features), 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Playwright test scaffolds** - `e90dfec` (test)
2. **Task 2: Extract inline JS and simplify HTML** - `d161791` (feat)

## Files Created/Modified
- `custard-calendar/docs/today-page.js` - CustardToday IIFE with all page logic (hero, rarity, week strip, multi-store, signals, CTA)
- `custard-calendar/docs/index.html` - Simplified HTML shell (158 lines, no inline JS)
- `custard-calendar/worker/test/browser/today-hero.spec.mjs` - Tests for TDAY-01, TDAY-02, TDAY-05, TDAY-06, TDAY-07
- `custard-calendar/worker/test/browser/today-multistore.spec.mjs` - Tests for TDAY-04 (2+ stores, 1 store)
- `custard-calendar/worker/test/browser/today-week-ahead.spec.mjs` - Tests for TDAY-03 (collapsed details, expand)
- `custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs` - Skipped (removed feature)
- `custard-calendar/worker/test/browser/index-drive-defaults.spec.mjs` - 2 tests skipped (removed feature)
- `custard-calendar/worker/test/browser/index-drive-error-recovery.spec.mjs` - 2 tests skipped (removed feature)

## Decisions Made
- **Raw localStorage read for multi-store row:** getDrivePreferences() returns defaults from the store manifest even when the user has no saved prefs, which would incorrectly show a multi-store row for single-store users. Reading custard:v1:preferences directly ensures the row only appears when the user has explicitly saved 2+ stores.
- **Global WORKER_BASE preserved:** cone-renderer.js loadFlavorColors() uses WORKER_BASE as a global variable. The plan said to remove the global declaration, but removing it broke cone rendering. Kept the one-liner script tag.
- **Skipped vs deleted obsolete tests:** 5 browser tests for removed features (calendar preview, Drive on index.html) were marked .skip instead of deleted, in case they serve as patterns for scoop.html tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored global WORKER_BASE variable**
- **Found during:** Task 2 (Extract inline JS to today-page.js)
- **Issue:** The plan said to remove `<script>var WORKER_BASE = CustardPlanner.WORKER_BASE;</script>` but cone-renderer.js loadFlavorColors() requires WORKER_BASE as a global variable
- **Fix:** Kept the one-liner inline script tag that sets global WORKER_BASE
- **Files modified:** custard-calendar/docs/index.html
- **Verification:** All 9 tests pass after fix
- **Committed in:** d161791 (Task 2 commit)

**2. [Rule 1 - Bug] Multi-store row showing for single-store users**
- **Found during:** Task 2 (Extract inline JS to today-page.js)
- **Issue:** getDrivePreferences({ stores: allStores }) returns defaults from the manifest (3+ stores) even when user has only 1 saved store, causing multi-store row to render incorrectly
- **Fix:** Changed renderMultiStoreRow to read raw localStorage custard:v1:preferences instead of getDrivePreferences() defaults
- **Files modified:** custard-calendar/docs/today-page.js
- **Verification:** "multi-store row hidden when only 1 store" test passes
- **Committed in:** d161791 (Task 2 commit)

**3. [Rule 3 - Blocking] Skipped obsolete browser tests for removed features**
- **Found during:** Task 2 (verification step)
- **Issue:** 5 existing browser tests assert presence of calendar-preview-section, .drive-card on index.html -- features removed by this plan
- **Fix:** Added test.skip with comment explaining Phase 2 TDAY-07 removed the features
- **Files modified:** index-calendar-preview.spec.mjs, index-drive-defaults.spec.mjs, index-drive-error-recovery.spec.mjs
- **Verification:** Full browser suite: 50 pass, 5 skip, 0 fail
- **Committed in:** d161791 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- today-page.js and simplified index.html are ready for CSS polish (Plan 02-02)
- Multi-store row, CTA card, and hero card layout need CSS refinement
- Service worker update needed (Plan 02-03): add today-page.js to STATIC_ASSETS, bump CACHE_VERSION
- sw.js STATIC_ASSETS still references todays-drive.js (remove in Plan 02-03 since it's no longer loaded on index.html)

---
*Phase: 02-today-page*
*Completed: 2026-03-07*

## Self-Check: PASSED

All 6 claimed files exist. Both task commits (e90dfec, d161791) verified in git history.
