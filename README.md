# Custard Calendar

**Enterprise-grade flavor intelligence for the frozen custard ecosystem.**

Custard Calendar is a full-stack custard observability platform that ingests, normalizes, caches, and distributes Flavor of the Day data across 1,000+ stores and 6 Wisconsin custard brands. It powers subscribable .ics calendars, real-time flavor maps, email alert pipelines, ML-driven flavor predictions, Siri Shortcuts, historical analytics, and a 64x32 pixel Tidbyt display — because no one should be blindsided by an unexpected Turtle day.

**Live at [custard.chriskaschner.com](https://custard.chriskaschner.com)**

## Platform Overview

| Surface | What it does |
|---------|-------------|
| [Forecast](https://custard.chriskaschner.com) | Today's confirmed flavor + week-ahead outlook with pixel-art cones and confidence strips |
| [Custard Map](https://custard.chriskaschner.com/map.html) | Search nearby flavors across all brands with flavor-matched cone map markers |
| [Flavor Alerts](https://custard.chriskaschner.com/alerts.html) | Email notifications when your favorite flavor is coming up (daily or weekly digest) |
| [Flavor Radar](https://custard.chriskaschner.com/radar.html) | 7-day personalized flavor outlook blending confirmed data with ML predictions |
| [Flavor Fronts](https://custard.chriskaschner.com/forecast-map.html) | Weather-map style forecast view with flavor-intensity hotspots and day slider |
| [Siri Shortcut](https://custard.chriskaschner.com/siri.html) | "Hey Siri, what's the flavor of the day?" -- voice-first flavor lookup |
| API v1 | Versioned REST API with flavor data, store search, geolocation, metrics, and social cards |
| Tidbyt | Pixel-art ice cream cones on a 64x32 LED display |
| Google Calendar | Event sync with emoji and backup-store options |

### Screenshots

| Forecast | Radar |
|----------|-------|
| ![Forecast](docs/screenshots/forecast.png) | ![Radar](docs/screenshots/radar.png) |

| Map | Alerts |
|-----|--------|
| ![Map](docs/screenshots/map.png) | ![Alerts](docs/screenshots/alerts.png) |

### Supported Brands

Culver's, Kopp's, Gille's, Hefner's, Kraverz, and Oscar's. The brand registry in `worker/src/index.js` routes each slug to its dedicated upstream fetcher.

## Architecture

```
                         ┌──────────────────────────┐
                         │   Upstream Brand Sites    │
                         │  (Culver's, Kopp's, …)   │
                         └──────────┬───────────────┘
                                    │ scrape on cache miss
                         ┌──────────▼───────────────┐
                         │   Cloudflare Worker       │
                         │   (API v1 + KV + D1)      │
                         └──┬────┬────┬────┬────┬───┘
                            │    │    │    │    │
              ┌─────────────┤    │    │    │    └──────────────┐
              ▼             ▼    ▼    ▼    ▼                   ▼
          .ics feed     JSON   Map  Alerts  Metrics      Social Cards
         (calendar     API    page  emails  (D1 SQL)     (SVG OG)
          clients)
              │
    ┌─────────┤
    ▼         ▼
  Python    Tidbyt
  pipeline  display
  (local)   (pixel art)
```

### Data Flow

1. **Cloudflare Worker** — The single source of truth. Fetches from upstream brand sites on KV cache miss, caches 24h, serves all consumers via versioned API.
2. **KV Cache** — Hot cache + ephemeral state: flavor cache (`flavors:{slug}`), locator results, and alert subscription/rate-limit keys.
3. **D1 (SQLite)** — Durable store for snapshots, forecasts, and cron observability. Powers metrics endpoints and social card snapshot reads.
4. **Python Pipeline** — Calls the Worker API (no direct scraping), writes local cache, syncs to Google Calendar, pushes to Tidbyt.

### API v1

All endpoints accept both versioned (`/api/v1/`) and legacy (`/api/`) paths. Versioned responses include an `API-Version: 1` header.

```
GET /v1/calendar.ics?primary=mt-horeb&secondary=madison-todd-drive
GET /api/v1/flavors?slug=mt-horeb
GET /api/v1/today?slug=mt-horeb
GET /api/v1/forecast/{slug}
GET /api/v1/stores?q=madison
GET /api/v1/nearby-flavors?location=53705&flavor=turtle
GET /api/v1/geolocate
GET /api/v1/flavors/catalog
GET /api/v1/flavor-config
GET /api/v1/alerts/subscribe          (POST)
POST /api/v1/events
GET /api/v1/events/summary?days=7
GET /api/v1/trivia?days=365&limit=5
GET /api/v1/flavor-colors
GET /api/v1/metrics/intelligence
GET /api/v1/metrics/flavor/{name}
GET /api/v1/metrics/store/{slug}
GET /api/v1/metrics/trending
GET /api/v1/forecast/coverage
GET /v1/og/{slug}/{date}.svg
GET /health
```

**Auth:** `Authorization: Bearer <token>` header (preferred) or `?token=` query param (legacy). When no `ACCESS_TOKEN` is configured, all requests are open.

**Write resilience:** KV writes are best-effort (cache updates cannot break API responses). Slug-scoped cache records include integrity metadata so poisoned cache entries are rejected and refreshed.

## Quick Start

### Prerequisites

- [uv](https://github.com/astral-sh/uv) for Python package management
- [Node.js](https://nodejs.org/) for Worker development
- [Pixlet](https://tidbyt.dev/docs/build/installing-pixlet) for Tidbyt rendering (optional)
- Google Calendar API credentials (optional, for calendar sync)

### Local Pipeline

```bash
uv sync

# Copy and configure
cp config.example.yaml config.yaml

# Full pipeline: Worker API → cache → calendar → tidbyt
uv run python main.py

# Individual steps
uv run python main.py --fetch-only       # Fetch via Worker API, write cache
uv run python main.py --calendar-only    # Sync cache to Google Calendar
uv run python main.py --tidbyt-only      # Render + push to Tidbyt
uv run python main.py --tidbyt-only --tidbyt-dry-run  # Render only (no device push)
uv run python main.py --tidbyt-only --refresh-stale-cache --max-cache-age-hours 12
uv run python main.py --skip-calendar    # Fetch + tidbyt
uv run python main.py --skip-tidbyt      # Fetch + calendar
```

### Agent Preflight (Parallel Work Safety)

Run this before starting any agent/process in a worktree:

```bash
./scripts/preflight.sh
```

For a stricter check across all linked worktrees for this repo:

```bash
./scripts/preflight.sh --all-worktrees
```

The preflight ignores `.gitignore`d files and fails if any tracked or untracked non-ignored files are dirty.

### Worker Development

```bash
cd worker
npm install
npm test              # 343 tests
npx wrangler dev      # Local dev server
```

### Configuration

`config.yaml` uses multi-brand store entries:

```yaml
stores:
  - slug: "mt-horeb"
    brand: "culvers"
    name: "Mt. Horeb"
    role: "primary"
  - slug: "kopps-greenfield"
    brand: "kopps"
    name: "Kopp's Greenfield"
    role: "secondary"

worker_base: "https://custard.chriskaschner.com"
```

Secrets go in `.env` and `credentials/` (all gitignored).

## Testing

```bash
# Worker (Vitest) -- 343 tests across 21 suites
cd worker && npm test

# Browser smoke suite (Playwright: nav + Radar Phase 2 + Fronts page)
cd worker && npm run test:browser -- --workers=1

# All Python tests (~176 tests)
uv run pytest

# Analytics only (99 tests)
uv run pytest analytics/tests/ -v

# Pipeline + static assets + browser nav click-through
# (requires `cd worker && npm install` and local Chrome/Chromium;
# set CHROME_BIN if needed)
uv run pytest tests/ -v

# Store manifest + e2e (~25 tests)
uv run pytest tools/
```

## Flavor Intelligence Metrics Pack

Generate a local metrics pack from the combined historical datasets
(`backfill`, `backfill-national`, `backfill-wayback`) to support rarity content,
seasonality spotlights, and store-level planning heuristics.

```bash
# Writes JSON + CSV artifacts under analytics/status/
uv run python scripts/generate_intelligence_metrics.py

# Optional: probe first 60 pending non-WI stores for CDX health
uv run python scripts/generate_intelligence_metrics.py --probe-pending 60
```

Outputs:
- `analytics/status/flavor_intelligence_summary_<date>.json`
- `analytics/status/flavor_intelligence_flavors_<date>.csv`
- `analytics/status/flavor_intelligence_stores_<date>.csv`
- `analytics/status/flavor_intelligence_seasonal_spotlights_<date>.csv`
- `analytics/status/backfill_wayback_pending_non_wi_<date>.csv`
- `analytics/status/backfill_missing_overall_<date>.csv`
- `analytics/status/backfill_wayback_pending_probe_<date>.csv` (when `--probe-pending` is used)
- `worker/src/trivia-metrics-seed.js` (auto-generated seed used by `/api/v1/trivia` when D1 data is sparse/unavailable)

Recommended cadence:
- Regenerate before each release and at least weekly.
- CI validates seed contract/version and freshness via Worker tests.

## Data Storage

### KV Schema

| Key pattern | Contents | TTL |
|-------------|----------|-----|
| `flavors:{slug}` | Cached upstream flavor data | 24h |
| `flavors:kopps-shared` | Shared cache for all Kopp's locations | 24h |
| `alert:sub:{id}` | Alert subscription | permanent |
| `alert:pending:{token}` | Double opt-in confirmation | 24h |
| `forecast:{slug}` | Pre-computed ML predictions (legacy fallback during D1 migration) | 24h |
| `locator:{location}:{limit}` | Culver's locator API cache | 1h |

### D1 Schema

```sql
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  slug TEXT NOT NULL,
  date TEXT NOT NULL,
  flavor TEXT NOT NULL,
  normalized_flavor TEXT NOT NULL,
  description TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE(slug, date)
);
-- Indexes on normalized_flavor, date, slug, brand

CREATE TABLE forecasts (
  slug TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Project Structure

```
custard-calendar/
├── src/
│   ├── flavor_service.py          # Worker API client (no direct scraping)
│   └── calendar_sync.py           # Google Calendar integration
├── tests/                         # Python tests (pytest)
├── tidbyt/
│   └── culvers_fotd.star          # Starlark pixel-art renderer
├── worker/
│   ├── src/
│   │   ├── index.js               # Router, auth, caching, resilience guards
│   │   ├── ics-generator.js       # RFC 5545 .ics generation
│   │   ├── flavor-fetcher.js      # Culver's __NEXT_DATA__ parser
│   │   ├── kopp-fetcher.js        # Kopp's HTML parser
│   │   ├── gilles-fetcher.js      # Gille's HTML parser
│   │   ├── hefners-fetcher.js     # Hefner's HTML parser
│   │   ├── kraverz-fetcher.js     # Kraverz HTML parser
│   │   ├── oscars-fetcher.js      # Oscar's HTML parser
│   │   ├── flavor-matcher.js      # Normalization + similarity matching
│   │   ├── flavor-catalog.js      # Aggregated flavor catalog
│   │   ├── snapshot-writer.js     # D1 snapshot persistence
│   │   ├── metrics.js             # D1 query endpoints (frequency, streaks, trending)
│   │   ├── social-card.js         # Dynamic SVG OG image generation
│   │   ├── alert-routes.js        # Subscription CRUD + double opt-in
│   │   ├── alert-checker.js       # Daily + weekly digest cron handlers
│   │   ├── email-sender.js        # Resend templates + rotating quips
│   │   ├── valid-slugs.js         # Generated allowlist (~1,079 slugs)
│   │   ├── store-index.js         # Generated store search index
│   │   ├── forecast.js            # ML forecast endpoint (D1 primary + KV fallback)
│   │   ├── flavor-colors.js       # 29 flavor profiles, pixel-art cone SVG renderer
│   │   └── migrations/            # D1 schema migrations
│   └── test/                      # Vitest (343 tests, 21 suites)
├── analytics/                     # ML prediction pipeline (99 tests)
│   ├── data_loader.py             # SQLite -> DataFrame
│   ├── basic_metrics.py           # Frequency, recency, entropy, surprise
│   ├── patterns.py                # DOW bias, recurrence, seasonality
│   ├── markov.py                  # Transition matrices
│   ├── collaborative.py           # NMF store clustering
│   ├── predict.py                 # FrequencyRecency + Markov models
│   ├── embeddings.py              # Flavor similarity (TF-IDF, sentence-transformer)
│   ├── forecast_writer.py         # Weather-style prose generation
│   ├── batch_forecast.py          # CLI batch forecast generation
│   ├── evaluate.py                # Train/test split, accuracy metrics
│   └── tests/                     # 99 pytest tests
├── docs/                          # GitHub Pages (custard.chriskaschner.com)
│   ├── index.html                 # Forecast homepage (today's flavor + week ahead)
│   ├── calendar.html              # .ics calendar subscription page
│   ├── map.html                   # Multi-brand custard map
│   ├── alerts.html                # Flavor alert signup
│   ├── radar.html                 # Flavor Radar (7-day ML outlook)
│   ├── forecast-map.html          # Flavor Fronts weather-map forecast view
│   ├── siri.html                  # Siri Shortcut setup page
│   ├── flavors.json               # Flavor catalog for client-side pickers
│   ├── style.css                  # Shared stylesheet
│   └── stores.json                # Store manifest (~1,000 stores)
├── tools/
│   ├── build_manifest.py          # OSM → slug probing → manifest
│   ├── generate_og_images.py      # Static OG social preview generator
│   ├── capture_fixture.py         # Test fixture capture
│   └── backfill_flavors.py        # Historical snapshot backfill
├── main.py                        # Pipeline orchestrator
├── config.yaml                    # Multi-brand store + service config
└── TODO.md                        # Canonical task list
```

## Tidbyt

The standalone Tidbyt community app lives at **[custard-tidbyt](https://github.com/chriskaschner/custard-tidbyt)**. It fetches from the Worker API and renders a 3-day forecast with brand-themed ice cream cones.

The local renderer in `tidbyt/` is for development and direct device push:

```bash
pixlet render tidbyt/culvers_fotd.star \
    view_mode=three_day location_name="Mt. Horeb" \
    flavor_0="Chocolate Fudge" flavor_date_0="2026-02-20"

pixlet serve tidbyt/culvers_fotd.star    # Live preview at localhost:8080
```

## Store Manifest

The 1,000+ store manifest is built from OpenStreetMap data cross-referenced with Culver's slug probing:

```bash
uv run python tools/build_manifest.py              # Full build
uv run python tools/build_manifest.py --state WI   # Wisconsin first
uv run python tools/build_manifest.py --resume      # Resume interrupted build
```

## License

MIT
