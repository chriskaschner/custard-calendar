---
phase: 19-map-geolocation-fixes
plan: 02
subsystem: ui
tags: [leaflet, geolocation, haversine, css-animation, playwright, nearest-store]

requires:
  - phase: 19-map-geolocation-fixes/01
    provides: GPS auto-centering, userLat/userLon state, watchPosition, updatePositionDot
provides:
  - Nearest store detection via haversine distance from GPS position
  - Enlarged 1.25x marker with blue glow for nearest store
  - "Nearest to you" badge on nearest store result card
  - Results sorted by GPS distance when position available
  - Dynamic nearest-store updates via watchPosition callback
affects: []

tech-stack:
  added: []
  patterns: [nearest-store-detection, gps-distance-sorting, marker-css-class-toggle]

key-files:
  created:
    - custard-calendar/worker/test/browser/map-nearest-store.spec.mjs
  modified:
    - custard-calendar/docs/map.html
    - custard-calendar/docs/style.css

key-decisions:
  - "Service worker mock (no-op sw.js) required for Playwright tests that need mocked API responses after GPS callback timing"
  - "Nearest store identified by slug (nearestStoreSlug) for cross-reference between marker highlighting and results badge"
  - "Results sorted by _userDist (GPS distance) when available, falling back to _dist (map center distance)"

patterns-established:
  - "SW mock pattern: route **/sw.js to no-op in tests requiring late-firing API mocks"
  - "Nearest detection runs inside refreshResults after applyFamilyFilter, before results HTML rendering"

requirements-completed: [MAP-02]

duration: 12min
completed: 2026-03-13
---

# Phase 19 Plan 02: Nearest Store Highlight Summary

**Nearest store detection with enlarged marker glow ring, "Nearest to you" badge, and GPS-distance sorting via haversine**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-13T02:42:35Z
- **Completed:** 2026-03-13T02:54:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Nearest store to user's GPS position gets an enlarged (1.25x) marker with bright blue glow ring on the map
- "Nearest to you" badge appears on the nearest store's result card in the results list
- Results sorted by actual GPS distance (not map center distance) when GPS is active
- No nearest highlighting when GPS is not active (userLat/userLon are null)
- Dynamic updates: nearest store recalculated when watchPosition fires with new coordinates

## Task Commits

Each task was committed atomically:

1. **Task 1: Write browser tests for nearest store highlighting** - `cdd2fd7` (test) -- TDD RED phase, 3 Playwright tests
2. **Task 2: Implement nearest store detection, marker highlighting, and results badge** - `24d793f` (feat) -- TDD GREEN phase, all tests pass

**Submodule update:** `e8ca63c` (chore: update custard-calendar submodule)

## Files Created/Modified
- `custard-calendar/worker/test/browser/map-nearest-store.spec.mjs` - 3 Playwright browser tests: nearest marker class, results badge + sort order, GPS-denied no-highlight
- `custard-calendar/docs/map.html` - detectAndHighlightNearest() function, nearestStoreSlug tracking, _userDist GPS distance calculation, storeCard badge injection, watchPosition re-detection
- `custard-calendar/docs/style.css` - .flavor-map-marker-nearest CSS with 1.25x scale and blue glow, .nearest-badge pill styling

## Decisions Made
- Used `nearestStoreSlug` (store slug) as the link between marker highlighting and results badge, avoiding passing marker references into storeCard
- Service worker mock pattern discovered: Playwright page.route cannot intercept fetch calls made by an active service worker; solved by routing sw.js to a no-op script
- Results sorted by `_userDist ?? _dist` using nullish coalescing, so GPS distance takes priority but map center distance works as fallback when GPS is unavailable

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Service worker intercepting mocked API routes in Playwright tests**
- **Found during:** Task 1 / Task 2 (running browser tests)
- **Issue:** The service worker (sw.js) registers on page load and intercepts all API fetches via `event.respondWith(fetch(event.request))`. When the SW's own fetch() runs, it bypasses Playwright's page-level route handlers, causing mocked nearby-flavors responses to fail with net::ERR_FAILED
- **Fix:** Added `page.route("**/sw.js", ...)` mock that returns a no-op JavaScript file, preventing the SW from registering. Also added mocks for flavor-config, flavor-colors, and events endpoints to avoid CORS failures
- **Files modified:** custard-calendar/worker/test/browser/map-nearest-store.spec.mjs
- **Verification:** All 3 nearest-store tests pass; API mocks are correctly intercepted
- **Committed in:** 24d793f (Task 2 commit)

**2. [Rule 1 - Bug] Changed nearby-flavors route pattern from regex to glob**
- **Found during:** Task 2 (debugging test failures)
- **Issue:** The regex route pattern `/https:\/\/custard\.chriskaschner\.com\/api\/v1\/nearby-flavors\?.*/` was not matching the actual request URL in the SW-intercepted context
- **Fix:** Changed to glob pattern `"**/api/v1/nearby-flavors*"` which matches regardless of origin
- **Files modified:** custard-calendar/worker/test/browser/map-nearest-store.spec.mjs
- **Verification:** Route correctly intercepts all nearby-flavors requests
- **Committed in:** 24d793f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for test infrastructure to work correctly. No scope creep -- actual feature implementation followed plan exactly.

## Issues Encountered
- Service worker timing issue caused extensive debugging. The SW's `self.skipWaiting()` + `self.clients.claim()` pattern meant it activated mid-page-load, intercepting API calls that fired after GPS resolution. Solved by mocking sw.js as a no-op.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 19 (Map Geolocation Fixes) is fully complete
- All map browser tests pass: GPS centering, position dot, nearest store highlighting, exclusion filters, pan stability
- v1.4 Bug Fixes milestone ready for completion

## Self-Check: PASSED

- FOUND: custard-calendar/worker/test/browser/map-nearest-store.spec.mjs
- FOUND: .planning/phases/19-map-geolocation-fixes/19-02-SUMMARY.md
- FOUND: cdd2fd7 (Task 1 commit in submodule)
- FOUND: 24d793f (Task 2 commit in submodule)
- FOUND: e8ca63c (submodule update in parent)
- All 3 nearest-store tests pass
- All 9 existing map tests pass (no regressions)

---
*Phase: 19-map-geolocation-fixes*
*Completed: 2026-03-13*
