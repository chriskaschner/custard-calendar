# Project Research Summary

**Project:** Custard Calendar v2.0 Art Quality -- AI-Generated Pixel Art Cone Pipeline
**Domain:** Static asset generation pipeline for 94 unique flavor icons via AI image generation
**Researched:** 2026-03-18
**Confidence:** MEDIUM (stack and integration patterns are HIGH confidence; AI generation consistency is empirically unproven at this scale)

## Executive Summary

This is a pre-baked static asset migration project, not a product feature. The goal is replacing 94 algorithmically-generated SVG-derived cone PNGs with AI-generated pixel art PNGs, then removing the dead SVG renderer stack. The existing codebase has a proof-of-concept (blackberry-cobbler L5 PNG), a complete prompt template system (`masterlock-flavor-fills.json`), an existing API integration script (`generate_ai_sprites.mjs`), and a working downstream consumption pattern (`heroConeSrc()` + `docs/assets/cones/{slug}.png`). The infrastructure for this migration is largely in place. The recommended path is to upgrade the existing pipeline to `gpt-image-1` with `background: 'transparent'`, run the full 94-flavor batch, post-process with sharp (already installed), and drop the outputs into the existing asset path with no calling-code changes required for the primary use case.

The single highest-risk element is visual consistency across 94 separately-generated images. AI generation is stochastic -- every call is a new roll. The current algorithmic renderer is perfectly deterministic and produces zero visual drift. Replacing it with AI art introduces real risk of inconsistency that would be worse than the status quo. The research-recommended mitigation is: generate all 94 in one session with a locked prompt template, do human curation review in the existing sprite-preview.html interface, enforce size normalization via sharp post-processing, and set a hard gate of 94/94 approved before deploying any new PNGs. Partial migration -- mixing AI art with algorithmic cones -- is explicitly an anti-pattern and should not happen.

The architecture of this migration is well-understood. The `heroConeSrc()` function is the universal integration seam: it resolves flavor name to `assets/cones/{slug}.png` path, and L5 PNGs are drop-in replacements at those same paths. Seven distinct rendering sites exist in the codebase, each must be addressed in a specific order driven by dependency analysis. Social card migration (Worker-side) is the most architecturally complex piece and may be deferred without blocking the main migration. The two-tier model -- L0 micro SVG for tiny contexts (Tidbyt, map popups), L5 AI PNG for everything else -- is the correct end state and aligns with existing code patterns.

## Key Findings

### Recommended Stack

The existing `generate_ai_sprites.mjs` pipeline already targets `gpt-image-1` via `--model` flag and handles rate limiting. The only required changes are adding `background: 'transparent'`, `quality: 'medium'`, and `output_format: 'png'` to the API request body. No new packages needed. DALL-E 3 is deprecated May 12, 2026 -- migration to `gpt-image-1` is mandatory regardless of this project. Full batch cost at medium quality: approximately $3.76 (94 images at $0.04 each). With 2-3 candidates per flavor and a 30% reject rate, total generation cost is $20-55. All image post-processing uses sharp (already installed in `worker/node_modules`). A new `scripts/process-ai-cones.mjs` script handles trim + resize to 144x168 with nearest-neighbor kernel.

**Core technologies:**
- `gpt-image-1` (medium quality): Primary generation model -- best prompt adherence for pixel art among cloud APIs, native transparent background support, already integrated in existing pipeline
- `sharp` (existing): Post-processing resize/trim -- nearest-neighbor kernel preserves pixel art grid, already installed
- `pngjs` + `pixelmatch` (existing): Quality control and visual regression between generation runs -- already installed

**What NOT to add:** Local SD/ComfyUI (no GPU), PixelLab (game-sprite oriented, opaque pricing), rembg (unnecessary with native transparency), OpenAI SDK (existing raw fetch approach is sufficient), multiple AI providers (guarantees style inconsistency).

### Expected Features

**Must have (table stakes) -- required for migration to be considered complete:**
- Prompt generation for all 94 flavors -- already 90% done via `generate_masterlock_prompts.mjs`
- AI image generation for all 94 flavors -- core deliverable, ~$20-55 total cost
- Background transparency -- native via `background: 'transparent'` API param
- Size normalization to 144x168 -- sharp post-processing with nearest-neighbor kernel
- Drop-in replacement of `docs/assets/cones/*.png` -- same slug naming, same paths, no client code changes
- Human QA review of all 94 -- the bottleneck step, budget 30% reject rate requiring re-generation
- Service worker cache version bump -- `custard-v20` to `custard-v21`
- Dead renderer removal -- `renderConeHDSVG`, `renderConeHeroSVG`, `renderConePremiumSVG` from `flavor-colors.js` and client-side equivalents
- `flavor-audit.html` update -- reflect two-tier reality (L0 SVG + L5 PNG), remove 4 dead tiers
- Golden baseline regeneration -- 376+ pixelmatch tests need new baseline snapshots

**Should have (differentiators that add significant value):**
- Premium treatment overrides for complex flavors -- currently only blackberry-cobbler has one; extending to flavors with `density: explosion` and multi-topping profiles produces dramatically better AI output
- Batch generation script with API integration and generation manifest -- enables reproducible re-generation and locks prompt versions per flavor
- Candidate gallery HTML for curation -- side-by-side accept/reject, extends existing `blackberry-asset-preview.html` pattern

**Defer:**
- Social card migration to PNG -- Worker-side change, marked out of scope in PROJECT.md; social cards will keep HD SVG cones while site shows AI PNGs; acceptable inconsistency for this milestone
- Premium treatment overrides for all 94 -- start with blackberry-cobbler model, add overrides only for flavors that generate poorly
- WebP output format -- marginal gains, adds `heroConeSrc()` complexity

### Architecture Approach

The migration targets 7 rendering sites. The integration seam is `heroConeSrc()` in `docs/cone-renderer.js`, which already returns `assets/cones/{slug}.png` paths. L5 PNGs are drop-in replacements at those same paths -- zero calling-code changes for the primary (Today page) use case. The architecture settles into a clean two-tier model: L0 micro SVG (9x11 pixel grid, runtime algorithmic, `renderMiniConeSVG()`) for tiny contexts, L5 AI PNGs (pre-generated, static, served via GitHub Pages) for everything larger. Starlark/Tidbyt and all small inline icons remain on L0 permanently -- no external assets in Starlark, no way to use PNGs at 64x32 LED resolution. Migration follows a dependency-ordered phase structure: generate PNGs first, then swap client-side fallback chain, then update quiz engine and audit page, then clean up dead renderers.

**Major components:**
1. `generate_ai_sprites.mjs` (upgraded) + `process-ai-cones.mjs` (new) -- generation and post-processing pipeline; produces final 144x168 transparent PNGs
2. `docs/cone-renderer.js` (modified) -- `heroConeSrc()` stays unchanged; `renderHeroCone()` fallback changes from HD SVG to L0 SVG; `renderMiniConeHDSVG()` and supporting utilities removed
3. `worker/src/flavor-colors.js` (modified) -- removes `renderConeHDSVG`, `renderConeHeroSVG`, `renderConePremiumSVG` and all supporting HD/Premium/Hero code; keeps `FLAVOR_PROFILES`, color constants, `renderConeSVG()` (L0)
4. `docs/assets/cones/*.png` (replaced) -- 94 AI-generated PNGs replacing 94 algorithmic PNGs at identical paths

### Critical Pitfalls

1. **Style drift across 94 generated images** -- Generate ALL 94 in a single session with identical model and prompt template. Never split across days or model versions. Post-process all through the same sharp pipeline to enforce consistent dimensions. Human grid-review in sprite-preview.html before committing anything.

2. **Partial migration creating two incompatible visual styles** -- Hard gate: all 94/94 images must pass QA before deploying any. The existing algorithmic cones and new L5 AI PNGs are visually incompatible styles. Zero partial deploys. The existing `png-asset-count.test.js` enforces 94-file count.

3. **Deterministic reproducibility lost** -- Treat generated PNGs as PRIMARY ARTIFACTS, not derived outputs. Check them into git. Store a generation manifest (model, prompt, seed, parameters, timestamp) per flavor alongside every PNG. If a single flavor needs regeneration, generate 10+ variants and pick the closest match to the existing set.

4. **Cache invalidation failure leaves users on stale art** -- Bump `CACHE_VERSION` in `sw.js` (v20 to v21) in the SAME commit that deploys new PNGs. Test the upgrade path on a returning browser profile. Multiple cache layers (SW, browser HTTP, Fastly CDN) all need to be considered.

5. **Social card SVG embedding blocks full renderer removal** -- `social-card.js` embeds inline SVG cones via `renderConeHDSVG()`. Migration requires either pre-encoding L5 PNGs as base64 in KV (Option A, recommended) or keeping the old SVG renderer alive solely for social cards (Option B, defeats the cleanup goal). Decide early -- this determines whether dead renderer removal is complete or partial.

## Implications for Roadmap

Based on research, the dependency graph is clear: generation must complete before any code integration begins. Code integration phases can proceed in parallel after Phase 1. Cleanup is last.

### Phase 1: Generate and Curate L5 PNGs

**Rationale:** All downstream phases depend on having the final 94 PNGs at `docs/assets/cones/{slug}.png`. No code integration should begin until generation is complete and QA-approved. Mixing in-progress AI PNGs with the existing algorithmic PNGs is the worst possible outcome (style inconsistency across the catalog).

**Delivers:** 94 AI-generated, normalized, human-approved cone PNGs at 144x168px with transparent backgrounds. Generation manifest JSON committed alongside images.

**Addresses:** Prompt generation (all 94), AI image generation, background transparency, size normalization, human QA review

**Avoids:** Style drift (single-session generation, locked template), partial migration (94/94 gate), reproducibility loss (generation manifest required before starting)

**Key tasks:**
- Upgrade `generate_ai_sprites.mjs` with `gpt-image-1` params (`background: 'transparent'`, `quality: 'medium'`, `output_format: 'png'`)
- Write `scripts/process-ai-cones.mjs` for sharp trim+resize post-processing
- Generate all 94 flavors (estimate 20 min at Tier 1 rate limit)
- Visual review in sprite-preview.html, re-run outliers
- Commit PNGs + generation manifest as primary artifacts

**Research flag:** Standard patterns -- generation workflow is well-documented. No additional research phase needed.

---

### Phase 2: Client-Side Renderer Swap

**Rationale:** Once L5 PNGs exist at expected paths, client-side code changes are straightforward. The `heroConeSrc()` integration seam means the Today page hero cone works automatically. Quiz engine and audit page need explicit updates.

**Delivers:** All 7 rendering sites consuming L5 PNGs. `renderHeroCone()` falls back to L0 SVG instead of HD SVG. Dead intermediate renderers removed from `cone-renderer.js`.

**Addresses:** Client-side fallback chain update, quiz engine migration, audit page update, dead `renderMiniConeHDSVG()` removal

**Avoids:** Dead code accumulation ("keeping dead renderers just in case" is explicitly identified as an anti-pattern in the architecture research)

**Key tasks:**
- Modify `renderHeroCone()` fallback: HD SVG to L0 mini SVG
- Remove `renderMiniConeHDSVG()` and supporting utilities from `cone-renderer.js`
- Update `docs/quizzes/engine.js` to use `renderHeroCone()` instead of `renderMiniConeHDSVG()`
- Update `docs/masterlock-audit.html` to show L0 + L5 only

**Research flag:** Standard patterns. No additional research needed.

---

### Phase 3: Service Worker and Baseline Updates

**Rationale:** Cache invalidation must be handled atomically with the PNG deploy. Golden baselines become stale the moment new PNGs land. Both are mechanical steps with clear success criteria.

**Delivers:** Returning users receive new art. Test suite passes with new baselines.

**Addresses:** SW cache version bump (v20 to v21), golden baseline regeneration (376+ pixelmatch tests)

**Avoids:** Cache staleness leaving users on stale art -- bump in same commit as PNG deploy

**Key tasks:**
- Bump `CACHE_VERSION` in `docs/sw.js` in same commit as PNG deploy
- Run `cd worker && npm run bless:cones` to regenerate golden baselines
- Verify returning-user upgrade path with a real browser profile (not incognito)

**Research flag:** Standard patterns. No additional research needed.

---

### Phase 4: Worker Dead Renderer Cleanup

**Rationale:** Worker-side cleanup (removing `renderConeHDSVG`, `renderConeHeroSVG`, `renderConePremiumSVG` from `flavor-colors.js`) depends on resolving the social card dependency first. If social cards are migrated to KV-based PNG embed (Option A), full cleanup is possible. If deferred, the HD renderer stays alive and the dead code removal is incomplete.

**Delivers:** Worker codebase free of dead SVG renderers. Estimated 700+ lines removed. Worker test suite updated.

**Addresses:** `renderConeHDSVG` removal, `renderConeHeroSVG` removal, `renderConePremiumSVG` removal, all supporting HD/Premium/Hero scoop-row arrays and utility functions

**Avoids:** Dead renderers staying in the Worker codebase under the guise of "only social cards use it"

**Key tasks:**
- Decision point: migrate social cards to KV PNG embed (Option A) or defer and keep HD SVG renderer
- If Option A: write KV upload script for base64-encoded L5 PNGs, modify `social-card.js` to use `renderConeImage()` async lookup
- Remove dead functions from `flavor-colors.js`
- Update worker test suites (remove HD/Premium/Hero test suites, keep L0 tests)
- Verify `/api/v1/flavor-colors` endpoint still works; `cd worker && npm test` passes

**Research flag:** Social card KV embed approach needs validation. Specifically: (a) whether `<image href="data:image/png;base64,..."/>` in SVG renders correctly on Facebook/Twitter/LinkedIn OG scrapers, and (b) Worker KV read latency in the social card hot path. Recommend a proof-of-concept before planning this phase in full detail.

---

### Phase 5: Scriptable Widget Unification

**Rationale:** The Scriptable widget (`custard-today.js`) has an independent renderer (`drawConeIcon()`) with its own 15-color map that has drifted from the canonical 23-color system. This is independent of all other phases and can be done last as a polish step.

**Delivers:** Scriptable widget loads L5 PNGs via URL (online) with aligned-color L0 fallback (offline). Color drift between widget and canonical system eliminated.

**Addresses:** `drawConeIcon()` unification, `FLAVOR_SCOOP_COLORS` alignment to canonical `BASE_COLORS`

**Avoids:** Different slug conventions per consumer (slug inconsistency between consumers is an identified architecture anti-pattern)

**Key tasks:**
- Add `loadConeImage(slug)` async function using `Image.fromURL()` (Scriptable API)
- Update widget build functions to use loaded PNG images
- Align `FLAVOR_SCOOP_COLORS` to canonical 23-entry `BASE_COLORS`
- Mirror changes in `widgets/custard-today.js` (two copies exist)
- Test: online shows L5 PNG, airplane mode shows L0 fallback

**Research flag:** Standard patterns. Scriptable `Image.fromURL()` is well-documented.

---

### Phase Ordering Rationale

- Phase 1 blocks all other phases. No integration work should begin until all 94 PNGs exist and pass QA. This is a strict sequential dependency.
- Phases 2, 3, and 4 can run in parallel after Phase 1 completes -- they touch different files (`cone-renderer.js`, `sw.js`, `flavor-colors.js`) and have no cross-dependencies.
- Phase 5 is fully independent and can be done at any point after Phase 1.
- The hard 94/94 gate prevents partial migration, which is identified as the most damaging failure mode for user experience.
- Social card migration (Phase 4) is the only phase with architectural uncertainty. It should be prototyped early to unblock the full dead-renderer removal decision.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Social card KV embed):** Need to confirm (a) base64 PNG inside SVG `<image>` renders correctly on major social scrapers, and (b) Worker KV latency for base64 cone lookup is acceptable in the social card hot path. Small prototype recommended before committing to implementation plan.

Phases with standard patterns (no additional research needed):
- **Phase 1:** gpt-image-1 API is well-documented. Existing pipeline already handles most cases. Cost and rate limits confirmed. Proof-of-concept validates the approach.
- **Phase 2:** Cone-renderer.js refactoring follows clear patterns from ARCHITECTURE.md. All 7 rendering sites are mapped and inventoried.
- **Phase 3:** SW cache bump and pixelmatch baseline regeneration are mechanical, fully documented in existing scripts.
- **Phase 5:** Scriptable widget unification is isolated and well-understood.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | gpt-image-1 parameters confirmed via official OpenAI docs. sharp pipeline patterns confirmed via existing codebase. No new dependencies required. DALL-E 3 deprecation date confirmed. Cost estimates based on confirmed pricing. |
| Features | HIGH | Full codebase inspection. 94 FLAVOR_PROFILES counted. All 7 rendering sites mapped. Proof-of-concept (blackberry-cobbler) exists and validates the quality target. Critical path identified with dependencies. |
| Architecture | HIGH | All 7 rendering sites inspected directly. Data flow traced end-to-end. Dependency graph is clear. Integration seam (`heroConeSrc()`) confirmed. Two copies of Scriptable widget confirmed. Social card dependency identified. |
| Pitfalls | MEDIUM | Integration and caching pitfalls are HIGH confidence (verified against codebase with line numbers). AI generation consistency pitfalls are MEDIUM confidence -- model-specific behavior varies and exact consistency at 94-image scale is empirically unknown for this prompt template until the first full batch run. |

**Overall confidence:** MEDIUM-HIGH

The stack, features, and architecture are well-understood based on direct codebase inspection. The empirical unknown is AI generation quality and consistency at scale. The mitigation strategy (single-session generation, locked template, human QA) is sound, but the outcome cannot be guaranteed without running the batch. Budget for 1-2 regeneration iterations.

### Gaps to Address

- **AI generation quality at 94-flavor scale:** The blackberry-cobbler proof-of-concept validates the approach but one image is not a batch. The first full batch run will reveal actual consistency characteristics. If style drift is severe, the session-level constraints (same model, same template, same timing) are the primary lever.
- **Social card SVG-with-embedded-PNG scrapability:** Whether Facebook/Twitter/LinkedIn scrapers render `<image href="data:image/png;base64,..."/>` inside SVG is a known open question. External URL references inside SVG are confirmed broken on most platforms, but base64 embedding is less documented. Needs real-world validation before Phase 4 planning.
- **Target PNG dimensions:** Research documents 144x168 as the existing convention for drop-in compatibility. If AI generation quality warrants a higher base resolution (288x336 at 2x for retina), it requires updating CSS, golden baselines, and the post-processing script. Document the dimension decision before generating the first image.
- **File size budget per PNG:** Research recommends 10KB max per PNG (keeping total under 1MB). Until actual AI-generated pixel art is post-processed and measured, this is an estimate. Enforce measurement after the first batch run and apply pngquant if needed.

## Sources

### Primary (HIGH confidence)
- `tools/generate_ai_sprites.mjs` -- existing AI pipeline, `--model gpt-image-1` support confirmed
- `docs/assets/masterlock-flavor-fills.json` -- 94 flavor fill cards with ingredient treatments
- `docs/assets/blackberry-cobbler/blackberry-l5-premium.png` -- quality target reference
- `worker/src/flavor-colors.js` -- 94 FLAVOR_PROFILES, 4 SVG renderers confirmed
- `docs/cone-renderer.js` -- `heroConeSrc()` integration seam, `renderHeroCone()` fallback chain
- `worker/src/social-card.js` -- `renderConeGroup()` SVG embedding dependency
- `docs/sw.js` -- `CACHE_VERSION = 'custard-v20'`, stale-while-revalidate cone caching confirmed
- `docs/assets/custard-today.js` -- independent `drawConeIcon()` with 15-color `FLAVOR_SCOOP_COLORS` confirmed
- `tidbyt/culvers_fotd.star` -- Starlark constraint (no external assets) confirmed
- `scripts/generate-hero-cones.mjs` -- current sharp pipeline at 300 DPI, 144x168 nearest-neighbor
- [OpenAI Image Generation API](https://platform.openai.com/docs/guides/image-generation) -- gpt-image-1 params, transparent background, quality tiers
- [OpenAI Pricing](https://platform.openai.com/docs/pricing) -- $0.04/image medium quality confirmed
- [sharp Resize API](https://sharp.pixelplumbing.com/api-resize/) -- `kernel: 'nearest'` for pixel art
- [GitHub Storage Limits](https://gitprotect.io/blog/github-storage-limits/) -- 1GB repo recommendation, LFS incompatibility with GitHub Pages

### Secondary (MEDIUM confidence)
- [OpenAI Cookbook: Generate images with GPT Image](https://developers.openai.com/cookbook/examples/generate_images_with_gpt_image/) -- Node.js examples, transparent background usage
- [Retro Diffusion: Pixel art with AI at scale](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale) -- palette enforcement and downscaling algorithms
- [AI Image Generation API Comparison 2026](https://blog.laozhang.ai/en/posts/ai-image-generation-api-comparison-2026) -- provider landscape, gpt-image-1 positioning
- [og:image SVG not supported by Facebook](https://github.com/BreakOutEvent/breakout-frontend/issues/234) -- SVG OG image scrapability failure modes
- [Generative AI in Game Asset Production 2026](https://www.gianty.com/generative-ai-in-game-asset-production-in-2026/) -- batch asset quality control patterns

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*

# Architecture Patterns

**Domain:** Two-tier cone art pipeline migration (L0 micro SVG + L5 AI PNGs)
**Researched:** 2026-03-18
**Confidence:** HIGH (all 7 rendering sites inspected, data flow traced end-to-end)

## Current Architecture: 7 Cone Rendering Sites

The codebase has 7 distinct places where cone art is rendered. Each uses a different renderer at a different fidelity tier. The migration must address every one of them.

### Rendering Site Inventory

| # | Site | File(s) | Current Renderer | Pixel Grid | Output | Display Context |
|---|------|---------|------------------|------------|--------|-----------------|
| 1 | Today hero cone | `docs/today-page.js:368,376` | `renderHeroCone()` -> PNG with HD SVG fallback | 144x168 PNG (from 36x42 grid @ scale 4) | `<img>` tag | Today page, above the fold, ~120px wide |
| 2 | Today/Compare/Map mini cones | `docs/today-page.js:228,434,444,520`, `docs/compare-page.js:776`, `docs/map.html:333` | `renderMiniConeSVG()` | 9x11 grid | Inline SVG | Small icons in lists, cards, map popups |
| 3 | Quiz result/nearest cones | `docs/quizzes/engine.js:1022,1129,1153,1181` | `renderMiniConeHDSVG()` + `renderMiniConeSVG()` fallback | 18x22 or 9x11 | Inline SVG | Quiz result display, nearest-store badges |
| 4 | Social cards (Worker) | `worker/src/social-card.js:315` | `renderConeHDSVG()` via `renderConeGroup()` | 18x21 grid | Embedded SVG rects in 1200x630 SVG | OG image social cards (store/date, page, trivia) |
| 5 | Scriptable widget (iOS) | `docs/assets/custard-today.js:70` | `drawConeIcon()` (independent DrawContext renderer) | ~28x28 vector circles+paths | Raster Image via DrawContext | iOS home screen widget (small/medium) |
| 6 | Tidbyt display | `tidbyt/culvers_fotd.star` | `create_mini_cone()` + `create_ice_cream_icon()` | 9x11 (mini) / 16x18 (single) | Starlark render primitives | 64x32 LED pixel display |
| 7 | Flavor audit page | `docs/masterlock-audit.html:178-184` | `renderMiniConeSVG()` + `renderMiniConeHDSVG()` | 9x11 / 18x22 | Inline SVG | Internal audit tool |

### Existing Renderer Functions (by location)

**Client-side (`docs/cone-renderer.js`):**
- `renderMiniConeSVG(flavorName, scale)` -- L0 tier, 9x11 pixel grid
- `renderMiniConeHDSVG(flavorName, scale)` -- L2 tier, 18x22 pixel grid (REMOVE)
- `heroConeSrc(flavorName)` -- Returns `assets/cones/{slug}.png` path
- `renderHeroCone(flavorName, container, fallbackScale)` -- Tries PNG, falls back to HD SVG

**Worker-side (`worker/src/flavor-colors.js`):**
- `renderConeHDSVG(flavorName, scale)` -- 18x21 grid, used by social cards (REMOVE)
- `renderConePremiumSVG(flavorName, scale)` -- 24x28 grid, texture hash + shadow (REMOVE)
- `renderConeHeroSVG(flavorName, scale)` -- 36x42 grid, used by PNG pipeline (REMOVE)

**Scriptable (`docs/assets/custard-today.js`):**
- `drawConeIcon(flavorName, size)` -- Independent vector renderer, own color map (UNIFY)

**Starlark (`tidbyt/culvers_fotd.star`):**
- `create_mini_cone(profile)` -- L0 equivalent, 9x11 Starlark boxes (KEEP)
- `create_ice_cream_icon(profile)` -- Larger single-day view, 16x18 (KEEP)

## Recommended Architecture: Two-Tier Pipeline

### The Two Tiers

```
L0: Micro SVG (9x11 pixel grid)
    renderMiniConeSVG() -- client-side, inline SVG
    create_mini_cone() -- Starlark, Tidbyt display
    Purpose: Tiny inline icons (map popups, list items, compare rows)
    Size: 45x55px at scale=5, fits anywhere

L5: AI-Generated PNGs
    Pre-rendered at build time, served as static assets
    Purpose: Everything larger than a list icon
    Replaces: HD SVG, Premium SVG, Hero SVG, Hero PNGs, drawConeIcon
```

### Component Boundaries After Migration

```
                    FLAVOR_PROFILES (94 entries + 37 aliases)
                    Source of truth: worker/src/flavor-colors.js
                              |
           +------------------+-------------------+
           |                                      |
     L0 Micro SVG                          L5 AI PNGs
     (runtime, algorithmic)                (build-time, static)
           |                                      |
     +-----+-----+                    +-----------+-----------+
     |           |                    |           |           |
  Client     Starlark             Client      Worker      Scriptable
  cone-      culvers_           heroConeSrc  social-card  custard-today
  renderer   fotd.star                        .js          .js
  .js                                  |
     |           |                    docs/assets/cones/*.png
  map popups  Tidbyt LED              (94 files, ~15-50KB each)
  list icons  64x32 display                   |
  compare                          +----------+----------+
  rows                             |          |          |
                                Today      Quiz       Social
                                hero     results     cards*
                                cone

  * Social cards switch from inline SVG to PNG <image> embed
```

### What Survives, What Dies, What Changes

| Component | Action | Rationale |
|-----------|--------|-----------|
| `renderMiniConeSVG()` in `cone-renderer.js` | **KEEP** | L0 tier. Used by 4 pages for tiny icons. No replacement needed. |
| `renderMiniConeHDSVG()` in `cone-renderer.js` | **REMOVE** | Dead intermediate tier. Was HD SVG fallback; L5 PNGs replace it. Quiz engine switches to L5 PNG or L0 mini. |
| `heroConeSrc()` in `cone-renderer.js` | **KEEP + MODIFY** | Already returns PNG path. Will now point to L5 PNGs instead of algorithmic PNGs. Same slug convention, same path structure. |
| `renderHeroCone()` in `cone-renderer.js` | **MODIFY** | Keep PNG-first behavior. Change fallback from `renderMiniConeHDSVG()` to `renderMiniConeSVG()` (L0). |
| `renderConeHDSVG()` in `flavor-colors.js` | **REMOVE** | Was used only by social-card.js. Social cards switch to L5 PNG embed. |
| `renderConePremiumSVG()` in `flavor-colors.js` | **REMOVE** | Premium tier never used in production. Out of scope per PROJECT.md. |
| `renderConeHeroSVG()` in `flavor-colors.js` | **REMOVE** | Was used by `generate-hero-cones.mjs` pipeline. L5 PNGs replace the pipeline entirely. |
| `drawConeIcon()` in `custard-today.js` | **REMOVE + UNIFY** | Replace with L5 PNG loaded via URL, or L0 mini SVG rendered to DrawContext. |
| `create_mini_cone()` in `culvers_fotd.star` | **KEEP** | Starlark renderer for 64x32 Tidbyt LED. Cannot use PNGs (no HTTP in Starlark renderer). Already L0 equivalent. |
| `create_ice_cream_icon()` in `culvers_fotd.star` | **KEEP** | Larger single-day Tidbyt view. Same constraint -- no external assets in Starlark. |
| `generate-hero-cones.mjs` | **REMOVE or REPURPOSE** | Current pipeline renders SVG -> PNG via sharp. L5 PNGs come from AI generation, not this pipeline. Might repurpose for size optimization/format conversion. |
| Color constants/FALLBACK_* in `cone-renderer.js` | **KEEP** | Still needed by L0 `renderMiniConeSVG()` and `getFlavorBaseColor()` for card backgrounds. |
| `resolveHDToppingSlots()` in `cone-renderer.js` | **REMOVE** | Only used by `renderMiniConeHDSVG()`. |
| `resolveHDScatterToppingList()` in `cone-renderer.js` | **REMOVE** | Only used by `renderMiniConeHDSVG()`. |
| PRNG utilities (`_mulberry32`, `darkenHex`) in `cone-renderer.js` | **REMOVE** | Only used by HD scatter renderer. |

### Data Flow: L5 PNG Integration

**Before (current):**
```
FLAVOR_PROFILES -> renderConeHeroSVG(name, 4) -> SVG string
  -> sharp(svgBuffer, {density:300}) -> resize 144x168 nearest
  -> docs/assets/cones/{slug}.png (144x168 native, served via GitHub Pages)
  -> heroConeSrc(name) returns path -> <img src="assets/cones/slug.png">
  -> onerror fallback: renderMiniConeHDSVG() inline SVG
```

**After (L5):**
```
AI image generation (external, build-time)
  -> L5 PNGs at target resolution (TBD, likely 256x or 512x)
  -> Optimize (optipng/pngquant or webp conversion)
  -> docs/assets/cones/{slug}.png (same path, same slug convention)
  -> heroConeSrc(name) returns path (UNCHANGED)
  -> <img src="assets/cones/slug.png"> (UNCHANGED)
  -> onerror fallback: renderMiniConeSVG() (downgraded from HD)
```

The critical insight: **`heroConeSrc()` is already the integration seam.** The slug convention (`flavor-name.replace(/[^a-z0-9]+/g, '-')`) is the contract. L5 PNGs just replace the files at the same paths. No calling code changes for the primary use case.

### Social Card Migration (Worker-Side)

This is the most significant architectural change because social cards currently generate SVG inline on the Worker.

**Before:**
```
social-card.js imports renderConeHDSVG from flavor-colors.js
  -> renderConeGroup(flavorName, x, y, scale)
  -> Extracts SVG rects, wraps in <g transform="translate(x,y)">
  -> Embeds as child elements inside 1200x630 SVG
```

**After (two options):**

**Option A: Embed PNG via `<image>` in SVG (RECOMMENDED)**
```
social-card.js loads L5 PNG as base64 data URI
  -> <image href="data:image/png;base64,..." x="70" y="160" width="120" height="140"/>
  -> Embedded directly in the 1200x630 SVG response
  -> Requires: Worker KV storing base64-encoded L5 PNGs, or Worker R2 bucket
```

**Option B: Keep algorithmic cone for social cards only**
```
Keep renderConeHDSVG() alive solely for social-card.js
  -> Means the HD renderer stays in the Worker codebase
  -> Defeats the purpose of the migration (dead code stays alive)
```

Option A is correct. The Worker already has KV access. During L5 PNG generation, store base64-encoded versions in KV keyed by flavor slug. Social cards fetch from KV and embed. This fully eliminates the algorithmic renderers from the Worker.

**Implementation for Option A:**
```javascript
// social-card.js (modified)
async function renderConeImage(flavorName, env, x, y, width, height) {
  const slug = flavorSlug(flavorName);
  const key = `cone-png:${slug}`;
  const base64 = await env.KV.get(key);
  if (!base64) return ''; // Graceful degradation: no cone
  return `<image href="data:image/png;base64,${base64}" x="${x}" y="${y}" width="${width}" height="${height}" image-rendering="pixelated"/>`;
}
```

### Scriptable Widget Unification

The Scriptable widget (`custard-today.js`) has its own independent cone renderer (`drawConeIcon()`) with:
- Its own color map (`FLAVOR_SCOOP_COLORS` -- 15 colors vs 23 base + 33 toppings in the canonical system)
- Its own keyword-matching logic (simpler than `normalizeFlavorKey()`)
- No topping/ribbon rendering (just a colored circle for the scoop)
- DrawContext-based (Scriptable API, not DOM)

**Unification approach:**

The Scriptable widget runs on iOS via Scriptable.app, which supports `Image.fromURL()`. Two options:

**Option A: Load L5 PNG via URL (RECOMMENDED for medium widget)**
```javascript
// In custard-today.js, replace drawConeIcon() calls:
async function loadConeImage(flavorName) {
  var slug = flavorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  var url = "https://custard.chriskaschner.com/assets/cones/" + slug + ".png";
  try {
    var req = new Request(url);
    return await req.loadImage();
  } catch(e) {
    return drawConeIcon(flavorName, 28); // Fallback to local renderer
  }
}
```

**Option B: Keep drawConeIcon as lightweight L0 fallback**
Scriptable widgets need to work offline. Keep `drawConeIcon()` but align its color map to the canonical system. This becomes the Scriptable-native L0.

**Recommendation:** Use Option A for online rendering with Option B as offline fallback. The Scriptable widget already makes API calls (`fetchToday()`, `fetchFlavors()`) so it requires network anyway. The image URL is just one more request. Keep `drawConeIcon()` but update its color map to match `BASE_COLORS` from the canonical system (eliminates color drift).

### Service Worker Caching Strategy

The service worker (`docs/sw.js`) already handles cone PNGs with stale-while-revalidate:

```javascript
// Lines 66-79 of sw.js -- already handles /assets/cones/*.png
if (url.pathname.includes('/assets/cones/') && url.pathname.endsWith('.png')) {
  // Stale-while-revalidate: serve cached, fetch update in background
}
```

**Changes needed:**

1. **Cache version bump**: `custard-v20` -> `custard-v21` to force re-download of all cone PNGs when L5 replaces algorithmic PNGs.

2. **File size consideration**: Current algorithmic PNGs are 144x168 pixels (~2-5KB each, 94 files = ~300KB total). L5 AI PNGs will be larger. At 256x256, expect ~15-50KB each (optimized PNG), totaling ~1.5-5MB for 94 flavors. At 512x512, expect ~30-100KB each, totaling ~3-10MB.

3. **Pre-caching decision**: Currently, cone PNGs are NOT pre-cached (runtime cache only). With larger L5 PNGs, this is correct -- pre-caching 94 large PNGs would bloat install. Keep runtime stale-while-revalidate.

4. **WebP consideration**: If L5 PNGs are large, consider generating both `.png` and `.webp` variants. `heroConeSrc()` could check `image/webp` support and return the appropriate extension. However, this adds complexity for marginal gains on a 94-file corpus.

**Recommendation:** Keep current SW caching strategy. Bump cache version. Do NOT pre-cache. Monitor total asset size after L5 generation and optimize if > 5MB total.

## Patterns to Follow

### Pattern 1: heroConeSrc as the Universal Integration Seam

**What:** All L5 PNG consumers go through `heroConeSrc(flavorName)` to resolve the asset path. This function handles normalization, alias resolution, and slug generation.

**When:** Any time a component needs to display an L5 cone.

**Why:** Single point of control for path resolution. Alias changes propagate everywhere. Slug format is tested (worker/test/png-asset-count.test.js).

```javascript
// This pattern already works for Today page hero cones:
function renderHeroCone(flavorName, container, fallbackScale) {
  var src = heroConeSrc(flavorName);
  if (!src) {
    container.innerHTML = renderMiniConeSVG(flavorName, fallbackScale || 6);
    return;
  }
  var img = new Image();
  img.src = src;
  img.onerror = function() {
    container.innerHTML = renderMiniConeSVG(flavorName, fallbackScale || 6);
  };
  container.innerHTML = '';
  container.appendChild(img);
}

// Extend this pattern to quiz results:
// engine.js line 1022 changes from:
//   els.resultCone.innerHTML = window.renderMiniConeHDSVG(displayFlavor, 5);
// to:
//   window.renderHeroCone(displayFlavor, els.resultCone, 5);
```

### Pattern 2: Graceful Degradation Chain

**What:** L5 PNG -> L0 SVG -> nothing. Never crash on missing art.

**When:** Every rendering site.

**Why:** Unknown/new flavors won't have L5 PNGs. Network failures happen. The `onerror` handler in `renderHeroCone()` already demonstrates this pattern.

```
L5 attempt: <img src="assets/cones/slug.png">
  onerror -> L0 fallback: renderMiniConeSVG(flavor, scale)
    empty -> no visual (graceful empty state)
```

### Pattern 3: Slug as Primary Key

**What:** The flavor slug (`flavor-name` from `normalizeFlavorKey() + regex`) is the primary key for PNG lookup, KV storage, and asset paths.

**When:** PNG generation, asset serving, KV cone storage for social cards.

**Why:** Already established convention. Tests verify slug generation matches between `heroConeSrc()` and `generate-hero-cones.mjs`. Aliases resolve before slugging.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Keeping Dead Renderers "Just in Case"

**What:** Leaving `renderMiniConeHDSVG()`, `renderConeHDSVG()`, `renderConePremiumSVG()`, `renderConeHeroSVG()` in the codebase after migration.

**Why bad:** 700+ lines of dead code across two files. Tests for dead renderers inflate test count. Color constants stay coupled. Future contributors will be confused about which renderer to use.

**Instead:** Remove functions, remove their tests, remove supporting utilities (`resolveHDToppingSlots`, `resolveHDScatterToppingList`, HD PRNG code). Do this AFTER L5 PNGs are verified at all 7 rendering sites.

### Anti-Pattern 2: Different PNG Conventions per Consumer

**What:** Social cards using one slug format, client-side using another, Scriptable using a third.

**Why bad:** Alias resolution diverges. New flavors require updates in multiple places.

**Instead:** All PNG references go through the same slug function. Social cards use the same slug as `heroConeSrc()`. Scriptable uses the same slug. One function, one convention.

### Anti-Pattern 3: Pre-caching All L5 PNGs in Service Worker

**What:** Adding all 94 L5 PNGs to the `STATIC_ASSETS` array.

**Why bad:** 94 files at ~15-50KB each = 1.5-5MB forced download on first visit. Users may only ever view 3-5 flavors. Massive install time, wasted bandwidth.

**Instead:** Keep runtime stale-while-revalidate. PNGs cache on first view. The SW already does this correctly.

## Migration Build Order

The build order is driven by dependency analysis: what blocks what.

### Phase 1: Generate L5 PNGs (no code changes)

**Goal:** Create the 94 L5 AI-generated PNGs and place them at `docs/assets/cones/{slug}.png`.

**Depends on:** Nothing. Can start immediately.

**Produces:** 94 PNG files at `docs/assets/cones/`, replacing existing algorithmic PNGs.

**Verification:** Visual comparison of old vs new PNGs. Size check. Slug coverage check (all 94 FLAVOR_PROFILES have a PNG).

**Risk:** AI image generation quality/consistency. This is the creative bottleneck, not a technical one.

### Phase 2: Client-side renderer swap (cone-renderer.js)

**Goal:** Remove HD SVG fallback path, simplify renderHeroCone to use L0 fallback.

**Depends on:** Phase 1 (L5 PNGs must exist at the expected paths).

**Changes:**
1. `renderHeroCone()`: Change fallback from `renderMiniConeHDSVG()` to `renderMiniConeSVG()`
2. Remove `renderMiniConeHDSVG()` function
3. Remove `resolveHDToppingSlots()`, `resolveHDScatterToppingList()`, `_mulberry32()`, `darkenHex()`
4. Remove HD-only shape/PRNG code
5. Keep: `renderMiniConeSVG()`, `heroConeSrc()`, `renderHeroCone()`, all color constants, `normalizeFlavorKey()`, `getFlavorProfileLocal()`, `getFlavorBaseColor()`, `resolveToppingSlots()`, `lightenHex()`, `FALLBACK_FLAVOR_ALIASES`

**Verification:** Today page shows L5 PNGs. Force a 404 on one PNG and verify L0 SVG fallback renders.

### Phase 3: Quiz engine migration (engine.js)

**Goal:** Switch quiz result cones from HD SVG to L5 PNG.

**Depends on:** Phase 2 (renderHeroCone available, renderMiniConeHDSVG removed).

**Changes:**
1. `engine.js:1021-1024`: Replace `renderMiniConeHDSVG()` call with `renderHeroCone()` targeting the result cone container
2. Keep `renderMiniConeSVG()` calls for small nearest-store badges (L0 is correct for those tiny sizes)

**Verification:** Quiz results show L5 PNG cones. Nearest-store badges still show L0 mini cones.

### Phase 4: Social card migration (Worker-side)

**Goal:** Switch social cards from inline SVG cones to embedded L5 PNGs.

**Depends on:** Phase 1 (L5 PNGs exist). Independent of Phases 2-3.

**Changes:**
1. Upload base64-encoded L5 PNGs to Worker KV (keyed by `cone-png:{slug}`)
2. `social-card.js`: Replace `renderConeGroup()` with async `renderConeImage()` that fetches base64 from KV
3. `handleSocialCard()` is already async, so KV fetch fits naturally
4. Remove import of `renderConeHDSVG` from social-card.js

**Verification:** Social card SVGs render with embedded `<image>` tags. Visual comparison with old cards.

### Phase 5: Worker renderer cleanup (flavor-colors.js)

**Goal:** Remove dead SVG renderers from Worker code.

**Depends on:** Phase 4 (social cards no longer import renderers).

**Changes:**
1. Remove `renderConeHDSVG()`, `renderConePremiumSVG()`, `renderConeHeroSVG()`
2. Remove supporting constants: `_HD_SCOOP_ROWS`, `_PREM_SCOOP_ROWS`, `_HERO_SCOOP_ROWS`, `_HERO_CONE_ROWS`, all ribbon/topping/highlight/shadow slot arrays for those tiers
3. Remove supporting functions: `resolveHDScatterToppingList()`, `resolvePremiumToppingList()`, `resolveHeroToppingList()`
4. Remove `lightenHex()`, `darkenHex()`, `_mulberry32()` if no other consumers
5. Keep: `FLAVOR_PROFILES`, `BASE_COLORS`, `TOPPING_COLORS`, `RIBBON_COLORS`, `CONE_COLORS`, `FLAVOR_ALIASES`, `getFlavorProfile()`, `renderConeSVG()` (L0, 9x11 grid -- used by `/api/v1/flavor-colors` endpoint and tests), `normalize` utilities
6. Update worker tests: remove test suites for dead renderers, update golden-baselines.test.js

**Verification:** `cd worker && npm test` passes. API endpoint `/api/v1/flavor-colors` still works.

### Phase 6: Scriptable widget unification (custard-today.js)

**Goal:** Replace independent `drawConeIcon()` with L5 PNG loading + aligned fallback.

**Depends on:** Phase 1 (L5 PNGs at known URLs).

**Changes:**
1. Add `loadConeImage(slug)` async function that fetches PNG from custard.chriskaschner.com
2. Update `buildSmall()`, `buildMedium()`, `buildMultiStore()` to use loaded PNG images
3. Keep `drawConeIcon()` as offline fallback but update `FLAVOR_SCOOP_COLORS` to match canonical `BASE_COLORS` (23 entries instead of 15)
4. Mirror changes in `widgets/custard-today.js` (there are two copies)

**Verification:** Widget preview in Scriptable shows L5 cone images. Airplane mode shows fallback.

### Phase 7: Audit page + generate pipeline cleanup

**Goal:** Update flavor-audit.html, remove or repurpose generate-hero-cones.mjs.

**Depends on:** Phases 2, 5 (all renderers cleaned up).

**Changes:**
1. `masterlock-audit.html`: Remove `renderMiniConeHDSVG()` calls, use `renderMiniConeSVG()` + `<img>` for L5 PNG preview
2. `generate-hero-cones.mjs`: Remove or convert to an optimizer script (takes AI PNGs, runs pngquant/optipng)
3. Bump service worker cache version to `custard-v21`

**Verification:** Audit page renders. No references to removed functions in any JS file.

### Dependency Graph

```
Phase 1 (Generate L5 PNGs)
    |
    +---> Phase 2 (Client cone-renderer.js cleanup)
    |         |
    |         +---> Phase 3 (Quiz engine migration)
    |         |
    |         +---> Phase 7 (Audit page + pipeline cleanup)
    |
    +---> Phase 4 (Social card migration -- Worker)
    |         |
    |         +---> Phase 5 (Worker renderer cleanup)
    |
    +---> Phase 6 (Scriptable widget unification)
```

Phases 2, 4, and 6 can proceed in parallel once Phase 1 completes.

## New vs Modified vs Removed Components

| Action | Component | File | Notes |
|--------|-----------|------|-------|
| **KEEP** | `renderMiniConeSVG()` | `docs/cone-renderer.js` | L0 tier, used by 4+ pages |
| **KEEP** | `heroConeSrc()` | `docs/cone-renderer.js` | Integration seam, slug resolver |
| **MODIFY** | `renderHeroCone()` | `docs/cone-renderer.js` | Fallback changes from HD SVG to L0 SVG |
| **KEEP** | Color constants (FALLBACK_*) | `docs/cone-renderer.js` | Still needed by L0 renderer |
| **KEEP** | `normalizeFlavorKey()` | `docs/cone-renderer.js` | Used by heroConeSrc and L0 |
| **KEEP** | `resolveToppingSlots()` | `docs/cone-renderer.js` | Used by L0 renderer |
| **KEEP** | `FALLBACK_FLAVOR_ALIASES` | `docs/cone-renderer.js` | Used by heroConeSrc |
| **REMOVE** | `renderMiniConeHDSVG()` | `docs/cone-renderer.js` | Dead intermediate tier |
| **REMOVE** | `resolveHDToppingSlots()` | `docs/cone-renderer.js` | HD-only utility |
| **REMOVE** | `resolveHDScatterToppingList()` | `docs/cone-renderer.js` | HD-only utility |
| **REMOVE** | `_mulberry32()` | `docs/cone-renderer.js` | HD-only PRNG |
| **REMOVE** | `darkenHex()` | `docs/cone-renderer.js` | HD-only color utility |
| **REMOVE** | `_CANONICAL_TOPPING_SHAPES` | `docs/cone-renderer.js` | HD-only shape map |
| **REMOVE** | `_CANONICAL_SHAPE_MAP` | `docs/cone-renderer.js` | HD-only shape map |
| **MODIFY** | Quiz cone rendering | `docs/quizzes/engine.js` | Switch from HD SVG to `renderHeroCone()` |
| **MODIFY** | Audit page cones | `docs/masterlock-audit.html` | Remove HD SVG calls |
| **REMOVE** | `renderConeHDSVG()` | `worker/src/flavor-colors.js` | Replaced by L5 PNG embed |
| **REMOVE** | `renderConePremiumSVG()` | `worker/src/flavor-colors.js` | Never used in production |
| **REMOVE** | `renderConeHeroSVG()` | `worker/src/flavor-colors.js` | Replaced by L5 PNGs |
| **REMOVE** | All HD/Premium/Hero supporting code | `worker/src/flavor-colors.js` | Scoop rows, topping lists, ribbon paths, etc. |
| **KEEP** | `FLAVOR_PROFILES`, colors, `getFlavorProfile()` | `worker/src/flavor-colors.js` | Still used by API, L0 renderer |
| **MODIFY** | `renderConeGroup()` -> `renderConeImage()` | `worker/src/social-card.js` | Switch from SVG embed to PNG `<image>` embed |
| **MODIFY** | `drawConeIcon()` | `docs/assets/custard-today.js` | Add L5 PNG loading, align color map |
| **KEEP** | `create_mini_cone()` | `tidbyt/culvers_fotd.star` | L0 for Tidbyt, no external assets |
| **KEEP** | `create_ice_cream_icon()` | `tidbyt/culvers_fotd.star` | Larger Tidbyt view |
| **MODIFY** | Service worker | `docs/sw.js` | Cache version bump to v21 |
| **REMOVE/REPURPOSE** | PNG generation pipeline | `scripts/generate-hero-cones.mjs` | No longer generates from SVG |
| **MODIFY** | Worker tests | `worker/test/flavor-colors.test.js` | Remove HD/Premium/Hero test suites |
| **MODIFY** | Golden baselines | `worker/test/golden-baselines.test.js` | Remove HD/Premium/Hero tiers, keep L0 |
| **ADD** | KV cone PNG upload script | New script | Uploads base64 L5 PNGs to Worker KV for social cards |
| **REPLACE** | 94 cone PNG files | `docs/assets/cones/*.png` | Replace algorithmic with L5 AI PNGs |

## Scalability Considerations

| Concern | Now (94 flavors) | At 200 flavors | At 500 flavors |
|---------|-------------------|----------------|----------------|
| PNG asset size | ~300KB total (algorithmic) | ~2-10MB (L5) | ~5-25MB (L5) |
| KV storage (social card base64) | 94 keys, ~500KB | 200 keys, ~1MB | 500 keys, ~2.5MB |
| Service worker cache | Runtime SWR, no issue | Same, no issue | Consider lazy-loading strategy |
| Generation time | Manual AI generation | Need batch workflow | Need automated pipeline |
| Slug collisions | None (94 tested) | Unlikely | Audit needed |

The main scalability concern is AI PNG generation at scale. At 94 flavors this is a one-time manual effort. Beyond 200, an automated pipeline (prompt templates + API) becomes necessary. The serving architecture (static PNGs on GitHub Pages, KV for social cards) scales indefinitely.

## Sources

- `docs/cone-renderer.js` -- Client-side renderer, all 4 functions inspected
- `worker/src/flavor-colors.js` -- Worker-side renderer, 3 SVG functions + profile system
- `worker/src/social-card.js` -- Social card generation, cone embedding pattern
- `docs/assets/custard-today.js` -- Scriptable widget independent renderer
- `tidbyt/culvers_fotd.star` -- Starlark pixel renderer (cannot use external assets)
- `docs/sw.js` -- Service worker caching strategy for cone PNGs
- `scripts/generate-hero-cones.mjs` -- Current SVG-to-PNG pipeline
- `docs/today-page.js`, `docs/compare-page.js`, `docs/map.html`, `docs/quizzes/engine.js` -- Consumer call sites
- `docs/masterlock-audit.html` -- Audit page rendering calls
- `.planning/PROJECT.md` -- v2.0 milestone scope and constraints

# Technology Stack: v2.0 AI-Generated Pixel Art Cones

**Project:** Custard Calendar v2.0 Art Quality
**Researched:** 2026-03-18
**Confidence:** MEDIUM -- core API choice is well-documented; prompt engineering consistency across 94 flavors requires empirical tuning

---

## Executive Summary

The project already has a working AI sprite pipeline (`tools/generate_ai_sprites.mjs`) that calls OpenAI image generation with a well-crafted prompt template and per-flavor ingredient treatments (`docs/assets/masterlock-flavor-fills.json`). The existing pipeline targets DALL-E 3 (deprecated May 2026) and supports `gpt-image-1` via `--model` flag. The v2.0 stack recommendation is to upgrade this existing pipeline to `gpt-image-1` with transparent background support, add sharp-based post-processing for size normalization and quality control, and wire the output directly into the existing `docs/assets/cones/` directory that the site already consumes.

No new frameworks. No local GPU models. No PixelLab or Stable Diffusion. The existing OpenAI integration path is already built and just needs upgrading.

---

## Recommended Stack

### Core: Image Generation API

| Technology | Version/Model | Purpose | Why |
|------------|---------------|---------|-----|
| OpenAI `gpt-image-1` | Current (API) | Generate L5 pixel art cone PNGs | Already integrated via `generate_ai_sprites.mjs`. Best prompt adherence for pixel art among cloud APIs. Native transparent background support eliminates post-processing. DALL-E 3 is deprecated May 2026 -- must migrate anyway. |
| OpenAI Node.js SDK | Not needed (raw `fetch`) | API calls | Existing pipeline uses raw `fetch` to `api.openai.com/v1/images/generations`. No SDK dependency required. Keep it lean. |

**Why `gpt-image-1` over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| DALL-E 3 | Deprecated May 12, 2026. Already losing quality relative to successors. |
| `gpt-image-1.5` | Higher quality but ~4x cost vs `gpt-image-1` at medium quality. For pixel art where prompt adherence matters more than photorealism, `gpt-image-1` is the sweet spot. If results disappoint, upgrading is a one-line model string change. |
| `gpt-image-1-mini` | $0.005/image is cheapest, but lower prompt fidelity risks inconsistent pixel art style across 94 flavors. Not worth saving $3 on the entire batch. |
| FLUX.2 (Black Forest Labs) | Good quality, but no native transparent background support. Would need `rembg` or manual background removal for each image, adding complexity and potential artifacts. |
| Stable Diffusion + LoRA | Requires local GPU (8GB+ VRAM), LoRA training on reference images, and infrastructure the project doesn't have. Overkill for a one-time batch of 94 images. |
| PixelLab | Purpose-built for game pixel art, but pricing is opaque (no published API rates), game-sprite workflow (characters, animations, tilesets) is mismatched with single-cone icon generation, and adds a new vendor dependency. |
| Midjourney | No API. Manual Discord workflow makes batch automation impossible. |

### Post-Processing Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| sharp | Existing (via worker/node_modules) | Resize, crop, normalize generated PNGs | Already installed. Proven pipeline in `generate-hero-cones.mjs`. Nearest-neighbor kernel preserves pixel art. |
| pngjs | 7.0.0 (existing) | PNG buffer manipulation for QA checks | Already installed for pixelmatch golden baselines. Can read generated PNGs for programmatic validation. |
| pixelmatch | 7.1.0 (existing) | Visual regression between generation runs | Already installed. Can diff successive generation runs to detect drift. |

### Quality Control & Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js `fs` + `sharp.metadata()` | Built-in | Verify dimensions, transparency, file size | Script-level validation: reject images that aren't correct size or lack alpha channel. |
| Sprite preview HTML | Existing (`docs/assets/sprites/sprite-preview.html`) | Side-by-side visual comparison | Already built by `generate_sprites.mjs`. Extend to show AI-generated L5 alongside algorithmic L0-L4 for visual QA. |

---

## API Configuration Details

### `gpt-image-1` Request Parameters

```javascript
// Recommended configuration for pixel art cone generation
const body = {
  model: 'gpt-image-1',
  prompt: buildPrompt(template, card, treatment, 'L5'),
  n: 1,
  size: '1024x1024',           // Square -- matches cone symmetry, easy to crop
  quality: 'medium',           // $0.04/image. Low ($0.01) loses detail. High ($0.17) is overkill for pixel art.
  background: 'transparent',   // Native transparency -- no rembg needed
  output_format: 'png',        // Returns b64_json by default for gpt-image-1
};
```

### Cost Estimate for Full Batch

| Scenario | Images | Quality | Cost per Image | Total Cost |
|----------|--------|---------|----------------|------------|
| Full 94-flavor batch, medium quality | 94 | medium | $0.04 | **$3.76** |
| Full batch, high quality | 94 | high | $0.17 | **$15.98** |
| Full batch, low quality | 94 | low | $0.01 | **$0.94** |
| 3 re-generation passes (QA iterations) | 282 | medium | $0.04 | **$11.28** |

**Recommendation:** Start with medium quality. At $3.76 per full batch, multiple iterations are cheap enough to experiment. Upgrade individual flavors to high quality only if medium produces inadequate results for specific complex flavors (e.g., "Turtle Cheesecake" with 3 topping types).

### Rate Limits

| Tier | Images per Minute | Estimated Batch Time (94 images) |
|------|-------------------|----------------------------------|
| Tier 1 | ~5 RPM | ~20 minutes |
| Tier 2 | ~15 RPM | ~7 minutes |
| Tier 3+ | Higher | ~3-5 minutes |

The existing `generate_ai_sprites.mjs` already handles rate limiting with configurable `--delay` (default 13s for Tier 1). For `gpt-image-1`, the delay may need adjustment based on account tier.

---

## Pipeline Architecture

### Generation Flow

```
masterlock-flavor-fills.json    (94 flavors + prompt template + per-flavor treatments)
          |
          v
generate_ai_sprites.mjs         (existing script, upgraded for gpt-image-1)
    --model gpt-image-1
    --background transparent
    --quality medium
          |
          v
docs/assets/sprites/             (raw 1024x1024 transparent PNGs)
    flavor-{slug}-l5.png
          |
          v
post-process script (NEW)        (sharp: trim, resize, normalize)
    1. sharp.trim()              -- remove excess transparent padding
    2. sharp.resize(144, 168,    -- match existing cone dimensions
       kernel: 'nearest',        -- preserve pixel edges
       fit: 'contain',
       background: transparent)
    3. Validate: dimensions, alpha, file size
          |
          v
docs/assets/cones/{slug}.png    (REPLACE existing algorithmic cones)
```

### Integration Points with Existing Site

The site already loads cones from `docs/assets/cones/{slug}.png` via `heroConeSrc()` in `cone-renderer.js`. The AI-generated PNGs are drop-in replacements -- same filenames, same directory, same format. No client-side code changes needed for the swap.

**Client-side fallback chain (unchanged):**
```
heroConeSrc(flavorName)          -- returns 'assets/cones/{slug}.png'
  |
  Image.onload -> display PNG
  Image.onerror -> renderMiniConeHDSVG() fallback
```

---

## Changes to Existing Scripts

### 1. Upgrade `generate_ai_sprites.mjs`

**Existing code already supports `gpt-image-1`** via `--model` flag. Required changes:

| Change | What | Why |
|--------|------|-----|
| Add `background: 'transparent'` | Include in request body when model is `gpt-image-1` | Native transparency eliminates background removal step |
| Add `quality: 'medium'` | Include in request body | Control cost/quality tradeoff |
| Add `output_format: 'png'` | Include in request body | Ensure PNG output with alpha |
| Handle b64_json response | gpt-image-1 returns b64_json by default | Existing code already handles this path |
| Default delay to 5s | Reduce from 13s (DALL-E 3 tier 1 rate) | gpt-image-1 has different rate limits |

### 2. New Post-Processing Script

**New file:** `scripts/process-ai-cones.mjs`

Reads raw AI-generated 1024x1024 PNGs from `docs/assets/sprites/`, post-processes with sharp, and writes to `docs/assets/cones/`.

```javascript
// Core post-processing pipeline
async function processAICone(inputPath, outputPath) {
  const img = sharp(inputPath);
  const meta = await img.metadata();

  // 1. Trim transparent padding to content bounding box
  const trimmed = await img.trim().toBuffer();

  // 2. Resize to match existing cone dimensions (144x168)
  //    nearest-neighbor preserves pixel art grid
  const processed = await sharp(trimmed)
    .resize({
      width: 144,
      height: 168,
      kernel: sharp.kernel.nearest,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer();

  // 3. Validate output
  const outMeta = await sharp(processed).metadata();
  if (outMeta.width !== 144 || outMeta.height !== 168) {
    throw new Error(`Bad dimensions: ${outMeta.width}x${outMeta.height}`);
  }
  if (!outMeta.hasAlpha) {
    throw new Error('Missing alpha channel');
  }

  writeFileSync(outputPath, processed);
}
```

### 3. Retire `generate-hero-cones.mjs`

The existing SVG-to-PNG pipeline (`scripts/generate-hero-cones.mjs`) becomes obsolete once AI PNGs are the source of truth. Keep the file but mark it as deprecated -- useful for regenerating L0 micro cones if needed.

---

## Prompt Engineering for Consistency

### The Hard Problem

The biggest risk is not the API or pipeline -- it is **visual consistency across 94 flavors**. Each flavor gets a separate API call, and the model may drift in style, proportions, or background handling between calls.

### Mitigation Strategy

The existing `masterlock-flavor-fills.json` template already addresses this well with:

1. **Locked style rules:** "No anti-aliasing. No dithering. No gradients." -- hard constraints that anchor the pixel art aesthetic.
2. **Explicit color codes:** Base custard colors, topping colors, and cone colors specified as hex values in the prompt.
3. **Canonical shapes:** Each topping type has a prescribed pixel shape (Oreo = dark disk with cream speckles, Brownie = rectangular dark chunk, etc.).
4. **Single light source:** "top-left at 45 degrees" -- consistent across all flavors.
5. **Fixed composition:** "Centered composition, single scoop on a waffle cone. 1:1 aspect ratio."

### Additional Consistency Techniques

| Technique | Implementation | Confidence |
|-----------|----------------|------------|
| **Seed-based regeneration** | OpenAI API does not support seed parameters for image generation. Consistency relies entirely on prompt specificity. | HIGH (limitation confirmed) |
| **Reference image** | gpt-image-1 does not support image-to-image reference in generation mode (only in edit mode). Cannot pass a "style reference" cone. | HIGH (limitation confirmed) |
| **Prompt suffix anchoring** | Append "Match the exact same pixel art style, cone shape, and proportions as a Culver's Frozen Custard cone icon" to every prompt. | MEDIUM (helps but not deterministic) |
| **Two-pass generation** | Generate 3 variants per flavor, pick best, use as reference for edit pass. Cost: 3x but higher quality. | LOW (edit mode may alter style) |
| **Manual QA + selective regeneration** | Generate all 94, visually review in sprite-preview.html, re-run outliers with `--flavor "name" --force`. | HIGH (practical, already supported by script) |

### Recommended Approach

1. Generate full batch at medium quality.
2. Open sprite-preview.html for visual review.
3. Flag outliers (wrong proportions, style drift, background issues).
4. Re-run flagged flavors with `--flavor "name" --force`, possibly with high quality.
5. Run post-processor to normalize all to 144x168.
6. Regenerate pixelmatch golden baselines with `npm run bless:cones`.

---

## What NOT to Add

| Category | Do Not Add | Why |
|----------|-----------|-----|
| Local Stable Diffusion | ComfyUI, AUTOMATIC1111, SD WebUI | Requires GPU, LoRA training, infrastructure. One-time batch of 94 icons does not justify the setup. Cloud API is $4-$16 total. |
| PixelLab | PixelLab API | Game-sprite oriented (characters, animations). Opaque pricing. New vendor for a narrow use case. |
| rembg / background removal | `rembg`, `@imgly/background-removal` | Not needed. `gpt-image-1` supports `background: 'transparent'` natively. Adding background removal introduces ML dependencies, model downloads, and potential edge artifacts. |
| Image upscaling | ESRGAN, Real-ESRGAN, waifu2x | The cone is 144x168px. We generate at 1024x1024 and downscale. Upscaling is the opposite of what we need. |
| Python image processing | Pillow, OpenCV | Project generates cones in Node.js scripts using sharp. Adding a Python dependency for image processing creates a split pipeline. |
| OpenAI Node.js SDK | `openai` npm package | Existing script uses raw `fetch`. Adding the SDK adds a dependency for what amounts to one POST request. Not worth it. |
| Batch API | OpenAI Batch API endpoint | Image generation is not officially supported via the Batch API (`/v1/batches`). The sequential loop with delay is the correct approach. |
| Multiple AI providers | FLUX + OpenAI + PixelLab | Mixing providers guarantees style inconsistency. Pick one model and use it for all 94 flavors. |
| Canvas/WebGL rendering | HTML Canvas for compositing | sharp handles all image manipulation server-side. No browser-based rendering needed. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI model | `gpt-image-1` (medium) | `gpt-image-1.5` | 4x cost for marginal pixel art improvement. One-line upgrade if needed. |
| AI model | `gpt-image-1` (medium) | `gpt-image-1-mini` | Saves $3 total but risks lower prompt adherence on complex flavors. |
| AI model | `gpt-image-1` | FLUX.2 Pro via fal.ai | No native transparent background. Good quality but adds background removal step. |
| Background removal | Native `background: 'transparent'` | `rembg` Python library | Native transparency is cleaner, faster, and has no ML dependency. |
| Post-processing | sharp (existing) | ImageMagick CLI | sharp is already installed and proven. ImageMagick adds a system dependency. |
| Resize method | `kernel: 'nearest'` (sharp) | `kernel: 'lanczos3'` (default) | Nearest-neighbor preserves pixel art grid. Lanczos introduces blurring at pixel boundaries. |
| Output dimensions | 144x168 (match existing) | 256x256 or 512x512 (larger) | All consumer code expects 144x168. Changing dimensions cascades through CSS, golden baselines, and social card layouts. |
| Batch approach | Sequential with delay | Parallel with Promise.all | Rate limits make parallelism pointless. Sequential with delay respects API limits and is simpler to debug. |
| QA approach | Visual review in sprite-preview.html | Automated pixel-level similarity | Pixel similarity doesn't capture style consistency -- human eye is better for "does this look like the others?" |

---

## Installation & Usage

```bash
# No new packages to install. Existing node_modules in worker/ include sharp.

# 1. Generate AI cones (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs \
  --model gpt-image-1 \
  --l5-only

# 2. Generate a single flavor (for testing / re-runs)
OPENAI_API_KEY=sk-... node tools/generate_ai_sprites.mjs \
  --model gpt-image-1 \
  --flavor "turtle cheesecake" \
  --force

# 3. Post-process: trim + resize to 144x168 (new script)
node scripts/process-ai-cones.mjs

# 4. Visual review
open docs/assets/sprites/sprite-preview.html

# 5. Update golden baselines
cd worker && npm run bless:cones

# 6. Run tests
cd worker && npm test
```

### Environment Requirements

| Requirement | Value | Notes |
|-------------|-------|-------|
| `OPENAI_API_KEY` | `sk-...` | Tier 1+ account (not just $5 credits). Set as env var. |
| Node.js | 18+ | Already required by wrangler. |
| sharp | Existing in worker/node_modules | No install needed. |
| Disk space | ~50MB for 94 raw 1024x1024 PNGs + 94 processed 144x168 PNGs | Negligible. |
| Time | ~20 min at Tier 1 (5 RPM), ~7 min at Tier 2 (15 RPM) | One-time generation cost. |

---

## Migration Path

### Phase 1: Generate and Validate
1. Run `generate_ai_sprites.mjs` with `--model gpt-image-1 --l5-only` for all 94 flavors.
2. Visually review generated sprites in sprite-preview.html.
3. Re-run outliers with `--flavor "name" --force`.
4. Iterate until all 94 pass visual QA.

### Phase 2: Post-Process and Replace
1. Run `process-ai-cones.mjs` to trim/resize all L5 PNGs to 144x168.
2. Copy processed PNGs to `docs/assets/cones/` (overwriting algorithmic versions).
3. Regenerate golden baselines with `npm run bless:cones`.
4. Run full test suite.

### Phase 3: Remove Dead Renderers
1. Remove `renderConeHeroSVG()` from `worker/src/flavor-colors.js` (no longer used for PNG generation).
2. Remove `renderConePremiumSVG()` (already marked for removal in PROJECT.md).
3. Remove `renderConeHDSVG()` from both worker and client (L5 PNGs replace HD SVG fallback).
4. Keep `renderConeSVG()` (9x10 micro) for L0 Tidbyt/map-marker use.
5. Simplify `cone-renderer.js` client-side: remove HD/Hero SVG renderers, keep PNG lookup + L0 micro fallback.

### Phase 4: Update Audit Page
1. Update `flavor-audit.html` to show two-tier pipeline: L0 micro SVG + L5 AI PNG.
2. Remove references to HD/Hero/Premium tiers.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Style inconsistency across 94 flavors | HIGH | MEDIUM | Existing prompt template is strong. Manual QA + selective regeneration. Accept ~5-10% outlier re-runs. |
| DALL-E 3 deprecation breaks current pipeline | CERTAIN | LOW | Migration to gpt-image-1 is the explicit goal. Already partially supported in existing code. |
| gpt-image-1 transparent background has artifacts | MEDIUM | LOW | sharp.trim() cleans up stray edge pixels. If severe, generate on solid color and use sharp threshold-based removal. |
| AI model generates non-pixel-art images | LOW | HIGH | Prompt template explicitly forbids anti-aliasing, gradients, dithering. "Non-negotiable style rules" section is strong. Re-run with adjusted prompt. |
| OpenAI rate limit changes | LOW | LOW | Delay is configurable via `--delay`. Script already handles 429 with retry. |
| Generated images too large for GitHub Pages | LOW | LOW | 94 PNGs at 144x168 are ~1.5KB each. Total ~140KB. Negligible vs current assets. |

---

## Sources

### Official Documentation (HIGH confidence)
- [OpenAI Image Generation API Guide](https://platform.openai.com/docs/guides/image-generation) -- gpt-image-1 model, transparent background, quality tiers, sizes
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) -- $0.01/$0.04/$0.17 per image at low/medium/high for 1024x1024
- [OpenAI Rate Limits](https://developers.openai.com/api/docs/guides/rate-limits) -- RPM/RPD/IPM by tier
- [OpenAI DALL-E 3 Deprecation](https://community.openai.com/t/openai-is-making-a-huge-mistake-by-deprecating-dall-e-3/1367228) -- deprecated, removal May 12, 2026
- [sharp Resize API](https://sharp.pixelplumbing.com/api-resize/) -- `kernel: 'nearest'` for pixel art
- [sharp Trim API](https://sharp.pixelplumbing.com/api-operation/#trim) -- remove transparent padding

### Direct Codebase Inspection (HIGH confidence)
- `tools/generate_ai_sprites.mjs` -- existing AI sprite pipeline, supports `--model gpt-image-1`, rate limit handling, per-flavor targeting
- `docs/assets/masterlock-flavor-fills.json` -- prompt template, 94 flavor cards with ingredient treatments, color specifications
- `scripts/generate-hero-cones.mjs` -- existing sharp pipeline (300 DPI, nearest-neighbor, 144x168 output)
- `docs/cone-renderer.js` -- `heroConeSrc()` returns `assets/cones/{slug}.png`, `renderHeroCone()` with PNG-first + SVG fallback
- `docs/assets/cones/` -- 94 existing algorithmic PNGs at 144x168px RGBA
- `worker/package.json` -- `sprites:ai` script already wired, sharp/pixelmatch/pngjs in devDependencies

### Web Research (MEDIUM confidence)
- [OpenAI Cookbook: Generate images with GPT Image](https://developers.openai.com/cookbook/examples/generate_images_with_gpt_image/) -- Node.js examples, transparent background usage
- [AI Image Generation API Comparison 2026](https://blog.laozhang.ai/en/posts/ai-image-generation-api-comparison-2026) -- pricing/quality comparisons across providers
- [Midjourney vs DALL-E vs Stable Diffusion vs Flux 2026](https://freeacademy.ai/blog/midjourney-vs-dalle-vs-stable-diffusion-vs-flux-comparison-2026) -- market landscape
- [PixelLab AI Review](https://www.jonathanyu.xyz/2025/12/31/pixellab-review-the-best-ai-tool-for-2d-pixel-art-games/) -- PixelLab capabilities and limitations
- [OpenAI GPT Image 1 vs Mini Comparison](https://www.appaca.ai/resources/llm-comparison/gpt-image-1-vs-gpt-image-1-mini) -- quality/cost tradeoff between models

# Feature Landscape: v2.0 Art Quality -- AI Pixel Art Cone Pipeline

**Domain:** AI-generated pixel art asset pipeline for frozen custard flavor visualization
**Researched:** 2026-03-18
**Confidence:** HIGH (codebase inspection) / MEDIUM (AI generation workflow patterns)

## Context: What Already Exists

The proof-of-concept is substantial. The blackberry-cobbler L5 PNG demonstrates the target quality:

- **Masterlock prompt template** (`tools/generate_masterlock_prompts.mjs`): Generates structured prompts for all 94 FLAVOR_PROFILES by combining a locked style template with per-flavor ingredient treatments (base color, swirls, chunk inclusions, texture notes)
- **94 flavor fill cards**: Already generated and stored in `docs/assets/masterlock-flavor-fills.json` with canonical ingredient treatments derived from FLAVOR_PROFILES
- **Blackberry cobbler proof-of-concept**: AI-generated L5 PNG exists at `docs/assets/blackberry-cobbler/blackberry-l5-premium.png` (high quality, ~1024x1024, transparent background, pixel art style)
- **Existing hero cone pipeline**: `scripts/generate-hero-cones.mjs` renders algorithmic SVGs via `renderConeHeroSVG` at 36x42 grid, rasterizes to 144x168 PNG via sharp at 300 DPI
- **56-color palette**: 23 base + 33 topping colors synchronized across 4 files with CI sync gate
- **Asset naming convention**: `docs/assets/cones/{slug}.png` (e.g., `blackberry-cobbler.png`)
- **Client-side consumption**: `cone-renderer.js` has `heroConeSrc()` returning `assets/cones/{slug}.png` with alias resolution and HD SVG fallback via `renderHeroCone()`
- **Service worker caching**: `sw.js` intercepts `assets/cones/*.png` with stale-while-revalidate
- **Social card renderer**: `worker/src/social-card.js` uses `renderConeHDSVG()` for OG images (Worker-side, not client-side)

The quality gap between the algorithmic 144x168 hero PNGs and the AI-generated L5 blackberry-cobbler is massive -- the AI version has visible ingredient detail, realistic texture marbling, and depth that the pixel grid cones cannot achieve.

## Table Stakes

Features that are required for the v2.0 milestone to be considered complete. Missing any of these means the migration is partial and the site shows a mix of old and new art.

| Feature | Why Required | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| **Prompt generation for all 94 flavors** | Without prompts for every flavor, cannot generate complete art set | LOW | Masterlock template + FLAVOR_PROFILES | Already 90% done -- `generate_masterlock_prompts.mjs` produces all 94 fill cards. Need to wire into actual API calls or manual generation workflow |
| **AI image generation for 94 flavors** | Core deliverable -- replace all algorithmic cones with AI art | HIGH | Prompt templates, API access or manual generation | ~$7-18 total API cost at gpt-image-1 medium/high quality. Main bottleneck is curation, not generation |
| **Background removal / transparency** | Cones must render on page backgrounds (white cards, dark surfaces) | MEDIUM | Raw AI outputs | Use `background: "transparent"` API param with PNG output. For images generated via ChatGPT UI, post-process with remove.bg or sharp alpha channel extraction |
| **Size normalization to target dimensions** | All 94 PNGs must be identical dimensions for CSS consistency | LOW | Raw AI outputs | Target: 144x168 or larger power-of-2 size. Resize with nearest-neighbor via sharp to preserve pixel edges |
| **Replace `docs/assets/cones/*.png`** | Drop-in replacement of all 94 hero cone PNGs | LOW | Normalized AI PNGs | Same slug-based naming convention. Existing `heroConeSrc()` and SW caching work unchanged |
| **Quality gate: human review of all 94** | AI generates variance -- some will be off-brand, wrong colors, inconsistent style | HIGH | Generated candidates | This is the longest-duration feature. Budget for ~30% reject rate requiring re-generation with tweaked prompts |
| **SW cache version bump** | Users must receive new art, not cached old PNGs | LOW | All new PNGs committed | Bump `CACHE_VERSION` in `sw.js` (currently v20) |
| **Remove dead intermediate renderers** | `renderConeHDSVG`, `renderConeHeroSVG`, `renderConePremiumSVG` in `flavor-colors.js` are dead code after migration | MEDIUM | All consumers migrated to PNG-only | Worker's `social-card.js` still uses `renderConeHDSVG()` -- this is the hardest removal |
| **Update `flavor-audit.html`** | Audit page renders all 5 SVG tiers side-by-side. Must reflect two-tier reality (L0 SVG + L5 PNG) | LOW | Dead renderer removal | Currently renders L0 through L5 SVG comparisons plus premium |
| **Golden baseline regeneration** | Pixelmatch tests compare against current PNGs. New art invalidates all baselines | MEDIUM | Final art committed | 376+ golden tests need new baseline snapshots |

## Differentiators

Features that elevate the pipeline beyond "replace PNGs." Not strictly required for v2.0 but add significant value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Premium treatment overrides for showcase flavors** | The blackberry-cobbler proof-of-concept has a `premium_treatment_override` in the masterlock JSON with richer ingredient descriptions (e.g., "whole blackberries with clustered drupelet shape and glossy deep-purple highlights"). Applying similar per-flavor overrides for complex flavors produces dramatically better AI output | MEDIUM | Curation pass identifying which flavors need richer descriptions | Currently only blackberry-cobbler has an override. Flavors with `density: explosion` (7 flavors) and multi-topping profiles are prime candidates |
| **Batch generation script with API integration** | Node.js script that reads masterlock JSON, calls gpt-image-1 API, saves raw outputs, and logs generation metadata (prompt used, cost, timestamp) | MEDIUM | OpenAI API key, masterlock JSON | Enables reproducible re-generation. Without this, generation is manual ChatGPT-session-by-session work |
| **Candidate gallery for curation** | HTML page showing 2-3 candidates per flavor side-by-side for accept/reject decisions | LOW | Multiple candidates generated per flavor | Extends the existing `blackberry-asset-preview.html` pattern to all flavors. Makes quality gate faster |
| **Social card migration to PNG** | Replace `renderConeHDSVG()` in Worker's `social-card.js` with pre-generated PNG cone images embedded as base64 or served from R2/KV | HIGH | All 94 PNGs finalized, Worker deployment | Currently out of scope per PROJECT.md ("no Worker changes"), but the social cards will look inconsistent if they keep old SVG cones while the site shows AI art. Flag as stretch |
| **L0 micro SVG preservation** | Keep the 9x11 `renderConeSVG()` for Tidbyt (64x32 display) where AI art would be too detailed | LOW | None -- L0 renderer already works | Two-tier model: L0 SVG (Tidbyt/tiny contexts) + L5 PNG (everything else). The L0 renderer is ~200 lines and earns its keep |
| **Asset manifest with generation metadata** | JSON file tracking each flavor's PNG: source prompt hash, generation date, model used, quality setting, file size, dimensions | LOW | Generation pipeline | Enables reproducibility and version tracking. Pattern already exists in `blackberry-asset-manifest.json` |

## Anti-Features

Features to explicitly NOT build for v2.0. Each has a common "why not" that prevents wasted effort.

| Anti-Feature | Why Commonly Considered | Why Avoid | What to Do Instead |
|--------------|------------------------|-----------|-------------------|
| **Multiple resolution outputs per flavor** | "Retina displays need 2x/3x" | 94 flavors x 3 resolutions = 282 PNGs. CSS `image-rendering: pixelated` handles scaling. AI pixel art looks good at integer multiples | Generate one high-quality PNG per flavor. Use CSS scaling |
| **AI-generated L0 micro cones** | "Consistency across all tiers" | The 9x11 pixel L0 SVG is purpose-built for Tidbyt's 64x32 display. AI cannot reliably generate 9x11 pixel art. The existing algorithmic L0 is battle-tested | Keep L0 `renderConeSVG()` as-is |
| **Fine-tuned / custom-trained model** | "Train on our art style for perfect consistency" | Custom model training requires 50+ reference images, costs $100+, takes days, and is overkill for 94 one-time generations. Prompt engineering with the locked template achieves sufficient consistency | Use masterlock prompt template with gpt-image-1 base model |
| **Automated quality scoring** | "Use CV/ML to score generated cones automatically" | No ground truth to compare against -- the whole point is these are new art. Human review is faster for 94 images than building a scoring pipeline | Manual curation with candidate gallery |
| **Real-time API generation on page load** | "Generate cones on-demand instead of pre-baking" | API latency (3-8 seconds per image), cost per render, no caching benefit, style variance between sessions | Pre-generate and commit as static assets |
| **Intermediate tiers (L1-L4) as AI PNGs** | "Replace all 6 tiers with AI art" | L1-L4 are used in contexts where SVG inline rendering is needed (map markers, widget, radar cards). Swapping SVG for PNG in these contexts requires DOM refactoring across multiple pages | Two-tier model: L0 SVG + L5 PNG. Remove L1-L4 entirely |
| **Animated cone PNGs / GIFs** | "Add sparkle or shimmer effects" | GitHub Pages bandwidth, file size (10x larger per asset), no animation framework in vanilla JS site | Static PNGs. Consider CSS shimmer via `@keyframes` if animation is desired later |
| **User-facing flavor art editor** | "Let users customize cone art" | Scope explosion. This is a read-only display site, not a design tool | Out of scope entirely |

## Feature Dependencies

```
[Masterlock Prompt Pack]  <-- ALREADY EXISTS
    |
    +--> [Premium Treatment Overrides]  (optional: richer prompts for complex flavors)
    |         |
    |         v
    +--> [AI Image Generation x94]  <-- CORE BOTTLENECK
              |
              +--> [Background Removal / Transparency]
              |         |
              |         v
              +--> [Size Normalization to 144x168]  (or chosen target)
              |         |
              |         v
              +--> [Quality Gate: Human Review]  <-- LONGEST DURATION
              |         |
              |         +--> [Re-generation of rejects]  (loop back to generation)
              |         |
              |         v
              +--> [Replace docs/assets/cones/*.png]  <-- DROP-IN SWAP
                        |
                        +--> [Golden Baseline Regeneration]
                        |
                        +--> [SW Cache Version Bump]
                        |
                        +--> [Remove Dead Renderers]  (HD SVG, Hero SVG, Premium SVG)
                        |         |
                        |         +--> [Social Card Migration]  (stretch: Worker change)
                        |
                        +--> [Update flavor-audit.html]
                        |
                        +--> [Asset Manifest Update]

[L0 Micro SVG Preservation]  <-- INDEPENDENT (no changes needed)
```

### Critical Path

The critical path is: **Prompt Pack** (done) --> **Generation** (1-2 days) --> **Curation** (1-3 days, the bottleneck) --> **Normalization** (hours) --> **Drop-in Replacement** (minutes) --> **Cleanup** (1 day).

Curation is the bottleneck because:
1. AI generation produces variance even with identical prompts
2. Style consistency across 94 flavors requires comparing outputs side-by-side
3. Some flavors will need 2-3 regeneration attempts with prompt tweaks
4. Dark-on-dark combinations (e.g., death-by-chocolate, triple-chocolate-kiss) are hardest to get right

## MVP Recommendation

### Phase 1: Generate and Curate (highest effort, highest value)

1. **Wire prompt generation to API calls** -- extend `generate_masterlock_prompts.mjs` or create new script that calls gpt-image-1 API with each flavor's fill card
2. **Generate 2-3 candidates per flavor** -- budget for ~200-280 API calls total (~$14-53 at medium/high quality)
3. **Build candidate gallery HTML** -- one page showing all candidates grouped by flavor for fast accept/reject
4. **Human curation pass** -- select best candidate per flavor, tag rejects for re-generation

### Phase 2: Normalize and Deploy (mechanical)

5. **Post-process accepted PNGs** -- background removal (if needed), resize to target dimensions via sharp with nearest-neighbor
6. **Drop into `docs/assets/cones/`** -- overwrite all 94 existing PNGs
7. **Bump SW cache version** to v21
8. **Regenerate golden baselines** for pixelmatch tests

### Phase 3: Cleanup (reduce tech debt)

9. **Remove dead renderers** -- delete `renderConeHDSVG`, `renderConeHeroSVG`, `renderConePremiumSVG` from `flavor-colors.js`
10. **Remove dead sprite SVGs** -- delete L1-L5 SVGs from `docs/assets/sprites/` (~200 files)
11. **Update `flavor-audit.html`** -- show L0 SVG + L5 PNG only
12. **Update `cone-renderer.js`** -- remove HD SVG fallback functions (keep `heroConeSrc()` and `renderHeroCone()` with simplified fallback)

### Defer

- **Social card migration**: Requires Worker code changes (out of scope per PROJECT.md). Social cards will show algorithmic HD SVG cones while the site shows AI PNGs. Acceptable inconsistency for v2.0
- **Premium treatment overrides for all 94**: Nice-to-have. Start with the blackberry-cobbler model and add overrides only for flavors that generate poorly with canonical prompts

## "Done" Criteria for 94 Flavors

| Criterion | Measurement |
|-----------|-------------|
| All 94 `docs/assets/cones/{slug}.png` files replaced with AI art | File count = 94, all modified dates after v2.0 start |
| Consistent dimensions across all PNGs | All files are identical width x height (target TBD, likely 144x168 or 288x336) |
| Transparent or solid background renders correctly | Visual check on white card (Today page) and dark surface (flavor-audit) |
| Style coherence across catalog | Side-by-side gallery review: same cone style, similar lighting, consistent waffle pattern |
| Color accuracy vs. FLAVOR_PROFILES | Base color dominant, ribbon visible when present, toppings distinguishable |
| No SVG renderer calls in production code paths | Grep for `renderConeHDSVG|renderConeHeroSVG|renderConePremiumSVG` returns only test fixtures and dead code |
| L0 `renderConeSVG` still functional | Tidbyt renderer and small inline cones unaffected |
| SW cache version bumped | `CACHE_VERSION` in `sw.js` incremented |
| Golden baselines updated | All pixelmatch tests pass with new baselines |
| `flavor-audit.html` shows two-tier view | L0 + L5 columns only, no L1-L4 |

## Cost Estimation

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| gpt-image-1 medium quality, 1024x1024 | 94 x 2.5 avg candidates | ~$0.07/image | ~$16.45 |
| gpt-image-1 high quality, 1024x1024 | 94 x 2.5 avg candidates (if high quality needed) | ~$0.19/image | ~$44.65 |
| Re-generation (30% reject rate) | ~28 x 2 retries | ~$0.07-0.19/image | ~$3.92-10.64 |
| **Total estimated range** | | | **$20-55** |

Using gpt-image-1 medium quality is recommended. High quality uses significantly more tokens but the visual difference for pixel art (which is intentionally low-resolution style) is minimal.

## Sources

### Direct codebase inspection (HIGH confidence)
- `tools/generate_masterlock_prompts.mjs` -- Masterlock prompt template with 94 flavor fill cards, quality ladder, density notes, treatment generation
- `docs/assets/masterlock-flavor-fills.json` -- Pre-generated JSON with all 94 flavors' ingredient treatments
- `docs/assets/blackberry-cobbler/blackberry-prompts.md` -- Proof-of-concept prompt set with canonical and premium variants
- `docs/assets/blackberry-cobbler/blackberry-l5-premium.png` -- Reference AI-generated L5 PNG (the quality target)
- `docs/assets/blackberry-cobbler/blackberry-asset-manifest.json` -- Metadata pattern for generated assets
- `worker/src/flavor-colors.js` -- 94 FLAVOR_PROFILES, 4 SVG renderers (renderConeSVG, renderConeHDSVG, renderConeHeroSVG, renderConePremiumSVG)
- `scripts/generate-hero-cones.mjs` -- Current sharp-based SVG-to-PNG pipeline (300 DPI, nearest-neighbor to 144x168)
- `docs/cone-renderer.js` -- Client-side hero cone lookup (`heroConeSrc`) and HD SVG fallback (`renderHeroCone`)
- `docs/sw.js` -- Service worker caching for `assets/cones/*.png`
- `worker/src/social-card.js` -- Uses `renderConeHDSVG()` for OG image cones (Worker-side)

### Web research (MEDIUM confidence)
- [OpenAI Image Generation API](https://developers.openai.com/api/docs/guides/image-generation) -- gpt-image-1 supports `background: "transparent"`, `output_format: "png"`, quality: low/medium/high/auto
- [OpenAI Pricing](https://openai.com/api/pricing/) -- gpt-image-1 pricing: ~$0.02 (low), ~$0.07 (medium), ~$0.19 (high) per 1024x1024 image
- [GPT Image 1.5 Prompting Guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide) -- Prompt anchoring with style rules for consistency
- [How We Generate Pixel Art with AI](https://www.seeles.ai/resources/blogs/ai-generate-pixel-art-game-assets) -- Post-processing with color quantization, dataset preparation
- [AI Concept Art Generators for Game Designers](https://www.designer-daily.com/ai-concept-art-generators-for-game-designers-211827) -- Custom model training vs. prompt engineering tradeoffs
- [Generative AI in Game Asset Production 2026](https://www.gianty.com/generative-ai-in-game-asset-production-in-2026/) -- Industry pipeline patterns for batch asset generation
- [Expanding Game Art with AI](https://www.ixiegaming.com/blog/expanding-creativity-with-ai/) -- Quality control: every AI asset through multiple human checks
- [Game Asset Management Guide](https://www.anchorpoint.app/blog/a-proper-guide-to-game-asset-management) -- Naming conventions and version control for art assets
- [Retro Diffusion: Pixel Art with AI at Scale](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale) -- Post-processing with clustering and color quantization for consistent pixel art
- [OpenAI Community: gpt-image-1 Transparent Backgrounds](https://community.openai.com/t/gpt-image-1-transparent-backgrounds-with-edit-request/1240577) -- Transparency works best at medium or high quality

---
*Feature research for: v2.0 Art Quality milestone (AI pixel art cone pipeline)*
*Researched: 2026-03-18*

# Domain Pitfalls

**Domain:** AI-generated pixel art asset pipeline at scale -- replacing algorithmic SVG renderers with AI-generated PNGs for 94 unique frozen custard flavors
**Researched:** 2026-03-18
**Confidence:** HIGH for integration and caching pitfalls (verified against codebase). MEDIUM for AI generation pitfalls (verified via multiple web sources but model-specific behavior varies).

---

## Critical Pitfalls

Mistakes that cause rewrites, significant rework, or ship broken assets to users.

### Pitfall 1: Style Drift Across 94 Generated Images

**What goes wrong:** The AI model produces visually inconsistent cones across 94 generations. Outline thickness varies (1px vs 2px), shadow direction shifts (upper-left vs upper-right), scoop proportions change (tall narrow vs wide flat), cone angle drifts, and the overall "pixel density" feel is different between batch sessions. The result looks like 94 images from 94 different artists.

**Why it happens:** Every AI generation is a dice roll. Even with identical model parameters, the stochastic sampling process produces variation. Generating 94 images inevitably spans multiple sessions/days, and model behavior can shift between sessions due to API infrastructure changes, random seed effects, or subtle prompt interpretation differences. This is the single most common visual problem in AI-generated game art -- not bad art, inconsistent art.

**Consequences:** The site's visual identity fractures. Users scrolling through radar cards or quiz results see jarring style shifts between flavors. The current algorithmic renderer, despite lower fidelity, has perfect consistency because it is deterministic. Replacing it with visually inconsistent AI art is a net downgrade.

**Prevention:**
1. Generate ALL 94 images in a single session with identical model, version, seed parameters, and prompt template. Never split across days or model versions.
2. Create a "style bible" reference image and use image-to-image (img2img) or style reference features to anchor all generations to it. Most modern AI image tools support reference image input.
3. Lock the exact model version (e.g., `dall-e-3`, `flux-1.1-pro`, specific Stable Diffusion checkpoint). Do not use "latest" -- model updates change output characteristics.
4. Include hard constraints in every prompt: exact outline thickness, exact shadow direction, exact scoop/cone proportion ratio, exact canvas size. More constraints = more consistency.
5. Post-process all images through a shared pipeline: same color quantization, same palette enforcement, same canvas dimensions, same background removal. Post-processing is where consistency is actually guaranteed.

**Detection:**
- Lay all 94 images out in a grid at the same size. Style drift is immediately visible when comparing neighbors.
- Measure cone width/height ratios programmatically -- they should be within 5% tolerance.
- Check outline pixel counts per image -- significant variance indicates thickness drift.

**Phase to address:** The generation phase itself. Must be completed before any integration work begins.

---

### Pitfall 2: Losing Deterministic Reproducibility

**What goes wrong:** The current pipeline is perfectly deterministic: FLAVOR_PROFILES + seeded Mulberry32 PRNG + SVG rect grid = identical output every time. Zero-tolerance pixelmatch baselines (376 tests) verify this. Replacing this with AI-generated art means the assets can never be reproduced identically from inputs alone. If assets are lost, corrupted, or need regeneration, you get different images.

**Why it happens:** AI image generation is stochastic by design. Even with fixed seeds, exact reproduction requires: identical model weights, identical hardware, identical inference engine version, identical prompt text, and identical generation parameters. Changing any one variable produces different output. Cloud-hosted models (DALL-E, Midjourney) do not guarantee deterministic output even with the same seed -- the infrastructure can change between calls.

**Consequences:**
- Golden baselines become impossible to "regenerate" -- they must be stored as source-of-truth artifacts, not derived outputs.
- If a single flavor's image is lost or needs regeneration, the new image will visually differ from the original 93, breaking consistency.
- The pixelmatch zero-tolerance test framework becomes a snapshot comparator rather than a derivation verifier.
- CI cannot regenerate baselines from code -- the golden artifacts are the source of truth.

**Prevention:**
1. Treat generated PNGs as PRIMARY ARTIFACTS, not derived outputs. Check them into git alongside code. They are source, not build output.
2. Store the complete generation manifest alongside images: model name, model version, exact prompt text, seed value, all parameters, generation timestamp. This is your reproducibility record even if exact reproduction is impossible.
3. Keep the L0 SVG renderer as a deterministic fallback. The two-tier strategy (L0 SVG + L5 AI PNG) preserves a reproducible path for small displays.
4. Store full-resolution originals (before any post-processing) in a separate archive. If you need to re-post-process, at least the AI generation step does not need to be repeated.
5. If regenerating a single flavor, generate 10+ variants and pick the one most consistent with the existing set. Do not accept the first generation.

**Detection:**
- Run `UPDATE_GOLDENS=1` and verify that golden baselines now use stored PNGs rather than rendered-from-code outputs.
- Verify the generation manifest file exists and is complete for all 94 flavors.
- Confirm that `generate-hero-cones.mjs` either (a) copies pre-generated PNGs to docs/assets/cones/ or (b) is retired in favor of a simpler copy/optimize script.

**Phase to address:** Pipeline architecture phase. Decide the artifact storage strategy before generating a single image.

---

### Pitfall 3: Social Card SVG-to-PNG Migration Breaks OG Sharing

**What goes wrong:** The current social card system (`worker/src/social-card.js`) generates pure SVG cards with inline pixel-art cones via `renderConeGroup()` which extracts inner SVG from `renderConeHDSVG()`. Migrating to AI-generated PNG cones means either: (a) embedding base64 PNG data inside SVG (massive file size, 100KB+ per card), or (b) switching social cards to PNG output (requires rasterization in the Worker, which has no `canvas` or `sharp`), or (c) referencing external PNG URLs inside SVG (broken on most social platforms).

**Why it happens:** The social card system was designed around inline SVG rendering -- the cone is SVG rects embedded directly in the SVG card. An AI-generated PNG cone cannot be embedded as SVG rects. The three obvious migration paths each have severe drawbacks:
- **Base64 PNG in SVG:** An AI-generated cone PNG at 144x168 is likely 5-30KB. Base64 encoding adds ~37% overhead. Embedding this in the SVG payload inflates response size significantly. For flavor-specific cards (which lookup each flavor dynamically), this means fetching + encoding on every request.
- **Worker-side rasterization:** Cloudflare Workers have no native image processing. `sharp` requires Node.js with native bindings. Puppeteer/headless Chrome is not available in Workers. You would need an external rasterization service.
- **External image reference in SVG:** `<image href="https://...cone.png"/>` inside SVG is not reliably rendered by social platform scrapers (Facebook, Twitter/X, LinkedIn). Most scrapers render the SVG but do not fetch external resources.

**Consequences:** Social sharing cards either show blank/broken cones, or the migration is blocked entirely, leaving social cards on the old SVG renderer indefinitely.

**Prevention:**
1. Keep the L0 SVG renderer alive specifically for social cards. Social cards render at small size anyway (the cone is 108x132px inside a 1200x630 card) -- SVG pixel-art is adequate at this scale.
2. Alternatively, pre-render all 94 social card cones as base64 strings and store them in a KV lookup. The Worker fetches the base64 string per flavor and injects it into the SVG. This is a one-time cost, not a per-request cost.
3. If switching social cards to PNG output: use a separate serverless function (not the Worker) with a rasterization tool like `@vercel/og` or a Cloudflare Pages function with `resvg-wasm`.
4. Do NOT attempt to make social platforms fetch external images referenced inside SVG. This fails silently on most platforms.

**Detection:**
- After migration, test OG cards by pasting URLs into the Facebook Sharing Debugger, Twitter Card Validator, and LinkedIn Post Inspector.
- Verify `Content-Type` header is still `image/svg+xml` if keeping SVG, or correctly `image/png` if switching to PNG.
- Check card file sizes -- if they exceed 300KB, social platforms may reject or timeout.

**Phase to address:** Integration phase, after L5 PNGs are generated. Social card strategy must be decided early because it determines whether the old SVG renderers can be fully removed.

---

### Pitfall 4: Asset Size Bloat Exceeding GitHub Pages Limits

**What goes wrong:** Current algorithmic Hero cone PNGs are tiny (~1-2KB each, 144x168px pixel art rasterized from SVG rects). AI-generated PNGs at equivalent or higher resolution will be dramatically larger -- 10KB to 100KB+ each depending on complexity, anti-aliasing, and color depth. 94 images at 50KB average = 4.7MB of cone assets alone. At 100KB average = 9.4MB. This balloons the git repository and pushes against GitHub Pages limits (1GB repo, 100GB/month bandwidth).

**Why it happens:** Algorithmic SVG rects produce PNGs with very few distinct colors and large flat regions, which PNG compresses extremely well (hence 1-2KB per image). AI-generated images have gradients, anti-aliased edges, dithering, noise, and many more distinct pixel values -- all of which resist PNG compression. The pixel art style helps (fewer colors than photorealistic) but AI "pixel art" typically has more color variation than true hand-crafted pixel art.

**Consequences:**
- Git repository grows by 5-10MB (94 PNGs). Each regeneration cycle adds another 5-10MB of binary diff. After 5 regeneration cycles, the repo has grown by 25-50MB of unreachable binary objects.
- GitHub Pages bandwidth limit (100GB/month) becomes relevant if images are not cached properly.
- Service worker pre-cache becomes untenable -- the current SW does NOT pre-cache cone PNGs (they use stale-while-revalidate runtime caching, line 65-79 of sw.js). This is correct and must remain so.
- First-load performance degrades as 94 images are larger and most pages load multiple cones simultaneously.

**Prevention:**
1. Target a specific file size budget: 10KB max per L5 PNG. This constrains resolution and color depth but keeps total assets under 1MB.
2. Use aggressive PNG optimization: `pngquant` (lossy color quantization to 256 colors), `oxipng` (lossless recompression), or `sharp` with `palette: true` and reduced colors.
3. Consider WebP with PNG fallback. WebP achieves 25-35% smaller files than PNG for the same visual quality. However, this requires changes to `heroConeSrc()` and `renderHeroCone()` to support format negotiation.
4. Do NOT switch cone PNGs to pre-cached static assets in sw.js. Keep the stale-while-revalidate runtime caching strategy. Pre-caching 94 images would block service worker installation.
5. Use `loading="lazy"` on cone `<img>` elements that are below the fold (radar cards, quiz answer images).
6. Track git repo size after committing PNGs. If exceeding 500MB, consider Git LFS -- but note that GitHub Pages does NOT serve Git LFS files. LFS assets would need to be served from a CDN, not from the Pages site.

**Detection:**
- After generation, check total size: `ls -la docs/assets/cones/*.png | awk '{total += $5} END {print total/1024/1024 " MB"}'`
- Compare against current total size (94 files at ~1-2KB each = ~100-200KB total).
- Monitor GitHub Pages bandwidth in the repository settings after deploy.

**Phase to address:** Generation phase. File size budget must be established and enforced during generation, not retroactively.

---

### Pitfall 5: Background Removal Artifacts on Transparent PNGs

**What goes wrong:** AI image generators produce images on backgrounds (solid color, gradient, or noisy). Removing the background to get a transparent cone PNG introduces artifacts: fringe pixels (halo of background color around edges), semi-transparent edge pixels that look wrong on both light and dark page backgrounds, and hard clipping of subtle effects (glow, shadow, ambient occlusion) that the AI added.

**Why it happens:** Background removal tools make a binary (or alpha-weighted) decision for each pixel: keep or discard. Standard ML-based removers (remove.bg, rembg) are trained on photographs, not pixel art. They smooth edges and add anti-aliasing -- the opposite of what pixel art needs. Pixel art requires hard 1-bit alpha (fully transparent or fully opaque), not soft alpha blending.

**Consequences:**
- Fringe pixels create a visible halo around cones when displayed on the site's white card backgrounds.
- Different page backgrounds (dark map popups vs white cards vs dark social cards) reveal different artifacts -- a cone that looks clean on white shows a dark fringe on dark backgrounds.
- Semi-transparent edges break the pixel-art aesthetic -- the current cones have perfectly crisp edges because they are rendered as SVG rects with no anti-aliasing.

**Prevention:**
1. Generate images on a known solid background color (e.g., #140c06 dark brown, as specified in the existing masterlock prompt template). A solid, distinct background color makes removal cleaner.
2. Use 1-bit alpha thresholding after removal: every pixel is either fully opaque (alpha=255) or fully transparent (alpha=0). No semi-transparent pixels.
3. Alternatively, generate on a transparent background if the model supports it. Some models (GPT-4o image generation, some Stable Diffusion workflows) can output transparent PNGs directly, eliminating the removal step entirely.
4. After background removal, run an edge-erosion pass: shrink the opaque region by 1px on all edges to eliminate fringe pixels, then verify the cone is not visually clipped.
5. Test every cone on BOTH white (#ffffff) and dark (#1a1a2e, the social card background) backgrounds. Artifacts are only visible when the display background contrasts with the fringe color.

**Detection:**
- Automated: Check that no pixel has alpha between 1 and 254 (1-bit alpha enforcement).
- Visual: Display all 94 cones on a checkerboard background (alternating light/dark squares). Fringe pixels are immediately visible.
- Automated: Extract edge pixels (alpha > 0 adjacent to alpha = 0) and verify their color values. If edge pixel colors cluster around the generation background color, fringe removal was incomplete.

**Phase to address:** Post-processing phase, immediately after generation. Background removal quality is the single most impactful post-processing step.

---

### Pitfall 6: Cache Invalidation Failure Leaves Users on Stale Art

**What goes wrong:** Deploying 94 new AI-generated cone PNGs to `docs/assets/cones/` but failing to properly invalidate the service worker cache. Returning users continue to see the old algorithmic cones indefinitely because stale-while-revalidate serves the cached version first and revalidates in the background -- but if the browser or OS aggressively caches, the background revalidation may not fire on every visit.

**Why it happens:** The current SW (sw.js, line 1) uses `CACHE_VERSION = 'custard-v20'`. Cone PNGs are cached at runtime via stale-while-revalidate (sw.js lines 65-79). Bumping `CACHE_VERSION` forces a full cache purge on SW activate. But there are multiple cache layers:
1. **Service worker cache** -- controlled by `CACHE_VERSION` bump
2. **Browser HTTP cache** -- controlled by server `Cache-Control` headers. GitHub Pages sends `max-age=600` by default.
3. **CDN/Fastly cache** -- GitHub Pages uses Fastly as CDN. Cache purge depends on GitHub's deployment process.

If only the SW cache is addressed but the HTTP/CDN caches retain old PNGs, users see stale images even after SW purge.

**Consequences:** Users see a mix of old algorithmic cones and new AI-generated cones, depending on which images were cached before the deploy and which were fetched fresh. This creates worse visual inconsistency than either the old or new pipeline alone.

**Prevention:**
1. Bump `CACHE_VERSION` in sw.js when deploying new PNGs (e.g., `custard-v21`). This purges the entire SW cache on next activate.
2. Consider content-hash filenames for cone PNGs: `dark-chocolate-pb-crunch.a1b2c3.png` instead of `dark-chocolate-pb-crunch.png`. This busts ALL cache layers automatically. However, this requires updating `heroConeSrc()` to look up the hash, which adds complexity.
3. If not using content-hash filenames, add a cache-busting query parameter: `heroConeSrc()` returns `assets/cones/slug.png?v=21`. This busts browser cache without renaming files.
4. After deploy, verify by opening DevTools on a returning browser profile (not incognito, which has no cache) and confirming the new images load.
5. Test the upgrade path: load the site, cache old cones, deploy new cones + SW bump, reload -- verify new cones appear within 2 page loads.

**Detection:**
- Check sw.js `CACHE_VERSION` is incremented in the same commit that updates PNG assets.
- The existing `worker/test/png-asset-count.test.js` verifies the correct count of PNGs but does not verify content freshness. Consider adding a test that compares PNG modification timestamps or checksums against a manifest.
- After deploy, hard-refresh (Cmd+Shift+R) to bypass SW cache and verify new images are served by the origin.

**Phase to address:** Deployment/integration phase. Cache strategy must be decided before the first PNG deploy.

---

## Moderate Pitfalls

Mistakes that cause significant rework but are recoverable without full rewrites.

### Pitfall 7: AI Ignoring Prompt Constraints (Color Palette Violation)

**What goes wrong:** The AI generates a cone with a "vanilla" base that is #FFFDE7 instead of the canonical #F5DEB3, or adds toppings in colors not in the 56-color palette. The generated image is beautiful but does not match the FLAVOR_PROFILES color specification, creating a disconnect between the data model and the visual representation.

**Why it happens:** AI models interpret "vanilla custard color" based on training data, not your specific hex value. Prompts like "base custard color #F5DEB3" are partially respected at best -- the model treats hex codes as suggestions, not constraints. Even the existing masterlock prompt template provides hex codes, but AI models have limited ability to match exact hex values.

**Prevention:**
1. Accept that AI will not match exact hex values. Instead, enforce the palette in post-processing: quantize each generated image to the nearest colors in the 56-color palette using color distance algorithms (CIEDE2000 or simple Euclidean in LAB space).
2. Alternatively, let AI generate with natural colors, then map the dominant scoop color to the canonical base color via palette remapping. This preserves AI-generated texture while enforcing brand consistency.
3. Use the prompt to communicate color RELATIONSHIPS (e.g., "the scoop should be dark brown, significantly darker than the cone") rather than exact hex values.
4. The masterlock prompt template (tools/generate_masterlock_prompts.mjs) already includes hex codes and density notes. Verify these are being used. But do not rely on them for exact color matching.

**Detection:**
- Extract dominant colors from each generated PNG (e.g., k-means clustering with k=5).
- Compare the dominant scoop color against the expected `BASE_COLORS[profile.base]` value. Flag images where the dominant color is more than a threshold distance from expected.
- Visual audit: sort all 94 images by base color and verify that same-base flavors (all vanilla-based, all chocolate-based) have visually similar scoop colors.

**Phase to address:** QA/validation phase, after generation but before integration.

---

### Pitfall 8: AI-Generated Art Looking "Samey" -- Loss of Per-Flavor Distinctiveness

**What goes wrong:** The AI produces 94 cones that all look like slight variations of the same cone. The topping textures blur together, the ribbons are indistinguishable, and the density variations (pure vs standard vs explosion vs overload) are lost. Users can no longer tell "Mint Explosion" from "Andes Mint Avalanche" at a glance.

**Why it happens:** The current algorithmic renderer achieves distinctiveness through structural differences: different topping counts (0 to 14), different shapes (dot/chunk/sliver/flake/scatter), different density modes, and visible ribbon swirls. These are hard constraints that produce measurably different outputs. An AI model generating "pixel art ice cream cone with mint flavor and dark chocolate chunks" produces images that look more similar to each other than algorithmically distinct ones because the AI favors visual plausibility over structural differentiation.

**Consequences:** The flavor identity system -- which users rely on to recognize their favorites -- degrades. The FLAVOR_PROFILES data model (base + ribbon + toppings + density) was designed to produce visually distinct cones. If AI art cannot express these distinctions, the profiles become meaningless metadata.

**Prevention:**
1. Group flavors by visual similarity risk and generate the most-similar pairs (e.g., "turtle" vs "turtle dove" vs "turtle cheesecake") in the same batch for direct A/B comparison.
2. Include structural constraints in prompts: "exactly 3 visible dark chunks on top of scoop" vs "scattered small pieces across entire scoop." Make density mode a hard constraint, not a suggestion.
3. For "pure" density flavors (no toppings: vanilla, dark chocolate decadence, orange creamsicle, blue moon, pistachio, bailey's irish cream), the scoop must be visually distinct through color alone. Generate these as a separate batch and verify color differentiation.
4. After generation, create a confusion matrix: show each image to 5 people without labels and ask them to name the flavor. If two flavors are consistently confused, one or both need regeneration.
5. The existing `PREMIUM_TREATMENT_OVERRIDES` in generate_masterlock_prompts.mjs (e.g., blackberry cobbler with "whole blackberries with clustered drupelet shape") provides flavor-specific overrides. Extend this to all 94 flavors with at least one unique visual feature per flavor.

**Detection:**
- Compute pairwise image similarity (SSIM or perceptual hash) for all 94 images. Flag pairs with similarity above 0.85 -- these likely look "samey."
- Sort images by base color and verify that same-base flavors are distinguishable by toppings/ribbon.
- The 6 "pure" density flavors are highest risk -- they rely entirely on base color for identity.

**Phase to address:** QA/validation phase. Must have automated similarity checking before accepting a batch.

---

### Pitfall 9: Prompt Engineering Iteration Without Version Control

**What goes wrong:** Iterating on prompts through trial and error without saving the exact prompt that produced each accepted image. After 50+ iterations, you cannot remember which prompt produced the "good" Turtle Cheesecake image from Tuesday, and the model no longer produces anything similar.

**Why it happens:** Prompt engineering feels like casual experimentation. Developers tweak a word here, add a clause there, generate 5 images, pick the best one, tweak again. The winning prompt is not recorded. When a flavor needs regeneration 3 months later, the original prompt is lost.

**Prevention:**
1. Store the exact prompt text for every accepted generation in a structured manifest file (JSON or YAML), keyed by flavor slug. Include: prompt text, negative prompt, model name, model version, seed, all generation parameters, timestamp, and the filename of the accepted output.
2. Use the masterlock prompt template as the base and generate prompts programmatically from FLAVOR_PROFILES data. The `tools/generate_masterlock_prompts.mjs` script already does this -- ensure it is the ONLY source of prompts, never manual ad-hoc prompts.
3. Commit the manifest alongside the generated PNGs. The manifest is as important as the images themselves.
4. If using an API (not a UI), script the generation process so prompts are deterministically produced from FLAVOR_PROFILES.

**Detection:**
- Every PNG file in `docs/assets/cones/` must have a corresponding entry in the prompt manifest.
- The manifest must contain enough information to attempt reproduction (model, prompt, parameters, seed).
- `Object.keys(manifest).length === Object.keys(FLAVOR_PROFILES).length` -- no missing entries.

**Phase to address:** Generation phase. Manifest structure must be defined before generating the first image.

---

### Pitfall 10: Partial Migration Creates Two Rendering Paths

**What goes wrong:** Generating AI cones for 20 flavors, integrating them, then pausing. The site now has two rendering paths: AI PNGs for 20 flavors and algorithmic SVG fallback for 74 flavors. The two styles are visually incompatible, creating a worse user experience than either alone.

**Why it happens:** 94 images is a lot. The temptation is to ship incrementally: "let's do the chocolate family first." But the algorithmic renderer has a distinct visual style (rect-based pixel grid, flat colors, no anti-aliasing), and AI art has a fundamentally different style (smooth gradients, complex textures, varied outlines). Mixing them is jarring.

**Prevention:**
1. Generate ALL 94 images before integrating ANY of them. This is a big-bang migration, not incremental.
2. The `renderHeroCone()` function (cone-renderer.js line 563) already has a fallback chain: try PNG, fallback to HD SVG. During migration, both paths must produce visually compatible results, OR the fallback must be to the new L0 micro SVG (not the old HD SVG).
3. Define a hard gate: "AI art ships when 94/94 images pass QA. Zero partial deploys."
4. If generation for some flavors is problematic, keep ALL flavors on the old renderer until all 94 are ready. Do not mix.

**Detection:**
- `docs/assets/cones/` must contain exactly `Object.keys(FLAVOR_PROFILES).length` PNG files (this is already enforced by `worker/test/png-asset-count.test.js`).
- Visual audit: display all 94 cones in a grid. Any visually incompatible pair indicates a partial migration leak.

**Phase to address:** Roadmap structure. The generation phase must complete fully before the integration phase begins.

---

## Minor Pitfalls

Mistakes that cause delays or minor rework.

### Pitfall 11: Waffle Cone Rendering Inconsistency

**What goes wrong:** AI generates cones with different waffle patterns -- some have clean diagonal cross-hatch, others have vertical lines, others have no visible pattern. The cone becomes as variable as the scoop, when it should be a constant structural element.

**Prevention:**
1. Include explicit waffle cone instructions in every prompt: "golden waffle cone with visible diagonal checker pattern, warm orange and honey tones, consistent width from lip to tip."
2. Consider generating the cone separately and compositing it with AI-generated scoops. The cone is a constant; only the scoop varies.
3. Post-process: if the cone region is identifiable (lower half of image), verify its color variance is within tolerance.

**Phase to address:** Generation phase. Cone consistency should be one of the first quality checks.

---

### Pitfall 12: GitHub Pages Deployment Latency for Binary Assets

**What goes wrong:** Committing 94 PNG files (even at 10KB each) creates a commit with ~1MB of binary changes. GitHub Pages deployment pipelines can be slow for commits with many binary files. The CDN (Fastly) may take minutes to propagate all 94 files globally.

**Prevention:**
1. Deploy PNG updates as a single commit, not spread across multiple commits.
2. After deploy, verify at least 5 representative cones are accessible via `curl -I https://custard.chriskaschner.com/assets/cones/vanilla.png` and check for 200 status and correct `Content-Length`.
3. Allow 5-10 minutes for CDN propagation before treating the deploy as complete.

**Phase to address:** Deployment phase. Build a deploy verification script.

---

### Pitfall 13: Flavor Audit Page Not Updated for Two-Tier Pipeline

**What goes wrong:** The `docs/flavor-audit.html` page currently renders all 4 tiers (Mini, HD, Premium, Hero) for every flavor. After v2.0, only L0 (micro SVG) and L5 (AI PNG) exist. If the audit page is not updated, it either shows dead renderers or crashes on removed functions.

**Prevention:**
1. Update flavor-audit.html to show only L0 and L5 tiers.
2. Remove references to `renderConeHDSVG`, `renderConePremiumSVG`, and `renderConeHeroSVG` from client-side code if those functions are removed from cone-renderer.js.
3. Add visual comparison: L0 SVG next to L5 PNG for each flavor, making consistency easy to verify.

**Phase to address:** Cleanup phase, after integration is complete.

---

### Pitfall 14: Scriptable Widget Cone Size Mismatch

**What goes wrong:** The iOS Scriptable widget renders cones at small sizes (approximately widget-scale, similar to L0/L1). If the AI-generated L5 PNGs are designed for hero/full-size display, they may look muddy or lose detail when downscaled to widget dimensions. Features that look great at 144x168px become indistinguishable blobs at 32x32px.

**Prevention:**
1. Use L0 micro SVG (the retained deterministic renderer) for widget-sized displays, not downscaled L5 PNGs.
2. If L5 PNGs must serve widget contexts, generate a second set at widget resolution, or ensure the L5 images have sufficient contrast and simplicity to survive aggressive downscaling.
3. Test by rendering each L5 PNG at 32x32px and verifying the flavor is still identifiable. If not, the L0 SVG is the correct choice for that context.

**Phase to address:** Integration phase. Context-specific rendering decisions must be documented.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Prompt engineering / style bible | Style drift (Pitfall 1), prompt versioning (Pitfall 9) | Generate ALL 94 in one session; version-control prompts in manifest |
| AI image generation | Color palette violation (Pitfall 7), samey output (Pitfall 8) | Post-process palette enforcement; structural constraints in prompts |
| Background removal | Fringe artifacts (Pitfall 5) | 1-bit alpha threshold; test on both light and dark backgrounds |
| File optimization | Size bloat (Pitfall 4) | 10KB per-image budget; pngquant quantization; WebP consideration |
| Service worker integration | Cache staleness (Pitfall 6) | CACHE_VERSION bump; verify on returning browser profile |
| Social card migration | SVG embedding breaks (Pitfall 3) | Keep L0 SVG for social cards; or pre-encode base64 cone lookup |
| Partial deploy | Mixed rendering styles (Pitfall 10) | 94/94 gate -- no partial deploys |
| Dead renderer cleanup | Audit page breaks (Pitfall 13), widget mismatch (Pitfall 14) | Update audit page; use L0 for small contexts |
| Long-term maintenance | Reproducibility loss (Pitfall 2) | Treat PNGs as primary artifacts; store generation manifest |

## "Looks Done But Isn't" Checklist

- [ ] **All 94 images pass consistency check:** lay out in grid, no visible style drift between neighbors
- [ ] **Generation manifest committed:** JSON file with model, prompt, seed, parameters for every accepted image
- [ ] **Background transparency clean:** no pixel has alpha between 1 and 254 (1-bit alpha enforcement)
- [ ] **File size budget met:** no single PNG exceeds 10KB; total under 1MB
- [ ] **Social cards still work:** test OG cards on Facebook Sharing Debugger and Twitter Card Validator
- [ ] **SW cache bumped:** `CACHE_VERSION` incremented in sw.js in the same commit as PNG deploy
- [ ] **PNG asset count test passes:** `worker/test/png-asset-count.test.js` verifies exactly 94 PNGs
- [ ] **Returning user upgrade path verified:** load with old cones, deploy new, reload -- new cones appear within 2 page loads
- [ ] **Dead renderers removed:** `renderConeHDSVG`, `renderConePremiumSVG`, `renderConeHeroSVG` removed from worker/src/flavor-colors.js AND docs/cone-renderer.js
- [ ] **Flavor audit page updated:** shows L0 + L5 only, not 4 dead tiers
- [ ] **Widget rendering decided:** L0 SVG or L5 PNG, tested at widget resolution
- [ ] **Golden baselines updated:** test suite updated to compare against stored PNGs, not regenerated-from-code outputs
- [ ] **No partial migration:** all 94 flavors use L5 PNG, or all 94 use the old renderer. Zero mixing.
- [ ] **Pairwise similarity check passed:** no two flavors have SSIM > 0.85

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Style drift across batch | HIGH | Must regenerate all 94 images in a single session. Partial regeneration makes drift worse. |
| Reproducibility lost, need to regenerate | MEDIUM | Use stored manifest to attempt reproduction; accept visual differences; generate 10+ variants and pick closest match |
| Social cards broken | LOW | Revert to SVG cone rendering for social cards; keep L0 renderer alive for this purpose |
| File size too large | LOW | Post-process with pngquant (lossy quantization to 256 colors); rerun optimization pipeline |
| Background fringe artifacts | LOW | Re-run background removal with stricter alpha threshold; apply 1-bit alpha as post-processing step |
| Cache staleness | LOW | Bump CACHE_VERSION; users get fresh assets on next SW activate (within 2 page loads) |
| Mixed rendering styles (partial deploy) | MEDIUM | Revert all new PNGs; return to old renderer; regenerate full set before re-attempting |
| Samey output | HIGH | Add flavor-specific structural constraints to prompts; regenerate affected flavors; may need to regenerate entire batch for consistency |
| Prompt lost for accepted image | MEDIUM | Re-examine generation tool history/logs; reconstruct prompt from masterlock template + manual adjustments |
| Widget cones unreadable at small size | LOW | Switch widget to L0 SVG renderer; no L5 PNG needed for small contexts |

## Sources

- Codebase analysis of `docs/sw.js` (stale-while-revalidate cone PNG caching, CACHE_VERSION v20)
- Codebase analysis of `docs/cone-renderer.js` (heroConeSrc slug generation, renderHeroCone fallback chain)
- Codebase analysis of `worker/src/social-card.js` (renderConeGroup SVG embedding, renderConeHDSVG dependency)
- Codebase analysis of `worker/src/flavor-colors.js` (94 FLAVOR_PROFILES, 56-color palette, 4 rendering tiers)
- Codebase analysis of `scripts/generate-hero-cones.mjs` (SVG-to-PNG pipeline via sharp at 300 DPI)
- Codebase analysis of `tools/generate_masterlock_prompts.mjs` (L0-L5 quality ladder, prompt template, per-flavor overrides)
- Codebase analysis of `worker/test/png-asset-count.test.js` (94-count assertion, slug sync verification)
- Codebase analysis of `worker/test/golden-baselines.test.js` (376 zero-tolerance pixelmatch tests across 4 tiers)
- [Retro Diffusion: Creating authentic pixel art with AI at scale](https://runware.ai/blog/retro-diffusion-creating-authentic-pixel-art-with-ai-at-scale) -- MEDIUM confidence: palette enforcement and downscaling algorithms
- [2D pixel art style guide for games](https://www.sprite-ai.art/blog/2d-pixel-art-style-guide) -- MEDIUM confidence: prompt anchoring, style locking, batch generation tips
- [AI Pixel Art: Crafting Retro Game Visuals](https://aaagameartstudio.com/blog/ai-pixel-art) -- MEDIUM confidence: consistency strategies, post-processing recommendations
- [10 AI Image Generation Mistakes](https://www.godofprompt.ai/blog/10-ai-image-generation-mistakes-99percent-of-people-make-and-how-to-fix-them) -- MEDIUM confidence: prompt structure, negative prompts, iteration patterns
- [og:image meta tag is an .svg, which is not supported by facebook](https://github.com/BreakOutEvent/breakout-frontend/issues/234) -- HIGH confidence: SVG not supported for OG images on Facebook
- [Workaround in NodeJS for SVG og:image not being supported](https://blog.termian.dev/posts/twitter-og-image-svg/) -- MEDIUM confidence: SVG-to-PNG conversion strategies
- [GitHub Storage Limits](https://gitprotect.io/blog/github-storage-limits/) -- HIGH confidence: 1GB repo recommendation, 5GB hard limit, 100MB file limit
- [Git LFS + Github Pages discussion](https://github.com/orgs/community/discussions/50337) -- HIGH confidence: GitHub Pages does NOT support Git LFS
- [Guide to using Seed in Stable Diffusion](https://getimg.ai/guides/guide-to-seed-parameter-in-stable-diffusion) -- HIGH confidence: seed determinism requirements and limitations
- [Is the seed of Stable Diffusion always resulting in the same image?](https://unimatrixz.com/blog/latent-space-stable-diffusion-seed-deterministic/) -- HIGH confidence: platform/hardware variations affect reproducibility
- [Comparing SVG and PNG file sizes](https://vecta.io/blog/comparing-svg-and-png-file-sizes) -- HIGH confidence: PNG typically 5-10x larger than SVG for equivalent graphics

---
*Pitfalls research for: v2.0 Art Quality -- AI-generated pixel art pipeline for 94 frozen custard flavor cones*
*Researched: 2026-03-18*