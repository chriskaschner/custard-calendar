# Phase 1: Foundation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Shared navigation component rendered by JS across all pages, persistent store indicator in the header, and service worker update discipline. Every page gets the same nav bar and store indicator. No page content changes -- just the shared chrome.

Requirements: STOR-01, STOR-02, STOR-03, STOR-04, STOR-05

</domain>

<decisions>
## Implementation Decisions

### Store Indicator Appearance
- Claude's discretion on visual treatment (text badge vs mini cone + text)
- Claude's discretion on multi-store display (primary only vs count badge)
- Must fit at 375px width without overflow
- Must include a "change" link/tap target

### Geolocation Flow
- Show IP-based result first (existing IP geolocation), then offer "use precise location" to refine
- Do NOT prompt for browser geolocation permission immediately on load
- If geolocation denied or unavailable: Claude's discretion on fallback (show picker, show popular stores, etc.)
- First visit must show a confirmation prompt: "Showing flavors for [store] -- change?"

### Store Change UX
- Claude's discretion on the change interaction (inline expand, modal, etc.)
- Store search must use type-ahead search with live filtering (current approach works)
- The full 1,000+ store picker only appears when user actively taps "change"
- Store picker is hidden by default on all pages

### Nav Rendering
- JS-rendered from a shared-nav.js IIFE module (not duplicated HTML)
- One file controls nav for all 14+ pages
- Claude's discretion on nav visual style (bottom tab bar vs top bar)
- During Phase 1, nav still shows current/legacy items -- Phase 4 activates the 4-item nav
- Store indicator lives inside the shared nav component

### Service Worker
- sw.js must be updated when pages change to prevent stale content
- CACHE_VERSION must be bumped on every deployment that changes HTML/JS/CSS
- Research flagged this as the #1 deployment risk

### Claude's Discretion
- Store indicator visual design details
- Nav visual style (top bar vs bottom tab bar)
- Multi-store indicator treatment
- Geolocation denial fallback
- Store change interaction pattern (inline/modal/drawer)
- Animation/transition details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planner-shared.js` (1,624 lines): Contains `CustardPlanner` IIFE with store preference management, geolocation, localStorage read/write. Store indicator will extend this.
- `docs/sw.js`: Existing service worker with `STATIC_ASSETS` list and `CACHE_VERSION`. Needs version bump discipline.
- Existing store picker: Search/filter logic exists in planner-shared.js, renders a dropdown with state filtering.

### Established Patterns
- IIFE Revealing Module pattern: `window.CustardPlanner = (function() { ... })()` -- new shared-nav.js should follow this
- localStorage key: `custard:v1:preferences` for store persistence
- URL param override: `?stores=mt-horeb,verona` takes precedence over localStorage
- No build step -- all JS files loaded via script tags in HTML

### Integration Points
- Every `docs/*.html` file has its own nav HTML block -- shared-nav.js replaces these
- `planner-shared.js` loaded on every page -- store indicator can hook into its store state
- `sw.js` STATIC_ASSETS array must include any new JS files

</code_context>

<specifics>
## Specific Ideas

- Research recommended shared-nav.js as IIFE on window globals, following existing CustardPlanner/CustardDrive pattern
- Research flagged planner-shared.js as untested 1,624-line monolith -- add targeted tests for functions being modified
- IP-based geolocation already works; browser Geolocation API is the missing piece for "use precise location" refinement

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-07*
