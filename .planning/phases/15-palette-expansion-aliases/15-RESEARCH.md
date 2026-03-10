# Phase 15: Palette Expansion & Aliases - Research

**Researched:** 2026-03-09
**Domain:** Color palette data management, alias resolution, multi-file sync
**Confidence:** HIGH

## Summary

Phase 15 is a data-authoring phase with zero rendering changes. The work is: (1) add ~10 new base colors and ~10+ new topping colors to all 4 sync files, (2) create a FLAVOR_ALIASES dict for ~20 duplicate/variant flavor names, and (3) wire alias resolution into getFlavorProfile() so Phase 16 can reference any flavor without hitting missing-color or duplicate-name failures.

The codebase has a mature, well-tested sync infrastructure from Phases 13-14. The palette-sync test (vitest) regex-parses all 4 files and compares hex values against the canonical flavor-colors.js. The contrast-check test validates all topping/base pairs in FLAVOR_PROFILES at >= 3:1 WCAG ratio. Both tests are CI gates. The primary risk is not technical complexity but *volume* -- every new color must be added to 4 files in lockstep, and every new topping must be contrast-validated against the bases it will pair with in Phase 16.

**Primary recommendation:** Split into 2 plans: (1) base + topping color expansion across all 4 sync files with contrast validation, (2) alias audit + FLAVOR_ALIASES implementation + CI alias validation test. Plan 1 is mechanical (add colors, sync files, run tests). Plan 2 requires flavor catalog analysis and getFlavorProfile() modification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Visual distinctness is the primary criterion for new color hex values
- Topping colors are contrast-adjusted after initial selection (same Phase 14 approach)
- Ribbon colors added only if unprofiled flavor audit reveals need
- Base colors named in roadmap: espresso, cherry, pumpkin, banana, coconut, root_beer, pistachio, orange, blue_moon, maple
- Full catalog audit during planning to identify duplicate/variant names
- Alias criteria: same base ingredients = alias
- FLAVOR_ALIASES dict in flavor-colors.js as new exported constant
- Aliases only in flavor-colors.js and cone-renderer.js (NOT synced to Starlark or flavor-audit.html)
- Silent resolution at runtime: getFlavorProfile() checks FLAVOR_ALIASES before keyword fallback
- Visible in flavor-audit.html: audit tool displays alias mappings so duplicates are inspectable
- Normalized matching: use existing normalizeFlavorKey() before alias lookup
- CI test validates all alias targets point to real FLAVOR_PROFILES keys
- Demand-driven topping scope: audit unprofiled flavors to identify needed topping colors
- No cap on topping count
- Distinct colors for visually different toppings
- Contrast validation against paired bases only, with exemptions for structural conflicts

### Claude's Discretion
- Exact hex values for all new colors (base, topping, ribbon if needed)
- Whether to present palette for user review before committing
- How to parse flavor catalog for alias audit
- Exact flavor-audit.html changes for alias visibility
- Test file organization for alias validation CI

### Deferred Ideas (OUT OF SCOPE)
- FLAVOR_PROFILES sync across Starlark files (profile definitions, not just colors)
- LED-specific color optimization for Tidbyt
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | ~10 new base colors added to all sync files | Color expansion pattern established in existing BASE_COLORS (13 entries). All 4 sync file locations identified. Palette-sync test automatically validates. |
| PROF-02 | ~10 new topping colors added to all sync files | Topping expansion follows same 4-file sync pattern. Contrast-check test automatically validates new topping/base pairs. |
| PROF-04 | ~20 duplicate/alias flavor names map to canonical profiles | FLAVOR_ALIASES dict is new code. getFlavorProfile() modification needed. New CI test for alias target validation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test runner | Already used for all worker tests (574 tests, 32 suites) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new dependencies needed. All work is data authoring in existing files. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual 4-file sync | Code generation script | Not worth it -- palette-sync test catches drift, and Phase 15 is one-time bulk authoring |

## Architecture Patterns

### File Sync Architecture (Established)

The canonical source is `worker/src/flavor-colors.js`. All 4 downstream files must contain identical color hex values:

```
worker/src/flavor-colors.js (CANONICAL)
  |
  |-- docs/cone-renderer.js        (FALLBACK_BASE_COLORS, FALLBACK_TOPPING_COLORS, etc.)
  |-- tidbyt/culvers_fotd.star     (BASE_COLORS, TOPPING_COLORS Starlark dicts)
  |-- docs/flavor-audit.html       (SEED_BASE, SEED_TOPPING, etc.)
  \-- custard-tidbyt/apps/...      (optional, skipped if repo not present)
```

### Current Color Counts
| Dict | Current Count | Phase 15 Target |
|------|--------------|-----------------|
| BASE_COLORS | 13 | ~23 (+10 new) |
| TOPPING_COLORS | 20 (was 21, minus blackberry_drupe which is 20+1=21) | ~31+ (+10+ new) |
| RIBBON_COLORS | 5 | 5 (add only if needed) |
| CONE_COLORS | 2 | 2 (unchanged) |
| FLAVOR_PROFILES | 42 | 42 (unchanged -- Phase 16 adds profiles) |

### Pattern 1: Adding a New Base Color
**What:** Add color key + hex to all 4 sync files
**When to use:** Every new base color
**Example:**
```javascript
// 1. flavor-colors.js (canonical) -- add to BASE_COLORS export
export const BASE_COLORS = {
  // ... existing 13 entries ...
  espresso: '#3C1518',      // NEW
  cherry: '#C41E3A',        // NEW
  // etc.
};

// 2. cone-renderer.js -- add to FALLBACK_BASE_COLORS (var, not const)
var FALLBACK_BASE_COLORS = {
  // ... existing entries ...
  espresso: '#3C1518',
  cherry: '#C41E3A',
};

// 3. culvers_fotd.star -- add to BASE_COLORS Starlark dict
BASE_COLORS = {
    # ... existing entries ...
    "espresso": "#3C1518",
    "cherry": "#C41E3A",
}

// 4. flavor-audit.html -- add to SEED_BASE (var)
var SEED_BASE = {
  // ... existing entries ...
  espresso:'#3C1518', cherry:'#C41E3A',
};
```

### Pattern 2: Adding FLAVOR_ALIASES
**What:** New exported constant + getFlavorProfile() modification
**When to use:** Once, for all aliases
**Example:**
```javascript
// flavor-colors.js -- new export after FLAVOR_PROFILES
export const FLAVOR_ALIASES = {
  'cookie dough craze': 'crazy for cookie dough',
  'peanut butter cup': "really reese's",
  'oreo cookie overload': 'oreo cookie overload',  // not an alias, just example
  // ... ~20 alias -> canonical mappings
};

// Modified getFlavorProfile():
export function getFlavorProfile(name) {
  if (!name) return DEFAULT_PROFILE;
  const key = name.toLowerCase();

  // Exact match
  if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];

  // Normalize unicode curly quotes
  const normalized = key.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  if (FLAVOR_PROFILES[normalized]) return FLAVOR_PROFILES[normalized];

  // >>> NEW: Alias resolution (after normalize, before keyword fallback) <<<
  const aliasKey = normalizeFlavorKey(key);  // strips TM/R, normalizes quotes+whitespace
  const canonical = FLAVOR_ALIASES[aliasKey];
  if (canonical && FLAVOR_PROFILES[canonical]) return FLAVOR_PROFILES[canonical];

  // Keyword fallback (existing)
  // ...
}
```

### Pattern 3: Alias in cone-renderer.js
**What:** Duplicate FLAVOR_ALIASES dict + modify getFlavorProfileLocal lookup
**When to use:** cone-renderer.js uses `var` (no build step), so FLAVOR_ALIASES is duplicated as a fallback constant
```javascript
// cone-renderer.js -- new var
var FALLBACK_FLAVOR_ALIASES = {
  'cookie dough craze': 'crazy for cookie dough',
  // ... same entries
};

// Modified getFlavorProfileLocal or getFlavorBaseColor to check aliases
```

### Anti-Patterns to Avoid
- **Duplicating FLAVOR_PROFILES entries for aliases:** Creates maintenance burden. Use FLAVOR_ALIASES lookup instead.
- **Adding alias resolution to Starlark:** Decision explicitly defers this. Starlark only needs color dicts.
- **Picking hex values without contrast checking:** Every new topping MUST be contrast-validated before committing.
- **Adding colors one-at-a-time across files:** Batch all additions per file to minimize sync risk. Palette-sync test is the gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast ratio | Custom luminance math | Existing `contrast-check.test.js` with `relativeLuminance()` + `contrastRatio()` | Already battle-tested with exemption support |
| Flavor key normalization | New normalization logic | Existing `normalizeFlavorKey()` in cone-renderer.js | Handles unicode, TM/R symbols, whitespace already |
| Color sync validation | Manual eyeball check | Existing `palette-sync.test.js` | Regex-parses all 4 files, catches any drift automatically |
| Hex color selection | Random color picker | Food-accurate colors from real-world reference, then contrast-adjusted | Phase 14 established this workflow |

## Common Pitfalls

### Pitfall 1: Forgetting a Sync File
**What goes wrong:** New color added to flavor-colors.js but missed in one of the 3 downstream files.
**Why it happens:** Manual 4-file sync is tedious.
**How to avoid:** Run `cd worker && npm test` after every batch of color additions. palette-sync.test.js catches any missing entry.
**Warning signs:** palette-sync test failures naming specific keys as "MISSING."

### Pitfall 2: Contrast Failure on New Topping Colors
**What goes wrong:** New topping color looks fine on the base it was designed for, but fails 3:1 on another base it gets paired with in Phase 16.
**Why it happens:** Topping colors are shared across multiple profiles with different base colors.
**How to avoid:** For Phase 15, validate contrast against the bases the topping is *likely* to pair with. For toppings that span light and dark bases (like `dove` on both vanilla and chocolate), accept that structural exemptions may be needed.
**Warning signs:** contrast-check.test.js failures after Phase 16 adds profiles using these toppings.

### Pitfall 3: Alias Targets That Don't Exist
**What goes wrong:** FLAVOR_ALIASES points to a canonical key that doesn't exist in FLAVOR_PROFILES.
**Why it happens:** Typo in canonical key, or canonical profile not yet authored (Phase 16).
**How to avoid:** CI test that iterates FLAVOR_ALIASES values and asserts each exists in FLAVOR_PROFILES. Since some targets may not exist until Phase 16, the test should validate against existing profiles only, or Phase 15 should limit aliases to flavors that already have profiles.
**Warning signs:** getFlavorProfile() returns DEFAULT_PROFILE for aliased names despite alias being set.

### Pitfall 4: normalizeFlavorKey() Inconsistency
**What goes wrong:** Alias key in FLAVOR_ALIASES doesn't match what normalizeFlavorKey() produces, so lookup silently fails.
**Why it happens:** FLAVOR_ALIASES keys were typed manually instead of using normalizeFlavorKey() output.
**How to avoid:** Define aliases using already-normalized keys (lowercase, no TM/R, ASCII quotes, single spaces).
**Warning signs:** Alias lookup never matches at runtime even though the alias appears to be defined.

### Pitfall 5: Starlark Dict Syntax Errors
**What goes wrong:** Adding entries to Starlark dicts with JavaScript syntax (trailing commas are OK in Starlark, but quote style or other syntax could cause issues).
**Why it happens:** Copy-pasting from JavaScript to Starlark without adjusting syntax.
**How to avoid:** Starlark uses Python-like syntax with double quotes for dict keys. Follow existing dict format exactly.
**Warning signs:** pixlet render fails with syntax error.

### Pitfall 6: Golden Hash Invalidation
**What goes wrong:** Adding new colors doesn't change existing profiles, but someone worries about golden hash changes.
**Why it happens:** Golden hashes only cover the 5 Tier-1 reference flavors (vanilla, mint explosion, etc.). Adding new colors to the dicts does NOT change any existing profile's rendering.
**How to avoid:** Understand that golden hashes are unaffected because Phase 15 adds NO new FLAVOR_PROFILES and changes NO existing hex values.
**Warning signs:** None expected -- this is a non-issue, documented here to prevent false alarm.

## Code Examples

### Adding Colors to flavor-colors.js (Canonical)
```javascript
// Source: worker/src/flavor-colors.js (existing pattern)
export const BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#6F4E37',
  // ... existing 13 entries ...
  // Phase 15 additions:
  espresso: '#XXXXXX',
  cherry: '#XXXXXX',
  pumpkin: '#XXXXXX',
  banana: '#XXXXXX',
  coconut: '#XXXXXX',
  root_beer: '#XXXXXX',
  pistachio: '#XXXXXX',
  orange: '#XXXXXX',
  blue_moon: '#XXXXXX',
  maple: '#XXXXXX',
};
```

### FLAVOR_ALIASES Data Structure
```javascript
// Source: new code in worker/src/flavor-colors.js
/**
 * Alias mappings: normalized variant name -> canonical FLAVOR_PROFILES key.
 * Checked by getFlavorProfile() after normalize, before keyword fallback.
 */
export const FLAVOR_ALIASES = {
  // Historical renames
  'peanut butter cup': "really reese's",
  // Marketing variants
  // ... ~20 entries identified from catalog audit
};
```

### CI Alias Validation Test
```javascript
// Source: new test file worker/test/alias-validation.test.js
import { describe, it, expect } from 'vitest';
import { FLAVOR_ALIASES, FLAVOR_PROFILES } from '../src/flavor-colors.js';

describe('FLAVOR_ALIASES validation', () => {
  it('every alias target exists in FLAVOR_PROFILES', () => {
    for (const [alias, canonical] of Object.entries(FLAVOR_ALIASES)) {
      expect(
        FLAVOR_PROFILES[canonical],
        `Alias "${alias}" -> "${canonical}" but "${canonical}" not in FLAVOR_PROFILES`
      ).toBeDefined();
    }
  });

  it('no alias key is also a FLAVOR_PROFILES key (would be redundant)', () => {
    for (const alias of Object.keys(FLAVOR_ALIASES)) {
      expect(
        FLAVOR_PROFILES[alias],
        `"${alias}" exists in both FLAVOR_ALIASES and FLAVOR_PROFILES -- remove from aliases`
      ).toBeUndefined();
    }
  });
});
```

### getFlavorProfile with Alias Resolution
```javascript
// Source: modified worker/src/flavor-colors.js
function normalizeFlavorKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')     // strip TM/R
    .replace(/[\u2018\u2019]/g, "'")    // curly -> straight quotes
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFlavorProfile(name) {
  if (!name) return DEFAULT_PROFILE;
  const key = name.toLowerCase();

  if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];

  const normalized = key.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  if (FLAVOR_PROFILES[normalized]) return FLAVOR_PROFILES[normalized];

  // Alias resolution
  const nfk = normalizeFlavorKey(key);
  if (FLAVOR_ALIASES[nfk] && FLAVOR_PROFILES[FLAVOR_ALIASES[nfk]]) {
    return FLAVOR_PROFILES[FLAVOR_ALIASES[nfk]];
  }

  // Keyword fallback (unchanged)
  if (key.includes('double butter pecan')) return { ... };
  // ...
  return DEFAULT_PROFILE;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc color values per file | Canonical source + sync test | Phase 13-14 (2026-03-10) | palette-sync.test.js is the gate |
| No contrast validation | WCAG 3:1 CI gate + exemptions | Phase 14 (2026-03-10) | contrast-check.test.js validates all topping/base pairs |
| Duplicate profile entries for aliases | (Not yet implemented) | Phase 15 (this phase) | FLAVOR_ALIASES replaces duplication |

## Key Analysis: Existing Aliases and Collision Data

The flavor-audit.html already documents 4 investigated collision pairs:

1. **Chocolate Volcano / Chocolate Oreo Volcano** -- Distinct flavors. Both have profiles. COV is historical (retired July 2023).
2. **Salted Double Caramel Pecan / Salted Caramel Pecan Pie** -- Distinct flavors. Both have profiles. SCPP is historical.
3. **OREO Cookie Cheesecake / OREO Cheesecake** -- Distinct flavors (different brand names: Culver's vs Gille's). Both have profiles.
4. **Really Reese's / Peanut Butter Cup** -- Same product renamed. PB Cup is historical. This IS an alias candidate.

From `SEED_CATALOG` and `KNOWN_FLAVORS_FALLBACK`, combined with the 42 existing FLAVOR_PROFILES, the alias audit should focus on:
- Historical renames (Peanut Butter Cup -> Really Reese's -- already documented)
- Brand-specific name variants (Culver's vs Kopp's vs Gille's names for same product)
- Marketing name changes ("Crazy for Cookie Dough" vs "Caramel Fudge Cookie Dough" -- both exist as separate profiles, same ingredients is the alias criterion)

Note: "Crazy for Cookie Dough" and "Caramel Fudge Cookie Dough" both have profiles with identical base/ribbon/toppings (vanilla/fudge/cookie_dough). This is a strong alias candidate -- but per CONTEXT.md, alias criteria is "same base ingredients." If both have the same profile definition, one could be aliased to the other.

### normalizeFlavorKey() Implementation

The function exists in cone-renderer.js (docs-side) already. It needs to be exported from flavor-colors.js (worker-side) for use in the alias lookup. Currently, flavor-colors.js does inline normalization (unicode quote replacement) but does NOT have a reusable normalizeFlavorKey. The function should be added or imported.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `worker/vitest.config.js` |
| Quick run command | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js test/contrast-check.test.js` |
| Full suite command | `cd custard-calendar/worker && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | New base colors in all 4 sync files | unit | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js -x` | Yes |
| PROF-02 | New topping colors in all 4 sync files | unit | `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js -x` | Yes |
| PROF-02 | New topping colors pass contrast check | unit | `cd custard-calendar/worker && npx vitest run test/contrast-check.test.js -x` | Yes |
| PROF-04 | Alias targets point to real profiles | unit | `cd custard-calendar/worker && npx vitest run test/alias-validation.test.js -x` | No -- Wave 0 |
| PROF-04 | getFlavorProfile resolves aliases | unit | `cd custard-calendar/worker && npx vitest run test/flavor-colors.test.js -x` | Yes (needs new test cases) |

### Sampling Rate
- **Per task commit:** `cd custard-calendar/worker && npx vitest run test/palette-sync.test.js test/contrast-check.test.js -x`
- **Per wave merge:** `cd custard-calendar/worker && npm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `worker/test/alias-validation.test.js` -- validates FLAVOR_ALIASES targets exist in FLAVOR_PROFILES (PROF-04)
- [ ] New test cases in `worker/test/flavor-colors.test.js` -- test getFlavorProfile alias resolution

## Open Questions

1. **Exact alias list**
   - What we know: At least 1 confirmed alias (Peanut Butter Cup -> Really Reese's). "Crazy for Cookie Dough" and "Caramel Fudge Cookie Dough" share identical profiles and may be alias candidates. Full audit requires Worker KV data or exhaustive catalog review.
   - What's unclear: How many of the ~20 target aliases will be identifiable from static analysis vs needing live data.
   - Recommendation: Plan should include a catalog audit task that examines SEED_CATALOG, KNOWN_FLAVORS_FALLBACK, SIMILARITY_GROUPS, and FLAVOR_FAMILIES to build the alias list. Some aliases may emerge during Phase 16 and can be added then (CONTEXT.md says "Phase 16 workflow: new aliases ship in same commit as their canonical profile").

2. **normalizeFlavorKey in flavor-colors.js**
   - What we know: cone-renderer.js has `normalizeFlavorKey()`. flavor-colors.js does inline unicode normalization but has no reusable function.
   - What's unclear: Whether to extract a shared normalizeFlavorKey into flavor-colors.js or keep the inline approach.
   - Recommendation: Add a private `normalizeFlavorKey()` to flavor-colors.js (matching cone-renderer.js logic). Used by alias lookup in getFlavorProfile(). Not exported (internal implementation detail).

3. **Contrast exemptions for new toppings**
   - What we know: Phase 14 established CONTRAST_EXEMPTIONS set with 8 known structural conflicts.
   - What's unclear: Whether new toppings will need exemptions. Won't be fully known until Phase 16 creates profiles pairing them with bases.
   - Recommendation: Add exemptions as needed when Phase 16 creates profiles. Phase 15 should validate new toppings against the bases they're *likely* to pair with and note any that are borderline.

## Sources

### Primary (HIGH confidence)
- `worker/src/flavor-colors.js` -- canonical source, 42 profiles, 13 bases, 21 toppings, 5 ribbons
- `worker/test/palette-sync.test.js` -- CI sync gate parsing all 4 files
- `worker/test/contrast-check.test.js` -- WCAG 3:1 validation with exemptions
- `docs/cone-renderer.js` -- FALLBACK_* constants, normalizeFlavorKey()
- `docs/flavor-audit.html` -- SEED_* constants, COLLISIONS data, SEED_PROFILES
- `tidbyt/culvers_fotd.star` -- Starlark color dicts and FLAVOR_PROFILES
- `worker/src/flavor-catalog.js` -- SEED_CATALOG with 30 known flavors
- `15-CONTEXT.md` -- User decisions for this phase

### Secondary (MEDIUM confidence)
- `worker/src/flavor-matcher.js` -- SIMILARITY_GROUPS, FLAVOR_FAMILIES (alias candidates)
- `docs/map.html` -- KNOWN_FLAVORS_FALLBACK list (32 flavor names)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing tooling
- Architecture: HIGH - Established 4-file sync pattern with CI gates from Phases 13-14
- Pitfalls: HIGH - Well-documented from Phase 14 experience with contrast and sync
- Alias implementation: MEDIUM - New feature pattern (FLAVOR_ALIASES), but straightforward dict lookup

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependencies changing)
