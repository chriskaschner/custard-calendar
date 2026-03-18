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
