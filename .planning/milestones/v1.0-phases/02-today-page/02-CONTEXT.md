# Phase 2: Today Page - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Radically simplify index.html to answer "what's the flavor?" above the fold at 375px. Remove clutter (Drive rankings, calendar preview, predictions, score badges). Add progressive disclosure: collapsed week-ahead, multi-store glance row, contextual signal, and a single CTA.

Requirements: TDAY-01, TDAY-02, TDAY-03, TDAY-04, TDAY-05, TDAY-06, TDAY-07

</domain>

<decisions>
## Implementation Decisions

### Hero Card Layout
- Cone left (~120px), text right: flavor name, description, rarity badge
- Rarity badge sits visually with the hero content (placement is Claude's discretion)
- No certainty/prediction badges -- if the data exists, it's confirmed from the source. No gap between "existing" and "confirmed"
- Remove the `today-predictions` div entirely
- Remove store name and freshness timestamp from the hero card above-fold area

### Page Structure Below Fold
- Order: hero card > flavor signal nudge > multi-store glance row > collapsed week-ahead > "Want this every day?" CTA
- Remove completely: Today's Drive section (HTML + script tag + CustardDrive.mount call), calendar preview section, score badges, predictions
- todays-drive.js stays in the repo (other pages may use it) but is no longer loaded on index.html

### CTA Strategy
- Replace the existing calendar CTA with a "Want this every day?" CTA linking to the future Get Updates page (Phase 4)
- Until Get Updates page exists, link to calendar.html as interim destination
- Claude's discretion on whether to keep both or just the new one

### JS Extraction
- Extract the ~1,050 lines of inline JS from index.html into a separate today-page.js file
- Follow the IIFE Revealing Module pattern (window.CustardToday or similar)
- index.html becomes mostly HTML with script tags

### Multi-Store Glance Row
- Each cell shows: mini cone (renderMiniConeSVG from cone-renderer.js) + flavor name + store city/name
- Horizontal scroll layout if stores overflow at 375px
- Tapping a store switches the hero card to that store's flavor and sets it as active store (fires sharednav:storechange)
- Data source: CustardPlanner preferences (activeRoute.stores from localStorage) -- same source Today's Drive used
- Only shown when user has 2+ saved stores

### Week-Ahead Section
- Convert existing week strip to a `<details>` element, collapsed by default
- Content stays the same (day cards with cone + flavor name)

### Flavor Signal
- One contextual signal shown inline when relevant (e.g., "peaks on Sundays")
- Existing signals-section HTML can be adapted
- Claude's discretion on visual treatment

### Claude's Discretion
- Rarity badge visual design and exact placement within hero card
- CTA visual treatment (card style, button style, etc.)
- Whether to keep calendar CTA alongside new "Want this every day?" CTA or replace entirely
- Flavor signal visual treatment
- Loading skeleton updates for the simplified page
- Error state updates
- Empty state updates (first-visit hero still needed)
- Animation/transition details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cone-renderer.js`: Has `renderMiniConeSVG` (small cones for multi-store row) and `renderMiniConeHDSVG` (larger cones for hero card). Loaded via script tag, sets globals.
- `planner-shared.js`: `CustardPlanner.getDrivePreferences()` returns `activeRoute.stores` array -- source for multi-store row. Also has `getPrimaryStoreSlug()`, `setPrimaryStoreSlug()`.
- `shared-nav.js`: Dispatches `sharednav:storechange` CustomEvent. Multi-store row taps should dispatch the same event.
- Existing `renderRarity()` function in index.html (lines 686-700) -- extract to today-page.js.
- Existing `loadForecast()` function fetches from `/api/v1/drive?stores={slug}` -- core data fetching logic to keep.

### Established Patterns
- IIFE Revealing Module: `window.CustardPlanner`, `window.CustardDrive`, `window.SharedNav` -- new today-page.js should follow
- No build step: vanilla JS, script tags, no bundler
- DOM refs at top of script, functions below, init() at bottom
- `sharednav:storechange` CustomEvent for cross-component store changes

### Integration Points
- `#shared-nav` div in header (SharedNav renders here)
- `planner-shared.js` loaded first (provides CustardPlanner globals)
- `cone-renderer.js` loaded before page script (provides cone rendering globals)
- `sw.js` STATIC_ASSETS must include new today-page.js
- CACHE_VERSION bump needed after changes

</code_context>

<specifics>
## Specific Ideas

- "A family in the car can instantly see what flavors are at their nearby stores and decide where to go" -- the hero card is the answer to that question
- Data is confirmed directly from Culver's site -- no prediction/certainty UI needed. If we have data, it's confirmed. Error state handles "no data."
- Design principle: "Start with the answer" -- cone + flavor name + description is the answer
- Multi-store row serves the "decide where to go" use case -- tap to switch and compare

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-today-page*
*Context gathered: 2026-03-07*
