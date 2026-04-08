---
created: 2026-04-08T03:16:31.884Z
title: Wire hierarchical fallback into rarity labeling
area: api
files:
  - worker/src/route-today.js:111-169
  - worker/src/metrics.js:133-242
  - worker/src/social-card.js:390
  - docs/planner-domain.js:94-95
  - worker/test/rarity-threshold-consistency.test.js
---

## Problem

Rarity labels are computed per-store only. Stores with sparse data either fail Gate 1 (need 10+ appearances, 90+ day span) and show no label, or barely pass and produce misleading labels (e.g. "Ultra Rare" for a flavor that appears every ~30 days). The system has no awareness of how common a flavor is regionally or nationally.

A hierarchical metrics endpoint already exists at `/api/v1/metrics/flavor-hierarchy` (metrics.js lines 133-242) that resolves store -> metro -> state -> national scope with a 30-appearance minimum. But it's completely disconnected from the 3-gate rarity labeling in route-today.js.

## Solution

Connect the two existing systems:
1. Extract the scope-resolution logic from metrics.js into a shared function
2. Route-today.js calls scope resolution to find the best scope with enough data
3. Apply the 3-gate system (data quality, network suppression, avg_gap thresholds) at the effective scope
4. Return the label + effective scope so UI can say "Rare in Madison area" vs "Rare at this store"
5. Update social-card.js and planner-domain.js to display scope context
6. Update rarity-threshold-consistency.test.js to cover hierarchical cases
