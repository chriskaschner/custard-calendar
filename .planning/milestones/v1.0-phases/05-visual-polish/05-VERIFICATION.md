---
phase: 05-visual-polish
verified: 2026-03-08T22:00:00Z
status: gaps_found
score: 10/12 must-haves verified
gaps:
  - truth: "All ~176 flavors have a hero PNG committed in docs/assets/cones/"
    status: partial
    reason: "Only 40 PNGs generated (FLAVOR_PROFILES entries). The plan specified ~176 but FLAVOR_PROFILES has 40 canonical profiles. Remaining flavors fall back to SVG renderer. This is a documented deviation -- the SVG fallback works, so functional impact is low, but the literal must-have is not met."
    artifacts:
      - path: "docs/assets/cones/"
        issue: "Contains 40 PNGs, not ~176. Missing PNGs for ~136 flavors in the broader catalog."
    missing:
      - "PNGs for ~136 non-profiled flavors (or explicit redefinition of scope to 40 profiled flavors)"
  - truth: "Design tokens (--text-xs through --text-3xl, --space-1 through --space-6, --text-primary/muted/subtle) are defined at :root and consumed by 4 nav pages"
    status: partial
    reason: "Tokens are defined at :root (all 17 present). However, consumption is minimal: --text-primary and --text-subtle are never used in any CSS rule. Typography tokens --text-xs, --text-base, --text-lg, --text-xl, --text-2xl, --text-3xl are never consumed. Only --text-sm and --text-md are used (in .card--quiz). Spacing tokens are consumed only by the card system, not broadly across nav pages."
    artifacts:
      - path: "docs/style.css"
        issue: "--text-primary, --text-subtle, and 6 of 8 typography tokens defined but unused"
    missing:
      - "Adopt tokens in nav page CSS rules (e.g., font-size: 0.875rem -> var(--text-base), color: #1a1a1a -> var(--text-primary))"
human_verification:
  - test: "Visually confirm card system consistency across Today, Compare, Map, Fun pages"
    expected: "All card-like elements have consistent border-radius (12px), white background, subtle box-shadow"
    why_human: "Computed styles may pass tests but visual appearance needs human eye for consistency"
  - test: "Verify hero cone PNGs are visually distinct from HD SVG at hero scale"
    expected: "PNG hero cones show more detail (berries, swirls, crosshatch) than the SVG fallback"
    why_human: "Visual quality comparison requires human judgment"
  - test: "Verify seasonal flavor cadence suppression in context"
    expected: "Seasonal flavors show rarity badge but no 'every N days' text; non-seasonal flavors still show cadence text"
    why_human: "Requires testing with real seasonal/non-seasonal flavor data at runtime"
---

# Phase 5: Visual Polish Verification Report

**Phase Goal:** All pages share a consistent visual language -- unified card system, cone rendering tiers, and rarity copy that accounts for seasonality
**Verified:** 2026-03-08T22:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All card-like elements on Today, Compare, Map, and Fun pages share the same .card base class with consistent border-radius, background, shadow, and padding | VERIFIED | `docs/style.css:48-54` defines `.card` with 12px border-radius, white bg, border, box-shadow. `docs/index.html:102` has `card card--hero today-card`. `docs/compare-page.js:440` sets `card card--compare-day compare-day-card`. `docs/fun.html:130` has `card card--quiz quiz-mode-card`. `docs/map.html:911` has `card card--map-store store-card`. |
| 2 | Card variants (.card--hero, .card--compare-day, .card--map-store, .card--quiz) extend the base for context-specific needs | VERIFIED | `docs/style.css:55-66` defines all 4 variants with appropriate overrides. |
| 3 | Seasonal flavors (pumpkin, eggnog, peppermint, gingerbread, holiday, apple cider) do NOT show cadence text like 'every N days' or 'overdue' | VERIFIED | `docs/today-page.js:330` and `docs/compare-page.js:288` both guard cadence text with `CustardPlanner.isSeasonalFlavor()`. Cadence text in today-page.js lines 335 and 338 wrapped with `&& !isSeasonal`. Compare-page.js lines 290 and 292 similarly guarded. |
| 4 | Non-seasonal flavors continue to display cadence text exactly as before | VERIFIED | Guards only trigger for seasonal flavors. Non-seasonal path unchanged -- cadence text displayed when `avg_gap_days` present and `!isSeasonal` is true. |
| 5 | Seasonal flavors still display rarity badges (Rare/Ultra Rare) -- only the cadence text is suppressed | VERIFIED | `docs/today-page.js:332-334` renders rarity badge label unconditionally (`if (rarity.label)`). The seasonal guard only wraps cadence text, not the badge span. |
| 6 | Design tokens (--text-xs through --text-3xl, --space-1 through --space-6, --text-primary/muted/subtle) are defined at :root and consumed by 4 nav pages | PARTIAL | All 17 tokens defined at `:root` in `docs/style.css:11-31`. However, consumption is minimal: --text-primary and --text-subtle are NEVER used. 6 of 8 typography tokens are NEVER consumed. Only --text-sm, --text-md used in `.card--quiz`. Spacing tokens used only in card system. The "consumed by 4 nav pages" part is not achieved. |
| 7 | Today page hero card displays a pre-rendered PNG cone image for known flavors instead of the HD SVG | VERIFIED | `docs/today-page.js:361,370` calls `renderHeroCone(day.flavor, todayCone, 6)` which creates an `<img>` with `src=assets/cones/{slug}.png`. |
| 8 | All ~176 flavors have a hero PNG committed in docs/assets/cones/ | PARTIAL | Only 40 PNGs exist (verified via `ls | wc -l`). Plan specified ~176 but FLAVOR_PROFILES only has 40 entries. Documented deviation in SUMMARY. SVG fallback handles the gap. |
| 9 | If a hero PNG is missing for a newly added flavor, the page falls back to the existing HD SVG renderer seamlessly | VERIFIED | `docs/cone-renderer.js:361-362` sets `img.onerror` handler that calls `renderMiniConeHDSVG(flavorName, fallbackScale)`. |
| 10 | Compact contexts (Compare cells, Map markers, multi-store row, week-ahead) continue using the existing SVG mini renderer unchanged | VERIFIED | `docs/compare-page.js:483-484` still uses `renderMiniConeSVG()`. No references to `heroConeSrc` or `renderHeroCone` in compare-page.js. |
| 11 | Hero cone PNGs are NOT pre-cached in STATIC_ASSETS -- they use runtime stale-while-revalidate caching | VERIFIED | `docs/sw.js:1` CACHE_VERSION = 'custard-v15'. STATIC_ASSETS has 26 entries with no cone PNGs. `docs/sw.js:64` handles `/assets/cones/*.png` with runtime stale-while-revalidate pattern. |
| 12 | Service worker CACHE_VERSION is bumped so existing users get updated assets | VERIFIED | `docs/sw.js:1` shows `CACHE_VERSION = 'custard-v15'` (bumped from v14). |

**Score:** 10/12 truths verified (2 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/style.css` | Design tokens at :root, .card base class, card variant modifiers | VERIFIED | All present: 17 tokens at :root (lines 11-31), .card base (line 48), 4 variants (lines 55-66), .hero-cone-img (line 1016) |
| `docs/planner-shared.js` | isSeasonalFlavor() function for client-side seasonal detection | VERIFIED | SEASONAL_PATTERN at line 41, isSeasonalFlavor() at line 43, exported via CustardPlanner return object at line 1494 |
| `docs/today-page.js` | Seasonal cadence suppression in renderRarity() + hero PNG rendering | VERIFIED | renderRarity(rarity, flavorName) at line 324 with seasonal guard at line 330. renderHeroCone() called at lines 361, 370. |
| `docs/compare-page.js` | Seasonal cadence suppression in detail panel rarity + card class | VERIFIED | Seasonal guard at line 288-293. Card class at line 440. |
| `docs/cone-renderer.js` | heroConeSrc() and renderHeroCone() for PNG-with-fallback rendering | VERIFIED | heroConeSrc() at line 336, renderHeroCone() at line 351. Both globally accessible (listed in file header). |
| `docs/sw.js` | Runtime stale-while-revalidate cache for assets/cones/ path, bumped CACHE_VERSION | VERIFIED | CACHE_VERSION = 'custard-v15' at line 1. Runtime cone cache handler at line 64. |
| `docs/assets/cones/` | Pre-rendered hero cone PNGs | PARTIAL | 40 PNGs present (expected ~176 per plan, but deviation documented -- only FLAVOR_PROFILES entries generated) |
| `worker/test/browser/vizp-card-system.spec.mjs` | Playwright tests for VIZP-02 card system | VERIFIED | 266 lines, substantive test file |
| `worker/test/browser/vizp-seasonal-rarity.spec.mjs` | Playwright tests for VIZP-03 seasonal rarity suppression | VERIFIED | 310 lines, substantive test file |
| `worker/test/browser/vizp-cone-tiers.spec.mjs` | Playwright tests for VIZP-01 and VIZP-04 cone tier requirements | VERIFIED | 469 lines, substantive test file |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| docs/today-page.js | docs/planner-shared.js | CustardPlanner.isSeasonalFlavor() | WIRED | Line 330: `CustardPlanner.isSeasonalFlavor(flavorName)` |
| docs/compare-page.js | docs/planner-shared.js | CustardPlanner.isSeasonalFlavor() | WIRED | Line 288: `CustardPlanner.isSeasonalFlavor(flavorName)` |
| docs/index.html | docs/style.css | .card and .card--hero classes | WIRED | Line 102: `class="card card--hero today-card"` |
| docs/fun.html | docs/style.css | .card and .card--quiz classes | WIRED | Line 130+: `class="card card--quiz quiz-mode-card"` on 6 elements |
| docs/today-page.js | docs/cone-renderer.js | heroConeSrc()/renderHeroCone() function call | WIRED | Lines 361, 370: `renderHeroCone(day.flavor, todayCone, 6)` |
| docs/today-page.js | docs/assets/cones/ | img.src = heroConeSrc(flavor) resolving to assets/cones/{slug}.png | WIRED | cone-renderer.js line 342 returns `'assets/cones/' + slug + '.png'` |
| docs/sw.js | docs/assets/cones/ | Runtime cache handler matching assets/cones path | WIRED | Line 64: `url.pathname.includes('/assets/cones/')` |
| docs/today-page.js | docs/cone-renderer.js | Fallback to renderMiniConeHDSVG when PNG missing | WIRED | cone-renderer.js line 362: `container.innerHTML = renderMiniConeHDSVG(...)` in img.onerror |
| docs/compare-page.js | docs/style.css | .card.card--compare-day class | WIRED | Line 440: `dayCard.className = 'card card--compare-day compare-day-card'` |
| docs/map.html | docs/style.css | .card.card--map-store class | WIRED | Line 911: `class="card card--map-store store-card..."` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIZP-01 | 05-02 | Consistent cone rendering tier used across all homepage elements | SATISFIED | Hero uses PNG via renderHeroCone() (today-page.js:361). Compact contexts use SVG via renderMiniConeSVG (compare-page.js:484). Two distinct tiers operating correctly. |
| VIZP-02 | 05-01 | Unified card system with shared border, background, spacing, and typography | SATISFIED | .card base class at style.css:48 with 4 variants. Applied to Today (index.html:102), Compare (compare-page.js:440), Map (map.html:911), Fun (fun.html:130). |
| VIZP-03 | 05-01 | Rarity/overdue copy accounts for seasonality (suppress misleading cadence claims for seasonal flavors) | SATISFIED | isSeasonalFlavor() in planner-shared.js:43 guards cadence text in today-page.js:330,335,338 and compare-page.js:288,290,292. |
| VIZP-04 | 05-02 | Cone asset quality pipeline from low-res Tidbyt tier up to hero-level pixel art per context | SATISFIED | heroConeSrc()/renderHeroCone() in cone-renderer.js provide PNG-first hero rendering. 40 PNGs in docs/assets/cones/. SVG fallback for remaining flavors. Runtime caching in sw.js. |

All 4 VIZP requirements from REQUIREMENTS.md mapped to Phase 5 are accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| docs/style.css | 30-31 | --text-primary and --text-subtle defined but never consumed | Info | Tokens exist but provide no value until consumed; not blocking |
| docs/style.css | 12-19 | 6 of 8 typography tokens (--text-xs, --text-base, --text-lg, --text-xl, --text-2xl, --text-3xl) defined but never consumed | Info | Foundation for future use but currently inert |

No TODO/FIXME/HACK/PLACEHOLDER comments found in any modified files. No stub implementations detected. No console.log-only handlers found.

### Human Verification Required

### 1. Card System Visual Consistency

**Test:** Open Today, Compare, Map (popup), and Fun pages side by side. Check that all card-like elements appear visually consistent.
**Expected:** Cards across all pages share 12px rounded corners, white background, subtle shadow. No visual jarring when navigating between pages.
**Why human:** CSS computed values may match but visual consistency depends on layout context, stacking, and surrounding elements.

### 2. Hero Cone PNG Quality vs SVG

**Test:** Load a flavor that has a PNG (e.g., "Vanilla") on the Today page. Compare visual quality to a flavor that falls back to SVG.
**Expected:** PNG cones show visible pixel art detail at hero scale. SVG fallback still renders acceptably.
**Why human:** "Visually distinct" and "more detailed" are subjective quality judgments.

### 3. Seasonal Cadence Suppression Live Behavior

**Test:** When a seasonal flavor (e.g., Pumpkin Spice) appears at a store, check the Today page and Compare detail panel.
**Expected:** Rarity badge (e.g., "Rare") appears but no "every N days" or "overdue" cadence text. Non-seasonal flavors still show cadence text.
**Why human:** Requires real-time seasonal flavor data at a store, which cannot be verified with static analysis.

### Gaps Summary

Two partial gaps identified, both non-blocking for the phase GOAL but departing from stated plan must-haves:

1. **Hero PNG count (40 vs ~176):** The plan specified ~176 flavors should have PNGs. Only 40 were generated (matching FLAVOR_PROFILES, which has canonical visual data). This is a documented, deliberate deviation -- the SVG fallback seamlessly covers the remaining flavors. The ROADMAP success criterion "Cone images render at appropriate quality tiers per context" IS met because the fallback works. This is more of a scope decision than a gap.

2. **Design token consumption:** All 17 tokens are defined at :root, which is the foundational step. However, the plan truth claimed they would be "consumed by 4 nav pages." Currently, only the card system uses a subset (--text-sm, --text-md, --space-1 through --space-5). The remaining tokens (--text-primary, --text-subtle, --text-xs, --text-base, --text-lg, --text-xl, --text-2xl, --text-3xl) are defined but never referenced in any CSS rule. The ROADMAP success criterion mentions "consistent typography" which could be argued as met through the existing hardcoded values being consistent -- the tokens are available for future adoption.

Neither gap prevents the phase goal "all pages share a consistent visual language" from being functionally achieved. The card system works, cone tiers work, seasonal rarity suppression works. The gaps are about completeness of token adoption and asset coverage, not broken functionality.

---

_Verified: 2026-03-08T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
