# Phase 13: Rendering Quality Fixes - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix existing 40 profiled flavors to render correctly and consistently across all four sync files (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html) and both renderers (Worker server-side, frontend client-side). Covers color palette sync, integer PNG scaling, HD geometry sync, and higher DPI rasterization. No new profiles, no new colors, no new rendering tiers.

</domain>

<decisions>
## Implementation Decisions

### Starlark color policy
- Exact match: Tidbyt LED colors must match web colors exactly (all 4 sync files use identical hex values)
- Audit each drifted color: Claude compares both hex values against the real-world ingredient and picks the more accurate one; user reviews final unified palette
- flavor-audit.html is updated as part of this phase (it's the 4th sync file per RNDQ-03)

### PNG output dimensions
- 144px width, no downscale: Hero SVG at scale 4 = 144x168px, rasterize 1:1 (zero pixel artifacts)
- Set 300 DPI density in sharp for crisper SVG-to-PNG rasterization
- CSS handles display sizing (images are 144px native, CSS constrains to container)
- Remove sips fallback: sharp-only pipeline, fail fast if sharp not installed

### Color source of truth
- flavor-colors.js is the canonical source: all other files sync FROM it
- Manual sync in this phase + CI test enforcement in Phase 14
- Colors only (not profile definitions) -- RNDQ-03 scope is hex values
- cone-renderer.js FALLBACK constants are part of the sync (must match canonical)

### Fallback color strategy
- Full copy: FALLBACK objects in cone-renderer.js mirror the complete palette from flavor-colors.js
- CI sync test (Phase 14) should cover all 5 locations: flavor-colors.js canonical, cone-renderer.js fallbacks, culvers_fotd.star, flavor-audit.html
- Color map only: keyword fallback logic (getFlavorBaseColor if/else chain) is separate from the palette sync
- No service worker caching of flavor-colors API response -- full fallback copy is sufficient

### Claude's Discretion
- Which hex value wins for each drifted color (based on real-world ingredient accuracy)
- HD geometry fix approach in cone-renderer.js (adding the missing [3,14] taper row)
- Exact sharp configuration options beyond density and width

</decisions>

<specifics>
## Specific Ideas

- Known drifts to resolve: andes topping (#1FAE7A vs #00897B), caramel ribbon (#D38B2C vs #DAA520), plus any others found during audit
- HD scoop geometry: cone-renderer.js row 1 jumps from [4,13] to [2,15], missing the [3,14] taper step that flavor-colors.js has
- Current pipeline: 144px SVG -> 120px PNG with no DPI setting -> change to 144px 1:1 at 300 DPI

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/generate-hero-cones.mjs`: Hero PNG generation script -- needs scale/DPI/resize changes
- `worker/src/flavor-colors.js`: Canonical color palettes + FLAVOR_PROFILES + renderConeHeroSVG
- `docs/cone-renderer.js`: Client-side renderer with FALLBACK colors + renderMiniConeHDSVG
- `tidbyt/culvers_fotd.star`: Starlark renderer with its own color palettes
- `docs/flavor-audit.html`: Dev tool with color constants for visual comparison

### Established Patterns
- Pixel-art grid rendering: all cone renderers use [startCol, endCol] row arrays for geometry
- 4-tier rendering: Mini (9x11), HD (18x22), Hero (36x42), Premium (24x28)
- IIFE pattern: cone-renderer.js uses var declarations and global exports (no build step)
- Worker exports: flavor-colors.js uses ES module exports consumed by generate script

### Integration Points
- `generate-hero-cones.mjs` imports from `worker/src/flavor-colors.js` (renderConeHeroSVG, FLAVOR_PROFILES)
- `cone-renderer.js` fetches from `/api/v1/flavor-colors` at runtime (loadFlavorColors)
- `heroConeSrc()` in cone-renderer.js references `assets/cones/{slug}.png` paths
- Service worker caches cone PNGs (CACHE_VERSION bump needed in Phase 17 after regen)

</code_context>

<deferred>
## Deferred Ideas

- Service worker pre-caching of `/api/v1/flavor-colors` response -- full fallback copy sufficient for now
- Profile definition sync across files (base/ribbon/toppings/density) -- separate from color hex sync
- LED-specific color optimization for Tidbyt -- future phase if exact match proves problematic

</deferred>

---

*Phase: 13-rendering-quality-fixes*
*Context gathered: 2026-03-09*
