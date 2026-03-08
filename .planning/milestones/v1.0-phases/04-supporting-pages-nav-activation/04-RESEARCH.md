# Phase 4: Supporting Pages + Nav Activation - Research

**Researched:** 2026-03-08
**Domain:** Vanilla JS static pages, navigation restructuring, quiz integration, alert inline signup
**Confidence:** HIGH

## Summary

Phase 4 delivers three interconnected workstreams: (1) a new fun.html hub page with quiz mode cards, Mad Libs section, and link-out cards for Group Vote and Fronts; (2) a new updates.html page consolidating Calendar, Flavor Alerts, Widget, and Siri setup flows; and (3) a nav consolidation from 11 items to exactly 4 (Today, Compare, Map, Fun) with a shared footer containing "Get Updates" and "Privacy" links.

The codebase uses a no-build-step vanilla JS architecture with IIFE Revealing Module pattern (`var X = (function() { ... })();`), `var` throughout (no `let`/`const` in page modules), and inline `<style>` blocks per page. All pages load `planner-shared.js` then `shared-nav.js` via script tags into a `<div id="shared-nav"></div>`. The quiz engine (`quizzes/engine.js`) is the sole exception -- it uses ES module `import` syntax. The existing chip UI patterns (`.brand-chip`, `.flavor-chip`, `.compare-filter-chip`) in style.css provide ready-made styling foundations for the Mad Libs word chips and quiz mode cards.

**Primary recommendation:** Structure this as three delivery waves: (1) Nav consolidation in shared-nav.js with footer rendering (affects all pages), (2) fun.html with quiz mode cards and Mad Libs chips, (3) updates.html with inline alert signup. The nav must land first because it changes shared-nav.js which every page loads.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New fun.html page (not a restructured quiz.html)
- 4 sections in order: Quiz Mode Cards, Mad Libs, Group Vote, Fronts
- Quiz mode cards and Mad Libs are distinct sections -- Mad Libs is not grouped with quiz modes because it's a creative fill-in activity, not a personality/trivia quiz
- Group Vote and Fronts are link-out cards (description + button navigating to group.html and forecast-map.html respectively)
- No functionality duplication from existing pages -- fun.html is a launcher/hub
- Text cards with mode name and 1-line description (no images or icons needed)
- Tapping a card navigates to quiz.html?mode=X with the mode pre-selected
- quiz.html must read ?mode query param and skip the dropdown, starting the quiz directly
- Modes shown as cards: Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility (6 cards -- Mad Libs excluded, has its own section)
- Tappable chips for the 3 pre-populated word choices per blank
- Inline text input field next to chips for write-in option
- Mobile-friendly: tap a chip to fill the blank, or type a custom word
- New updates.html page with stacked sections (not tabs or accordion)
- Section order: Calendar, Flavor Alerts, Widget, Siri
- Each section has a heading, brief description, and setup action
- Store auto-filled from header store indicator (UPDT-04)
- "Add more stores" link goes to calendar.html for full multi-store picker
- Accessible via shared footer link on every page + "Want this every day?" CTAs on Today/Compare
- Not in the 4-item primary nav (NAV-03)
- Simplified form on Get Updates page: email input + store auto-filled from header + popular flavor chips
- Submit stays on page (no redirect)
- Full alerts.html still exists for power users who want the complete store/flavor picker flow
- 4 items: Today (index.html), Compare (compare.html), Map (map.html), Fun (fun.html)
- Functional word labels per NAV-02 -- no weather metaphor names
- Active-state highlighting for the current page (bold/underline/color treatment)
- Shared footer rendered by shared-nav.js with "Get Updates" and "Privacy" links
- Old 11-item nav replaced entirely in shared-nav.js NAV_ITEMS array
- Old pages (quiz.html, group.html, forecast-map.html, calendar.html, alerts.html, siri.html, widget.html, radar.html, scoop.html) stay live -- no 404s
- Not linked from nav, not invested in further
- Fun.html and updates.html link to relevant old pages where needed

### Claude's Discretion
- Fun page visual design and card styling
- Whether Mad Libs launches inline on fun.html or navigates to quiz.html?mode=mad-libs (pick what's cleanest)
- Whether old pages get a "this page has moved" banner or just stay as-is (RDIR is v2 but lightweight banners could be added if trivial)
- Widget and Siri section content/instructions on updates.html
- Footer visual treatment and placement
- Loading states and error handling for all new pages
- fun.html IIFE module design (fun-page.js or inline)

### Deferred Ideas (OUT OF SCOPE)
- Old page redirects with "This page has moved" banners -- v2 RDIR requirements
- Image-based quiz mode cards (FUNP-01) -- v2 Fun Page Polish
- Quiz mode visual differentiation (FUNP-02) -- v2 Fun Page Polish
- Map flavor family exclusion filter (MAPE-01, MAPE-02) -- v2 Map Enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FUN-01 | Quiz modes displayed as visual cards with name and one-line description, not a dropdown | 6 quiz mode cards (Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility) as tappable text cards linking to quiz.html?mode=X. Card styling derived from existing `.quiz-panel` and `.brand-chip` patterns. |
| FUN-02 | Mad Libs mode offers 3 pre-populated word choices + 1 write-in option per blank | Each of the 5 Mad Libs questions has exactly 4 options (verified in quiz-mad-libs-v1.json). Show 3 as tappable chips + 1 inline text input. Current engine uses `fill_in_madlib` question type with keyword matching. |
| FUN-03 | Quiz results map to actually-available nearby flavors with store CTAs | Already handled by engine.js -- quiz.html does radius-based flavor matching. Fun page just needs to navigate correctly with ?mode param. |
| FUN-04 | Group Vote is accessible from Fun page as a card or section | Link-out card to group.html with description and CTA button. |
| FUN-05 | Fronts (flavor weather map) is accessible from Fun page, no primary nav link | Link-out card to forecast-map.html with description and CTA button. |
| UPDT-01 | Single page consolidates setup flows for Calendar, Widget, Siri, and Alerts | New updates.html with 4 stacked sections. Reference existing calendar.html, widget.html, siri.html, alerts.html for content. |
| UPDT-02 | Each channel shows brief description and setup instructions | Condensed versions of existing page content. Calendar: .ics subscription link. Widget: Scriptable setup. Siri: Shortcuts setup. Alerts: inline form. |
| UPDT-03 | Alert signup form works inline on the page (not a redirect) | Use existing `/api/v1/alerts/subscribe` POST endpoint. Simplified form: email + auto-filled store + popular flavor chips. No store picker needed (auto-filled from header). |
| UPDT-04 | Store context carries from referring page (pre-fills store if user came from Today) | `CustardPlanner.getPrimaryStoreSlug()` reads localStorage. Already set by SharedNav on every page. updates.html reads this to pre-fill store. |
| UPDT-05 | Contextual "Want this every day?" CTAs on Today and Compare link to this page | Today page already has `#updates-cta` section with link to calendar.html -- change href to updates.html. Compare page needs a similar CTA added. |
| NAV-01 | User sees 4 clear nav items (Today, Compare, Map, Fun) on every page | Replace NAV_ITEMS array in shared-nav.js (line 23-35) from 11 items to 4. |
| NAV-02 | Nav labels are functional words, not weather metaphor names | Labels: "Today", "Compare", "Map", "Fun" -- all functional, no weather metaphors. |
| NAV-03 | "Get Updates" is accessible via footer link or contextual CTA, not primary nav | Footer rendered by shared-nav.js below nav links. Contains "Get Updates" link to updates.html and "Privacy" link. |
| NAV-04 | Nav fits at 375px width without hamburger menu or overflow | 4 items at ~0.875rem font is roughly 50-60px per item = ~240px total. Fits easily at 375px. Must verify with test. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES5 IIFE) | N/A | Page modules (fun-page.js) | Codebase pattern: `var X = (function() { ... })();` with `var` throughout |
| Vanilla HTML | N/A | fun.html, updates.html | No build step, static pages served from docs/ |
| Inline `<style>` | N/A | Page-specific CSS | Every existing page uses inline style blocks |
| Playwright | 1.58.2 | Browser smoke tests | Existing test infrastructure in worker/test/browser/ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| planner-shared.js | N/A | Store slug, favorites, escapeHtml, WORKER_BASE | Every page loads this first |
| shared-nav.js | N/A | Nav rendering, store indicator, footer | Modified to support 4-item nav + footer |
| cone-renderer.js | N/A | Cone pixel art rendering | Optional on fun.html for card decoration |
| quizzes/engine.js | ES module | Quiz engine with mode selection | Modified to support ?mode query param auto-start |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `<style>` per page | External CSS file per page | Not worth it -- codebase convention is inline, and it works with service worker caching |
| Separate fun-page.js IIFE | Inline `<script>` in fun.html | Separate file is cleaner, matches today-page.js / compare-page.js pattern |
| Build Mad Libs UI in fun.html | Navigate to quiz.html?mode=mad-libs | Inline is friendlier (no page load) but adds complexity. Recommend navigating to quiz.html with chips added to engine.js for the `fill_in_madlib` question type. |

## Architecture Patterns

### Recommended Project Structure
```
docs/
  fun.html             # New Fun hub page (FUN-01 through FUN-05)
  fun-page.js          # IIFE module for fun page interactions (if needed)
  updates.html         # New Get Updates page (UPDT-01 through UPDT-05)
  updates-page.js      # IIFE module for inline alert signup
  shared-nav.js        # Modified: 4 items + footer rendering
  quizzes/engine.js    # Modified: ?mode param support
  sw.js                # Modified: add fun.html, updates.html, updates-page.js to STATIC_ASSETS
  today-page.js        # Modified: CTA href from calendar.html to updates.html
  index.html           # Modified: CTA href update
  compare.html         # Modified: add "Want this every day?" CTA
  compare-page.js      # Modified: render CTA section
worker/test/browser/
  nav-clickthrough.spec.mjs   # Modified: update expected labels and links
  fun-page.spec.mjs           # New: fun page tests
  updates-page.spec.mjs       # New: updates page tests
```

### Pattern 1: IIFE Module with var
**What:** Every page-specific JS module follows the IIFE Revealing Module pattern.
**When to use:** All new JS files.
**Example:**
```javascript
// Source: existing codebase pattern (today-page.js, compare-page.js)
var CustardFun = (function () {
  'use strict';

  var _container = null;

  function init() {
    _container = document.getElementById('fun-content');
    if (!_container) return;
    renderQuizCards();
    renderMadLibsSection();
    renderLinkCards();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init: init };
})();
```

### Pattern 2: HTML Page Template
**What:** Every page follows the same structure: head with CSP meta, favicon, analytics; body with header (h1, subtitle, `#shared-nav`), main content, footer with share mount.
**When to use:** fun.html and updates.html.
**Example:**
```html
<!-- Source: index.html, compare.html consistent pattern -->
<header class="forecast-header">
  <h1 style="color:#005696;font-size:1.5rem;">Page Title</h1>
  <p style="...">Subtitle</p>
  <div id="shared-nav" data-page="fun"></div>
</header>
<main><!-- content --></main>
<footer><!-- shared footer rendered by JS, or static fallback --></footer>
<script src="planner-shared.js"></script>
<script src="shared-nav.js"></script>
```

### Pattern 3: Chip UI Component
**What:** Tappable selection chips used for filtering and selection.
**When to use:** Mad Libs word choices, popular flavor chips on updates page.
**Example:**
```css
/* Source: style.css lines 577-630 (.brand-chip, .flavor-chip patterns) */
.madlib-chip {
  padding: 0.375rem 0.875rem;
  border: 1.5px solid #ccc;
  border-radius: 999px;
  background: white;
  color: #444;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.madlib-chip.selected {
  background: #005696;
  color: white;
  border-color: #005696;
}
```

### Pattern 4: Footer Rendering in shared-nav.js
**What:** shared-nav.js `buildNavLinksHTML()` extended to also render a footer section.
**When to use:** Replace per-page footer HTML with JS-rendered shared footer.
**Example:**
```javascript
// Added to shared-nav.js renderNav()
function buildFooterHTML() {
  return '<footer class="shared-footer">'
    + '<div class="footer-links">'
    + '<a href="updates.html">Get Updates</a>'
    + '<a href="privacy.html">Privacy</a>'
    + '</div>'
    + '</footer>';
}
```

### Pattern 5: Query Param Mode Selection for Quiz
**What:** quiz.html reads `?mode=X` from URL, auto-selects the mode in the dropdown, and starts the quiz without user needing to pick from dropdown.
**When to use:** When navigating from fun.html quiz cards.
**Example:**
```javascript
// Added to quizzes/engine.js init()
var params = new URLSearchParams(window.location.search);
var modeParam = params.get('mode');
if (modeParam) {
  var target = state.quizzes.find(function(q) { return q.id === modeParam; });
  if (target) {
    state.activeQuiz = target;
    els.variantSelect.value = target.id;
  }
}
```

### Anti-Patterns to Avoid
- **Using let/const in IIFE modules:** The codebase uses `var` throughout page-level JS. Only `quizzes/engine.js` uses modern syntax (it's an ES module). New IIFE modules must use `var`.
- **Duplicating quiz functionality in fun.html:** fun.html is a launcher/hub, not a quiz runner. Quiz cards navigate to quiz.html, they don't embed quiz logic.
- **Building a new store picker for updates.html:** Store is auto-filled from header via `CustardPlanner.getPrimaryStoreSlug()`. No picker needed.
- **Adding fun.html to the 11 old pages:** The old pages remain as-is but are not invested in. fun.html is the new page, not a replacement of quiz.html.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alert subscription | Custom email handling | `/api/v1/alerts/subscribe` POST endpoint | Already production-tested with CSRF, double opt-in, rate limiting |
| Store context | New store selection UI | `CustardPlanner.getPrimaryStoreSlug()` | Already persisted in localStorage, set by SharedNav |
| Quiz mode rendering | Embed quiz engine in fun.html | Navigate to quiz.html?mode=X | Engine is 49KB of complex state management -- just link to it |
| Chip selection UI | Custom component framework | Extend existing `.brand-chip` / `.flavor-chip` CSS | Battle-tested at 375px, consistent with codebase |
| Calendar subscription | New calendar flow | Link to calendar.html | Full multi-store picker is already built |
| Flavor catalog for alert chips | Custom flavor list | `WORKER_BASE + '/api/v1/flavors/catalog'` | Existing endpoint returns full flavor list with descriptions |

**Key insight:** This phase is primarily a UI composition task -- assembling existing functionality into new navigation structure and hub pages. Almost zero new backend work.

## Common Pitfalls

### Pitfall 1: Breaking nav on all pages
**What goes wrong:** Changing shared-nav.js NAV_ITEMS array affects every page simultaneously. A syntax error or bad array means broken nav site-wide.
**Why it happens:** shared-nav.js is loaded on every page via script tag.
**How to avoid:** Test the nav change on multiple pages (index.html, compare.html, map.html, quiz.html) before committing. Update nav-clickthrough.spec.mjs test expectations first.
**Warning signs:** Any page showing 0 nav links or JS console errors.

### Pitfall 2: Service worker serving stale nav
**What goes wrong:** After updating shared-nav.js, the service worker serves the cached old version. Users see 11 nav items instead of 4.
**Why it happens:** sw.js uses stale-while-revalidate. shared-nav.js is in STATIC_ASSETS. Browser may show cached version until next visit.
**How to avoid:** Bump CACHE_VERSION in sw.js. Currently at `custard-v13` -- bump to `custard-v14`.
**Warning signs:** Changes not appearing in browser despite server having new file.

### Pitfall 3: Quiz mode param ID mismatch
**What goes wrong:** fun.html links to `quiz.html?mode=classic` but the quiz JSON uses `id: "classic-v1"`.
**Why it happens:** Quiz IDs in JSON files have version suffixes.
**How to avoid:** Use exact IDs from the quiz JSON files: `weather-v1`, `classic-v1`, `date-night-v1`, `build-scoop-v1`, `compatibility-v1`, `trivia-v1`.
**Warning signs:** Quiz page loads but shows first mode instead of the selected one.

### Pitfall 4: CSP blocking inline scripts on new pages
**What goes wrong:** Content Security Policy meta tag blocks inline script execution.
**Why it happens:** Every page has a CSP meta tag allowing `'unsafe-inline'` for scripts, but only if you include it.
**How to avoid:** Copy the exact CSP meta tag from index.html to fun.html and updates.html.
**Warning signs:** Console shows CSP violation errors.

### Pitfall 5: Footer rendering before SharedNav initializes
**What goes wrong:** If footer is rendered by shared-nav.js, it only appears after DOMContentLoaded + manifest load.
**Why it happens:** SharedNav renders into `#shared-nav` container on DOMContentLoaded.
**How to avoid:** Either render footer as part of the buildNavLinksHTML() call (synchronous, no delay), or include a static HTML footer as fallback that gets replaced.
**Warning signs:** Footer flickers or appears late.

### Pitfall 6: Mad Libs chip + text input value conflict
**What goes wrong:** User taps a chip then types in the text input. Both values exist but only one should be submitted.
**Why it happens:** Chips and text input are independent UI elements.
**How to avoid:** When a chip is tapped, clear the text input and set a hidden input to the chip's value. When user types in the text field, deselect all chips. The engine's `fill_in_madlib` type already does keyword matching on free text.
**Warning signs:** Quiz results don't match what user selected.

### Pitfall 7: Existing nav-clickthrough tests will fail
**What goes wrong:** The Playwright test at `worker/test/browser/nav-clickthrough.spec.mjs` hardcodes all 11 nav labels and the click-through sequence.
**Why it happens:** Test was written for the old 11-item nav.
**How to avoid:** Update the test first or simultaneously. New NAV_LINKS should be 4 items. ALL_PAGES list should include fun.html.
**Warning signs:** `npm run test:browser` fails immediately.

## Code Examples

### Quiz Mode Card IDs (from JSON files)
```javascript
// Source: docs/quizzes/ JSON files -- verified IDs
var QUIZ_MODES = [
  { id: 'classic-v1', name: 'Classic', desc: 'Which flavor are you? Classic personality quiz.' },
  { id: 'weather-v1', name: 'Weather', desc: 'Your vibe today mapped to a flavor forecast.' },
  { id: 'trivia-v1', name: 'Trivia', desc: 'Test your custard knowledge with real flavor facts.' },
  { id: 'date-night-v1', name: 'Date Night', desc: 'Find the perfect flavor for two.' },
  { id: 'build-scoop-v1', name: 'Build-a-Scoop', desc: 'Design your ideal scoop from the ground up.' },
  { id: 'compatibility-v1', name: 'Compatibility', desc: 'How well do your flavor personalities match?' },
];
```

### New NAV_ITEMS Array
```javascript
// Source: CONTEXT.md locked decision
var NAV_ITEMS = [
  { href: 'index.html', label: 'Today' },
  { href: 'compare.html', label: 'Compare' },
  { href: 'map.html', label: 'Map' },
  { href: 'fun.html', label: 'Fun' }
];
```

### Alert Subscribe API Call (for inline form)
```javascript
// Source: docs/alerts.html lines 461-473
var resp = fetch(WORKER_BASE + '/api/v1/alerts/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: emailValue,
    slug: storeSlug,
    favorites: selectedFlavors,
    frequency: 'daily',
  }),
});
```

### Mad Libs Question Structure (from quiz-mad-libs-v1.json)
```json
{
  "id": "ml-day",
  "type": "fill_in_madlib",
  "prompt": "What kind of day is it?",
  "placeholder": "sunny, stressful, foggy, whatever...",
  "options": [
    { "id": "sunny-slow", "label": "Sunny and slow", "madlib_label": "sunny and slow", "traits": { "calm": 2, "classic": 1 } },
    { "id": "hectic-electric", "label": "Hectic and electric", "madlib_label": "hectic and electric", "traits": { "energetic": 2, "bold": 1 } },
    { "id": "foggy-introspective", "label": "Foggy and introspective", "madlib_label": "foggy and introspective", "traits": { "analytical": 2, "calm": 1 } },
    { "id": "warm-social", "label": "Warm and social", "madlib_label": "warm and social", "traits": { "social": 2, "romantic": 1 } }
  ]
}
```
Note: Each question has exactly 4 options. Per FUN-02 requirement, show 3 as tappable chips + 1 write-in text input. The 4th option's keywords can still match via the write-in path.

### Discretion: Mad Libs UI Recommendation
**Recommend navigating to quiz.html?mode=mad-libs-v1** rather than building inline on fun.html. Reasoning:
1. The quiz engine already handles `fill_in_madlib` question type with keyword matching and trait scoring.
2. Building inline would duplicate the scoring logic, result rendering, and flavor matching (49KB of engine code).
3. The only change needed in engine.js is adding chip UI to the `fill_in_madlib` rendering (currently just a text input).
4. This approach means FUN-02 is implemented as: chip UI added to engine.js for `fill_in_madlib` questions, fun.html card links to quiz.html?mode=mad-libs-v1.

### Discretion: Footer Treatment
**Recommend rendering footer in shared-nav.js** as part of the buildNavLinksHTML() call. This keeps it synchronized across all pages without modifying each page's footer HTML. The JS-rendered footer replaces page-specific footers, or is appended to a `<footer>` element if one exists.

### Discretion: Old Pages Banner
**Recommend leaving old pages as-is** (no "this page has moved" banner). RDIR is explicitly v2 scope. Adding banners to 9 pages is not trivial and risks breaking those pages.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 11-item nav bar | 4-item nav bar | Phase 4 | Cleaner navigation, fits 375px, functional labels |
| Quiz mode dropdown | Visual mode cards on fun.html | Phase 4 | Better discoverability of quiz modes |
| Free text only for Mad Libs | Chips + write-in | Phase 4 | Lower friction, guided choices with escape hatch |
| Separate pages for calendar/alerts/widget/siri | Consolidated updates.html | Phase 4 | Single destination for all "stay updated" flows |
| No shared footer | JS-rendered shared footer | Phase 4 | Consistent "Get Updates" and "Privacy" links everywhere |

## Open Questions

1. **Popular flavor chips for alert signup**
   - What we know: The `/api/v1/flavors/catalog` endpoint returns all flavors. alerts.html uses a search-and-add UI.
   - What's unclear: Which flavors should be "popular" chips on the simplified updates.html form? How many chips?
   - Recommendation: Hardcode 5-6 popular flavors (Turtle, Cookie Dough, Mint, Caramel Cashew, Snickers Swirl, Oreo) as chips, plus a "search more" link to alerts.html for the full picker.

2. **Calendar section on updates.html -- auto-fill store**
   - What we know: calendar.html has a multi-store picker. updates.html should auto-fill from header store.
   - What's unclear: Does the .ics URL generation need the full calendar.html picker, or can it be done with just the primary store slug?
   - Recommendation: Generate the .ics subscription URL using the primary store slug directly: `WORKER_BASE + '/api/v1/stores/' + slug + '/calendar.ics'`. This is the same pattern calendar.html uses.

3. **Widget and Siri section content**
   - What we know: widget.html has multi-step Scriptable instructions. siri.html has Shortcuts setup instructions.
   - What's unclear: How much to condense for updates.html.
   - Recommendation: 2-3 sentence summary + "Get full instructions" link to the original page. These are iOS-specific setup flows that benefit from detailed instructions on dedicated pages.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | worker/playwright.config.mjs |
| Quick run command | `cd custard-calendar/worker && npx playwright test --config playwright.config.mjs test/browser/nav-clickthrough.spec.mjs` |
| Full suite command | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | 4 nav items on every page | browser/e2e | `npx playwright test test/browser/nav-clickthrough.spec.mjs` | Exists -- needs update |
| NAV-02 | Functional word labels | browser/e2e | `npx playwright test test/browser/nav-clickthrough.spec.mjs` | Exists -- needs update |
| NAV-03 | Get Updates in footer, not nav | browser/e2e | `npx playwright test test/browser/nav-footer.spec.mjs` | Wave 0 |
| NAV-04 | 4 items fit at 375px | browser/e2e | `npx playwright test test/browser/nav-375px.spec.mjs` | Wave 0 |
| FUN-01 | Quiz mode cards visible | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 |
| FUN-02 | Mad Libs chips + write-in | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 |
| FUN-03 | Quiz results map to nearby flavors | browser/e2e | `npx playwright test test/browser/quiz-personality.spec.mjs` | Exists -- no change needed |
| FUN-04 | Group Vote accessible from Fun | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 |
| FUN-05 | Fronts accessible from Fun | browser/e2e | `npx playwright test test/browser/fun-page.spec.mjs` | Wave 0 |
| UPDT-01 | Consolidated updates page | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 |
| UPDT-02 | Each channel described | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 |
| UPDT-03 | Inline alert signup | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 |
| UPDT-04 | Store auto-filled | browser/e2e | `npx playwright test test/browser/updates-page.spec.mjs` | Wave 0 |
| UPDT-05 | CTAs on Today and Compare | browser/e2e | `npx playwright test test/browser/today-hero.spec.mjs` | Exists -- needs href update check |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx playwright test --config playwright.config.mjs test/browser/nav-clickthrough.spec.mjs --workers=1`
- **Per wave merge:** `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `test/browser/fun-page.spec.mjs` -- covers FUN-01, FUN-02, FUN-04, FUN-05
- [ ] `test/browser/updates-page.spec.mjs` -- covers UPDT-01, UPDT-02, UPDT-03, UPDT-04
- [ ] `test/browser/nav-footer.spec.mjs` -- covers NAV-03 (footer has Get Updates link)
- [ ] `test/browser/nav-375px.spec.mjs` -- covers NAV-04 (no overflow at 375px viewport)
- [ ] Update `test/browser/nav-clickthrough.spec.mjs` -- NAV_LINKS from 11 to 4, ALL_PAGES includes fun.html + updates.html

## Sources

### Primary (HIGH confidence)
- `docs/shared-nav.js` -- NAV_ITEMS array at lines 23-35, getCurrentPage(), buildNavLinksHTML(), renderNav()
- `docs/quizzes/engine.js` -- Quiz mode loading, variant select population, fill_in_madlib question type handling
- `docs/quizzes/quiz-mad-libs-v1.json` -- Complete Mad Libs quiz structure with 5 questions, 4 options each
- `docs/alerts.html` -- Full alert subscribe flow with `/api/v1/alerts/subscribe` API call
- `docs/style.css` -- Chip CSS patterns: `.brand-chip`, `.flavor-chip`, `.compare-filter-chip`, `.nav-links`, `.nav-active`
- `docs/sw.js` -- Service worker STATIC_ASSETS array, CACHE_VERSION currently `custard-v13`
- `docs/index.html` -- Today page CTA section `#updates-cta` linking to calendar.html (needs update to updates.html)
- `docs/compare.html` -- Compare page structure, no "Want this every day?" CTA yet
- `worker/test/browser/nav-clickthrough.spec.mjs` -- Existing nav test with 11 hardcoded labels
- `worker/playwright.config.mjs` -- Test config, serves docs/ on port 4173 via python3 http.server

### Secondary (MEDIUM confidence)
- `docs/siri.html`, `docs/widget.html` -- Content structure for updates.html reference sections
- `docs/calendar.html` -- Multi-store picker flow, .ics URL generation pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct codebase inspection, no external dependencies
- Architecture: HIGH - all patterns derived from existing codebase files
- Pitfalls: HIGH - identified from direct code review and test file examination

**Research date:** 2026-03-08
**Valid until:** 2026-04-07 (stable -- no external dependency changes expected)
