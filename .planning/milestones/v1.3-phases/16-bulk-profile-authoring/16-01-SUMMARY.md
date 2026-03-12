---
phase: 16-bulk-profile-authoring
plan: 01
subsystem: rendering
tags: [flavor-profiles, chocolate-family, golden-baselines, contrast-exemptions, flavor-audit]

# Dependency graph
requires:
  - phase: 15-palette-expansion-aliases
    provides: "23 BASE_COLORS, 33 TOPPING_COLORS, 20 FLAVOR_ALIASES across all sync files"
provides:
  - "17 new chocolate-family FLAVOR_PROFILES (chocolate/dark_chocolate/espresso bases)"
  - "3 new FLAVOR_ALIASES (choc m&m, bonfire smores, s'mores)"
  - "68 new golden baseline PNGs (17 flavors x 4 tiers)"
  - "16-UNPROFILED.md with categorized list of 54 unprofiled flavors for subsequent plans"
  - "12 structural contrast exemptions for dark-on-dark topping/base combos"
affects: [16-02-vanilla-caramel-batch, 16-03-fruit-specialty-batch]

# Tech tracking
tech-stack:
  added: []
  patterns: [bulk-profile-authoring-workflow, historical-flavor-tagging, dark-on-dark-exemption-pattern]

key-files:
  created:
    - ".planning/phases/16-bulk-profile-authoring/16-UNPROFILED.md"
    - "custard-calendar/worker/test/fixtures/goldens/mini/*.png (17 new)"
    - "custard-calendar/worker/test/fixtures/goldens/hd/*.png (17 new)"
    - "custard-calendar/worker/test/fixtures/goldens/premium/*.png (17 new)"
    - "custard-calendar/worker/test/fixtures/goldens/hero/*.png (17 new)"
  modified:
    - "custard-calendar/worker/src/flavor-colors.js"
    - "custard-calendar/docs/flavor-audit.html"
    - "custard-calendar/docs/cone-renderer.js"
    - "custard-calendar/worker/test/contrast-check.test.js"

key-decisions:
  - "17 chocolate-family profiles authored from trivia-metrics-seed historical data and Culver's FOTD page"
  - "12 structural contrast exemptions for dark toppings on dark bases (chocolate, dark_chocolate, espresso)"
  - "All historical/multi-brand flavors tagged with historical:true in SEED_CATALOG"
  - "Tiramisu classified as espresso-family (not specialty) based on coffee custard base"
  - "Bonfire S'mores classified as chocolate-family (chocolate base with marshmallow)"

patterns-established:
  - "Bulk profile authoring: discover -> categorize -> author -> sync -> verify -> golden pattern"
  - "Dark-on-dark exemption pattern: document ratio but don't enforce when same topping needed on both light and dark bases"
  - "Historical flavor tagging in SEED_CATALOG: historical:true flag for retired/multi-brand flavors"

requirements-completed: [PROF-03]

# Metrics
duration: 9min
completed: 2026-03-10
---

# Phase 16 Plan 01: Chocolate-Family Bulk Profile Authoring Summary

**54 unprofiled flavors discovered and categorized; 17 chocolate-family FLAVOR_PROFILES authored with 68 golden baselines and 12 structural contrast exemptions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-10T16:27:57Z
- **Completed:** 2026-03-10T16:37:04Z
- **Tasks:** 2
- **Files modified:** 5 (+ 68 new golden PNGs)

## Accomplishments
- Discovered 54 unprofiled flavors across all data sources (SEED_CATALOG, KNOWN_FLAVORS_FALLBACK, SIMILARITY_GROUPS, live API, Culver's FOTD page, trivia-metrics-seed.js)
- Categorized into 5 families: 18 chocolate, 21 vanilla, 2 caramel, 7 fruit, 7 specialty
- Authored 17 chocolate-family FLAVOR_PROFILES (10 chocolate + 3 dark_chocolate + 4 espresso)
- Added 3 new aliases (choc m&m, bonfire smores, s'mores) synced across all files
- Added 12 structural contrast exemptions for dark-on-dark topping/base combinations
- Generated 68 new golden baseline PNGs (17 flavors x 4 tiers: mini, hd, premium, hero)
- All 344 tests pass across 4 CI gates (contrast-check, palette-sync, alias-validation, golden-baselines)

## Task Commits

Each task was committed atomically:

1. **Task 1: Discover all unprofiled flavors and categorize by family** - `5e295c8` (feat)
2. **Task 2: Author chocolate-family FLAVOR_PROFILES with sync and golden baselines** - `b8ee492` (feat, parent) + `9e15e30` (feat, submodule)

## Files Created/Modified
- `.planning/phases/16-bulk-profile-authoring/16-UNPROFILED.md` - Categorized list of 54 unprofiled flavors by family with suggested bases
- `worker/src/flavor-colors.js` - 17 new FLAVOR_PROFILES, 3 new FLAVOR_ALIASES
- `docs/flavor-audit.html` - SEED_PROFILES (17 new), SEED_ALIASES (3 new), SEED_CATALOG (17 new entries with historical:true)
- `docs/cone-renderer.js` - FALLBACK_FLAVOR_ALIASES (3 new)
- `worker/test/contrast-check.test.js` - 12 new structural contrast exemptions

## Decisions Made

### New Profiles (17 chocolate-family entries)

| Flavor | Base | Ribbon | Toppings | Density |
|--------|------|--------|----------|---------|
| Bonfire S'mores | chocolate | marshmallow | graham_cracker | standard |
| Brownie Batter Overload | chocolate | null | brownie | overload |
| Brownie Explosion | chocolate | marshmallow | brownie, brownie, dove | explosion |
| Cappuccino Almond Fudge | espresso | fudge | cashew | standard |
| Cappuccino Cookie Crumble | espresso | null | cookie_crumbs | standard |
| Death by Chocolate | dark_chocolate | chocolate_syrup | brownie, dove | explosion |
| Double Marshmallow Oreo | chocolate | marshmallow | oreo | double |
| M&M Cookie Dough | chocolate | null | m_and_m, cookie_dough | standard |
| M&M Swirl | chocolate | null | m_and_m | standard |
| Midnight Toffee | dark_chocolate | null | heath | standard |
| Mooey Gooey Twist | chocolate | caramel | cookie_dough | standard |
| Mudd Pie | espresso | fudge | oreo, cookie_crumbs | standard |
| PB Brownie | chocolate | peanut_butter | brownie | standard |
| Rocky Road | chocolate | marshmallow | cashew, chocolate_chip | standard |
| Tiramisu | espresso | marshmallow | cake, dove | standard |
| Triple Chocolate Kiss | dark_chocolate | chocolate_syrup | dove | standard |
| Twix Mix | chocolate | caramel | cookie_crumbs | standard |

### New Structural Contrast Exemptions (12)

| Topping | Base | Rationale |
|---------|------|-----------|
| graham_cracker | chocolate | Both medium-dark browns; graham_cracker passes on cheesecake/banana |
| cookie_crumbs | chocolate | Both medium browns; cookie_crumbs passes on vanilla/banana |
| cashew | chocolate | Medium browns, close luminance; cashew passes on vanilla |
| chocolate_chip | chocolate | Both very dark browns; chocolate_chip passes on vanilla/banana/coconut |
| cookie_dough | chocolate | Medium browns; cookie_dough passes on vanilla |
| cake | espresso | Both extremely dark; cake passes on lemon |
| dove | espresso | Both extremely dark browns; dove passes on many lighter bases |
| cookie_crumbs | espresso | Medium-dark on very dark; passes on vanilla/banana |
| dove | dark_chocolate | Both extremely dark; documented in edge cases |
| oreo | espresso | Near-black on very dark brown; oreo passes on mint/cheesecake/lemon |
| cashew | espresso | Medium on very dark; passes on vanilla |
| heath | dark_chocolate | Golden on very dark; passes on chocolate |

### Other Decisions
- Tiramisu classified as espresso-family (coffee custard base), not specialty
- Bonfire S'mores classified as chocolate-family (chocolate base with marshmallow ribbon)
- All 17 new flavors tagged `historical:true` in SEED_CATALOG (sourced from trivia-metrics-seed)
- "Raspberry Cream" discovered as alternate name for "Red Raspberry" on Culver's site

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added structural contrast exemptions for dark-on-dark combos**
- **Found during:** Task 2 (contrast-check verification)
- **Issue:** 12 topping/base pairs had sub-3:1 contrast ratios (dark toppings on dark bases)
- **Fix:** Added structural exemptions per Phase 14 pattern (same topping must work on both light and dark bases)
- **Files modified:** worker/test/contrast-check.test.js
- **Verification:** All 88 contrast tests pass
- **Committed in:** 9e15e30 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Contrast exemptions follow established Phase 14 pattern. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 16-UNPROFILED.md provides definitive categorized list for Plans 02 and 03
- Remaining families: 21 vanilla, 2 caramel, 7 fruit, 7 specialty (37 total)
- Plan 02 can proceed immediately with vanilla/caramel batch
- Plan 03 handles fruit/specialty batch
- All color palette keys available (23 base, 33 topping, 5 ribbon)

## Self-Check: PASSED

- 16-01-SUMMARY.md: FOUND
- 16-UNPROFILED.md: FOUND
- Commit 5e295c8 (Task 1): FOUND
- Commit b8ee492 (Task 2 parent): FOUND
- Commit 9e15e30 (Task 2 submodule): FOUND
- FLAVOR_PROFILES: 57 entries (40 existing + 17 new)
- FLAVOR_ALIASES: 23 entries (20 existing + 3 new)
- Golden baselines: 228 total (57 x 4 tiers)
- All 344 CI tests pass (4 test files)

---
*Phase: 16-bulk-profile-authoring*
*Completed: 2026-03-10*
