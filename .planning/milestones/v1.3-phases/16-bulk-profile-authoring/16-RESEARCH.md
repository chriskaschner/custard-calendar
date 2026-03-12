# Phase 16: Bulk Profile Authoring - Research

**Researched:** 2026-03-10
**Domain:** Flavor profile data authoring, multi-file sync, WCAG contrast compliance, visual regression testing
**Confidence:** HIGH

## Summary

Phase 16 is a data-authoring phase, not a code-architecture phase. The implementation patterns, sync mechanisms, and CI gates are all established from Phases 13-15. The work is: author ~N FLAVOR_PROFILES entries (where N is the count of unprofiled flavors in the live catalog), keep 3-4 sync files updated per commit, pass contrast checker and palette-sync CI, and regenerate golden baselines for each new profile.

The codebase currently has **40 FLAVOR_PROFILES entries** and **20 FLAVOR_ALIASES**. The static SEED_CATALOG has 31 entries (all profiled). The live catalog (KV-accumulated) likely has 100-150+ flavors including seasonal, historical, and brand variants from 6 upstream fetchers (Culver's, Kopp's, Gille's, Hefner's, Kraverz, Oscar's). The exact count of unprofiled flavors can only be determined at execution time by querying the live API or parsing the KV accumulation.

**Primary recommendation:** Batch profiles by flavor family (chocolate, vanilla, fruit, etc.), use Culver's website images for color accuracy, commit each batch with all sync files + golden baselines updated, and verify each batch with flavor-audit.html.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use flavor name + description from Worker catalog (seed catalog in `worker/src/flavor-catalog.js` + KV-accumulated flavors via `/api/flavors/catalog`)
- Fetch Culver's website images for ALL flavors to reference actual custard colors for accurate profile creation
- For ambiguous flavors where description + image still unclear: make best guess and flag in a "needs review" list for user to check in flavor-audit.html
- Group profiles by flavor family (chocolate-based, vanilla-based, fruit-based, etc.)
- One PLAN.md per flavor family (e.g., 16-01-chocolate, 16-02-vanilla, 16-03-fruit)
- Each batch commit includes ALL sync file updates (flavor-colors.js canonical + cone-renderer.js FALLBACK + flavor-audit.html)
- Each batch commit includes golden baseline generation (4 tiers per flavor)
- Spot-check each batch via flavor-audit.html rendered cone previews
- Discover and add new aliases alongside profiles during each batch
- Adjust topping color first (darken/lighten for 3:1 compliance) before adding structural exemptions
- Profile whatever count exists in the catalog, not a fixed 107 target
- Success criterion is zero unprofiled flavors in flavor-audit.html, regardless of total count

### Claude's Discretion
- Exact flavor family groupings and batch boundaries
- Which base/ribbon/toppings/density values to assign per flavor (guided by descriptions + images)
- How to parse and fetch Culver's flavor page images during execution
- Density assignment logic (pure/standard/double/explosion/overload based on mix-in complexity)
- Golden baseline generation approach per batch
- Whether new colors are needed (unlikely given Phase 15 expanded to 22 bases, 5 ribbons, 41 toppings)

### Deferred Ideas (OUT OF SCOPE)
- FLAVOR_PROFILES sync to Starlark files (profile definitions, not colors)
- LED-specific color optimization for Tidbyt
- Premium tier production adoption
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-03 | All ~107 unprofiled flavors have FLAVOR_PROFILES entries with base/ribbon/toppings/density | Documented all 4 sync files that need updating, the profile structure format, existing color palettes (22 bases, 5 ribbons, 41 toppings), CI gates (contrast + palette-sync + pixelmatch), and the batch workflow |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| flavor-colors.js | N/A (project file) | Canonical FLAVOR_PROFILES, color palettes, aliases | Single source of truth established Phase 13 |
| cone-renderer.js | N/A (project file) | FALLBACK constants, client-side rendering | Sync target -- must mirror canonical |
| flavor-audit.html | N/A (project file) | SEED_PROFILES, SEED_ALIASES, SEED_CATALOG | Sync target + primary review tool |
| vitest | (project dep) | Test runner for contrast, palette-sync, golden baselines | Established CI gate |
| pixelmatch | (project dep) | Zero-tolerance visual regression | Golden baseline generation |
| pngjs | (project dep) | PNG encode/decode for golden baselines | Used by golden-baselines.test.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Culver's website | N/A | Flavor images for color reference | During profile authoring for accuracy |
| flavor-catalog.js | N/A (project file) | SEED_CATALOG with 31 hand-written descriptions | Reference for flavor descriptions |

## Architecture Patterns

### Existing File Sync Architecture (DO NOT CHANGE)
```
worker/src/flavor-colors.js          <-- CANONICAL (edit here first)
  |
  +-- docs/cone-renderer.js          <-- FALLBACK_* constants (mirror)
  +-- docs/flavor-audit.html         <-- SEED_* dicts + SEED_PROFILES + SEED_ALIASES (mirror)
  +-- tidbyt/culvers_fotd.star       <-- Starlark dicts (colors only, NOT profiles -- deferred)
  +-- custard-tidbyt/.../culvers_fotd.star  <-- Starlark dicts (colors only, optional)
```

### Profile Entry Structure
```javascript
// In FLAVOR_PROFILES (flavor-colors.js)
'flavor name lowercase': {
  base: 'base_color_key',        // Must exist in BASE_COLORS (22 options)
  ribbon: 'ribbon_color_key',    // Must exist in RIBBON_COLORS (5 options) or null
  toppings: ['topping_key1'],    // Each must exist in TOPPING_COLORS (41 options)
  density: 'standard',           // One of: pure|standard|double|explosion|overload
  // Optional: l2_toppings for custom pixel-level layouts (rare)
}
```

### Density Assignment Guide
| Density | When to Use | Topping Effect |
|---------|-------------|---------------|
| `pure` | No mix-ins at all (e.g., Vanilla, Dark Chocolate Decadence) | Zero toppings rendered |
| `standard` | Normal 1-3 mix-in types | Toppings fill standard slots |
| `double` | "Double" in name, or heavy single-ingredient focus | Primary topping doubled |
| `explosion` | 3+ distinct mix-in types, very loaded | All toppings cycled across all slots |
| `overload` | "Overload" in name, massive single-topping coverage | Single topping fills 6 slots |

### Alias Entry Structure
```javascript
// In FLAVOR_ALIASES (flavor-colors.js)
'normalized variant name': 'canonical profile key',
// Only for names that do NOT already have a FLAVOR_PROFILES entry
// All keys are normalizeFlavorKey() output (lowercase, no TM/R, curly quotes normalized)
```

### Commit Pattern (per batch)
Each batch commit must update ALL of these atomically:
1. `worker/src/flavor-colors.js` -- add FLAVOR_PROFILES entries + optional FLAVOR_ALIASES
2. `docs/cone-renderer.js` -- update FALLBACK_FLAVOR_ALIASES (if new aliases added; no FALLBACK_FLAVOR_PROFILES exists)
3. `docs/flavor-audit.html` -- update SEED_PROFILES + SEED_ALIASES + SEED_CATALOG entries
4. `worker/test/fixtures/goldens/**/*.png` -- regenerate with `UPDATE_GOLDENS=1 npx vitest run golden-baselines`

### Key Discovery: cone-renderer.js Has No FALLBACK_FLAVOR_PROFILES

The cone-renderer.js file does NOT contain a `FALLBACK_FLAVOR_PROFILES` dict. It has:
- `FALLBACK_BASE_COLORS` -- synced with BASE_COLORS
- `FALLBACK_RIBBON_COLORS` -- synced with RIBBON_COLORS
- `FALLBACK_TOPPING_COLORS` -- synced with TOPPING_COLORS
- `FALLBACK_CONE_COLORS` -- synced with CONE_COLORS
- `FALLBACK_FLAVOR_ALIASES` -- synced with FLAVOR_ALIASES

Profile lookup in cone-renderer.js uses `getFlavorProfileLocal()` which reads from the API response (`flavorColorData.profiles`), not from a hardcoded fallback. This means **new profiles do NOT need to be added to cone-renderer.js** -- only new aliases do.

### Key Discovery: flavor-audit.html Has SEED_PROFILES

Unlike cone-renderer.js, flavor-audit.html has a `SEED_PROFILES` dict that IS a copy of FLAVOR_PROFILES. This MUST be updated with every new profile. It also has `SEED_ALIASES` and `SEED_CATALOG`.

### Files to Update Per Batch (Corrected from CONTEXT.md)
| File | What to Update | CI Validates? |
|------|---------------|---------------|
| `worker/src/flavor-colors.js` | FLAVOR_PROFILES + FLAVOR_ALIASES | contrast-check.test.js, golden-baselines.test.js |
| `docs/cone-renderer.js` | FALLBACK_FLAVOR_ALIASES (only if new aliases) | palette-sync.test.js (colors only, not aliases) |
| `docs/flavor-audit.html` | SEED_PROFILES + SEED_ALIASES + SEED_CATALOG | palette-sync.test.js (colors only) |
| `worker/test/fixtures/goldens/**/*.png` | 4 PNGs per new flavor | golden-baselines.test.js |

### Palette-Sync Test Scope (Important Nuance)

The `palette-sync.test.js` CI gate validates **color dicts only** (BASE_COLORS, RIBBON_COLORS, TOPPING_COLORS, CONE_COLORS). It does NOT validate profile sync or alias sync across files. Profile/alias sync to flavor-audit.html and cone-renderer.js is manual but must be maintained.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrast checking | Custom ratio calculator | Existing `contrast-check.test.js` with WCAG 2.0 formulas | Already validated, exemption mechanism exists |
| Golden baseline generation | Manual PNG creation | `UPDATE_GOLDENS=1 npx vitest run golden-baselines` | Automated, deterministic, 4 tiers |
| Flavor key normalization | Custom string processing | `normalizeFlavorKey()` in flavor-colors.js | Handles unicode, TM, curly quotes |
| New base/ribbon/topping colors | Guessing hex values | Reference Culver's images + existing 22+5+41 palette | Phase 15 already expanded; most flavors covered |
| Profile sync validation | Custom diff tool | `flavor-audit.html` visual review | Shows all profiles, flags unprofiled, renders cones |

**Key insight:** The color palette from Phase 15 (22 bases, 5 ribbons, 41 toppings) was specifically expanded based on an unprofiled flavor audit. Most new profiles should use existing colors without needing new additions.

## Common Pitfalls

### Pitfall 1: Forgetting to Update flavor-audit.html SEED_PROFILES
**What goes wrong:** Profiles exist in canonical flavor-colors.js but flavor-audit.html SEED_PROFILES is stale. When reviewing offline (no API), the audit page shows wrong/missing profiles.
**Why it happens:** There is NO CI test that validates SEED_PROFILES sync. Only color dicts are validated by palette-sync.test.js.
**How to avoid:** Always update SEED_PROFILES in the same commit as FLAVOR_PROFILES.
**Warning signs:** flavor-audit.html shows different profile data than expected when loaded without API.

### Pitfall 2: Forgetting SEED_CATALOG in flavor-audit.html
**What goes wrong:** New profiles render correctly but flavor-audit.html doesn't list the flavor in its catalog view.
**Why it happens:** SEED_CATALOG is a separate array from SEED_PROFILES. Adding a profile without a catalog entry means the flavor only appears if matched from the profile-only section.
**How to avoid:** Add `{ title: 'Flavor Name', description: '...' }` to SEED_CATALOG alongside SEED_PROFILES.
**Warning signs:** Flavor appears in "profile-only" badge instead of "profile + catalog" badge.

### Pitfall 3: Contrast Check Failures on New Profiles
**What goes wrong:** `contrast-check.test.js` fails because a new topping/base pair is below 3:1.
**Why it happens:** Many topping colors were contrast-adjusted for specific base colors. Using the same topping on a different base may fail.
**How to avoid:** Check contrast ratio mentally before assigning: light toppings on dark bases pass easily, dark toppings on light bases pass easily. Same-range pairs fail.
**Warning signs:** CI fails immediately after adding profiles.
**Resolution approach:** 1) Try a different existing topping color, 2) Darken/lighten the topping first, 3) Only as last resort add a structural exemption to CONTRAST_EXEMPTIONS.

### Pitfall 4: Golden Baseline Count Explosion
**What goes wrong:** Adding 100+ profiles means 400+ new golden baseline PNGs (4 tiers each). Commits become very large.
**Why it happens:** Every FLAVOR_PROFILES entry gets a golden baseline for all 4 tiers (mini 9x11, HD 18x21, premium 24x28, hero 36x42).
**How to avoid:** Batch commits by flavor family. Each batch adds 10-20 profiles = 40-80 PNGs. This keeps commits reviewable.
**Warning signs:** Git operations slow down, PR diffs are unwieldy.

### Pitfall 5: Alias Pointing to Non-Existent Profile
**What goes wrong:** FLAVOR_ALIASES entry references a canonical key that doesn't exist in FLAVOR_PROFILES.
**Why it happens:** Typo in canonical key, or profile was renamed but alias wasn't updated.
**How to avoid:** After adding aliases, verify: `FLAVOR_PROFILES[aliasValue]` exists for every alias.
**Warning signs:** Alias resolution falls through to keyword fallback.

### Pitfall 6: Multi-Brand Flavor Name Variants
**What goes wrong:** Kopp's, Gille's, Hefner's, Kraverz, and Oscar's may use different names for similar custard flavors. These show up in the accumulated catalog as distinct entries.
**Why it happens:** The 6-brand fetcher accumulates flavors from all brands into one catalog.
**How to avoid:** Non-Culver's flavors should still get profiles (same base/ribbon/topping system works). Create aliases for obvious duplicates across brands.
**Warning signs:** flavor-audit.html shows "unprofiled" entries for non-Culver's brand flavors.

## Code Examples

### Adding a New Profile (flavor-colors.js)
```javascript
// In FLAVOR_PROFILES object:
'cappuccino cookie crumble': {
  base: 'espresso',
  ribbon: null,
  toppings: ['cookie_crumbs', 'chocolate_chip'],
  density: 'standard'
},
```

### Adding a New Alias (flavor-colors.js)
```javascript
// In FLAVOR_ALIASES object:
'espresso toffee': 'espresso toffee bar',
```

### Mirroring Profile to flavor-audit.html SEED_PROFILES
```javascript
// In SEED_PROFILES object (same structure, no export):
'cappuccino cookie crumble': { base:'espresso', ribbon:null, toppings:['cookie_crumbs','chocolate_chip'], density:'standard' },
```

### Mirroring Alias to cone-renderer.js FALLBACK_FLAVOR_ALIASES
```javascript
// In FALLBACK_FLAVOR_ALIASES object:
'espresso toffee': 'espresso toffee bar',
```

### Mirroring to flavor-audit.html SEED_ALIASES
```javascript
// In SEED_ALIASES object:
'espresso toffee': 'espresso toffee bar',
```

### Adding to flavor-audit.html SEED_CATALOG
```javascript
// In SEED_CATALOG array (alphabetical order):
{ title:'Cappuccino Cookie Crumble', description:'Espresso Fresh Frozen Custard with cookie crumbles and chocolate chips.' },
```

### Regenerating Golden Baselines
```bash
cd worker && UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js
```

### Running Contrast Check
```bash
cd worker && npx vitest run contrast-check.test.js
```

### Running Full CI Suite
```bash
cd worker && npm test
```

### Adding a Contrast Exemption (if truly unavoidable)
```javascript
// In contrast-check.test.js CONTRAST_EXEMPTIONS:
'coconut_flakes:coconut',  // white coconut flakes on white coconut base -- unavoidable
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-picking hex values per flavor | Expanded color palette + profile lookup | Phase 15 | 22 bases, 5 ribbons, 41 toppings cover most custard appearances |
| No alias system | FLAVOR_ALIASES with normalizeFlavorKey() | Phase 15 | 20 aliases map variants to canonical profiles |
| Keyword fallback only | Exact -> normalize -> alias -> keyword -> default | Phase 15 | Fallback chain still works but profiles are preferred |
| No visual regression | Zero-tolerance pixelmatch goldens | Phase 14 | 4 tiers per flavor, deterministic PRNG |
| No contrast checking | WCAG 3:1 with structural exemptions | Phase 14 | 10 contrast-adjusted toppings, 7 structural exemptions |

## Flavor Discovery Notes

### Known Culver's Flavors Not Yet Profiled (from web research)
These flavors appear on unofficial/semi-official sources and may be in the accumulated KV catalog:
- **Cappuccino Cookie Crumble** -- espresso base with cookie crumbles
- **Creamy Lemon Crumble** -- lemon base with crumble toppings
- **Espresso Toffee Bar** -- espresso base with toffee pieces
- **Midnight Toffee** -- dark chocolate base with toffee
- **Red Raspberry** -- likely raspberry base, simple
- **Raspberry Cream** -- appears on culvers.com (2026), possibly new/seasonal

### Seasonal/Historical Flavors Likely in KV
Based on flavor-tags.js seasonal patterns:
- Pumpkin variants (Pumpkin Pecan, Salted Caramel Pumpkin)
- Peppermint variants (Peppermint Bon Bon)
- Apple variants (Harvest Apple Crisp)
- Gingerbread variants
- Holiday/eggnog variants

### Multi-Brand Flavors
The 6-brand fetcher (Culver's + Kopp's + Gille's + Hefner's + Kraverz + Oscar's) accumulates ALL discovered flavors into KV. Non-Culver's brands may have unique flavor names that need profiles.

**Confidence:** MEDIUM -- exact unprofiled count depends on live KV state. The planner should structure batches to handle a variable count (estimate 60-120 unprofiled flavors).

## Open Questions

1. **Exact unprofiled flavor count**
   - What we know: 40 currently profiled, 20 aliases. SEED_CATALOG has 31. Live KV has more.
   - What's unclear: Exact count of unique unprofiled flavors in the accumulated KV catalog
   - Recommendation: First task in each plan should query `/api/flavors/catalog` or extract the full list from flavor-audit.html loaded with API. Use that count to size remaining batches.

2. **Whether new colors are needed**
   - What we know: Phase 15 added 10 bases + 12 toppings specifically for unprofiled flavor coverage
   - What's unclear: Whether ALL unprofiled flavors can be represented with existing 22+5+41 palette
   - Recommendation: Unlikely new colors needed, but if a flavor truly cannot be represented (e.g., "blue moon" is already a base), flag it. Any new colors would need palette-sync across all 4+ files.

3. **Non-Culver's brand flavor profiles**
   - What we know: KV accumulates flavors from 6 brands
   - What's unclear: Whether non-Culver's flavors have meaningfully different custard types
   - Recommendation: Profile them using same system. Most regional custard shops serve similar flavors. Cross-brand aliases may be needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest, via worker/package.json) |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd custard-calendar/worker && npx vitest run contrast-check.test.js palette-sync.test.js` |
| Full suite command | `cd custard-calendar/worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-03-a | Every new profile passes contrast checker (no topping/base below 3:1) | unit | `cd custard-calendar/worker && npx vitest run contrast-check.test.js -x` | Yes |
| PROF-03-b | All sync files match canonical | unit | `cd custard-calendar/worker && npx vitest run palette-sync.test.js -x` | Yes (colors only) |
| PROF-03-c | Golden baselines exist for all profiled flavors | unit | `cd custard-calendar/worker && npx vitest run golden-baselines.test.js -x` | Yes |
| PROF-03-d | Zero unprofiled flavors in audit | manual | Open `docs/flavor-audit.html`, filter "no profile", verify count = 0 | N/A (visual review) |
| PROF-03-e | SEED_PROFILES in flavor-audit.html matches FLAVOR_PROFILES in flavor-colors.js | integration | None -- no CI test exists for this sync | No -- Wave 0 gap |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx vitest run contrast-check.test.js palette-sync.test.js golden-baselines.test.js -x`
- **Per wave merge:** `cd custard-calendar/worker && npm test`
- **Phase gate:** Full suite green + flavor-audit.html shows zero unprofiled

### Wave 0 Gaps
- [ ] Consider adding profile-sync test to validate SEED_PROFILES matches FLAVOR_PROFILES (currently no CI coverage for this sync). Not strictly required -- manual review via flavor-audit.html is the established pattern -- but would prevent drift.
- [ ] Consider adding alias-sync test to validate FALLBACK_FLAVOR_ALIASES matches FLAVOR_ALIASES and SEED_ALIASES (currently no CI coverage).

Note: These gaps are LOW priority. The established workflow (manual review via flavor-audit.html + existing color-sync CI) has worked for 3 phases. Profile sync is straightforward copy-paste within the same commit. The planner may choose to skip these.

## Sources

### Primary (HIGH confidence)
- `worker/src/flavor-colors.js` -- 40 existing profiles, 20 aliases, 22 bases, 5 ribbons, 41 toppings (read directly)
- `docs/cone-renderer.js` -- FALLBACK constants structure, NO FALLBACK_FLAVOR_PROFILES (read directly)
- `docs/flavor-audit.html` -- SEED_PROFILES, SEED_ALIASES, SEED_CATALOG, rendering logic (read directly)
- `worker/test/contrast-check.test.js` -- WCAG 3:1 enforcement, CONTRAST_EXEMPTIONS set (read directly)
- `worker/test/palette-sync.test.js` -- color dict sync validation scope (read directly)
- `worker/test/golden-baselines.test.js` -- 4-tier pixelmatch regression (read directly)
- `worker/src/flavor-catalog.js` -- SEED_CATALOG 31 entries (read directly)

### Secondary (MEDIUM confidence)
- [culvers.com/flavor-of-the-day](https://www.culvers.com/flavor-of-the-day) -- 30 current flavors listed
- [culversmenuss.com](https://www.culversmenuss.com/culvers-flavor-of-the-day/) -- 36 flavors including some not on official site

### Tertiary (LOW confidence)
- Exact unprofiled count -- depends on live KV state, estimated 60-120 based on "~107" from requirements + multi-brand accumulation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools and patterns are established from Phases 13-15
- Architecture: HIGH -- file sync architecture, profile structure, and CI gates are well-documented and verified by reading source
- Pitfalls: HIGH -- identified from direct code analysis (missing CI coverage for profile sync, golden baseline volume, contrast conflicts)
- Flavor discovery: MEDIUM -- web sources provide partial lists, exact count requires live API

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no framework changes expected, only data authoring)
