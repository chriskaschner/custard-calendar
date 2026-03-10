---
phase: 14-validation-tooling
plan: 02
subsystem: testing
tags: [vitest, pixelmatch, pngjs, golden-baselines, visual-regression, ci-gate]

# Dependency graph
requires:
  - phase: 14-validation-tooling
    plan: 01
    provides: "pixelmatch + pngjs devDependencies, shared render-to-pixels.js utility"
provides:
  - "golden-baselines.test.js: 160 pixelmatch visual regression tests (40 flavors x 4 tiers)"
  - "160 golden PNG baselines in worker/test/fixtures/goldens/{mini,hd,premium,hero}/"
  - "UPDATE_GOLDENS=1 regeneration workflow for intentional rendering changes"
affects: [15-profile-expansion, 16-bulk-authoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [pixelmatch zero-tolerance golden baselines, UPDATE_GOLDENS env-var regeneration workflow]

key-files:
  created:
    - "custard-calendar/worker/test/golden-baselines.test.js"
    - "custard-calendar/worker/test/fixtures/goldens/mini/*.png (40 files)"
    - "custard-calendar/worker/test/fixtures/goldens/hd/*.png (40 files)"
    - "custard-calendar/worker/test/fixtures/goldens/premium/*.png (40 files)"
    - "custard-calendar/worker/test/fixtures/goldens/hero/*.png (40 files)"
  modified:
    - "custard-calendar/.gitignore"

key-decisions:
  - "Zero tolerance pixelmatch threshold (threshold: 0) since all rendering is deterministic via seeded PRNG"
  - "Added .gitignore exception for golden PNGs -- global *.png rule was blocking baseline storage"

patterns-established:
  - "Golden baseline pattern: UPDATE_GOLDENS=1 generates/regenerates, normal run compares with zero tolerance"
  - "Flavor slug pattern: lowercase name with non-alphanumeric replaced by hyphens for filesystem-safe filenames"

requirements-completed: [VALD-03]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 14 Plan 02: Golden Baselines Summary

**Pixelmatch golden baseline visual regression tests -- 160 zero-tolerance PNG comparisons across 40 flavors x 4 rendering tiers (mini/hd/premium/hero)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T02:11:51Z
- **Completed:** 2026-03-10T02:14:41Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 162 (1 test file, 160 PNGs, 1 .gitignore)

## Accomplishments
- Built golden-baselines.test.js with 160 pixelmatch regression tests (40 flavors x 4 tiers)
- Generated 160 golden PNG baselines (all under 1KB each, visually inspectable in PRs)
- Zero tolerance threshold ensures any pixel change in any flavor's rendering is caught
- UPDATE_GOLDENS=1 workflow for clean baseline regeneration after intentional changes
- Full test suite passes: 1051 tests across 44 files, zero regressions

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 (RED): Failing golden baseline tests** - `f2df7b1` (test)
2. **Task 1 (GREEN): Generate baselines, all tests pass** - `1d88fa5` (feat)

## Files Created/Modified
- `worker/test/golden-baselines.test.js` - Pixelmatch visual regression test: 160 tests for 40 flavors x 4 tiers
- `worker/test/fixtures/goldens/mini/*.png` - 40 golden baselines (9x11px, ~200-280 bytes each)
- `worker/test/fixtures/goldens/hd/*.png` - 40 golden baselines (18x21px, ~350-500 bytes each)
- `worker/test/fixtures/goldens/premium/*.png` - 40 golden baselines (24x28px, ~600-900 bytes each)
- `worker/test/fixtures/goldens/hero/*.png` - 40 golden baselines (36x42px, ~700-800 bytes each)
- `.gitignore` - Added exception for golden baseline PNGs (was blocked by global `*.png` rule)

## Decisions Made
- **Zero tolerance threshold:** Since all 4 renderers use deterministic output (seeded Mulberry32 PRNG for Premium tier scatter), threshold: 0 is correct -- any pixel difference is a real rendering change, not noise
- **Gitignore exception:** The global `*.png` rule (for Tidbyt renders/screenshots) was blocking golden baseline storage; added `!worker/test/fixtures/goldens/**/*.png` exception

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .gitignore exception for golden PNGs**
- **Found during:** Task 1 (GREEN phase -- committing golden baselines)
- **Issue:** Global `*.png` rule in .gitignore prevented git from tracking the golden baseline PNGs
- **Fix:** Added `!worker/test/fixtures/goldens/**/*.png` exception to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git check-ignore` confirms PNGs are no longer ignored; all 160 PNGs staged and committed
- **Committed in:** 1d88fa5 (part of GREEN commit)

**2. [Rule 1 - Bug] Corrected vitest --bail flag (plan used -x)**
- **Found during:** Task 1 (RED phase verification)
- **Issue:** Plan specified `-x` flag for fail-fast but vitest uses `--bail 1`
- **Fix:** Used correct `--bail 1` flag; no code change needed (test file unaffected)
- **Files modified:** None
- **Verification:** Tests run correctly with `--bail 1`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Gitignore fix was essential for storing baselines in repo. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 VALD validation gates now active (palette-sync, contrast-check, golden-baselines)
- Phase 15 (Profile Expansion) can add new flavors; golden baselines will catch unintended rendering changes
- Phase 16 (Bulk Authoring) can safely modify renderers; any pixel change triggers test failure
- UPDATE_GOLDENS=1 workflow documented for intentional rendering updates

## Self-Check: PASSED

- golden-baselines.test.js: FOUND
- Mini PNGs: 40/40
- HD PNGs: 40/40
- Premium PNGs: 40/40
- Hero PNGs: 40/40
- Commit f2df7b1 (RED): FOUND
- Commit 1d88fa5 (GREEN): FOUND
- 14-02-SUMMARY.md: FOUND

---
*Phase: 14-validation-tooling*
*Completed: 2026-03-10*
