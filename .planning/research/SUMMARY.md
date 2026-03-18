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
