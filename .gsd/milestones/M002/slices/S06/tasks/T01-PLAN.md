# T01: Store disambiguation + rarity system overhaul

**Slice:** S06 — **Milestone:** M002

## Description

Implement getDisplayName() utility using slug-derived street names for store disambiguation. Apply across all surfaces (Compare chips, hero card footer, near-me cards, flavor rows). Add three-gate rarity system: (1) minimum 10 appearances over 90+ days, (2) suppress if >100 stores served in last 30 days, (3) Ultra Rare >150 days, Rare 90-150 days. Remove Compare page rarity banner (buildRarityNudge). Filter DOW insight cards to only show for today's actual FOTD.

## Must-Haves

- [ ] "Store names disambiguated: multiple Madison stores show 'Mineral Point Rd - Madison' not just 'Madison'"
- [ ] "Single-store cities retain short name: 'Verona' not 'Some Rd - Verona'"
- [ ] "Rarity gate 1: flavors with <10 appearances or <90 day span get no rarity label"
- [ ] "Rarity gate 2: flavors served at >100 stores in last 30 days get no rarity label"
- [ ] "Rarity gate 3: Ultra Rare >150 day gap (was 120), Rare 90-150 days (was 60)"
- [ ] "Compare rarity banner (buildRarityNudge) removed entirely"
- [ ] "DOW insight card only shows when signal flavor matches today's FOTD"

## Files

- `docs/compare-page.js`
- `docs/today-page.js`
- `docs/planner-domain.js`
- `docs/planner-ui.js`
- `docs/style.css`
- `worker/src/route-today.js`
