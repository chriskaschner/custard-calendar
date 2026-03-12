---
phase: 14-validation-tooling
plan: 01
subsystem: testing
tags: [vitest, wcag, contrast, palette-sync, ci-gate, pixelmatch, pngjs]

# Dependency graph
requires:
  - phase: 13-rendering-quality-fixes
    provides: "Canonical flavor-colors.js with all color dicts; FALLBACK sync in cone-renderer.js"
provides:
  - "palette-sync.test.js: CI gate verifying 5 downstream files match canonical color dicts"
  - "contrast-check.test.js: CI gate enforcing 3:1 WCAG contrast for topping/base combinations"
  - "test/helpers/render-to-pixels.js: shared renderToPixels, stableHash, pixelMapToRGBA utilities"
  - "Contrast-adjusted topping colors: 10 colors updated in canonical + all sync targets"
affects: [14-02-visual-regression, 15-profile-expansion, 16-bulk-authoring]

# Tech tracking
tech-stack:
  added: [pixelmatch, pngjs]
  patterns: [WCAG contrast validation, cross-file palette sync testing, shared test utility extraction]

key-files:
  created:
    - "custard-calendar/worker/test/helpers/render-to-pixels.js"
    - "custard-calendar/worker/test/palette-sync.test.js"
    - "custard-calendar/worker/test/contrast-check.test.js"
  modified:
    - "custard-calendar/worker/src/flavor-colors.js"
    - "custard-calendar/worker/test/flavor-colors.test.js"
    - "custard-calendar/worker/package.json"
    - "custard-calendar/docs/cone-renderer.js"
    - "custard-calendar/docs/flavor-audit.html"
    - "custard-calendar/tidbyt/culvers_fotd.star"
    - "custard-tidbyt/apps/culversfotd/culvers_fotd.star"

key-decisions:
  - "10 topping colors adjusted for WCAG 3:1 contrast compliance"
  - "7 structural exemptions documented where 3:1 impossible (cross-base conflicts)"
  - "custard-tidbyt path in palette-sync uses 3 levels up from test dir"
  - "Golden hashes updated for mint explosion across all 4 tiers"

patterns-established:
  - "Palette sync pattern: regex-parse downstream files, compare against canonical ESM imports"
  - "Contrast exemption pattern: Set of 'topping:base' keys for structurally impossible pairs"

requirements-completed: [VALD-01, VALD-02]

# Metrics
duration: 9min
completed: 2026-03-10
---

# Phase 14 Plan 01: Validation Tooling Summary

**Palette sync CI gate (16 tests across 5 files) and WCAG contrast checker (65 tests) with 10 topping color adjustments for 3:1 compliance**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-10T01:58:53Z
- **Completed:** 2026-03-10T02:08:48Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Extracted renderToPixels, stableHash, pixelMapToRGBA to shared test utility for reuse by Plan 02
- Built palette-sync.test.js verifying all 4 color dict types across cone-renderer.js, 2 Starlark files, and flavor-audit.html
- Built contrast-check.test.js enforcing WCAG 3:1 contrast for all topping/base combinations in FLAVOR_PROFILES
- Fixed custard-tidbyt Starlark color drift (BASE, RIBBON, TOPPING dicts)
- Adjusted 10 topping colors minimally to meet 3:1 contrast threshold
- All 891 tests pass (43 test files, zero failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, extract shared utility, fix Starlark drift** - `246f540` (chore) + `1a4d6d3` (fix, custard-tidbyt)
2. **Task 2: Palette sync test (VALD-01)** - `6b00672` (test)
3. **Task 3: Contrast checker (VALD-02)** - `4125ff6` (feat) + `8ed23bf` (fix, custard-tidbyt)

## Files Created/Modified
- `worker/test/helpers/render-to-pixels.js` - Shared renderToPixels, stableHash, pixelMapToRGBA utilities
- `worker/test/palette-sync.test.js` - CI gate: 16 tests verifying color sync across 5 files
- `worker/test/contrast-check.test.js` - CI gate: 65 tests enforcing WCAG 3:1 contrast
- `worker/src/flavor-colors.js` - 10 topping colors contrast-adjusted
- `worker/test/flavor-colors.test.js` - Import from shared utility, updated golden hashes
- `worker/package.json` - Added pixelmatch, pngjs devDependencies
- `docs/cone-renderer.js` - FALLBACK_TOPPING_COLORS synced
- `docs/flavor-audit.html` - SEED_TOPPING synced
- `tidbyt/culvers_fotd.star` - TOPPING_COLORS synced
- `custard-tidbyt/apps/culversfotd/culvers_fotd.star` - Full color dict sync (BASE, RIBBON, TOPPING)

## Decisions Made
- **10 contrast-adjusted topping colors:** andes (#0A3726), cashew (#897E6C), cookie_dough (#917C60), strawberry_bits (#A10E2B), peach_bits (#BF7200), salt (#4B4B4B), m_and_m (#FF7D7D), brownie (#ADA59C), pie_crust (#C99E76), blackberry_drupe (#AEA1BB)
- **7 structural exemptions:** dove:chocolate, dove:chocolate_custard, dove:caramel, oreo:chocolate, pecan:chocolate_custard, pecan:caramel, cake:chocolate_custard, pie_crust:caramel -- these pairs have the same topping on both very dark and very light bases, making 3:1 mathematically impossible with a single color
- **Golden hash updates:** Only mint explosion hashes changed (4 tiers) due to andes color adjustment; other golden flavors unaffected
- **custard-tidbyt path:** Resolved via 3 levels up from test/ (test -> worker -> custard-calendar -> custard) rather than 4 levels in the plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed custard-tidbyt path resolution**
- **Found during:** Task 2 (palette-sync.test.js)
- **Issue:** Plan specified `../../../../custard-tidbyt/` (4 levels up) but correct path from worker/test/ is `../../../custard-tidbyt/` (3 levels up)
- **Fix:** Changed relative path in palette-sync.test.js to `../../../custard-tidbyt/apps/culversfotd/culvers_fotd.star`
- **Files modified:** worker/test/palette-sync.test.js
- **Verification:** All 16 palette-sync tests pass including custard-tidbyt checks
- **Committed in:** 6b00672

**2. [Rule 2 - Missing Critical] Added contrast exemptions for structurally impossible pairs**
- **Found during:** Task 3 (contrast-check.test.js)
- **Issue:** 30 topping/base pairs failed 3:1. Some pairs (dove on chocolate_custard, oreo on chocolate, etc.) are mathematically impossible because the same topping must work on both very dark and very light bases
- **Fix:** Adjusted 10 fixable topping colors; documented 7 structural exemptions with rationale
- **Files modified:** worker/src/flavor-colors.js, worker/test/contrast-check.test.js, 4 downstream sync files
- **Verification:** All 65 contrast tests pass; all 16 palette-sync tests pass
- **Committed in:** 4125ff6

**3. [Rule 1 - Bug] Updated golden hashes after topping color changes**
- **Found during:** Task 3 verification
- **Issue:** Mint explosion golden hashes stale after andes color adjustment (#1FAE7A -> #0A3726)
- **Fix:** Regenerated golden hashes via UPDATE_GOLDENS=1, updated 4 entries
- **Files modified:** worker/test/flavor-colors.test.js
- **Committed in:** 4125ff6

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- pixelmatch + pngjs installed and ready for Plan 02 visual regression tests
- Shared render-to-pixels.js utility ready for Plan 02 pixelmatch comparison
- All downstream color files in sync -- palette-sync gate will catch future drift
- Contrast checker active -- new profiles added in Phase 16 must meet 3:1 or use exemptions

---
*Phase: 14-validation-tooling*
*Completed: 2026-03-10*
