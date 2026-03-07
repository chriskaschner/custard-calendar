---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [store-picker, address-search, flex-wrap, mobile-layout, service-worker]

# Dependency graph
requires:
  - phase: 01-foundation (01-01)
    provides: SharedNav store picker with city/state display
  - phase: 01-foundation (01-02)
    provides: SharedNav deployed across all pages, sw.js at custard-v9
provides:
  - Store picker with street address display and address-aware search
  - Flex-wrap nav links with mobile overflow containment at 375px
affects: [02-today, 03-compare, 04-fun-updates-nav]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-attribute search filtering, flex-wrap mobile containment]

key-files:
  created: []
  modified:
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/style.css
    - custard-calendar/docs/sw.js

key-decisions:
  - "Left inline margin-top:0.75rem on nav element as it does not conflict with flex layout"

patterns-established:
  - "Store picker items use data-* attributes for all searchable fields including address"
  - "Nav links use flex-wrap with gap for responsive spacing"

requirements-completed: [STOR-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 1 Plan 4: Store Picker Address + Mobile Nav Summary

**Store picker shows street addresses for disambiguation and nav links flex-wrap at 375px**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T18:24:48Z
- **Completed:** 2026-03-07T18:27:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Store picker items now display street address (e.g., "Madison, WI 7206 Mineral Point Road") to disambiguate same-city stores
- Search filtering in store picker matches against address field (typing "mineral point" finds the correct store)
- Nav links use flex-wrap layout preventing horizontal overflow at 375px viewport width
- CACHE_VERSION bumped to custard-v10 to bust stale cached assets

## Task Commits

Each task was committed atomically:

1. **Task 1: Add street address to store picker and fix nav overflow** - `90b6432` (feat)
2. **Task 2: Bump CACHE_VERSION for picker and nav fixes** - `2454e22` (chore)

## Files Created/Modified
- `custard-calendar/docs/shared-nav.js` - Added address to store picker label, data-address attribute, and address search in filterStoreList()
- `custard-calendar/docs/style.css` - Flex-wrap nav links, removed per-link margin, added .store-picker-address style
- `custard-calendar/docs/sw.js` - Bumped CACHE_VERSION from custard-v9 to custard-v10

## Decisions Made
- Left the inline `style="margin-top:0.75rem;"` on the nav element in buildNavLinksHTML() since it does not conflict with the new flex layout properties

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT test 3 (store picker disambiguation) resolved
- UAT test 7 (mobile nav overflow) resolved
- All 810 worker tests and 46 browser tests passing
- Ready for Phase 2/3 parallel execution

## Self-Check: PASSED

- FOUND: custard-calendar/docs/shared-nav.js
- FOUND: custard-calendar/docs/style.css
- FOUND: custard-calendar/docs/sw.js
- FOUND: 01-04-SUMMARY.md
- FOUND: commit 90b6432
- FOUND: commit 2454e22

---
*Phase: 01-foundation*
*Completed: 2026-03-07*
