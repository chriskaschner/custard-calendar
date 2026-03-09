# Phase 10: Redirects & CSS Cleanup - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users with old bookmarks land on the correct new page with their query params intact, and Mad Libs chips render from CSS classes instead of inline styles. Requirements: RDIR-01, RDIR-02, DSGN-01.

</domain>

<decisions>
## Implementation Decisions

### Redirect destinations
- scoop.html -> index.html (original "today's flavor" page, index is the new Today page)
- radar.html -> index.html (7-day outlook, Today page now shows forecast data)
- calendar.html -> updates.html (calendar subscription flow consolidated into Get Updates)
- widget.html -> updates.html (widget setup flow consolidated into Get Updates)
- siri.html -> updates.html (Siri shortcut setup consolidated into Get Updates)
- alerts.html -> updates.html (alert signup consolidated into Get Updates)

### Redirect stub format
- Follow existing multi.html pattern: meta refresh + JavaScript window.location.replace() fallback
- Query params preserved via window.location.search, hash via window.location.hash
- Bare HTML only -- no shared-nav.js, no style.css, no design tokens, no full JS stack
- Minimal stubs (~760 bytes each) matching success criteria "no full JS stack loaded"

### Service worker cache
- Remove redirect stub pages from SW STATIC_ASSETS list
- calendar.html and widget.html are currently cached -- remove them after conversion to stubs
- Caching redirect stubs adds no value (user immediately leaves the page)
- Bump CACHE_VERSION after STATIC_ASSETS changes

### Mad Libs chip CSS classes
- New `.madlib-chip` CSS class using design tokens (--brand, --border-input, --radius-full, --space-2)
- Independent class, does not extend or share base with existing brand-chip/flavor-chip/drive-chip
- New `.madlib-chip-group` CSS class for the flex container (display:flex, flex-wrap, gap, margin)
- Fully eliminates inline styles from Mad Libs rendering in engine.js

### Mad Libs chip theming
- Selected chip state uses per-mode quiz accent color via data-quiz-mode attribute theming (Phase 8 system)
- Not hardcoded to --brand blue -- responds to the mode's accent color for visual consistency
- JS uses `.selected` class toggling only -- no inline style manipulation for any state (default, selected, deselect)

### Claude's Discretion
- Exact meta refresh content attribute timing (0 vs 1 second)
- Whether redirect stubs include a visible "Redirecting..." text or are completely blank
- CACHE_VERSION numbering (currently custard-v16)
- CSS token choices for chip padding, font-size, font-weight (should match existing chip patterns visually)

</decisions>

<specifics>
## Specific Ideas

- Redirect pattern already proven in multi.html (760 bytes, meta refresh + JS fallback with query param passthrough)
- Mad Libs chip should visually match existing chip family (brand-chip, flavor-chip, drive-chip) but remain independent CSS

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/multi.html`: Existing redirect stub pattern (meta refresh + JS fallback, query param preservation)
- `docs/style.css`: Three chip patterns (brand-chip line 642, flavor-chip line 680, drive-chip line 2718) -- reference for visual consistency
- `docs/style.css`: Design tokens (--brand, --border-input, --radius-full, --space-2, --bg-surface, --text-secondary)
- `docs/style.css`: Per-mode quiz accent theming via data-quiz-mode selectors (Phase 8)

### Established Patterns
- Redirect: `<meta http-equiv="refresh">` + `window.location.replace()` with `window.location.search` passthrough
- Chip toggle: `.active` / `.is-active` class on existing chips, CSS handles all visual states
- Quiz theming: `[data-quiz-mode="madlibs"]` selector overrides accent variables

### Integration Points
- `docs/sw.js` STATIC_ASSETS: Remove calendar.html, widget.html after stub conversion; bump CACHE_VERSION
- `docs/quizzes/engine.js` lines 430-475: Replace inline style assignments with class toggling (.selected add/remove)
- `docs/style.css`: Add .madlib-chip and .madlib-chip-group class definitions
- 6 HTML files to replace: scoop.html, radar.html, calendar.html, widget.html, siri.html, alerts.html

</code_context>

<deferred>
## Deferred Ideas

- Store display names: "Madison" is ambiguous for multiple stores, should use distinguishing names like "Todd Dr" or street-based identifiers -- future enhancement to store data/display layer

</deferred>

---

*Phase: 10-redirects-css-cleanup*
*Context gathered: 2026-03-09*
