# S06: Bug Fixes — Store Disambiguation, Rarity, Art, Signals — UAT

**Milestone:** M002
**Written:** 2026-03-22

## UAT Type

- UAT mode: mixed (artifact-driven for Worker API + test verification; live-runtime for frontend surfaces)
- Why this mode is sufficient: Worker-side changes (rarity gates, signals filtering) are fully covered by 40+ new unit tests. Frontend changes (disambiguation, cone art, widget) require visual/functional inspection on live pages.

## Preconditions

- `cd worker && npm test` passes (1034 passed, 0 failed)
- Worker deployed with three-gate rarity and DOW signal filter (or `npx wrangler dev` running locally)
- `docs/` pages served locally (e.g., `python -m http.server 8000` from docs/) or via custard.chriskaschner.com
- Store manifest (stores.json) accessible with ≥2 stores in the same city (e.g., Madison WI)

## Smoke Test

Run `cd worker && npm test` — expect 1034 passed, 4 skipped, 0 failed. This confirms all rarity gates, DOW filters, store display name parsing, and cache version assertions pass.

## Test Cases

### 1. Store disambiguation — Compare page chips

1. Open Compare page in browser
2. Add two Madison WI stores (e.g., Mineral Point Rd and Cottage Grove)
3. Inspect the store selection chips at the top of the grid
4. **Expected:** Chips show "Mineral Point Rd — Madison" and "Cottage Grove — Madison" (not just "Madison" for both)

### 2. Store disambiguation — single-store city

1. Open Compare page
2. Add a store from a single-store city (e.g., Verona)
3. Inspect the store selection chip
4. **Expected:** Chip shows "Verona" (no street qualifier needed)

### 3. Store disambiguation — Today hero meta

1. Open Today page with a store in a multi-store city selected
2. Check the store name in the hero card footer
3. **Expected:** Shows street-qualified name (e.g., "Mineral Point Rd — Madison")

### 4. Rarity Gate 1 — data quality rejection

1. `curl $WORKER/api/v1/today?slug=mt-horeb | jq .rarity`
2. Find a flavor with fewer than 10 historical appearances
3. **Expected:** `rarity.label` is `null`; `rarity.appearances` shows count < 10

### 5. Rarity Gate 2 — network-wide suppression

1. Query rarity for a flavor known to be served at >100 stores in the last 30 days (e.g., Turtle, Caramel Pecan on busy days)
2. **Expected:** `rarity.label` is `null` even if avg_gap_days would otherwise qualify for Rare

### 6. Rarity Gate 3 — tightened thresholds

1. Query a flavor with avg_gap_days between 60 and 89
2. **Expected:** `rarity.label` is `null` (old threshold was 60d; new threshold is 90d for Rare)

### 7. Rarity — legitimate rare flavor

1. Find a flavor with ≥10 appearances, ≥90-day span, ≤100 network stores, and avg_gap ≥90 days
2. `curl $WORKER/api/v1/today?slug=<store> | jq .rarity`
3. **Expected:** `rarity.label` is "Rare" (90–150d avg gap) or "Ultra Rare" (>150d avg gap)

### 8. Compare page — rarity banner removed

1. Open Compare page with stores selected
2. Inspect the page for any rarity summary banner above the grid
3. **Expected:** No rarity nudge banner visible (only per-row badges remain)

### 9. Compare page — no double rare badges

1. Open Compare page with a store serving a genuinely rare flavor
2. Check the flavor row for that day
3. **Expected:** At most one Rare/Ultra Rare badge per flavor cell (no duplicates)

### 10. DOW signal filter — FOTD match

1. `curl $WORKER/api/v1/signals/mt-horeb | jq '.signals[] | select(.type=="dow_pattern")'`
2. Check `.today` field for the date used
3. **Expected:** If dow_pattern signals are present, each signal's flavor matches today's confirmed FOTD. If today's FOTD doesn't match any DOW pattern flavor, no dow_pattern signals appear.

### 11. DOW signal filter — non-DOW passthrough

1. `curl $WORKER/api/v1/signals/mt-horeb | jq '.signals[] | select(.type!="dow_pattern")'`
2. **Expected:** Non-DOW signals (e.g., streak, gap, seasonal) are unaffected and still returned normally

### 12. Week Ahead — L5 PNG cones

1. Open Today page for a store with week-ahead data
2. Expand or view the week-ahead strip
3. Inspect `.week-day-cone` elements
4. **Expected:** Each cone shows an `<img class="hero-cone-img">` at 40px width (L5 PNG). For flavors without a PNG mapping, an L0 SVG fallback renders at ~27×30px via renderHeroCone's onerror handler.

### 13. Widget — getConeImage diagnostic logging

1. Open `widgets/custard-today.js` or `docs/assets/custard-today.js`
2. Search for `getConeImage`
3. **Expected:** Catch block contains `console.log("[custard] getConeImage failed for '" + flavorName + "': " + ...)`. Variable is `coneSlug` (not `slug`).

### 14. Service worker cache version

1. `grep CACHE_VERSION docs/sw.js`
2. **Expected:** `custard-v23`

### 15. Widget files in sync

1. `diff widgets/custard-today.js docs/assets/custard-today.js`
2. **Expected:** No differences (files are byte-identical)

## Edge Cases

### Store with no slug street segment

1. Query `getDisplayName()` for a store whose slug is just a city name (e.g., `verona`)
2. **Expected:** Returns bare city name without street qualifier or error

### Rarity with zero D1 data

1. Query `/api/v1/today?slug=<store>` for a store or flavor with no D1 historical snapshots
2. **Expected:** `rarity` field is absent or null — no crash, no false badge

### DOW signals with null todayFlavor

1. Query `/api/v1/signals/<slug>` when today's FOTD is not yet confirmed (no D1 snapshot for today)
2. **Expected:** All DOW pattern signals are suppressed (safe default). Non-DOW signals unaffected.

### Week Ahead card with no flavor data

1. View week-ahead strip with a day showing "no data" (unconfirmed future day)
2. **Expected:** No cone placeholder rendered for that day. No JS error in console.

## Failure Signals

- Compare page shows "Madison" for both Madison stores → `getDisplayName()` not loaded or not called
- Turtle/Caramel Pecan shows Rare badge → Gate 2 or Gate 3 not applied (check D1 availability, network count query)
- DOW signals appear for flavors that aren't today's FOTD → todayFlavor not matching in computeSignals
- Week Ahead shows old L0 SVG inline (not an `<img>` element) → renderHeroCone not called, post-append pattern broken
- Widget errors on getConeImage with undefined variable → coneSlug rename not applied
- Tests expect custard-v21 or v22 → sw.js cache version not bumped to v23

## Not Proven By This UAT

- Live production deployment of rarity gate changes (tested against Worker test suite + local dev only)
- Actual user perception improvement of rarity accuracy (requires real-world monitoring over time)
- Mobile rendering of 40px hero-cone-img in week-ahead strip at 375px viewport (CSS verified, visual spot-check recommended)
- Scriptable widget runtime behavior on actual iOS device (diagnostic logging verified in source code)

## Notes for Tester

- The rarity gates are best tested with `curl` against a running Worker instance. The unit tests cover all edge cases comprehensively, so manual API testing is confirmatory.
- Store disambiguation is most obvious with Madison WI (5 stores). Other multi-store cities include Milwaukee (4+), Chicago area stores.
- The pre-existing `sw.js` cache version test failure that existed before S06 is now fixed — the test expects v23 and sw.js serves v23.
- Widget testing requires Scriptable on iOS or reading the source code for the diagnostic log addition — there's no automated test for the widget runtime.
