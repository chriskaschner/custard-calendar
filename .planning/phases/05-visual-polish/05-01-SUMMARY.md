---
phase: 05-visual-polish
plan: 01
subsystem: ui
tags: [css-tokens, card-system, seasonal-detection, playwright, vanilla-js]

requires:
  - phase: 04-supporting-pages
    provides: "4 nav destination pages (Today, Compare, Map, Fun) with inline styles"
provides:
  - "CSS design tokens (8 typography, 6 spacing, 3 color) at :root"
  - ".card base class with 4 context-specific variants"
  - "isSeasonalFlavor() function in CustardPlanner public API"
  - "Seasonal cadence text suppression on Today and Compare pages"
affects: [05-visual-polish]

tech-stack:
  added: []
  patterns: ["CSS custom property design tokens", ".card + modifier class system", "isSeasonalFlavor guard pattern for cadence text"]

key-files:
  created:
    - "worker/test/browser/vizp-card-system.spec.mjs"
    - "worker/test/browser/vizp-seasonal-rarity.spec.mjs"
  modified:
    - "docs/style.css"
    - "docs/index.html"
    - "docs/compare-page.js"
    - "docs/fun.html"
    - "docs/map.html"
    - "docs/planner-shared.js"
    - "docs/today-page.js"

key-decisions:
  - "Updated .today-card border-radius from 8px to 12px to match .card base class system"
  - "Moved fun.html inline quiz-mode-card styles to style.css via .card--quiz variant"
  - "isSeasonalFlavor uses regex matching same SEASONAL_PATTERN from worker/src/flavor-tags.js"
  - "renderRarity() accepts flavorName as second parameter for seasonal detection"
  - "Compare detail panel reads flavor name from data.today.flavor for seasonal check"

patterns-established:
  - "Card system: always ADD .card class alongside existing classes, never rename/delete"
  - "Design tokens: extend :root vars, consume via var() in nav page rules only"
  - "Seasonal guard: wrap cadence text conditions with !CustardPlanner.isSeasonalFlavor()"

requirements-completed: [VIZP-02, VIZP-03]

duration: 9min
completed: 2026-03-08
---

# Phase 5 Plan 1: Card System and Seasonal Rarity Summary

**CSS design tokens + unified .card system across 4 nav pages + seasonal cadence text suppression via isSeasonalFlavor() guard**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T21:08:32Z
- **Completed:** 2026-03-08T21:17:20Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- 17 CSS design tokens (8 typography, 6 spacing, 3 color) defined at :root in style.css
- .card base class (12px border-radius, white bg, 1px border, box-shadow) with 4 variants (.card--hero, .card--compare-day, .card--map-store, .card--quiz)
- All 4 nav pages (Today, Compare, Map, Fun) migrated to .card class system
- isSeasonalFlavor() function added to CustardPlanner, detecting pumpkin/peppermint/eggnog/holiday/gingerbread/apple cider
- Cadence text suppressed for seasonal flavors on Today page renderRarity() and Compare page detail panel
- 9 new Playwright tests all passing (4 card system + 5 seasonal rarity)

## Task Commits

Each task was committed atomically:

1. **Task 1: Design tokens, .card base class, and card migration** (TDD)
   - `f486ac3` test: add failing Playwright tests for VIZP-02 card system
   - `842d5a4` feat: design tokens, .card base class, and card migration across 4 nav pages

2. **Task 2: Seasonal rarity cadence suppression** (TDD)
   - `91ac61f` test: add failing Playwright tests for VIZP-03 seasonal rarity suppression
   - `08616c8` feat: seasonal rarity cadence suppression in planner-shared, today, and compare

## Files Created/Modified
- `docs/style.css` - Design tokens at :root, .card base class + 4 variants, .today-card radius aligned
- `docs/index.html` - Added .card.card--hero to today-card element
- `docs/compare-page.js` - Added .card.card--compare-day to day cards, seasonal cadence guard in detail panel
- `docs/fun.html` - Moved inline quiz-mode-card styles to style.css, added .card.card--quiz classes
- `docs/map.html` - Added .card.card--map-store to store popup template
- `docs/planner-shared.js` - Added SEASONAL_PATTERN, isSeasonalFlavor(), exported via CustardPlanner
- `docs/today-page.js` - Updated renderRarity() to accept flavorName, added seasonal cadence guard
- `worker/test/browser/vizp-card-system.spec.mjs` - Playwright tests for VIZP-02 card system
- `worker/test/browser/vizp-seasonal-rarity.spec.mjs` - Playwright tests for VIZP-03 seasonal rarity

## Decisions Made
- Updated .today-card border-radius from 8px to 12px to align with the unified .card base class system
- Moved fun.html inline quiz-mode-card CSS into style.css as .card--quiz variant (removed from inline style block)
- Kept all existing CSS class names intact -- only added .card alongside them per plan guidance
- Used data.today.flavor in compare-page.js populateDetail() for seasonal flavor name access
- renderRarity() signature extended with optional flavorName parameter (backward compatible)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated .today-card border-radius to match .card base**
- **Found during:** Task 1 (card system implementation)
- **Issue:** .today-card rule at line 1568 set border-radius: 8px which overrode .card's 12px because it appeared later in cascade
- **Fix:** Changed .today-card border-radius from 8px to 12px
- **Files modified:** docs/style.css
- **Verification:** Playwright test confirms 12px computed border-radius
- **Committed in:** 842d5a4 (Task 1 feat commit)

**2. [Rule 1 - Bug] Fixed Compare page test setup using correct localStorage format**
- **Found during:** Task 1 (card system tests)
- **Issue:** Initial test used custard-primary/custard-secondary localStorage keys but Compare page reads custard:v1:preferences with activeRoute object
- **Fix:** Updated test setup to use custard:v1:preferences format matching existing compare-grid.spec.mjs pattern
- **Files modified:** worker/test/browser/vizp-card-system.spec.mjs
- **Verification:** Compare page test passes with correct mock data format
- **Committed in:** 842d5a4 (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
- Pre-existing TDAY-01 test failure: today-hero.spec.mjs uses hardcoded date 2026-03-07 but current date is 2026-03-08, causing flavor mismatch. Not caused by these changes -- logged as out-of-scope pre-existing issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Card system foundation ready for Plan 05-02 (cone rendering tiers)
- Design tokens available for any future tokenization of font-size/spacing values
- isSeasonalFlavor() available for any future seasonal-aware features

## Self-Check: PASSED

All 5 key files verified present. All 4 commit hashes verified in git log.

---
*Phase: 05-visual-polish*
*Completed: 2026-03-08*
