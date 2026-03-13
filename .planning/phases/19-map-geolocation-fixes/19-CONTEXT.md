# Phase 19: Map Geolocation Fixes - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the map page so it accurately reflects the user's real-world position and shows relevant nearby stores. The map currently defaults to Wisconsin center and never uses GPS. This phase adds GPS-based centering, a "you are here" position dot, nearest store highlighting, and graceful fallback when geolocation is unavailable.

</domain>

<decisions>
## Implementation Decisions

### GPS Prompt Timing
- Auto-request GPS permission on page load (not just on button click)
- If GPS granted: center map on user's position, fit viewport to include nearest 3-5 stores
- Reverse-geocode GPS coords and populate the location text input with city/state
- Auto-trigger the nearby-flavors search immediately after GPS succeeds -- user sees stores and flavors without clicking anything

### "You Are Here" Dot
- Pulsing blue dot (Google Maps style): solid blue circle with translucent pulsing ring
- Must be visually distinct from cone-shaped store markers
- Live tracking via watchPosition -- dot moves as user moves (map does NOT auto-recenter, just dot moves)
- Geolocate button re-centers the map on user's current live position when clicked (even if user has panned away)

### Nearest Store Highlight
- Always highlight the nearest store regardless of distance (no threshold cutoff)
- Enlarged marker with brighter glow ring (builds on existing marker glow system)
- No auto-open popup -- just visual emphasis on the marker
- Highlight updates dynamically as user's position changes via live tracking
- Nearest store pinned to top of results list below the map with a "Nearest to you" badge

### Fallback Behavior
- If GPS denied: fall back to IP geolocation via existing /api/v1/geolocate endpoint, center map on approximate city
- If IP geolocation also fails: highlight the first Culver's (Sauk City) as the last-resort default
- No fallback indicator needed -- the absence of the blue "you are here" dot signals that GPS isn't active
- No banner or message about approximate location

### Claude's Discretion
- Whether to show GPS accuracy radius ring (translucent circle) around the position dot
- GPS vs saved-store priority when user navigates from another page with custard-primary set
- watchPosition options (accuracy, frequency, battery tradeoffs)
- Exact marker size increase for nearest store highlight
- Transition animations for marker highlight changes

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `map.html` line 149: Leaflet map already initialized with `L.map('map').setView([43.0, -89.5], 7)`
- `map.html` line 649-668: Geolocate button handler with `navigator.geolocation.getCurrentPosition` -- needs to be extracted into a shared GPS flow
- `map.html` line 670-681: `autoGeolocate()` function for IP-based fallback via `/api/v1/geolocate`
- `map.html` line 962-973: `initLocation()` runs on load but only fills the text input, doesn't center the map
- `CustardPlanner.haversineMiles` (line 217): Distance calculation already available for nearest-store detection
- `buildConeMarkerIcon()` (line 244-269): Custom Leaflet divIcon with state classes and glow -- extend for nearest-store variant

### Established Patterns
- Leaflet `L.divIcon` with CSS classes for marker styling (flavor-map-marker-wrap, state classes)
- `--marker-ring` and `--marker-glow` CSS custom properties on markers for dynamic colors
- `skipMoveHandler` flag to prevent re-search during programmatic map moves
- `window._allMarkers` array tracking all marker/store pairs for post-render operations (exclusion dimming)

### Integration Points
- `initLocation()` / `readUrlParams()` in the init block (lines 976-981): where GPS auto-request should be inserted
- `refreshResults()`: where nearest-store detection and marker sizing should happen after markers are placed
- `geolocateBtn` click handler: needs to re-center map on live position
- Results card rendering in `storeCard()`: where "Nearest to you" badge would be added

</code_context>

<specifics>
## Specific Ideas

- "Just highlight the first Culver's (Sauk City)" as the last-resort fallback when both GPS and IP geolocation fail
- The pulsing blue dot should be instantly recognizable as "your location" -- Google Maps users will expect this visual pattern
- Live tracking means the dot follows you if you're driving between stores -- the map stays still, just the dot moves

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 19-map-geolocation-fixes*
*Context gathered: 2026-03-12*
