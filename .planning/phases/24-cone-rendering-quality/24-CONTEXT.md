# Phase 24: Cone Rendering Quality - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade hero cone PNG toppings with higher density filling empty center columns, per-type shapes instead of uniform 2x2 blocks, and consistent distribution across all 94 flavors. Regenerate all hero PNGs and refresh golden baselines. Also upgrade the HD tier (18x21) with the same scatter + shape improvements. Requirements: CONE-01, CONE-02, CONE-03, CONE-04.

</domain>

<decisions>
## Implementation Decisions

### Topping richness
- Standard density: ~16 pieces scattered across full scoop area
- Double density: ~20 pieces with primary topping repeated
- Explosion density: ~24 pieces cycling all toppings
- Overload density: ~16 pieces, same count as standard but monochrome (single topping color everywhere) -- visual distinction is uniformity, not extra coverage
- Pure density: stays completely clean -- no toppings, no texture dots. Base color + ribbon + highlight/shadow only
- Seeded Mulberry32 PRNG scatter placement (ported from premium tier) replaces fixed slots for hero and HD tiers

### Shape variety
- 5 distinct topping shapes at hero scale:
  - Dot (2x2) -- sprinkles, m&ms, salt, small bits
  - Chunk (3x2) -- pecans, pretzels, brownie, cookie dough
  - Sliver (1x3) -- chocolate chips, heath, andes
  - Flake (3x1) -- coconut flakes, graham cracker, pie crust
  - Scatter (1x1 + 1x1) -- two separate single pixels placed near each other for marshmallow bits, cheesecake bits, crumbs
- Every one of the 36 TOPPING_COLORS keys gets an explicit shape assignment in a shared canonical shape map
- Shape map shared across all tiers -- each tier renders what its pixel budget allows (mini stays single-pixel, HD gets dots/chunks, hero gets all 5)

### Center fill and collision
- Toppings scatter across the entire scoop area including center columns (cols 11-13 and 19-21 that were previously empty)
- Ribbon renders after toppings (existing order preserved) -- ribbon wins at overlap positions, creating natural "swirl on top" look
- Collision detection prevents toppings from overlapping each other (matching premium tier behavior)
- Toppings can land on highlight and shadow zones -- shading renders first, toppings paint over it

### Density consistency
- Distinct visual tiers: standard/double/explosion/overload should produce visibly different topping counts and patterns
- Density scale: pure (0) < standard (~16) < overload (~16 monochrome) < double (~20) < explosion (~24)

### Tier scope
- Hero tier (36x42): full scatter + 5 shapes upgrade
- HD tier (18x21): scatter + shapes upgrade (second most visible tier -- radar cards at 5x, hero section at 8x)
- Mini tier (9x11): Claude's discretion -- likely keep as-is given 4-slot pixel budget
- Premium tier (24x28): already has scatter + shapes, only needs shared shape map integration

### Claude's Discretion
- Identity vs uniformity balance across the 94-cone set (lean toward each flavor being identifiable)
- Mini tier upgrade decision (likely keep current fixed 4-slot approach)
- Exact piece counts per density tier (targets above are guidelines, not hard constraints)
- Collision detection attempt budget (premium uses 30 attempts -- may need tuning for hero scale)
- Whether to update premium tier's shape map to use the new shared canonical map or leave it independent

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Rendering pipeline
- `worker/src/flavor-colors.js` -- Canonical renderer: all 4 tiers, FLAVOR_PROFILES, TOPPING_COLORS, shape maps, scatter logic, density resolution
- `docs/cone-renderer.js` -- Client-side fallback renderer (must be kept in sync with flavor-colors.js)

### PNG generation
- `scripts/generate-hero-cones.mjs` -- Hero PNG pipeline: renderConeHeroSVG -> sharp 300 DPI -> nearest-neighbor resize -> docs/assets/cones/

### Golden baselines
- `worker/test/golden-baselines.test.js` -- Pixelmatch zero-tolerance test (376 baselines across 4 tiers)
- `worker/test/fixtures/goldens/{mini,hd,premium,hero}/` -- Baseline PNG directories
- `worker/test/helpers/render-to-pixels.js` -- SVG-to-RGBA buffer conversion for testing

### Requirements
- `.planning/REQUIREMENTS.md` -- CONE-01 through CONE-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_mulberry32(seed)` PRNG function (flavor-colors.js:654) -- deterministic scatter, already proven in premium
- `resolvePremiumToppingList(profile)` (flavor-colors.js:677) -- density-to-topping-list resolution, model for hero equivalent
- `_PREM_TOPPING_SHAPES` object (flavor-colors.js:639) -- shape template format (array of [col,row] offsets)
- `_PREM_SHAPE_MAP` object (flavor-colors.js:646) -- per-topping shape assignment, will be expanded to canonical shared map
- `lightenHex()` / `darkenHex()` (flavor-colors.js:447/461) -- highlight/shadow color derivation
- `resolveHDToppingSlots(profile)` (flavor-colors.js:475) -- existing HD density resolution, will need scatter replacement

### Established Patterns
- Render order: base fill -> highlight -> shadow -> toppings -> ribbon -> cone -> tip
- Each tier has own `_TIER_SCOOP_ROWS` array defining scoop geometry bounds
- Golden baselines regenerated via `UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js`
- Hero PNGs regenerated via `node scripts/generate-hero-cones.mjs`
- SVG output with `shape-rendering="crispEdges"` for pixel-perfect rendering
- Seed derived from flavor name hash for deterministic per-flavor placement

### Integration Points
- `renderConeHeroSVG()` (flavor-colors.js:939) -- main hero render function, needs scatter + shape upgrade
- `renderConeHDSVG()` -- HD render function, needs same upgrade
- `_HERO_TOPPING_SLOTS` (flavor-colors.js:909) -- fixed slots to be replaced by scatter
- `docs/cone-renderer.js` -- client-side copy must be updated to match
- Service worker cache version -- must be bumped after PNG regeneration
- `docs/assets/cones/` -- 94 PNG files to regenerate

</code_context>

<specifics>
## Specific Ideas

- Previous cone versions were "barely ok" -- this is a meaningful quality upgrade, not incremental polish
- User wants to "rethink and improve" rather than just port existing patterns
- The 5-shape vocabulary (dot/chunk/sliver/flake/scatter) was designed specifically for this phase to be a real upgrade over premium's 3 shapes

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 24-cone-rendering-quality*
*Context gathered: 2026-03-16*
