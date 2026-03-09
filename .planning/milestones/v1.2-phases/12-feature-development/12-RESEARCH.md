# Phase 12: Feature Development - Research

**Researched:** 2026-03-09
**Domain:** Vanilla JS feature implementation (map filters, quiz image layout, compare localStorage isolation)
**Confidence:** HIGH

## Summary

Phase 12 covers three independent frontend features: (1) converting the map page's positive flavor-family chip filter to an exclusion-based filter with localStorage persistence, (2) adding image-based answer options to quiz questions on mobile, and (3) isolating the compare page's localStorage key from the Today page's drive preferences. All three features operate on existing, well-understood vanilla JS within the `docs/` static site.

The codebase provides strong existing patterns for every aspect of this work. The compare page already has exclusion chip logic (`compare-page.js` lines 46-455), chip CSS (`style.css` lines 3483-3514), and localStorage persistence (`custard-exclusions` key). The map page already has flavor-family chip HTML and filtering JS (`map.html` lines 66-325) that just needs conversion from positive to exclusion semantics. The quiz engine already renders icon SVGs inline via `QuizSprites.resolve()` with `has-icon` class support (`engine.js` lines 474-512). The compare page already has a full multi-store picker modal (`compare-page.js` lines 528-706) -- the only structural change is localStorage key isolation.

**Primary recommendation:** Follow the three-plan parallel structure decided in CONTEXT.md. Each feature maps directly to existing code patterns with minimal invention needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Toggle-to-exclude UX matching Compare page's existing "No Mint" pattern
- Multiple families can be excluded simultaneously (multi-toggle, not radio)
- Replaces current single-select positive filter behavior on map
- Brand filter chips and family exclusion chips use AND logic (both apply together)
- Same chip design as Compare page exclusion chips (shared CSS classes, colors, toggle behavior)
- Same set of flavor families shown on both Map and Compare pages
- Filter state persists across page loads via localStorage (MAP-02)
- Separate localStorage key from Compare exclusions (different user intents)
- 2x2 grid layout on mobile (375px width) with image above label
- Generic themed SVG icons for non-flavor questions (sun, popcorn, etc. from sprite system)
- For flavor-specific questions, use cone SVGs or sprite icons at larger scale
- Verify existing multi-store picker + day-first card stack works for side-by-side comparison
- Fix bugs only if verification reveals issues -- don't rebuild what already works
- Always refactor localStorage to separate compare key regardless of visual bug status
- Compare page gets its own localStorage key (separate from custard:v1:preferences)
- Clean start -- no migration of existing selections from old key
- Today page drive preferences remain untouched (no leaking)
- Three independent plans executing in parallel: map filters, quiz images, compare fix
- No shared code changes or dependencies between the three features

### Claude's Discretion
- localStorage key naming convention (page-prefixed vs namespaced)
- Map filtered marker treatment (hidden vs dimmed)
- Map chip count display
- Quiz image breakpoint threshold
- Quiz image source (cone SVG vs sprites vs mix)
- Compare multi-store bug fix specifics (depends on verification findings)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | User can filter map markers by flavor family using exclusion chips | Existing map.html chip HTML (lines 66-78), FLAVOR_FAMILIES constant, storeMatchesFamily/applyFamilyFilter JS (lines 298-325), compare-page.js exclusion chip pattern to replicate |
| MAP-02 | Map exclusion filter state persists across page loads via localStorage | Compare page's restoreExclusions/saveExclusions pattern (compare-page.js lines 59-77), JSON.stringify/parse with try/catch |
| QUIZ-01 | User sees image-based answer options for quiz questions on mobile | QuizSprites.resolve() system, existing has-icon class in engine.js, 2x2 grid already in .quiz-options-grid CSS, sprites.js rendering functions |
| CMPR-01 | User can compare flavors across multiple stores side-by-side | Multi-store picker already built (compare-page.js lines 528-706), day-first card stack rendering (renderGrid), needs localStorage key separation only |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES5/ES6 | All implementation | Project constraint: no frameworks, IIFE pattern, window.CustardPlanner global |
| Leaflet | 1.9.4 | Map rendering | Already loaded in map.html via unpkg CDN |
| Playwright | (project version) | Browser testing | Existing test infrastructure in worker/test/browser/ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cone-renderer.js | project | renderMiniConeSVG() for flavor cone icons | Quiz image answers for flavor-specific questions |
| quizzes/sprites.js | project | renderPixelSprite(), QuizSprites.resolve() | Quiz image answers for themed questions (sun, storm, owl, etc.) |
| planner-data.js | project | FLAVOR_FAMILIES, FLAVOR_FAMILY_MEMBERS, getFamilyForFlavor() | Map exclusion filter family membership checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dimming excluded markers (opacity) | Hiding markers (remove from layer) | Dimming preferred: user sees what they're filtering, matches compare page pattern where excluded rows remain visible at 0.35 opacity |
| Separate localStorage key per page | Single namespaced key with page prefixes | Separate keys cleaner: prevents cross-page interference, aligns with decision to keep map vs compare exclusions independent |

## Architecture Patterns

### Existing Code to Modify (not create)

```
docs/
  map.html           # Convert flavor-chip JS from positive to exclusion filter
                     # Add localStorage read/write for exclusion state
  quiz.html          # Add CSS for 2x2 image grid layout at mobile breakpoint
  quizzes/engine.js  # Modify multiple_choice rendering for image grid on mobile
  compare-page.js    # Replace custard:v1:preferences usage with new dedicated key
  style.css          # Map exclusion chip CSS (reuse compare-filter-chip pattern)
```

### Pattern 1: Exclusion Chip Toggle (Compare page -- to replicate on Map)
**What:** Set-based exclusion tracking with CSS class toggle and localStorage persistence
**When to use:** Map flavor family filtering
**Example:**
```javascript
// Source: compare-page.js lines 46-77 (existing pattern)
var EXCLUSION_CHIPS = [
  { key: 'mint', label: 'No Mint' },
  { key: 'chocolate', label: 'No Chocolate' },
  // ...
];

var _exclusions = new Set();

function restoreExclusions() {
  try {
    var raw = localStorage.getItem('custard-map-exclusions'); // NEW key for map
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) _exclusions = new Set(arr);
    }
  } catch (e) {}
}

function saveExclusions() {
  try {
    var arr = [];
    _exclusions.forEach(function(key) { arr.push(key); });
    localStorage.setItem('custard-map-exclusions', JSON.stringify(arr));
  } catch (e) {}
}
```

### Pattern 2: Map Marker Dimming (Existing applyFamilyFilter -- to modify)
**What:** Iterate _allMarkers and set opacity based on exclusion state
**When to use:** When exclusion chip is toggled
**Example:**
```javascript
// Source: map.html lines 306-325 (modify existing applyFamilyFilter)
function applyFamilyFilter() {
  if (!window._allMarkers) return;
  for (var i = 0; i < window._allMarkers.length; i++) {
    var entry = window._allMarkers[i];
    var excluded = isStoreExcluded(entry.store); // Check against exclusion set
    entry.marker.setOpacity(excluded ? 0.15 : 1);
  }
}
```

### Pattern 3: Quiz Image Grid (Engine.js -- to enhance)
**What:** When options have icons, render in a 2x2 grid with image above label
**When to use:** mobile_choice rendering when option.icon exists
**Example:**
```javascript
// Source: engine.js lines 474-512 (modify existing multiple_choice block)
// Current: icons render inline next to label text
// New: on mobile, detect icons and switch to image-above-label layout
if (iconSvg) {
  label.classList.add('has-icon');
  // Add 'image-grid' class to parent grid for CSS to target
}
```

### Pattern 4: Compare localStorage Isolation
**What:** Dedicated localStorage key for compare store selections
**When to use:** compare-page.js getSavedStoreSlugs/saveStoreSlugs
**Example:**
```javascript
// Source: compare-page.js lines 128-166 (modify)
// OLD: reads from 'custard:v1:preferences' → activeRoute.stores
// NEW: reads from dedicated key like 'custard:compare:stores'
var COMPARE_STORES_KEY = 'custard:compare:stores';

function getSavedStoreSlugs() {
  try {
    var raw = localStorage.getItem(COMPARE_STORES_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_COMPARE_STORES);
    }
  } catch (e) {}
  return [];
}

function saveStoreSlugs(slugs) {
  try {
    localStorage.setItem(COMPARE_STORES_KEY, JSON.stringify(slugs.slice(0, MAX_COMPARE_STORES)));
  } catch (e) {}
}
```

### Anti-Patterns to Avoid
- **Modifying `custard:v1:preferences` from compare-page.js:** This is the bug that causes store selections to leak into Today page drive preferences. The compare page must use its own key.
- **Rebuilding the multi-store picker:** It already works (lines 528-706). Only verify and fix bugs if found.
- **Positive filter on map:** Decision locks exclusion semantics. Do not keep the "All" chip as a positive "show all" -- use it as "exclude none."
- **Adding new JS files:** All changes go into existing files. No new module files needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG icons for quiz answers | Custom icon rendering | `QuizSprites.resolve(option.icon, scale)` | Already handles "color:" and "pixel:" prefix formats, returns SVG string |
| Flavor family membership | Custom lookup tables | `CustardPlanner.getFamilyForFlavor(flavor)` and `flavorToFamilies` reverse lookup | Already built and tested in planner-data.js |
| Cone SVG rendering | Custom SVG generation | `renderMiniConeSVG(flavorName)` from cone-renderer.js | Handles all flavor color profiles, topping slots, waffle cone rendering |
| Map marker icon building | Custom markers | `buildConeMarkerIcon(store, hasFlavorFilter)` | Existing function with caching, proper anchor points, glow effects |

**Key insight:** Every visual asset needed (pixel sprites, color swatches, cone SVGs) already has a rendering function. The quiz engine already detects `option.icon` and calls `QuizSprites.resolve()`. The work is primarily CSS layout changes and JS logic rewiring, not new rendering code.

## Common Pitfalls

### Pitfall 1: refreshResults() Resets Family Filter State
**What goes wrong:** The current `refreshResults()` function (map.html line 335) resets `activeFamily = 'all'` and re-toggles all chip active states on every refresh (including map pan). Converting to exclusion mode means exclusion state must NOT be reset on refresh.
**Why it happens:** Original positive filter assumed transient selection; exclusion state should persist.
**How to avoid:** Remove the reset block at lines 334-337. Exclusion state is managed by localStorage, not by refresh cycles. Read exclusion state from localStorage on page load, apply on each refresh without resetting.
**Warning signs:** Exclusion chips reset to unselected after panning the map.

### Pitfall 2: Compare Stores Empty on First Visit After Key Change
**What goes wrong:** After switching compare-page.js to a new localStorage key, existing users will see an empty compare page because `custard:compare:stores` doesn't exist yet.
**Why it happens:** Old selections are in `custard:v1:preferences.activeRoute.stores`, new key is empty.
**How to avoid:** Decision says "clean start -- no migration." Accept that users will need to re-select stores. The empty state UI (compare-empty) already exists and shows a "Select stores to compare" CTA.
**Warning signs:** User confusion. Not a code bug -- intentional behavior per CONTEXT.md decision.

### Pitfall 3: AND Logic Between Brand Chips and Exclusion Chips
**What goes wrong:** Exclusion filter must compose with brand filter. A store must pass BOTH filters: brand is active AND flavor family is not excluded.
**Why it happens:** Two independent filter dimensions intersecting.
**How to avoid:** Apply exclusion filter AFTER brand filter in the marker rendering loop. The existing `refreshResults()` already filters by brand before placing markers. Add exclusion check in `applyFamilyFilter()` which runs after markers are placed.
**Warning signs:** Excluded flavors still showing when switching brands.

### Pitfall 4: Quiz Image Grid Breaking on Questions Without Icons
**What goes wrong:** Not all quiz questions have `option.icon` fields. Only 3 of 10+ questions in classic-v1 have icons. Image grid layout should only activate when ALL options in a question have icons.
**Why it happens:** Mixed icon coverage across quiz JSON files (only classic-v1 and weather-v1 have icons; 20 of 100+ total options).
**How to avoid:** Check if ALL options in a question have icons before applying image-grid class. Fall back to standard layout for questions with partial or no icons.
**Warning signs:** Broken layout with empty image slots.

### Pitfall 5: flavor-family-chips Hidden State on Map
**What goes wrong:** The `flavor-family-chips` container starts `hidden` (map.html line 66) and is only shown after results load (line 526). When converting to exclusion chips, they should show regardless of whether results have loaded (user may want to pre-set exclusions).
**Why it happens:** Original design hid chips until there were results to filter.
**How to avoid:** For exclusion chips, show them always (or after first results load and keep visible). Since exclusions persist via localStorage, chips should be visible on load so users see their saved state.
**Warning signs:** Exclusion chips invisible until first search completes.

## Code Examples

### Map Exclusion Chip HTML (replace existing positive-filter chips)
```html
<!-- Source: derived from map.html lines 66-78 + compare-page.js EXCLUSION_CHIPS pattern -->
<!-- Replace data-family="all" radio-style with multi-toggle exclusion chips -->
<div class="compare-filter-bar" id="map-exclusion-chips" role="group" aria-label="Exclude flavor families">
  <button class="compare-filter-chip" data-family="mint">No Mint</button>
  <button class="compare-filter-chip" data-family="chocolate">No Chocolate</button>
  <button class="compare-filter-chip" data-family="caramel">No Caramel</button>
  <button class="compare-filter-chip" data-family="cheesecake">No Cheesecake</button>
  <button class="compare-filter-chip" data-family="peanutButter">No Peanut Butter</button>
  <button class="compare-filter-chip" data-family="pecan">No Nuts</button>
</div>
```

### Quiz Image Grid CSS (mobile 2x2 with image above label)
```css
/* Source: derived from quiz.html .quiz-options-grid pattern */
/* Image grid: when a question has icon-bearing options, stack image above label */
@media (max-width: 840px) {
  .quiz-options-grid.quiz-image-grid {
    grid-template-columns: 1fr 1fr;  /* 2x2 */
  }
  .quiz-image-grid .quiz-option-copy {
    flex-direction: column;
    text-align: center;
    padding: var(--space-3);
  }
  .quiz-image-grid .quiz-option-icon {
    width: 48px;
    height: 48px;
    margin-bottom: var(--space-2);
  }
  .quiz-image-grid .quiz-option-icon svg {
    width: 100%;
    height: 100%;
  }
}
```

### Compare localStorage Key Constants
```javascript
// Source: new pattern based on planner-shared.js key naming convention
// Existing keys:
//   'custard-primary'          -- primary store slug
//   'custard-secondary'        -- secondary store slugs
//   'custard:v1:preferences'   -- drive preferences (Today page)
//   'custard-exclusions'       -- compare page exclusion filters
//   'custard-favorites'        -- saved favorite flavors

// New keys for Phase 12:
//   'custard:compare:stores'   -- compare page store selections (CMPR-01)
//   'custard:map:exclusions'   -- map page exclusion filters (MAP-02)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Positive family filter (select one) | Exclusion filter (deselect many) | Phase 12 | Map chips change from radio to multi-toggle |
| Shared localStorage key (custard:v1:preferences) | Dedicated keys per page concern | Phase 12 | Compare stores isolated from Today drive prefs |
| Text-only quiz options on mobile | Image grid quiz options on mobile | Phase 12 | Visual engagement for icon-bearing quiz questions |

**Key behavioral changes:**
- Map: `activeFamily` single-select variable replaced by `_exclusions` Set
- Map: "All" chip removed; exclusion chips start unselected (nothing excluded)
- Compare: `getSavedStoreSlugs()` reads from new key, not `custard:v1:preferences`
- Compare: `saveStoreSlugs()` writes to new key only, never touches `custard:v1:preferences`

## Open Questions

1. **Map exclusion chip visibility timing**
   - What we know: Currently chips are hidden until results load
   - What's unclear: Should exclusion chips show immediately on page load (before first search)?
   - Recommendation: Show chips after first search completes (consistent with current behavior). Exclusion state still persists and applies via localStorage.

2. **Quiz icon coverage gaps**
   - What we know: Only classic-v1 (12/60 options) and weather-v1 (8/60 options) have icon fields. Most quizzes have zero icons.
   - What's unclear: Should we add icons to more quiz questions in this phase?
   - Recommendation: Only enable image grid for questions where ALL options have icons. Do not add new quiz content (that is not a phase 12 requirement). Image grid will work for the 5 questions that currently have full icon coverage.

3. **Compare store count on first visit after key migration**
   - What we know: Decision says "clean start -- no migration"
   - What's unclear: Whether to bootstrap from primary store to give users something to start with
   - Recommendation: The existing fallback in `getSavedStoreSlugs()` already checks `CustardPlanner.getPrimaryStoreSlug()` as a last resort (compare-page.js line 142). Keep this fallback for the new implementation so users with a primary store at least get one store seeded.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via @playwright/test) |
| Config file | `custard-calendar/worker/playwright.config.mjs` |
| Quick run command | `cd custard-calendar/worker && npx playwright test test/browser/{file} --workers=1` |
| Full suite command | `cd custard-calendar/worker && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Exclusion chips visible, tapping dims markers | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/map-exclusion-filter.spec.mjs --workers=1` | Wave 0 |
| MAP-02 | Exclusion state persists across page reload | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/map-exclusion-persist.spec.mjs --workers=1` | Wave 0 |
| QUIZ-01 | Image grid renders on mobile for icon questions | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/quiz-image-grid.spec.mjs --workers=1` | Wave 0 |
| CMPR-01 | Compare uses own localStorage key, Today unaffected | browser/e2e | `cd custard-calendar/worker && npx playwright test test/browser/compare-localstorage-isolation.spec.mjs --workers=1` | Wave 0 |

### Sampling Rate
- **Per task commit:** Run the specific test file for the feature being implemented
- **Per wave merge:** `cd custard-calendar/worker && npm run test:browser -- --workers=1`
- **Phase gate:** Full browser suite green before verification

### Wave 0 Gaps
- [ ] `test/browser/map-exclusion-filter.spec.mjs` -- covers MAP-01 (exclusion chips toggle, markers dim)
- [ ] `test/browser/map-exclusion-persist.spec.mjs` -- covers MAP-02 (localStorage persistence across reload)
- [ ] `test/browser/quiz-image-grid.spec.mjs` -- covers QUIZ-01 (image grid layout on mobile viewport)
- [ ] `test/browser/compare-localstorage-isolation.spec.mjs` -- covers CMPR-01 (separate key, no Today leaking)

Test patterns should follow existing conventions from `compare-filter.spec.mjs` and `compare-picker.spec.mjs`:
- Mock all API routes (stores.json, flavors, today, geolocate, flavor-config, flavor-colors)
- Set localStorage via `page.evaluate()` before reload
- Use `page.locator()` with CSS selectors and data attributes
- Check computed styles for opacity/display changes

## Sources

### Primary (HIGH confidence)
- `docs/map.html` lines 66-325 -- existing flavor family chip HTML, JS filtering logic
- `docs/compare-page.js` lines 46-77, 386-455, 528-706 -- exclusion chip pattern, filter rendering, multi-store picker
- `docs/quizzes/engine.js` lines 474-512 -- multiple_choice rendering with icon support
- `docs/quizzes/sprites.js` -- QuizSprites.resolve() API, all available sprites
- `docs/planner-data.js` lines 134-282 -- FLAVOR_FAMILIES constant, getFamilyForFlavor()
- `docs/style.css` lines 3483-3514 -- compare-filter-chip CSS
- `docs/quiz.html` lines 163-210, 435-441 -- quiz option grid CSS, 840px breakpoint
- `docs/planner-shared.js` lines 21-25 -- localStorage key constants
- `worker/test/browser/compare-filter.spec.mjs` -- test pattern for exclusion chip tests
- `worker/test/browser/compare-picker.spec.mjs` -- test pattern for multi-store picker tests

### Secondary (MEDIUM confidence)
- Quiz JSON files icon coverage analysis: classic-v1 (12 icons), weather-v1 (8 icons), others (0 icons)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code exists in the repo, patterns are well-established
- Architecture: HIGH - three features map directly to existing code with clear modification points
- Pitfalls: HIGH - identified from reading actual source code, not speculative

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase, static HTML/CSS/JS)
