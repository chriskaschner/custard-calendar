---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [vanilla-js, html, service-worker, playwright, shared-nav, store-indicator]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "SharedNav IIFE module (window.SharedNav) from Plan 01"
provides:
  - "SharedNav deployed across all 12 HTML pages (no inline nav HTML remains)"
  - "Store indicator visible on every page when store is saved"
  - "Cross-page store persistence verified"
  - "Service worker caches shared-nav.js with proper CACHE_VERSION"
  - "Legacy store UI hidden on index.html, replaced by SharedNav picker"
  - "Custom event bridge (sharednav:storechange) for page-specific forecast loading"
affects: [phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CustomEvent dispatch for cross-component communication", "hidden attribute to decommission legacy UI without deletion"]

key-files:
  created: []
  modified:
    - "custard-calendar/docs/index.html"
    - "custard-calendar/docs/calendar.html"
    - "custard-calendar/docs/map.html"
    - "custard-calendar/docs/radar.html"
    - "custard-calendar/docs/alerts.html"
    - "custard-calendar/docs/siri.html"
    - "custard-calendar/docs/forecast-map.html"
    - "custard-calendar/docs/quiz.html"
    - "custard-calendar/docs/widget.html"
    - "custard-calendar/docs/scoop.html"
    - "custard-calendar/docs/group.html"
    - "custard-calendar/docs/privacy.html"
    - "custard-calendar/docs/shared-nav.js"
    - "custard-calendar/docs/sw.js"
    - "custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs"
    - "custard-calendar/worker/test/browser/index-keyboard-nav.spec.mjs"

key-decisions:
  - "Replaced showStorePicker() fallback with non-intrusive showFallbackPrompt() to prevent full-screen picker overlay on first visit when IP geolocation fails"
  - "Used hidden attribute to decommission legacy location-bar on index.html rather than deleting it, preserving the code for reference"
  - "Added sharednav:storechange CustomEvent to bridge SharedNav store selection to index.html forecast loading"
  - "Removed auto geolocateAndSort() call on first visit which triggered browser geolocation permission prompt, violating locked decision"

patterns-established:
  - "sharednav:storechange event: pages listen for CustomEvent to react to store changes from SharedNav"
  - "Legacy UI hidden with hidden attribute: keeps DOM references intact for any code that getElementById them, preventing null errors"

requirements-completed: [STOR-01, STOR-02, STOR-03, STOR-04, STOR-05]

# Metrics
duration: 7min
completed: 2026-03-07
---

# Phase 1 Plan 02: Shared Nav Deployment Summary

**SharedNav deployed across all 12 pages with silent IP geolocation on first visit, legacy store UI hidden on index.html, and custom event bridge for forecast loading**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T17:11:23Z
- **Completed:** 2026-03-07T17:18:30Z
- **Tasks:** 3 (2 from previous session + 1 continuation with fixes)
- **Files modified:** 16

## Accomplishments
- All 12 HTML pages now render nav via shared-nav.js with zero inline nav blocks remaining
- First visit silently IP geolocates and shows compact prompt ("Showing flavors for [Store] -- change?") or fallback prompt, never shows full-screen picker overlay
- Legacy store UI (location-bar, store-search, dropdown) hidden on index.html; SharedNav handles all store selection
- Custom event bridge (sharednav:storechange) ensures index.html loads forecast data when user selects store via SharedNav picker
- Service worker CACHE_VERSION bumped to v9 for all changes
- All 46 Playwright browser tests pass, all 810 Worker unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace inline nav HTML in all 12 pages** - `4132418` (feat)
2. **Task 2: Update sw.js cache and run full test suite** - `7461b56` (feat)
3. **Task 3 fixes (post-checkpoint):**
   - `b55883c` (fix) - Silent first-visit flow and store change event in shared-nav.js
   - `7ead475` (fix) - Hide legacy store UI and bridge SharedNav events on index.html
   - `b32f41c` (test) - Update index tests to use SharedNav picker instead of legacy search
   - `2ae22d0` (chore) - Bump CACHE_VERSION to v9

## Files Created/Modified
- `custard-calendar/docs/shared-nav.js` - Added showFallbackPrompt(), sharednav:storechange CustomEvent dispatch
- `custard-calendar/docs/index.html` - Hidden legacy location-bar, added SharedNav event listener, removed auto-geolocate
- `custard-calendar/docs/sw.js` - CACHE_VERSION bumped to v9
- `custard-calendar/docs/*.html` (12 files) - Inline nav replaced with #shared-nav div + script tags
- `custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs` - Updated to use SharedNav picker
- `custard-calendar/worker/test/browser/index-keyboard-nav.spec.mjs` - Rewritten as SharedNav picker search filter test

## Decisions Made
- **Silent first-visit fallback:** When IP geolocation fails, show a non-intrusive "Select a store to see today's flavor" prompt with a "Find your store" button, instead of the full-screen dimmed store picker overlay. The picker only opens on explicit user action.
- **Legacy UI preserved but hidden:** Used `hidden` attribute instead of deleting the location-bar HTML. This preserves all DOM element references (getElementById calls in inline JS) to avoid null pointer errors, while removing the duplicate UI visually.
- **Custom event for cross-component communication:** SharedNav dispatches `sharednav:storechange` CustomEvent on document when store changes, allowing index.html (and other pages) to react without tight coupling.
- **Removed browser geolocation on load:** The legacy `geolocateAndSort()` function called `navigator.geolocation.getCurrentPosition()` on first visit, which triggers a browser permission prompt. This violated the locked decision: "No browser geolocation permission prompt on load." SharedNav's IP-based geolocation handles this correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] First-visit shows full-screen picker overlay instead of silent geolocation**
- **Found during:** Task 3 (visual verification checkpoint)
- **Issue:** When IP geolocation failed (e.g., on localhost), shared-nav.js fell back to showStorePicker() which rendered a full-screen dimmed overlay. This violated the locked decision for passive first-visit behavior.
- **Fix:** Created showFallbackPrompt() that shows a non-intrusive text prompt instead of the full picker overlay. The picker only opens when user explicitly taps "Find your store" or "change."
- **Files modified:** custard-calendar/docs/shared-nav.js
- **Verification:** All 5 STOR Playwright tests still pass
- **Committed in:** b55883c

**2. [Rule 1 - Bug] Duplicate store UI on index.html**
- **Found during:** Task 3 (visual verification checkpoint)
- **Issue:** After selecting a store, both the new SharedNav store indicator (blue bar) and the legacy location-bar store UI (search input, current-store badge) were visible, creating confusion.
- **Fix:** Added `hidden` attribute to the legacy location-bar div. Updated findStoreBtn to call SharedNav.showStorePicker() instead of scrolling to the hidden legacy search.
- **Files modified:** custard-calendar/docs/index.html
- **Verification:** Legacy UI no longer visible; SharedNav picker opens correctly
- **Committed in:** 7ead475

**3. [Rule 1 - Bug] Flavor data error after store selection via SharedNav**
- **Found during:** Task 3 (visual verification checkpoint)
- **Issue:** When a store was selected via SharedNav's picker, index.html's loadForecast() was never called because its currentSlug variable was never updated -- the two systems were disconnected.
- **Fix:** Added sharednav:storechange CustomEvent dispatch in shared-nav.js and a listener in index.html that calls selectStore(slug), which updates currentSlug and loads the forecast.
- **Files modified:** custard-calendar/docs/shared-nav.js, custard-calendar/docs/index.html
- **Verification:** Forecast loads after store selection via SharedNav picker
- **Committed in:** b55883c, 7ead475

**4. [Rule 1 - Bug] Browser geolocation permission prompt on page load**
- **Found during:** Task 3 (visual verification checkpoint)
- **Issue:** index.html's init() called geolocateAndSort() which invokes navigator.geolocation.getCurrentPosition(), triggering a browser permission prompt. This violated the locked decision: "No browser geolocation permission prompt on load."
- **Fix:** Removed the geolocateAndSort() call from the first-visit branch of init(). SharedNav handles first-visit geolocation via IP silently.
- **Files modified:** custard-calendar/docs/index.html
- **Verification:** No browser geolocation prompt on first visit
- **Committed in:** 7ead475

**5. [Rule 3 - Blocking] Two Playwright tests failed after hiding legacy store UI**
- **Found during:** Task 3 (test verification)
- **Issue:** index-calendar-preview.spec.mjs and index-keyboard-nav.spec.mjs tested the legacy #store-search input which is now hidden, causing locator visibility failures.
- **Fix:** Updated both tests to use SharedNav's store picker (search via .store-picker-search, select via .store-picker-item) instead of the legacy dropdown.
- **Files modified:** custard-calendar/worker/test/browser/index-calendar-preview.spec.mjs, custard-calendar/worker/test/browser/index-keyboard-nav.spec.mjs
- **Verification:** Both tests pass; all 46 browser tests green
- **Committed in:** b32f41c

---

**Total deviations:** 5 auto-fixed (4 bug fixes, 1 blocking fix)
**Impact on plan:** All fixes necessary for correct first-visit behavior, no duplicate UI, and working forecast loading. The plan's checkpoint correctly caught these integration issues.

## Issues Encountered
- The checkpoint mechanism worked as designed: visual verification revealed three integration issues (overlay, duplicate UI, disconnected forecast) that automated tests could not catch because they test components in isolation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 Foundation is complete: SharedNav deployed across all pages with store indicator, geolocation, and picker
- All STOR requirements (01-05) verified by both automated tests and visual inspection
- Ready for Phase 2 (Today page) and Phase 3 (Compare page) which can execute in parallel

## Self-Check: PASSED

- FOUND: custard-calendar/docs/shared-nav.js (563 lines)
- FOUND: custard-calendar/docs/index.html (hidden location-bar, sharednav:storechange listener)
- FOUND: custard-calendar/docs/sw.js (CACHE_VERSION = custard-v9)
- FOUND: 4132418 (Task 1 commit)
- FOUND: 7461b56 (Task 2 commit)
- FOUND: b55883c (Task 3 fix - shared-nav.js)
- FOUND: 7ead475 (Task 3 fix - index.html)
- FOUND: b32f41c (Task 3 fix - test updates)
- FOUND: 2ae22d0 (Task 3 fix - sw.js bump)
- 46/46 browser tests passing
- 810/810 Worker unit tests passing

---
*Phase: 01-foundation*
*Completed: 2026-03-07*
