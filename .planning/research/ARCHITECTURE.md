# Architecture Patterns

**Domain:** Two-tier cone art pipeline migration (L0 micro SVG + L5 AI PNGs)
**Researched:** 2026-03-18
**Confidence:** HIGH (all 7 rendering sites inspected, data flow traced end-to-end)

## Current Architecture: 7 Cone Rendering Sites

The codebase has 7 distinct places where cone art is rendered. Each uses a different renderer at a different fidelity tier. The migration must address every one of them.

### Rendering Site Inventory

| # | Site | File(s) | Current Renderer | Pixel Grid | Output | Display Context |
|---|------|---------|------------------|------------|--------|-----------------|
| 1 | Today hero cone | `docs/today-page.js:368,376` | `renderHeroCone()` -> PNG with HD SVG fallback | 144x168 PNG (from 36x42 grid @ scale 4) | `<img>` tag | Today page, above the fold, ~120px wide |
| 2 | Today/Compare/Map mini cones | `docs/today-page.js:228,434,444,520`, `docs/compare-page.js:776`, `docs/map.html:333` | `renderMiniConeSVG()` | 9x11 grid | Inline SVG | Small icons in lists, cards, map popups |
| 3 | Quiz result/nearest cones | `docs/quizzes/engine.js:1022,1129,1153,1181` | `renderMiniConeHDSVG()` + `renderMiniConeSVG()` fallback | 18x22 or 9x11 | Inline SVG | Quiz result display, nearest-store badges |
| 4 | Social cards (Worker) | `worker/src/social-card.js:315` | `renderConeHDSVG()` via `renderConeGroup()` | 18x21 grid | Embedded SVG rects in 1200x630 SVG | OG image social cards (store/date, page, trivia) |
| 5 | Scriptable widget (iOS) | `docs/assets/custard-today.js:70` | `drawConeIcon()` (independent DrawContext renderer) | ~28x28 vector circles+paths | Raster Image via DrawContext | iOS home screen widget (small/medium) |
| 6 | Tidbyt display | `tidbyt/culvers_fotd.star` | `create_mini_cone()` + `create_ice_cream_icon()` | 9x11 (mini) / 16x18 (single) | Starlark render primitives | 64x32 LED pixel display |
| 7 | Flavor audit page | `docs/masterlock-audit.html:178-184` | `renderMiniConeSVG()` + `renderMiniConeHDSVG()` | 9x11 / 18x22 | Inline SVG | Internal audit tool |

### Existing Renderer Functions (by location)

**Client-side (`docs/cone-renderer.js`):**
- `renderMiniConeSVG(flavorName, scale)` -- L0 tier, 9x11 pixel grid
- `renderMiniConeHDSVG(flavorName, scale)` -- L2 tier, 18x22 pixel grid (REMOVE)
- `heroConeSrc(flavorName)` -- Returns `assets/cones/{slug}.png` path
- `renderHeroCone(flavorName, container, fallbackScale)` -- Tries PNG, falls back to HD SVG

**Worker-side (`worker/src/flavor-colors.js`):**
- `renderConeHDSVG(flavorName, scale)` -- 18x21 grid, used by social cards (REMOVE)
- `renderConePremiumSVG(flavorName, scale)` -- 24x28 grid, texture hash + shadow (REMOVE)
- `renderConeHeroSVG(flavorName, scale)` -- 36x42 grid, used by PNG pipeline (REMOVE)

**Scriptable (`docs/assets/custard-today.js`):**
- `drawConeIcon(flavorName, size)` -- Independent vector renderer, own color map (UNIFY)

**Starlark (`tidbyt/culvers_fotd.star`):**
- `create_mini_cone(profile)` -- L0 equivalent, 9x11 Starlark boxes (KEEP)
- `create_ice_cream_icon(profile)` -- Larger single-day view, 16x18 (KEEP)

## Recommended Architecture: Two-Tier Pipeline

### The Two Tiers

```
L0: Micro SVG (9x11 pixel grid)
    renderMiniConeSVG() -- client-side, inline SVG
    create_mini_cone() -- Starlark, Tidbyt display
    Purpose: Tiny inline icons (map popups, list items, compare rows)
    Size: 45x55px at scale=5, fits anywhere

L5: AI-Generated PNGs
    Pre-rendered at build time, served as static assets
    Purpose: Everything larger than a list icon
    Replaces: HD SVG, Premium SVG, Hero SVG, Hero PNGs, drawConeIcon
```

### Component Boundaries After Migration

```
                    FLAVOR_PROFILES (94 entries + 37 aliases)
                    Source of truth: worker/src/flavor-colors.js
                              |
           +------------------+-------------------+
           |                                      |
     L0 Micro SVG                          L5 AI PNGs
     (runtime, algorithmic)                (build-time, static)
           |                                      |
     +-----+-----+                    +-----------+-----------+
     |           |                    |           |           |
  Client     Starlark             Client      Worker      Scriptable
  cone-      culvers_           heroConeSrc  social-card  custard-today
  renderer   fotd.star                        .js          .js
  .js                                  |
     |           |                    docs/assets/cones/*.png
  map popups  Tidbyt LED              (94 files, ~15-50KB each)
  list icons  64x32 display                   |
  compare                          +----------+----------+
  rows                             |          |          |
                                Today      Quiz       Social
                                hero     results     cards*
                                cone

  * Social cards switch from inline SVG to PNG <image> embed
```

### What Survives, What Dies, What Changes

| Component | Action | Rationale |
|-----------|--------|-----------|
| `renderMiniConeSVG()` in `cone-renderer.js` | **KEEP** | L0 tier. Used by 4 pages for tiny icons. No replacement needed. |
| `renderMiniConeHDSVG()` in `cone-renderer.js` | **REMOVE** | Dead intermediate tier. Was HD SVG fallback; L5 PNGs replace it. Quiz engine switches to L5 PNG or L0 mini. |
| `heroConeSrc()` in `cone-renderer.js` | **KEEP + MODIFY** | Already returns PNG path. Will now point to L5 PNGs instead of algorithmic PNGs. Same slug convention, same path structure. |
| `renderHeroCone()` in `cone-renderer.js` | **MODIFY** | Keep PNG-first behavior. Change fallback from `renderMiniConeHDSVG()` to `renderMiniConeSVG()` (L0). |
| `renderConeHDSVG()` in `flavor-colors.js` | **REMOVE** | Was used only by social-card.js. Social cards switch to L5 PNG embed. |
| `renderConePremiumSVG()` in `flavor-colors.js` | **REMOVE** | Premium tier never used in production. Out of scope per PROJECT.md. |
| `renderConeHeroSVG()` in `flavor-colors.js` | **REMOVE** | Was used by `generate-hero-cones.mjs` pipeline. L5 PNGs replace the pipeline entirely. |
| `drawConeIcon()` in `custard-today.js` | **REMOVE + UNIFY** | Replace with L5 PNG loaded via URL, or L0 mini SVG rendered to DrawContext. |
| `create_mini_cone()` in `culvers_fotd.star` | **KEEP** | Starlark renderer for 64x32 Tidbyt LED. Cannot use PNGs (no HTTP in Starlark renderer). Already L0 equivalent. |
| `create_ice_cream_icon()` in `culvers_fotd.star` | **KEEP** | Larger single-day Tidbyt view. Same constraint -- no external assets in Starlark. |
| `generate-hero-cones.mjs` | **REMOVE or REPURPOSE** | Current pipeline renders SVG -> PNG via sharp. L5 PNGs come from AI generation, not this pipeline. Might repurpose for size optimization/format conversion. |
| Color constants/FALLBACK_* in `cone-renderer.js` | **KEEP** | Still needed by L0 `renderMiniConeSVG()` and `getFlavorBaseColor()` for card backgrounds. |
| `resolveHDToppingSlots()` in `cone-renderer.js` | **REMOVE** | Only used by `renderMiniConeHDSVG()`. |
| `resolveHDScatterToppingList()` in `cone-renderer.js` | **REMOVE** | Only used by `renderMiniConeHDSVG()`. |
| PRNG utilities (`_mulberry32`, `darkenHex`) in `cone-renderer.js` | **REMOVE** | Only used by HD scatter renderer. |

### Data Flow: L5 PNG Integration

**Before (current):**
```
FLAVOR_PROFILES -> renderConeHeroSVG(name, 4) -> SVG string
  -> sharp(svgBuffer, {density:300}) -> resize 144x168 nearest
  -> docs/assets/cones/{slug}.png (144x168 native, served via GitHub Pages)
  -> heroConeSrc(name) returns path -> <img src="assets/cones/slug.png">
  -> onerror fallback: renderMiniConeHDSVG() inline SVG
```

**After (L5):**
```
AI image generation (external, build-time)
  -> L5 PNGs at target resolution (TBD, likely 256x or 512x)
  -> Optimize (optipng/pngquant or webp conversion)
  -> docs/assets/cones/{slug}.png (same path, same slug convention)
  -> heroConeSrc(name) returns path (UNCHANGED)
  -> <img src="assets/cones/slug.png"> (UNCHANGED)
  -> onerror fallback: renderMiniConeSVG() (downgraded from HD)
```

The critical insight: **`heroConeSrc()` is already the integration seam.** The slug convention (`flavor-name.replace(/[^a-z0-9]+/g, '-')`) is the contract. L5 PNGs just replace the files at the same paths. No calling code changes for the primary use case.

### Social Card Migration (Worker-Side)

This is the most significant architectural change because social cards currently generate SVG inline on the Worker.

**Before:**
```
social-card.js imports renderConeHDSVG from flavor-colors.js
  -> renderConeGroup(flavorName, x, y, scale)
  -> Extracts SVG rects, wraps in <g transform="translate(x,y)">
  -> Embeds as child elements inside 1200x630 SVG
```

**After (two options):**

**Option A: Embed PNG via `<image>` in SVG (RECOMMENDED)**
```
social-card.js loads L5 PNG as base64 data URI
  -> <image href="data:image/png;base64,..." x="70" y="160" width="120" height="140"/>
  -> Embedded directly in the 1200x630 SVG response
  -> Requires: Worker KV storing base64-encoded L5 PNGs, or Worker R2 bucket
```

**Option B: Keep algorithmic cone for social cards only**
```
Keep renderConeHDSVG() alive solely for social-card.js
  -> Means the HD renderer stays in the Worker codebase
  -> Defeats the purpose of the migration (dead code stays alive)
```

Option A is correct. The Worker already has KV access. During L5 PNG generation, store base64-encoded versions in KV keyed by flavor slug. Social cards fetch from KV and embed. This fully eliminates the algorithmic renderers from the Worker.

**Implementation for Option A:**
```javascript
// social-card.js (modified)
async function renderConeImage(flavorName, env, x, y, width, height) {
  const slug = flavorSlug(flavorName);
  const key = `cone-png:${slug}`;
  const base64 = await env.KV.get(key);
  if (!base64) return ''; // Graceful degradation: no cone
  return `<image href="data:image/png;base64,${base64}" x="${x}" y="${y}" width="${width}" height="${height}" image-rendering="pixelated"/>`;
}
```

### Scriptable Widget Unification

The Scriptable widget (`custard-today.js`) has its own independent cone renderer (`drawConeIcon()`) with:
- Its own color map (`FLAVOR_SCOOP_COLORS` -- 15 colors vs 23 base + 33 toppings in the canonical system)
- Its own keyword-matching logic (simpler than `normalizeFlavorKey()`)
- No topping/ribbon rendering (just a colored circle for the scoop)
- DrawContext-based (Scriptable API, not DOM)

**Unification approach:**

The Scriptable widget runs on iOS via Scriptable.app, which supports `Image.fromURL()`. Two options:

**Option A: Load L5 PNG via URL (RECOMMENDED for medium widget)**
```javascript
// In custard-today.js, replace drawConeIcon() calls:
async function loadConeImage(flavorName) {
  var slug = flavorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  var url = "https://custard.chriskaschner.com/assets/cones/" + slug + ".png";
  try {
    var req = new Request(url);
    return await req.loadImage();
  } catch(e) {
    return drawConeIcon(flavorName, 28); // Fallback to local renderer
  }
}
```

**Option B: Keep drawConeIcon as lightweight L0 fallback**
Scriptable widgets need to work offline. Keep `drawConeIcon()` but align its color map to the canonical system. This becomes the Scriptable-native L0.

**Recommendation:** Use Option A for online rendering with Option B as offline fallback. The Scriptable widget already makes API calls (`fetchToday()`, `fetchFlavors()`) so it requires network anyway. The image URL is just one more request. Keep `drawConeIcon()` but update its color map to match `BASE_COLORS` from the canonical system (eliminates color drift).

### Service Worker Caching Strategy

The service worker (`docs/sw.js`) already handles cone PNGs with stale-while-revalidate:

```javascript
// Lines 66-79 of sw.js -- already handles /assets/cones/*.png
if (url.pathname.includes('/assets/cones/') && url.pathname.endsWith('.png')) {
  // Stale-while-revalidate: serve cached, fetch update in background
}
```

**Changes needed:**

1. **Cache version bump**: `custard-v20` -> `custard-v21` to force re-download of all cone PNGs when L5 replaces algorithmic PNGs.

2. **File size consideration**: Current algorithmic PNGs are 144x168 pixels (~2-5KB each, 94 files = ~300KB total). L5 AI PNGs will be larger. At 256x256, expect ~15-50KB each (optimized PNG), totaling ~1.5-5MB for 94 flavors. At 512x512, expect ~30-100KB each, totaling ~3-10MB.

3. **Pre-caching decision**: Currently, cone PNGs are NOT pre-cached (runtime cache only). With larger L5 PNGs, this is correct -- pre-caching 94 large PNGs would bloat install. Keep runtime stale-while-revalidate.

4. **WebP consideration**: If L5 PNGs are large, consider generating both `.png` and `.webp` variants. `heroConeSrc()` could check `image/webp` support and return the appropriate extension. However, this adds complexity for marginal gains on a 94-file corpus.

**Recommendation:** Keep current SW caching strategy. Bump cache version. Do NOT pre-cache. Monitor total asset size after L5 generation and optimize if > 5MB total.

## Patterns to Follow

### Pattern 1: heroConeSrc as the Universal Integration Seam

**What:** All L5 PNG consumers go through `heroConeSrc(flavorName)` to resolve the asset path. This function handles normalization, alias resolution, and slug generation.

**When:** Any time a component needs to display an L5 cone.

**Why:** Single point of control for path resolution. Alias changes propagate everywhere. Slug format is tested (worker/test/png-asset-count.test.js).

```javascript
// This pattern already works for Today page hero cones:
function renderHeroCone(flavorName, container, fallbackScale) {
  var src = heroConeSrc(flavorName);
  if (!src) {
    container.innerHTML = renderMiniConeSVG(flavorName, fallbackScale || 6);
    return;
  }
  var img = new Image();
  img.src = src;
  img.onerror = function() {
    container.innerHTML = renderMiniConeSVG(flavorName, fallbackScale || 6);
  };
  container.innerHTML = '';
  container.appendChild(img);
}

// Extend this pattern to quiz results:
// engine.js line 1022 changes from:
//   els.resultCone.innerHTML = window.renderMiniConeHDSVG(displayFlavor, 5);
// to:
//   window.renderHeroCone(displayFlavor, els.resultCone, 5);
```

### Pattern 2: Graceful Degradation Chain

**What:** L5 PNG -> L0 SVG -> nothing. Never crash on missing art.

**When:** Every rendering site.

**Why:** Unknown/new flavors won't have L5 PNGs. Network failures happen. The `onerror` handler in `renderHeroCone()` already demonstrates this pattern.

```
L5 attempt: <img src="assets/cones/slug.png">
  onerror -> L0 fallback: renderMiniConeSVG(flavor, scale)
    empty -> no visual (graceful empty state)
```

### Pattern 3: Slug as Primary Key

**What:** The flavor slug (`flavor-name` from `normalizeFlavorKey() + regex`) is the primary key for PNG lookup, KV storage, and asset paths.

**When:** PNG generation, asset serving, KV cone storage for social cards.

**Why:** Already established convention. Tests verify slug generation matches between `heroConeSrc()` and `generate-hero-cones.mjs`. Aliases resolve before slugging.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Keeping Dead Renderers "Just in Case"

**What:** Leaving `renderMiniConeHDSVG()`, `renderConeHDSVG()`, `renderConePremiumSVG()`, `renderConeHeroSVG()` in the codebase after migration.

**Why bad:** 700+ lines of dead code across two files. Tests for dead renderers inflate test count. Color constants stay coupled. Future contributors will be confused about which renderer to use.

**Instead:** Remove functions, remove their tests, remove supporting utilities (`resolveHDToppingSlots`, `resolveHDScatterToppingList`, HD PRNG code). Do this AFTER L5 PNGs are verified at all 7 rendering sites.

### Anti-Pattern 2: Different PNG Conventions per Consumer

**What:** Social cards using one slug format, client-side using another, Scriptable using a third.

**Why bad:** Alias resolution diverges. New flavors require updates in multiple places.

**Instead:** All PNG references go through the same slug function. Social cards use the same slug as `heroConeSrc()`. Scriptable uses the same slug. One function, one convention.

### Anti-Pattern 3: Pre-caching All L5 PNGs in Service Worker

**What:** Adding all 94 L5 PNGs to the `STATIC_ASSETS` array.

**Why bad:** 94 files at ~15-50KB each = 1.5-5MB forced download on first visit. Users may only ever view 3-5 flavors. Massive install time, wasted bandwidth.

**Instead:** Keep runtime stale-while-revalidate. PNGs cache on first view. The SW already does this correctly.

## Migration Build Order

The build order is driven by dependency analysis: what blocks what.

### Phase 1: Generate L5 PNGs (no code changes)

**Goal:** Create the 94 L5 AI-generated PNGs and place them at `docs/assets/cones/{slug}.png`.

**Depends on:** Nothing. Can start immediately.

**Produces:** 94 PNG files at `docs/assets/cones/`, replacing existing algorithmic PNGs.

**Verification:** Visual comparison of old vs new PNGs. Size check. Slug coverage check (all 94 FLAVOR_PROFILES have a PNG).

**Risk:** AI image generation quality/consistency. This is the creative bottleneck, not a technical one.

### Phase 2: Client-side renderer swap (cone-renderer.js)

**Goal:** Remove HD SVG fallback path, simplify renderHeroCone to use L0 fallback.

**Depends on:** Phase 1 (L5 PNGs must exist at the expected paths).

**Changes:**
1. `renderHeroCone()`: Change fallback from `renderMiniConeHDSVG()` to `renderMiniConeSVG()`
2. Remove `renderMiniConeHDSVG()` function
3. Remove `resolveHDToppingSlots()`, `resolveHDScatterToppingList()`, `_mulberry32()`, `darkenHex()`
4. Remove HD-only shape/PRNG code
5. Keep: `renderMiniConeSVG()`, `heroConeSrc()`, `renderHeroCone()`, all color constants, `normalizeFlavorKey()`, `getFlavorProfileLocal()`, `getFlavorBaseColor()`, `resolveToppingSlots()`, `lightenHex()`, `FALLBACK_FLAVOR_ALIASES`

**Verification:** Today page shows L5 PNGs. Force a 404 on one PNG and verify L0 SVG fallback renders.

### Phase 3: Quiz engine migration (engine.js)

**Goal:** Switch quiz result cones from HD SVG to L5 PNG.

**Depends on:** Phase 2 (renderHeroCone available, renderMiniConeHDSVG removed).

**Changes:**
1. `engine.js:1021-1024`: Replace `renderMiniConeHDSVG()` call with `renderHeroCone()` targeting the result cone container
2. Keep `renderMiniConeSVG()` calls for small nearest-store badges (L0 is correct for those tiny sizes)

**Verification:** Quiz results show L5 PNG cones. Nearest-store badges still show L0 mini cones.

### Phase 4: Social card migration (Worker-side)

**Goal:** Switch social cards from inline SVG cones to embedded L5 PNGs.

**Depends on:** Phase 1 (L5 PNGs exist). Independent of Phases 2-3.

**Changes:**
1. Upload base64-encoded L5 PNGs to Worker KV (keyed by `cone-png:{slug}`)
2. `social-card.js`: Replace `renderConeGroup()` with async `renderConeImage()` that fetches base64 from KV
3. `handleSocialCard()` is already async, so KV fetch fits naturally
4. Remove import of `renderConeHDSVG` from social-card.js

**Verification:** Social card SVGs render with embedded `<image>` tags. Visual comparison with old cards.

### Phase 5: Worker renderer cleanup (flavor-colors.js)

**Goal:** Remove dead SVG renderers from Worker code.

**Depends on:** Phase 4 (social cards no longer import renderers).

**Changes:**
1. Remove `renderConeHDSVG()`, `renderConePremiumSVG()`, `renderConeHeroSVG()`
2. Remove supporting constants: `_HD_SCOOP_ROWS`, `_PREM_SCOOP_ROWS`, `_HERO_SCOOP_ROWS`, `_HERO_CONE_ROWS`, all ribbon/topping/highlight/shadow slot arrays for those tiers
3. Remove supporting functions: `resolveHDScatterToppingList()`, `resolvePremiumToppingList()`, `resolveHeroToppingList()`
4. Remove `lightenHex()`, `darkenHex()`, `_mulberry32()` if no other consumers
5. Keep: `FLAVOR_PROFILES`, `BASE_COLORS`, `TOPPING_COLORS`, `RIBBON_COLORS`, `CONE_COLORS`, `FLAVOR_ALIASES`, `getFlavorProfile()`, `renderConeSVG()` (L0, 9x11 grid -- used by `/api/v1/flavor-colors` endpoint and tests), `normalize` utilities
6. Update worker tests: remove test suites for dead renderers, update golden-baselines.test.js

**Verification:** `cd worker && npm test` passes. API endpoint `/api/v1/flavor-colors` still works.

### Phase 6: Scriptable widget unification (custard-today.js)

**Goal:** Replace independent `drawConeIcon()` with L5 PNG loading + aligned fallback.

**Depends on:** Phase 1 (L5 PNGs at known URLs).

**Changes:**
1. Add `loadConeImage(slug)` async function that fetches PNG from custard.chriskaschner.com
2. Update `buildSmall()`, `buildMedium()`, `buildMultiStore()` to use loaded PNG images
3. Keep `drawConeIcon()` as offline fallback but update `FLAVOR_SCOOP_COLORS` to match canonical `BASE_COLORS` (23 entries instead of 15)
4. Mirror changes in `widgets/custard-today.js` (there are two copies)

**Verification:** Widget preview in Scriptable shows L5 cone images. Airplane mode shows fallback.

### Phase 7: Audit page + generate pipeline cleanup

**Goal:** Update flavor-audit.html, remove or repurpose generate-hero-cones.mjs.

**Depends on:** Phases 2, 5 (all renderers cleaned up).

**Changes:**
1. `masterlock-audit.html`: Remove `renderMiniConeHDSVG()` calls, use `renderMiniConeSVG()` + `<img>` for L5 PNG preview
2. `generate-hero-cones.mjs`: Remove or convert to an optimizer script (takes AI PNGs, runs pngquant/optipng)
3. Bump service worker cache version to `custard-v21`

**Verification:** Audit page renders. No references to removed functions in any JS file.

### Dependency Graph

```
Phase 1 (Generate L5 PNGs)
    |
    +---> Phase 2 (Client cone-renderer.js cleanup)
    |         |
    |         +---> Phase 3 (Quiz engine migration)
    |         |
    |         +---> Phase 7 (Audit page + pipeline cleanup)
    |
    +---> Phase 4 (Social card migration -- Worker)
    |         |
    |         +---> Phase 5 (Worker renderer cleanup)
    |
    +---> Phase 6 (Scriptable widget unification)
```

Phases 2, 4, and 6 can proceed in parallel once Phase 1 completes.

## New vs Modified vs Removed Components

| Action | Component | File | Notes |
|--------|-----------|------|-------|
| **KEEP** | `renderMiniConeSVG()` | `docs/cone-renderer.js` | L0 tier, used by 4+ pages |
| **KEEP** | `heroConeSrc()` | `docs/cone-renderer.js` | Integration seam, slug resolver |
| **MODIFY** | `renderHeroCone()` | `docs/cone-renderer.js` | Fallback changes from HD SVG to L0 SVG |
| **KEEP** | Color constants (FALLBACK_*) | `docs/cone-renderer.js` | Still needed by L0 renderer |
| **KEEP** | `normalizeFlavorKey()` | `docs/cone-renderer.js` | Used by heroConeSrc and L0 |
| **KEEP** | `resolveToppingSlots()` | `docs/cone-renderer.js` | Used by L0 renderer |
| **KEEP** | `FALLBACK_FLAVOR_ALIASES` | `docs/cone-renderer.js` | Used by heroConeSrc |
| **REMOVE** | `renderMiniConeHDSVG()` | `docs/cone-renderer.js` | Dead intermediate tier |
| **REMOVE** | `resolveHDToppingSlots()` | `docs/cone-renderer.js` | HD-only utility |
| **REMOVE** | `resolveHDScatterToppingList()` | `docs/cone-renderer.js` | HD-only utility |
| **REMOVE** | `_mulberry32()` | `docs/cone-renderer.js` | HD-only PRNG |
| **REMOVE** | `darkenHex()` | `docs/cone-renderer.js` | HD-only color utility |
| **REMOVE** | `_CANONICAL_TOPPING_SHAPES` | `docs/cone-renderer.js` | HD-only shape map |
| **REMOVE** | `_CANONICAL_SHAPE_MAP` | `docs/cone-renderer.js` | HD-only shape map |
| **MODIFY** | Quiz cone rendering | `docs/quizzes/engine.js` | Switch from HD SVG to `renderHeroCone()` |
| **MODIFY** | Audit page cones | `docs/masterlock-audit.html` | Remove HD SVG calls |
| **REMOVE** | `renderConeHDSVG()` | `worker/src/flavor-colors.js` | Replaced by L5 PNG embed |
| **REMOVE** | `renderConePremiumSVG()` | `worker/src/flavor-colors.js` | Never used in production |
| **REMOVE** | `renderConeHeroSVG()` | `worker/src/flavor-colors.js` | Replaced by L5 PNGs |
| **REMOVE** | All HD/Premium/Hero supporting code | `worker/src/flavor-colors.js` | Scoop rows, topping lists, ribbon paths, etc. |
| **KEEP** | `FLAVOR_PROFILES`, colors, `getFlavorProfile()` | `worker/src/flavor-colors.js` | Still used by API, L0 renderer |
| **MODIFY** | `renderConeGroup()` -> `renderConeImage()` | `worker/src/social-card.js` | Switch from SVG embed to PNG `<image>` embed |
| **MODIFY** | `drawConeIcon()` | `docs/assets/custard-today.js` | Add L5 PNG loading, align color map |
| **KEEP** | `create_mini_cone()` | `tidbyt/culvers_fotd.star` | L0 for Tidbyt, no external assets |
| **KEEP** | `create_ice_cream_icon()` | `tidbyt/culvers_fotd.star` | Larger Tidbyt view |
| **MODIFY** | Service worker | `docs/sw.js` | Cache version bump to v21 |
| **REMOVE/REPURPOSE** | PNG generation pipeline | `scripts/generate-hero-cones.mjs` | No longer generates from SVG |
| **MODIFY** | Worker tests | `worker/test/flavor-colors.test.js` | Remove HD/Premium/Hero test suites |
| **MODIFY** | Golden baselines | `worker/test/golden-baselines.test.js` | Remove HD/Premium/Hero tiers, keep L0 |
| **ADD** | KV cone PNG upload script | New script | Uploads base64 L5 PNGs to Worker KV for social cards |
| **REPLACE** | 94 cone PNG files | `docs/assets/cones/*.png` | Replace algorithmic with L5 AI PNGs |

## Scalability Considerations

| Concern | Now (94 flavors) | At 200 flavors | At 500 flavors |
|---------|-------------------|----------------|----------------|
| PNG asset size | ~300KB total (algorithmic) | ~2-10MB (L5) | ~5-25MB (L5) |
| KV storage (social card base64) | 94 keys, ~500KB | 200 keys, ~1MB | 500 keys, ~2.5MB |
| Service worker cache | Runtime SWR, no issue | Same, no issue | Consider lazy-loading strategy |
| Generation time | Manual AI generation | Need batch workflow | Need automated pipeline |
| Slug collisions | None (94 tested) | Unlikely | Audit needed |

The main scalability concern is AI PNG generation at scale. At 94 flavors this is a one-time manual effort. Beyond 200, an automated pipeline (prompt templates + API) becomes necessary. The serving architecture (static PNGs on GitHub Pages, KV for social cards) scales indefinitely.

## Sources

- `docs/cone-renderer.js` -- Client-side renderer, all 4 functions inspected
- `worker/src/flavor-colors.js` -- Worker-side renderer, 3 SVG functions + profile system
- `worker/src/social-card.js` -- Social card generation, cone embedding pattern
- `docs/assets/custard-today.js` -- Scriptable widget independent renderer
- `tidbyt/culvers_fotd.star` -- Starlark pixel renderer (cannot use external assets)
- `docs/sw.js` -- Service worker caching strategy for cone PNGs
- `scripts/generate-hero-cones.mjs` -- Current SVG-to-PNG pipeline
- `docs/today-page.js`, `docs/compare-page.js`, `docs/map.html`, `docs/quizzes/engine.js` -- Consumer call sites
- `docs/masterlock-audit.html` -- Audit page rendering calls
- `.planning/PROJECT.md` -- v2.0 milestone scope and constraints
