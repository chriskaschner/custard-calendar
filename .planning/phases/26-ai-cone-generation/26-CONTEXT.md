# Phase 26: AI Cone Generation - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate L5-quality AI pixel art PNGs for all 94 profiled flavors. Version-controlled prompts, post-processing pipeline, and QA gallery for human review. All 94 must pass QA before any integration begins (hard 94/94 gate).

</domain>

<decisions>
## Implementation Decisions

### Art style
- Pixel art style matching the blackberry cobbler L5 proof-of-concept -- crisp pixel edges, 32-64px density, clearly pixel-based
- Premium treatment overrides for ALL 94 flavors (not just canonical auto-generated treatments) -- marbling, realistic chunks, sauce ribbons, per-flavor texture notes
- Author 93 premium treatment overrides (blackberry cobbler already has one)
- Transparent backgrounds via gpt-image-1 native `background: 'transparent'` -- no post-processing background removal
- Cone tip same tone as rest of waffle cone (no darkened tip)
- Soft studio lighting from upper left, gentle highlight across scoop, subtle shadow under scoop lip

### Generation strategy
- Trial run first: pick 3 representative flavors, generate 3 candidates each at BOTH medium and high quality
- User reviews trial output to decide medium vs high quality for the full batch
- After quality decision: generate 3 candidates per flavor for all 94 flavors
- Total candidates: ~282 images for the full batch (after trial)

### Output dimensions + format
- PNG format (drop-in replacement, no heroConeSrc() changes needed)
- Claude's discretion on generation resolution (1024x1024 vs 1024x1536) and final post-processed dimensions
- Post-processing via sharp pipeline: trim, resize, optimize

### QA and curation workflow
- HTML gallery with accept/reject per flavor -- shows all 3 candidates side by side
- Click to accept one candidate per flavor, flag others for regeneration
- Gallery writes selections to a manifest file
- Quality bar: "reads as the right flavor" -- correct base color, visible toppings match the profile, recognizable as ice cream cone
- 94/94 approval required before integration phases begin

### Generation model
- gpt-image-1 (DALL-E 3 deprecated May 2026)
- Quality setting (medium vs high) determined by trial run comparison
- Estimated cost: ~$12 at medium quality, ~$48 at high quality (for 282 candidates)

### Claude's Discretion
- Generation resolution (1024x1024 vs 1024x1536)
- Final post-processed PNG dimensions (144x168 current vs larger for detail)
- Trial flavor selection (3 representative flavors covering different base colors and topping densities)
- Sharp post-processing parameters (trim threshold, resize kernel)
- Rate limiting / delay between API calls
- QA gallery HTML design and interaction patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Generation pipeline
- `tools/generate_ai_sprites.mjs` -- Existing AI generation script (OpenAI API calls, prompt templating, retry logic, rate limiting)
- `tools/generate_masterlock_prompts.mjs` -- Generates prompt pack + flavor fills from FLAVOR_PROFILES
- `docs/assets/masterlock-flavor-fills.json` -- Canonical prompt data for all 94 flavors (50.6KB, has base/swirls/chunks/texture per flavor)

### Proof-of-concept
- `docs/assets/blackberry-cobbler/blackberry-l5-premium.png` -- Reference L5 quality target
- `docs/assets/blackberry-cobbler/blackberry-prompts.md` -- Locked prompt template + premium treatment example
- `docs/assets/blackberry-cobbler/blackberry-asset-manifest.json` -- Manifest structure with palettes and treatments

### Post-processing
- `scripts/generate-hero-cones.mjs` -- Existing sharp PNG pipeline (300 DPI, nearest-neighbor kernel, 144x168 output)

### Color data
- `worker/src/flavor-colors.js` -- Canonical FLAVOR_PROFILES, BASE_COLORS, TOPPING_COLORS, RIBBON_COLORS

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate_ai_sprites.mjs`: Already calls OpenAI API with prompt templating, retry logic (3 attempts), rate limiting (configurable --delay), and per-flavor targeting (--flavor flag). Supports gpt-image-1 via --model flag.
- `masterlock-flavor-fills.json`: All 94 flavor fill cards with base color, swirls, chunks, texture notes. Generated from FLAVOR_PROFILES.
- `generate-hero-cones.mjs`: Sharp pipeline for SVG-to-PNG at 300 DPI with nearest-neighbor kernel. Can be adapted for AI PNG post-processing.
- `masterlock-audit.html`: Browser-based audit UI showing all tiers per flavor. Could be adapted for QA gallery.

### Established Patterns
- Flavor slug generation: lowercase, hyphens (e.g., `really-reese-s.png`)
- Asset output to `docs/assets/cones/{slug}.png` (client) and `docs/assets/sprites/` (pre-generated)
- Manifest JSON files track generation metadata per flavor

### Integration Points
- `heroConeSrc()` in cone-renderer.js looks up `assets/cones/{slug}.png` -- final PNGs go here
- Service worker caches `assets/cones/*.png` with CACHE_VERSION gating
- `masterlock-flavor-fills.json` is the prompt data source, generated by `generate_masterlock_prompts.mjs` from canonical FLAVOR_PROFILES

</code_context>

<specifics>
## Specific Ideas

- Trial run of 3 flavors at both quality levels before committing to the full batch
- The blackberry cobbler L5 PNG is the quality reference -- all 94 should be recognizably the same aesthetic
- User reviews trial output in a comparison view to make the medium-vs-high decision empirically

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 26-ai-cone-generation*
*Context gathered: 2026-03-18*
