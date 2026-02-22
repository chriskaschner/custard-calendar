# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Active

### Code Quality / Branding
- [ ] **Strip "culvers" from non-brand-specific code** — rename variables, function names, CSS classes, and labels that say "culvers" but aren't Culver's-specific (e.g. `doCulversSearch` → `doStoreSearch`, `culversData` → `primaryData`, CSS `.brand-culvers` as default)
- [ ] **Eliminate dual scraping** — Python `flavor_service.py` and JS `flavor-fetcher.js` both scrape Culver's `__NEXT_DATA__`. Pick one source of truth or unify behind the Worker API

### API / Infrastructure
- [ ] **Freeze API schema and versioning** — add `/v1/` prefix or version header to Worker endpoints before external consumers depend on them
- [ ] **Dad jokes / emojis in alert emails** — make daily alert emails more fun and on-brand

### Metrics & Forecasting
- [ ] **Implement first three metrics** — frequency, recency, and diversity metrics on top of snapshot data
- [ ] **Weather-style narrative layer** — "flavor forecast" prose for weekly summaries
- [ ] **Forecast-style weekly email** — weekly digest with upcoming flavor predictions

### Product Features
- [ ] **Pairwise flavor voting** — group "where should we go tonight?" — multiple people vote/rank flavors, system suggests store by combined preferences + proximity
- [ ] **Shareable social card** — OG image / share card template for flavor results
- [ ] **Madison-area brand expansion** — selection methodology for adding new brands beyond MKE geo

### Docs
- [ ] **README with SaaS positioning** — rewrite README with tongue-in-cheek enterprise voice per Language & Voice guidelines

## Completed

- [x] Daily snapshot persistence — append-only triple-write in KV (2026-02-22)
- [x] Tidbyt brand-agnostic theming — config-driven brand colors/labels (2026-02-22)
- [x] Language & voice guidelines — documented in CLAUDE.md (2026-02-22)
- [x] Tidbyt community app — `apps/culversforecast/` (2026-02-22)
- [x] Unified distance-sorted store results — haversine distance, single flat list (2026-02-22)
- [x] Flavor alert email subscriptions — double opt-in, Resend, cron, security (2026-02-21)
- [x] Geocode all stores — 1,012 locations with lat/lng (2026-02-21)
- [x] Brand flavor matching on map — brand stores match flavor searches (2026-02-22)
- [x] MKE custard hipster easter egg quips (2026-02-21)
- [x] Map pan/zoom dynamic search with reverse geocoding (2026-02-21)
- [x] Brand chip filter UI replacing "Not Culver's" toggle (2026-02-21)
- [x] Custom flavor autocomplete dropdown (2026-02-21)
- [x] custard.chriskaschner.com subdomain + HTTPS (2026-02-21)
