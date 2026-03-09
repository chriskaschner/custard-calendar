# Phase 12: Feature Development - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can filter the map by flavor family, see image-based quiz answers on mobile, and compare flavors across multiple stores side-by-side. Requirements: MAP-01, MAP-02, QUIZ-01, CMPR-01.

</domain>

<decisions>
## Implementation Decisions

### Map exclusion chip behavior
- Toggle-to-exclude UX matching Compare page's existing "No Mint" pattern
- Multiple families can be excluded simultaneously (multi-toggle, not radio)
- Replaces current single-select positive filter behavior on map
- Brand filter chips and family exclusion chips use AND logic (both apply together)

### Map exclusion chip visuals
- Same chip design as Compare page exclusion chips (shared CSS classes, colors, toggle behavior)
- Same set of flavor families shown on both Map and Compare pages

### Map exclusion persistence
- Filter state persists across page loads via localStorage (MAP-02)
- Separate localStorage key from Compare exclusions (different user intents)

### Map filtered marker display
- Claude's Discretion: whether excluded markers are fully hidden or dimmed
- Claude's Discretion: whether chips show affected marker counts

### Quiz image answer options
- 2x2 grid layout on mobile (375px width) with image above label
- Generic themed SVG icons for non-flavor questions (sun, popcorn, etc. from sprite system)
- For flavor-specific questions, use cone SVGs or sprite icons at larger scale

### Quiz image scope
- Claude's Discretion: whether image grid is mobile-only (below 840px breakpoint) or all screen sizes
- Claude's Discretion: whether to use larger cone SVGs, sprite icons, or a mix based on quiz content

### Compare multi-store
- Verify existing multi-store picker + day-first card stack works for side-by-side comparison
- Fix bugs only if verification reveals issues -- don't rebuild what already works
- Always refactor localStorage to separate compare key regardless of visual bug status

### Compare localStorage isolation
- Compare page gets its own localStorage key (separate from custard:v1:preferences)
- Clean start -- no migration of existing selections from old key
- Today page drive preferences remain untouched (no leaking)

### Plan structure
- Three independent plans executing in parallel: map filters, quiz images, compare fix
- No shared code changes or dependencies between the three features

### Claude's Discretion
- localStorage key naming convention (page-prefixed vs namespaced)
- Map filtered marker treatment (hidden vs dimmed)
- Map chip count display
- Quiz image breakpoint threshold
- Quiz image source (cone SVG vs sprites vs mix)
- Compare multi-store bug fix specifics (depends on verification findings)

</decisions>

<specifics>
## Specific Ideas

- Map exclusion chips should match Compare page's "No [Family]" pattern for consistent UX
- Quiz 2x2 grid is the typical mobile quiz pattern -- image above label in each cell
- Compare selections are ephemeral data, not precious -- clean start on new key is fine

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/map.html` lines 66-78: Existing `flavor-family-chips` HTML div (needs behavior change from positive to exclusion)
- `docs/map.html` lines 173-296: Existing `FLAVOR_FAMILIES` filtering JS (storeMatchesFamily, applyFamilyFilter)
- `docs/compare-page.js` lines 47-54, 423-455: Compare exclusion chip pattern to replicate on map
- `docs/quizzes/sprites.js`: QuizSprites.resolve() for themed SVG icons
- `docs/cone-renderer.js`: renderMiniConeSVG() for flavor cone visuals
- `docs/compare-page.js` lines 528-706: Full multi-store picker modal (already built)
- `docs/planner-data.js` lines 134-144: FLAVOR_FAMILIES constant with colors and members

### Established Patterns
- Exclusion toggle: Set-based add/delete with CSS class toggling (.selected/.active)
- localStorage persistence: JSON.stringify/parse with try/catch
- Chip styling: design tokens (--brand, --border-input, --radius-full, --space-2)
- IIFE sub-module pattern: Object.assign(window.CustardPlanner, {...})
- Quiz option rendering: engine.js buildQuestionUI() with type-specific layouts

### Integration Points
- `docs/map.html`: Convert existing family chip JS from positive filter to exclusion filter
- `docs/map.html`: Add localStorage read/write for exclusion state
- `docs/quizzes/engine.js`: Modify multiple_choice rendering for image grid on mobile
- `docs/quiz.html`: Add CSS for 2x2 image grid layout at mobile breakpoint
- `docs/compare-page.js`: Replace custard:v1:preferences usage with new dedicated key
- `docs/style.css`: Shared exclusion chip CSS if not already reusable from Compare

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 12-feature-development*
*Context gathered: 2026-03-09*
