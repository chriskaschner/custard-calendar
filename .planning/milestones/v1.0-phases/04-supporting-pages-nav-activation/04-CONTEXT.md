# Phase 4: Supporting Pages + Nav Activation - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fun page and Get Updates page are live, and users see exactly 4 clear nav items (Today, Compare, Map, Fun) on every page. Old pages (quiz, group, forecast-map, calendar, alerts, siri, widget, radar, scoop) remain accessible by direct URL but are not linked from nav and are considered legacy -- not invested in further. Redirects are v2 scope.

Requirements: FUN-01, FUN-02, FUN-03, FUN-04, FUN-05, UPDT-01, UPDT-02, UPDT-03, UPDT-04, UPDT-05, NAV-01, NAV-02, NAV-03, NAV-04

</domain>

<decisions>
## Implementation Decisions

### Fun Page Structure
- New fun.html page (not a restructured quiz.html)
- 4 sections in order: Quiz Mode Cards, Mad Libs, Group Vote, Fronts
- Quiz mode cards and Mad Libs are distinct sections -- Mad Libs is not grouped with quiz modes because it's a creative fill-in activity, not a personality/trivia quiz
- Group Vote and Fronts are link-out cards (description + button navigating to group.html and forecast-map.html respectively)
- No functionality duplication from existing pages -- fun.html is a launcher/hub

### Quiz Mode Cards
- Text cards with mode name and 1-line description (no images or icons needed)
- Tapping a card navigates to quiz.html?mode=X with the mode pre-selected
- quiz.html must read ?mode query param and skip the dropdown, starting the quiz directly
- Modes shown as cards: Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility (6 cards -- Mad Libs excluded, has its own section)

### Mad Libs Word Selection UI
- Tappable chips for the 3 pre-populated word choices per blank
- Inline text input field next to chips for write-in option
- Mobile-friendly: tap a chip to fill the blank, or type a custom word

### Get Updates Page
- New updates.html page with stacked sections (not tabs or accordion)
- Section order: Calendar, Flavor Alerts, Widget, Siri
- Each section has a heading, brief description, and setup action
- Store auto-filled from header store indicator (UPDT-04)
- "Add more stores" link goes to calendar.html for full multi-store picker
- Accessible via shared footer link on every page + "Want this every day?" CTAs on Today/Compare
- Not in the 4-item primary nav (NAV-03)

### Inline Alert Signup
- Simplified form on Get Updates page: email input + store auto-filled from header + popular flavor chips
- Submit stays on page (no redirect)
- Full alerts.html still exists for power users who want the complete store/flavor picker flow

### Nav Consolidation
- 4 items: Today (index.html), Compare (compare.html), Map (map.html), Fun (fun.html)
- Functional word labels per NAV-02 -- no weather metaphor names
- Active-state highlighting for the current page (bold/underline/color treatment)
- Shared footer rendered by shared-nav.js with "Get Updates" and "Privacy" links
- Old 11-item nav replaced entirely in shared-nav.js NAV_ITEMS array

### Old Pages Policy
- Old pages (quiz.html, group.html, forecast-map.html, calendar.html, alerts.html, siri.html, widget.html, radar.html, scoop.html) stay live -- no 404s
- Not linked from nav, not invested in further
- Fun.html and updates.html link to relevant old pages where needed (quiz.html for quiz modes, group.html for voting, etc.)
- Old pages are considered legacy and will eventually be replaced/redirected (v2 RDIR requirements)

### Claude's Discretion
- Fun page visual design and card styling
- Whether Mad Libs launches inline on fun.html or navigates to quiz.html?mode=mad-libs (pick what's cleanest)
- Whether old pages get a "this page has moved" banner or just stay as-is (RDIR is v2 but lightweight banners could be added if trivial)
- Widget and Siri section content/instructions on updates.html
- Footer visual treatment and placement
- Loading states and error handling for all new pages
- fun.html IIFE module design (fun-page.js or inline)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared-nav.js`: NAV_ITEMS array at line 23-35 -- swap from 11 items to 4. getCurrentPage() already handles active-state detection. Add footer rendering.
- `quiz.html` + `quizzes/engine.js`: Full quiz engine with 7 mode JSONs. Needs ?mode param support to skip dropdown and auto-start.
- `quizzes/sprites.js`: Quiz visual assets already available.
- `group.html`: Complete Group Vote page with KV-backed sessions, QR join -- link to it from fun.html.
- `forecast-map.html`: Complete Fronts page -- link to it from fun.html.
- `calendar.html`: Full multi-store calendar subscription flow -- link from updates.html "Add more stores".
- `alerts.html`: Full alert signup flow (store picker, flavor search, email form) -- reference for simplified inline form.
- `siri.html`, `widget.html`: Setup instruction pages -- reference for updates.html sections.
- `planner-shared.js`: getPrimaryStoreSlug() for auto-filling store on updates.html. Alert API endpoints for inline signup.
- `cone-renderer.js`: Available if fun.html needs cone visuals on cards.

### Established Patterns
- IIFE Revealing Module: window.CustardPlanner, window.CustardToday, window.SharedNav -- new pages should follow
- No build step: vanilla JS, var throughout, script tags
- sharednav:storechange CustomEvent for cross-component store changes
- .brand-chip CSS class on map.html -- reference for filter/selection chip styling

### Integration Points
- shared-nav.js NAV_ITEMS array: swap to 4 items + add footer rendering
- shared-nav.js loaded on all pages via `<div id="shared-nav"></div>` + script tag
- sw.js STATIC_ASSETS: must include fun.html, updates.html, and any new JS files
- CACHE_VERSION bump needed after changes
- Today page CTA href: update from calendar.html to updates.html
- Compare page: add "Want this every day?" CTA linking to updates.html if not present

</code_context>

<specifics>
## Specific Ideas

- Mad Libs feels different enough from personality quizzes to warrant its own section on the Fun page -- it's a creative activity, not a "which flavor are you?" quiz
- Fun page is a launcher/hub -- tapping things takes you to dedicated pages (quiz.html, group.html, forecast-map.html) rather than duplicating functionality
- Get Updates auto-fills store from header because the user already chose their store -- don't make them pick again
- Old pages are legacy artifacts -- they stay live but are not part of the ongoing scheme

</specifics>

<deferred>
## Deferred Ideas

- Old page redirects with "This page has moved" banners -- v2 RDIR requirements
- Image-based quiz mode cards (FUNP-01) -- v2 Fun Page Polish
- Quiz mode visual differentiation (FUNP-02) -- v2 Fun Page Polish
- Map flavor family exclusion filter (MAPE-01, MAPE-02) -- v2 Map Enhancement

</deferred>

---

*Phase: 04-supporting-pages-nav-activation*
*Context gathered: 2026-03-08*
