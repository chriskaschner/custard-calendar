# Phase 18: Store Selection Fixes - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix how Today and Compare pages react to a user who already has a geolocated store. Users with a previously selected store should see correct initial state immediately -- no onboarding banner on Today, and only their single store on Compare (not 4 nearby stores). First-time visitors should still see the onboarding flow.

</domain>

<decisions>
## Implementation Decisions

### Compare Page Minimum Stores
- Lower the minimum from 2 stores to 1 store
- When only 1 store is present, render the same day-column grid with a blank/placeholder slot suggesting the user can add more stores for comparison
- Keep current store picker modal -- just allow saving with 1+ stores instead of requiring 2+
- Claude's discretion on max store count and picker UX adjustments for 1-store flow

### Store State Synchronization
- Auto-inherit: when `custard:compare:stores` is empty and `custard-primary` is set, Compare auto-uses the primary store
- Always sync primary: the primary/geolocated store always appears first in Compare list, even if user has manually added other stores
- Primary store is removable from Compare -- user can remove any store including the inherited one
- Claude's discretion on sync direction (one-way vs bidirectional)

### Onboarding Banner Logic (Today Page)
- Banner hides only after user explicitly confirms ("Looks good" or picks a store) -- IP geolocation alone does not hide it
- Returning users (store in localStorage) see the hero card section structure immediately -- never flash the onboarding banner
- If saved store slug is no longer valid (not in manifest), clear the invalid slug and fall back to onboarding as if first visit
- No reset/re-trigger flow needed for this fix -- existing store picker is sufficient for changing stores

### Claude's Discretion
- Compare page empty state behavior (when user removes all stores)
- Loading skeleton and transition design
- Compare page max store count

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `today-page.js`: Already checks `localStorage['custard-primary']` and has empty-state / hero-card DOM toggling
- `compare-page.js`: Has store picker modal with checkbox list, grid rendering for 2+ stores
- `shared-nav.js`: IP geolocation flow with `showFirstVisitPrompt()` and `selectStore()`
- `planner-domain.js`: `getPrimaryStoreSlug()` / `setPrimaryStoreSlug()` for localStorage management

### Established Patterns
- Two parallel storage layers: legacy (`custard-primary`) and modern (`custard:v1:preferences`) with backward-compat sync
- Compare uses separate key `custard:compare:stores` (array of slugs)
- SharedNav dispatches `sharednav:storechange` custom event when store changes
- Store manifest cached in sessionStorage for fast cross-page lookups

### Integration Points
- `today-page.js` init() function: where banner vs card decision happens
- `compare-page.js` getSavedStoreSlugs(): where minimum store count is enforced
- `shared-nav.js` showFirstVisitPrompt(): where geolocation confirmation triggers store save
- `sharednav:storechange` event listener on Compare page: where cross-page store updates arrive

</code_context>

<specifics>
## Specific Ideas

- Compare page with 1 store should hint at the comparison capability -- show a blank placeholder area encouraging the user to add another store
- Returning users should never see a flash of the onboarding banner -- the card section should render immediately (with data loading skeleton if needed)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 18-store-selection-fixes*
*Context gathered: 2026-03-12*
