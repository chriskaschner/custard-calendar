# S06: Bug Fixes — Store Disambiguation, Rarity Logic, Art Migration, Stale Signals

**Goal:** Fix 7 user-reported bugs across Compare, Today, Widget, and Worker surfaces. No new features — correctness and consistency fixes only.
**Demo:** Disambiguated store names, tightened rarity thresholds suppress false-positive rare badges, Week Ahead shows L5 PNGs, irrelevant DOW insights hidden, widget loads cone PNGs.

## Must-Haves

- Ambiguous store names disambiguated across all surfaces (Compare chips, hero card, near-me cards)
- Rarity three-gate system: data quality + network-wide + higher thresholds (no false positives on Turtle/Caramel Pecan)
- Compare page rarity banner removed (row badges only)
- Week Ahead cones upgraded from L0 SVG to L5 hero PNGs
- Insight card only shows DOW patterns for today's actual FOTD
- Scriptable widget loads L5 PNGs (fix getConeImage failure)
- Double rare badges on Compare eliminated

## Observability / Diagnostics

**Runtime signals added in S06:**

- `rarity.label` in `/api/v1/today` response now reflects 3-gate logic. Field is always present when D1 data exists; `label` is `null` when any gate rejects the flavor. Inspect via `curl $WORKER/api/v1/today?slug=mt-horeb | jq .rarity`.
- `rarity.appearances` < 10 or span_days < 90 → gate 1 reject (label=null)
- `rarity.label` null despite large gap → gate 2 triggered (network served >100 stores in last 30d). No field surfaced for gate 2 yet; confirm via D1 snapshot count query.
- DOW signal suppression: `/api/v1/signals/{slug}` now filters `dow_pattern` signals. If DOW signals are missing unexpectedly, check `todayFlavor` in the signals handler. The `today` field in the response shows the date used.
- Store disambiguation: inspect `getDisplayName()` output by opening Compare page with 2+ Madison stores and verifying chips show "Mineral Point Rd — Madison" not just "Madison".

**Failure state inspection:**
- If rarity is always null despite long-serving flavors: check D1 availability (`env.DB`), confirm `appearances >= 10`, check network count is ≤100.
- If compare store chips show raw city instead of disambiguated name: `CustardPlanner.getDisplayName` not yet loaded (check script order in compare.html).
- If DOW signals appear for non-FOTD flavors: `todayFlavor` in `computeSignals` is not matching today's D1 snapshot.

## Tasks

- [x] **T01: Store disambiguation + rarity system overhaul**
  - Implement getDisplayName() utility from slug, apply to all surfaces. Add three-gate rarity system (data quality, network-wide, higher thresholds). Remove Compare rarity banner. Filter insight cards by today's FOTD.

- [x] **T02: Week Ahead art migration + widget fix**
  - Replace renderMiniConeSVG() with renderHeroCone() in week-ahead strip. Debug and fix getConeImage() in Scriptable widget. Improve DrawContext fallback.

## Files Likely Touched

- `docs/compare-page.js`
- `docs/today-page.js`
- `docs/planner-domain.js`
- `docs/planner-ui.js`
- `docs/cone-renderer.js`
- `docs/style.css`
- `worker/src/route-today.js`
- `widgets/custard-today.js`
- `docs/assets/custard-today.js`

## Verification

- `npm test` in `worker/` passes (all tests green except pre-existing sw.js cache version mismatch)
- `worker/test/route-today-rarity.test.js` — 12 new tests, all green
- `worker/test/signals-dow-filter.test.js` — 6 new tests, all green
- `worker/test/store-display-name.test.js` — 32 new tests, all green
- Compare page chips for multi-store cities show street-qualified names
- `/api/v1/today?slug=mt-horeb` rarity.label null for flavors with <10 appearances or <90-day span
- Turtle/Caramel Pecan no longer show Rare badge when served at >100 stores
- DOW signals omitted from `/api/v1/signals/{slug}` response when pattern flavor != today's FOTD
