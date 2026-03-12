# Phase 17: PNG Generation & Deployment - Research

**Researched:** 2026-03-10
**Domain:** PNG asset generation, service worker cache management, browser-side alias resolution
**Confidence:** HIGH

## Summary

Phase 17 is the final phase of the v1.3 Asset Parity milestone. All upstream work (rendering quality, validation tooling, palette expansion, bulk profiling) is complete. The infrastructure is battle-tested: `generate-hero-cones.mjs` already exists and has been used to produce the current 40 PNGs, `sharp` is available via worker dependencies, and the service worker already has the correct stale-while-revalidate pattern for cone PNGs.

The work breaks into three clear areas: (1) regenerate all 94 PNGs from the updated FLAVOR_PROFILES, (2) add alias resolution to `heroConeSrc()` so aliased flavor names map to the correct PNG, and (3) bump `CACHE_VERSION` in the service worker so returning users pick up the fresh assets. A CI test should verify PNG count matches FLAVOR_PROFILES count to prevent future drift.

**Primary recommendation:** Run the existing generation script, modify `heroConeSrc()` to resolve aliases, add a CI count test, bump cache version -- this is integration/deployment work, not new feature development.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Resolve aliases at lookup time, not at generation time -- 94 PNG files total (one per FLAVOR_PROFILES key)
- heroConeSrc() checks FALLBACK_FLAVOR_ALIASES before slugifying the flavor name to build the PNG path
- Unknown flavors (no profile, no alias) return null from heroConeSrc() so callers fall back to HD SVG rendering
- Generate script iterates FLAVOR_PROFILES keys only, does not iterate FLAVOR_ALIASES
- Visual review via flavor-audit.html after generation -- same proven workflow from Phases 15-16
- Generate script prints a summary report: total generated, skipped, failed
- CI test verifies PNG count in docs/assets/cones/ matches FLAVOR_PROFILES key count (catches future drift)
- Verify Today page shows consistent Hero PNG rendering for all profiled flavors (no PNG/SVG mixing for profiled flavors)
- Regenerate all 94 PNGs from scratch (clean slate reflecting all Phase 13-16 color/contrast improvements)
- Single commit for all PNGs -- total ~80KB, small enough for one atomic commit
- Verify .gitignore rules don't block committing docs/assets/cones/*.png (Phase 14 exception was for test fixtures)
- Bump CACHE_VERSION from custard-v18 to custard-v19 in docs/sw.js
- Cache version bump in a separate final commit after PNG generation and verification
- No pre-caching of PNGs in service worker install phase -- stale-while-revalidate at runtime is sufficient
- HD SVG fallback during cache transition period is acceptable (same as current experience)

### Claude's Discretion
- Exact generate script modifications (if any needed beyond running it)
- CI test implementation details (which test file, assertion style)
- Whether to update flavor-audit.html to show PNG vs SVG status per flavor
- Error handling in heroConeSrc() alias resolution

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PNGS-01 | Hero cone PNGs regenerated for all 176+ profiled flavors | Generation script exists (`scripts/generate-hero-cones.mjs`), iterates `FLAVOR_PROFILES` (94 keys). Currently 40 PNGs exist; 54 are missing. Script uses sharp at 300 DPI with nearest-neighbor resize to 144x168. `heroConeSrc()` needs alias resolution so all 94+37=131 flavor name variants resolve to PNGs. |
| PNGS-02 | Service worker CACHE_VERSION bumped after PNG deployment | `docs/sw.js` line 1: `CACHE_VERSION = 'custard-v18'` -- bump to `'custard-v19'`. Activate handler already purges old caches. Cone PNG caching uses stale-while-revalidate (lines 66-79), so new PNGs are fetched on next visit after cache version change. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | 0.33.5/0.34.5 | SVG-to-PNG rasterization at 300 DPI | Already installed via miniflare in worker/node_modules; used by existing generate script |
| vitest | (installed) | CI test runner | Project-wide test framework, all existing tests use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pngjs | (installed) | PNG parsing for golden baselines | Already in devDependencies, used by golden-baselines.test.js |
| pixelmatch | (installed) | Pixel-level regression testing | Already in devDependencies, used by golden-baselines.test.js |

### Alternatives Considered
None -- all tooling is already in place. No new dependencies needed.

**Installation:**
```bash
# No new installations required. sharp is available via worker/node_modules.
# The generate script already resolves sharp from worker dependencies.
```

## Architecture Patterns

### Relevant File Locations
```
custard-calendar/
  scripts/
    generate-hero-cones.mjs     # PNG generation script (runs from project root)
  docs/
    cone-renderer.js             # heroConeSrc() (line 424), FALLBACK_FLAVOR_ALIASES (line 94)
    sw.js                        # CACHE_VERSION (line 1), cone PNG cache strategy (lines 66-79)
    assets/cones/                # Output directory for generated PNGs (40 existing, 94 target)
    flavor-audit.html            # Visual review tool (962 lines)
  worker/
    src/flavor-colors.js         # Canonical FLAVOR_PROFILES (94), FLAVOR_ALIASES (37), renderConeHeroSVG()
    test/                        # All CI tests (vitest)
```

### Pattern 1: PNG Generation Pipeline
**What:** `generate-hero-cones.mjs` iterates `FLAVOR_PROFILES` keys, renders each flavor via `renderConeHeroSVG(name, 4)` to produce a 144x168 SVG, rasterizes via sharp at 300 DPI with nearest-neighbor resize, writes to `docs/assets/cones/{slug}.png`.
**When to use:** Any time profiles or colors change and PNGs need regeneration.
**Key detail:** The slug function is `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')` -- this is used identically in both the generation script and `heroConeSrc()`.

### Pattern 2: Alias Resolution in heroConeSrc()
**What:** Currently `heroConeSrc()` (line 424-431) takes a raw flavor name, slugifies it, and returns a path. For aliased names like "Reeses Peanut Butter Cup", this produces `reeses-peanut-butter-cup.png` -- but no such file exists because the profile is stored under "really reese's" (slug: `really-reese-s.png`).
**Fix:** Before slugifying, normalize the input via `normalizeFlavorKey()`, check if the normalized key exists in `FALLBACK_FLAVOR_ALIASES`, and if so use the alias target for slug generation instead.
**Example:**
```javascript
// Source: docs/cone-renderer.js heroConeSrc() -- needs modification
function heroConeSrc(flavorName) {
  if (!flavorName) return null;
  var key = normalizeFlavorKey(flavorName);
  // Resolve alias to canonical name if applicable
  var canonical = FALLBACK_FLAVOR_ALIASES[key];
  var nameForSlug = canonical || key;
  var slug = nameForSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return null;
  return 'assets/cones/' + slug + '.png';
}
```

### Pattern 3: Service Worker Cache Versioning
**What:** `CACHE_VERSION` in `docs/sw.js` is a string like `'custard-v18'`. On activate, old caches are purged. Cone PNGs use stale-while-revalidate (not pre-cached), so after the cache version bump, old cached PNGs are deleted and fresh ones are fetched on demand.
**When to bump:** After any asset regeneration that changes existing files.

### Anti-Patterns to Avoid
- **Generating PNGs for aliases:** Do NOT iterate FLAVOR_ALIASES in the generate script. Aliases resolve at runtime in the browser. 94 files, not 131.
- **Pre-caching PNGs in service worker install:** The STATIC_ASSETS array (lines 2-31 of sw.js) should NOT include individual PNG paths. Runtime stale-while-revalidate is correct.
- **Returning a path for unknown flavors:** `heroConeSrc()` must return `null` for flavors with no profile AND no alias, so `renderHeroCone()` falls back to HD SVG rendering (which handles keyword-based color matching gracefully).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG-to-PNG conversion | Custom canvas/headless browser | sharp with 300 DPI density | Already proven in generate-hero-cones.mjs; handles SVG parsing, density, resize kernel |
| Slug generation | New slug function | Existing `flavorSlug()` pattern | Must match exactly between generation and lookup or PNGs will 404 |
| Alias resolution | Custom alias lookup | `normalizeFlavorKey()` + `FALLBACK_FLAVOR_ALIASES` lookup | Already normalized, already synced with canonical via palette-sync tests |

**Key insight:** The entire generation pipeline exists and works. The only new code is alias resolution in `heroConeSrc()` (about 3 lines) and a CI count test (about 15 lines).

## Common Pitfalls

### Pitfall 1: Slug Mismatch Between Generator and Lookup
**What goes wrong:** If the slug function in `generate-hero-cones.mjs` differs from `heroConeSrc()`, PNGs will 404 silently and fall back to SVG (looking fine but defeating the purpose).
**Why it happens:** Two independent implementations of the same slugification logic.
**How to avoid:** Verify slug functions are character-for-character identical. Both currently use: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`.
**Warning signs:** Some flavors render as SVG while most render as PNG on the Today page.

### Pitfall 2: .gitignore Blocking PNG Commits
**What goes wrong:** Root `.gitignore` has `*.png` which would block committing generated PNGs.
**Why it happens:** Global PNG exclusion was added to prevent accidental binary commits.
**How to avoid:** The exception `!docs/assets/cones/*.png` already exists on line 52 of `.gitignore`. Already handled -- just verify it works with `git status` after generation.
**Warning signs:** `git status` shows no new files after generating 54 new PNGs.

### Pitfall 3: Stale PNGs from Previous Runs
**What goes wrong:** If old PNGs exist for flavors that were renamed or removed, they waste space and could be served for wrong flavors.
**Why it happens:** Generation script writes new files but does not delete old ones.
**How to avoid:** Since we are regenerating all 94, verify the final count is exactly 94. If there are extras (from the current 40 that might include old/renamed flavors), delete the entire cones/ directory contents before regeneration.
**Warning signs:** PNG count exceeds FLAVOR_PROFILES key count.

### Pitfall 4: Alias Lookup Using Raw Input Instead of Normalized Key
**What goes wrong:** `heroConeSrc("Reese's Peanut Butter Cup")` would fail to find alias because the raw input has a curly apostrophe or mixed case.
**Why it happens:** FALLBACK_FLAVOR_ALIASES keys are pre-normalized (lowercase, ASCII quotes, single spaces).
**How to avoid:** Always run input through `normalizeFlavorKey()` before alias lookup. This function is already defined globally in cone-renderer.js (line 163-170).
**Warning signs:** Aliased flavors render as SVG fallback instead of PNG.

### Pitfall 5: Cache Version Not Bumped After Deployment
**What goes wrong:** Returning users see old (stale) cached PNGs for the 40 already-existing flavors. New flavors work fine (no stale cache), but old flavors show pre-Phase-13 colors.
**Why it happens:** Stale-while-revalidate serves cached version immediately; background revalidation eventually updates. But without a cache version bump, the old cache persists indefinitely.
**How to avoid:** Always bump CACHE_VERSION after changing existing assets. The activate handler purges all caches that don't match the current version string.
**Warning signs:** Old users see different colors than new users for the same flavor.

## Code Examples

### heroConeSrc() with Alias Resolution
```javascript
// Source: docs/cone-renderer.js line 424 -- needs modification
function heroConeSrc(flavorName) {
  if (!flavorName) return null;
  var key = normalizeFlavorKey(flavorName);
  // Resolve alias to canonical name for PNG path
  var canonical = FALLBACK_FLAVOR_ALIASES[key];
  var nameForSlug = canonical || key;
  var slug = nameForSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return null;
  return 'assets/cones/' + slug + '.png';
}
```

### CI Test: PNG Count Matches FLAVOR_PROFILES
```javascript
// Source: new test file in worker/test/ (e.g., png-asset-count.test.js)
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLAVOR_PROFILES } from '../src/flavor-colors.js';

const CONES_DIR = resolve(import.meta.dirname, '../../docs/assets/cones');

describe('PNG asset count', () => {
  it('docs/assets/cones/ has exactly one PNG per FLAVOR_PROFILES key', () => {
    const pngFiles = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
    const profileCount = Object.keys(FLAVOR_PROFILES).length;
    expect(pngFiles.length).toBe(profileCount);
  });
});
```

### Service Worker Cache Bump
```javascript
// Source: docs/sw.js line 1 -- change from:
const CACHE_VERSION = 'custard-v18';
// To:
const CACHE_VERSION = 'custard-v19';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 40 PNGs for original profiled flavors | 94 PNGs for all profiled flavors | Phase 17 (this phase) | Full Hero PNG coverage, no SVG fallback for profiled flavors |
| heroConeSrc() raw slugify only | heroConeSrc() with alias resolution | Phase 17 (this phase) | Aliased flavor names (37 entries) correctly resolve to PNG paths |
| CACHE_VERSION custard-v18 | CACHE_VERSION custard-v19 | Phase 17 (this phase) | Returning users get fresh PNGs reflecting Phase 13-16 improvements |

**Context on existing 40 PNGs:** These were generated before Phase 13-16 improvements. They use pre-improvement colors and profiles. Regenerating all 94 from scratch ensures every PNG reflects the latest rendering quality, palette, and profile changes.

## Open Questions

1. **Should old PNGs be cleaned before regeneration?**
   - What we know: Current 40 PNGs were generated from the original profiled set. All 40 flavor names still exist in FLAVOR_PROFILES (verified -- all slugs match current profile keys).
   - What's unclear: Whether any stale PNG filenames from previous rename attempts could exist.
   - Recommendation: Clear the docs/assets/cones/ directory before running the generate script. This ensures exactly 94 files with no orphans. The generate script creates the directory if missing.

2. **Total binary size estimate**
   - What we know: Current 40 PNGs average ~1.5KB each (total 160KB on disk, ~61KB in git). 94 PNGs at 1.5KB each would be ~141KB on disk.
   - What's unclear: CONTEXT.md estimated ~80KB total -- actual may be higher since each PNG is ~1.5KB.
   - Recommendation: Proceed regardless. 141KB of PNGs is trivially small for a git repo and for GitHub Pages serving.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (installed via worker/devDependencies) |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js` |
| Full suite command | `cd custard-calendar/worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PNGS-01 | 94 PNGs exist in docs/assets/cones/ | unit (file count) | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "PNG asset count"` | No -- Wave 0 |
| PNGS-01 | heroConeSrc() resolves aliases to correct PNG paths | unit | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "alias resolution"` | No -- Wave 0 |
| PNGS-01 | Visual quality consistent (golden baselines unchanged) | regression | `cd custard-calendar/worker && npx vitest run golden-baselines.test.js` | Yes |
| PNGS-02 | CACHE_VERSION is custard-v19 | unit (string check) | `cd custard-calendar/worker && npx vitest run png-asset-count.test.js -t "CACHE_VERSION"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx vitest run png-asset-count.test.js`
- **Per wave merge:** `cd custard-calendar/worker && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `worker/test/png-asset-count.test.js` -- covers PNGS-01 (file count) and PNGS-02 (cache version)
- [ ] heroConeSrc() alias resolution assertions (can be in same test file or separate)
- [ ] Framework install: None needed -- vitest already installed

## Sources

### Primary (HIGH confidence)
- Direct file reads of `scripts/generate-hero-cones.mjs`, `docs/cone-renderer.js`, `docs/sw.js`, `worker/src/flavor-colors.js`
- Node.js evaluation of FLAVOR_PROFILES (94 keys) and FLAVOR_ALIASES (37 keys)
- File system inspection: 40 existing PNGs in docs/assets/cones/, .gitignore exception on line 52
- Existing test files: `worker/test/palette-sync.test.js`, `worker/test/golden-baselines.test.js`, `worker/test/alias-validation.test.js`

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already installed and proven in previous phases
- Architecture: HIGH - existing code read directly, patterns verified by running Node
- Pitfalls: HIGH - based on direct codebase analysis, .gitignore verified, slug functions compared

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependency changes expected)
