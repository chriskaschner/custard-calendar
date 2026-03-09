---
phase: 09-infrastructure-deployment
plan: 02
subsystem: infra
tags: [service-worker, offline, cache, stores-json, pwa]

# Dependency graph
requires:
  - phase: 09-infrastructure-deployment
    provides: CI pipeline green, smoke test script, all code deployed
provides:
  - "SW registration on all 8 user-facing pages (full offline coverage)"
  - "stores.json in STATIC_ASSETS for offline store data access"
  - "No cache-bust params on stores.json fetches (Cache API exact-match compatible)"
  - "CACHE_VERSION bumped to custard-v16"
affects: [10-redirects-css-cleanup, 11-monolith-refactoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [SW registration inline snippet for all user-facing pages]

key-files:
  created:
    - custard-calendar/tests/test_sw_registration.py
    - custard-calendar/tests/test_sw_precache.py
  modified:
    - custard-calendar/docs/sw.js
    - custard-calendar/docs/shared-nav.js
    - custard-calendar/docs/today-page.js
    - custard-calendar/docs/compare-page.js
    - custard-calendar/docs/map.html
    - custard-calendar/docs/widget.html
    - custard-calendar/docs/calendar.html
    - custard-calendar/docs/scoop.html
    - custard-calendar/docs/radar.html
    - custard-calendar/docs/alerts.html
    - custard-calendar/docs/fun.html
    - custard-calendar/docs/updates.html
    - custard-calendar/docs/quiz.html

key-decisions:
  - "Removed cache-bust params from all 9 files in one sweep (prerequisite for SW exact-match caching)"
  - "Inline SW registration snippet matches existing widget.html/calendar.html pattern"

patterns-established:
  - "All user-facing pages must have SW registration (tested by test_sw_registration.py)"
  - "No cache-bust query params on locally-served JSON assets (tested by test_sw_precache.py)"

requirements-completed: [INFR-03, INFR-04]

# Metrics
duration: 11min
completed: 2026-03-09
---

# Phase 9 Plan 2: SW Coverage and Offline Store Data Summary

**Removed stores.json cache-bust params from 9 files, added SW registration to 4 remaining pages, and pre-cached stores.json with CACHE_VERSION bump to custard-v16 for full offline coverage**

## Performance

- **Duration:** 11m 8s
- **Started:** 2026-03-09T15:12:31Z
- **Completed:** 2026-03-09T15:23:39Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 15

## Accomplishments
- Full SW registration across all 8 user-facing pages (fun.html, updates.html, quiz.html, map.html added inline)
- stores.json available offline via STATIC_ASSETS pre-cache (INFR-04)
- All 9 stores.json?v= cache-bust params removed (Cache API exact-match prerequisite)
- CACHE_VERSION bumped from custard-v15 to custard-v16
- 8 new static analysis tests verifying SW coverage and pre-cache correctness
- All 6 pages pass deployment smoke test

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests for SW registration and stores.json pre-cache** - `80f96c5` (test -- TDD RED)
2. **Task 2: Remove cache-bust params, add SW registration, update SW pre-cache** - `105b523` (feat -- TDD GREEN)

## Files Created/Modified
- `custard-calendar/tests/test_sw_registration.py` - Verifies all 8 pages have SW registration
- `custard-calendar/tests/test_sw_precache.py` - Verifies stores.json in STATIC_ASSETS, no cache-bust params, version bump
- `custard-calendar/docs/sw.js` - CACHE_VERSION v16, stores.json in STATIC_ASSETS
- `custard-calendar/docs/shared-nav.js` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/today-page.js` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/compare-page.js` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/map.html` - Removed cache-bust, added inline SW registration
- `custard-calendar/docs/widget.html` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/calendar.html` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/scoop.html` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/radar.html` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/alerts.html` - Removed stores.json?v= cache-bust
- `custard-calendar/docs/fun.html` - Added inline SW registration
- `custard-calendar/docs/updates.html` - Added inline SW registration
- `custard-calendar/docs/quiz.html` - Added inline SW registration

## Decisions Made
- Removed cache-bust params from all 9 files in one sweep rather than per-page -- consistent approach and prerequisite for SW exact-match caching
- Used inline SW registration snippet matching existing widget.html/calendar.html pattern (no centralization needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all changes applied cleanly and tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 9 fully complete: CI green, deployed, full SW coverage, offline store data
- Ready for Phase 10: old page redirects (scoop, radar, calendar, widget, siri, alerts) and Mad Libs CSS cleanup
- Note: scoop.html, radar.html, alerts.html still have full page content but will become redirect stubs in Phase 10

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 09-infrastructure-deployment*
*Completed: 2026-03-09*
