# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Active

### Product Features
- [ ] **Voice assistant integration** — ask Siri / home assistant "what's the flavor of the day" and get a spoken response (Siri Shortcuts, HomeKit, or Alexa skill)
- [ ] **Pairwise flavor voting** — group "where should we go tonight?" — multiple people vote/rank flavors, system suggests store by combined preferences + proximity
- [ ] **Madison-area brand expansion** — selection methodology for adding new brands beyond MKE geo
- [ ] **Social shareables** — dynamic SVG-based OG cards at `/v1/og/{slug}/{date}.svg` with flavor name, store, streak/rarity stats from metrics; also create static OG preview images (`og-calendar.png`, `og-map.png`, `og-alerts.png` 1200x630) for the three HTML pages (meta tags already in place)

### Docs
- [ ] **README with SaaS positioning** — rewrite README with tongue-in-cheek enterprise voice per Language & Voice guidelines

### Infrastructure
- [ ] **Create D1 database** — run `npx wrangler d1 create custard-snapshots`, update `database_id` in `wrangler.toml`, apply migration

## Completed

- [x] API v1 versioning + Bearer auth — `/api/v1/` prefix, `Authorization: Bearer` header, legacy aliases preserved (2026-02-22)
- [x] Per-slug fetch budget — replaced global MAX_DAILY_FETCHES=50 with per-slug (3/day) + global circuit breaker (200/day) (2026-02-22)
- [x] DTSTAMP determinism — ICS calendar events use event date instead of current time (2026-02-22)
- [x] Kill dual scrapers — Python `flavor_service.py` calls Worker API instead of scraping (2026-02-22)
- [x] Strip "culvers" naming — brand-neutral variable names in `map.html` (2026-02-22)
- [x] Multi-brand config — `config.yaml` restructured with `stores:` array and `worker_base:` (2026-02-22)
- [x] D1 snapshots + metrics — dual-write KV+D1, metrics endpoints for frequency/recency/trending (2026-02-22)
- [x] Weekly digest emails — `sendWeeklyDigestEmail()` with full week forecast, star badges, frequency toggle in alerts UI (2026-02-22)
- [x] Fun email copy — rotating quips in daily + weekly alert emails (2026-02-22)
- [x] OG meta tags — `og:title`, `og:description`, `og:image`, `twitter:card` on all 3 HTML pages (2026-02-22)
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
