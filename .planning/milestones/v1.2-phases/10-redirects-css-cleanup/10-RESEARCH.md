# Phase 10: Redirects & CSS Cleanup - Research

**Researched:** 2026-03-09
**Domain:** Client-side HTML redirects, CSS design token migration, service worker cache management
**Confidence:** HIGH

## Summary

Phase 10 has two independent workstreams: (1) replacing six full HTML pages with minimal redirect stubs that forward users (with query params and hash) to new destinations, and (2) migrating Mad Libs chip rendering from inline styles in engine.js to CSS classes using design tokens in style.css.

Both workstreams are well-constrained by the existing codebase. The redirect stub pattern is already proven in `docs/multi.html` (meta refresh + JS fallback). The CSS chip pattern is already established with three existing chip families (brand-chip, flavor-chip, drive-chip) that provide exact templates for token usage. The per-mode quiz accent system (`data-quiz-mode` attribute + `--quiz-accent` CSS variable) is already wired in quiz.html and engine.js.

**Primary recommendation:** Execute redirects first (file replacements + SW cleanup), then CSS chip migration. The redirect work is pure file replacement with no cross-file dependencies beyond SW and test updates. The CSS work touches engine.js and style.css and requires verifying the accent color integration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- scoop.html -> index.html
- radar.html -> index.html
- calendar.html -> updates.html
- widget.html -> updates.html
- siri.html -> updates.html
- alerts.html -> updates.html
- Follow existing multi.html pattern: meta refresh + JavaScript window.location.replace() fallback
- Query params preserved via window.location.search, hash via window.location.hash
- Bare HTML only -- no shared-nav.js, no style.css, no design tokens, no full JS stack
- Minimal stubs (~760 bytes each) matching success criteria "no full JS stack loaded"
- Remove redirect stub pages from SW STATIC_ASSETS list
- calendar.html and widget.html are currently cached -- remove them after conversion to stubs
- Caching redirect stubs adds no value (user immediately leaves the page)
- Bump CACHE_VERSION after STATIC_ASSETS changes
- New `.madlib-chip` CSS class using design tokens (--brand, --border-input, --radius-full, --space-2)
- Independent class, does not extend or share base with existing brand-chip/flavor-chip/drive-chip
- New `.madlib-chip-group` CSS class for the flex container (display:flex, flex-wrap, gap, margin)
- Fully eliminates inline styles from Mad Libs rendering in engine.js
- Selected chip state uses per-mode quiz accent color via data-quiz-mode attribute theming (Phase 8 system)
- Not hardcoded to --brand blue -- responds to the mode's accent color for visual consistency
- JS uses `.selected` class toggling only -- no inline style manipulation for any state (default, selected, deselect)

### Claude's Discretion
- Exact meta refresh content attribute timing (0 vs 1 second)
- Whether redirect stubs include a visible "Redirecting..." text or are completely blank
- CACHE_VERSION numbering (currently custard-v16)
- CSS token choices for chip padding, font-size, font-weight (should match existing chip patterns visually)

### Deferred Ideas (OUT OF SCOPE)
- Store display names: "Madison" is ambiguous for multiple stores, should use distinguishing names like "Todd Dr" or street-based identifiers -- future enhancement to store data/display layer
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RDIR-01 | Old pages (scoop, radar, calendar, widget, siri, alerts) redirect to correct destinations | Redirect stub pattern from multi.html; destination mapping locked in CONTEXT.md; existing page analysis confirms all 6 pages exist and are full pages today |
| RDIR-02 | Redirects preserve query parameters and hash fragments from bookmarked URLs | multi.html pattern already uses `window.location.search`; extend to also pass `window.location.hash`; meta refresh `content` attribute can encode query string |
| DSGN-01 | Mad Libs chip elements use CSS classes with design tokens instead of inline styles | Three existing chip families in style.css provide token template; engine.js lines 430-475 contain all inline styles to replace; quiz accent system (`--quiz-accent` via `data-quiz-mode`) already in quiz.html |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Plain HTML | N/A | Redirect stubs | Decision: bare HTML only, no JS stack |
| CSS custom properties | N/A | Design tokens for chip styling | Already in use across all chip families in style.css |
| Playwright | (existing) | Browser tests for redirect verification | Already configured in worker/playwright.config.mjs |
| pytest | (existing) | Static analysis tests | Already used for design token and SW tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python3 http.server | stdlib | Local test server for Playwright | Already configured in playwright.config.mjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side redirect | Server-side (Cloudflare Worker) | Worker changes are out of scope per REQUIREMENTS.md |
| Meta refresh + JS | HTTP 301 via _redirects file | GitHub Pages does not support server-side redirects natively |

## Architecture Patterns

### Redirect Stub Pattern (from multi.html)
**What:** Minimal HTML file with meta refresh tag and JavaScript fallback for redirect
**When to use:** For every legacy page that needs to forward to a new destination
**Example:**
```html
<!-- Source: docs/multi.html (existing proven pattern) -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=index.html">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="index.html">index.html</a>...</p>
  <script>
    var q = window.location.search;
    var h = window.location.hash;
    window.location.replace('index.html' + (q || '') + (h || ''));
  </script>
</body>
</html>
```

### CSS Chip Class Pattern (from brand-chip)
**What:** Chip element styled via CSS class using design tokens, with state changes via class toggling
**When to use:** For the new `.madlib-chip` class
**Example:**
```css
/* Source: docs/style.css lines 642-653 (brand-chip pattern) */
.madlib-chip {
  padding: 0.375rem 0.875rem;
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.madlib-chip.selected {
  background: var(--quiz-accent, var(--brand));
  color: var(--bg-surface);
  border-color: var(--quiz-accent, var(--brand));
}

.madlib-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
```

### Quiz Accent Integration Pattern
**What:** Per-quiz-mode accent colors applied via `data-quiz-mode` attribute on `<body>`
**When to use:** The `.madlib-chip.selected` state must reference `--quiz-accent` (set per mode in quiz.html)
**Key detail:** `--quiz-accent` is defined in quiz.html's `<style>` block per mode (e.g., `[data-quiz-mode="mad-libs-v1"] { --quiz-accent: #0d7377; }`). The CSS in style.css uses `var(--quiz-accent, var(--brand))` as a fallback chain so chips work even without the attribute set.

### Anti-Patterns to Avoid
- **Inline style manipulation in JS for visual state:** The current engine.js sets `chip.style.background`, `chip.style.color`, `chip.style.borderColor` directly. This must be replaced with `classList.add('selected')` / `classList.remove('selected')` only.
- **Loading full JS stack in redirect stubs:** Redirect pages must not include `planner-shared.js`, `shared-nav.js`, `style.css`, or any other asset. Bare HTML only.
- **Keeping redirect stubs in SW cache:** Redirect stubs have zero caching value since users immediately leave. Including them wastes cache quota.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Meta refresh with query params | Custom JS-only redirect | `<meta http-equiv="refresh">` + JS fallback | Meta refresh works even with JS disabled; belt-and-suspenders approach |
| Chip visual state management | Custom style property manipulation | CSS class `.selected` + design tokens | Matches existing chip patterns (brand-chip.active, drive-chip.is-active) |
| Quiz accent color per mode | Hardcoded hex in JS | `var(--quiz-accent, var(--brand))` CSS fallback chain | Already wired in quiz.html; just reference the variable |

## Common Pitfalls

### Pitfall 1: Breaking Existing Browser Tests
**What goes wrong:** Multiple Playwright tests visit the pages being converted to stubs and expect full page content (nav bars, form elements, API calls).
**Why it happens:** Tests were written for the full pages.
**How to avoid:** Audit and update ALL affected browser tests. Known affected tests:
- `nav-clickthrough.spec.mjs` -- visits `/calendar.html` and `/scoop.html`, expects `#shared-nav` with full nav links
- `scoop-compat.spec.mjs` -- visits `/scoop.html?stores=...`, expects Today's Drive content
- `primary-store-persistence.spec.mjs` -- visits `/alerts.html`, `/siri.html`, `/radar.html`
- `shared-nav-store.spec.mjs` -- visits `/calendar.html`
- `drive-preferences.spec.mjs` -- visits `/calendar.html`
- `alerts-telemetry.spec.mjs` -- visits `/alerts.html`
- `radar-phase2.spec.mjs` -- visits `/radar.html` (4 test cases)
- `index-drive-defaults.spec.mjs` -- visits `/scoop.html?stores=...`
**Warning signs:** Any `goto("/scoop.html")` or similar in tests that expects anything other than a redirect.

### Pitfall 2: Breaking SW Registration Tests
**What goes wrong:** `test_sw_registration.py` checks that `widget.html` and `calendar.html` contain `serviceWorker` registration code. After stub conversion, they won't.
**Why it happens:** Test was written for full pages.
**How to avoid:** Remove `widget.html` and `calendar.html` from the `USER_FACING_PAGES` and `INLINE_PAGES` lists in `test_sw_registration.py`. Redirect stubs don't need SW registration.

### Pitfall 3: Meta Refresh Does Not Forward Query Params
**What goes wrong:** `<meta http-equiv="refresh" content="0;url=index.html">` redirects to `index.html` without any query params, even if the original URL had `?store=1234`.
**Why it happens:** Meta refresh is a static tag -- it cannot dynamically read the URL.
**How to avoid:** The JS fallback handles param forwarding (`window.location.search + window.location.hash`). The meta refresh provides a no-JS fallback to the base destination. This is acceptable since the primary path uses JS. The existing multi.html follows this exact pattern.

### Pitfall 4: CSS Class Name Collision with `.selected`
**What goes wrong:** Using a generic `.selected` class could affect other elements.
**Why it happens:** `.selected` is common.
**How to avoid:** The selector `.madlib-chip.selected` is specific enough (compound selector). No existing `.selected` class is used for chips in style.css (only `.selected-badge` exists). Engine.js already uses `.selected` class on madlib-chip elements, so no conflict.

### Pitfall 5: CACHE_VERSION Not Bumped
**What goes wrong:** Old service workers still serve cached `calendar.html` and `widget.html` (the full pages) even after deployment.
**Why it happens:** Forgetting to bump CACHE_VERSION means the activate handler won't purge old caches.
**How to avoid:** Bump from `custard-v16` to `custard-v17`. Remove `./calendar.html` and `./widget.html` from STATIC_ASSETS array. The activate handler automatically deletes caches with old version keys.

### Pitfall 6: Hash Fragment Handling in Meta Refresh
**What goes wrong:** Hash fragments (`#section`) are not forwarded by meta refresh at all.
**Why it happens:** Hash is client-side only and meta refresh is a static declaration.
**How to avoid:** The JS fallback explicitly reads `window.location.hash` and appends it. For the no-JS case, hash loss is acceptable (edge case).

## Code Examples

### Redirect Stub Template (verified from multi.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url={DESTINATION}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="{DESTINATION}">{DESTINATION}</a>...</p>
  <script>
    var q = window.location.search;
    var h = window.location.hash;
    window.location.replace('{DESTINATION}' + (q || '') + (h || ''));
  </script>
</body>
</html>
```

### Redirect Destination Map
| Source | Destination |
|--------|-------------|
| scoop.html | index.html |
| radar.html | index.html |
| calendar.html | updates.html |
| widget.html | updates.html |
| siri.html | updates.html |
| alerts.html | updates.html |

### Engine.js Inline Style Removal (lines 430-475)
Current code to replace:
```javascript
// Source: docs/quizzes/engine.js lines 435, 442, 447-448, 451
// BEFORE (inline styles):
chipContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;';
chip.style.cssText = 'padding:0.375rem 0.875rem;border:1.5px solid #ccc;border-radius:999px;background:white;color:#444;font-size:0.8125rem;font-weight:600;cursor:pointer;';
// Deselect: s.style.background = 'white'; s.style.color = '#444'; s.style.borderColor = '#ccc';
// Select: chip.style.background = '#005696'; chip.style.color = 'white'; chip.style.borderColor = '#005696';
```

After replacement:
```javascript
// AFTER (CSS classes only):
// chipContainer already has className = 'madlib-chip-group' (line 434)
// chip already has className = 'madlib-chip' (line 439)
// Remove: chipContainer.style.cssText = '...' (line 435)
// Remove: chip.style.cssText = '...' (line 442)
// Deselect: s.classList.remove('selected');  (remove all style.* lines)
// Select: chip.classList.add('selected');    (remove all style.* lines)
// Text input handler: same -- just classList.remove('selected'), no style.* lines
```

### SW Cache Update
```javascript
// Source: docs/sw.js
// BEFORE:
const CACHE_VERSION = 'custard-v16';
const STATIC_ASSETS = [
  // ...
  './calendar.html',  // REMOVE
  './widget.html',    // REMOVE
  // ...
];

// AFTER:
const CACHE_VERSION = 'custard-v17';
const STATIC_ASSETS = [
  // ...
  // calendar.html and widget.html removed (now redirect stubs)
  // ...
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full pages with shared-nav.js | Redirect stubs (~760 bytes) | Phase 10 | Eliminates 6 full-page loads for users with old bookmarks |
| Inline styles in engine.js | CSS classes with design tokens | Phase 10 | Consistent theming, per-mode accent support, maintainability |
| calendar.html/widget.html in SW cache | Removed from STATIC_ASSETS | Phase 10 | Smaller cache footprint, no stale full-page cache |

## Open Questions

1. **Existing multi.html redirect target**
   - What we know: multi.html currently redirects to scoop.html. After scoop.html becomes a redirect stub to index.html, multi.html creates a redirect chain (multi -> scoop -> index).
   - What's unclear: Should multi.html be updated to point directly to index.html to eliminate the chain?
   - Recommendation: Update multi.html to redirect directly to index.html while in scope. Two-hop redirects add latency and complexity.

2. **Playwright test rewrite scope**
   - What we know: At least 8 browser spec files reference the 6 pages being converted. Some tests (like radar-phase2.spec.mjs with 4 test blocks) are substantial.
   - What's unclear: Whether tests should be deleted, rewritten to test the redirect behavior, or retargeted to the destination pages.
   - Recommendation: Tests that verify page-specific features (radar phase 2 interactions, scoop drive loading) should be retargeted to test on the new destination pages. Tests that verify redirect behavior should be added. Tests that tested navigation on now-removed pages (nav-clickthrough visiting calendar.html) should be updated to remove those pages from the test list.

3. **nav-clickthrough ALL_PAGES list**
   - What we know: nav-clickthrough.spec.mjs line 42-44 includes `/calendar.html` and `/scoop.html` in `ALL_PAGES`. After conversion, these pages won't have `#shared-nav`.
   - What's unclear: Handled in pitfall section above.
   - Recommendation: Remove `/calendar.html` and `/scoop.html` from `ALL_PAGES` in nav-clickthrough.spec.mjs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python static analysis) + Playwright (browser) |
| Config file | `worker/playwright.config.mjs` (browser), `pyproject.toml` (pytest) |
| Quick run command | `cd custard-calendar && uv run pytest tests/test_sw_precache.py tests/test_design_tokens.py tests/test_sw_registration.py -x -v` |
| Full suite command | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RDIR-01 | 6 old pages redirect to correct destinations | static (Python) | `uv run pytest tests/test_redirects.py::TestRedirectStubs -x` | No -- Wave 0 |
| RDIR-01 | Redirect stubs are minimal (no full JS stack) | static (Python) | `uv run pytest tests/test_redirects.py::TestRedirectStubMinimal -x` | No -- Wave 0 |
| RDIR-02 | Query params preserved in redirect JS | static (Python) | `uv run pytest tests/test_redirects.py::TestRedirectQueryParams -x` | No -- Wave 0 |
| RDIR-02 | Hash fragments preserved in redirect JS | static (Python) | `uv run pytest tests/test_redirects.py::TestRedirectHashFragments -x` | No -- Wave 0 |
| DSGN-01 | No inline styles on madlib-chip elements in engine.js | static (Python) | `uv run pytest tests/test_design_tokens.py::TestMadlibChipNoInlineStyles -x` | No -- Wave 0 |
| DSGN-01 | .madlib-chip class exists in style.css using design tokens | static (Python) | `uv run pytest tests/test_design_tokens.py::TestMadlibChipCSS -x` | No -- Wave 0 |
| DSGN-01 | .madlib-chip-group class exists in style.css | static (Python) | `uv run pytest tests/test_design_tokens.py::TestMadlibChipGroupCSS -x` | No -- Wave 0 |
| ALL | SW STATIC_ASSETS updated (calendar.html, widget.html removed) | static (Python) | `uv run pytest tests/test_sw_precache.py -x` | Yes (needs update) |
| ALL | CACHE_VERSION bumped past v16 | static (Python) | `uv run pytest tests/test_sw_precache.py::TestCacheVersionBumped -x` | Yes (needs update) |
| ALL | Existing browser tests pass after updates | browser (Playwright) | `cd worker && npm run test:browser -- --workers=1` | Yes (needs updates) |

### Sampling Rate
- **Per task commit:** `cd custard-calendar && uv run pytest tests/test_redirects.py tests/test_design_tokens.py tests/test_sw_precache.py tests/test_sw_registration.py -x -v`
- **Per wave merge:** `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_redirects.py` -- covers RDIR-01, RDIR-02 (redirect destination correctness, query param preservation, stub minimality)
- [ ] Additional test cases in `tests/test_design_tokens.py` -- covers DSGN-01 (madlib-chip CSS class existence, no inline styles in engine.js)
- [ ] Update `tests/test_sw_precache.py` -- bump expected version check from v15 to v17, verify calendar.html/widget.html not in STATIC_ASSETS
- [ ] Update `tests/test_sw_registration.py` -- remove calendar.html and widget.html from USER_FACING_PAGES

## Sources

### Primary (HIGH confidence)
- `docs/multi.html` -- existing redirect stub pattern (read directly from codebase)
- `docs/sw.js` -- current CACHE_VERSION (custard-v16), STATIC_ASSETS list (read directly)
- `docs/style.css` -- design tokens (:root block), chip patterns (brand-chip line 642, flavor-chip line 680, drive-chip line 2718)
- `docs/quizzes/engine.js` lines 430-475 -- current inline style code for Mad Libs chips
- `docs/quiz.html` lines 444-497 -- per-mode quiz accent CSS variables and data-quiz-mode selectors
- `worker/test/browser/*.spec.mjs` -- all browser tests referencing affected pages

### Secondary (MEDIUM confidence)
- HTML meta refresh specification -- well-established standard; `content="0;url=..."` provides instant redirect
- GitHub Pages hosting -- no server-side redirect support, confirming client-side approach is correct

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all technologies are already in use in the codebase
- Architecture: HIGH - redirect pattern proven in multi.html; chip pattern proven in brand-chip/flavor-chip/drive-chip
- Pitfalls: HIGH - comprehensive audit of all browser tests and Python tests referencing affected files

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- all findings based on existing codebase patterns)
