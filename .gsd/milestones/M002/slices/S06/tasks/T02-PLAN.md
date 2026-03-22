# T02: Week Ahead art migration + widget fix

**Slice:** S06 — **Milestone:** M002

## Description

Replace renderMiniConeSVG() with renderHeroCone() in the Week Ahead strip so cones display L5 PNGs instead of L0 SVGs. CSS handles downscaling to 40px width within week-ahead cards. Debug and fix getConeImage() PNG loading failure in Scriptable widget (likely CDN URL, alias coverage, or network issue). Improve DrawContext fallback to render a triangular cone shape instead of map-pin circles.

## Must-Haves

- [ ] "Week Ahead cones render as L5 hero PNGs (not L0 SVG inline cones)"
- [ ] "Week Ahead PNG fallback to L0 SVG works when PNG fails to load"
- [ ] "Scriptable widget getConeImage() successfully loads L5 PNGs from CDN"
- [ ] "Widget DrawContext fallback renders triangular cone shape, not circle/pin"

## Files

- `docs/today-page.js`
- `docs/cone-renderer.js`
- `docs/style.css`
- `widgets/custard-today.js`
- `docs/assets/custard-today.js`
