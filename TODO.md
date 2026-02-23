# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Active

### Product Features
- [x] **Voice assistant integration (Siri)** — `/api/v1/today` endpoint with `spoken` field, `docs/siri.html` setup page with store picker + live preview. User builds 3-action Shortcut and shares via iCloud link.
- [x] **Flavor Radar (Phase 1)** — 7-day personalized flavor outlook at `docs/radar.html`. Store picker, favorite flavor picker (up to 3), timeline blending confirmed data with ML predictions. Confidence-bucketed prediction bars, overdue favorites, similar flavor suggestions. Multi-day `generate_multiday_forecast_json()` in batch pipeline with `--days` flag. 5 Python tests + 1 Worker test.
- [x] **Flavor Radar Phase 2** — cross-store "Next Best Store" recommendations, rarity/streak badges, forecast accuracy dashboard (2026-02-22)
- [ ] **Alexa skill** — custom Alexa skill using `/api/v1/today` endpoint (requires Amazon developer account + certification)
- [ ] **Flavor chatbot assistant** — conversational Q&A for flavor info (e.g., today's flavor, upcoming week, nearby stores with a flavor) via web chat UI and `/api/v1` endpoints
- [x] **Forecast accuracy tracking** — compare predictions vs actual flavors for WI stores; compute hit rate metrics to retrain models (2026-02-23)
- [ ] **Pairwise flavor voting** — group "where should we go tonight?" (deprioritized per WORKLOG)
- [ ] **Madison-area brand expansion** — selection methodology for adding new brands beyond MKE geo
- [x] **Forecast-style weekly email** — feed ML predictions into weekly digest emails with weather-style prose (Worker code done, batch pipeline + D1 upload wired) (2026-02-23)
- [x] **Accuracy + snapshot hardening** -- future-date guard, snapshot upsert, cron harvest with D1 cursor, KV 429 resilience, trending date bound, backfill script, coverage gate (2026-02-23)
- [x] **Forecast pipeline reliability** — coverage gate hard-fails on D1 errors, backfill filters closed-day sentinels, upload guards (per-store >=3 days + global 10% floor), coverage metrics endpoint (2026-02-23)

### Bugs / Polish
- [ ] **HD cone topping density** — toppings are sparse and symmetrically mirrored around center axis; should be denser and asymmetric for more visual interest
- [ ] **OG share image** — replace generic card with pixel-art cloud raining custard cones (current tilted mint cone is a placeholder)
- [x] **Siri page broken** — `stores.json` parsed as raw object instead of extracting `.stores` array (2026-02-23)
- [ ] **Google Calendar subscription alerts** — ICS events trigger default reminders; added `X-APPLE-DEFAULT-ALARM:FALSE` for Apple Calendar, but Google Calendar subscriptions require user to manually disable notifications in calendar settings
- [x] **Google Calendar event color** — calendar events use Blueberry colorId 9, closest to Culver's #005696 (2026-02-23)
- [x] **Radar rarity badges all "Rare"** — replaced absolute thresholds with percentile-based ranking (bottom 10% = Ultra Rare, 25% = Rare, 50% = Uncommon) with 10-flavor sample floor (2026-02-23)
- [x] **Radar next-best-store empty** — added confirmed-schedule fallback: checks `/api/v1/flavors` when forecast unavailable, separate ranking path, "Confirmed" badge (2026-02-23)
- [x] **Forecast weather graphic** — confidence strips at top of each day card (blue=confirmed, green=high, amber=medium, grey=low) + mini pixel-art cones next to flavor names (2026-02-23)
- [x] **Flavor-of-the-day pixel art** — canonical flavor color system at `/api/v1/flavor-colors` (29 profiles), social card cones replace emoji, Radar mini-cones with flavor-colored prediction bars (2026-02-23)
- [x] **Cross-page display consistency** — standardized store names (Brand + em-dash + City, State + Address), date formats (Today/Tomorrow labels, em-dashes), confidence strips on Forecast week cards, prediction cone scale normalization across all 5 pages (2026-02-23)

### Docs
(none)

## Completed

- [x] Flavor intelligence analytics pipeline — 6-phase ML system: data loader, basic metrics (frequency/recency/entropy/surprise), pattern detection (DOW bias, Markov transitions, seasonality), collaborative filtering (NMF store clustering), prediction models (frequency+recency, Markov+recency), LLM integration (embeddings, forecast writer), batch forecast generation, Worker `/api/v1/forecast/{slug}` endpoint. 79 Python tests + 5 Worker tests. (2026-02-22)
- [x] README with SaaS positioning — enterprise-voice README with API v1 docs, brand registry, D1 schema, full project structure (2026-02-22)
- [x] Social shareables — dynamic SVG OG cards at `/v1/og/{slug}/{date}.svg` + static OG images for all 3 HTML pages (2026-02-22)
- [x] Metrics HTTP integration tests — 9 tests covering all 3 metrics endpoints (2026-02-22)
- [x] Create D1 database — `custard-snapshots` created, migration applied (2026-02-22)

- [x] API v1 versioning + Bearer auth — `/api/v1/` prefix, `Authorization: Bearer` header, legacy aliases preserved (2026-02-22)
- [x] KV write hardening — removed KV fetch counters, made cache writes best-effort, and added cache-integrity checks for slug-scoped records (2026-02-22)
- [x] DTSTAMP determinism — ICS calendar events use event date instead of current time (2026-02-22)
- [x] Kill dual scrapers — Python `flavor_service.py` calls Worker API instead of scraping (2026-02-22)
- [x] Strip "culvers" naming — brand-neutral variable names in `map.html` (2026-02-22)
- [x] Multi-brand config — `config.yaml` restructured with `stores:` array and `worker_base:` (2026-02-22)
- [x] D1 snapshots + metrics — D1-backed metrics endpoints for frequency/recency/trending (2026-02-22)
- [x] Weekly digest emails — `sendWeeklyDigestEmail()` with full week forecast, star badges, frequency toggle in alerts UI (2026-02-22)
- [x] Fun email copy — rotating quips in daily + weekly alert emails (2026-02-22)
- [x] OG meta tags — `og:title`, `og:description`, `og:image`, `twitter:card` on all 3 HTML pages (2026-02-22)
- [x] Daily snapshot persistence — D1-backed snapshot storage (KV snapshot writes removed) (2026-02-22)
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
