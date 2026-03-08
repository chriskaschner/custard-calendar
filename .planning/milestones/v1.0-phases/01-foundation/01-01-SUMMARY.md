---
phase: 01-foundation
plan: 01
subsystem: ui
tags: [vanilla-js, iife, geolocation, localStorage, playwright, css]

# Dependency graph
requires:
  - phase: none
    provides: "First plan in Phase 1"
provides:
  - "SharedNav IIFE module (window.SharedNav) with renderNav, showStorePicker, updateStoreIndicator"
  - "Store indicator component (.store-indicator) reading CustardPlanner.getPrimaryStoreSlug()"
  - "First-visit IP geolocation flow via Worker /api/v1/geolocate proxy"
  - "Store picker overlay with type-ahead search"
  - "CSS rules for #shared-nav, .store-indicator, .store-picker, .first-visit-prompt"
  - "Playwright test coverage for STOR-01 through STOR-05"
affects: [01-02-PLAN, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns: ["IIFE with DOMContentLoaded auto-init", "context-level Playwright route mocking for cross-origin intercepts", "sessionStorage manifest caching", "Worker API proxy for IP geolocation"]

key-files:
  created:
    - "custard-calendar/docs/shared-nav.js"
    - "custard-calendar/worker/test/browser/shared-nav-store.spec.mjs"
  modified:
    - "custard-calendar/docs/style.css"

key-decisions:
  - "Used Worker /api/v1/geolocate proxy instead of direct ip-api.com fetch to avoid HTTP mixed-content and cross-origin issues in browsers"
  - "Used stores.json (local file) as primary store manifest source instead of Worker API /api/v1/stores, matching existing codebase pattern"
  - "Used Playwright context.route() instead of page.route() for cross-origin API mock interception"

patterns-established:
  - "SharedNav IIFE pattern: auto-init on DOMContentLoaded, inject into #shared-nav placeholder"
  - "Store manifest caching in sessionStorage under custard:store-manifest key"
  - "Browser test setup: inject #shared-nav div, load shared-nav.js via addScriptTag, call renderNav manually"

requirements-completed: [STOR-01, STOR-02, STOR-03, STOR-04, STOR-05]

# Metrics
duration: 16min
completed: 2026-03-07
---

# Phase 1 Plan 01: Shared Nav Module Summary

**ES5-compatible SharedNav IIFE with store indicator, IP geolocation first-visit flow, store picker overlay, and 5 Playwright tests covering all STOR requirements**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-07T16:14:25Z
- **Completed:** 2026-03-07T16:30:26Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created shared-nav.js (520 lines) as an ES5-compatible IIFE that renders nav bar with 11 links and active page highlighting
- Store indicator displays store name/city from manifest, with change button triggering overlay picker
- First-visit flow uses Worker API geolocation proxy, shows confirmation prompt before saving store
- Store picker with type-ahead search filtering, precise location button, and backdrop-click-to-close
- All 5 STOR requirements covered by Playwright tests (STOR-01 through STOR-05)
- CSS supports 375px viewport with ellipsis overflow, 44px touch targets, iOS zoom prevention

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Playwright test scaffolds** - `ea017ec` (test)
2. **Task 2: Create shared-nav.js IIFE module** - `381b324` (feat)
3. **Task 3: Add CSS styles** - `f7be16f` (feat)

## Files Created/Modified
- `custard-calendar/docs/shared-nav.js` - SharedNav IIFE: nav rendering, store indicator, geolocation, store picker
- `custard-calendar/worker/test/browser/shared-nav-store.spec.mjs` - 5 Playwright tests covering STOR-01 through STOR-05
- `custard-calendar/docs/style.css` - CSS rules for #shared-nav, .store-indicator, .store-picker, .first-visit-prompt

## Decisions Made
- **Worker proxy for geolocation:** Used CustardPlanner.WORKER_BASE + '/api/v1/geolocate' instead of direct http://ip-api.com/json calls. The ip-api.com free tier only supports HTTP (not HTTPS), which causes fetch failures from HTTPS pages and is not interceptable by Playwright page.route. The Worker already has a /api/v1/geolocate endpoint (used by index.html line 588).
- **Local stores.json for manifest:** Used 'stores.json?v=YYYY-MM-DD' as the primary store manifest source, matching the pattern used by all existing pages (index.html, calendar.html, radar.html, etc.). Falls back to Worker API if local file unavailable.
- **Context-level route mocking:** Discovered that Playwright's page.route() does not intercept cross-origin fetch requests (e.g., to custard.chriskaschner.com). Switched to page.context().route() which intercepts all requests regardless of origin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed geolocation URL from ip-api.com to Worker proxy**
- **Found during:** Task 2 (shared-nav.js implementation)
- **Issue:** Direct fetch to http://ip-api.com/json fails in browsers due to HTTP mixed-content blocking and cannot be intercepted by Playwright page.route for testing
- **Fix:** Changed to use CustardPlanner.WORKER_BASE + '/api/v1/geolocate' which is the same pattern already used by index.html (line 588)
- **Files modified:** custard-calendar/docs/shared-nav.js
- **Verification:** All 5 Playwright tests pass with mocked /api/v1/geolocate endpoint
- **Committed in:** 381b324 (Task 2 commit)

**2. [Rule 3 - Blocking] Switched test route mocking from page.route to context.route**
- **Found during:** Task 2 (test debugging)
- **Issue:** Playwright page.route() does not intercept cross-origin HTTP requests, causing store manifest and geolocation mocks to fail silently
- **Fix:** Changed all route interceptors to use page.context().route() which intercepts requests at the browser context level
- **Files modified:** custard-calendar/worker/test/browser/shared-nav-store.spec.mjs
- **Verification:** All 5 tests pass with context-level routing
- **Committed in:** 381b324 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking fix)
**Impact on plan:** Both fixes necessary for correct browser behavior and testability. No scope creep.

## Issues Encountered
- ip-api.com HTTP-only free tier confirmed as a problem (flagged as Open Question 3 in RESEARCH.md). Resolved by using existing Worker proxy endpoint.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- shared-nav.js is ready to be deployed across all HTML pages (Plan 02)
- HTML pages need `<div id="shared-nav"></div>` placeholder and `<script src="shared-nav.js"></script>` tag
- sw.js STATIC_ASSETS array needs shared-nav.js added and CACHE_VERSION bumped (Plan 02)

## Self-Check: PASSED

- FOUND: custard-calendar/docs/shared-nav.js (520 lines)
- FOUND: custard-calendar/worker/test/browser/shared-nav-store.spec.mjs (261 lines)
- FOUND: .planning/phases/01-foundation/01-01-SUMMARY.md
- FOUND: ea017ec (Task 1 commit)
- FOUND: 381b324 (Task 2 commit)
- FOUND: f7be16f (Task 3 commit)
- 46/46 browser tests passing

---
*Phase: 01-foundation*
*Completed: 2026-03-07*
