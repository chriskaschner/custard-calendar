# Phase 5: Visual Polish - Research

**Researched:** 2026-03-08
**Domain:** CSS design tokens, cone asset rendering tiers, seasonal rarity logic, card system unification
**Confidence:** HIGH

## Summary

Phase 5 is a presentation-layer polish pass across four navigation pages (Today, Compare, Map, Fun). The work decomposes into four distinct streams: (1) defining CSS custom property design tokens and collapsing ~36 unique font sizes down to ~8, (2) unifying 7+ card-like class families under a shared `.card` base, (3) introducing a hero-level pre-rendered PNG cone asset pipeline while keeping existing SVG renderers for compact contexts, and (4) adding client-side seasonal flavor detection to suppress misleading cadence text.

The codebase is vanilla JS/CSS with no build step, served from `docs/` via GitHub Pages. All existing card styles are in `style.css` (3,444 lines). The cone renderer (`cone-renderer.js`) provides `renderMiniConeSVG()` (9x11 grid) and `renderMiniConeHDSVG()` (18x22 grid) at various scale factors. Rarity data flows from the Worker's D1 database through `/api/v1/today` (which returns `rarity.avg_gap_days` and `rarity.label` but NOT `tags`), and cadence text is rendered client-side in `today-page.js` and `compare-page.js`. Worker API changes are out of scope, so seasonal detection must happen client-side.

**Primary recommendation:** Work in three waves -- (1) design tokens + card base, (2) seasonal rarity suppression, (3) hero cone asset pipeline -- to minimize risk of cross-cutting CSS regressions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Shared `.card` base class with consistent border-radius, background, shadow, and padding
- Variants via modifier classes (`.card--compare`, `.card--store`, `.card--quiz`, etc.) for context-specific needs
- All 4 nav pages adopt the base: heavier treatment on Today/Compare/Fun, lighter on Map
- Hero card on Today uses the same `.card` base, scaled up with larger padding and layout -- same family, not a separate system
- Map store popup cards keep brand-colored left borders (Culver's blue, Kopp's black, etc.) as a Map-specific variant -- functional for brand identification
- Hero context (Today page main card): pre-rendered detailed pixel art PNGs stored in `docs/assets/cones/{flavor-slug}.png`
- Pixel art style: detailed with visible pixels, berries/swirls/crosshatch detail -- NOT photorealistic, NOT the low-res chunky SVG
- Compact contexts (Compare cells, Map markers, multi-store row, week-ahead): keep existing SVG mini renderer -- pixel art works well at 32-40px
- Fallback: if a pre-rendered hero PNG is missing (e.g., newly added flavor), fall back to HD SVG renderer
- ~176 flavor assets committed to repo (~10-18MB total)
- Suppress misleading cadence claims for seasonal flavors -- do NOT show "only every N days!" or "overdue!" for seasonal flavors during off-season
- Use existing `seasonal` tag from Worker signals.js to identify seasonal flavors -- no new data source needed
- Keep rarity badges (Rare/Ultra Rare) for seasonal flavors based on avg_gap_days -- the badge stays, just the cadence text is suppressed
- Non-seasonal flavors: no change to current rarity badge + cadence text behavior
- Define CSS custom property design tokens for font sizes, spacing, and colors
- Collapse ~38 unique font sizes to ~8 token sizes (--text-xs through --text-xl)
- 3 text color levels: --text-primary (#1a1a1a), --text-muted (#666), --text-subtle (#999)
- Spacing tokens (--space-1 through --space-6) for consistent rhythm
- Scope: 4 nav destination pages (Today, Compare, Map, Fun) adopt tokens
- Legacy pages (quiz.html, radar.html, scoop.html, etc.) inherit var definitions from style.css but are NOT actively migrated
- Keep system font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif) -- no web fonts

### Claude's Discretion
- Exact border-radius, shadow, and padding values for .card base
- Hero cone asset generation approach (AI generation, programmatic, or hybrid)
- Exact font size token values in the 8-step scale
- Exact spacing token values
- Card variant-specific overrides beyond the base
- Loading skeleton updates for unified card system
- Error state visual consistency

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIZP-01 | Consistent cone rendering tier used across all homepage elements | Cone renderer analysis (cone-renderer.js), asset tier mapping, hero PNG fallback pattern |
| VIZP-02 | Unified card system with shared border, background, spacing, and typography | 7 existing card families identified in style.css, token system design, .card base class pattern |
| VIZP-03 | Rarity/overdue copy accounts for seasonality (suppress misleading cadence claims for seasonal flavors) | API response analysis showing tags NOT in /api/v1/today, client-side SEASONAL_PATTERN approach, integration points in today-page.js and compare-page.js |
| VIZP-04 | Cone asset quality pipeline from low-res Tidbyt tier up to hero-level pixel art per context | Existing sprite system (244 files in assets/sprites/), ASSET_SPEC.md tier definitions, hero PNG directory structure |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | CSS3 native | Design tokens for typography, spacing, color | No build step required, supported by all target browsers, inheritable |
| Vanilla JS | ES5 (var-based) | Client-side seasonal detection | Matches existing codebase pattern (no build step, IIFE modules) |
| Playwright | 1.x (existing) | Visual regression + behavior tests | Already configured in worker/playwright.config.mjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cone-renderer.js | existing | Mini/HD SVG generation for compact contexts | Compare cells (32px), Map markers, multi-store row, week-ahead strip |
| planner-shared.js | existing | Rarity label + cadence text formatting | Seasonal suppression logic hooks into formatCadenceText() and rarityLabelFromGapDays() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Custom Properties | CSS preprocessor (Sass) | Would add build step -- violates no-build-step constraint |
| Client-side seasonal regex | Worker API extension | Would require Worker changes -- out of scope per requirements |
| Pre-rendered PNGs | Higher-res SVG renderer | User explicitly rejected: "terrible at higher resolutions" -- scaling up HD SVG produces output "not visually differentiable from the much lower-res Tidbyt version" |

## Architecture Patterns

### Recommended Project Structure
```
docs/
  style.css               # Design tokens at :root, .card base, card variants
  cone-renderer.js        # Add heroConeSrc() function for PNG lookup + HD SVG fallback
  planner-shared.js       # Add isSeasonalFlavor() and seasonal-aware cadence suppression
  today-page.js           # Consume hero cone, apply .card classes
  compare-page.js         # Apply .card classes, seasonal cadence suppression
  assets/
    cones/                # NEW: ~176 hero-level pixel art PNGs
      {flavor-slug}.png   # e.g., chocolate-eclair.png, butter-pecan.png
```

### Pattern 1: Design Token Cascade
**What:** Define tokens at `:root` in style.css, consume via `var()` in all rules on 4 nav pages.
**When to use:** Every typography, spacing, and color value on Today, Compare, Map, Fun.
**Example:**
```css
/* Source: style.css :root block (extend existing vars) */
:root {
  /* Existing */
  --brand: #005696;
  --text: #1a1a1a;
  --text-muted: #666;
  --bg: #fafafa;
  --border: #ddd;
  --radius: 0.5rem;

  /* NEW: Typography scale */
  --text-xs: 0.6875rem;   /* 11px -- badges, fine print */
  --text-sm: 0.75rem;     /* 12px -- secondary labels */
  --text-base: 0.875rem;  /* 14px -- body text */
  --text-md: 1rem;        /* 16px -- section headers */
  --text-lg: 1.125rem;    /* 18px -- card titles */
  --text-xl: 1.5rem;      /* 24px -- page titles */
  --text-2xl: 1.75rem;    /* 28px -- hero flavor name */
  --text-3xl: 2rem;       /* 32px -- reserved for emphasis */

  /* NEW: Spacing scale */
  --space-1: 0.25rem;     /* 4px */
  --space-2: 0.5rem;      /* 8px */
  --space-3: 0.75rem;     /* 12px */
  --space-4: 1rem;        /* 16px */
  --space-5: 1.5rem;      /* 24px */
  --space-6: 2rem;        /* 32px */

  /* NEW: Text color levels */
  --text-primary: #1a1a1a;
  --text-muted: #666;      /* already exists -- kept */
  --text-subtle: #999;
}
```

### Pattern 2: Card Base + Variant Modifiers
**What:** Shared `.card` class for all card-like elements, variants via BEM-style modifier classes.
**When to use:** Any card-like container on the 4 nav pages.
**Example:**
```css
/* Base card */
.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-4);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Today hero: same base, scaled up */
.card--hero {
  padding: var(--space-5);
}

/* Compare day card: override for grouped layout */
.card--compare-day {
  padding: 0;      /* header + rows handle their own padding */
  overflow: hidden;
}

/* Map popup: brand-colored left border */
.card--map-store {
  padding: var(--space-3);
  border-left: 4px solid var(--brand);
}
.card--map-store.brand-kopps { border-left-color: #000; }
.card--map-store.brand-oscars { border-left-color: #BC272C; }
```

### Pattern 3: Hero Cone Asset Lookup with Fallback
**What:** Check for pre-rendered PNG first, fall back to HD SVG renderer.
**When to use:** Today page hero card cone display.
**Example:**
```javascript
/* In cone-renderer.js or today-page.js */
function heroConeSrc(flavorName) {
  if (!flavorName) return null;
  var slug = flavorName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return 'assets/cones/' + slug + '.png';
}

function renderHeroCone(flavorName, container) {
  var src = heroConeSrc(flavorName);
  if (!src) {
    container.innerHTML = renderMiniConeHDSVG(flavorName, 8);
    return;
  }
  var img = new Image();
  img.alt = flavorName + ' cone';
  img.className = 'hero-cone-img';
  img.src = src;
  img.onerror = function() {
    // PNG missing -- fall back to HD SVG
    container.innerHTML = renderMiniConeHDSVG(flavorName, 8);
  };
  container.innerHTML = '';
  container.appendChild(img);
}
```

### Pattern 4: Client-Side Seasonal Detection
**What:** Mirror the Worker's SEASONAL_PATTERN regex on the client to suppress cadence text.
**When to use:** Before rendering cadence text on Today page and Compare page.
**Example:**
```javascript
/* In planner-shared.js */
var SEASONAL_PATTERN = /\b(pumpkin|peppermint|eggnog|holiday|gingerbread|apple\s*cider)\b/i;

function isSeasonalFlavor(flavorName) {
  if (!flavorName) return false;
  return SEASONAL_PATTERN.test(String(flavorName));
}
```

### Anti-Patterns to Avoid
- **Creating a separate hero card system:** The Today hero card MUST use the same `.card` base as other cards, just with a `.card--hero` modifier. Do not create `.hero-card` as a standalone class family.
- **Migrating legacy pages:** quiz.html, radar.html, scoop.html, calendar.html, widget.html, siri.html, alerts.html inherit token definitions from style.css `:root` but are NOT actively converted. Do not touch their HTML or class names.
- **Adding Worker API endpoints:** The `seasonal` tag detection must happen client-side. Do not modify route-today.js or any Worker source.
- **Replacing compact SVG renderers:** The existing `renderMiniConeSVG()` and `renderMiniConeHDSVG()` are correct for compact contexts (32-40px). Only the hero context (Today page main card) gets the pre-rendered PNG upgrade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flavor slug normalization | Custom normalization | Mirror `normalizeFlavorKey()` from cone-renderer.js | Already handles unicode quotes, TM/R symbols, whitespace |
| Seasonal detection | D1 query or new API | Client-side regex mirroring `SEASONAL_PATTERN` from worker/src/flavor-tags.js | Worker changes out of scope; name-based pattern catches pumpkin/eggnog/gingerbread/peppermint/holiday/apple cider |
| Image loading with fallback | Complex retry logic | Simple `img.onerror` fallback to HD SVG | Standard browser API, zero dependencies |
| Design token scale | Manual calculation | 8-step type scale based on existing `rem` values | Cluster analysis of 36 existing sizes maps cleanly to 8 tokens |

**Key insight:** This phase is about consolidation, not creation. The building blocks (CSS vars, cone renderers, rarity functions) already exist. The work is refactoring scattered patterns into a unified system.

## Common Pitfalls

### Pitfall 1: Breaking Legacy Pages
**What goes wrong:** Changing existing CSS class names in style.css breaks radar.html, scoop.html, calendar.html, etc.
**Why it happens:** Legacy pages use the same style.css but are not actively maintained in this phase.
**How to avoid:** Never rename or remove existing classes. Only ADD new `.card` class and modifiers. Apply `.card` by adding the class to HTML elements on the 4 nav pages; legacy pages never get the new class added.
**Warning signs:** Any `git diff` showing deleted CSS rules in style.css.

### Pitfall 2: Cadence Suppression Misses Compare Page
**What goes wrong:** Seasonal suppression is added to today-page.js but not compare-page.js, leaving misleading "only every N days!" text on the Compare page.
**Why it happens:** There are TWO independent code paths that render cadence text:
  - `today-page.js` lines 331-338 (today hero card rarity section)
  - `compare-page.js` lines 286-295 (compare detail panel rarity text)
**How to avoid:** Both call sites must check `isSeasonalFlavor(flavorName)` before rendering cadence text.
**Warning signs:** Tests must cover BOTH pages with a seasonal flavor mock.

### Pitfall 3: SEASONAL_PATTERN Divergence
**What goes wrong:** Client-side seasonal regex drifts from Worker's `worker/src/flavor-tags.js` SEASONAL_PATTERN.
**Why it happens:** Two copies of the same regex in different files.
**How to avoid:** Add a code comment in planner-shared.js referencing the canonical source: `// Mirrors SEASONAL_PATTERN from worker/src/flavor-tags.js -- keep in sync`.
**Warning signs:** Seasonal flavors showing cadence text on one page but not another.

### Pitfall 4: Hero PNG Cache Explosion
**What goes wrong:** ~176 PNG files added to STATIC_ASSETS in sw.js causes service worker install to time out or consume excessive device storage.
**Why it happens:** Current STATIC_ASSETS has 29 entries; adding 176 PNGs would 7x the pre-cache size.
**How to avoid:** Do NOT add hero PNGs to STATIC_ASSETS. Use a runtime cache strategy instead: if the cone is needed, fetch it; the service worker's `fetch` handler can cache it opportunistically. Only today's flavor's cone needs to load, not all 176.
**Warning signs:** sw.js STATIC_ASSETS array growing past ~35 entries.

### Pitfall 5: Token Migration Scope Creep
**What goes wrong:** Attempting to replace ALL 36 font sizes in one pass causes hard-to-review diffs and visual regressions.
**Why it happens:** style.css is 3,444 lines with ~160 font-size declarations.
**How to avoid:** Only tokenize font-size declarations on the 4 nav pages' styles. Legacy page styles (radar, scoop, calendar, etc.) keep hardcoded values. Many of the oddball sizes (0.67rem, 0.72rem, 0.78rem, etc.) belong to legacy pages or quiz engine styling.
**Warning signs:** Modifying font-size in CSS sections labeled "Radar", "Calendar", "Scoop", or quiz-related.

### Pitfall 6: Card Migration Breaking Map Popups
**What goes wrong:** Applying `.card` base to map store popup cards overrides the existing Leaflet popup styling.
**Why it happens:** Map popups use `.store-popup` with Leaflet-managed DOM, and adding `.card` may conflict with Leaflet's `.leaflet-popup-content` sizing.
**How to avoid:** Map store popups should use `.card--map-store` variant with minimal overrides. Test the map page specifically after card changes. The brand-colored left borders are functional (brand identification) and must be preserved.
**Warning signs:** Map popup layout breaking or brand borders disappearing.

## Code Examples

### Current Rarity Rendering (today-page.js, lines 329-342)
```javascript
// Source: docs/today-page.js
var html = '';
if (rarity.label) {
  var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
  html += '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
  if (rarity.avg_gap_days) {
    html += 'Shows up roughly every ' + rarity.avg_gap_days + ' days at your store';
  }
} else if (rarity.avg_gap_days) {
  html += 'Back in about ' + rarity.avg_gap_days + ' days';
}
```

### Seasonal Suppression (to be added)
```javascript
// The badge stays. Only the cadence TEXT is suppressed.
if (rarity.label) {
  var cssClass = 'rarity-badge rarity-badge-' + rarity.label.toLowerCase().replace(/\s+/g, '-');
  html += '<span class="' + cssClass + '">' + escapeHtml(rarity.label) + '</span>';
  if (rarity.avg_gap_days && !isSeasonalFlavor(flavorName)) {
    html += 'Shows up roughly every ' + rarity.avg_gap_days + ' days at your store';
  }
} else if (rarity.avg_gap_days && !isSeasonalFlavor(flavorName)) {
  html += 'Back in about ' + rarity.avg_gap_days + ' days';
}
```

### Current Compare Rarity Rendering (compare-page.js, lines 284-295)
```javascript
// Source: docs/compare-page.js
if (dateStr === todayStr && data && data.today && data.today.rarity) {
  var rarity = data.today.rarity;
  var gap = rarity.avg_gap_days;
  var rarityText = '';
  if (rarity.label === 'Ultra Rare' && gap) {
    rarityText = 'Ultra Rare -- only every ' + gap + ' days!';
  } else if (gap) {
    rarityText = 'Shows up roughly every ' + gap + ' days';
  }
  if (rarityText) {
    html += '<p class="compare-rarity-detail">' + escapeHtml(rarityText) + '</p>';
  }
}
```

### Existing Card Styles to Unify
```
7 distinct card-like class families in style.css:
1. .store-card (line 684)     -- map store cards, flex column, 1px border
2. .day-card (line 839)       -- radar day cards, 1px border, left-border accents
3. .near-me-card (line 1458)  -- today near-you cards, flex row, hover effect
4. .today-card (line 1522)    -- today hero, white bg, 1px border, 12px radius, padding 1.25rem
5. .week-day-card (line 1681) -- week-ahead strip, 140px fixed width
6. .compare-day-card (line 3298) -- compare day groups, 12px radius, box-shadow
7. .quiz-mode-card (fun.html inline) -- quiz launcher cards, 0.75rem radius, 1.5px border

Common properties across all:
  - white/near-white background
  - 1-1.5px border (mostly #ddd)
  - border-radius: 4px to 12px (varies)
  - padding: 0.75rem to 1.25rem
```

### Existing Token Foundation
```css
/* Source: style.css lines 1-10 */
:root {
  --brand: #005696;
  --brand-dark: #003a6b;
  --text: #1a1a1a;
  --text-muted: #666;
  --bg: #fafafa;
  --bg-tint: #f8fbfe;
  --border: #ddd;
  --radius: 0.5rem;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded colors | CSS custom properties at :root | Phase 1 (existing) | Foundation for token expansion |
| 7 separate card classes | Shared .card base + variants | Phase 5 (this phase) | Consistent visual language |
| HD SVG for hero cone | Pre-rendered pixel art PNG | Phase 5 (this phase) | Visually distinct hero quality |
| Always show cadence text | Suppress for seasonal flavors | Phase 5 (this phase) | No misleading "overdue!" claims |

**Deprecated/outdated:**
- The "arcade sprite system" guide (`docs/Custard_Arcade_Sprite_System_Guide.md`) defines tiers and specs but the 244 existing sprite files in `docs/assets/sprites/` are SVG-only at L0-L5 tiers. The hero PNG pipeline is a new, simpler approach: detailed pixel art PNGs at a single resolution, not the multi-tier SVG system.

## Open Questions

1. **Hero cone asset generation methodology**
   - What we know: ~176 flavors need hero-level pixel art PNGs. Existing sprites directory has 244 SVG files across 6 tiers for ~40 flavors. The user wants "detailed pixel art with visible pixels, berries/swirls/crosshatch detail."
   - What's unclear: Whether to generate PNGs from the existing sprite SVGs (rasterize L4/L5), create new assets via AI generation, or hand-author. The 244 existing sprites only cover ~40 flavors (244 / 6 tiers), leaving ~136 flavors without any sprite assets.
   - Recommendation: This is marked as Claude's discretion. Start with a hybrid approach: rasterize existing L4/L5 sprites for flavors that have them (~40), then programmatically generate remaining ~136 using an enhanced version of renderMiniConeHDSVG at a higher grid resolution (e.g., 36x42 or 48x56) and rasterize to PNG. This avoids blocking on AI generation while producing consistent visual output.

2. **Exact token values for typography scale**
   - What we know: 36 unique font-size values cluster around 8 natural groups.
   - What's unclear: Exact mapping of each current size to the nearest token.
   - Recommendation: Use the recommended 8-step scale (0.6875, 0.75, 0.875, 1, 1.125, 1.5, 1.75, 2 rem). The planner should create a mapping table during implementation.

3. **Service worker cache strategy for hero PNGs**
   - What we know: Cannot add ~176 PNGs to STATIC_ASSETS (pre-cache). Need runtime caching.
   - What's unclear: Whether to add a network-first or cache-first strategy for `/assets/cones/` in sw.js.
   - Recommendation: Add a stale-while-revalidate handler in sw.js for paths matching `assets/cones/`. Only today's flavor cone loads on page visit, so cache impact is minimal.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via worker/node_modules) |
| Config file | worker/playwright.config.mjs |
| Quick run command | `cd custard-calendar/worker && npx playwright test test/browser/today-hero.spec.mjs --workers=1` |
| Full suite command | `cd custard-calendar && uv run pytest tests/test_browser_clickthrough.py -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZP-01 | Today hero uses hero-level cone (PNG or HD SVG fallback) | browser | `npx playwright test test/browser/vizp-cone-tiers.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-01 | Compare cells use mini SVG cones at 32px | browser | `npx playwright test test/browser/vizp-cone-tiers.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-02 | All nav pages use .card base class | browser | `npx playwright test test/browser/vizp-card-system.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-02 | Card elements share consistent border-radius, shadow, background | browser | `npx playwright test test/browser/vizp-card-system.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-03 | Seasonal flavor does NOT show cadence text | browser | `npx playwright test test/browser/vizp-seasonal-rarity.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-03 | Non-seasonal flavor still shows cadence text normally | browser | `npx playwright test test/browser/vizp-seasonal-rarity.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-03 | Seasonal flavor still shows rarity badge (Rare/Ultra Rare) | browser | `npx playwright test test/browser/vizp-seasonal-rarity.spec.mjs --workers=1` | No -- Wave 0 |
| VIZP-04 | Hero PNG loads for known flavor, fallback to SVG for unknown | browser | `npx playwright test test/browser/vizp-cone-tiers.spec.mjs --workers=1` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test test/browser/vizp-*.spec.mjs --workers=1`
- **Per wave merge:** `uv run pytest tests/test_browser_clickthrough.py -v` (full browser suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/browser/vizp-cone-tiers.spec.mjs` -- covers VIZP-01, VIZP-04
- [ ] `worker/test/browser/vizp-card-system.spec.mjs` -- covers VIZP-02
- [ ] `worker/test/browser/vizp-seasonal-rarity.spec.mjs` -- covers VIZP-03

*(Framework and config already exist -- no infrastructure gaps)*

## Critical Integration Points

### Files Modified (expected)
| File | Changes | Risk |
|------|---------|------|
| `docs/style.css` | Add tokens to :root, add .card base + variants, update 4 nav page styles | HIGH -- 3,444 lines, legacy page breakage risk |
| `docs/planner-shared.js` | Add `isSeasonalFlavor()`, export via CustardPlanner | MEDIUM -- 1,624 lines, untested monolith per STATE.md |
| `docs/today-page.js` | Hero cone PNG rendering, seasonal cadence suppression | MEDIUM -- touches hero card render path |
| `docs/compare-page.js` | Seasonal cadence suppression | LOW -- isolated change to rarity text section |
| `docs/cone-renderer.js` | Add `heroConeSrc()` function | LOW -- additive only |
| `docs/index.html` | Add .card classes to today-card, near-me cards | LOW -- class additions only |
| `docs/compare.html` | Add .card classes | LOW -- class additions only |
| `docs/fun.html` | Move inline styles to style.css, add .card classes | LOW -- inlining to external |
| `docs/map.html` | Add .card--map-store variant classes | LOW -- additive |
| `docs/sw.js` | Bump CACHE_VERSION, add runtime cache for /assets/cones/ | MEDIUM -- must not break existing caching |

### Files Created (expected)
| File | Purpose |
|------|---------|
| `docs/assets/cones/*.png` | ~176 hero-level pixel art cone PNGs |
| `worker/test/browser/vizp-*.spec.mjs` | 3 test spec files for phase requirements |

## Sources

### Primary (HIGH confidence)
- `docs/style.css` -- direct code inspection of all 3,444 lines; 36 unique font sizes, 7 card class families
- `docs/cone-renderer.js` -- full read of renderMiniConeSVG (9x11) and renderMiniConeHDSVG (18x22) implementations
- `docs/planner-shared.js` -- rarity functions at lines 424-459, signal rendering at lines 1493-1583
- `docs/today-page.js` -- hero card rendering, rarity display at lines 329-342
- `docs/compare-page.js` -- compare rarity rendering at lines 284-295
- `worker/src/route-today.js` -- /api/v1/today response structure (confirmed: no `tags` field)
- `worker/src/flavor-tags.js` -- SEASONAL_PATTERN regex at line 10
- `worker/src/signals.js` -- detectSeasonal function, SIGNAL_TYPES.SEASONAL
- `worker/src/drive.js` -- Drive card response includes `tags` array (line 312)
- `ASSET_SPEC.md` -- canonical tier definitions and surface assignments
- `CONE_PROFILE_SPEC.md` -- grid geometry for Mini (9x11) and HD (18x22)

### Secondary (MEDIUM confidence)
- `docs/Custard_Arcade_Sprite_System_Guide.md` -- sprite system design, may be partially superseded by simpler hero PNG approach
- `docs/assets/sprites/` -- 244 existing sprite files covering ~40 flavors at 6 tiers

### Tertiary (LOW confidence)
- Hero PNG count estimate (~176) is based on typical Culver's FOTD menu rotation; actual count depends on Worker flavor-colors.js FLAVOR_PROFILES object

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- vanilla CSS/JS, no new dependencies, verified against codebase
- Architecture: HIGH -- all integration points verified via code inspection
- Pitfalls: HIGH -- derived from actual code paths and concrete file locations
- Asset pipeline: MEDIUM -- hero PNG generation approach is discretionary, exact count unverified

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, no external dependency churn)
