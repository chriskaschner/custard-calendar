# Codebase Structure

**Analysis Date:** 2026-03-07

## Directory Layout

```
custard/                                    # Monorepo root
├── .claude/                                # Claude Code project settings
├── .planning/                              # GSD planning documents
│   └── codebase/                           # Architecture/convention/testing docs
├── custard-agent-config.md                 # Multi-agent coordination config
├── custard-product-brief.md                # Product requirements document
├── custard-calendar/                       # Main project (all 5 layers)
│   ├── main.py                             # Python pipeline entry point
│   ├── config.yaml                         # Store + calendar + tidbyt config
│   ├── pyproject.toml                      # Python dependencies (uv)
│   ├── flavor_cache.json                   # Local flavor cache (generated)
│   ├── CLAUDE.md                           # Per-project Claude instructions
│   ├── src/                                # Python source (Layer 2)
│   │   ├── flavor_service.py               # Worker API client + local cache
│   │   └── calendar_sync.py                # Google Calendar sync
│   ├── analytics/                          # ML prediction pipeline (Layer 3)
│   │   ├── predict.py                      # Prediction models (3 models)
│   │   ├── batch_forecast.py               # CLI: generate forecasts
│   │   ├── data_loader.py                  # SQLite data loading
│   │   ├── basic_metrics.py                # Frequency/probability metrics
│   │   ├── markov.py                       # Transition matrix
│   │   ├── collaborative.py                # Collaborative filtering
│   │   ├── embeddings.py                   # Flavor embeddings
│   │   ├── patterns.py                     # Pattern detection
│   │   ├── pca_baseline.py                 # PCA baseline model
│   │   ├── evaluate.py                     # Model evaluation
│   │   ├── accuracy.py                     # Accuracy metrics
│   │   ├── forecast_writer.py              # JSON forecast output
│   │   └── tests/                          # Analytics tests (117 tests)
│   ├── worker/                             # Cloudflare Worker (Layer 1)
│   │   ├── src/                            # Worker source
│   │   │   ├── index.js                    # Main entry point + route dispatch
│   │   │   ├── flavor-fetcher.js           # Culver's __NEXT_DATA__ parser
│   │   │   ├── kopp-fetcher.js             # Kopp's HTML parser
│   │   │   ├── gilles-fetcher.js           # Gille's HTML parser
│   │   │   ├── hefners-fetcher.js          # Hefner's HTML parser
│   │   │   ├── kraverz-fetcher.js          # Kraverz HTML parser
│   │   │   ├── oscars-fetcher.js           # Oscar's HTML parser
│   │   │   ├── brand-registry.js           # Slug -> fetcher routing
│   │   │   ├── kv-cache.js                 # KV cache read/write + sanitization
│   │   │   ├── snapshot-writer.js          # D1 append-only snapshots
│   │   │   ├── ics-generator.js            # RFC 5545 .ics generation
│   │   │   ├── route-calendar.js           # /calendar.ics handler
│   │   │   ├── route-today.js              # /api/today handler
│   │   │   ├── route-nearby.js             # /api/nearby-flavors handler
│   │   │   ├── alert-checker.js            # Cron: daily/weekly alert emails
│   │   │   ├── alert-routes.js             # /api/alerts/* subscription mgmt
│   │   │   ├── email-sender.js             # Resend API integration
│   │   │   ├── subscription-store.js       # KV-backed subscription storage
│   │   │   ├── flavor-matcher.js           # Fuzzy flavor matching + normalization
│   │   │   ├── flavor-catalog.js           # Known flavor catalog accumulation
│   │   │   ├── flavor-colors.js            # Cone color system for SVG cards
│   │   │   ├── flavor-stats.js             # Per-flavor statistics
│   │   │   ├── flavor-tags.js              # Flavor categorization tags
│   │   │   ├── forecast.js                 # /api/forecast/{slug} handler
│   │   │   ├── signals.js                  # Flavor signal detection (overdue, DOW, seasonal)
│   │   │   ├── certainty.js                # Prediction certainty scoring
│   │   │   ├── planner.js                  # /api/plan handler
│   │   │   ├── drive.js                    # /api/drive handler
│   │   │   ├── events.js                   # /api/events interaction tracking
│   │   │   ├── trivia.js                   # /api/trivia handler
│   │   │   ├── quiz-routes.js              # /api/quiz/* handler
│   │   │   ├── leaderboard.js              # /api/leaderboard/* handler
│   │   │   ├── group-routes.js             # /api/group/* voting handler
│   │   │   ├── social-card.js              # /og/{slug}/{date}.svg handler
│   │   │   ├── metrics.js                  # /api/metrics/* analytics routes
│   │   │   ├── reliability.js              # Store reliability index
│   │   │   ├── report-sender.js            # Weekly analytics report email
│   │   │   ├── operator-alerts.js          # Operator push-alert checks
│   │   │   ├── rate-limit.js               # Per-IP rate limiting
│   │   │   ├── slug-validation.js          # Slug format validation
│   │   │   ├── valid-slugs.js              # Allowlist of valid store slugs
│   │   │   ├── store-index.js              # In-memory store search index
│   │   │   ├── store-coords.js             # Store lat/lon coordinates
│   │   │   ├── snapshot-targets.js         # Cron snapshot harvest targeting
│   │   │   ├── trivia-metrics-seed.js      # Trivia question generation
│   │   │   ├── api-schema.json             # API contract schema
│   │   │   └── migrations/                 # D1 schema migrations (001-010)
│   │   ├── test/                           # Worker tests (574 tests, 32 suites)
│   │   │   ├── *.test.js                   # Unit + integration tests
│   │   │   ├── fixtures/                   # Test fixture JSON files
│   │   │   └── browser/                    # Playwright browser tests
│   │   ├── scripts/                        # Worker build scripts
│   │   │   ├── generate-store-index.js     # Build store-index.js from manifest
│   │   │   └── generate-valid-slugs.js     # Build valid-slugs.js from manifest
│   │   ├── package.json                    # Node dependencies
│   │   ├── vitest.config.js                # Vitest configuration
│   │   └── wrangler.toml                   # Cloudflare Worker config
│   ├── tidbyt/                             # Tidbyt renderer (Layer 4)
│   │   ├── culvers_fotd.star               # Starlark pixel-art renderer
│   │   └── manifest.yaml                   # Tidbyt app manifest
│   ├── docs/                               # GitHub Pages frontend (Layer 5)
│   │   ├── index.html                      # Main forecast/store page
│   │   ├── calendar.html                   # Calendar subscription page
│   │   ├── map.html                        # Custard store map
│   │   ├── alerts.html                     # Flavor alert subscription
│   │   ├── radar.html                      # Flavor Radar visualization
│   │   ├── forecast-map.html               # Forecast map
│   │   ├── quiz.html                       # Flavor quiz
│   │   ├── group.html                      # Group voting
│   │   ├── siri.html                       # Siri Shortcut setup
│   │   ├── widget.html                     # iOS widget config
│   │   ├── scoop.html                      # Scoop page
│   │   ├── privacy.html                    # Privacy policy
│   │   ├── planner-shared.js               # Shared JS for forecast/planner pages
│   │   ├── todays-drive.js                 # Drive planner JS
│   │   ├── cone-renderer.js                # SVG cone rendering (browser)
│   │   ├── sw.js                           # Service worker
│   │   ├── quizzes/                        # Quiz data JSONs + engine
│   │   ├── assets/                         # Images, sprites, brand fills
│   │   ├── vendor/                         # Third-party JS (leaflet-heat)
│   │   └── screenshots/                    # Screenshot assets
│   ├── scripts/                            # Python utility scripts
│   │   ├── backfill_national.py            # National backfill scraper
│   │   ├── backfill_snapshots.py           # Snapshot backfill
│   │   ├── backfill_wayback_isolated.py    # Wayback Machine backfill
│   │   ├── upload_forecasts.py             # Upload forecasts to D1
│   │   ├── upload_backfill.py              # Upload backfill to D1
│   │   ├── evaluate_forecasts.py           # Forecast accuracy evaluation
│   │   ├── analytics_report.py             # Telemetry measurement report
│   │   ├── check_backfill_coverage.py      # Backfill coverage check
│   │   ├── check_forecast_coverage.py      # Forecast coverage check
│   │   ├── check_metrics_seed_freshness.py # Metrics seed freshness
│   │   ├── check_repo_structure.py         # Repo contract enforcement
│   │   ├── check_status_docs.py            # Status doc consistency
│   │   ├── generate_intelligence_metrics.py # Intelligence metrics
│   │   └── tests/                          # Script tests
│   ├── tests/                              # Python tests (root-level)
│   │   ├── test_flavor_service.py          # Flavor service unit tests
│   │   ├── test_calendar_sync.py           # Calendar sync unit tests
│   │   ├── test_main_tidbyt.py             # Main pipeline tests
│   │   ├── test_live_api.py                # Live API integration tests
│   │   ├── test_browser_clickthrough.py    # Playwright browser smoke tests
│   │   └── test_static_assets.py           # Static asset validation
│   ├── tools/                              # Development tools
│   │   ├── build_manifest.py               # OSM store manifest builder
│   │   ├── capture_fixture.py              # Test fixture capture
│   │   ├── generate_og_images.py           # OG image generation
│   │   ├── test_tidbyt.py                  # Tidbyt comparison viewer
│   │   ├── test_manifest.py                # Manifest validation
│   │   └── test_e2e.py                     # E2E test runner
│   ├── data/                               # Data files
│   │   ├── backfill/                       # Historical backfill data + SQLite DB
│   │   ├── backfill-national/              # National backfill data
│   │   ├── backfill-wayback/               # Wayback Machine backfill
│   │   └── forecasts/                      # Generated forecast JSONs
│   ├── widgets/                            # iOS Scriptable widgets
│   │   ├── custard-scriptable.js           # Scriptable widget
│   │   └── custard-today.js                # Today widget
│   ├── archive/                            # Archived/deprecated code
│   │   ├── alexa/                          # Deprecated Alexa skill
│   │   └── tidbyt-community-pr/            # Old community PR submission
│   ├── credentials/                        # Google OAuth credentials (gitignored)
│   ├── logs/                               # Runtime logs
│   ├── output/                             # Generated output files
│   ├── tmp/                                # Temporary files
│   └── .github/workflows/                  # CI pipelines
│       ├── ci.yml                          # Main CI (worker tests + python tests + repo structure)
│       ├── tidbyt-daily.yml                # Daily Tidbyt push
│       ├── data-quality.yml                # Data quality checks
│       └── security.yml                    # Security scanning
└── custard-tidbyt/                         # Community Tidbyt app (separate sub-repo)
    ├── apps/culversfotd/
    │   ├── culvers_fotd.star               # Self-contained Starlark app (HTTP-capable)
    │   └── manifest.yaml                   # Community app manifest
    ├── scripts/
    │   └── backfill_custard.py             # Backfill script
    ├── tests/
    │   └── test_api_contract.py            # API contract tests
    └── data/backfill/                      # Backfill data
```

## Directory Purposes

**`custard-calendar/src/`:**
- Purpose: Python library code consumed by `main.py`
- Contains: 2 modules -- `flavor_service.py` (Worker API client + local JSON cache) and `calendar_sync.py` (Google Calendar OAuth + event sync)
- Key files: `src/flavor_service.py`, `src/calendar_sync.py`

**`custard-calendar/worker/src/`:**
- Purpose: Cloudflare Worker application -- the single source of truth for all flavor data
- Contains: ~40 JS modules covering route handlers, brand fetchers, caching, data persistence, email, and analytics
- Key files: `worker/src/index.js` (entry + routing), `worker/src/kv-cache.js` (caching core), `worker/src/brand-registry.js` (multi-brand dispatch)

**`custard-calendar/worker/src/migrations/`:**
- Purpose: D1 database schema migrations (numbered 001-010)
- Contains: SQL migration files applied via `wrangler d1 migrations apply`
- Key tables: `snapshots`, `cron_runs`, `forecasts`, `accuracy`, `cron_state`, `quiz_events`, `store_reliability`, `interaction_events`

**`custard-calendar/analytics/`:**
- Purpose: ML-based flavor prediction pipeline
- Contains: Data loading, 3 prediction models, batch forecast generation, evaluation, supporting modules
- Key files: `analytics/predict.py`, `analytics/batch_forecast.py`, `analytics/data_loader.py`

**`custard-calendar/tidbyt/`:**
- Purpose: Starlark pixel-art renderer for 64x32 Tidbyt LED display
- Contains: Single `.star` file with flavor profiles, cone rendering, text abbreviation, brand theming
- Key files: `tidbyt/culvers_fotd.star`

**`custard-calendar/docs/`:**
- Purpose: GitHub Pages static frontend served at `custard.chriskaschner.com`
- Contains: 14+ HTML pages, shared JS modules, quiz data, map assets, sprites, service worker
- Key files: `docs/index.html`, `docs/planner-shared.js`, `docs/cone-renderer.js`

**`custard-calendar/scripts/`:**
- Purpose: Python utility scripts for data backfill, upload, evaluation, and repo health checks
- Contains: Backfill scrapers (national, Wayback Machine), D1 upload scripts, coverage checks
- Key files: `scripts/upload_forecasts.py`, `scripts/evaluate_forecasts.py`, `scripts/check_repo_structure.py`

**`custard-calendar/tools/`:**
- Purpose: Development-time tooling not run in production
- Contains: Manifest builder (OSM geocoding), fixture capture, OG image generator, test runners
- Key files: `tools/build_manifest.py`, `tools/capture_fixture.py`

**`custard-calendar/data/`:**
- Purpose: Historical flavor data and generated forecasts
- Contains: SQLite backfill database, checkpoint files, forecast JSON output
- Key files: `data/backfill/flavors.sqlite`, `data/forecasts/latest.json`

**`custard-calendar/widgets/`:**
- Purpose: iOS Scriptable app widgets
- Contains: 2 JavaScript widget files for Scriptable.app
- Key files: `widgets/custard-scriptable.js`, `widgets/custard-today.js`

**`custard-calendar/archive/`:**
- Purpose: Deprecated code kept for reference
- Contains: Old Alexa skill (Lambda + interaction model), old Tidbyt community PR submission
- Generated: No
- Committed: Yes (historical reference)

## Key File Locations

**Entry Points:**
- `custard-calendar/main.py`: Python pipeline orchestrator (fetch -> calendar -> tidbyt)
- `custard-calendar/worker/src/index.js`: Cloudflare Worker entry (HTTP + cron handlers)
- `custard-calendar/analytics/batch_forecast.py`: Forecast generation CLI

**Configuration:**
- `custard-calendar/config.yaml`: Store slugs, calendar ID, Tidbyt device config
- `custard-calendar/config.example.yaml`: Example config (template)
- `custard-calendar/pyproject.toml`: Python dependencies and pytest config
- `custard-calendar/worker/wrangler.toml`: Cloudflare Worker bindings (KV, D1, crons, env vars)
- `custard-calendar/worker/package.json`: Node dependencies and scripts
- `custard-calendar/worker/vitest.config.js`: Worker test framework config

**Core Logic (Worker):**
- `custard-calendar/worker/src/brand-registry.js`: Slug -> fetcher routing (6 brands)
- `custard-calendar/worker/src/kv-cache.js`: KV read/write with sanitization and dual-write to D1
- `custard-calendar/worker/src/flavor-fetcher.js`: Culver's `__NEXT_DATA__` parser
- `custard-calendar/worker/src/snapshot-writer.js`: D1 append-only historical writes
- `custard-calendar/worker/src/ics-generator.js`: RFC 5545 .ics generation
- `custard-calendar/worker/src/alert-checker.js`: Scheduled alert + digest email handler
- `custard-calendar/worker/src/signals.js`: Statistical flavor pattern detection

**Core Logic (Python):**
- `custard-calendar/src/flavor_service.py`: Worker API client, local cache management
- `custard-calendar/src/calendar_sync.py`: Google Calendar OAuth + event CRUD
- `custard-calendar/analytics/predict.py`: 3 ML prediction models
- `custard-calendar/analytics/data_loader.py`: SQLite data loading with cleaning

**Testing:**
- `custard-calendar/worker/test/`: Worker tests (574 tests, 32 suites) -- vitest
- `custard-calendar/tests/`: Python root tests -- pytest
- `custard-calendar/scripts/tests/`: Script tests -- pytest
- `custard-calendar/analytics/tests/`: Analytics tests (117 tests) -- pytest
- `custard-tidbyt/tests/`: Community app API contract tests -- pytest

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `flavor_service.py`, `batch_forecast.py`)
- Worker JS modules: `kebab-case.js` (e.g., `brand-registry.js`, `kv-cache.js`)
- Worker tests: `{module-name}.test.js` (e.g., `kv-cache.test.js`)
- Python tests: `test_{module_name}.py` (e.g., `test_flavor_service.py`)
- D1 migrations: `{NNN}_{description}.sql` (e.g., `001_snapshots.sql`)
- Starlark: `snake_case.star` (e.g., `culvers_fotd.star`)
- HTML pages: `kebab-case.html` (e.g., `forecast-map.html`)

**Directories:**
- Python packages: `snake_case/` with `__init__.py` (e.g., `analytics/`, `scripts/`)
- Worker: `src/`, `test/`, `scripts/`
- Data: `data/backfill/`, `data/forecasts/`

## Where to Add New Code

**New Worker API Route:**
1. Create handler in `custard-calendar/worker/src/{route-name}.js`
2. Import and wire up in `custard-calendar/worker/src/index.js` (add to route dispatch chain)
3. Add rate limit config if route is expensive or writable
4. Add tests in `custard-calendar/worker/test/{route-name}.test.js`

**New Brand Fetcher:**
1. Create fetcher in `custard-calendar/worker/src/{brand}-fetcher.js` (export `fetch{Brand}Flavors`)
2. Register in `custard-calendar/worker/src/brand-registry.js` (add to `BRAND_REGISTRY` array)
3. Add tests in `custard-calendar/worker/test/{brand}-fetcher.test.js`

**New Analytics Model:**
1. Subclass `FlavorPredictor` in `custard-calendar/analytics/predict.py` or new module
2. Add tests in `custard-calendar/analytics/tests/test_{model}.py`
3. Wire into `custard-calendar/analytics/batch_forecast.py` if it should run in batch

**New Python Pipeline Step:**
1. Add module to `custard-calendar/src/`
2. Wire into `custard-calendar/main.py` (add step function + CLI flag)
3. Add tests in `custard-calendar/tests/test_{module}.py`

**New GitHub Pages Page:**
1. Create HTML file in `custard-calendar/docs/{page-name}.html`
2. Use Worker API v1 endpoints for data (no build step)
3. Reuse shared JS from `docs/planner-shared.js` or `docs/cone-renderer.js` where applicable

**New Utility Script:**
1. Create in `custard-calendar/scripts/{script_name}.py`
2. Add tests in `custard-calendar/scripts/tests/test_{script_name}.py`

**New D1 Migration:**
1. Create `custard-calendar/worker/src/migrations/{NNN}_{description}.sql`
2. Number must be one higher than the current max (currently 010)
3. Apply with `npx wrangler d1 migrations apply custard-snapshots`

**New Tidbyt Flavor Profile:**
1. Add entry to `FLAVOR_PROFILES` dict in `custard-calendar/tidbyt/culvers_fotd.star`
2. Mirror in `custard-calendar/worker/src/flavor-colors.js` for SVG social cards

## Special Directories

**`custard-calendar/data/backfill/`:**
- Purpose: Historical flavor data SQLite database
- Generated: Partially (SQLite DB created by backfill scripts)
- Committed: Checkpoint files committed; large SQLite DB likely gitignored

**`custard-calendar/worker/.wrangler/`:**
- Purpose: Wrangler local dev state (KV, D1 local emulation, cache)
- Generated: Yes (by `npx wrangler dev`)
- Committed: No (gitignored)

**`custard-calendar/credentials/`:**
- Purpose: Google OAuth credential files
- Generated: No (manual setup required)
- Committed: No (gitignored; see `GOOGLE_API_SETUP.md` for setup instructions)

**`custard-calendar/.claude/`:**
- Purpose: Claude Code agent definitions (eng, pm, qa, reviewer), checkpoints, worktrees
- Generated: Partially
- Committed: Agent definitions yes; worktrees/checkpoints no

**`custard-calendar/output/`:**
- Purpose: Generated output files (images, etc.)
- Generated: Yes
- Committed: No

**`custard-calendar/tmp/`:**
- Purpose: Temporary files during development
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-07*
