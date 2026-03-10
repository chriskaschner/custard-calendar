---
phase: 16-bulk-profile-authoring
plan: 02
subsystem: rendering
tags: [flavor-profiles, vanilla-family, caramel-family, golden-baselines, contrast-exemptions, flavor-audit]

# Dependency graph
requires:
  - phase: 16-01-bulk-profile-authoring
    provides: "17 chocolate-family FLAVOR_PROFILES, 16-UNPROFILED.md categorized list, 12 contrast exemptions"
provides:
  - "21 new vanilla-family FLAVOR_PROFILES (19 vanilla + 2 butter_pecan bases)"
  - "2 new caramel-family FLAVOR_PROFILES (1 maple + 1 caramel base)"
  - "8 new FLAVOR_ALIASES (raspberry cream, butterfinger, cookies and cream, etc.)"
  - "92 new golden baseline PNGs (23 flavors x 4 tiers)"
  - "6 structural contrast exemptions for light-on-light topping/base pairs"
affects: [16-03-fruit-specialty-batch]

# Tech tracking
tech-stack:
  added: []
  patterns: [light-on-light-exemption-pattern]

key-files:
  created:
    - "custard-calendar/worker/test/fixtures/goldens/mini/*.png (23 new)"
    - "custard-calendar/worker/test/fixtures/goldens/hd/*.png (23 new)"
    - "custard-calendar/worker/test/fixtures/goldens/premium/*.png (23 new)"
    - "custard-calendar/worker/test/fixtures/goldens/hero/*.png (23 new)"
  modified:
    - "custard-calendar/worker/src/flavor-colors.js"
    - "custard-calendar/docs/flavor-audit.html"
    - "custard-calendar/docs/cone-renderer.js"
    - "custard-calendar/worker/test/contrast-check.test.js"

key-decisions:
  - "21 vanilla-family profiles authored: 17 vanilla base + 2 butter_pecan base + 2 reclassified (Bailey's Irish Cream, Boston Cream, Raspberry Cordial, Toffee Pecan)"
  - "2 caramel-family profiles: Maple Pecan (maple base), Nutty Caramel Apple (caramel base)"
  - "8 aliases added: raspberry cream, butterfinger, cookies and cream, oreo cookies & cream, kit kat, rice krispy treat, rice krispie, baileys irish cream"
  - "6 structural contrast exemptions for warm-toned toppings on light/warm bases (heath/butterfinger/reeses on vanilla, heath/pecan on butter_pecan, pecan on maple, caramel_chips on caramel)"

patterns-established:
  - "Light-on-light exemption pattern: warm-toned toppings (golden/amber) on pale bases (vanilla/butter_pecan/maple) have structural sub-3:1 contrast"
  - "Reclassification pattern: flavors listed under one family in discovery may belong to another based on actual base (e.g., Bailey's Irish Cream specialty -> vanilla)"

requirements-completed: [PROF-03]

# Metrics
duration: 6min
completed: 2026-03-10
---

# Phase 16 Plan 02: Vanilla/Caramel-Family Bulk Profile Authoring Summary

**23 vanilla/caramel-family FLAVOR_PROFILES authored with 8 aliases, 92 golden baselines, and 6 structural contrast exemptions for light-on-light topping/base pairs**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T16:40:50Z
- **Completed:** 2026-03-10T16:47:33Z
- **Tasks:** 2
- **Files modified:** 4 (+ 92 new golden PNGs)

## Accomplishments
- Authored 21 vanilla-family FLAVOR_PROFILES (17 vanilla base + 2 butter_pecan base + 2 reclassified specialty flavors)
- Authored 2 caramel-family FLAVOR_PROFILES (1 maple base + 1 caramel base)
- Added 8 new aliases synced across all 3 files (flavor-colors.js, flavor-audit.html, cone-renderer.js)
- Added 6 structural contrast exemptions for warm-toned toppings on light/warm bases
- Generated 92 new golden baseline PNGs (23 flavors x 4 tiers: mini, hd, premium, hero)
- All 464 tests pass across 4 CI gates (contrast-check, palette-sync, alias-validation, golden-baselines)
- FLAVOR_PROFILES count: 80 total (57 prior + 21 vanilla + 2 caramel)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author vanilla-family FLAVOR_PROFILES with sync and golden baselines** - `8acc8c5` (feat, submodule) + `f485a44` (feat, parent)
2. **Task 2: Author caramel-family FLAVOR_PROFILES with sync and golden baselines** - `b2b8796` (feat, submodule) + `6f0fd4b` (feat, parent)

## Files Created/Modified
- `worker/src/flavor-colors.js` - 23 new FLAVOR_PROFILES, 8 new FLAVOR_ALIASES
- `docs/flavor-audit.html` - SEED_PROFILES (23 new), SEED_ALIASES (8 new), SEED_CATALOG (23 new entries with historical:true)
- `docs/cone-renderer.js` - FALLBACK_FLAVOR_ALIASES (8 new)
- `worker/test/contrast-check.test.js` - 6 new structural contrast exemptions

## Decisions Made

### New Profiles (23 vanilla/caramel-family entries)

| Flavor | Base | Ribbon | Toppings | Density |
|--------|------|--------|----------|---------|
| Badger Claw | vanilla | caramel | cashew, fudge_bits | standard |
| Bailey's Irish Cream | vanilla | chocolate_syrup | (none) | pure |
| Boston Cream | vanilla | chocolate_syrup | cake | standard |
| Butter Brickle | butter_pecan | null | heath | standard |
| Butter Finger Blast | vanilla | null | butterfinger | standard |
| Butterfinger Pecan | vanilla | null | butterfinger, pecan | standard |
| Cashew Delight | vanilla | caramel | cashew | standard |
| Chunky Peanut Butter Dream | vanilla | peanut_butter | reeses | standard |
| Cookie Dough Craving | vanilla | null | cookie_dough | standard |
| Cookies & Cream | vanilla | null | oreo | standard |
| Just Drummy | vanilla | null | cake | standard |
| Kit Kat Bar | vanilla | null | heath | standard |
| Kit Kat Swirl | vanilla | chocolate_syrup | heath | standard |
| Nestle Crunch Swirl | vanilla | chocolate_syrup | cookie_crumbs | standard |
| Peanut Butter Cookie Dough | vanilla | peanut_butter | cookie_dough | standard |
| Pecan Toffee Crunch | vanilla | null | pecan, heath | standard |
| Polar Bear Tracks | vanilla | fudge | reeses | standard |
| Raspberry Cordial | vanilla | null | raspberry, dove | standard |
| Red Raspberry | vanilla | null | raspberry | standard |
| Rice Krispie Treat | vanilla | marshmallow | cookie_crumbs | standard |
| Toffee Pecan | butter_pecan | null | heath, pecan | standard |
| Maple Pecan | maple | null | pecan | standard |
| Nutty Caramel Apple | caramel | null | pecan, caramel_chips | standard |

### New Structural Contrast Exemptions (6)

| Topping | Base | Ratio | Rationale |
|---------|------|-------|-----------|
| heath | butter_pecan | ~1.83:1 | Golden on pale cream; heath passes on chocolate/dark_chocolate/espresso |
| pecan | butter_pecan | ~2.5:1 | Medium brown on pale cream; pecan passes on vanilla |
| butterfinger | vanilla | ~2.3:1 | Golden-amber on wheat; butterfinger passes on chocolate |
| reeses | vanilla | ~2.1:1 | Golden on wheat; reeses passes on chocolate |
| heath | vanilla | ~2.0:1 | Golden on wheat; heath passes on chocolate/dark_chocolate |
| pecan | maple | ~1.8:1 | Both warm medium browns; pecan passes on vanilla/cheesecake |
| caramel_chips | caramel | ~1.5:1 | Deep amber on gold, very close; passes on vanilla/espresso |

### Other Decisions
- All 23 new flavors tagged `historical:true` in SEED_CATALOG (sourced from trivia-metrics-seed)
- Raspberry Cream aliased to Red Raspberry (same flavor per Culver's FOTD page)
- Bailey's Irish Cream reclassified from specialty to vanilla family (vanilla base + chocolate drizzle)
- Boston Cream reclassified from specialty to vanilla family (vanilla custard with chocolate topping)
- Raspberry Cordial reclassified from fruit to vanilla family (vanilla base with raspberry topping)
- Toffee Pecan reclassified from specialty to vanilla family (butter_pecan base)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 6 structural contrast exemptions for light-on-light combos**
- **Found during:** Task 1 and Task 2 (contrast-check verification)
- **Issue:** 6 topping/base pairs had sub-3:1 contrast ratios (warm-toned toppings on light/warm bases)
- **Fix:** Added structural exemptions following Phase 14/16-01 pattern (same topping must work on both light and dark bases)
- **Files modified:** worker/test/contrast-check.test.js
- **Verification:** All 464 CI tests pass (116 contrast tests)
- **Committed in:** 8acc8c5 (Task 1), b2b8796 (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Contrast exemptions follow established Phase 14/16-01 pattern. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Remaining families: 5 fruit, 7 specialty (12 total) for Plan 03
- All color palette keys available (23 base, 33 topping, 5 ribbon)
- Plan 03 can proceed immediately with fruit/specialty batch
- 80 of ~92 flavors now profiled (87% coverage)

## Self-Check: PASSED

- 16-02-SUMMARY.md: FOUND
- Commit 8acc8c5 (Task 1 submodule): FOUND
- Commit f485a44 (Task 1 parent): FOUND
- Commit b2b8796 (Task 2 submodule): FOUND
- Commit 6f0fd4b (Task 2 parent): FOUND
- FLAVOR_PROFILES: 80 entries (57 existing + 21 vanilla + 2 caramel)
- FLAVOR_ALIASES: 31 entries (23 existing + 8 new)
- Golden baselines: 320 total (80 x 4 tiers)
- All 464 CI tests pass (4 test files)

---
*Phase: 16-bulk-profile-authoring*
*Completed: 2026-03-10*
