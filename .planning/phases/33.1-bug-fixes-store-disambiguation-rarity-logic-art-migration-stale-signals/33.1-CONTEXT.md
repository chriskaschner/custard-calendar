# Phase 33.1: Bug Fixes -- Store Disambiguation, Rarity Logic, Art Migration, Stale Signals - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 7 user-reported bugs across Compare, Today, Widget, and Worker surfaces. No new features -- correctness and consistency fixes only.

Bugs:
1. Ambiguous store names (multiple Madison stores all show "Madison")
2. Rarity banner flags common flavors as rare (Turtle, Caramel Pecan)
3. Rarity inconsistency between banner and row badges
4. Week Ahead cones still using L0 SVG instead of L5 hero PNGs
5. Insight card shows irrelevant DOW patterns ("peaks on Fridays" on Sunday)
6. Scriptable widget falling back to DrawContext icons instead of L5 PNGs
7. Double rare badges on Compare (banner + row badges)

</domain>

<decisions>
## Implementation Decisions

### Store name disambiguation
- Use slug-derived street name as primary identifier, city as secondary: "Mineral Point Rd - Madison, WI" (drop state if space-constrained)
- Only disambiguate when multiple stores share the same city -- single-store cities stay as-is ("Verona")
- Apply consistently across ALL surfaces: store chips, flavor rows (Compare), hero card footer (Today), near-me cards (Today), rarity banner text
- Source: slug field (Culver's upstream identifier), NOT address field -- slug is how Culver's names the store even if it doesn't match the street address (e.g., "todd-drive" slug for a store on Beltline Hwy)

### Rarity system overhaul (three-gate hybrid approach)
- **Gate 1 -- Data quality**: Minimum 10 flavor appearances spanning 90+ days at the store. Below threshold = no rarity label.
- **Gate 2 -- Network-wide**: If >100 stores served this flavor in the last 30 days, suppress rarity label entirely (kills false positives on Turtle, Caramel Pecan, etc.)
- **Gate 3 -- Higher thresholds**: Ultra Rare >150 day avg gap (was 120), Rare 90-150 days (was 60). Drop implicit "Uncommon" range.
- Seasonal flavors continue to be suppressed via existing seasonal detection
- Update both server-side (route-today.js) and client-side (planner-domain.js rarityLabelFromGapDays) thresholds

### Compare page rarity UX
- Remove the top-of-page rarity banner entirely (buildRarityNudge) -- redundant with row badges
- Keep inline "Rare" / "Ultra Rare" badges on individual flavor rows
- Keep detail text in accordion for curious users
- Result: single rarity signal per flavor, no duplication

### Insight card relevance
- Only show DOW pattern insight if the flavor in the insight IS today's flavor at the user's store
- Filter on the frontend: compare signal flavor against today's actual FOTD before rendering
- If today's flavor has no DOW signal, show nothing (don't fall back to other flavors)

### Week Ahead art migration
- Replace renderMiniConeSVG() with renderHeroCone() (same function used by hero card)
- CSS handles downscaling to appropriate size for week-ahead cards
- L5 PNG loads with automatic L0 SVG fallback on error -- consistent with rest of app

### Widget art fix
- Debug and fix why getConeImage() PNG loading fails at runtime (likely CDN URL, alias coverage, or network issue)
- ALSO improve the DrawContext fallback for offline/error cases so it looks more like cone art, less like map pins

### Claude's Discretion
- Exact CSS sizing for Week Ahead PNG cones (replacing current 27x30px SVG constraint)
- How to extract street name from slug (regex/split approach)
- Whether network-wide store count query needs caching for performance
- DrawContext fallback visual improvements (within cone-art aesthetic)
- How to handle edge case where slug has no meaningful street name

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Store data and display
- `docs/stores.json` -- Store manifest with slug, name, city, state, address fields (source of disambiguation data)
- `docs/compare-page.js` -- Store chip rendering (line 468: uses store.city), flavor row store label (line 745), rarity banner (lines 245-283), rarity badge (lines 235-239, 762-763)
- `docs/today-page.js` -- Hero card footer store name (line 370), near-me card store name (line 182), rarity display (lines 278-301)

### Rarity calculation
- `worker/src/route-today.js` -- Server-side rarity computation from D1 snapshots (lines 99-144)
- `docs/js/planner-domain.js` -- Client-side rarityLabelFromGapDays() (lines 83-97)
- `docs/planner-data.js` -- Seasonal flavor detection pattern (lines 19-24)
- `worker/src/flavor-stats.js` -- Network-wide flavor frequency queries (lines 65-210, pattern for cross-store count query)

### Insight signals
- `worker/src/signals.js` -- detectDowPatterns() DOW bias signal generation (lines 195-227), handleSignals() API handler (lines 470-551)
- `docs/js/planner-ui.js` -- fetchSignalsShared() frontend signal rendering (lines 364-379), signalCardHTML() (lines 289-306)

### Cone art pipeline
- `docs/cone-renderer.js` -- renderMiniConeSVG() L0 renderer (lines 250-317), heroConeSrc() PNG path (line 328), renderHeroCone() L5+fallback (lines 344-359)
- `docs/today-page.js` -- renderWeekStrip() Week Ahead rendering (lines 398-451, currently uses renderMiniConeSVG at line 421)
- `docs/style.css` -- .cone-sm SVG sizing (line 1755: 27x30px), .cone-lg hero sizing (lines 1744-1752)
- `docs/assets/cones/` -- 102 L5 hero PNG files

### Widget
- `widgets/custard-today.js` / `docs/assets/custard-today.js` -- getConeImage() (lines 145-157), drawConeIcon() fallback (lines 159-211), FLAVOR_ALIASES (lines 41-79), CONE_PNG_BASE URL (line 20)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderHeroCone(flavorName, container, fallbackScale)` in cone-renderer.js: Already handles L5 PNG loading with L0 SVG fallback. Reuse for Week Ahead.
- `heroConeSrc(flavorName)` in cone-renderer.js: Maps flavor name to PNG path. Reuse for any PNG URL generation.
- `stores.json` loaded by Compare page via `loadStores()` (line 166-178): Full manifest already available client-side.
- `flavor-stats.js` network-wide query pattern: `COUNT(DISTINCT slug) WHERE normalized_flavor = ? AND date >= date('now', '-30 days')` -- reuse for rarity gate 2.

### Established Patterns
- IIFE module pattern: All frontend JS uses `window.CustardPlanner` global namespace with IIFE sub-modules
- Store data keyed by slug throughout the app
- Rarity returned as `{ appearances, avg_gap_days, label }` object from API -- extend with `network_store_count` field
- Seasonal detection via regex pattern match on flavor name

### Integration Points
- `route-today.js` rarity computation: Add data quality + network-wide checks before labeling
- `compare-page.js` store display: Change `store.city` to disambiguation function at lines 468, 745
- `planner-ui.js` signal rendering: Add flavor filter before rendering insight cards
- `today-page.js` Week Ahead: Swap renderMiniConeSVG() for renderHeroCone() at line 421

</code_context>

<specifics>
## Specific Ideas

- User refers to stores by street name from slug: "Mineral Point Rd - Madison" not "Madison - Mineral Point Rd" (street first, city second)
- "Todd Dr" store is on Beltline Hwy but Culver's calls it Todd Drive in the slug -- use slug, not address
- "Only every 87 days!" copy damages trust when the flavor isn't actually rare -- measured language preferred
- Widget is one of the most-used surfaces for this user -- art quality matters

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 33.1-bug-fixes-store-disambiguation-rarity-logic-art-migration-stale-signals*
*Context gathered: 2026-03-22*
