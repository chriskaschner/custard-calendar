# External Integrations

**Analysis Date:** 2026-03-07

All paths are relative to `custard-calendar/` unless noted.

## APIs & External Services

### Upstream Data Sources (Flavor Fetching)

Six brand-specific fetchers scrape flavor data from restaurant websites. All fetching happens in the Cloudflare Worker.

**Culver's:**
- Source: `https://www.culvers.com/restaurants/{slug}` (Next.js site)
- Parser: `worker/src/flavor-fetcher.js` -- extracts `__NEXT_DATA__` JSON blob from HTML
- Data path: `props.pageProps.page.customData.restaurantCalendar.flavors`
- Rate limit: Undocumented; respect crawl-delay

**Kopp's Frozen Custard (Milwaukee):**
- Source: `https://www.kopps.com/flavor-forecast`
- Parser: `worker/src/kopp-fetcher.js` -- HTML parsing
- Slug pattern: `kopps-*` (e.g., `kopps-greenfield`, `kopps-brookfield`, `kopps-glendale`)
- Shared KV prefix: `flavors:kopps-shared`

**Gille's Frozen Custard (Milwaukee):**
- Source: `https://gillesfrozencustard.com/flavor-of-the-day`
- Parser: `worker/src/gilles-fetcher.js` -- HTML parsing
- Slug: `gilles`

**Hefner's Frozen Custard (West Allis):**
- Source: `https://www.hefnerscustard.com`
- Parser: `worker/src/hefners-fetcher.js` -- HTML parsing
- Slug: `hefners`

**Kraverz (Fond du Lac):**
- Source: `https://kraverzcustard.com/FlavorSchedule`
- Parser: `worker/src/kraverz-fetcher.js` -- HTML parsing
- Slug: `kraverz`

**Oscar's Frozen Custard (Milwaukee area):**
- Source: `https://www.oscarscustard.com/index.php/flavors/`
- Parser: `worker/src/oscars-fetcher.js` -- HTML parsing
- Slug pattern: `oscars*` (e.g., `oscars-muskego`, `oscars-new-berlin`)
- Shared KV prefix: `flavors:oscars-shared`

**Brand Registry:** `worker/src/brand-registry.js` maps slug patterns to fetcher functions. Default (no pattern match) = Culver's.

### Email (Resend)

- Service: [Resend](https://resend.com)
- SDK/Client: Direct `fetch()` to `https://api.resend.com/emails` (no SDK)
- Implementation: `worker/src/email-sender.js`
- Auth: `RESEND_API_KEY` (Wrangler secret)
- From address: `ALERT_FROM_EMAIL` env var (default: `alerts@custard-calendar.com`, production: `alerts@custard.chriskaschner.com`)
- Uses:
  - Flavor alert emails (daily matches for subscriber favorites)
  - Weekly digest emails
  - Confirmation emails (double opt-in)
  - Weekly analytics report to operator
  - Operator alert emails (parse failures, anomalies)
- Headers: Includes `List-Unsubscribe` per Gmail/Yahoo requirements (Feb 2024)

### Google Calendar API

- Service: Google Calendar API v3
- SDK: `google-api-python-client` (Python)
- Auth: OAuth 2.0 via `google-auth-oauthlib` (installed app flow)
- Credential files: `~/.config/custard-calendar/credentials.json` (preferred) or `credentials/credentials.json` (legacy, gitignored)
- Token file: `~/.config/custard-calendar/token.json` or `credentials/token.json`
- Scopes: `https://www.googleapis.com/auth/calendar`
- Implementation: `src/calendar_sync.py`
- Calendar ID: Configured in `config.yaml` (`google_calendar.calendar_id`)
- Operations: Create/update all-day events with flavor names, descriptions, backup options
- Event format: Summary = `[ice cream emoji] {flavor_name}`, transparency = "free", no reminders

### Tidbyt API

- Service: Tidbyt device push API
- SDK: Pixlet CLI (`pixlet push`)
- Auth: `TIDBYT_API_TOKEN` (environment variable, set in `.env` locally, GitHub secret in CI)
- Device ID: Configured in `config.yaml` (`tidbyt.device_id`)
- Implementation: `main.py` (step_tidbyt_render_push function, lines 112-205)
- Flow: Pixlet renders Starlark app to .webp, then pushes to device via API
- Display: 64x32 pixel LED matrix

### Geolocation (Cloudflare)

- Service: Cloudflare's built-in `request.cf` object
- No external API call -- uses Cloudflare edge network's IP geolocation
- Implementation: `worker/src/index.js` (`handleApiGeolocate` function)
- Returns: lat, lon, state, city, country
- Endpoint: `GET /api/v1/geolocate`
- Cache: `private, no-store` (per-user IP-based)

### OpenStreetMap / Nominatim

- Service: OSM Nominatim geocoding API
- Rate limit: 1 req/sec (strictly enforced)
- Used by: `tools/build_manifest.py` (store manifest generation)
- Cache: `tools/osm_cache.json` (local file cache to reduce API calls)
- Not used at runtime -- only for offline tooling

### Internet Archive Wayback Machine

- Service: Wayback Machine CDX API + playback endpoints
- Rate limits: CDX ~50 req/min, playback ~12 req/min
- Used by: `scripts/backfill_wayback_isolated.py` (historical data backfill)
- Token bucket rate limiting implemented in script
- Not used at runtime -- only for offline data backfill

## Data Storage

### Cloudflare KV (FLAVOR_CACHE)

- Binding: `FLAVOR_CACHE` (defined in `worker/wrangler.toml`)
- KV Namespace ID: `1642a7da91e144cb9b233b940430250c`
- TTL: 24 hours for flavor data cache
- Implementation: `worker/src/kv-cache.js`
- Key patterns:
  - `flavors:{slug}` -- Cached flavor data per store
  - `flavors:kopps-shared` / `flavors:oscars-shared` -- Shared cache for multi-location brands
  - `alert:sub:{id}` -- Individual alert subscriptions
  - `alert:index:subscriptions:v1` -- Materialized subscription index
  - `alert:dedup:{slug}:{date}:{flavor}:{email}` -- Dedup keys for sent alerts
  - `meta:last-alert-run` -- Cron observability metadata
  - `meta:parse-fail-count:{date}` -- Daily parse failure counter
  - `meta:parse-fail-count:brand:{brand}:{date}` -- Per-brand parse failure counter
  - `meta:snapshot-errors:{date}` -- Daily snapshot write error counter
  - `meta:email-errors:{date}` -- Daily email error counter
  - `meta:payload-anomaly-count:{date}` -- Daily payload anomaly counter
  - `rl:{prefix}:{ip}:{hour-bucket}` -- Rate limit counters (1h TTL)
- Writes are best-effort via `safeKvPut()` -- failures are non-fatal

### Cloudflare D1 (custard-snapshots)

- Binding: `DB` (defined in `worker/wrangler.toml`)
- Database name: `custard-snapshots`
- Database ID: `fa11cb69-1e34-439c-8895-f1c0a938a543`
- Migrations: `worker/src/migrations/` (10 migrations)
- Implementation: `worker/src/snapshot-writer.js`
- Tables (derived from migration names):
  - `snapshots` -- Historical flavor observations (slug, date, flavor, normalized_flavor, description, fetched_at, brand)
  - `cron_runs` -- Cron execution audit log (handler, ran_at, checked, sent, errors_count, duration_ms)
  - `forecasts` -- ML prediction data (uploaded from Python analytics)
  - `accuracy` -- Forecast accuracy metrics
  - `cron_state` -- Cursor state for batched cron operations
  - `quiz_events` -- Quiz interaction tracking
  - `store_reliability` -- Per-store reliability index
  - `interaction_events` -- Frontend interaction events (v2)
- Conflict resolution: `ON CONFLICT(slug, date) DO UPDATE` with 7-day recency window

### Local File Cache

- Path: `custard-calendar/flavor_cache.json` (gitignored)
- Written by: `src/flavor_service.py` (`fetch_and_cache()`)
- Read by: `src/calendar_sync.py`, `main.py` (Tidbyt step)
- Format: JSON with version, timestamp, and locations map
- Stale fallback: If Worker API is down, copies stale data from existing cache

### Local Data Files

- `data/` -- Backfill data, SQLite databases (gitignored)
- `analytics/status/` -- Analytics pipeline status (gitignored)
- `data/forecasts/` -- Generated forecast files (gitignored)

## File Storage

- Local filesystem only for cache and data files
- No cloud file/object storage (S3, R2, etc.)
- Static assets served from `docs/` directory via GitHub Pages

## Caching

**Edge cache (Cloudflare):**
- Calendar `.ics` responses cached at Cloudflare edge (`caches.default`)
- API responses: `Cache-Control: public, max-age=3600` (1 hour) for flavor data
- Static config endpoints: `Cache-Control: public, max-age=86400` (24 hours)
- Geolocation: `Cache-Control: private, no-store`

**Service Worker (browser):**
- `docs/sw.js` -- Stale-while-revalidate for static assets
- Network-first for API and .ics requests
- Cache version: `custard-v7`

**KV cache (Worker):**
- 24-hour TTL on all flavor data
- Snapshot writes piggyback on cache misses (no extra upstream fetches)

## Authentication & Identity

**Admin API Access:**
- Bearer token auth for admin-only routes
- Token: `ADMIN_ACCESS_TOKEN` Wrangler secret (with `ACCESS_TOKEN` legacy fallback)
- Implementation: `worker/src/index.js` (`checkAdminAccess` function)
- Protected routes: `/api/events/summary`, `/api/quiz/personality-index`, `/api/analytics/geo-eda`, `/api/metrics/accuracy`, `/api/metrics/accuracy/{slug}`, `/api/operator-alert/test`

**Alert Subscriptions:**
- Double opt-in email verification
- Per-subscriber unsubscribe tokens (stored in KV)
- No user accounts, no passwords, no sessions
- Implementation: `worker/src/subscription-store.js`, `worker/src/alert-routes.js`

**Google Calendar OAuth:**
- OAuth 2.0 installed app flow (local browser redirect)
- Scope: calendar read/write
- Tokens stored locally (not in cloud)

**Frontend:**
- No authentication
- Store preferences in `localStorage` (`custard:v1:preferences` key)
- URL params override localStorage for shareability

## Rate Limiting

Implementation: `worker/src/rate-limit.js` -- IP-based, fixed-window (1 hour), KV-backed.

| Route | Limit | Window |
|-------|-------|--------|
| `POST /api/events` | 120/hour | Per IP |
| `POST /api/quiz/events` | 120/hour | Per IP |
| `POST /api/group/create` | 10/hour | Per IP |
| `POST /api/group/vote` | 60/hour | Per IP |
| `GET /og/*` | 60/hour | Per IP |
| `GET /api/metrics/*` | 120/hour | Per IP |
| `GET /api/forecast/{slug}` | 120/hour | Per IP |
| `GET /api/flavor-stats/{slug}` | 120/hour | Per IP |
| `GET /api/signals/*` | 120/hour | Per IP |
| `GET /api/plan` | 120/hour | Per IP |
| `GET /api/drive` | 120/hour | Per IP |
| `GET /api/alerts/*` | 120/hour | Per IP |

## Monitoring & Observability

**Health Endpoint:**
- `GET /health` -- Returns KV reachability, D1 status, last cron run, daily parse failure counts (total + per-brand), snapshot errors, email errors, payload anomalies
- Status: `ok` or `degraded`

**Cron Observability:**
- All cron runs logged to D1 `cron_runs` table with handler, timestamp, counts, errors, duration
- Operator alerts via email when: parse failures exceed threshold, payload anomalies detected, consecutive error days
- Implementation: `worker/src/operator-alerts.js`

**Error Tracking:**
- `console.error` logging in Worker (visible in Cloudflare dashboard)
- KV counters for daily error budgets (parse failures, snapshot errors, email errors)
- No Sentry, no Datadog, no external APM

**Logs:**
- Python: `logging` module with `INFO` level, timestamped format
- Worker: `console.log/error/warn` (Cloudflare Workers logs)
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- API: Cloudflare Workers (deployed via `wrangler deploy`)
- Frontend: GitHub Pages (auto-deploy from `docs/` directory on `main` branch)
- Custom domain: `custard.chriskaschner.com`

**CI Pipeline (GitHub Actions):**

| Workflow | File | When | What |
|----------|------|------|------|
| CI | `.github/workflows/ci.yml` | Push/PR to main | Worker tests, Python tests, repo structure check |
| Security | `.github/workflows/security.yml` | Push/PR to main | TruffleHog secret scanning (verified secrets only) |
| Data Quality | `.github/workflows/data-quality.yml` | Weekly Sunday + manual | D1 backfill coverage (90% threshold), metrics seed freshness (45 days) |
| Tidbyt Push | `.github/workflows/tidbyt-daily.yml` | Daily noon UTC + manual | Fetch flavors, render Starlark, push to Tidbyt device |

**Tidbyt sub-repo CI:**
- `.github/workflows/check.yml` in `custard-tidbyt/` -- Pixlet syntax check, render test, API smoke test

**Deployment:**
- Worker: Manual via `cd worker && npx wrangler deploy`
- Frontend: Automatic via GitHub Pages on push to main
- No staging environment
- No automated Worker deployment in CI (manual deploy only)

## CORS Configuration

- Default allowed origin: `https://custard.chriskaschner.com`
- Alert subscription origins: Also allows `https://custard.today`, `https://chriskaschner.github.io`, localhost
- Public write origins: Also allows localhost
- Localhost origins auto-allowed for development (`/^https?:\/\/localhost(:\d+)?$/`)

## Webhooks & Callbacks

**Incoming (Cron Triggers):**
- Cloudflare Worker cron triggers defined in `worker/wrangler.toml`:
  - `0 12 * * *` (daily noon UTC) -- Alert check, snapshot harvest, reliability refresh, operator alerts
  - `0 14 * * 7` (Sunday 2 PM UTC) -- Weekly digest emails
  - `0 14 * * 1` (Monday 2 PM UTC) -- Weekly analytics report email

**Outgoing:**
- None. The Worker does not call external webhooks. All outbound communication is via email (Resend) or device push (Tidbyt API).

## Security Headers

All API responses include (set in `worker/src/index.js`):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'`

## API Surface Summary

The Worker exposes a versioned API at `/api/v1/` (canonical paths strip the `/v1/` prefix internally):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/today` | GET | Today's flavor for a store |
| `/api/v1/flavors` | GET | Multi-day flavor data for a store |
| `/api/v1/stores` | GET | Store search (min 2 chars) |
| `/api/v1/geolocate` | GET | IP-based geolocation |
| `/api/v1/nearby-flavors` | GET | Flavors at nearby stores |
| `/api/v1/flavors/catalog` | GET | Full flavor catalog |
| `/api/v1/flavor-config` | GET | Brand colors, similarity groups, flavor families |
| `/api/v1/flavor-colors` | GET | Flavor color system for visualization |
| `/api/v1/flavor-stats/{slug}` | GET | Per-store flavor statistics |
| `/api/v1/forecast/{slug}` | GET | ML forecast for a store |
| `/api/v1/reliability` | GET | Store reliability index |
| `/api/v1/plan` | GET | Planner data (multi-store + enrichment) |
| `/api/v1/drive` | GET | "Today's Drive" ranked store comparison |
| `/api/v1/signals/{slug}` | GET | Flavor signals (day-of-week patterns, streaks) |
| `/api/v1/events` | GET/POST | Interaction event tracking |
| `/api/v1/trivia` | GET | Trivia questions |
| `/api/v1/quiz/*` | GET/POST | Quiz modes and events |
| `/api/v1/leaderboard/*` | GET | Trivia leaderboards |
| `/api/v1/alerts/*` | GET/POST | Alert subscriptions (subscribe, confirm, unsubscribe, manage) |
| `/api/v1/metrics/*` | GET | Analytics metrics (intelligence, context, trending, coverage, health) |
| `/api/v1/group/*` | GET/POST | Group voting sessions |
| `/v1/calendar.ics` | GET | iCalendar feed |
| `/v1/og/{slug}/{date}.svg` | GET | Dynamic OG social card |
| `/api/v1/schema` | GET | Machine-readable API contract (schema_version: 1) |
| `/health` | GET | Health check |

---

*Integration audit: 2026-03-07*
