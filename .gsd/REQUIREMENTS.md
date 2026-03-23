# Requirements

## Active

### SIMP-01 — Zero-traffic pages (compare, forecast-map, fun) are consolidated or redirected

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Zero-traffic pages (compare, forecast-map, fun) are consolidated or redirected

### SIMP-02 — Navigation reflects reduced page count with no more than 4 items

- Status: active
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Navigation reflects reduced page count with no more than 4 items

## Validated

### SHARE-01 — Quiz results page has optimized og:image and shareable URL for social platforms

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: S05
- Validation: PNG og:image via /og/quiz/{archetype}/{flavor}.png (workers-og). Shareable URL quiz.html?archetype=X&flavor=Y triggers skip-to-result. Crawler interception serves og:title/og:image/og:description. 59 Worker tests. Share button generates flavor-themed text.

Quiz results page has optimized og:image and shareable URL for social platforms

### SHARE-02 — Flavor rarity stats are shareable as standalone social content (OG card per flavor)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: S05
- Validation: PNG og:image via /og/flavor/{flavor-name}.png with rarity label and appearance stats. Crawler interception routes radar.html?flavor=X and index.html?flavor=X to flavor OG cards. Week strip share icons copy radar.html?flavor=X to clipboard. ?flavor=X on homepage highlights and scrolls to matching card.

Flavor rarity stats are shareable as standalone social content (OG card per flavor)

### HOME-01 — User sees one primary card with today's flavor at their saved store above the fold

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

User sees one primary card with today's flavor at their saved store above the fold

### HOME-02 — Week-ahead section is collapsed by default, expandable on tap

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Week-ahead section is collapsed by default, expandable on tap

### HOME-03 — Page layout does not visibly shift during data load (CLS < 0.1)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

Page layout does not visibly shift during data load (CLS < 0.1)

### HOME-04 — All homepage sections use a single visual language (unified card system, consistent spacing/borders)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

All homepage sections use a single visual language (unified card system, consistent spacing/borders)

### SIMP-03 — ML prediction roadmap items formally closed (moved to Won't Do in TODO.md)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

ML prediction roadmap items formally closed (moved to Won't Do in TODO.md)

### PERF-01 — LCP P90 under 3 seconds (currently 10s due to Worker cold starts)

- Status: validated
- Class: core-capability
- Source: inferred
- Primary Slice: none yet

LCP P90 under 3 seconds (currently 10s due to Worker cold starts)

## Deferred

## Out of Scope
