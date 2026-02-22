# Custard Calendar

**Enterprise-grade flavor intelligence for the frozen custard ecosystem.**

Custard Calendar is a full-stack custard observability platform that ingests, normalizes, caches, and distributes Flavor of the Day data across 1,000+ stores and 6 Wisconsin custard brands. It powers subscribable .ics calendars, real-time flavor maps, email alert pipelines, historical analytics, and a 64x32 pixel Tidbyt display — because no one should be blindsided by an unexpected Turtle day.

**Live at [custard.chriskaschner.com](https://custard.chriskaschner.com)**

## Platform Overview

| Surface | What it does |
|---------|-------------|
| [Calendar](https://custard.chriskaschner.com) | Subscribe to .ics flavor forecasts for any store |
| [Custard Map](https://custard.chriskaschner.com/map.html) | Search nearby flavors across all brands, filter by flavor or location |
| [Flavor Alerts](https://custard.chriskaschner.com/alerts.html) | Email notifications when your favorite flavor is coming up (daily or weekly digest) |
| API v1 | Versioned REST API with flavor data, store search, geolocation, metrics, and social cards |
| Tidbyt | Pixel-art ice cream cones on a 64x32 LED display |
| Google Calendar | Event sync with emoji and backup-store options |

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
2. **KV Cache** — Flavor data (`flavors:{slug}`), locator results, fetch budgets, alert subscriptions, and append-only snapshot history.
3. **D1 (SQLite)** — Queryable historical snapshots. Powers metrics endpoints (frequency, streaks, trending).
4. **Python Pipeline** — Calls the Worker API (no direct scraping), writes local cache, syncs to Google Calendar, pushes to Tidbyt.

### API v1

All endpoints accept both versioned (`/api/v1/`) and legacy (`/api/`) paths. Versioned responses include an `API-Version: 1` header.

```
GET /v1/calendar.ics?primary=mt-horeb&secondary=madison-todd-drive
GET /api/v1/flavors?slug=mt-horeb
GET /api/v1/stores?q=madison
GET /api/v1/nearby-flavors?location=53705&flavor=turtle
GET /api/v1/geolocate
GET /api/v1/flavors/catalog
GET /api/v1/alerts/subscribe          (POST)
GET /api/v1/metrics/flavor/{name}
GET /api/v1/metrics/store/{slug}
GET /api/v1/metrics/trending
GET /v1/og/{slug}/{date}.svg
GET /health
```

**Auth:** `Authorization: Bearer <token>` header (preferred) or `?token=` query param (legacy). When no `ACCESS_TOKEN` is configured, all requests are open.

**Rate limiting:** Per-slug fetch budget (3 upstream requests/day/slug) + global circuit breaker (200/day). Prevents any single store from exhausting the fleet's budget.

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
uv run python main.py --skip-calendar    # Fetch + tidbyt
uv run python main.py --skip-tidbyt      # Fetch + calendar
```

### Worker Development

```bash
cd worker
npm install
npm test              # 257 tests
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

worker_base: "https://custard-calendar.chris-kaschner.workers.dev"
```

Secrets go in `.env` and `credentials/` (all gitignored).

## Testing

```bash
# Worker (Vitest) — 257 tests across 14 suites
cd worker && npm test

# Python — 16 tests
uv sync --extra dev
uv run pytest tests/ -v

# Store manifest + e2e
uv run pytest tools/
```

## Data Storage

### KV Schema

| Key pattern | Contents | TTL |
|-------------|----------|-----|
| `flavors:{slug}` | Cached upstream flavor data | 24h |
| `flavors:kopps-shared` | Shared cache for all Kopp's locations | 24h |
| `meta:fetch-count:{slug}` | Per-slug upstream fetch counter | 24h |
| `meta:fetch-count` | Global circuit breaker counter | 24h |
| `snap:{slug}:{date}` | Snapshot observation | permanent |
| `snap:date:{date}` | Date index (all stores for a date) | permanent |
| `snap:flavor:{normalized}` | Flavor index (all appearances) | permanent |
| `alert:sub:{id}` | Alert subscription | permanent |
| `alert:pending:{token}` | Double opt-in confirmation | 24h |
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
│   │   ├── index.js               # Router, auth, caching, fetch budget
│   │   ├── ics-generator.js       # RFC 5545 .ics generation
│   │   ├── flavor-fetcher.js      # Culver's __NEXT_DATA__ parser
│   │   ├── kopp-fetcher.js        # Kopp's HTML parser
│   │   ├── gilles-fetcher.js      # Gille's HTML parser
│   │   ├── hefners-fetcher.js     # Hefner's HTML parser
│   │   ├── kraverz-fetcher.js     # Kraverz HTML parser
│   │   ├── oscars-fetcher.js      # Oscar's HTML parser
│   │   ├── flavor-matcher.js      # Normalization + similarity matching
│   │   ├── flavor-catalog.js      # Aggregated flavor catalog
│   │   ├── snapshot-writer.js     # Dual-write KV + D1 snapshots
│   │   ├── metrics.js             # D1 query endpoints (frequency, streaks, trending)
│   │   ├── social-card.js         # Dynamic SVG OG image generation
│   │   ├── alert-routes.js        # Subscription CRUD + double opt-in
│   │   ├── alert-checker.js       # Daily + weekly digest cron handlers
│   │   ├── email-sender.js        # Resend templates + rotating quips
│   │   ├── valid-slugs.js         # Generated allowlist (~1,079 slugs)
│   │   ├── store-index.js         # Generated store search index
│   │   └── migrations/            # D1 schema migrations
│   └── test/                      # Vitest (257 tests)
├── docs/                          # GitHub Pages (custard.chriskaschner.com)
│   ├── index.html                 # Calendar subscription page
│   ├── map.html                   # Multi-brand custard map
│   ├── alerts.html                # Flavor alert signup
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
