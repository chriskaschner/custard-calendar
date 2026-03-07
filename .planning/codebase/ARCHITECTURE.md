# Architecture

**Analysis Date:** 2026-03-07

## Pattern Overview

**Overall:** Multi-language, multi-process platform with a Cloudflare Worker as the single source of truth for flavor data. A Python pipeline, analytics engine, Tidbyt renderer, and static GitHub Pages frontend all consume from the Worker API. The monorepo `custard-calendar/` contains all five layers. A separate `custard-tidbyt/` repo holds the community Tidbyt app submission.

**Key Characteristics:**
- Worker-centric: all upstream scraping and caching happens in the Cloudflare Worker (`worker/src/`)
- Cache-first: KV (24h TTL) + D1 (durable append-only) dual-write strategy
- Multi-brand: six frozen custard brands with dedicated fetcher modules, unified by a brand registry
- Offline-resilient: stale cache fallback at every layer (Python, Worker KV, Tidbyt cache.star)
- Scheduled automation: three Cloudflare cron triggers (daily alerts, weekly digest, weekly analytics report) plus GitHub Actions CI

## Layers

**Layer 1 - Cloudflare Worker (API + Data Ingestion):**
- Purpose: Scrape upstream brand sites, cache in KV/D1, serve JSON API v1, generate .ics calendars, send alert emails, serve forecasts and social cards
- Location: `custard-calendar/worker/src/`
- Entry point: `custard-calendar/worker/src/index.js`
- Contains: Route handlers, brand fetchers, KV cache logic, D1 snapshot writer, ICS generator, email sender, alert checker, quiz/trivia/leaderboard routes, rate limiting, CORS/auth middleware
- Depends on: Upstream brand websites (culvers.com, kopps.com, etc.), Cloudflare KV, Cloudflare D1, Resend API (email)
- Used by: Python pipeline, GitHub Pages frontend, Tidbyt community app, calendar clients (Apple Calendar, Google Calendar)

**Layer 2 - Python Pipeline (Orchestration):**
- Purpose: Call the Worker API, maintain a local flavor cache, sync flavors to Google Calendar, render and push to Tidbyt device
- Location: `custard-calendar/src/`, `custard-calendar/main.py`
- Entry point: `custard-calendar/main.py`
- Contains: Flavor service (API client + local cache), Google Calendar sync, Tidbyt render/push orchestration
- Depends on: Worker API (`custard.chriskaschner.com`), Google Calendar API, Pixlet CLI, local `config.yaml`
- Used by: End user (cron or manual invocation)

**Layer 3 - Analytics (ML Predictions):**
- Purpose: Generate flavor forecasts using historical snapshot data from a local SQLite backfill database
- Location: `custard-calendar/analytics/`
- Entry point: `custard-calendar/analytics/batch_forecast.py` (CLI)
- Contains: Data loader (SQLite), prediction models (FrequencyRecency, MarkovRecency, XGBoost), batch forecast generator, forecast writer, evaluation scripts
- Depends on: Local SQLite database at `custard-calendar/data/backfill/flavors.sqlite`, pandas, numpy, scikit-learn
- Used by: Worker API (forecasts uploaded to D1 via `scripts/upload_forecasts.py`)

**Layer 4 - Tidbyt Renderer:**
- Purpose: Render pixel-art ice cream cone displays for the 64x32 Tidbyt LED display
- Location: `custard-calendar/tidbyt/culvers_fotd.star`
- Contains: Pure Starlark renderer with brand theming, flavor profiles, mini cone pixel art, text abbreviation logic
- Depends on: Pixlet CLI, flavor data passed as flattened `key=value` config params from Python pipeline
- Used by: Python pipeline step 3 (render + push)

**Layer 5 - GitHub Pages Frontend:**
- Purpose: Static web pages for calendar subscription, store map, flavor alerts, Siri Shortcuts, Flavor Radar, quiz, forecast, group voting, drive planner
- Location: `custard-calendar/docs/`
- Contains: 14+ HTML pages, shared JS modules (`planner-shared.js`, `cone-renderer.js`, `todays-drive.js`), quiz engine, service worker
- Depends on: Worker API v1 (JSON endpoints), Leaflet (maps), no build step
- Used by: End users via `custard.chriskaschner.com` (GitHub Pages)

**Layer 6 - Community Tidbyt App (separate sub-repo):**
- Purpose: Self-contained Tidbyt community app that fetches directly from the Worker API
- Location: `custard-tidbyt/apps/culversfotd/culvers_fotd.star`
- Contains: Starlark app with HTTP fetching, caching, and rendering (unlike Layer 4 which is data-pass-through only)
- Depends on: Worker API v1 (`custard.chriskaschner.com/api/v1/flavors`)
- Used by: Tidbyt community app store

## Data Flow

**Primary Data Pipeline (Worker Ingestion):**

1. Cloudflare cron or API request triggers flavor fetch for a store slug
2. `brand-registry.js` resolves slug to the correct brand fetcher (Culver's `__NEXT_DATA__` parser, or Kopp's/Gille's/Hefner's/Kraverz/Oscar's HTML parsers)
3. `kv-cache.js` checks KV for cached data; on miss, calls the brand fetcher
4. `kv-cache.js` sanitizes upstream payload (`sanitizeFlavorPayload`) to prevent data injection
5. Sanitized data is dual-written: KV (24h TTL ephemeral cache) + D1 snapshots (append-only durable history)
6. Response returned to caller (API consumer, .ics generator, alert checker, etc.)

**Calendar Sync Flow (Python):**

1. `main.py` orchestrates a 3-step pipeline: fetch -> calendar sync -> Tidbyt push
2. `src/flavor_service.py` calls Worker API `/api/v1/flavors?slug=X`, writes local `flavor_cache.json`
3. `src/calendar_sync.py` authenticates with Google Calendar API (OAuth 2.0), creates/updates all-day events with flavor names
4. `main.py` invokes `pixlet render` with flattened flavor params, then `pixlet push` to Tidbyt device

**Forecast Generation Flow:**

1. `analytics/data_loader.py` loads historical data from SQLite (`data/backfill/flavors.sqlite`)
2. `analytics/batch_forecast.py` fits `FrequencyRecencyModel`, generates 7-day predictions per store
3. `scripts/upload_forecasts.py` uploads forecast JSON to Worker D1 `forecasts` table
4. Worker serves forecasts via `GET /api/v1/forecast/{slug}` (D1 primary, KV fallback)

**Alert Email Flow:**

1. Cloudflare cron fires daily at noon UTC
2. `alert-checker.js` lists all active subscriptions from KV
3. Groups subscribers by store slug, fetches flavors once per slug (KV-cached)
4. Matches subscriber favorites against upcoming flavors using `flavor-matcher.js`
5. Sends consolidated email via Resend API (`email-sender.js`)
6. Writes dedup keys to KV (7-day TTL) to prevent re-emailing

**State Management:**
- Cloudflare KV: Ephemeral flavor cache (24h TTL), alert subscriptions, dedup keys, rate limit counters, run metadata
- Cloudflare D1: Durable historical snapshots, cron run logs, forecasts, accuracy metrics, quiz events, interaction events, store reliability scores
- Local `flavor_cache.json`: Python pipeline's local cache of Worker API responses
- Local `data/backfill/flavors.sqlite`: Analytics pipeline's historical dataset
- Google Calendar: Calendar events as persistent external state

## Key Abstractions

**Brand Registry:**
- Purpose: Maps store slugs to brand-specific fetcher functions, URLs, and KV cache key prefixes
- Implementation: `custard-calendar/worker/src/brand-registry.js`
- Pattern: Registry pattern with regex slug matching; default falls through to Culver's

**Flavor Cache Record:**
- Purpose: Versioned, metadata-wrapped KV cache entries with integrity checking
- Implementation: `custard-calendar/worker/src/kv-cache.js` (`makeFlavorCacheRecord`, `parseFlavorCacheRecord`)
- Pattern: Envelope pattern -- `{_meta: {v, shared, slug, cachedAt}, data: {name, flavors}}`

**Snapshot Writer:**
- Purpose: Append-only historical flavor observations in D1
- Implementation: `custard-calendar/worker/src/snapshot-writer.js`
- Pattern: Write-through on cache miss; `INSERT ... ON CONFLICT UPDATE` for idempotent upserts

**Flavor Matcher:**
- Purpose: Fuzzy matching between subscriber favorites and flavor names
- Implementation: `custard-calendar/worker/src/flavor-matcher.js`
- Pattern: Normalization + similarity groups + flavor families for robust matching

**Flavor Predictor:**
- Purpose: Base class for ML prediction models
- Implementation: `custard-calendar/analytics/predict.py` (`FlavorPredictor` base, `FrequencyRecencyModel`, `MarkovRecencyModel`, `XGBoostFlavorModel`)
- Pattern: Strategy pattern; `fit()` then `predict_proba()` interface

**Flavor Profile (Tidbyt):**
- Purpose: Map flavor names to visual rendering properties (base color, ribbon, toppings, density)
- Implementation: `custard-calendar/tidbyt/culvers_fotd.star` (`FLAVOR_PROFILES`, `get_flavor_profile`)
- Pattern: Lookup table with keyword fallback for unknown flavors

## Entry Points

**Worker HTTP Handler:**
- Location: `custard-calendar/worker/src/index.js` (`handleRequest()`)
- Triggers: HTTP requests to `custard.chriskaschner.com`
- Responsibilities: CORS, versioned path normalization (`/api/v1/X` -> `/api/X`), admin auth, rate limiting, route dispatch to ~30 handler functions

**Worker Scheduled Handler:**
- Location: `custard-calendar/worker/src/index.js` (`scheduled()` export)
- Triggers: Three Cloudflare cron triggers (`0 12 * * *`, `0 14 * * 7`, `0 14 * * 1`)
- Responsibilities: Daily alert emails, weekly digest emails, weekly analytics report, snapshot harvesting (50 stores/tick), reliability index refresh (25 stores/tick), operator alert checks, cron result persistence to D1

**Python Main:**
- Location: `custard-calendar/main.py`
- Triggers: Manual invocation or cron (`uv run python main.py`)
- Responsibilities: 3-step pipeline (fetch -> calendar sync -> Tidbyt push) with CLI flags for step selection

**Batch Forecast CLI:**
- Location: `custard-calendar/analytics/batch_forecast.py`
- Triggers: Manual invocation (`uv run python -m analytics.batch_forecast`)
- Responsibilities: Load SQLite data, fit model, generate predictions, write JSON to `data/forecasts/latest.json`

## Error Handling

**Strategy:** Fail-safe with graceful degradation. Non-critical writes (KV, D1 snapshots, dedup keys, counters) are best-effort and never block serving data.

**Patterns:**
- `safeKvPut()` in `kv-cache.js`: wraps KV writes in try/catch, returns boolean, never throws
- D1 snapshot writes in `snapshot-writer.js`: non-fatal, logs error, increments daily error counter in KV
- Worker cron: each phase (alerts, snapshots, reliability, operator alerts) runs independently; one failure does not block others
- Python pipeline: stale cache fallback in `flavor_service.py` (`_try_stale_fallback`) when Worker API is unreachable
- Upstream fetch failures: per-store fallback in `route-calendar.js` generates "See website" placeholder events

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` in Worker (Cloudflare Workers logs); Python `logging` module with `%(asctime)s - %(name)s - %(levelname)s - %(message)s` format

**Validation:** Input sanitization at the ingestion boundary in `kv-cache.js` (`sanitizeFlavorPayload`) and `flavor-fetcher.js` (`parseNextData` with `SAFE_TEXT` regex, title/description length limits). Slug validation via `slug-validation.js` on all API routes.

**Authentication:** Bearer token for admin-only routes (`ADMIN_ACCESS_TOKEN` secret, checked in `checkAdminAccess()`). Google Calendar uses OAuth 2.0 with credential files. No end-user authentication for public API routes.

**Rate Limiting:** Per-IP rate limits via `rate-limit.js` (`applyIpRateLimit`) on public write routes, expensive read routes, and alert token routes. Limits stored as KV counters with hourly expiry.

**CORS:** Configured allowlist (`ALLOWED_ORIGIN`, `PUBLIC_WRITE_ALLOWED_ORIGINS`) with localhost passthrough for development. Security headers (HSTS, X-Frame-Options, CSP, X-Content-Type-Options) applied to all responses.

**Observability:** `/health` endpoint aggregates KV reachability, D1 status, latest cron run, daily parse failure/snapshot error/email error/anomaly counts. Cron runs persisted to D1 `cron_runs` table. Operator alerts sent on threshold breaches.

---

*Architecture analysis: 2026-03-07*
