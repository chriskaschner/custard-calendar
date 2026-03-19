---
phase: 28-worker-social-card-migration
plan: 01
subsystem: api
tags: [svg, social-cards, png, base64, og-images, worker]

requires:
  - phase: 26-ai-cone-generation
    provides: 94 L5 AI PNG cone images deployed to docs/assets/cones/
  - phase: 27-client-side-art-migration
    provides: HD SVG tier removal, renderConeSVG L0 fallback pattern

provides:
  - L5 PNG-embedding social card generator (OG images with AI cone art)
  - Async PNG fetch with L0 SVG fallback for all card types
  - Pattern for base64 image embedding in Worker-generated SVGs

affects: [28-02-PLAN, social-cards, worker]

tech-stack:
  added: []
  patterns: [async-png-fetch-with-fallback, base64-image-embedding-in-svg]

key-files:
  created: []
  modified:
    - worker/src/social-card.js
    - worker/test/social-card.test.js

key-decisions:
  - "PNG fetched from GitHub Pages CDN (custard.chriskaschner.com/assets/cones) rather than KV storage"
  - "L0 mini SVG fallback uses renderConeSVG with scale derived from target width (width/9)"

patterns-established:
  - "renderConeEmbed pattern: async PNG fetch -> base64 <image> embed -> L0 SVG fallback on failure"
  - "All card renderers (renderCard, renderPageCard, renderTriviaCard) are async to support PNG fetching"

requirements-completed: [INT-04]

duration: 4min
completed: 2026-03-19
---

# Phase 28 Plan 01: Social Card PNG Migration Summary

**Social card SVG generator migrated from HD pixel-art cones to L5 AI PNG embedding via base64 data URIs with L0 SVG fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T18:33:44Z
- **Completed:** 2026-03-19T18:37:17Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Replaced renderConeHDSVG with async PNG fetching from GitHub Pages CDN
- All three card types (store/date, page, trivia) now embed L5 AI cone PNGs as base64 `<image>` elements
- Graceful fallback to L0 mini SVG cone when PNG fetch fails (404 or network error)
- Full worker test suite: 1381 tests pass, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for PNG embedding** - `d77684f` (test)
2. **Task 1 GREEN: Implement PNG embedding migration** - `9aa5e5b` (feat)

_TDD task: test-first commit followed by implementation commit_

## Files Created/Modified
- `worker/src/social-card.js` - Replaced HD SVG cone rendering with async L5 PNG embedding; added flavorToSlug, fetchConePngBase64, renderConeEmbed; made all render functions async
- `worker/test/social-card.test.js` - Added fetch mocking (success/404/error), PNG embedding assertions for all card types, fallback behavior tests; updated from 23 to 27 tests

## Decisions Made
- PNG fetched from GitHub Pages CDN rather than KV: avoids KV read quota burn and leverages existing CDN caching
- Fallback scale calculation uses `Math.round(width / 9)` to match the 9-pixel-wide L0 mini SVG grid
- Cone positioning adjusted for PNG aspect ratio (288x336): store card at (50,120,150,175), page/trivia at (1000,100-130,150,175)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Social card PNG embedding complete; ready for Phase 28 Plan 02 (cleanup/verification)
- All worker tests passing, no blockers

## Self-Check: PASSED

- Files: worker/src/social-card.js FOUND, worker/test/social-card.test.js FOUND
- Commits: d77684f FOUND, 9aa5e5b FOUND
- Tests: 27/27 social-card tests pass, 1381/1381 worker tests pass

---
*Phase: 28-worker-social-card-migration*
*Completed: 2026-03-19*
