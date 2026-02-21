# Culver's Flavor of the Day Tracker

Track Culver's Flavor of the Day across multiple locations. Syncs to Google Calendar, renders on a Tidbyt display, and provides a subscribable .ics calendar anyone can use.

## What It Does

- **Flavor Service** — scrapes Culver's restaurant pages for upcoming flavors, caches locally
- **Google Calendar Sync** — creates calendar events with emoji, descriptions, and backup-store options
- **Tidbyt Display** — pixel-art ice cream cones on a 64x32 LED display (single-day and three-day views)
- **Web Calendar Service** — Cloudflare Worker serving subscribable .ics calendars for 1,071 stores

## Quick Start

```bash
# Install dependencies
uv sync

# Copy and edit config with your locations/IDs
cp config.example.yaml config.yaml

# Run the full pipeline (fetch → cache → calendar → tidbyt)
uv run python main.py
```

### Individual Steps

```bash
uv run python main.py --fetch-only       # Only fetch and cache flavors
uv run python main.py --calendar-only    # Only sync to Google Calendar
uv run python main.py --tidbyt-only      # Only render + push to Tidbyt
uv run python main.py --skip-calendar    # Fetch + tidbyt, skip calendar
uv run python main.py --skip-tidbyt      # Fetch + calendar, skip tidbyt
```

## Setup

### Prerequisites

- [uv](https://github.com/astral-sh/uv) for Python package management
- [Pixlet](https://tidbyt.dev/docs/build/installing-pixlet) for Tidbyt rendering (`brew install tidbyt/tidbyt/pixlet`)
- Google Calendar API credentials (for calendar sync)
- Tidbyt API token (for device push)

### Configuration

Copy `config.example.yaml` to `config.yaml` and fill in:
- Your Culver's location URLs
- Google Calendar ID
- Tidbyt device ID

Credentials go in:
- `.env` — `TIDBYT_API_TOKEN=...`
- `credentials/credentials.json` — Google OAuth client credentials
- `credentials/token.json` — auto-generated on first OAuth flow

All of these are gitignored.

## Tidbyt Community App

The standalone Tidbyt community app lives in a separate repo: **[custard-tidbyt](https://github.com/chriskaschner/custard-tidbyt)**. It fetches flavor data from this project's Worker API and renders a 3-day forecast with color-coded ice cream cones.

The legacy renderer in `tidbyt/` is kept for local development and direct device push:

```bash
# Render locally
pixlet render tidbyt/culvers_fotd.star \
    view_mode=three_day location_name="Mt. Horeb" \
    flavor_0="Chocolate Fudge" flavor_date_0="2026-02-20"

# Live preview at http://localhost:8080
pixlet serve tidbyt/culvers_fotd.star

# Render both views and open HTML comparison
python test_tidbyt.py
```

## Web Calendar Service

A public .ics calendar service backed by a Cloudflare Worker. Anyone can subscribe to Flavor of the Day updates for any of 1,071 Culver's locations — no setup required.

```
GET /calendar.ics?primary=mt-horeb
GET /calendar.ics?primary=mt-horeb&secondary=madison-todd-drive,middleton
GET /api/flavors?slug=mt-horeb
GET /api/stores?q=madison
GET /health
```

### Development

```bash
cd worker
npm install
npm test              # 58 tests
npx wrangler dev      # Local dev server
```

### Store Manifest

The store list is built from OpenStreetMap data + Culver's slug probing:

```bash
uv run python tools/build_manifest.py            # Full build
uv run python tools/build_manifest.py --resume    # Resume interrupted build
uv run pytest tools/                              # Run manifest + e2e tests
```

## Project Structure

```
custard-calendar/
├── src/
│   ├── flavor_service.py       # Scrapes Culver's for flavor data
│   └── calendar_sync.py        # Google Calendar integration
├── tidbyt/
│   ├── culvers_fotd.star       # Starlark Tidbyt app (pure renderer)
│   └── manifest.yaml
├── worker/                     # Cloudflare Worker (.ics service)
│   ├── src/
│   │   ├── index.js            # Request handling, security, caching
│   │   ├── ics-generator.js    # RFC 5545 .ics generation
│   │   ├── flavor-fetcher.js   # JS port of flavor scraping
│   │   ├── valid-slugs.js      # Generated allowlist (1,071 slugs)
│   │   └── store-index.js      # Generated store search index
│   ├── test/                   # Vitest integration + unit tests
│   ├── scripts/
│   │   ├── generate-valid-slugs.js
│   │   └── generate-store-index.js
│   └── wrangler.toml
├── docs/                       # GitHub Pages store selector
│   ├── index.html
│   ├── style.css
│   └── stores.json             # Store manifest
├── tools/                      # Build + test utilities
│   ├── build_manifest.py       # OSM → slug probing → manifest
│   ├── capture_fixture.py      # Test fixture capture
│   ├── test_manifest.py        # Manifest unit tests
│   └── test_e2e.py             # End-to-end calendar tests
├── main.py                     # Pipeline orchestrator
├── config.example.yaml         # Configuration template
├── deploy_tidbyt.sh            # Tidbyt push wrapper
└── run.sh                      # Cron helper script
```

## License

MIT
