# Phase 16: Bulk Profile Authoring - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add FLAVOR_PROFILES entries for all ~107 unprofiled flavors so every flavor in the catalog renders with a proper cone instead of keyword fallback or default vanilla. Covers profile authoring, new aliases for variant names, and new ribbon colors if needed. No new rendering tiers, no rendering engine changes, no PNG generation (Phase 17).

</domain>

<decisions>
## Implementation Decisions

### Profile accuracy approach
- Primary source: internal flavor description database (flavor-catalog.js SEED_CATALOG + KV accumulated catalog)
- Secondary source: Culver's website FOTD images for ambiguous cases
- Flag flavors with missing/unclear descriptions for user review rather than guessing
- Standard slot-based rendering for all new profiles (no l2_toppings custom placement)
- Trust the existing rendering engine -- pick right colors in right slots, let density handle the rest

### Density assignment
- Claude decides density per flavor based on description DB and visual judgment
- Pure density reserved for truly plain flavors only (no visible toppings at all)
- Even if toppings are mixed in (invisible in real custard), render them visually for variety
- User reviews: all non-standard density profiles + ~10% random sample of standard profiles

### Batching and review process
- Thematic batches grouped by flavor family (chocolate variants, fruit flavors, caramel-based, etc.)
- ~5-8 batches of 12-20 flavors each
- Review method: open flavor-audit.html after each batch commit, visually scan new cones
- Contrast checker failures flagged for user decision (not auto-adjusted) -- user picks between adjust color, swap topping, or add exemption

### Success criteria
- Zero unprofiled flavors in SEED_CATALOG
- Zero unprofiled flavors in a snapshot of current live catalog (D1 accumulated flavors)
- Both seed + accumulated flavors covered in this phase

### Missing color handling
- Base colors: approximate with nearest existing color from 24-color palette (Phase 15 designed to cover all needs)
- Topping colors: approximate with nearest existing from 43-color palette
- Ribbon colors: add new ribbon colors if no existing ribbon fits -- do NOT approximate ribbons with poor matches
- New ribbons synced to all 4 files (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html)
- New ribbons validated for 3:1 contrast ratio against paired bases (same as toppings)

### Alias handling
- New aliases ship in same commit as their canonical profile (Phase 15 convention)
- Claude identifies variant/duplicate names during profiling from flavor description DB

### Claude's Discretion
- Exact base/ribbon/topping assignment per flavor (within accuracy approach above)
- Density choice per flavor (within guidelines above)
- Thematic batch groupings and ordering
- Which flavors to include in ~10% review sample
- How to query live catalog for accumulated flavor snapshot

</decisions>

<specifics>
## Specific Ideas

- Same contrast-adjustment approach as Phase 14/15 when ribbon contrast fails: pick visually accurate color first, then adjust for 3:1 compliance
- Phase 14 established 12 structural exemptions -- same exemption pattern applies if new topping/base pairs have unavoidable conflicts
- flavor-audit.html "s-warn" (no profile) status is the primary tracking mechanism for progress
- getFlavorProfile() lookup chain (exact -> unicode normalize -> alias -> keyword fallback -> default) means all new profiles are found via exact match, eliminating fallback usage

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/flavor-colors.js`: FLAVOR_PROFILES (39 current), FLAVOR_ALIASES (14 current), BASE_COLORS (24), RIBBON_COLORS (5), TOPPING_COLORS (43)
- `worker/src/flavor-catalog.js`: SEED_CATALOG (38 flavors) + KV accumulation at `meta:flavor-catalog`
- `worker/test/contrast-check.test.js`: Automated contrast validation with 12 exemptions -- dynamically tests all topping/base pairs
- `docs/flavor-audit.html`: Audit page with "s-warn" status for unprofiled flavors, visual cone rendering
- `worker/src/flavor-matcher.js`: SIMILARITY_GROUPS, FLAVOR_FAMILIES for identifying related flavors

### Established Patterns
- flavor-colors.js is canonical; all other files sync FROM it (Phase 13)
- Palette sync test catches drift between 4+ sync file locations
- Contrast checker validates topping/base pairs used in FLAVOR_PROFILES
- getFlavorProfile() lookup chain: exact match -> unicode normalize -> FLAVOR_ALIASES -> keyword fallback -> default vanilla
- Profile structure: { base, ribbon, toppings: [], density } -- all fields required for new profiles

### Integration Points
- New profiles added to FLAVOR_PROFILES in flavor-colors.js (canonical)
- cone-renderer.js FALLBACK_FLAVOR_PROFILES must be updated to match
- New aliases added to FLAVOR_ALIASES in both flavor-colors.js and cone-renderer.js
- New ribbon colors (if any) synced to all 4 files
- contrast-check.test.js auto-discovers new profiles -- no test changes needed unless new exemptions required
- flavor-audit.html SEED_PROFILES snapshot may need refresh for accurate offline audit

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 16-bulk-profile-authoring*
*Context gathered: 2026-03-10*
