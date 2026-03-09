---
phase: 09-infrastructure-deployment
plan: 01
subsystem: infra
tags: [ci, github-pages, deployment, smoke-test, bash]

# Dependency graph
requires:
  - phase: 08-quiz-mode-visual-differentiation
    provides: quiz mode theming commits ready to deploy
provides:
  - ".planning in CI allowlist (unblocks all future pushes)"
  - "Reusable smoke test script for deployment verification"
  - "All v1.1 commits deployed to custard.chriskaschner.com"
affects: [09-02, 10-redirects-css-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: [curl-based smoke test with nav + content marker per page]

key-files:
  created:
    - custard-calendar/scripts/smoke_test_deploy.sh
  modified:
    - custard-calendar/scripts/check_repo_structure.py
    - custard-calendar/REPO_CONTRACT.md

key-decisions:
  - "Smoke test uses static HTML markers (id attributes) not JS-rendered content"
  - "BASE_URL env var override enables local testing with same script"

patterns-established:
  - "Smoke test pattern: curl + grep for nav marker + content marker per page"
  - "CI allowlist sync: update both check_repo_structure.py AND REPO_CONTRACT.md together"

requirements-completed: [INFR-01, INFR-02]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 9 Plan 1: CI Fix, Deploy, and Smoke Test Summary

**Fixed CI repo structure check for .planning/, pushed 6 commits to origin/main, and created reusable 6-page smoke test script verified against live deployment**

## Performance

- **Duration:** 3m 41s
- **Started:** 2026-03-09T15:06:11Z
- **Completed:** 2026-03-09T15:09:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CI repo structure check passes with .planning/ in the allowlist (INFR-01)
- All 6 unpushed commits deployed to custard.chriskaschner.com including Phase 8 quiz mode theming (INFR-02)
- Reusable smoke test script validates 6 pages with shared nav + page-specific content markers
- CI pipeline green (CI, Security Scan, and Pages build all succeeded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add .planning to CI allowlist and REPO_CONTRACT.md** - `c504e5d` (fix)
2. **Task 2: Create smoke test script, push all commits, verify deployment** - `be9ccc0` (feat)

## Files Created/Modified
- `custard-calendar/scripts/check_repo_structure.py` - Added '.planning' to ALLOWED_DIRS set
- `custard-calendar/REPO_CONTRACT.md` - Added .planning/ row to allowed directories table
- `custard-calendar/scripts/smoke_test_deploy.sh` - New: curl-based deployment verification for 6 pages

## Decisions Made
- Used static HTML id attributes as content markers rather than JS-rendered content (curl sees raw HTML only)
- Chose `id="shared-nav"` as nav marker since it exists in raw HTML of all pages before JS hydration
- Made BASE_URL configurable via environment variable for local testing flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - GitHub Pages deployed within 2 minutes and all smoke tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CI pipeline is green and all code is deployed
- Ready for 09-02: cache-bust cleanup, SW registration on remaining pages, stores.json pre-cache
- Smoke test script available for future deploy verification

## Self-Check: PASSED

All files verified present. All commit hashes found in git log.

---
*Phase: 09-infrastructure-deployment*
*Completed: 2026-03-09*
