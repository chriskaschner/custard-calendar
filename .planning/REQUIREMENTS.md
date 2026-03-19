# Requirements: Custard Calendar v3.0 Sharpen the Core

**Defined:** 2026-03-19
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go

## v3.0 Requirements

Simplify the product, fix performance, optimize for discoverability. First milestone focused on finding users rather than adding features.

### Homepage

- [ ] **HOME-01**: User sees one primary card with today's flavor at their saved store above the fold
- [ ] **HOME-02**: Week-ahead section is collapsed by default, expandable on tap
- [ ] **HOME-03**: Page layout does not visibly shift during data load (CLS < 0.1)
- [ ] **HOME-04**: All homepage sections use a single visual language (unified card system, consistent spacing/borders)

### Simplification

- [ ] **SIMP-01**: Zero-traffic pages (compare, forecast-map, fun) are consolidated or redirected
- [ ] **SIMP-02**: Navigation reflects reduced page count with no more than 4 items
- [x] **SIMP-03**: ML prediction roadmap items formally closed (moved to Won't Do in TODO.md)

### Performance

- [ ] **PERF-01**: LCP P90 under 3 seconds (currently 10s due to Worker cold starts)

### Sharing

- [ ] **SHARE-01**: Quiz results page has optimized og:image and shareable URL for social platforms
- [ ] **SHARE-02**: Flavor rarity stats are shareable as standalone social content (OG card per flavor)

## Future Requirements

Tracked but not in current roadmap. Promote only after 10 real users provide feedback.

- **DIST-01**: Weekly "flavor intel" social content cadence leveraging historical data moat
- **DIST-02**: Culver's subreddit / local food group outreach for early adopter recruitment
- **SYNC-01**: Anonymous cross-device sync (Level 2 model with tokenized links)
- **ROUTE-01**: Named multi-route profiles (work/weekend)

## Out of Scope

| Feature | Reason |
|---------|--------|
| ML prediction pipeline (ensemble, XGBoost, confidence intervals) | 3.2% top-1 accuracy; confirmed schedule IS the product |
| New quiz modes beyond current 7 | Sufficient variety; polish over expansion |
| New API endpoints | 27+ endpoints is sufficient surface area |
| Android/Alexa widgets | Find web users first before expanding platforms |
| Feature additions before user validation | Distribution before features |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOME-01 | Phase 31 | Pending |
| HOME-02 | Phase 31 | Pending |
| HOME-03 | Phase 31 | Pending |
| HOME-04 | Phase 31 | Pending |
| SIMP-01 | Phase 32 | Pending |
| SIMP-02 | Phase 32 | Pending |
| SIMP-03 | Phase 30 | Complete |
| PERF-01 | Phase 33 | Pending |
| SHARE-01 | Phase 34 | Pending |
| SHARE-02 | Phase 34 | Pending |

**Coverage:**
- v3.0 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
