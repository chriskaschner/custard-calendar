---
phase: 31-homepage-redesign
plan: 02
subsystem: ui
tags: [css-cleanup, playwright, browser-testing, cta, dead-code-removal]

# Dependency graph
requires:
  - phase: 31-homepage-redesign/01
    provides: "Redesigned homepage HTML with hero card, simplified empty state, skeleton"
provides:
  - "Single-line CTA replacing full card (below-fold-cta class)"
  - "Dead CSS cleaned: signals, multi-store, quick-start, first-visit-guide, old CTA card"
  - "Playwright regression suite for homepage redesign at 375px"
  - "Updated today-hero.spec.mjs tests matching redesigned page"
affects: [31-homepage-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route mock pattern in Playwright for homepage tests (setupWithMocks)"
    - "below-fold-cta class for minimal CTA text lines"

key-files:
  created:
    - worker/test/browser/homepage-redesign.spec.mjs
  modified:
    - docs/index.html
    - docs/style.css
    - worker/test/browser/today-hero.spec.mjs

key-decisions:
  - "CTA replaced with single text line rather than redesigned card -- simplicity over engagement"
  - "Dead CSS from all removed sections cleaned in one pass -- no orphan styles remain"

patterns-established:
  - "setupWithMocks() helper for Playwright tests needing Worker API data"

requirements-completed: [HOME-02, HOME-04]

# Metrics
duration: 5min
completed: 2026-03-19
---

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
