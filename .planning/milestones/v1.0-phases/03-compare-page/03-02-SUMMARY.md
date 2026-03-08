---
phase: 03-compare-page
plan: 02
subsystem: ui
tags: [compare, accordion, exclusion-filter, localstorage, vanilla-js, accessibility]

# Dependency graph
requires:
  - phase: 03-compare-page
    plan: 01
    provides: compare.html, compare-page.js IIFE, day-first card stack grid, Playwright test scaffolds
provides:
  - Accordion expand for store row detail (description, rarity, directions link)
  - Exclusion filter chips with dimming and localStorage persistence
  - 14 passing compare Playwright tests (7 grid + 3 expand + 4 filter)
affects: [03-compare-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [accordion single-expand with hidden attribute, exclusion filter via flavor family matching, localStorage persistence for filter state]

key-files:
  created: []
  modified:
    - custard-calendar/docs/compare-page.js
    - custard-calendar/docs/style.css
    - custard-calendar/worker/test/browser/compare-filter.spec.mjs

key-decisions:
  - "Detail panel placed as sibling div after row (not inside flex row) to avoid flex layout issues"
  - "Filter test mocks provide flavor-config extending families to include test flavors like Mint Chip"

patterns-established:
  - "Accordion expand: single-expand constraint via _expandedRow tracking, hidden attribute for instant toggle"
  - "Exclusion filter: FLAVOR_FAMILIES key matching via getFamilyForFlavor, Set-based tracking, localStorage persistence"

requirements-completed: [COMP-03, COMP-05, COMP-06]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 3 Plan 02: Compare Page Interactivity Summary

**Accordion expand with description/rarity/directions and 6 exclusion filter chips with dimming, localStorage persistence, and getFamilyForFlavor matching**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T03:54:29Z
- **Completed:** 2026-03-08T03:59:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Accordion expand on store rows: tap to show description, rarity detail (today only), and Google Maps directions link
- Single-expand constraint: tapping a new row collapses the previous one; tapping same row collapses it
- 6 exclusion filter chips (No Mint, No Chocolate, No Caramel, No Cheesecake, No Peanut Butter, No Nuts)
- Filter state persists in localStorage across page visits
- Excluded rows dimmed at 0.35 opacity with pointer-events:none
- All 14 compare tests pass (7 grid + 3 expand + 4 filter), no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accordion expand to store rows** - `ce06ecf` (feat)
2. **Task 2: Add exclusion filter chips with dimming and localStorage persistence** - `c125ac0` (feat)

## Files Created/Modified
- `custard-calendar/docs/compare-page.js` - Added toggleExpand, populateDetail, directionsUrl, EXCLUSION_CHIPS, applyExclusions, renderFilterChips, localStorage persistence
- `custard-calendar/docs/style.css` - Added focus-visible style for filter chip accessibility
- `custard-calendar/worker/test/browser/compare-filter.spec.mjs` - Updated flavor-config mock to map test flavors to families

## Decisions Made
- Detail panel is a sibling div after each row in the day card (not a child of the flex row) to avoid layout issues with display:flex
- Filter test mocks provide a flavor-config response that extends FLAVOR_FAMILIES to include test flavor names (e.g., "Mint Chip" added to mint family) since hardcoded members don't cover all possible flavor names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated filter test flavor-config mock to include test flavors**
- **Found during:** Task 2
- **Issue:** CustardPlanner.getFamilyForFlavor("Mint Chip") returned null because "Mint Chip" is not in the hardcoded mint family members list. Filter tests expected matching to work.
- **Fix:** Added MOCK_FLAVOR_CONFIG to compare-filter.spec.mjs that extends the mint/chocolate/caramel/peanutButter families to include test flavor names
- **Files modified:** custard-calendar/worker/test/browser/compare-filter.spec.mjs
- **Verification:** All 4 filter tests pass
- **Committed in:** c125ac0

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test fixture correction necessary for family matching to work. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Accordion expand and exclusion filters complete
- Plan 03 (service worker update, cache version bump) is the final plan for Phase 3
- All COMP-01 through COMP-08 requirements are now covered except service worker caching

## Self-Check: PASSED

- compare-page.js: FOUND
- style.css: FOUND
- compare-filter.spec.mjs: FOUND
- 03-02-SUMMARY.md: FOUND
- Commit ce06ecf: FOUND
- Commit c125ac0: FOUND

---
*Phase: 03-compare-page*
*Completed: 2026-03-08*
