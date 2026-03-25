# S02: Rarity Threshold Unification

**Goal:** Rarity labels (Ultra Rare / Rare) are mechanically identical across all three source files — `route-today.js`, `social-card.js`, and `planner-domain.js` — with a test preventing future drift.
**Demo:** `rg ">150|>90" worker/src/route-today.js worker/src/social-card.js docs/planner-domain.js` shows consistent thresholds. A flavor at 130 days gap shows "Rare" everywhere, not "Ultra Rare" on OG cards and "Rare" on the homepage.

## Must-Haves

- `rarityLabel()` in `social-card.js` uses `> 150` (Ultra Rare) and `> 90` (Rare) — matching the other two files
- `rarityLabel` is exported from `social-card.js` for direct unit testing
- New test file `worker/test/rarity-threshold-consistency.test.js` asserts boundary value consistency
- All existing Worker tests pass with no regressions

## Verification

- `cd worker && npm test` — all tests pass (existing + new consistency test)
- `rg ">150" worker/src/route-today.js worker/src/social-card.js docs/planner-domain.js` — matches in all three files
- `rg ">90" worker/src/route-today.js worker/src/social-card.js docs/planner-domain.js` — matches in all three files
- `rg ">120|>60" worker/src/social-card.js` — zero matches (old thresholds removed)

## Tasks

- [ ] **T01: Align rarityLabel() thresholds and add consistency test** `est:20m`
  - Why: `social-card.js` uses 120/60 thresholds while the other two files use 150/90. This causes a flavor at 130 days to show "Ultra Rare" on OG cards but "Rare" on the homepage. The fix is two threshold edits, one export addition, and one new test file.
  - Files: `worker/src/social-card.js`, `worker/test/rarity-threshold-consistency.test.js`
  - Do: (1) Edit `rarityLabel()` in `social-card.js`: change `> 120` → `> 150` and `> 60` → `> 90`. (2) Update the comment block above the function to reflect the new values. (3) Add `export { rarityLabel }` alongside the existing `handleSocialCard` export. (4) Create `worker/test/rarity-threshold-consistency.test.js` that imports `rarityLabel` and asserts boundary values: 149→null, 150→null, 151→Ultra Rare, 89→null, 90→null, 91→Rare, 200→Ultra Rare, 0→null. (5) Run `cd worker && npm test` to confirm all tests pass.
  - Verify: `cd worker && npm test` passes; `rg ">120|>60" worker/src/social-card.js` returns no matches; `rg ">150" worker/src/social-card.js` returns a match.
  - Done when: All Worker tests pass and `rarityLabel(130)` returns `null` (not "Ultra Rare"), matching the behavior of the other two files.

## Files Likely Touched

- `worker/src/social-card.js`
- `worker/test/rarity-threshold-consistency.test.js`
