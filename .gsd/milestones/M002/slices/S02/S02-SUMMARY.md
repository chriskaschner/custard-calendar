---
id: S02
parent: M002
milestone: M002
provides:
  - Redesigned homepage HTML with hero card as sole above-fold content
  - Action CTAs (Directions/Alert/Subscribe) wired into hero card via actionCTAsHTML()
  - Meta footer with store name and freshness timestamp on hero card
  - CLS-preventing skeleton with 120px cone placeholder
  - Simplified empty state: single sentence + Find your store button
  - Week-ahead details element collapsed by default (HOME-02)
  - Single-line CTA replacing full card (below-fold-cta class)
  - Dead CSS cleaned: signals, multi-store, quick-start, first-visit-guide, old CTA card
  - Playwright regression suite for homepage redesign at 375px
  - Updated today-hero.spec.mjs tests matching redesigned page
requires: []
affects: []
key_files: []
key_decisions:
  - Moved SharedNav div outside header to be direct child of body above main
  - Action CTAs shown for confirmed and predicted types, cleared for no-data state
  - Reused existing store lookup from renderHeroCard instead of duplicate find
  - CTA replaced with single text line rather than redesigned card -- simplicity over engagement
  - Dead CSS from all removed sections cleaned in one pass -- no orphan styles remain
patterns_established:
  - today-card-enter class: fadeIn animation applied when hero card first renders
  - Skeleton uses same .card .today-card class chain to inherit base styles
  - setupWithMocks() helper for Playwright tests needing Worker API data
observability_surfaces: []
drill_down_paths: []
duration: 5min
verification_result: passed
completed_at: 2026-03-19
blocker_discovered: false
---
# S02: Homepage Redesign

**# Phase 31 Plan 01: Homepage Hero Card Redesign Summary**

## What Happened

# Phase 31 Plan 01: Homepage Hero Card Redesign Summary

**Hero card with action CTAs, meta footer, and CLS-preventing skeleton as sole above-fold content; empty state simplified to single-sentence prompt; dead sections (header, signals, multi-store, 3-step guide) removed from HTML, JS, and CSS**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T23:30:35Z
- **Completed:** 2026-03-19T23:37:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Hero card now contains cone art, flavor name, description, rarity badge, Directions/Alert/Subscribe CTAs, and store meta footer -- complete decision-making unit above the fold
- Skeleton upgraded to two-column layout with 120px cone placeholder matching hero card dimensions (HOME-03 CLS prevention)
- Empty state reduced from 3-step guide + coverage disclaimer + multiple CTAs to a single sentence and one button
- 358 lines of dead HTML/JS/CSS removed (signals section, multi-store glance, quick-start stores, legacy location bar, page header)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite index.html structure and skeleton/empty-state CSS** - `49555ec` (feat)
2. **Task 2: Wire actionCTAsHTML, meta footer, fade-in; remove dead JS** - `5937bb7` (feat)

**Deviation fix:** `3650985` (fix: remove dead CSS section spacing rules)

## Files Created/Modified
- `docs/index.html` - Redesigned homepage: hero card with CTA/meta containers, simplified empty state, upgraded skeleton, removed header/signals/multi-store sections
- `docs/today-page.js` - Wired actionCTAsHTML() and meta footer into renderHeroCard(), deleted 4 dead functions, removed dead DOM refs and section logic
- `docs/style.css` - Added skeleton-cone, skeleton-text, hero-empty-heading, near-me-label, fadeIn rules; removed forecast-header, header-subtitle, hero-cta-row, first-visit-guide, quick-start, hero-coverage styles

## Decisions Made
- Moved SharedNav out of header element to be a direct child of body -- header element itself was deleted since it contained only the h1/subtitle and legacy location bar
- Action CTAs rendered for both confirmed and predicted flavor types but cleared for no-data state
- Meta footer always shows store name; freshness timestamp only appears when fetchedAt is available
- Dead CSS for #signals-section and #multi-store-section spacing rules cleaned up as deviation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead CSS spacing rules for deleted HTML sections**
- **Found during:** Post-task verification
- **Issue:** #signals-section and #multi-store-section spacing rules in style.css referenced deleted HTML elements
- **Fix:** Removed two dead CSS rules
- **Files modified:** docs/style.css
- **Verification:** grep confirms zero references to signals-section and multi-store-section across HTML and JS
- **Committed in:** 3650985

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup of dead CSS left behind by HTML removal. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hero card structure complete, ready for Plan 31-02 (week-ahead strip, CTA simplification, below-fold polish)
- SharedNav preserved and functional as direct body child
- All card classes use existing design token system (HOME-04)

---
*Phase: 31-homepage-redesign*
*Completed: 2026-03-19*

# Phase 31 Plan 02: CTA Simplification, Dead CSS Cleanup, and Playwright Tests Summary

**Single-line CTA replaces full card, dead CSS from 6 removed section groups cleaned, Playwright test suite locks in redesigned homepage layout at 375px with route mocks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T23:39:00Z
- **Completed:** 2026-03-19T23:44:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- CTA section reduced from a full card (heading + paragraph + button) to a single text line "Get daily flavor alerts -- set it up" with inline link
- Dead CSS from 6 section groups removed: signals-list, hero-signal, multi-store-*, quick-start-*, first-visit-guide, updates-cta-card -- zero orphan styles remain
- Playwright test suite (homepage-redesign.spec.mjs) with 6 tests covering hero above fold, removed sections absent, minimal empty state, week-ahead collapsed, skeleton cone, CTA text line
- today-hero.spec.mjs updated: TDAY-05 deleted (signals section no longer exists), TDAY-06 rewritten for "Get daily flavor alerts" CTA text

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace CTA card, clean dead CSS, update today-hero.spec.mjs** - `13f54fc` (feat)
2. **Task 2: Add Playwright browser tests for homepage redesign at 375px** - `05b1c6e` (test)
3. **Task 3: Visual verification at 375px** - User approved (checkpoint, no commit)

## Files Created/Modified
- `docs/index.html` - Replaced #updates-cta card with single text line using below-fold-cta class
- `docs/style.css` - Added .below-fold-cta and .cta-link-inline rules; removed dead CSS for signals-list, hero-signal, multi-store-*, quick-start-*, first-visit-guide, updates-cta-card
- `worker/test/browser/today-hero.spec.mjs` - Deleted TDAY-05 (signals section), rewrote TDAY-06 for new CTA text, removed MOCK_SIGNALS and signals route mock
- `worker/test/browser/homepage-redesign.spec.mjs` - New Playwright test suite: 6 tests covering homepage redesign layout at 375px with setupWithMocks() route mock helper

## Decisions Made
- CTA simplified to single text line rather than a redesigned card -- aligns with the project's simplification-first direction
- Dead CSS cleaned from all removed section groups in a single pass to prevent style drift
- Playwright tests use full route mock setup (setupWithMocks) following today-hero.spec.mjs pattern, ensuring tests work without a live Worker

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 31 (Homepage Redesign) is now complete -- all 4 HOME requirements verified
- Hero card with CTAs above fold, collapsed week-ahead, minimal CTA line, CLS-preventing skeleton all locked in with Playwright tests
- Ready for Phase 32 (Page Consolidation) which depends on this homepage redesign to know which pages survive

## Self-Check: PASSED

- [x] docs/index.html exists
- [x] docs/style.css exists
- [x] worker/test/browser/today-hero.spec.mjs exists
- [x] worker/test/browser/homepage-redesign.spec.mjs exists
- [x] Commit 13f54fc exists (Task 1)
- [x] Commit 05b1c6e exists (Task 2)
- [x] Task 3 approved by user (checkpoint, no commit)

---
*Phase: 31-homepage-redesign*
*Completed: 2026-03-19*
