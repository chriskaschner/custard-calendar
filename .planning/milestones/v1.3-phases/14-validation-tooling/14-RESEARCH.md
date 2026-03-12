# Phase 14: Validation Tooling - Research

**Researched:** 2026-03-09
**Domain:** Automated CI gates for color palette sync, contrast checking, and pixelmatch visual regression
**Confidence:** HIGH

## Summary

Phase 14 builds three automated CI guard tools that run within the existing Vitest test suite (worker-tests job). All three are pure JavaScript -- no native dependencies needed. The renderers produce deterministic SVG strings composed of `<rect>` elements at integer coordinates, and the existing `renderToPixels()` helper already parses these to pixel maps. This means pixelmatch golden baselines can work by converting pixel maps to raw RGBA buffers without requiring sharp, canvas, or any native rasterization library.

The palette sync test (VALD-01) requires parsing color hex values from 5 files in 3 different formats: JavaScript ESM exports, vanilla JS `var` declarations, embedded HTML script tags, and Starlark Python-like dict literals. The custard-tidbyt Starlark copy already has significant color drift (different hex values for `butter_pecan`, `andes`, `dove`, `pecan`, `caramel` ribbon, and missing entries for `chocolate_custard`, `mint_andes`, `lemon`, `blackberry`, plus several topping colors). This drift must be fixed as part of this phase or flagged as pre-existing.

The contrast checker (VALD-02) implements standard WCAG relative luminance calculation. The 3:1 ratio threshold for topping-on-base visibility is straightforward to compute from hex values. All 40 profiled flavors must pass before the gate goes live.

**Primary recommendation:** Keep all three tools as Vitest test files within `worker/test/`. Use pixelmatch v7.x (ESM, zero dependencies) operating on RGBA buffers synthesized from `renderToPixels()` output. Parse Starlark with regex (Python-like dict syntax is simple enough). Store ~160 golden PNG baselines in `worker/test/fixtures/goldens/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 40 currently profiled flavors get pixelmatch baselines across all 4 rendering tiers (Mini/HD/Hero/Premium) -- ~160 baseline images
- Zero tolerance diff threshold -- rendering is deterministic (seeded PRNG), any pixel difference is a real change
- Baseline PNG files stored in repo (test fixtures directory) -- reviewable in PRs, visually inspectable
- New profiles (Phase 16) must auto-generate golden baselines as part of the same commit -- no unprofiled gaps
- Intentional changes use UPDATE_GOLDENS=1 to regenerate baselines and commit new PNGs
- All 3 tools are hard CI gates that block merges:
  - VALD-01 (palette sync): color drift between any sync file blocks merge
  - VALD-02 (contrast checker): topping/base combo below 3:1 blocks merge
  - VALD-03 (pixelmatch): any unintended visual change blocks merge
- Existing 40 profiles checked immediately against contrast requirement -- fix any failures in this phase before the gate goes live (clean slate for Phase 16)
- Same strictness as JS files -- Starlark color drift blocks merge, matching Phase 13 "exact match" policy
- Both Starlark copies covered: custard-calendar/tidbyt/culvers_fotd.star AND custard-tidbyt/apps/culversfotd/culvers_fotd.star
- Scope is colors only (BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS) -- not FLAVOR_PROFILES (profile sync deferred per Phase 13)
- CONE_COLORS (waffle_dark, waffle_light, waffle_shadow) included in sync check

### Claude's Discretion
- Test file organization and naming within the Vitest suite
- Pixelmatch library choice and integration approach
- How to parse colors from Starlark and HTML files for comparison
- Contrast ratio calculation implementation
- Exact fixture directory structure for golden PNG storage

### Deferred Ideas (OUT OF SCOPE)
- FLAVOR_PROFILES sync across Starlark files -- separate from color hex sync, deferred per Phase 13
- LED-specific color optimization for Tidbyt -- future phase if exact match proves problematic on hardware
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VALD-01 | CI test catches palette drift between flavor-colors.js and cone-renderer.js | Palette sync test comparing canonical exports against 4 downstream files; regex parsers for JS/Starlark/HTML formats |
| VALD-02 | Contrast checker flags topping/base combinations below 3:1 ratio | WCAG luminance formula implementation; iterate all FLAVOR_PROFILES entries and check every topping color against the profile's base color |
| VALD-03 | Pixelmatch golden baselines exist for all 4 tiers across reference flavors | pixelmatch v7.x on RGBA buffers from renderToPixels(); 160 golden PNGs stored in fixtures; UPDATE_GOLDENS=1 regeneration |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test runner | Already in project; all existing tests use it |
| pixelmatch | ^7.1.0 | Pixel-level image comparison | Zero dependencies, ESM, works on raw typed arrays, 150 LOC |
| pngjs | ^7.0.0 | PNG encode/decode for golden baselines | Pure JS PNG codec, no native deps, sync API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | Contrast ratio calculation | Hand-roll: ~15 lines of WCAG luminance math, not worth a dependency |
| (none) | - | Starlark parsing | Hand-roll: regex extraction of Python dict literals, specific to this project's format |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pixelmatch + pngjs | sharp (SVG rasterization) | sharp has native C++ deps; heavier install, CI complexity; not needed since SVG is rect-based pixel art already parsed by renderToPixels() |
| pngjs for baselines | Raw JSON pixel maps | PNG files are visually inspectable in PRs and git diffs; JSON would be large and unreadable |
| Custom contrast calc | chroma-js or polished | Over-engineered for a 15-line luminance formula; adds unnecessary dependency |

**Installation:**
```bash
cd worker && npm install --save-dev pixelmatch pngjs
```

## Architecture Patterns

### Recommended Project Structure
```
worker/test/
  palette-sync.test.js          # VALD-01: color hex sync across 5 files
  contrast-check.test.js        # VALD-02: topping/base contrast ratios
  golden-baselines.test.js      # VALD-03: pixelmatch visual regression
  fixtures/
    goldens/
      mini/                     # 40 PNG files (9x11 px each)
      hd/                       # 40 PNG files (18x21 px each)
      hero/                     # 40 PNG files (36x42 px each)
      premium/                  # 40 PNG files (24x28 px each)
```

### Pattern 1: Palette Sync Test (VALD-01)

**What:** Parse color hex values from all 5 sync files, compare each against canonical `flavor-colors.js` exports.
**When to use:** Every CI run, catches any color drift before merge.

The 5 sync files and their formats:

1. **`worker/src/flavor-colors.js`** (canonical) -- ESM exports: `export const BASE_COLORS = { vanilla: '#F5DEB3', ... }`
2. **`docs/cone-renderer.js`** (FALLBACK constants) -- var declarations: `var FALLBACK_BASE_COLORS = { vanilla: '#F5DEB3', ... }`
3. **`tidbyt/culvers_fotd.star`** -- Starlark dicts: `BASE_COLORS = { "vanilla": "#F5DEB3", ... }`
4. **`custard-tidbyt/apps/culversfotd/culvers_fotd.star`** -- Same Starlark format (separate repo copy)
5. **`docs/flavor-audit.html`** -- Embedded JS: `var SEED_BASE = { vanilla:'#F5DEB3', ... }`

**Parsing approach:**
```javascript
// For JS files (canonical + cone-renderer): import directly or read + regex
import { BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS } from '../src/flavor-colors.js';

// For Starlark: read file, extract dict blocks with regex
function parseStarlarkColorDict(content, dictName) {
  // Match: DICT_NAME = {\n  "key": "#HEXVAL",\n  ...  }
  const blockRe = new RegExp(`${dictName}\\s*=\\s*\\{([^}]+)\\}`, 's');
  const match = content.match(blockRe);
  if (!match) return {};
  const entries = {};
  const pairRe = /"([^"]+)":\s*"(#[0-9A-Fa-f]{6})"/g;
  let m;
  while ((m = pairRe.exec(match[1])) !== null) {
    entries[m[1]] = m[2].toUpperCase();
  }
  return entries;
}

// For HTML embedded JS: read file, extract var blocks with regex
function parseHTMLColorVar(content, varName) {
  const blockRe = new RegExp(`var\\s+${varName}\\s*=\\s*\\{([^}]+)\\}`, 's');
  const match = content.match(blockRe);
  if (!match) return {};
  const entries = {};
  const pairRe = /(\w+):\s*'(#[0-9A-Fa-f]{6})'/g;
  let m;
  while ((m = pairRe.exec(match[1])) !== null) {
    entries[m[1]] = m[2].toUpperCase();
  }
  return entries;
}

// For cone-renderer.js FALLBACK vars: same pattern as HTML vars
```

**Key detail:** The CONTEXT.md mentions `CONE_COLORS (waffle_dark, waffle_light, waffle_shadow)` but the actual code only has `waffle` and `waffle_dark` keys. There is no `waffle_light` or `waffle_shadow` in any file. The sync test should cover the CONE_COLORS keys that actually exist: `{ waffle, waffle_dark }`. The cone colors appear as inline hex literals in Starlark (e.g., `color = "#D2691E"` and `color = "#B8860B"` in render functions), NOT as named dict entries. The sync test for Starlark cone colors should match these hex values against the canonical CONE_COLORS values.

### Pattern 2: Contrast Checker (VALD-02)

**What:** WCAG relative luminance calculation to verify all topping/base color combinations meet 3:1 contrast ratio.
**When to use:** Every CI run, prevents low-contrast topping placement.

```javascript
// WCAG 2.0 relative luminance
function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const srgb = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Test: for each profile, check every topping color against base color
for (const [name, profile] of Object.entries(FLAVOR_PROFILES)) {
  const baseHex = BASE_COLORS[profile.base];
  for (const topping of profile.toppings) {
    const toppingHex = TOPPING_COLORS[topping];
    const ratio = contrastRatio(baseHex, toppingHex);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  }
}
```

### Pattern 3: Pixelmatch Golden Baselines (VALD-03)

**What:** Render all 40 flavors at all 4 tiers, convert pixel maps to RGBA buffers, compare against stored PNG baselines using pixelmatch.
**When to use:** Every CI run, catches any unintended visual change.

```javascript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

// Convert renderToPixels() Map -> RGBA Uint8Array for a known grid size
function pixelMapToRGBA(pixelMap, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const idx = (y * width + x) * 4;
      const hex = pixelMap.get(key);
      if (hex) {
        data[idx] = parseInt(hex.slice(1, 3), 16);     // R
        data[idx + 1] = parseInt(hex.slice(3, 5), 16); // G
        data[idx + 2] = parseInt(hex.slice(5, 7), 16); // B
        data[idx + 3] = 255;                            // A
      }
      // else: transparent (0,0,0,0) -- background
    }
  }
  return data;
}

// Save RGBA buffer as PNG file
function saveGolden(rgba, width, height, filePath) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  const buffer = PNG.sync.write(png);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

// Compare against golden baseline
function compareGolden(currentRGBA, width, height, goldenPath) {
  const goldenData = fs.readFileSync(goldenPath);
  const goldenPNG = PNG.sync.read(goldenData);
  const numDiff = pixelmatch(
    currentRGBA, goldenPNG.data,
    null, // no diff output needed
    width, height,
    { threshold: 0 } // zero tolerance
  );
  return numDiff;
}
```

**UPDATE_GOLDENS=1 flow:**
1. Render all 40 flavors x 4 tiers
2. Convert each to RGBA buffer via `pixelMapToRGBA()`
3. Encode as PNG via pngjs, write to `worker/test/fixtures/goldens/{tier}/{slug}.png`
4. Print summary of updated baselines
5. Tests pass (skip comparison when updating)

**Normal test flow:**
1. Render all 40 flavors x 4 tiers
2. Convert each to RGBA buffer
3. Read golden PNG from disk
4. Compare via pixelmatch with `threshold: 0`
5. Fail with descriptive error if numDiff > 0

### Anti-Patterns to Avoid
- **Using sharp for SVG rasterization:** The SVG output is simple rect-based pixel art. `renderToPixels()` already parses it to a pixel map. No need for a 30MB native dependency.
- **Storing golden baselines as JSON pixel hashes:** The existing golden hash tests (GOLDEN_HASHES in flavor-colors.test.js) already do this. Pixelmatch baselines are explicitly required to be PNG files for visual inspectability.
- **Hardcoding expected colors in sync tests:** Always parse from the actual files. The test should discover what colors each file contains and compare, not embed expected values.
- **Testing contrast only for new profiles:** All 40 existing profiles must pass the contrast gate before it goes live, per locked decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pixel-level image comparison | Custom diff algorithm | pixelmatch v7.x | Anti-aliasing detection, perceptual color difference, battle-tested |
| PNG encoding/decoding | Buffer manipulation | pngjs v7.x | PNG format is complex (chunks, filters, CRC); pngjs handles edge cases |
| WCAG contrast ratio | - | Hand-roll (15 lines) | Standard formula, too simple for a dependency |
| Starlark color parsing | Full Starlark parser | Regex extraction | Only need dict key:value pairs; full parser is overkill |

**Key insight:** The heaviest part (SVG rendering to pixel data) is already solved by `renderToPixels()` in the existing test file. The new work is wiring pixel maps to pixelmatch via RGBA buffer conversion and building the sync/contrast tests.

## Common Pitfalls

### Pitfall 1: Starlark Color Drift Already Exists
**What goes wrong:** The custard-tidbyt Starlark file has DIFFERENT hex values from canonical for several colors. Tests will fail immediately unless drift is fixed first.
**Why it happens:** The custard-tidbyt copy was forked earlier and evolved independently before the "single source of truth" policy.
**Known diffs detected during research:**
- `butter_pecan`: `#D4A574` (custard-tidbyt) vs `#F2E7D1` (canonical)
- `caramel` ribbon: `#DAA520` vs `#D38B2C`
- `andes` topping: `#00897B` vs `#1FAE7A`
- `dove` topping: `#3B1F0B` vs `#2B1A12`
- `pecan` topping: `#8B6914` vs `#8B5A2B`
- Missing entries in custard-tidbyt: `chocolate_custard`, `mint_andes`, `lemon`, `blackberry`, `brownie`, `blueberry`, `pie_crust`, `blackberry_drupe`
**How to avoid:** Fix the custard-tidbyt Starlark colors BEFORE enabling the sync gate. This is part of the phase scope per CONTEXT.md: "fix any failures in this phase before the gate goes live."
**Warning signs:** Sync test failures on first run.

### Pitfall 2: CONE_COLORS Not a Named Dict in Starlark
**What goes wrong:** The Starlark files do NOT have a `CONE_COLORS` dictionary. Waffle colors are inline hex literals (`"#D2691E"` and `"#B8860B"`) in the render function. The sync test cannot do a simple dict-to-dict comparison.
**Why it happens:** The Starlark renderer uses pixel-level `render.Box()` calls with hardcoded colors, not named constants.
**How to avoid:** For Starlark cone colors, verify the specific hex values appear in the file rather than looking for a named dict. Alternatively, refactor Starlark to use a named dict (adds one variable, low risk).
**Warning signs:** Sync test finds 0 cone colors in Starlark.

### Pitfall 3: Contrast Failures in Existing Profiles
**What goes wrong:** Some topping/base combinations may already fail the 3:1 contrast ratio. These must be identified and fixed before the gate activates.
**Why it happens:** Color choices were made for aesthetic reasons without formal contrast checking.
**How to avoid:** Run the contrast checker in a discovery mode first. If failures exist, adjust colors (or accept intentional low-contrast as documented exceptions) before making it a hard gate.
**Warning signs:** The `dove` topping (#2B1A12, very dark brown) on `dark_chocolate` base (#3B1F0B, also very dark brown) is likely below 3:1. Similarly, `fudge` ribbon (#3B1F0B) is identical to `dark_chocolate` base.

### Pitfall 4: PNG File Size in Git
**What goes wrong:** 160 small PNG files in the repo could bloat git history if regenerated frequently.
**Why it happens:** Each tier has different dimensions, but they are tiny pixel-art images (9x11 to 36x42 pixels). At these sizes, each PNG is likely under 1KB.
**How to avoid:** At ~500 bytes per file, 160 files total is ~80KB. This is negligible. Not a real concern.
**Warning signs:** None expected -- file sizes will be tiny.

### Pitfall 5: Path Resolution in CI
**What goes wrong:** Tests use `fs.readFileSync()` with relative paths that work locally but break in CI.
**Why it happens:** CI working directory may differ from local dev.
**How to avoid:** Use `import.meta.url` or `path.resolve(__dirname)` patterns to build absolute paths from the test file location. Or use Vitest's `import.meta.dirname` (available in Node 20+).
**Warning signs:** Tests pass locally but fail in CI with ENOENT errors.

## Code Examples

### renderToPixels Reuse

The existing `renderToPixels()` function in `worker/test/flavor-colors.test.js` (lines 444-469) already parses SVG output into a `Map<string, string>` of pixel coordinates to hex colors. This should be extracted to a shared test utility for reuse by the golden baseline tests.

```javascript
// Source: worker/test/flavor-colors.test.js (existing)
function renderToPixels(svgStr) {
  const map = new Map();
  const rectRe = /<rect\s+([^>]+)>/g;
  let m;
  while ((m = rectRe.exec(svgStr)) !== null) {
    const attrs = m[1];
    const getInt = (name) => {
      const am = attrs.match(new RegExp(`\\b${name}="(\\d+)"`));
      return am ? parseInt(am[1]) : 0;
    };
    const x = getInt('x');
    const y = getInt('y');
    const w = getInt('width') || 1;
    const h = getInt('height') || 1;
    const fm = attrs.match(/\bfill="([^"]+)"/);
    const fill = fm ? fm[1] : '';
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        map.set(`${x + dx},${y + dy}`, fill);
      }
    }
  }
  return map;
}
```

### Flavor Name to Slug Conversion (for PNG filenames)

```javascript
// Match heroConeSrc() pattern from cone-renderer.js
function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
// "really reese's" -> "really-reese-s"
// "devil's food cake" -> "devil-s-food-cake"
```

### Reading Starlark Files for Sync Test

```javascript
import fs from 'node:fs';
import path from 'node:path';

// Paths relative to worker/ directory
const STARLARK_PATHS = [
  '../tidbyt/culvers_fotd.star',
  '../../custard-tidbyt/apps/culversfotd/culvers_fotd.star',
];

// Color dict names to check in Starlark
const STARLARK_COLOR_DICTS = ['BASE_COLORS', 'RIBBON_COLORS', 'TOPPING_COLORS'];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hash-based golden tests | Pixelmatch PNG baselines | This phase | Visual diff inspectability in PRs |
| Manual color sync review | Automated CI sync gate | This phase | Prevents accidental drift |
| No contrast enforcement | Automated 3:1 ratio gate | This phase | Ensures topping visibility |
| pixelmatch v5 (CJS only) | pixelmatch v7 (ESM + CJS) | 2024 | Clean ESM import in Vitest |

**Existing infrastructure being extended:**
- `renderToPixels()` + `stableHash()` in flavor-colors.test.js: existing golden hash approach (20 hashes for 5 flavors x 4 tiers). VALD-03 extends this to full pixelmatch for all 40 flavors.
- `UPDATE_GOLDENS=1` env var pattern: already established for hash updates. Same pattern extended for PNG baselines.
- `npm run bless:cones` script: prints golden updates. Can be extended or complemented for pixelmatch baselines.

## Open Questions

1. **Contrast ratio exceptions**
   - What we know: Some dark-on-dark combos (e.g., `dove` topping #2B1A12 on `dark_chocolate` base #3B1F0B) likely fail 3:1.
   - What's unclear: Should these be fixed (change colors) or exempted (documented exception)?
   - Recommendation: Run the checker first, report failures, fix colors where possible. If a specific combo is intentionally low-contrast for aesthetic reasons, add an explicit allowlist with justification.

2. **Starlark CONE_COLORS representation**
   - What we know: Cone colors are inline hex literals in Starlark, not a named dict.
   - What's unclear: Should we refactor Starlark to use a named CONE_COLORS dict (easier to sync-test) or parse inline hex values?
   - Recommendation: Add a `CONE_COLORS` dict to the Starlark files for consistency. Low-risk refactor, makes sync testing cleaner.

3. **custard-tidbyt repo access**
   - What we know: The custard-tidbyt directory is a sibling at `../../custard-tidbyt/` relative to worker/.
   - What's unclear: Is it always present in CI? The CI checkout uses `actions/checkout@v4` on the single repo.
   - Recommendation: The CI yaml only checks out the custard-calendar repo. The custard-tidbyt path (at `../../custard-tidbyt/`) may not exist in CI. Options: (a) add it as a git submodule, (b) make the test skip gracefully if the path is missing with a warning, (c) adjust CI to checkout both repos. Recommend option (b) for now: test custard-tidbyt locally, skip in CI with a logged warning. Revisit when repos are consolidated.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd worker && npx vitest run --reporter=verbose palette-sync contrast-check golden-baselines` |
| Full suite command | `cd worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALD-01 | Color hex sync across 5 files | unit | `cd worker && npx vitest run palette-sync.test.js -x` | -- Wave 0 |
| VALD-02 | Topping/base contrast >= 3:1 | unit | `cd worker && npx vitest run contrast-check.test.js -x` | -- Wave 0 |
| VALD-03 | Pixelmatch golden baselines for 40 flavors x 4 tiers | unit | `cd worker && npx vitest run golden-baselines.test.js -x` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worker && npx vitest run palette-sync contrast-check golden-baselines`
- **Per wave merge:** `cd worker && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/palette-sync.test.js` -- covers VALD-01
- [ ] `worker/test/contrast-check.test.js` -- covers VALD-02
- [ ] `worker/test/golden-baselines.test.js` -- covers VALD-03
- [ ] `worker/test/fixtures/goldens/` directory -- 160 baseline PNGs
- [ ] Install pixelmatch and pngjs: `cd worker && npm install --save-dev pixelmatch pngjs`
- [ ] Extract `renderToPixels()` to shared test utility (currently private to flavor-colors.test.js)
- [ ] Fix custard-tidbyt Starlark color drift before sync gate activation
- [ ] Fix custard-calendar/tidbyt Starlark to add any missing color entries

## Sources

### Primary (HIGH confidence)
- `worker/src/flavor-colors.js` -- canonical color exports, 40 FLAVOR_PROFILES, 4 render functions examined directly
- `worker/test/flavor-colors.test.js` -- existing 728 lines of tests including renderToPixels(), stableHash(), golden hash infrastructure
- `docs/cone-renderer.js` -- FALLBACK constants, var-based JS format confirmed
- `tidbyt/culvers_fotd.star` -- Starlark dict format confirmed, CONE_COLORS absent as named dict
- `custard-tidbyt/apps/culversfotd/culvers_fotd.star` -- color drift confirmed (multiple hex mismatches)
- `docs/flavor-audit.html` -- SEED_BASE/SEED_RIBBON/SEED_TOPPING/SEED_CONE var format confirmed
- `.github/workflows/ci.yml` -- 3-job CI pipeline, worker-tests runs `npm test`
- `worker/vitest.config.js` -- standard Vitest (no Cloudflare pool), Node.js environment confirmed
- `worker/package.json` -- vitest ^3.0.0, no pixelmatch/pngjs yet

### Secondary (MEDIUM confidence)
- [pixelmatch v7.1.0 GitHub](https://github.com/mapbox/pixelmatch) -- API, ESM support, zero deps, threshold option verified
- [pngjs GitHub](https://github.com/pngjs/pngjs) -- sync API for PNG encode/decode, pure JS
- [WCAG 2.0 contrast formula](https://www.w3.org/TR/WCAG20-TECHS/G17.html) -- relative luminance calculation, 3:1 ratio threshold

### Tertiary (LOW confidence)
- CONE_COLORS mention of `waffle_light` and `waffle_shadow` in CONTEXT.md -- these keys do NOT exist in code. Only `waffle` and `waffle_dark` exist. CONTEXT.md may have been inaccurate on this detail.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified (pixelmatch v7.x ESM, pngjs sync API), project already uses Vitest 3.x in Node.js environment
- Architecture: HIGH -- renderToPixels() reuse confirmed, SVG-to-RGBA buffer conversion is straightforward, sync file formats analyzed
- Pitfalls: HIGH -- color drift in custard-tidbyt confirmed by direct file comparison, contrast edge cases identified

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, unlikely to change)
