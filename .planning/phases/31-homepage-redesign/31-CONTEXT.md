# Phase 31: Homepage Redesign - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the homepage (docs/index.html) around a single hero card showing today's flavor at the user's store, with clear information hierarchy that eliminates visual noise. The page must work at 375px, load without layout shift, and use the existing card system with design tokens.

</domain>

<decisions>
## Implementation Decisions

### Hero card content
- Keep side-by-side layout: 120px cone art left, text right (current proven pattern)
- Card includes: cone art, flavor name, description, rarity badge, certainty styling
- Add action CTAs directly on the card: Directions, Alert, Calendar (using existing `actionCTAsHTML()`)
- One card = full decision-making unit -- user can act without scrolling

### Above-the-fold priority
- Hero card is the ONLY content element above the fold at 375px
- Strip the "Custard Forecast" header and subtitle -- the card IS the forecast
- Nav bar with store indicator remains (SharedNav already handles this)
- No signals, no multi-store row, no decorative elements above the fold

### Below-the-fold sections
- **Remove signals section** -- serves power users who don't exist yet (near-zero traffic)
- **Remove multi-store glance** -- "comparing stores" use case belongs on Compare page
- **Keep week-ahead** (required by HOME-02) -- collapsed by default, expandable on tap via `<details>`
- **Simplify CTA** -- one line "Get daily alerts" with link, not a full card
- Order below fold: week-ahead, then CTA line

### First-visit experience
- Replace 3-step onboarding with minimal prompt: one sentence ("Pick your Culver's to see today's flavor") + store picker button
- Show 3-4 nearby stores via geolocation if available (reuse existing `renderQuickStartStores()` pattern)
- No instructions or guides -- the hero card explains itself once a store is selected
- Empty state should feel like an invitation, not a tutorial

### Claude's Discretion
- Loading skeleton design (must satisfy HOME-03 CLS < 0.1)
- Exact spacing and typography within design token constraints
- Error state handling
- Transition/animation when store is first selected and hero card appears

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Homepage
- `docs/index.html` -- Current homepage structure (the file being redesigned)
- `docs/js/today-page.js` -- Page lifecycle: loadStores, selectStore, loadForecast, renderHeroCard, renderWeekStrip
- `docs/js/planner-ui.js` -- actionCTAsHTML() for CTA buttons, telemetry, share button

### Card system and design tokens
- `docs/style.css` -- Design tokens (:root variables), .card system (.card--hero, .card--accent), .today-card layout
- `docs/js/planner-domain.js` -- certaintyTier(), certaintyBadgeHTML(), rarityLabelFromGapDays(), buildTimeline()

### Store selection
- `docs/js/shared-nav.js` -- Store picker, sharednav:storechange event, findNearestStore()
- `docs/js/planner-data.js` -- BRAND_COLORS, brandFromSlug(), store data utilities

### Cone rendering
- `docs/js/cone-renderer.js` -- renderHeroCone() for hero card, renderMiniConeSVG() for week strip

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `actionCTAsHTML()` in planner-ui.js: Renders Directions/Alert/Subscribe buttons -- wire directly into hero card
- `renderHeroCard()` in today-page.js: Current hero card renderer -- modify in place
- `renderWeekStrip()` in today-page.js: Week-ahead renderer -- keep as-is for below-fold section
- `renderQuickStartStores()` in today-page.js: Quick-start store buttons for empty state -- simplify
- `.card.card--hero.today-card` CSS class chain: Existing hero card styling with design tokens

### Established Patterns
- IIFE module pattern: All JS uses `window.CustardPlanner` namespace with sub-modules
- `sharednav:storechange` CustomEvent: Bridge between store picker and page rendering
- `localStorage.getItem('custard-primary')`: Synchronous guard for returning users (prevents flash)
- Design tokens: All colors, spacing, shadows, radii via CSS custom properties

### Integration Points
- Store selection triggers `loadForecast(slug)` which parallel-fetches /api/v1/flavors, /api/v1/forecast, /api/v1/today
- Hero card renders after forecast data arrives
- Week strip renders from `buildTimeline()` output
- Telemetry auto-bound via `.cta-link` delegation in planner-ui.js

</code_context>

<specifics>
## Specific Ideas

- "One screen, one answer" principle: the page answers "What's the flavor at my store today?"
- Everything secondary to that answer lives below the fold or is removed
- The hero card should be a complete decision-making unit -- see flavor, see rarity, take action (directions/alert/calendar) without scrolling

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 31-homepage-redesign*
*Context gathered: 2026-03-19*
