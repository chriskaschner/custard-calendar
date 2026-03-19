---
phase: 29-scriptable-widget-unification
verified: 2026-03-19T19:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 29: Scriptable Widget Unification Verification Report

**Phase Goal:** The Scriptable widget uses the shared art pipeline (L5 PNG online, L0 SVG-aligned fallback offline) instead of its own independent drawConeIcon renderer
**Verified:** 2026-03-19T19:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                              | Status     | Evidence                                                                                             |
|----|---------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------|
| 1  | Widget displays L5 AI PNG cone when device is online                                              | VERIFIED   | `getConeImage()` calls `new Request(CONE_PNG_BASE + "/" + slug + ".png").loadImage()` (lines 145-157)|
| 2  | Widget falls back to color-aligned drawConeIcon when offline or PNG fetch fails                   | VERIFIED   | `catch` block in `getConeImage` calls `return drawConeIcon(flavorName, size)` (line 156)            |
| 3  | Offline fallback uses the canonical 23-entry BASE_COLORS palette, not drifted FLAVOR_SCOOP_COLORS | VERIFIED   | `BASE_COLORS` has 23 entries (lines 82-106); `FLAVOR_SCOOP_COLORS` has 0 matches in either file     |
| 4  | Both docs/assets/custard-today.js and widgets/custard-today.js are byte-identical after changes   | VERIFIED   | `diff docs/assets/custard-today.js widgets/custard-today.js` produces no output                     |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                         | Expected                                              | Status     | Details                                                                            |
|----------------------------------|-------------------------------------------------------|------------|------------------------------------------------------------------------------------|
| `docs/assets/custard-today.js`   | Scriptable widget with L5 PNG online + L0 fallback    | VERIFIED   | 561 lines, substantive; contains CONE_PNG_BASE, BASE_COLORS, FLAVOR_ALIASES, getConeImage |
| `widgets/custard-today.js`       | Byte-identical sync copy                              | VERIFIED   | Confirmed identical to docs/assets version via diff                                |

### Key Link Verification

| From                           | To                                                    | Via                                  | Status     | Details                                                                               |
|--------------------------------|-------------------------------------------------------|--------------------------------------|------------|---------------------------------------------------------------------------------------|
| `docs/assets/custard-today.js` | `https://custard.chriskaschner.com/assets/cones/{slug}.png` | `new Request(url).loadImage()` in `getConeImage()` | WIRED | Line 20: `CONE_PNG_BASE` declared; line 149: used in URL construction; line 150: `new Request(url).loadImage()` is the correct Scriptable API |
| `docs/assets/custard-today.js` | `drawConeIcon()`                                      | `catch` block in `getConeImage()`    | WIRED      | Lines 152-156: catch block with `return drawConeIcon(flavorName, size)` as offline fallback |

### getConeImage Call Site Coverage

The plan acceptance criterion stated "4 matches (declaration + 3 call sites)" but the implementation achieves full coverage with 3 textual matches via delegation:

| Call site         | Pattern                                       | Covers widget size        |
|-------------------|-----------------------------------------------|---------------------------|
| Line 145          | `async function getConeImage(...)` (declaration) | —                      |
| Line 260          | `await getConeImage(row.flavor, 28)` in `addMediumRow()` | medium + multi-store (both delegate through addMediumRow) |
| Line 353          | `await getConeImage(data.flavor, 36)` in `buildSmall()` | small                 |

All three widget display paths (small, medium 3-day, medium multi-store) route through `getConeImage`. The implementation correctly funnels buildMedium and buildMultiStore through `await addMediumRow()` at lines 452 and 516, which itself calls `getConeImage`. There are no direct `drawConeIcon` calls in any display path — `drawConeIcon` is only reachable via the catch fallback inside `getConeImage`.

### Requirements Coverage

| Requirement | Source Plan   | Description                                                              | Status    | Evidence                                                                                |
|-------------|---------------|--------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------|
| INT-03      | 29-01-PLAN.md | Scriptable widget uses shared art pipeline (L0 or L5 PNG) instead of its own drawConeIcon renderer | SATISFIED | getConeImage() wires widget to L5 PNG CDN; drawConeIcon retained as L0-aligned fallback; REQUIREMENTS.md marks INT-03 complete for Phase 29 |

No orphaned requirements: REQUIREMENTS.md maps only INT-03 to Phase 29 (Traceability table, line 61). The plan claims only INT-03. Coverage is complete.

### Anti-Patterns Found

None. No TODO, FIXME, placeholder, or empty implementations found in either widget file.

### Human Verification Required

The following cannot be verified programmatically:

#### 1. Online PNG rendering on a real iOS device

**Test:** Install `docs/assets/custard-today.js` in Scriptable on an iOS device with network access. Add a small widget and a medium widget to the home screen.
**Expected:** Cone icons display as AI-generated PNG art (not the waffle-cone DrawContext shape).
**Why human:** Scriptable's `Request.loadImage()` behavior against the live CDN and actual rendering on device cannot be simulated statically.

#### 2. Offline fallback rendering

**Test:** Enable Airplane Mode on the device, then view the widget (or force a refresh from within Scriptable).
**Expected:** Cone icons display using the DrawContext waffle-cone shape with the correct flavor color from BASE_COLORS (not a blank or error state).
**Why human:** Network failure path requires real Scriptable runtime.

#### 3. Alias slug resolution for variant flavor names

**Test:** Configure a store that historically shows "Reese's Peanut Butter Cup" or "Vanilla Custard" as the Flavor of the Day. View the widget.
**Expected:** The PNG fetched uses the canonical slug (e.g., `really-reese-s.png` or `vanilla.png`), not the raw variant form.
**Why human:** Requires a specific live flavor to exercise the alias map at runtime.

### Gaps Summary

No gaps. All four observable truths verified. Both artifacts are substantive and wired. INT-03 is fully satisfied. The phase goal — migrating the Scriptable widget to the shared L0/L5 art pipeline — is achieved.

---

_Verified: 2026-03-19T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
