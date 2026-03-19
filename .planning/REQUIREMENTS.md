# Requirements: Custard Calendar v2.0 Art Quality

**Defined:** 2026-03-18
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go

## v2.0 Requirements

Requirements for the two-tier cone art pipeline: L0 micro SVG + L5 AI-generated PNGs.

### Generation

- [ ] **GEN-01**: All 94 profiled flavors have L5-quality AI-generated pixel art PNGs with transparent backgrounds
- [x] **GEN-02**: Generation prompts are version-controlled in a prompt manifest file per flavor
- [ ] **GEN-03**: QA gallery HTML page displays all 94 generated PNGs side-by-side for visual review before deploy
- [x] **GEN-04**: Generated PNGs are post-processed (trimmed, resized, optimized) via sharp pipeline

### Integration

- [x] **INT-01**: Today page hero cone displays L5 PNG for all 94 flavors (no HD SVG fallback)
- [x] **INT-02**: Quiz result cone displays L5 PNG instead of HD SVG
- [x] **INT-03**: Scriptable widget uses shared art pipeline (L0 or L5 PNG) instead of its own drawConeIcon renderer
- [x] **INT-04**: Worker social-card.js embeds L5 PNGs instead of inline SVG rects for OG images
- [x] **INT-05**: Service worker cache version bumped to serve fresh L5 PNGs

### Cleanup

- [x] **CLN-01**: Dead SVG renderers removed from cone-renderer.js (renderMiniConeHDSVG, HD scatter utilities)
- [x] **CLN-02**: Dead SVG renderers removed from worker/src/flavor-colors.js (renderConeHeroSVG, renderConePremiumSVG, renderConeHDSVG)
- [x] **CLN-03**: flavor-audit.html updated to show L0 + L5 tiers only, intermediate columns removed
- [x] **CLN-04**: Pixelmatch golden baselines regenerated for new L5 PNGs

## Future Requirements

### Enhancements

- **ENH-01**: WebP format with format negotiation for 25-35% size reduction
- **ENH-02**: Retina-resolution PNGs (2x or 3x) for high-DPI displays
- **ENH-03**: L0 topping-edge-clipping fix (toppings intersecting scoop boundary at small sizes)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New flavor profile authoring | Existing 94 profiles are complete; new flavors added as discovered |
| Animated cone assets | Complexity far exceeds value; static PNGs sufficient |
| Per-store custom cone art | One cone per flavor, not per store |
| Dark mode cone variants | Same art works on both backgrounds |
| 3D/WebGL cone rendering | Over-engineered for a flavor tracker |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | Phase 26 | Pending |
| GEN-02 | Phase 26 | Complete |
| GEN-03 | Phase 26 | Pending |
| GEN-04 | Phase 26 | Complete |
| INT-01 | Phase 27 | Complete |
| INT-02 | Phase 27 | Complete |
| INT-03 | Phase 29 | Complete |
| INT-04 | Phase 28 | Complete |
| INT-05 | Phase 27 | Complete |
| CLN-01 | Phase 27 | Complete |
| CLN-02 | Phase 28 | Complete |
| CLN-03 | Phase 27 | Complete |
| CLN-04 | Phase 27 | Complete |

**Coverage:**
- v2.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
