# Phase 3: Compare Page - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Store-by-day comparison grid so a family can compare flavors across their saved stores and upcoming days to decide where to go. Includes exclusion filters for dietary needs and rare flavor highlights.

Requirements: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08

</domain>

<decisions>
## Implementation Decisions

### Grid Layout
- Day-first card stack: each day is a card containing all stores stacked vertically. Scroll down through days (Today, Tomorrow, Day 3)
- 3 days ahead: Today + tomorrow + day after tomorrow
- Data source: saved stores from localStorage via CustardPlanner.getDrivePreferences().activeRoute.stores
- Max 4 stores shown; if user has more, show primary + 3 closest
- If user has only 1 store: show prompt "Add stores to compare flavors side-by-side" with link to store picker
- No horizontal scroll needed -- vertical card stack works naturally at 375px

### Cell Expand / Detail View
- Inline expand (accordion): tapping a store row expands it in place to show details, tap again to collapse
- One cell expanded at a time -- tapping a new cell collapses the previous one
- Expanded content: Claude's discretion on exact content based on available /api/v1/drive data (description, rarity info, directions link are the candidates per COMP-03)
- Directions link: Google Maps (google.com/maps/dir/?api=1&destination=ADDRESS) -- works on all platforms

### Exclusion Filter Chips
- Claude's discretion on which flavor families to offer as chips (dietary-relevant like No Nuts, No Mint, No Chocolate recommended, or broader set -- based on FLAVOR_FAMILIES in planner-shared.js)
- Filtered cells are dimmed (opacity reduction), not hidden -- preserves grid structure, no layout shifts
- Claude's discretion on chip placement (sticky vs static above grid)
- Filter state persists in localStorage (key like 'custard-exclusions') so users don't re-toggle every visit

### Rare Flavor Highlights
- Rarity badge inline: same pattern as Today page hero card -- small badge ('Rare' or 'Ultra Rare') next to flavor name with gap days
- Contextual nudge at top of page when any saved store has a rare/ultra-rare flavor today: "Ultra Rare: [Flavor] at [Store] -- only every N days!"
- Nudge shows for today's rare flavors only (not upcoming days)
- Nudge hidden when no rare flavors exist today

### Claude's Discretion
- Expanded cell content details (which fields from /api/v1/drive to show)
- Exclusion chip selection (which flavor families to offer)
- Chip placement (sticky vs static)
- Loading skeleton for the compare grid
- Error states (what if API fails for one store but not others?)
- Empty state visual treatment for 1-store users
- Whether the compare page gets its own IIFE module (compare-page.js) or is simpler inline
- Page header/title treatment

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planner-shared.js`: `getDrivePreferences()` returns activeRoute.stores; `FLAVOR_FAMILIES` for exclusion matching; `buildTimeline()` for day data; `escapeHtml()` for safe rendering; `BRAND_COLORS` for store branding
- `cone-renderer.js`: `renderMiniConeSVG()` for compact grid cones (same as multi-store row on Today page)
- `shared-nav.js`: SharedNav renders in `#shared-nav` div, dispatches `sharednav:storechange` events
- `/api/v1/drive?slugs=X,Y,Z`: Returns `cards[]` with flavor, description, rarity (avg_gap_days, label), tags, address, lat/lon -- all data needed for the grid
- `today-page.js`: Rarity badge rendering pattern (`renderRarity()`) can be referenced for consistency
- `map.html`: Brand filter chip pattern (`.brand-chip` CSS class) -- reference for exclusion chip styling

### Established Patterns
- IIFE Revealing Module: `window.CustardPlanner`, `window.CustardToday`, `window.SharedNav` -- new compare-page.js should follow
- No build step: vanilla JS, `var` throughout, script tags
- `sharednav:storechange` CustomEvent for cross-component store changes
- localStorage for preferences: 'custard-primary', 'custard-secondary' keys

### Integration Points
- `#shared-nav` div in header (SharedNav renders here)
- `planner-shared.js` loaded first (provides globals)
- `cone-renderer.js` loaded before page script
- `sw.js` STATIC_ASSETS must include compare-page.js (if created)
- CACHE_VERSION bump needed after changes

</code_context>

<specifics>
## Specific Ideas

- "A family in the car can instantly see what flavors are at their nearby stores and decide where to go" -- the compare grid answers "WHERE should we go?" while Today page answers "WHAT's the flavor?"
- The rarity nudge at the top is the hook: "Ultra Rare at Mt. Horeb today!" is the reason to check the Compare page
- Day-first layout reads like a timeline: "here's what's happening today across your stores, here's tomorrow, here's the day after"
- Dimming excluded cells instead of hiding keeps the grid structure stable and lets users see what they're filtering out

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-compare-page*
*Context gathered: 2026-03-07*
