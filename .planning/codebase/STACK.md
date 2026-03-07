# Technology Stack

**Analysis Date:** 2026-03-07

## Repository Layout

This is a **mono-workspace** containing three sub-projects under one parent directory:

| Sub-project | Path | Language | Purpose |
|-------------|------|----------|---------|
| custard-calendar | `custard-calendar/` | Python + JavaScript + Starlark | Main application: Worker API, Python pipeline, frontend, analytics, Tidbyt renderer |
| custard-tidbyt | `custard-tidbyt/` | Starlark + Python | Standalone Tidbyt community app submission (separate git repo) |
| (root) | `.` | Markdown | Product briefs, agent configs, restructuring plans |

The primary codebase is **custard-calendar/**. All paths below are relative to that directory unless noted.

## Languages

**Primary:**
- JavaScript (ES modules) — Cloudflare Worker API (`worker/src/`), frontend pages (`docs/`), ~47 Worker source files
- Python 3.12 — Pipeline orchestration (`main.py`, `src/`), analytics/ML (`analytics/`), tooling (`scripts/`, `tools/`)

**Secondary:**
- Starlark — Tidbyt display renderer (`tidbyt/culvers_fotd.star`), Python-like but restricted (no f-strings, limited builtins)
- HTML/CSS — Static frontend pages (`docs/*.html`, `docs/style.css`), no framework, vanilla JS
- SQL — D1 database migrations (`worker/src/migrations/`)

## Runtime

**Worker (Production API):**
- Cloudflare Workers runtime (V8 isolate, ES module format)
- Compatibility date: `2024-09-23` (set in `worker/wrangler.toml`)
- Entry point: `worker/src/index.js`

**Python Pipeline:**
- Python 3.12 (specified in `.python-version`)
- Managed with `uv` (lockfile: `uv.lock` present)

**Frontend:**
- Static HTML served via GitHub Pages (no build step, no bundler)
- Service Worker for offline caching (`docs/sw.js`, stale-while-revalidate strategy)
- Custom domain: `custard.chriskaschner.com` (configured via `docs/CNAME`)

**Tidbyt:**
- Pixlet runtime (Tidbyt's Starlark interpreter)
- Install: `brew install tidbyt/tidbyt/pixlet`

## Package Managers

**Python:**
- `uv` (primary, per user preference)
- `pyproject.toml` at `custard-calendar/pyproject.toml`
- Lockfile: `uv.lock` (present, committed)
- Install: `uv sync` (base), `uv sync --all-extras` (with analytics ML deps)

**JavaScript (Worker only):**
- npm
- `worker/package.json`
- Lockfile: `worker/package-lock.json` (present, committed)
- Install: `cd worker && npm install`

## Frameworks

**Core:**
- Cloudflare Workers — Serverless API platform (no Express, no Hono, raw `fetch` handler)
- GitHub Pages — Static site hosting (no SSG, no Next.js, pure HTML files)

**Testing:**
- Vitest 3.x — Worker unit tests (`worker/vitest.config.js`), 810+ tests
- `@cloudflare/vitest-pool-workers` 0.8.x — Cloudflare-specific test pool for Workers
- Playwright 1.58.x — Browser smoke tests (`worker/playwright.config.mjs`), 32 tests
- pytest 8.x — Python tests (179 tests across `tests/`, `scripts/tests/`, `analytics/tests/`)

**Build/Dev:**
- Wrangler 4.x — Cloudflare Worker CLI (dev server, deploy, secrets management)
- Pixlet — Tidbyt app renderer/pusher

**Analytics/ML:**
- pandas 2.x — Data manipulation
- numpy 1.24+ — Numerical computation
- scikit-learn 1.3+ — ML models (frequency/recency, collaborative filtering, PCA)
- scipy 1.11+ — Statistical functions

## Key Dependencies

**Critical (Python):**
- `google-api-python-client` 2.189+ — Google Calendar API integration
- `google-auth` 2.48+ — Google OAuth2 authentication
- `google-auth-oauthlib` 1.2.4+ — OAuth2 flow for Google APIs
- `requests` 2.32+ — HTTP client for Worker API calls
- `pyyaml` 6.0.3+ — Config file parsing (`config.yaml`)
- `pillow` 12.1+ — Image processing (dev dependency group)

**Critical (JavaScript/Worker):**
- No runtime npm dependencies. The Worker is zero-dependency; all code is hand-written.
- `wrangler` 4.x — Dev/deploy toolchain only
- `vitest` 3.x + `@cloudflare/vitest-pool-workers` — Test infrastructure only

**Frontend (vendored, no npm):**
- Leaflet.js — Map rendering (loaded via CDN, not in package.json)
- `leaflet-heat-0.2.0.js` — Heatmap plugin (`docs/vendor/`)
- No React, no Vue, no framework. All pages use vanilla JS with `window.CustardPlanner` global.

**Infrastructure:**
- `icalendar` 6.0+ — iCal parsing in Python tests (dev dependency only)

## Configuration

**Environment:**
- `.env` file present in `custard-calendar/` (contains `TIDBYT_API_TOKEN` and other secrets -- existence noted only, never read)
- `config.yaml` — Primary pipeline config: store definitions, Worker base URL, Google Calendar ID, Tidbyt device config, cron schedule
- `config.example.yaml` — Template for new setups
- `credentials/` directory (gitignored) — Google OAuth credentials

**Worker Secrets (set via `npx wrangler secret put`):**
- `RESEND_API_KEY` — Email sending via Resend API
- `REPORT_EMAIL_TO` — Weekly analytics report recipient
- `ADMIN_ACCESS_TOKEN` — Bearer token for admin-only API routes
- `OPERATOR_EMAIL` — Recipient for cron operator alerts
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — Used in CI for D1 access

**Worker Environment Variables (in `worker/wrangler.toml` `[vars]`):**
- `ENVIRONMENT` — "production"
- `ALLOWED_ORIGIN` — CORS origin restriction
- `ALERT_ALLOWED_ORIGINS` — Comma-separated allowlist for alert subscriptions
- `PUBLIC_WRITE_ALLOWED_ORIGINS` — Comma-separated allowlist for browser POST writes
- `WORKER_BASE_URL` — Base URL for alert email links
- `ALERT_FROM_EMAIL` — Verified sender for Resend
- `OPERATOR_PRIORITY_SLUGS` — Priority stores for cron monitoring
- Various `OPERATOR_*` threshold vars for alerting

**GitHub Actions Secrets:**
- `TIDBYT_API_TOKEN` — Tidbyt device push
- `TIDBYT_DEVICE_ID` — Tidbyt device identifier
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` — D1 backfill coverage checks

**Build:**
- `worker/wrangler.toml` — Worker build config, KV namespace bindings, D1 database bindings, cron triggers
- `worker/vitest.config.js` — Test config with coverage thresholds (branches: 60%, functions: 70%, lines: 70%)
- `worker/playwright.config.mjs` — Browser test config (serves docs via Python http.server)
- `pyproject.toml` — Python project config, pytest options

## Platform Requirements

**Development:**
- Python 3.12+ with `uv`
- Node.js 20+ with npm (for Worker development/testing)
- Pixlet CLI (`brew install tidbyt/tidbyt/pixlet`) for Tidbyt rendering
- Google OAuth credentials for calendar sync
- Chrome/Chromium for Playwright browser tests (set `CHROME_BIN` if needed)

**Production:**
- Cloudflare Workers (free tier: 100k req/day)
- Cloudflare KV (flavor cache, alert subscriptions, rate limit counters)
- Cloudflare D1 (SQLite-compatible database for historical snapshots)
- GitHub Pages (static frontend hosting)
- Tidbyt device (physical 64x32 pixel LED display)
- GitHub Actions (CI, daily Tidbyt push, weekly data quality checks, security scans)

**CI Workflows (in `.github/workflows/`):**

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | push/PR to main | Worker tests (npm), Python tests (uv/pytest), repo structure check |
| Tidbyt Daily Push | `tidbyt-daily.yml` | Daily cron (noon UTC) + manual | Fetch flavors, render, push to Tidbyt device |
| Security Scan | `security.yml` | push/PR to main | TruffleHog secret scanning |
| Data Quality Gate | `data-quality.yml` | Weekly cron (Sunday 8 AM UTC) + manual | D1 backfill coverage, metrics seed freshness |

## Commands Reference

```bash
# Python pipeline
uv sync                                  # Install base dependencies
uv sync --all-extras                     # Install with analytics ML deps
uv run python main.py                    # Full pipeline: fetch + calendar + tidbyt
uv run python main.py --fetch-only       # Fetch and cache only
uv run python main.py --calendar-only    # Calendar sync from cache
uv run python main.py --tidbyt-only      # Render + push from cache

# Worker development
cd worker && npx wrangler dev            # Local dev server
cd worker && npx wrangler deploy         # Deploy to production

# Testing
cd worker && npm test                    # Worker unit tests (810+)
cd worker && npm run test:browser -- --workers=1  # Playwright browser tests
uv run pytest tests/ scripts/tests/ analytics/tests/ -v  # All Python tests (179)
uv run pytest analytics/tests/ -v        # Analytics tests only (117)

# Tidbyt
pixlet render tidbyt/culvers_fotd.star view_mode=three_day ...  # Local render
uv run python tools/test_tidbyt.py       # Render + HTML comparison viewer
```

---

*Stack analysis: 2026-03-07*
