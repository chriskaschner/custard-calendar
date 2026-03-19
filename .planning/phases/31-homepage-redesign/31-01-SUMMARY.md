---
phase: 31-homepage-redesign
plan: 01
subsystem: ui
tags: [html, css, javascript, hero-card, skeleton, cls-prevention, cta]

# Dependency graph
requires: []
provides:
  - "Redesigned homepage HTML with hero card as sole above-fold content"
  - "Action CTAs (Directions/Alert/Subscribe) wired into hero card via actionCTAsHTML()"
  - "Meta footer with store name and freshness timestamp on hero card"
  - "CLS-preventing skeleton with 120px cone placeholder"
  - "Simplified empty state: single sentence + Find your store button"
  - "Week-ahead details element collapsed by default (HOME-02)"
affects: [31-homepage-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hero card as complete decision-making unit (flavor + rarity + CTAs + meta)"
    - "Skeleton matches hero card dimensions exactly for CLS prevention"
    - "fadeIn CSS animation for skeleton-to-card transition"

key-files:
  created: []
  modified:
    - docs/index.html
    - docs/today-page.js
    - docs/style.css

key-decisions:
  - "Moved SharedNav div outside header to be direct child of body above main"
  - "Action CTAs shown for confirmed and predicted types, cleared for no-data state"
  - "Reused existing store lookup from renderHeroCard instead of duplicate find"

patterns-established:
  - "today-card-enter class: fadeIn animation applied when hero card first renders"
  - "Skeleton uses same .card .today-card class chain to inherit base styles"

requirements-completed: [HOME-01, HOME-02, HOME-03, HOME-04]

# Metrics
duration: 6min
completed: 2026-03-19
---

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
