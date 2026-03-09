---
phase: 11-monolith-refactoring
plan: 01
subsystem: frontend
tags: [vanilla-js, iife, module-split, object-assign, playwright]

# Dependency graph
requires:
  - phase: 10-redirects-css-cleanup
    provides: "Clean codebase with redirect stubs and CSS classes"
provides:
  - "Slim planner-shared.js facade (117 lines) with core utils + underscore-prefixed internal helpers"
  - "planner-data.js sub-module (brand, normalize, haversine, families, seasonal)"
  - "planner-domain.js sub-module (certainty, timeline, rarity, reliability, store/drive, history)"
  - "planner-ui.js sub-module (CTAs, telemetry, signals, share button)"
  - "API surface smoke test verifying all 60 exports on window.CustardPlanner"
  - "test-api-surface.html test harness for module split verification"
affects: [11-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["IIFE + Object.assign sub-module extension pattern", "Underscore-prefixed internal API convention (_normalizeStringList etc.)"]

key-files:
  created:
    - "custard-calendar/docs/planner-data.js"
    - "custard-calendar/docs/planner-domain.js"
    - "custard-calendar/docs/planner-ui.js"
    - "custard-calendar/docs/test-api-surface.html"
    - "custard-calendar/worker/test/browser/api-surface.spec.mjs"
  modified:
    - "custard-calendar/docs/planner-shared.js"

key-decisions:
  - "Sub-modules load independently at IIFE execution time; cross-module calls happen only at runtime via CP reference"
  - "cleanTelemetrySlug duplicated in planner-domain.js (for fetchStoreHistoricalContext) to avoid load-time cross-module dependency on planner-ui.js"
  - "Test harness HTML page used for API surface verification instead of modifying production index.html (Plan 02 scope)"
  - "brandFromSlug kept in planner-data.js (referenced by isCulversSlug in domain via CP.brandFromSlug at runtime)"

patterns-established:
  - "IIFE sub-module pattern: (function() { var CP = window.CustardPlanner; ... Object.assign(CP, {...}); })();"
  - "Guard check at top of each sub-module: if (!CP) { console.error('...'); return; }"
  - "No function definitions after Object.assign in any sub-module (avoids hoisting pitfall)"

requirements-completed: [ARCH-01]

# Metrics
duration: 9min
completed: 2026-03-09
---

# Phase 11 Plan 01: Monolith Split Summary

**Split planner-shared.js from 1,639-line monolith into 117-line facade + 3 IIFE sub-modules preserving all 60 exports on window.CustardPlanner**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-09T18:40:56Z
- **Completed:** 2026-03-09T18:49:29Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- Reduced planner-shared.js from 1,639 lines to 117-line facade containing only WORKER_BASE, escapeHtml, and underscore-prefixed internal helpers
- Created 3 self-contained IIFE sub-modules (planner-data.js, planner-domain.js, planner-ui.js) extending CustardPlanner via Object.assign
- Added Playwright API surface smoke test with 2 test cases verifying all 60 exports exist with correct types
- Verified baseline test passes against unsplit monolith before extraction, then passes against split files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create API surface smoke test and extract 3 sub-modules + slim facade** - `03246d1` (feat)

## Files Created/Modified
- `custard-calendar/docs/planner-shared.js` - Slimmed facade (117 lines): WORKER_BASE, escapeHtml, and underscore-prefixed internal helpers for sub-modules
- `custard-calendar/docs/planner-data.js` - Data sub-module (367 lines): brand constants, normalize, haversine, similarity groups, flavor families, seasonal detection
- `custard-calendar/docs/planner-domain.js` - Domain sub-module (833 lines): certainty, timeline, rarity, reliability, store persistence, drive preferences, historical context
- `custard-calendar/docs/planner-ui.js` - UI sub-module (444 lines): action CTAs, telemetry, signals, share button
- `custard-calendar/docs/test-api-surface.html` - Test harness loading all 4 scripts for Playwright verification
- `custard-calendar/worker/test/browser/api-surface.spec.mjs` - API surface smoke test (60 expected keys, type checking)

## Decisions Made
- Duplicated `cleanTelemetrySlug` in planner-domain.js rather than creating a load-time dependency on planner-ui.js (it is only 4 lines and avoids coupling)
- Used `CP.brandFromSlug()` in domain module's `isCulversSlug` -- this works because planner-data.js loads before planner-domain.js, but even if order changed, the call happens at runtime not IIFE-execution time
- Created a dedicated test-api-surface.html harness rather than temporarily modifying index.html; this is cleaner and avoids any risk of accidentally committing production HTML changes
- `getPageLoadId` implemented as a named function wrapping `_pageLoadId` in planner-ui.js (preserving exact API surface from the monolith's anonymous function in the return block)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] cleanTelemetrySlug duplication in domain module**
- **Found during:** Task 1 (Step 3 -- planner-domain.js extraction)
- **Issue:** `fetchStoreHistoricalContext` calls `cleanTelemetrySlug` which is a telemetry private helper. Moving it to UI would create a load-time dependency.
- **Fix:** Duplicated the 4-line function in planner-domain.js with a comment noting the duplication rationale
- **Files modified:** custard-calendar/docs/planner-domain.js
- **Verification:** API surface test passes; function behavior identical
- **Committed in:** 03246d1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical -- correctness)
**Impact on plan:** Minimal duplication of a 4-line utility function to avoid cross-module load-time dependency. No scope creep.

## Issues Encountered
- Existing Playwright tests that exercise drive preferences, telemetry, and other domain/UI features fail because production HTML pages still only load planner-shared.js (facade-only). This is expected and will be resolved by Plan 02 which adds the 3 new script tags to all HTML pages.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 4 JS files ready for production use (facade + 3 sub-modules)
- Plan 02 will add script tags to all 9 HTML pages and update sw.js STATIC_ASSETS
- API surface test is in place to gate Plan 02 correctness
- Existing Playwright tests will serve as regression gate once HTML pages are wired

## Self-Check: PASSED

All 6 created/modified files verified on disk. Task commit 03246d1 verified in git log.

---
*Phase: 11-monolith-refactoring*
*Completed: 2026-03-09*
