---
phase: 30-housekeeping-closure
plan: 01
subsystem: docs
tags: [todo-triage, backlog-cleanup, ml-closure]

# Dependency graph
requires:
  - phase: none
    provides: first phase of v3.0
provides:
  - "Clean TODO.md backlog with Won't Do section for ML prediction pipeline"
  - "All stale items from prior milestones triaged with documented rationale"
  - "SIMP-03 requirement satisfied"
affects: [31-homepage-redesign, 32-page-consolidation]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Won't Do section with strategic rationale for formally closed items"]

key-files:
  created: []
  modified: [TODO.md]

key-decisions:
  - "ML prediction pipeline (ensemble, confidence intervals, cluster transfer, cluster emails) permanently closed -- confirmed schedule IS the product at ~100% accuracy vs 3.2% ML top-1"
  - "Homepage visual coherence audit items superseded by Phase 31 redesign rather than fixed independently"
  - "Sync architecture deferred indefinitely -- find 10 real users before adding features"
  - "Mad Libs quality moved to Someday/Maybe rather than closed -- still has potential value after v3.0"

patterns-established:
  - "Won't Do section: formally close items with individual rationale + strategic summary referencing REQUIREMENTS.md"

requirements-completed: [SIMP-03]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 30 Plan 01: TODO.md Backlog Triage Summary

**Formally closed 4 ML prediction pipeline items with strategic rationale and triaged 16 stale items from prior milestones, leaving zero unchecked items outside Someday/Maybe**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T20:17:25Z
- **Completed:** 2026-03-19T20:20:45Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created Won't Do section with ML Prediction Pipeline subsection and strategic rationale referencing SIMP-03
- Closed 4 ML items (ensemble predictor, confidence intervals, cluster transfer learning, cluster-personalized emails) with individual rationale explaining why each has no user-visible value
- Triaged 16 additional stale items: 7 homepage audit items superseded by Phase 31, 3 sync items deferred per v3.0 strategy, and 6 refactor/architecture/preference items closed with specific rationale
- Moved Mad Libs quality item to Someday/Maybe as still-viable deferred work
- Annotated P0 Homepage and Phase 3 Sync section headers with superseded/closed notes

## Task Commits

Each task was committed atomically:

1. **Task 1: Move ML prediction items to Won't Do with rationale** - `8333b54` (chore)
2. **Task 2: Triage all remaining stale TODO items** - `a4e4ca7` (chore)

## Files Created/Modified
- `TODO.md` - Added Won't Do section with 4 ML items; closed 16 stale items with rationale; moved Mad Libs to Someday/Maybe; annotated superseded sections

## Decisions Made
- ML prediction pipeline permanently closed: the confirmed schedule is the product (100% accuracy vs 3.2% ML top-1), prediction infrastructure has no user-visible value
- Homepage audit items closed individually rather than bulk-closed, because Phase 31 redesign will address them holistically
- Sync architecture items deferred indefinitely rather than moved to Won't Do, because sync could have value after user validation
- Mad Libs kept as deferred work (Someday/Maybe) rather than closed, because it is a polish item that could improve the existing quiz experience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TODO.md backlog is now trustworthy for v3.0 planning
- SIMP-03 requirement satisfied
- Ready for Phase 31 (Homepage Redesign) which depends on Phase 30

---
*Phase: 30-housekeeping-closure*
*Completed: 2026-03-19*
