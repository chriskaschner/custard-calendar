# Phase 12: Feature Development - Research

**Researched:** 2026-03-09
**Domain:** Browser-side vanilla JS feature development (Leaflet map filtering, quiz UI, localStorage state management)
**Confidence:** HIGH

## Summary

Phase 12 implements three independent frontend features on the existing GitHub Pages static site: (1) map exclusion chips for flavor family filtering with localStorage persistence, (2) image-based quiz answer options on mobile, and (3) compare page localStorage isolation to prevent state leakage into Today page drive preferences. All three features build on well-established patterns already present in the codebase.

The key finding is that existing code provides strong templates for all three features. The compare page already has a working exclusion chip system (`compare-page.js` lines 46-54, 387-455) that the map feature can directly replicate. The quiz engine already resolves `icon` fields via `QuizSprites.resolve()` and renders them inline -- the main work is CSS layout changes. The compare page's localStorage leak is isolated to `getSavedStoreSlugs()` and `saveStoreSlugs()` functions (lines 128-166) which read/write `custard:v1:preferences` instead of a dedicated key.

**Primary recommendation:** Execute three parallel plans with no shared code changes. Each feature has a clear existing pattern to follow and its own set of files.

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
| MAP-01 | User can filter map markers by flavor family using exclusion chips | Compare page exclusion chip pattern fully documented; map.html has existing positive-filter chips to convert; FLAVOR_FAMILIES constant available via CustardPlanner |
| MAP-02 | Map exclusion filter state persists across page loads via localStorage | Compare page `restoreExclusions()`/`saveExclusions()` pattern provides exact template; separate key required |
| QUIZ-01 | User sees image-based answer options for quiz questions on mobile | engine.js already renders icons via QuizSprites.resolve(); only 2 of 7 quiz JSONs have icons; CSS grid change from 1fr to 2-column with image-above-label layout |
| CMPR-01 | User can compare flavors across multiple stores side-by-side | Multi-store picker already built (lines 528-706); day-first card stack works; localStorage isolation from custard:v1:preferences is the core fix |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES5/var style | All three features | Project convention: IIFE pattern, no build step, `var` throughout |
| Leaflet | 1.9.4 | Map markers/filtering | Already loaded in map.html via CDN |
| CSS custom properties | N/A | Design tokens | `:root` vars used everywhere (--brand, --border, --radius-full, etc.) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CustardPlanner | N/A | Shared module (normalize, FLAVOR_FAMILIES, escapeHtml) | All flavor family lookups go through this |
| QuizSprites | N/A | Pixel art SVG renderer | Already used in engine.js for quiz option icons |
| cone-renderer.js | N/A | renderMiniConeSVG() | Available for flavor-specific quiz image options |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS localStorage | localForage | Over-engineered for simple key-value; project uses raw localStorage everywhere |
| CSS media queries | Container queries | Not needed; `@media (max-width: 840px)` is the established breakpoint |

## Architecture Patterns

### Relevant Project Structure
```
docs/
  map.html              # Map page (inline script ~960 lines)
  compare-page.js       # Compare page IIFE module
  compare.html          # Compare page HTML
  quiz.html             # Quiz page with inline styles
  quizzes/
    engine.js           # Quiz engine (ES module)
    sprites.js          # Pixel art sprite renderer
    quiz-*.json         # Quiz config files (7 variants)
  planner-data.js       # FLAVOR_FAMILIES, FLAVOR_FAMILY_MEMBERS, normalize()
  planner-domain.js     # saveDrivePreferences(), getPrimaryStoreSlug()
  planner-shared.js     # DRIVE_PREFERENCES_KEY, escapeHtml, core utils
  style.css             # Global styles with design tokens
```

### Pattern 1: Exclusion Chip Toggle (from compare-page.js)
**What:** Set-based add/delete with CSS class toggling and localStorage persistence
**When to use:** Map exclusion chips (replicating compare page pattern)
**Example:**
```javascript
// Source: docs/compare-page.js lines 56-78
var _exclusions = new Set();

function restoreExclusions() {
  try {
    var raw = localStorage.getItem('custard-exclusions');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        _exclusions = new Set(arr);
      }
    }
  } catch (e) {}
}

function saveExclusions() {
  try {
    var arr = [];
    _exclusions.forEach(function (key) { arr.push(key); });
    localStorage.setItem('custard-exclusions', JSON.stringify(arr));
  } catch (e) {}
}
```

### Pattern 2: Flavor Family Membership Lookup (from planner-data.js)
**What:** Normalize flavor name, look up in reverse index
**When to use:** Determining if a map marker's flavor belongs to an excluded family
**Example:**
```javascript
// Source: docs/planner-data.js lines 271-279
function getFamilyForFlavor(flavorName) {
  if (!flavorName) return null;
  var n = flavorName.toLowerCase()
    .replace(/[\u00ae\u2122\u00a9]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  var families = _flavorToFamilies[n];
  return families ? families[0] : null;
}
// Available as CustardPlanner.getFamilyForFlavor()
```

### Pattern 3: Quiz Option Icon Resolution (from engine.js)
**What:** Quiz options with an `icon` field are resolved via QuizSprites.resolve()
**When to use:** Existing pattern in engine.js multiple_choice rendering
**Example:**
```javascript
// Source: docs/quizzes/engine.js lines 488-503
const iconSvg = option.icon && window.QuizSprites
  ? window.QuizSprites.resolve(option.icon, 4) : '';
if (iconSvg) {
  label.classList.add('has-icon');
  const iconEl = document.createElement('span');
  iconEl.className = 'quiz-option-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.innerHTML = iconSvg;
  copy.appendChild(iconEl);
}
```

### Anti-Patterns to Avoid
- **Modifying `custard:v1:preferences` from compare page:** This is the state leak bug. Compare must use its own localStorage key.
- **Using `activeFamily` single-select pattern for exclusion:** Map currently uses a single `activeFamily` variable (line 192). Exclusion requires a Set, not a single value.
- **Resetting family filter on every `refreshResults` call:** Map's current `refreshResults()` (lines 333-336) resets `activeFamily = 'all'` on every call. Exclusion state must persist through refreshes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flavor family membership lookup | Custom normalize + lookup | `CustardPlanner.getFamilyForFlavor()` | Already handles normalization, registered marks, reverse index |
| SVG icon rendering | Custom SVG builder | `QuizSprites.resolve()` for sprites, `renderMiniConeSVG()` for cones | Both already tested and used across the site |
| Exclusion chip CSS | New chip styles | Existing `.compare-filter-chip` classes from style.css | Same design per locked decision; avoid style drift |
| localStorage read/write pattern | Bare getItem/setItem | try/catch + JSON.parse/stringify pattern used everywhere | localStorage can throw (private browsing, storage full) |

**Key insight:** Every feature in this phase has a working template already in the codebase. The work is adaptation and wiring, not invention.

## Common Pitfalls

### Pitfall 1: Map family filter state reset on refreshResults
**What goes wrong:** The current `refreshResults()` function (map.html lines 333-336) resets `activeFamily = 'all'` and re-highlights the "All" chip on every call. If exclusion state is stored the same way, it gets wiped on every search/pan.
**Why it happens:** The positive filter pattern was designed as temporary -- user selects a family, views results, then filter resets on next search.
**How to avoid:** Exclusion state must live in a `Set` that persists through `refreshResults()` calls and is restored from localStorage on page load. Remove the reset logic for the new exclusion flow.
**Warning signs:** Exclusion chips reset to unselected after panning the map or changing location.

### Pitfall 2: Compare localStorage leaking into Today page
**What goes wrong:** `saveStoreSlugs()` in compare-page.js (line 149-166) writes to `custard:v1:preferences`, which is the same key that Today page / todays-drive.js uses for drive route preferences. Adding stores on the compare page overwrites `activeRoute.stores` used by the Today page.
**Why it happens:** Compare was built to reuse the existing preferences structure rather than having its own storage key.
**How to avoid:** Give compare its own localStorage key (e.g., `custard:compare:stores`). Read/write only that key. Do not call `CustardPlanner.saveDrivePreferences()` from compare-page.js.
**Warning signs:** After using compare, the Today page shows different saved stores than expected.

### Pitfall 3: Quiz icon coverage gaps
**What goes wrong:** Only 2 of 7 quiz JSON files include `icon` fields (weather-v1 and classic-v1). If the image grid layout requires icons, 5 quizzes will look broken.
**Why it happens:** Icons were added to quizzes that had natural visual themes (weather, animals/instruments/colors) but not to personality/compatibility quizzes where options are text-heavy.
**How to avoid:** The image grid layout must gracefully degrade when no icon is present -- show text-only options in the same grid layout. Only show image-above-label when `option.icon` exists.
**Warning signs:** Empty icon slots or broken layout for quizzes without icon data.

### Pitfall 4: Map marker opacity vs. visibility
**What goes wrong:** Choosing to fully hide excluded markers (remove from layer) causes confusion -- users think stores disappeared. Choosing to dim them (opacity) can still clutter the map.
**Why it happens:** Compare page uses opacity 0.35 + pointer-events:none for excluded rows. Map markers have different visual weight considerations.
**How to avoid:** Use the compare page's established pattern: dim to opacity 0.15-0.35, disable interaction. The map already uses opacity 0.15 for family-filtered markers (line 317 in current `applyFamilyFilter()`).
**Warning signs:** Users confused about missing stores or unable to interact with unfiltered stores due to overlapping dimmed markers.

### Pitfall 5: Mobile breakpoint conflict in quiz
**What goes wrong:** quiz.html's existing `@media (max-width: 840px)` changes `.quiz-options-grid` from `1fr 1fr` to `1fr` (single column). The new image grid wants `1fr 1fr` (2x2) on mobile.
**Why it happens:** The existing media query was designed for text-only options where single column is better on mobile.
**How to avoid:** The image grid layout needs its own class or modifier (e.g., `.quiz-options-grid--image`) that preserves `grid-template-columns: 1fr 1fr` on mobile. Or conditionally apply the 2x2 grid only when icons are present.
**Warning signs:** Image grid collapses to single column on mobile despite wanting 2x2 layout.

## Code Examples

### Map Exclusion: Converting Positive Filter to Exclusion Filter
```javascript
// Current positive filter (map.html lines 288-296, 298-325):
// Uses single activeFamily variable, "All" is default, one family at a time
// New pattern: Set-based exclusion, multiple families can be excluded

var mapExclusions = new Set();
var MAP_EXCLUSION_KEY = 'custard:map:exclusions'; // separate from compare

function restoreMapExclusions() {
  try {
    var raw = localStorage.getItem(MAP_EXCLUSION_KEY);
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) mapExclusions = new Set(arr);
    }
  } catch (e) {}
}

function saveMapExclusions() {
  try {
    var arr = [];
    mapExclusions.forEach(function(k) { arr.push(k); });
    localStorage.setItem(MAP_EXCLUSION_KEY, JSON.stringify(arr));
  } catch (e) {}
}

function storeMatchesExclusions(store) {
  if (mapExclusions.size === 0) return false;
  if (!store.flavor) return false;
  var family = CustardPlanner.getFamilyForFlavor(store.flavor);
  return family ? mapExclusions.has(family) : false;
}
```

### Map Exclusion: Applying to Markers
```javascript
// Replaces current applyFamilyFilter() pattern
// Source pattern: map.html lines 306-325
function applyMapExclusions() {
  if (!window._allMarkers) return;
  for (var i = 0; i < window._allMarkers.length; i++) {
    var entry = window._allMarkers[i];
    var excluded = storeMatchesExclusions(entry.store);
    entry.marker.setOpacity(excluded ? 0.15 : 1);
  }
}
```

### Compare: Isolated localStorage
```javascript
// Replace custard:v1:preferences reads/writes with dedicated key
var COMPARE_STORES_KEY = 'custard:compare:stores';

function getSavedStoreSlugs() {
  try {
    var raw = localStorage.getItem(COMPARE_STORES_KEY);
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.slice(0, MAX_COMPARE_STORES);
    }
  } catch (e) {}
  // Fallback: seed from Today page's primary store (read-only, no write-back)
  try {
    var primary = CustardPlanner.getPrimaryStoreSlug();
    if (primary) return [primary];
  } catch (e) {}
  return [];
}

function saveStoreSlugs(slugs) {
  try {
    localStorage.setItem(COMPARE_STORES_KEY, JSON.stringify(slugs.slice(0, MAX_COMPARE_STORES)));
  } catch (e) {}
}
```

### Quiz: Image Grid CSS
```css
/* Mobile image grid for quiz options with icons */
@media (max-width: 840px) {
  .quiz-options-grid.has-icons {
    grid-template-columns: 1fr 1fr;
  }
  .quiz-options-grid.has-icons .quiz-option-copy {
    flex-direction: column;
    text-align: center;
    padding: 0.75rem 0.5rem;
  }
  .quiz-options-grid.has-icons .quiz-option-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 0.35rem;
  }
  .quiz-options-grid.has-icons .quiz-option-icon svg {
    width: 100%;
    height: 100%;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-select positive family filter on map | Multi-toggle exclusion chips | Phase 12 (this phase) | Matches compare page UX pattern |
| Compare stores stored in custard:v1:preferences | Dedicated custard:compare:stores key | Phase 12 (this phase) | Eliminates state leak into Today page |
| Text-only quiz options on mobile | Image-above-label 2x2 grid | Phase 12 (this phase) | Better visual engagement on mobile |

**Deprecated/outdated:**
- `activeFamily` single-select variable in map.html: Replaced by Set-based exclusion
- Compare page writing to `custard:v1:preferences`: Replaced by dedicated key

## Open Questions

1. **Map chip HTML structure**
   - What we know: Current HTML (lines 66-78) has `.flavor-family-chips` with positive-filter chips ("All", "Mint", "Chocolate", etc.)
   - What's unclear: Whether to modify existing HTML in-place or rebuild the chip container with new exclusion labels ("No Mint", "No Chocolate")
   - Recommendation: Modify in-place. Change data attributes from family names to exclusion keys, update labels to "No [Family]" pattern, remove the "All" chip (exclusion model has no "All" toggle -- zero exclusions = show all)

2. **Quiz icon scale for image grid**
   - What we know: Current sprites render at scale 4 (4px per pixel = 32x40px SVG). renderMiniConeSVG defaults to 4px scale.
   - What's unclear: Whether scale 4 is large enough for a 2x2 grid cell on a 375px screen (~160px per cell)
   - Recommendation: Increase sprite scale to 6 (48x60px) for the image grid context. Add a `scale` parameter override.

3. **Compare page verification scope**
   - What we know: Multi-store picker (lines 528-706), day-first card stack, and exclusion filters all have existing Playwright tests (compare-picker.spec.mjs, compare-grid.spec.mjs, compare-filter.spec.mjs)
   - What's unclear: Whether visual bugs exist beyond the localStorage leak
   - Recommendation: Run existing tests first, fix only what fails. The localStorage refactor is the confirmed mandatory work.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via worker/node_modules) |
| Config file | `worker/playwright.config.mjs` |
| Quick run command | `cd worker && npx playwright test test/browser/{spec_file} --workers=1` |
| Full suite command | `cd worker && npx playwright test --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Exclusion chips filter map markers by flavor family | browser/e2e | `cd worker && npx playwright test test/browser/map-exclusion-chips.spec.mjs --workers=1` | No - Wave 0 |
| MAP-02 | Map exclusion state persists via localStorage | browser/e2e | `cd worker && npx playwright test test/browser/map-exclusion-persist.spec.mjs --workers=1` | No - Wave 0 |
| QUIZ-01 | Image-based answer grid on mobile viewport | browser/e2e | `cd worker && npx playwright test test/browser/quiz-image-grid.spec.mjs --workers=1` | No - Wave 0 |
| CMPR-01 | Compare stores saved in dedicated key, no Today page leak | browser/e2e | `cd worker && npx playwright test test/browser/compare-storage-isolation.spec.mjs --workers=1` | No - Wave 0 |

### Existing Related Tests
| Spec File | What It Covers | Relevant? |
|-----------|---------------|-----------|
| compare-filter.spec.mjs | COMP-05/06: exclusion chip toggle on compare page | Pattern reference (not directly testing map) |
| compare-picker.spec.mjs | Multi-store picker modal | Regression safety for CMPR-01 refactor |
| compare-grid.spec.mjs | Day-first card stack rendering | Regression safety for CMPR-01 refactor |
| compare-expand.spec.mjs | Accordion expand on compare rows | Regression safety for CMPR-01 refactor |
| quiz-personality.spec.mjs | End-to-end quiz flow | Regression safety for QUIZ-01 changes |
| map-pan-stability.spec.mjs | Map pan/zoom stability | Regression safety for MAP-01 changes |

### Sampling Rate
- **Per task commit:** `cd worker && npx playwright test test/browser/{changed_spec} --workers=1`
- **Per wave merge:** `cd worker && npx playwright test --workers=1`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/browser/map-exclusion-chips.spec.mjs` -- covers MAP-01 (exclusion chip toggle dims markers)
- [ ] `worker/test/browser/map-exclusion-persist.spec.mjs` -- covers MAP-02 (localStorage persistence across reload)
- [ ] `worker/test/browser/quiz-image-grid.spec.mjs` -- covers QUIZ-01 (2x2 image grid at mobile viewport)
- [ ] `worker/test/browser/compare-storage-isolation.spec.mjs` -- covers CMPR-01 (dedicated localStorage key, no leak to custard:v1:preferences)

## Sources

### Primary (HIGH confidence)
- `docs/map.html` -- Full inline script reviewed (lines 66-78 chips HTML, 173-325 family filter JS, 288-296 chip wiring)
- `docs/compare-page.js` -- Complete IIFE module reviewed (943 lines: exclusion pattern, localStorage, multi-store picker)
- `docs/quizzes/engine.js` -- buildQuestionUI function reviewed (lines 350-517: icon rendering, grid layout)
- `docs/quizzes/sprites.js` -- Full sprite renderer reviewed (333 lines: palette, sprites, resolveQuizIcon)
- `docs/planner-data.js` -- FLAVOR_FAMILIES, FLAVOR_FAMILY_MEMBERS, getFamilyForFlavor reviewed
- `docs/planner-shared.js` -- DRIVE_PREFERENCES_KEY constant, core utils
- `docs/planner-domain.js` -- saveDrivePreferences, getPrimaryStoreSlug, _writeDrivePrefsToStorage
- `docs/style.css` -- .flavor-chip, .compare-filter-chip, .compare-excluded CSS classes
- `docs/quiz.html` -- Inline quiz styles including @media breakpoint at 840px
- `worker/playwright.config.mjs` -- Test runner configuration
- `worker/test/browser/compare-filter.spec.mjs` -- Existing exclusion filter tests (pattern reference)
- `worker/test/browser/compare-picker.spec.mjs` -- Existing picker tests
- `worker/test/browser/quiz-personality.spec.mjs` -- Existing quiz e2e test

### Secondary (MEDIUM confidence)
- Quiz JSON icon coverage: 2 of 7 files have `icon` fields (weather-v1 and classic-v1); confirmed by grep

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code reviewed in-situ, no external libraries needed
- Architecture: HIGH - existing patterns provide exact templates for all three features
- Pitfalls: HIGH - identified from direct code analysis (state reset bug, localStorage leak, icon coverage gaps)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable codebase, no external dependency changes expected)
