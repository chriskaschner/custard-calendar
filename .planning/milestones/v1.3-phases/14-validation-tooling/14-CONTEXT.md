# Phase 14: Validation Tooling - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated guards that prevent quality regressions before bulk profile authoring begins. Three tools: CI palette sync test, contrast checker, and pixelmatch golden baselines. No new colors, no profile changes, no rendering changes -- tooling only.

</domain>

<decisions>
## Implementation Decisions

### Golden baseline scope
- All 40 currently profiled flavors get pixelmatch baselines across all 4 rendering tiers (Mini/HD/Hero/Premium) -- ~160 baseline images
- Zero tolerance diff threshold -- rendering is deterministic (seeded PRNG), any pixel difference is a real change
- Baseline PNG files stored in repo (test fixtures directory) -- reviewable in PRs, visually inspectable
- New profiles (Phase 16) must auto-generate golden baselines as part of the same commit -- no unprofiled gaps
- Intentional changes use UPDATE_GOLDENS=1 to regenerate baselines and commit new PNGs

### Failure strictness
- All 3 tools are hard CI gates that block merges:
  - VALD-01 (palette sync): color drift between any sync file blocks merge
  - VALD-02 (contrast checker): topping/base combo below 3:1 blocks merge
  - VALD-03 (pixelmatch): any unintended visual change blocks merge
- Existing 40 profiles checked immediately against contrast requirement -- fix any failures in this phase before the gate goes live (clean slate for Phase 16)

### Starlark sync enforcement
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

</decisions>

<specifics>
## Specific Ideas

- Extend existing UPDATE_GOLDENS=1 pattern from Phase 13 golden hash tests for the new pixelmatch baselines
- CI already has 3 jobs (worker-tests, repo-structure, python-tests) -- validation tests should fit into existing worker-tests job
- flavor-colors.js is canonical source (Phase 13 decision) -- sync test compares all other files AGAINST it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/test/flavor-colors.test.js`: 574 existing tests with golden hash infrastructure -- extend for pixelmatch and sync tests
- `worker/vitest.config.js`: Vitest 3.x config with coverage thresholds (70% lines, 60% branches)
- `worker/src/flavor-colors.js`: Canonical color palettes (BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS) + FLAVOR_PROFILES + 4 render functions
- `docs/cone-renderer.js`: FALLBACK_BASE_COLORS, FALLBACK_RIBBON_COLORS, etc. -- var declarations, no build step
- `tidbyt/culvers_fotd.star`: Starlark color dicts (Python-like syntax)
- `docs/flavor-audit.html`: Embedded seed data with color constants in script tag

### Established Patterns
- Golden hash tests: 20 Tier-1 flavors already have golden pixel hashes -- UPDATE_GOLDENS=1 to regenerate
- `npm run bless:cones` prints golden updates
- Deterministic rendering: seeded PRNG for Premium tier scatter placement ensures reproducible output
- 4-tier rendering: Mini (9x11), HD (18x21), Hero (36x42), Premium (24x28)

### Integration Points
- `.github/workflows/ci.yml`: 3-job CI pipeline -- worker-tests runs `npm test` in worker/
- All 5 sync file locations for palette comparison:
  1. worker/src/flavor-colors.js (canonical)
  2. docs/cone-renderer.js (FALLBACK_ constants)
  3. tidbyt/culvers_fotd.star
  4. custard-tidbyt/apps/culversfotd/culvers_fotd.star
  5. docs/flavor-audit.html (embedded script)

</code_context>

<deferred>
## Deferred Ideas

- FLAVOR_PROFILES sync across Starlark files -- separate from color hex sync, deferred per Phase 13
- LED-specific color optimization for Tidbyt -- future phase if exact match proves problematic on hardware

</deferred>

---

*Phase: 14-validation-tooling*
*Context gathered: 2026-03-09*
