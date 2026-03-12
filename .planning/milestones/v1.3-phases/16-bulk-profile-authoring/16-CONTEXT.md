# Phase 16: Bulk Profile Authoring - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Create FLAVOR_PROFILES entries for every unprofiled flavor in the catalog (~107 estimate, profile whatever count actually exists). Each profile has base/ribbon/toppings/density fields. All profiles must pass the contrast checker and sync across all files. When complete, flavor-audit.html shows zero "unprofiled" or "keyword fallback" entries.

</domain>

<decisions>
## Implementation Decisions

### Profile accuracy methodology
- Use flavor name + description from Worker catalog (seed catalog in `worker/src/flavor-catalog.js` + KV-accumulated flavors via `/api/flavors/catalog`)
- Fetch Culver's website images for ALL flavors to reference actual custard colors for accurate profile creation
- For ambiguous flavors where description + image still unclear: make best guess and flag in a "needs review" list for user to check in flavor-audit.html

### Batching & commit strategy
- Group profiles by flavor family (chocolate-based, vanilla-based, fruit-based, etc.) -- natural groupings, easier to review similar profiles
- One PLAN.md per flavor family (e.g., 16-01-chocolate, 16-02-vanilla, 16-03-fruit)
- Each batch commit includes ALL sync file updates (flavor-colors.js canonical + cone-renderer.js FALLBACK + flavor-audit.html) -- CI stays green after every commit
- Each batch commit includes golden baseline generation (4 tiers per flavor) -- no deferred baseline pass

### Quality review process
- Spot-check each batch via flavor-audit.html rendered cone previews
- After each family batch is committed, user opens flavor-audit.html and reviews the rendered cones for the new flavors
- CI gates (contrast checker, palette sync, pixelmatch) catch mechanical errors automatically

### Alias discovery
- Discover and add new aliases alongside profiles during each batch -- Phase 15 established the FLAVOR_ALIASES pattern
- New aliases ship in the same commit as their canonical profile (Phase 15 convention)

### Contrast compliance
- Adjust topping color first (darken/lighten for 3:1 compliance) before adding structural exemptions -- same Phase 15 approach
- Only add exemptions for truly unavoidable conflicts (e.g., white marshmallow on vanilla base)

### Flavor count
- Profile whatever count exists in the catalog, not a fixed 107 target
- Success criterion is zero unprofiled flavors in flavor-audit.html, regardless of total count

### Claude's Discretion
- Exact flavor family groupings and batch boundaries
- Which base/ribbon/toppings/density values to assign per flavor (guided by descriptions + images)
- How to parse and fetch Culver's flavor page images during execution
- Density assignment logic (pure/standard/double/explosion/overload based on mix-in complexity)
- Golden baseline generation approach per batch
- Whether new colors are needed (unlikely given Phase 15 expanded to 22 bases, 5 ribbons, 41 toppings)

</decisions>

<specifics>
## Specific Ideas

- Flavor descriptions live in Worker seed catalog (`worker/src/flavor-catalog.js`) and KV accumulation -- NOT Python cache
- Culver's website flavor pages are the image reference source for color accuracy
- Phase 15 added 20 aliases; expect some new aliases to emerge when profiling variants of the same custard
- Existing keyword fallback chain (getFlavorProfile) handles some flavors generically -- profiles replace these with specific entries
- flavor-audit.html already renders cones and flags "no profile" / "keyword fallback" status -- use it as the review tool

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/flavor-colors.js`: Canonical FLAVOR_PROFILES (39 entries), BASE_COLORS (22), RIBBON_COLORS (5), TOPPING_COLORS (41), FLAVOR_ALIASES (20 mappings)
- `worker/src/flavor-catalog.js`: Seed catalog with 39 hand-written descriptions + KV accumulation via `accumulateFlavors()`
- `/api/flavors/catalog` endpoint: Returns full catalog `{title, description}` for all known flavors
- `docs/flavor-audit.html`: Dev tool that renders cones and flags unprofiled/keyword-fallback flavors -- primary review tool
- `docs/cone-renderer.js`: FALLBACK_ constants + getFlavorProfile() lookup chain + normalizeFlavorKey()
- `worker/test/contrast-check.test.js`: WCAG 3:1 contrast validation with CONTRAST_EXEMPTIONS set
- `worker/test/palette-sync.test.js`: CI sync test across 4+ files

### Established Patterns
- flavor-colors.js is canonical; all other files sync FROM it (Phase 13)
- Contrast-adjust approach: pick accurate color, darken/lighten for 3:1 (Phase 15)
- UPDATE_GOLDENS=1 pattern for pixelmatch baseline regeneration (Phase 14)
- Zero-tolerance pixelmatch threshold -- deterministic seeded PRNG (Phase 14)
- FLAVOR_ALIASES resolution: normalizeFlavorKey() -> alias lookup -> keyword fallback (Phase 15)
- Profile structure: `{ base, ribbon, toppings: [], density }` with optional `l2_toppings` for complex layouts

### Integration Points
- New profiles added to `FLAVOR_PROFILES` in flavor-colors.js (canonical)
- FALLBACK_FLAVOR_PROFILES in cone-renderer.js must be updated in same commit
- flavor-audit.html embedded SEED_ data must include new profiles
- New golden baselines stored in test fixtures directory (4 tiers per flavor)
- New aliases (if any) added to FLAVOR_ALIASES in flavor-colors.js + cone-renderer.js

</code_context>

<deferred>
## Deferred Ideas

- FLAVOR_PROFILES sync to Starlark files (profile definitions, not colors) -- separate scope from color sync
- LED-specific color optimization for Tidbyt -- future phase if exact match is problematic on hardware
- Premium tier production adoption -- UX decision deferred

</deferred>

---

*Phase: 16-bulk-profile-authoring*
*Context gathered: 2026-03-10*
