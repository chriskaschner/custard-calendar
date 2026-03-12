# Phase 13: Rendering Quality Fixes - Research

**Researched:** 2026-03-09
**Domain:** Pixel-art SVG cone rendering, color palette synchronization, PNG rasterization pipeline
**Confidence:** HIGH

## Summary

Phase 13 addresses four concrete rendering quality issues across the custard cone visualization system: PNG scaling artifacts, color palette drift across 4 sync files, HD scoop geometry mismatch between server and client renderers, and low-DPI SVG rasterization. All four issues are well-understood with clear fixes because the source code for all renderers is accessible and the problems are structural (wrong constants, missing geometry rows, incorrect sharp options) rather than algorithmic.

The codebase has four rendering tiers (Mini 9x11, HD 18x22, Hero 36x42, Premium 24x28) implemented in two separate files: `worker/src/flavor-colors.js` (canonical, ES modules) and `docs/cone-renderer.js` (client-side, var/IIFE pattern). Color palettes are additionally duplicated in `tidbyt/culvers_fotd.star` (Starlark) and `docs/flavor-audit.html` (inline JS). Research confirms significant drift in both color hex values and missing color keys across files.

**Primary recommendation:** Fix all four issues as direct edits to existing files -- no new libraries, no architectural changes. The generate-hero-cones.mjs script needs sharp constructor density + removal of resize + removal of sips fallback. Color sync is a manual audit-and-update pass. HD geometry is a 2-line fix. All changes are testable with the existing vitest suite.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Exact match: Tidbyt LED colors must match web colors exactly (all 4 sync files use identical hex values)
- Audit each drifted color: Claude compares both hex values against the real-world ingredient and picks the more accurate one; user reviews final unified palette
- flavor-audit.html is updated as part of this phase (it's the 4th sync file per RNDQ-03)
- 144px width, no downscale: Hero SVG at scale 4 = 144x168px, rasterize 1:1 (zero pixel artifacts)
- Set 300 DPI density in sharp for crisper SVG-to-PNG rasterization
- CSS handles display sizing (images are 144px native, CSS constrains to container)
- Remove sips fallback: sharp-only pipeline, fail fast if sharp not installed
- flavor-colors.js is the canonical source: all other files sync FROM it
- Manual sync in this phase + CI test enforcement in Phase 14
- Colors only (not profile definitions) -- RNDQ-03 scope is hex values
- cone-renderer.js FALLBACK constants are part of the sync (must match canonical)
- Full copy: FALLBACK objects in cone-renderer.js mirror the complete palette from flavor-colors.js
- CI sync test (Phase 14) should cover all 5 locations
- Color map only: keyword fallback logic (getFlavorBaseColor if/else chain) is separate from the palette sync
- No service worker caching of flavor-colors API response

### Claude's Discretion
- Which hex value wins for each drifted color (based on real-world ingredient accuracy)
- HD geometry fix approach in cone-renderer.js (adding the missing [3,14] taper row)
- Exact sharp configuration options beyond density and width

### Deferred Ideas (OUT OF SCOPE)
- Service worker pre-caching of `/api/v1/flavor-colors` response
- Profile definition sync across files (base/ribbon/toppings/density)
- LED-specific color optimization for Tidbyt
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RNDQ-01 | PNG pipeline uses clean integer downscale ratio | Current pipeline generates 144px SVG then resizes to 120px (1.2:1 non-integer ratio). Fix: remove resize entirely, output at native 144px 1:1. sharp constructor density=300 handles crispness. |
| RNDQ-02 | Sharp rasterization uses 300 DPI density for crisper pixel edges | sharp constructor accepts `density` option (default 72). Set to 300 for SVG input rasterization. Also use `withMetadata({ density: 300 })` for PNG output metadata. |
| RNDQ-03 | Color hex values match across all 4 sync files | Research identified 20+ drifted color values across base/ribbon/topping palettes. Detailed drift table provided. cone-renderer.js FALLBACK constants are the most divergent; Starlark file has 5-6 drifts. |
| RNDQ-04 | HD scoop geometry in cone-renderer.js matches server renderer | cone-renderer.js scoopRows missing [3,14] taper at row 1 and row 10. Two-line fix to match flavor-colors.js geometry. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | latest (0.33.x) | SVG-to-PNG rasterization | Already used (dynamically imported) in generate-hero-cones.mjs. Only image processing dependency. |
| vitest | 3.x | Test framework | Already configured in worker/vitest.config.js with 574+ existing tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All work is editing existing files with existing dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp density param | Generating SVG at higher scale then downscaling | User decision locked: 144px 1:1, no downscale |
| Manual color sync | Build script to auto-extract and sync | Over-engineering for 4 files; CI test in Phase 14 prevents future drift |

**Installation:**
```bash
cd custard-calendar && npm install sharp
```
Note: sharp is dynamically imported in generate-hero-cones.mjs but NOT listed in package.json. It must be installed before running the generate script. The sips fallback is being removed per user decision.

## Architecture Patterns

### Relevant File Locations
```
custard-calendar/
  worker/src/flavor-colors.js    # CANONICAL: all palettes + server renderers
  docs/cone-renderer.js          # CLIENT: FALLBACK_ palettes + client renderers
  tidbyt/culvers_fotd.star       # TIDBYT: Starlark palettes + LED renderer
  docs/flavor-audit.html         # AUDIT: SEED_ palettes + visual comparison tool
  scripts/generate-hero-cones.mjs # GENERATOR: SVG->PNG pipeline
  docs/assets/cones/*.png        # OUTPUT: 40 hero cone PNGs
  worker/test/flavor-colors.test.js # TESTS: vitest suite with golden hashes
```

### Pattern 1: Color Palette Sync Direction
**What:** flavor-colors.js is canonical. All other files copy FROM it.
**When to use:** Any color change starts in flavor-colors.js, then propagates.
**Sync map:**
```
flavor-colors.js (ES module exports)
    |
    +-> cone-renderer.js: FALLBACK_BASE_COLORS, FALLBACK_RIBBON_COLORS,
    |                     FALLBACK_TOPPING_COLORS, FALLBACK_CONE_COLORS
    |
    +-> culvers_fotd.star: BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS
    |
    +-> flavor-audit.html: SEED_BASE, SEED_RIBBON, SEED_TOPPING, SEED_CONE
```

### Pattern 2: Renderer Geometry Specs
**What:** All renderers use `[startCol, endCol]` row arrays for scoop/cone geometry.
**When to use:** Geometry fixes match the row arrays between server and client.
**Example (HD tier):**
```javascript
// flavor-colors.js (canonical):
const scoopRows = [
  [4, 13],   // row 0: 10px
  [3, 14],   // row 1: 12px (taper step)
  [2, 15],   // row 2: 14px (full width)
  // ... rows 3-9: [2, 15]
  [3, 14],   // row 10: 12px (bottom shoulder)
];

// cone-renderer.js (BROKEN - missing taper):
var scoopRows = [
  [4,13],    // row 0: 10px
  [2,15],    // row 1: 14px <-- WRONG: jumps to full width
  // ... rows 2-9: [2, 15]
  [2,15],    // row 10: 14px <-- WRONG: no bottom shoulder
];
```

### Pattern 3: PNG Generation Pipeline
**What:** generate-hero-cones.mjs iterates FLAVOR_PROFILES, renders hero SVG at scale 4, converts to PNG via sharp.
**Current (broken):** Renders 144x168px SVG, then `sharp.resize({ width: 120, kernel: 'nearest' })` -- 1.2:1 non-integer ratio creates alternating 3px/4px pixel artifacts in the waffle cone checkerboard.
**Fixed:** Remove resize, rasterize 1:1 at 144x168px with `density: 300` in constructor.

### Anti-Patterns to Avoid
- **Non-integer downscale ratios:** Pixel art MUST use integer scale factors (1:1, 2:1, 3:1). Any fractional ratio (1.2:1 = 144->120) creates alternating pixel widths in repeating patterns like the waffle checkerboard.
- **Partial fallback palette:** cone-renderer.js currently has ~10 base colors, ~7 topping colors. The canonical source has 13 base + 21 topping colors. Missing fallback entries means offline/API-failure renders break for newer flavors.
- **Editing colors in non-canonical files:** All color changes must start in flavor-colors.js. Editing cone-renderer.js or culvers_fotd.star directly creates drift.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG rasterization | Custom canvas/puppeteer pipeline | sharp with density option | sharp handles SVG via libvips/librsvg; density param controls DPI natively |
| Color drift detection | Custom diff script | vitest assertions comparing exported objects | Tests already import from flavor-colors.js; add assertions comparing against other file constants |
| PNG metadata (DPI) | Manual EXIF writing | `sharp.withMetadata({ density: 300 })` | Built-in sharp method, documented |

## Common Pitfalls

### Pitfall 1: SVG viewBox dimensions vs sharp density
**What goes wrong:** Setting `density: 300` on an SVG that has explicit `width` and `height` attributes causes sharp to render at 300/72 = 4.17x the specified pixel dimensions, producing a much larger raster than expected.
**Why it happens:** sharp's density for SVG input tells librsvg "treat 1 user unit as 1/density inches." If the SVG says `width="144"`, that means 144 user units = 144/300 inches = 0.48 inches at 300 DPI, which is 144 pixels. But if the SVG uses non-pixel units or no explicit size, the behavior changes.
**How to avoid:** The hero SVGs use explicit pixel dimensions (`width="144" height="168"` at scale 4). With density=300, librsvg interprets these as pixel values and rasterizes at those exact dimensions. The density setting improves the internal rendering quality of curves and edges within those pixel bounds. Verify the output PNG dimensions match 144x168 after the change.
**Warning signs:** Output PNGs are unexpectedly large (e.g., 600x700px instead of 144x168px). If this happens, the SVG viewBox/width/height may need adjustment.

### Pitfall 2: Starlark comment syntax
**What goes wrong:** Using `//` or Python-style inline annotations in Starlark files.
**Why it happens:** Starlark is Python-like but NOT Python. It uses `#` for comments. String escaping also differs (no f-strings, use `.format()`).
**How to avoid:** Only edit color hex values in the dict literals. Don't restructure or refactor Starlark code.

### Pitfall 3: cone-renderer.js uses var (no build step)
**What goes wrong:** Using `const`, `let`, arrow functions, template literals, or ES module syntax in cone-renderer.js.
**Why it happens:** This file is served directly as a `<script>` tag with no bundler. It uses the IIFE pattern with `var` declarations throughout.
**How to avoid:** All edits to cone-renderer.js must use `var` declarations and ES5-compatible syntax. No modern JS features.

### Pitfall 4: Golden hash test failures after geometry/color changes
**What goes wrong:** Changing colors or HD geometry causes the golden pixel hash tests to fail.
**Why it happens:** The test suite includes deterministic golden hashes for 5 reference flavors across all 4 tiers. Any rendering change invalidates these.
**How to avoid:** After making changes, run `UPDATE_GOLDENS=1 npm test` (or `npm run bless:cones`) to regenerate golden hashes, then update the GOLDEN_HASHES table in flavor-colors.test.js.

### Pitfall 5: flavor-audit.html has 6-row mini cone scoop
**What goes wrong:** The mini cone renderer in flavor-audit.html uses a different scoop geometry than the canonical Mini renderer.
**Why it happens:** flavor-audit.html miniCone function has a 6-row scoop `[[3,5],[2,6],[1,7],[1,7],[1,7],[2,6]]` while the canonical renderConeSVG has a 5-row scoop `[[3,5],[2,6],[1,7],[1,7],[1,7]]`. This is a geometry difference, not a color issue.
**How to avoid:** Phase 13 scope is COLOR sync only. Do not attempt to fix geometry differences in flavor-audit.html's miniCone function -- that would be profile/geometry sync, which is deferred.

## Code Examples

### Fix 1: generate-hero-cones.mjs -- Remove resize, add density
```javascript
// BEFORE (broken):
async function svgToPng(svgString, width) {
  const svgBuffer = Buffer.from(svgString);
  return sharp(svgBuffer)
    .resize({ width, kernel: 'nearest' })
    .png()
    .toBuffer();
}
// Called as: await svgToPng(svg, 120);

// AFTER (fixed):
async function svgToPng(svgString) {
  const svgBuffer = Buffer.from(svgString);
  return sharp(svgBuffer, { density: 300 })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();
}
// Called as: await svgToPng(svg);
// Output: 144x168px PNG at 300 DPI metadata (no resize)
```
Source: [sharp constructor docs](https://sharp.pixelplumbing.com/api-constructor/) - density option, [sharp output docs](https://sharp.pixelplumbing.com/api-output/) - withMetadata

### Fix 2: cone-renderer.js -- HD scoop geometry
```javascript
// BEFORE (broken - missing taper):
var scoopRows = [[4,13],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15]];

// AFTER (fixed - matches flavor-colors.js):
var scoopRows = [[4,13],[3,14],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[3,14]];
//                       ^^^^^^                                                       ^^^^^^
//                       row 1: taper step                                row 10: bottom shoulder
```
Source: flavor-colors.js renderConeHDSVG lines 352-364

### Fix 3: cone-renderer.js -- FALLBACK color sync (example subset)
```javascript
// BEFORE (drifted):
var FALLBACK_BASE_COLORS = {
  chocolate: '#7B4A2E',      // wrong
  dark_chocolate: '#4B2E2E', // wrong
  mint: '#8FD9A8',           // wrong
  strawberry: '#E88AAE',     // wrong
  cheesecake: '#F3E7CB',     // wrong
  caramel: '#C58A45',        // wrong
  peach: '#F1B37C',          // wrong
  // missing: chocolate_custard, mint_andes, lemon, blackberry
};

// AFTER (synced from canonical):
var FALLBACK_BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#6F4E37',
  chocolate_custard: '#5A3825',
  dark_chocolate: '#3B1F0B',
  mint: '#2ECC71',
  mint_andes: '#1A8A4A',
  strawberry: '#FF6B9D',
  cheesecake: '#FFF5E1',
  caramel: '#C68E17',
  butter_pecan: '#F2E7D1',
  peach: '#FFE5B4',
  lemon: '#FFF176',
  blackberry: '#6B3FA0',
};
```

## Color Drift Analysis

Complete drift inventory between the 4 sync files. flavor-colors.js is canonical (C). Drifted values are marked with arrows.

### BASE_COLORS Drifts

| Key | Canonical (C) | cone-renderer.js | culvers_fotd.star | flavor-audit.html |
|-----|---------------|-----------------|-------------------|-------------------|
| chocolate | #6F4E37 | **#7B4A2E** | = | = |
| dark_chocolate | #3B1F0B | **#4B2E2E** | = | = |
| mint | #2ECC71 | **#8FD9A8** | = | = |
| strawberry | #FF6B9D | **#E88AAE** | = | = |
| cheesecake | #FFF5E1 | **#F3E7CB** | = | = |
| caramel | #C68E17 | **#C58A45** | = | = |
| butter_pecan | #F2E7D1 | = | **#D4A574** | = |
| peach | #FFE5B4 | **#F1B37C** | = | = |
| chocolate_custard | #5A3825 | (missing) | (missing) | (missing) |
| mint_andes | #1A8A4A | (missing) | = | = |
| lemon | #FFF176 | (missing) | = | = |
| blackberry | #6B3FA0 | (missing) | = | = |

### RIBBON_COLORS Drifts

| Key | Canonical (C) | cone-renderer.js | culvers_fotd.star | flavor-audit.html |
|-----|---------------|-----------------|-------------------|-------------------|
| caramel | #D38B2C | = | **#DAA520** | **#DAA520** |
| peanut_butter | #D4A017 | **#9B6A3A** | = | = |
| marshmallow | #FFFFFF | **#EDE3D1** | = | = |
| fudge | #3B1F0B | **#4B2E2E** | = | = |
| chocolate_syrup | #1A0A00 | (missing) | = | = |

### TOPPING_COLORS Drifts

| Key | Canonical (C) | cone-renderer.js | culvers_fotd.star | flavor-audit.html |
|-----|---------------|-----------------|-------------------|-------------------|
| oreo | #1A1A1A | **#3A2E2A** | = | = |
| andes | #1FAE7A | = | **#00897B** | = |
| dove | #2B1A12 | = | **#3B1F0B** | **#3B1F0B** |
| pecan | #8B5A2B | = | **#8B6914** | **#8B6914** |
| heath | #DAA520 | **#C58A45** | = | = |
| cookie_dough | #C4A882 | **#C48A5A** | = | = |
| raspberry | #E91E63 | **#B24A64** | = | = |
| reeses | #D4A017 | **#A56A43** | = | = |
| brownie | #2D1700 | **#4B2E2E** | = | = |

### Missing Keys (need to be added as complete fallback copy)

**cone-renderer.js FALLBACK_ missing keys:** chocolate_custard, mint_andes, lemon, blackberry (base), chocolate_syrup (ribbon), cashew, butterfinger, strawberry_bits, peach_bits, salt, snickers, cake, cheesecake_bits, m_and_m, blueberry, pie_crust, blackberry_drupe (toppings)

**cone-renderer.js FALLBACK_ extra keys (not in canonical):** caramel_bits, peanut_butter_cup (toppings), strawberry, lemon, blackberry (ribbons) -- these should be removed OR verified as valid additions

**culvers_fotd.star missing keys:** chocolate_custard (base), cheesecake_bits (topping), blackberry_drupe (topping)

**flavor-audit.html missing keys:** chocolate_custard (base), blackberry_drupe (topping)

### Drifts Requiring Judgment (Claude's Discretion)

Per CONTEXT.md, Claude picks the more accurate hex for each drifted pair:

| Color | Canonical | Alternative | Real-world reference |
|-------|-----------|-------------|---------------------|
| caramel ribbon | #D38B2C (warm amber) | #DAA520 (goldenrod) | Real caramel drizzle is warm amber-brown |
| andes topping | #1FAE7A (bright teal-green) | #00897B (darker teal) | Andes mint pieces are bright green |
| dove topping | #2B1A12 (very dark brown) | #3B1F0B (dark brown) | Dove chocolate is dark brown |
| pecan topping | #8B5A2B (sienna brown) | #8B6914 (golden-brown) | Pecans are warm brown with golden tones |
| butter_pecan base | #F2E7D1 (cream) | #D4A574 (tan) | Butter pecan custard is light cream |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 72 DPI SVG rasterization (sharp default) | 300 DPI via density constructor option | sharp 0.26+ | Crisper edges, especially visible on retina displays |
| SVG -> resize -> PNG pipeline | SVG -> 1:1 PNG (no resize) | This phase | Eliminates fractional-pixel artifacts in checkerboard patterns |
| Partial FALLBACK palette | Full palette copy | This phase | Offline rendering works for all 40+ flavors, not just original 10 |

## Open Questions

1. **sharp output dimensions with density=300**
   - What we know: sharp density for SVG input controls rasterization DPI. The SVG has explicit `width="144" height="168"` attributes. With density=300, librsvg should render at 144x168 pixels.
   - What's unclear: Some sharp versions have produced unexpectedly large outputs when density differs from the SVG's implicit DPI. Need to verify output dimensions after the change.
   - Recommendation: Add a dimension assertion in the generate script (check buffer metadata width/height after conversion). If output is larger than expected, adjust the SVG scale factor or add an explicit resize to 144.

2. **flavor-audit.html mini cone geometry**
   - What we know: The miniCone function in flavor-audit.html has a 6-row scoop vs the canonical 5-row scoop. The cone portion also starts at row 6 instead of row 5.
   - What's unclear: Whether this was intentional for audit display purposes or accidental drift.
   - Recommendation: Leave as-is per CONTEXT.md scope (colors only, not geometry). Note for future phases.

3. **cone-renderer.js extra FALLBACK keys**
   - What we know: cone-renderer.js has FALLBACK entries for strawberry, lemon, blackberry ribbons and caramel_bits, peanut_butter_cup toppings that don't exist in the canonical source.
   - What's unclear: Whether these are vestigial entries from an older version or intentionally added for client-side keyword fallback logic.
   - Recommendation: Remove extras that aren't in canonical. The full-copy sync approach means FALLBACK should mirror canonical exactly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js` |
| Full suite command | `cd custard-calendar/worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RNDQ-01 | PNG output is 144x168px with no resize step | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "hero"` | Partial -- existing tests cover SVG output, not PNG pipeline |
| RNDQ-02 | Sharp uses density=300 | integration | `node custard-calendar/scripts/generate-hero-cones.mjs` + verify PNG metadata | Not automated -- manual script run |
| RNDQ-03 | Color hex values match across all 4 sync files | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "color sync"` | Wave 0 gap |
| RNDQ-04 | HD scoop geometry matches server | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -t "HD"` | Partial -- existing HD tests don't compare client geometry |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js`
- **Per wave merge:** `cd custard-calendar/worker && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/flavor-colors.test.js` -- add color-sync assertions comparing canonical exports against hardcoded values from the other 3 files (verifies RNDQ-03)
- [ ] Update golden hashes after geometry and color changes (`npm run bless:cones`)
- [ ] No new test file needed -- existing test file covers the right modules

## Sources

### Primary (HIGH confidence)
- `custard-calendar/worker/src/flavor-colors.js` -- canonical color palettes, all 4 renderer implementations (826 lines)
- `custard-calendar/docs/cone-renderer.js` -- client renderer with FALLBACK constants (367 lines)
- `custard-calendar/tidbyt/culvers_fotd.star` -- Starlark renderer with independent color palettes (992 lines)
- `custard-calendar/docs/flavor-audit.html` -- audit tool with SEED_ constants
- `custard-calendar/scripts/generate-hero-cones.mjs` -- PNG generation pipeline (128 lines)
- `custard-calendar/worker/test/flavor-colors.test.js` -- vitest suite with golden hashes (729 lines)
- [sharp constructor docs](https://sharp.pixelplumbing.com/api-constructor/) -- density parameter: number 1-100000, default 72
- [sharp output docs](https://sharp.pixelplumbing.com/api-output/) -- withMetadata({ density }) for PNG DPI metadata

### Secondary (MEDIUM confidence)
- [sharp GitHub issue #1421](https://github.com/lovell/sharp/issues/1421) -- SVG to PNG pixelation with explicit width/height
- [sharp GitHub issue #2358](https://github.com/lovell/sharp/issues/2358) -- density option behavior with PNG output

### Tertiary (LOW confidence)
- None -- all findings verified against source code and official sharp documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code examined directly
- Architecture: HIGH - all 4 source files read in full, drift cataloged line-by-line
- Pitfalls: HIGH - sharp density behavior verified against official docs; golden hash pattern understood from test file

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependency changes expected)
