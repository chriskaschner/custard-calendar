---
phase: 18-store-selection-fixes
verified: 2026-03-12T00:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 18: Store Selection Fixes Verification Report

**Phase Goal:** Users who already have a geolocated store see correct initial state on Today and Compare pages
**Verified:** 2026-03-12
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

Success criteria from ROADMAP.md mapped to truths, plus must_haves from PLANs:

| #  | Truth                                                                                                | Status     | Evidence                                                                      |
|----|------------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------|
| 1  | User with a previously selected store sees flavor card immediately on Today page -- no banner flash  | VERIFIED   | init() reads localStorage synchronously before any async work (line 632)     |
| 2  | First-time visitor (no localStorage) still sees onboarding banner                                   | VERIFIED   | else-if branch at line 661 shows emptyState when no savedSlug and no current  |
| 3  | User arriving on Compare with geolocated store sees only that single store's schedule                | VERIFIED   | loadAndRender() gate changed to `=== 0` (line 835); getSavedStoreSlugs fallback to custard-primary (lines 141-143) |
| 4  | User can add additional stores on Compare page after single-store initial load                       | VERIFIED   | compare-add-hint button in renderGrid() at line 800 opens showCompareStorePicker() |
| 5  | Invalid saved store slug clears localStorage and shows onboarding                                   | VERIFIED   | localStorage.removeItem('custard-primary') at line 654, then emptyState shown |
| 6  | IP geolocation alone does NOT auto-hide onboarding banner                                            | VERIFIED   | Test 4 in today-onboarding.spec.mjs covers this; init() only checks custard-primary, not geolocate endpoint result |
| 7  | Compare grid for 1 store shows add-more hint per day card                                            | VERIFIED   | compare-add-hint div appended in renderGrid() when _stores.length === 1 (lines 794-807) |
| 8  | Store picker allows saving with 1+ stores (minimum lowered from 2 to 1)                             | VERIFIED   | MIN_COMPARE_STORES = 1 (line 31); doneBtn.disabled = selected.length < 1 (line 614) |
| 9  | User can remove all stores from Compare page and sees empty state                                    | VERIFIED   | loadAndRender() shows 'empty' state when _stores.length === 0 (line 835)      |
| 10 | Primary/geolocated store auto-inherited in Compare when custard:compare:stores is empty              | VERIFIED   | getSavedStoreSlugs() fallback path returns [primary] (lines 141-143)          |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact                                                                              | Expected                                          | Status     | Details                                   |
|---------------------------------------------------------------------------------------|---------------------------------------------------|------------|-------------------------------------------|
| `custard-calendar/docs/today-page.js`                                                | Today page init with no-flash returning user logic | VERIFIED   | 690 lines; contains synchronous localStorage check at line 632 |
| `custard-calendar/worker/test/browser/today-onboarding.spec.mjs`                    | Browser tests for onboarding banner visibility    | VERIFIED   | 312 lines (min 50 required); 4 test cases |
| `custard-calendar/docs/compare-page.js`                                              | Compare page with 1-store minimum support         | VERIFIED   | 946 lines; contains MIN_COMPARE_STORES at line 31 |
| `custard-calendar/worker/test/browser/compare-single-store.spec.mjs`                | Browser tests for single-store Compare behavior   | VERIFIED   | 271 lines (min 80 required); 6 test cases |

### Key Link Verification

| From                                                    | To                   | Via                                                           | Status     | Details                                                      |
|---------------------------------------------------------|----------------------|---------------------------------------------------------------|------------|--------------------------------------------------------------|
| `custard-calendar/docs/today-page.js`                   | localStorage         | init() reads custard-primary before showing any DOM state     | WIRED      | `localStorage.getItem('custard-primary')` at line 632, synchronously before Promise.all |
| `custard-calendar/docs/today-page.js`                   | `_allStores`         | validates saved slug against manifest                         | WIRED      | `_allStores.find(function(s){return s.slug===savedSlug})` at line 649 |
| `custard-calendar/docs/compare-page.js`                 | localStorage         | getSavedStoreSlugs reads custard:compare:stores then falls back to custard-primary | WIRED | getSavedStoreSlugs() at lines 130-147; fallback at 141-143 |
| `custard-calendar/docs/compare-page.js`                 | compare grid DOM     | renderGrid builds day cards with store rows                   | WIRED      | renderGrid() called at line 864 from loadAndRender(); hint injected at lines 794-808 |

### Requirements Coverage

| Requirement | Source Plan | Description                                                              | Status    | Evidence                                                                  |
|-------------|-------------|--------------------------------------------------------------------------|-----------|---------------------------------------------------------------------------|
| STOR-01     | 18-01-PLAN  | Today page hides onboarding banner when a store is already selected      | SATISFIED | Synchronous localStorage check in init() prevents banner from ever showing; localStorage.removeItem clears invalid slugs; 4 browser tests cover all cases |
| STOR-02     | 18-02-PLAN  | Compare page initializes with only the single geolocated store           | SATISFIED | MIN_COMPARE_STORES=1, loadAndRender gate changed to `=== 0`, getSavedStoreSlugs fallback, add-more hint; 6 browser tests cover all cases |

No orphaned requirements -- REQUIREMENTS.md assigns STOR-01 and STOR-02 to Phase 18, both accounted for by plans 18-01 and 18-02 respectively.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `custard-calendar/docs/today-page.js` | 132, 136, 211, 270, 273, 276, 490 | `return null` / `return []` | INFO | All in error-handling or bounds-guard branches of network calls -- not stubs. No impact on goal. |
| `custard-calendar/docs/compare-page.js` | 553 | `placeholder` attribute | INFO | HTML input placeholder attribute for search field text -- not a code stub. |

No blockers or warnings found.

### Human Verification Required

The following behaviors can only be fully confirmed by a person loading the page in a browser:

#### 1. No-flash visual test (Today page)

**Test:** Open today.html in a browser with `custard-primary=mt-horeb` already in localStorage. Watch the initial render.
**Expected:** The hero card section appears (with a loading skeleton) and the onboarding banner is never visible at any point -- not even for a single frame.
**Why human:** MutationObserver-based tests catch re-shows after init(), but cannot catch a flash that occurs entirely within the first paint frame before JavaScript runs.

#### 2. Add-more hint visual appearance (Compare page)

**Test:** Open compare.html with `custard:compare:stores=["mt-horeb"]` in localStorage. Inspect each day card.
**Expected:** A dashed-border placeholder with "Add another store to compare flavors side by side" text and a "+ Add store" button appears at the bottom of each day card.
**Why human:** Inline styles are applied programmatically; visual confirmation that the hint renders correctly and is readable alongside flavor rows requires a human eye.

### Gaps Summary

No gaps. All truths verified, all artifacts substantive and wired, all requirements satisfied.

---

## Verification Details

### Commit Verification

All commits claimed in SUMMARY.md were confirmed to exist in the custard-calendar submodule:
- `0dd0168` -- test(18-01): add browser tests for onboarding banner visibility
- `347ccf8` -- feat(18-01): fix today-page init to prevent onboarding banner flash
- `991de1e` -- test(18-02): add browser tests for single-store Compare page
- `16c99d2` -- feat(18-02): implement single-store Compare page support

Superproject submodule update commits also present:
- `2b9ff1e` -- chore(18-01): update custard-calendar submodule for onboarding fix
- `9d7712f` -- chore(18-02): update custard-calendar submodule for single-store Compare

### Test Count

- today-onboarding.spec.mjs: 4 tests (returning user, first-time visitor, invalid slug, IP geo only)
- compare-single-store.spec.mjs: 6 tests (single store grid, add-more hint, auto-inherit, zero stores, add-store button, 2+ stores regression)

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_
