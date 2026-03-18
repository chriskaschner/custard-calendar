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
