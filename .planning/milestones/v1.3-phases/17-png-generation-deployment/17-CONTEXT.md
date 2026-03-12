# Phase 17: PNG Generation & Deployment - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate Hero cone PNGs for all 94 profiled flavors and bump the service worker cache version so users see consistent Hero-tier rendering across the site. No new profiles, no new colors, no new rendering tiers.

</domain>

<decisions>
## Implementation Decisions

### Alias PNG strategy
- Resolve aliases at lookup time, not at generation time -- 94 PNG files total (one per FLAVOR_PROFILES key)
- heroConeSrc() checks FALLBACK_FLAVOR_ALIASES before slugifying the flavor name to build the PNG path
- Unknown flavors (no profile, no alias) return null from heroConeSrc() so callers fall back to HD SVG rendering
- Generate script iterates FLAVOR_PROFILES keys only, does not iterate FLAVOR_ALIASES

### Generation validation
- Visual review via flavor-audit.html after generation -- same proven workflow from Phases 15-16
- Generate script prints a summary report: total generated, skipped, failed
- CI test verifies PNG count in docs/assets/cones/ matches FLAVOR_PROFILES key count (catches future drift)
- Verify Today page shows consistent Hero PNG rendering for all profiled flavors (no PNG/SVG mixing for profiled flavors)

### Git strategy for binary assets
- Regenerate all 94 PNGs from scratch (clean slate reflecting all Phase 13-16 color/contrast improvements)
- Single commit for all PNGs -- total ~80KB, small enough for one atomic commit
- Verify .gitignore rules don't block committing docs/assets/cones/*.png (Phase 14 exception was for test fixtures)

### Cache transition
- Bump CACHE_VERSION from custard-v18 to custard-v19 in docs/sw.js
- Cache version bump in a separate final commit after PNG generation and verification
- No pre-caching of PNGs in service worker install phase -- stale-while-revalidate at runtime is sufficient
- HD SVG fallback during cache transition period is acceptable (same as current experience)

### Claude's Discretion
- Exact generate script modifications (if any needed beyond running it)
- CI test implementation details (which test file, assertion style)
- Whether to update flavor-audit.html to show PNG vs SVG status per flavor
- Error handling in heroConeSrc() alias resolution

</decisions>

<specifics>
## Specific Ideas

- generate-hero-cones.mjs already exists and uses renderConeHeroSVG + sharp at 300 DPI -- likely just needs to be run
- heroConeSrc() is in docs/cone-renderer.js (lines 424-431) -- needs alias resolution via FALLBACK_FLAVOR_ALIASES
- CACHE_VERSION lives in docs/sw.js -- currently 'custard-v18'
- Phase 16 final totals: 94 FLAVOR_PROFILES + 37 FLAVOR_ALIASES = zero unprofiled flavors
- Existing 40 PNGs were generated before Phase 13-16 improvements (stale colors/profiles)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/generate-hero-cones.mjs`: Hero PNG generation script (sharp, 300 DPI, nearest-neighbor resize to 144x168)
- `worker/src/flavor-colors.js`: Canonical FLAVOR_PROFILES (94 entries), FLAVOR_ALIASES (37 mappings), renderConeHeroSVG()
- `docs/cone-renderer.js`: heroConeSrc() (line 424), renderHeroCone() with HD SVG fallback, FALLBACK_FLAVOR_ALIASES
- `docs/sw.js`: CACHE_VERSION = 'custard-v18', stale-while-revalidate strategy for cone PNGs
- `docs/flavor-audit.html`: Visual review tool for cone rendering quality

### Established Patterns
- flavor-colors.js is canonical source; all other files sync FROM it (Phase 13)
- 300 DPI + nearest-neighbor rasterization at 144x168px native (Phase 13)
- Zero-tolerance pixelmatch baselines for deterministic rendering (Phase 14)
- Visual spot-check via flavor-audit.html after each batch (Phases 15-16)
- FLAVOR_ALIASES resolution chain: normalizeFlavorKey() -> alias lookup -> keyword fallback (Phase 15)

### Integration Points
- generate-hero-cones.mjs imports from worker/src/flavor-colors.js (renderConeHeroSVG, FLAVOR_PROFILES)
- heroConeSrc() in cone-renderer.js references assets/cones/{slug}.png paths
- Service worker caches cone PNGs via stale-while-revalidate at runtime
- CI tests in worker/test/ (palette-sync, contrast-check, pixelmatch) validate rendering pipeline

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 17-png-generation-deployment*
*Context gathered: 2026-03-10*
