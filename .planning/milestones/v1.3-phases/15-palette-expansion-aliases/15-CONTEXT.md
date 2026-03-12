# Phase 15: Palette Expansion & Aliases - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add ~10 new base colors, ~10+ new topping colors, and ~20 alias mappings across sync files so Phase 16 can profile every flavor without hitting missing-color or duplicate-name failures. No new profiles, no rendering changes, no PNG generation.

</domain>

<decisions>
## Implementation Decisions

### Color hex selection
- Visual distinctness is the primary criterion: each new color must look clearly different from existing palette entries
- Topping colors are contrast-adjusted after initial selection (same Phase 14 approach: pick distinct color, then adjust for 3:1 compliance against paired bases)
- Ribbon colors added only if unprofiled flavor audit reveals need (existing 5 ribbons: caramel, peanut_butter, marshmallow, chocolate_syrup, fudge)
- Base colors named in roadmap: espresso, cherry, pumpkin, banana, coconut, root_beer, pistachio, orange, blue_moon, maple

### Alias identification
- Full catalog audit during planning: Claude scans all known flavor names from Worker data and identifies duplicate/variant names
- Alias criteria: same base ingredients = alias (different marketing names for same custard + mix-ins)
- FLAVOR_ALIASES dict in flavor-colors.js as new exported constant (lives next to FLAVOR_PROFILES)
- Canonical only: FLAVOR_ALIASES in flavor-colors.js and cone-renderer.js fallback; NOT synced to Starlark or flavor-audit.html (they don't do profile lookups)

### Alias behavior
- Silent resolution at runtime: getFlavorProfile() checks FLAVOR_ALIASES before keyword fallback
- Visible in flavor-audit.html: audit tool displays alias mappings so duplicates are inspectable
- Normalized matching: use existing normalizeFlavorKey() (lowercases, strips TM/R, normalizes quotes) before alias lookup
- CI test validates all alias targets: every alias must point to a real FLAVOR_PROFILES key (blocks merge if broken)
- Phase 16 workflow: new aliases ship in same commit as their canonical profile

### New topping scope
- Demand-driven: audit unprofiled flavors to identify needed topping colors (not speculative)
- No cap: add all toppings the audit reveals, even if more than ~10 estimate
- Distinct colors for visually different toppings (sprinkles != graham cracker != cookie crumbs)
- Contrast validation against paired bases only (not all bases), with exemptions for structural conflicts

### Claude's Discretion
- Exact hex values for all new colors (base, topping, ribbon if needed)
- Whether to present palette for user review before committing
- How to parse flavor catalog for alias audit
- Exact flavor-audit.html changes for alias visibility
- Test file organization for alias validation CI

</decisions>

<specifics>
## Specific Ideas

- Same contrast-adjustment approach as Phase 14: pick visually accurate color first, then darken/lighten to meet 3:1 against likely paired bases
- Phase 14 established 12 structural exemptions for unavoidable conflicts -- same exemption pattern applies to new colors
- Alias examples to look for: "Turtle" vs "Turtle Dove", "Crazy for Cookie Dough" vs "Cookie Dough Craze", seasonal variants with different names

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/src/flavor-colors.js`: Canonical source with BASE_COLORS (13), RIBBON_COLORS (5), TOPPING_COLORS (21), CONE_COLORS, FLAVOR_PROFILES (42)
- `docs/cone-renderer.js`: FALLBACK_ constants + normalizeFlavorKey() + getFlavorProfile()
- `worker/test/palette-sync.test.js`: CI sync test -- regex-parses all 4 files, compares hex values
- `worker/test/contrast-check.test.js`: WCAG 3:1 contrast validation with CONTRAST_EXEMPTIONS set
- `docs/flavor-audit.html`: Dev tool with embedded SEED_ color constants

### Established Patterns
- flavor-colors.js is canonical; all other files sync FROM it (Phase 13 decision)
- Palette sync test catches drift between any of 4+ sync file locations
- Contrast checker validates topping/base pairs used in FLAVOR_PROFILES
- UPDATE_GOLDENS=1 pattern for regenerating test baselines
- getFlavorProfile() lookup chain: exact match -> unicode normalization -> keyword fallback -> default vanilla

### Integration Points
- New colors must be added to all 4 sync files (flavor-colors.js, cone-renderer.js, culvers_fotd.star, flavor-audit.html)
- FLAVOR_ALIASES only needs flavor-colors.js (canonical) + cone-renderer.js (fallback)
- Alias resolution inserts into getFlavorProfile() between normalize step and keyword fallback
- Existing pixelmatch golden baselines unaffected (no profile changes, no rendering changes)

</code_context>

<deferred>
## Deferred Ideas

- FLAVOR_PROFILES sync across Starlark files (profile definitions, not just colors) -- separate scope
- LED-specific color optimization for Tidbyt -- future phase if exact match is problematic on hardware

</deferred>

---

*Phase: 15-palette-expansion-aliases*
*Context gathered: 2026-03-09*
