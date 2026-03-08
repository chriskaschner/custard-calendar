# Phase 5: Visual Polish - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

All pages share a consistent visual language -- unified card system, cone rendering tiers appropriate to context, rarity copy that accounts for seasonality, and design tokens for typography/spacing/color. Scope is the 4 nav destination pages (Today, Compare, Map, Fun). Legacy pages are not actively migrated.

Requirements: VIZP-01, VIZP-02, VIZP-03, VIZP-04

</domain>

<decisions>
## Implementation Decisions

### Card System Unification
- Shared `.card` base class with consistent border-radius, background, shadow, and padding
- Variants via modifier classes (`.card--compare`, `.card--store`, `.card--quiz`, etc.) for context-specific needs
- All 4 nav pages adopt the base: heavier treatment on Today/Compare/Fun, lighter on Map
- Hero card on Today uses the same `.card` base, scaled up with larger padding and layout -- same family, not a separate system
- Map store popup cards keep brand-colored left borders (Culver's blue, Kopp's black, etc.) as a Map-specific variant -- functional for brand identification

### Cone Rendering Tiers
- Hero context (Today page main card): pre-rendered detailed pixel art PNGs stored in `docs/assets/cones/{flavor-slug}.png`
- Pixel art style: detailed with visible pixels, berries/swirls/crosshatch detail -- NOT photorealistic, NOT the low-res chunky SVG
- Compact contexts (Compare cells, Map markers, multi-store row, week-ahead): keep existing SVG mini renderer -- pixel art works well at 32-40px
- Fallback: if a pre-rendered hero PNG is missing (e.g., newly added flavor), fall back to HD SVG renderer
- ~176 flavor assets committed to repo (~10-18MB total)

### Seasonal Rarity Copy
- Suppress misleading cadence claims for seasonal flavors -- do NOT show "only every N days!" or "overdue!" for seasonal flavors during off-season
- Use existing `seasonal` tag from Worker signals.js to identify seasonal flavors -- no new data source needed
- Keep rarity badges (Rare/Ultra Rare) for seasonal flavors based on avg_gap_days -- the badge stays, just the cadence text is suppressed
- Non-seasonal flavors: no change to current rarity badge + cadence text behavior

### Typography & Spacing
- Define CSS custom property design tokens for font sizes, spacing, and colors
- Collapse ~38 unique font sizes to ~8 token sizes (--text-xs through --text-xl)
- 3 text color levels: --text-primary (#1a1a1a), --text-muted (#666), --text-subtle (#999)
- Spacing tokens (--space-1 through --space-6) for consistent rhythm
- Scope: 4 nav destination pages (Today, Compare, Map, Fun) adopt tokens
- Legacy pages (quiz.html, radar.html, scoop.html, etc.) inherit var definitions from style.css but are NOT actively migrated
- Keep system font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif) -- no web fonts

### Claude's Discretion
- Exact border-radius, shadow, and padding values for .card base
- Hero cone asset generation approach (AI generation, programmatic, or hybrid)
- Exact font size token values in the 8-step scale
- Exact spacing token values
- Card variant-specific overrides beyond the base
- Loading skeleton updates for unified card system
- Error state visual consistency

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cone-renderer.js`: `renderMiniConeSVG()` (9x11 grid) and `renderMiniConeHDSVG()` (18x22 grid) -- mini stays for compact contexts, HD becomes fallback for missing hero assets
- `planner-shared.js`: `rarityLabelFromGapDays()` (line 424-430) -- needs seasonal tag check added before cadence text
- `planner-shared.js`: `formatCadenceText()` (line 451-459) -- suppress output when flavor has seasonal tag
- `style.css`: Already has CSS vars `--brand`, `--border`, `--radius`, `--bg`, `--text`, `--text-muted` -- extend this token set
- `style.css`: 7 distinct card styles (.store-card, .day-card, .flavor-card, .near-me-card, .week-day-card, .compare-day-card, .vote-card) -- migrate to shared .card base
- `.rarity-badge-*` classes in style.css (lines 1597-1612) -- keep as-is, just suppress cadence text for seasonal

### Established Patterns
- IIFE Revealing Module: window.CustardPlanner, window.CustardToday, window.SharedNav -- no new modules needed for this phase
- No build step: vanilla JS, static HTML/CSS/JS on GitHub Pages
- Cone rendering uses flavor color profiles from `flavor-colors.js` in Worker (mirrored in cone-renderer.js)

### Integration Points
- `docs/assets/cones/` directory: new, holds pre-rendered hero cone PNGs
- `style.css`: design tokens defined at :root, consumed by all 4 nav pages
- `cone-renderer.js`: hero rendering path needs to check for pre-rendered asset first, fall back to HD SVG
- `planner-shared.js`: rarity functions need seasonal tag awareness
- `sw.js`: STATIC_ASSETS must include new cone PNG assets and CACHE_VERSION bump

</code_context>

<specifics>
## Specific Ideas

- The SVG pixel art renderer has been "terrible at higher resolutions" -- scaling up the HD renderer produces output that isn't visually differentiable from the much lower-res Tidbyt version. Pre-rendered assets solve this quality gap.
- Pixel art is the brand identity -- the hero cone should be detailed pixel art (berries, swirls, crosshatch visible), not photorealistic
- "Unify what users see side-by-side" -- cards on pages users navigate between freely (Today/Compare/Fun) should feel like the same family
- Map brand borders are functional (quick brand identification when comparing across Culver's/Kopp's/etc.), not just decorative

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 05-visual-polish*
*Context gathered: 2026-03-08*
