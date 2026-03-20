# Phase 34: Social Sharing - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Quiz results and flavor rarity stats become shareable on social platforms with rich OG card previews (1200x630 SVG) that drive clicks back to the site. Shared URLs load standalone content so recipients see the result without completing the quiz themselves.

</domain>

<decisions>
## Implementation Decisions

### Quiz result OG cards
- Card shows: archetype name, matched flavor name, and cone art PNG
- Include "Take the quiz" call-to-action text on the card
- Card endpoint keyed by archetype + flavor combo: `/og/quiz/{archetype}/{flavor}.svg`
- Extends existing `social-card.js` which already has 3 card types

### Flavor rarity OG cards
- Card shows: appearance count + rarity classification (e.g., "Served 3 times this year", "Ultra Rare")
- Uses existing `rarityLabelFromGapDays()` classification logic
- Card endpoint keyed by flavor name only: `/og/flavor/{flavor-name}.svg`
- Network-wide stats, not per-store

### Standalone quiz result pages
- Same `quiz.html` in skip-to-result mode -- when `?archetype=X&flavor=Y` params detected, skip quiz and render result card directly
- Engine.js already reads these params; needs a presentation-only rendering path
- Prominent "Take the quiz yourself" CTA button below result card for viral conversion
- No sharer attribution -- result shows generically ("You got: Midnight Prophet")
- Dynamic `og:image` and `og:title` meta tags set via JS to point to result-specific OG card

### Flavor rarity landing pages
- Share from Radar page flavor entries -- no new standalone flavor pages
- Shared link lands on `radar.html?flavor={name}` -- auto-scroll to and highlight that flavor entry
- Small share icon on each flavor card in Radar list

### Share UX
- Share button appears immediately with quiz result (existing `#result-share` mount point)
- Uses existing Web Share API (mobile) + clipboard copy (desktop) pattern from `planner-ui.js`
- Playful flavor-themed share text:
  - Quiz: "I'm a Midnight Prophet (Chocolate Fudge) -- what's your custard personality?"
  - Flavor: "Turtle is Ultra Rare -- only served 3 times this year!"

### Claude's Discretion
- OG card visual treatment (dark blue gradient vs quiz-mode accent colors vs hybrid)
- Loading/transition when quiz enters skip-to-result mode
- Exact share icon design and placement on Radar flavor entries
- Radar flavor highlight animation when arriving from shared link

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Social card system (Worker)
- `worker/src/social-card.js` -- Existing 3 card types (per-page, per-store/date, trivia). New quiz + flavor cards extend this file.
- `worker/src/index.js` -- OG route registration (lines 123-128), 60/hr rate limit on `/og/` paths

### Quiz engine (Frontend)
- `docs/quizzes/engine.js` -- Quiz lifecycle, result rendering, existing share button mount at `#result-share`, URL param reading (`?archetype=X&flavor=Y`)
- `docs/quiz.html` -- Quiz page structure, existing og:image meta tag (currently generic `/og/page/quiz.svg`)

### Flavor Radar (Frontend)
- `docs/radar.html` -- Radar page structure, flavor frequency display
- `docs/js/planner-domain.js` -- `rarityLabelFromGapDays()` for rarity classification

### Share infrastructure (Frontend)
- `docs/js/planner-ui.js` -- `initShareButton()` (lines 386-413), Web Share API + clipboard fallback

### Cone art assets
- `docs/assets/cones/` -- L5 PNG cone art for 60+ flavors, used as embedded base64 in social cards

### Metrics API (Worker)
- `worker/src/metrics.js` -- `/api/v1/metrics/flavor/{normalized}` endpoint for frequency, recency, store count, rank percentile

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `social-card.js` card generator: SVG template with gradient background, accent bar, embedded cone PNG -- extend with 2 new card types
- `initShareButton()` in planner-ui.js: Web Share API + clipboard pattern -- reuse for both quiz and Radar share buttons
- `engine.js` share mount: Already reads `?archetype=&flavor=` params and mounts share button into `#result-share`
- `rarityLabelFromGapDays()`: Existing rarity classification ("Ultra Rare", "Rare", etc.) -- reuse for flavor card text
- L5 cone PNGs: Already fetched as base64 data URIs by social-card.js for embedding in SVG cards

### Established Patterns
- IIFE module pattern: All JS uses `window.CustardPlanner` namespace
- Social card SVG: 1200x630, gradient background, accent bar tinted to flavor base color, cone art + text
- OG route pattern: `/og/{type}/{params}.svg` with 60/hr rate limit
- Share URL pattern: query params for state (`?archetype=X&flavor=Y`, `?flavor=X`)

### Integration Points
- New Worker routes: `/og/quiz/{archetype}/{flavor}.svg` and `/og/flavor/{name}.svg` in index.js
- Quiz result detection: engine.js checks URL params on load -- add skip-to-result rendering path
- Radar page: Add `?flavor=` param handling for auto-scroll + per-entry share icons
- Dynamic meta tags: JS sets `og:image`, `og:title` content attributes based on detected result params

</code_context>

<specifics>
## Specific Ideas

- Share text should use the site's playful weather-metaphor voice: "what's your custard personality?" not "take this quiz"
- The quiz result OG card is the primary viral growth mechanism -- cone art is the visual hook that makes people click
- Flavor rarity shares leverage the "did you know?" factor -- people share surprising stats

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 34-social-sharing*
*Context gathered: 2026-03-20*
