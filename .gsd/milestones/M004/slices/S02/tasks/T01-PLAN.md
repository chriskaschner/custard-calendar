---
estimated_steps: 5
estimated_files: 2
skills_used:
  - test
---

# T01: Align rarityLabel() thresholds and add consistency test

**Slice:** S02 — Rarity Threshold Unification
**Milestone:** M004

## Description

The `rarityLabel()` function in `worker/src/social-card.js` uses divergent rarity thresholds (`> 120` for Ultra Rare, `> 60` for Rare) compared to `route-today.js` and `planner-domain.js` (both use `> 150` / `> 90`). This causes the same flavor to show different rarity labels on OG cards vs. the homepage. Fix the two threshold values, export the function for testing, and add a new test file that pins boundary values to prevent future drift.

## Steps

1. **Edit thresholds in `rarityLabel()`** — In `worker/src/social-card.js`, find the `rarityLabel` function (around line 305). Change `if (days > 120) return 'Ultra Rare';` to `if (days > 150) return 'Ultra Rare';` and `if (days > 60) return 'Rare';` to `if (days > 90) return 'Rare';`. Also update the comment block above the function (around lines 295–303) to say the thresholds are 150/90, not 120/60.

2. **Export `rarityLabel`** — The function is currently module-private. Add it to the module's exports so it can be tested directly. The file uses `export async function handleSocialCard(...)` as its only export. Add `export { rarityLabel };` at the end of the file (after the closing brace of the last function), or convert the function declaration to `export function rarityLabel(...)`. The `export { rarityLabel }` append is simpler and less invasive.

3. **Create consistency test** — Create `worker/test/rarity-threshold-consistency.test.js`. Import `rarityLabel` from `../src/social-card.js`. Write boundary-value assertions:
   - `rarityLabel(151)` → `'Ultra Rare'`
   - `rarityLabel(150)` → `'Rare'` (150 is NOT > 150)
   - `rarityLabel(149)` → `'Rare'`
   - `rarityLabel(91)` → `'Rare'`
   - `rarityLabel(90)` → `null` (90 is NOT > 90)
   - `rarityLabel(89)` → `null`
   - `rarityLabel(200)` → `'Ultra Rare'`
   - `rarityLabel(0)` → `null`
   - `rarityLabel(null)` → `null`
   - `rarityLabel(1)` → `null` (< 2 guard)
   
   Also add a meta-test that documents the expected agreement: the thresholds in this file match `route-today.js` (>150 Ultra Rare, >90 Rare) and `planner-domain.js` (same). Use a comment — do NOT try to import from `planner-domain.js` (it's an IIFE, not an ES module) or `route-today.js` (inline logic, not a function).

4. **Run full test suite** — Execute `cd worker && npm test` and confirm all tests pass (existing + new).

5. **Verify with grep** — Run `rg ">150|>90" worker/src/social-card.js` to confirm new thresholds are present. Run `rg ">120|>60" worker/src/social-card.js` to confirm old thresholds are gone.

## Must-Haves

- [ ] `rarityLabel()` in `social-card.js` uses `> 150` for Ultra Rare and `> 90` for Rare
- [ ] `rarityLabel` is exported from `social-card.js`
- [ ] `worker/test/rarity-threshold-consistency.test.js` exists with boundary value tests
- [ ] All Worker tests pass (`cd worker && npm test`)
- [ ] `rg ">120|>60" worker/src/social-card.js` returns zero matches

## Verification

- `cd worker && npm test` — all tests pass including the new consistency test
- `rg ">150" worker/src/social-card.js` — returns at least one match
- `rg ">120" worker/src/social-card.js` — returns zero matches
- `rg "Ultra Rare" worker/src/route-today.js worker/src/social-card.js docs/planner-domain.js` — returns matches in all three files

## Inputs

- `worker/src/social-card.js` — contains `rarityLabel()` with wrong thresholds (>120/>60) at ~line 307-308
- `worker/src/route-today.js` — reference for correct thresholds (>150/>90) at ~line 147-148
- `docs/planner-domain.js` — reference for correct thresholds (>150/>90) at ~line 94-95

## Expected Output

- `worker/src/social-card.js` — modified: thresholds updated to >150/>90, `rarityLabel` exported
- `worker/test/rarity-threshold-consistency.test.js` — new: boundary value test asserting threshold consistency
