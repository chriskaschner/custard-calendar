# Requirements: Custard Calendar v1.5 Visual Polish

**Defined:** 2026-03-13
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go -- no friction, no hunting through pages.

## v1.5 Requirements

### Design Tokens

- [x] **DTKN-01**: All semantic state colors (confirmed, watch, warning, success) use CSS custom properties instead of hardcoded hex values
- [x] **DTKN-02**: Rarity color scale unified to one palette across all contexts (map popups, today badges, compare badges)
- [x] **DTKN-03**: All 77 inline styles across compare.html, index.html, and forecast-map.html headers replaced with CSS classes using design tokens
- [x] **DTKN-04**: Focus/hover states use consistent rgba values derived from brand color via color-mix()

### Card & Button

- [x] **CARD-01**: All card-like elements across all pages inherit from .card base class with consistent border, shadow, and border-radius
- [x] **CARD-02**: Button system consolidated from 14 definitions to 3 base types (.btn-primary, .btn-secondary, .btn-text) with consistent padding
- [x] **CARD-03**: No inline style overrides of button properties anywhere in the codebase
- [x] **CARD-04**: JS innerHTML-generated card/button HTML uses CSS classes instead of hardcoded styles

### Compare UX

- [x] **COMP-01**: User arriving at Compare page with no stores sees a single coherent onboarding flow, not competing store pickers
- [x] **COMP-02**: Header "change" button on Compare page behaves consistently with Compare's multi-store context
- [x] **COMP-03**: Compare page initializes from geolocated store within 3 seconds without requiring double interaction

### Cone Rendering

- [x] **CONE-01**: Hero cone tier (36x42) has higher topping density filling empty center columns of the scoop
- [x] **CONE-02**: Toppings use per-type shapes (not uniform 2x2 squares) for visual distinction at hero and HD sizes
- [x] **CONE-03**: Topping distribution is visually coherent and consistent across all 94 flavor profiles
- [x] **CONE-04**: All 94 Hero cone PNGs regenerated with updated renderer and golden baselines refreshed

### Test Health

- [ ] **TEST-01**: Dead skipped browser tests from Drive removal (5 tests across 3 files) removed or replaced
- [ ] **TEST-02**: map-pan-stability.spec.mjs test passes reliably (timeout addressed)
- [ ] **TEST-03**: All remaining skipped tests documented with rationale or fixed

## Future Requirements

### Design System (v2+)

- **DTKN-F1**: Fronts page dark-mode palette (~60 values) tokenized under scoped namespace
- **DTKN-F2**: Page-scoped style blocks consolidated into style.css

### Cone Rendering (v2+)

- **CONE-F1**: Texture variation (hash-based per-profile visual noise)
- **CONE-F2**: Premium tier rehabilitation for production use

## Out of Scope

| Feature | Reason |
|---------|--------|
| New CSS framework or preprocessor | No-build-step constraint; vanilla CSS sufficient |
| Fronts dark-mode tokenization | ~60 values scoped to one page; lower priority than cross-site tokens |
| Page-scoped style block consolidation | Adds style.css size without cross-page benefit |
| SharedNav global behavior changes | Too broad; only Compare-specific interaction changes |
| Worker/API changes | Presentation-layer only milestone |
| New features or pages | Polish milestone, not feature milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DTKN-01 | Phase 20 | Complete |
| DTKN-02 | Phase 20 | Complete |
| DTKN-03 | Phase 22 | Complete |
| DTKN-04 | Phase 20 | Complete |
| CARD-01 | Phase 21 | Complete |
| CARD-02 | Phase 21 | Complete |
| CARD-03 | Phase 21 | Complete |
| CARD-04 | Phase 21 | Complete |
| COMP-01 | Phase 23 | Complete |
| COMP-02 | Phase 23 | Complete |
| COMP-03 | Phase 23 | Complete |
| CONE-01 | Phase 24 | Complete |
| CONE-02 | Phase 24 | Complete |
| CONE-03 | Phase 24 | Complete |
| CONE-04 | Phase 24 | Complete |
| TEST-01 | Phase 25 | Pending |
| TEST-02 | Phase 25 | Pending |
| TEST-03 | Phase 25 | Pending |

**Coverage:**
- v1.5 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
