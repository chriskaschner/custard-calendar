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
