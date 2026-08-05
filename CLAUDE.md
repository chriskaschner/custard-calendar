# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Task Tracking

**`TODO.md`** is the canonical task list. It is checked into git and persists across sessions.

- At the start of any session, read `TODO.md` to understand outstanding work
- When completing a task, check it off in `TODO.md` and commit the update
- When new work is identified, add it to `TODO.md` under the appropriate section
- Do NOT track tasks only in session task lists or MEMORY.md — those are ephemeral

## Project Overview

Multi-brand frozen custard observability platform with five layers:

1. **Cloudflare Worker** (`worker/`) — single source of truth. Six brand fetchers (Culver's, Kopp's, Gille's, Hefner's, Kraverz, Oscar's), KV + D1 storage, versioned API v1, .ics generation, alert emails, social cards, forecast endpoint.
2. **Python Pipeline** (`src/`, `main.py`) — calls the Worker API (no direct scraping), writes local cache, syncs Google Calendar, pushes to Tidbyt.
3. **Analytics** (`analytics/`) — ML prediction pipeline: frequency/recency models, Markov chains, collaborative filtering, batch forecast generation, KV upload.
4. **Tidbyt Renderer** (`tidbyt/culvers_fotd.star`) — pure Starlark renderer with no HTTP calls; receives flavor data via pixlet config params.
5. **GitHub Pages** (`docs/`) — 9 static pages: calendar subscription, custard map, flavor alerts, Siri Shortcut setup, Flavor Radar, Forecast map, Quiz/Mad Lib, Widget, Forecast home.

## Commands

```bash
# Install dependencies (runtime only)
uv sync

# Install everything needed to run the test suite (pytest, scikit-learn, scipy,
# icalendar live in optional extras -- plain `uv sync` does NOT install them).
# Without this, `uv run pytest` silently falls back to a system pytest and every
# analytics test dies on a numpy/pandas ABI mismatch.
uv sync --all-extras

# Full pipeline: fetch → cache → calendar sync → tidbyt render + push
uv run python main.py

# Individual steps
uv run python main.py --fetch-only       # Only fetch and cache
uv run python main.py --calendar-only    # Only sync calendar from cache
uv run python main.py --tidbyt-only      # Only render + push to Tidbyt from cache
uv run python main.py --skip-calendar    # Fetch + tidbyt, skip calendar
uv run python main.py --skip-tidbyt      # Fetch + calendar, skip tidbyt

# Render Tidbyt app locally (requires: brew install tidbyt/tidbyt/pixlet)
pixlet render tidbyt/culvers_fotd.star \
    view_mode=three_day location_name="Mt. Horeb" \
    flavor_0="Chocolate Fudge" flavor_date_0="2026-02-20"

# Serve Tidbyt app with live preview at http://localhost:8080
pixlet serve tidbyt/culvers_fotd.star

# Render both views and open HTML comparison viewer
uv run python tools/test_tidbyt.py

# Deploy to Tidbyt device (convenience wrapper)
./scripts/deploy_tidbyt.sh

# Test the flavor service directly
uv run python -m src.flavor_service

# Worker tests (1226 tests, 58 suites)
cd worker && npm test

# Browser smoke tests (Playwright: nav + Radar Phase 2)
cd worker && npm run test:browser -- --workers=1

# All Python tests (322 tests across tests/ + scripts/tests/ + analytics/tests/)
uv run pytest tests/ scripts/tests/ analytics/tests/ -v

# Frontend browser nav click-through is included in:
# uv run pytest tests/ -v
# (requires `cd worker && npm install` and local Chrome/Chromium;
# set CHROME_BIN if needed)

# Analytics tests only (125 tests)
uv run pytest analytics/tests/ -v

# Batch forecast generation
uv run python -m analytics.batch_forecast --store mt-horeb
uv run python -m analytics.batch_forecast --store mt-horeb --days 7

# Refresh forecasts and upload to D1
./scripts/refresh_forecasts.sh --store mt-horeb

# Evaluate forecast accuracy against D1 snapshots
uv run python scripts/evaluate_forecasts.py --store mt-horeb
uv run python scripts/evaluate_forecasts.py --upload  # Write metrics to D1

# Build store manifest (queries OSM + probes culvers.com)
uv run python tools/build_manifest.py
uv run python tools/build_manifest.py --state WI   # Wisconsin first
uv run python tools/build_manifest.py --resume      # Resume interrupted build

# Capture test fixtures from live data
uv run python tools/capture_fixture.py

# Telemetry measurement report (requires WORKER_API_TOKEN env var)
uv run python scripts/analytics_report.py           # 7-day summary
uv run python scripts/analytics_report.py --days 30  # 30-day window
uv run python scripts/analytics_report.py --baseline  # write to WORKLOG.md

# Local Worker development
cd worker && npx wrangler dev

# Deploy the Worker -- ALWAYS via npm, ALWAYS from worker/
cd worker && npm run deploy

# Regenerate the trivia metrics seed (pulls live rows from D1 + frozen backfill).
# Requires wrangler auth: `npx wrangler login` from worker/, or CLOUDFLARE_API_TOKEN.
uv run python scripts/generate_intelligence_metrics.py
uv run python scripts/generate_intelligence_metrics.py --no-d1  # frozen corpus only

# Check that the committed seed was built from recent DATA (not just re-run)
uv run python scripts/check_metrics_seed_freshness.py
```

## Deploying the Worker

**Always `cd worker && npm run deploy`. Never a bare `npx wrangler deploy`.**

`npm run deploy` runs `scripts/predeploy-check.mjs` first and pins
`--config wrangler.toml`, so the working directory cannot decide which config
wins. A bare `wrangler deploy` from the repo root took production down on
2026-08-01: wrangler scaffolded `/wrangler.jsonc` with `name = "custard-calendar"`
(the production Worker name), `assets: { directory: "public" }`, and **no `main`**.
With no `main` wrangler builds a no-op asset server, so the deploy replaced the
real Worker with a static server for four stale Hugo files. Every route 404'd on
both domains, including `/v1/calendar.ics`.

Two things make this hard to spot:

- `wrangler.jsonc` is gitignored (`.gitignore:89`), so it never appears in `git status`.
- The bad deploy prints an ordinary success message.

**The tell:** a correct deploy lists the three `schedule:` cron triggers in its
output. A no-op asset deploy omits them and instead logs
`Read N files from the assets directory`. Check for the `schedule:` lines every time.

If you find a stray `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` at the
repo root, delete it — the predeploy check will refuse to run until you do.

## Scheduled Job Heartbeats

`Tidbyt Daily Push` and `Data Quality Gate` run in GitHub Actions, which
auto-disables `schedule:` workflows after 60 days of repo inactivity. That
happened in June 2026 and went unnoticed for five weeks.

Liveness is monitored by **UptimeRobot heartbeat monitors**, not by this repo
and not by the Worker. Each workflow ends with a `curl` to its heartbeat URL;
UptimeRobot alerts when a ping stops arriving.

**Why external:** a dead man's switch only works if the watcher sits outside the
system it watches. A check inside the Worker could never detect the Worker's own
cron dying, a Cloudflare outage, or an unavailable KV — precisely the cases you
most need to hear about. UptimeRobot is outside both GitHub Actions and
Cloudflare, so it covers all of them.

| Job | GitHub secret | Suggested threshold |
|---|---|---|
| Tidbyt Daily Push | `UPTIMEROBOT_HEARTBEAT_TIDBYT` | ~2 days (daily cron; absorbs one transient failure) |
| Data Quality Gate | `UPTIMEROBOT_HEARTBEAT_DATA_QUALITY` | ~9 days (weekly cron) |
| Oscar's Ingest | `UPTIMEROBOT_HEARTBEAT_OSCARS` | ~2 days (daily cron) |

The ping fires only on success, so what is monitored is "no *successful* run in
N days" — strictly more informative than bare liveness. If a secret is unset the
step warns and passes rather than failing the workflow.

**If you add a scheduled workflow, add a heartbeat step and create a matching
UptimeRobot monitor** — otherwise its silence is invisible.

After a long dormancy, check `gh workflow list --all` for `disabled_inactivity`
and re-enable with `gh workflow enable "<name>"`.

## Architecture

### Oscar's is fetched from outside Cloudflare

`oscarscustard.com` sits behind Cloudflare bot protection that returns a 403
"Just a moment..." challenge to the Worker's egress. Verified 2026-08-04 from a
Worker running on Cloudflare's edge: bot UA, plain Chrome UA, full Chrome +
`Sec-Fetch-*`, and no headers at all were all challenged, on both the WP REST
endpoint and the public page, while the identical request from a residential IP
returned 200. **The block is on the calling network, so no change to
`oscars-fetcher.js` can fix it** — don't spend time on headers again.

Oscar's is therefore fetched by the `Oscar's Ingest` workflow
(`scripts/fetch_oscars.py`), which runs daily in GitHub Actions and writes to
both D1 and the `flavors:oscars-shared` KV key. The parse is not duplicated:
`scripts/oscars_parse.mjs` imports the Worker's own parser, sanitizer, and
`makeFlavorCacheRecord`, so the record shape cannot drift from what
`parseFlavorCacheRecord` accepts.

It went unnoticed from 2026-02-22 to 2026-08-04. See "Brand monitoring" below.

### Brand monitoring

Brands are watched by `getBrandWatchSlugs()` in `worker/src/brand-registry.js` —
one representative slug per brand, derived from the registry so a new brand is
covered the day it is added. Two checks consume it:

- `operator-alerts.js` — daily, in-Worker: "brand gone dark" plus per-brand
  parse-failure alerting.
- `scripts/check_brand_freshness.py` — weekly, in CI, external to Cloudflare.

Both key off `MAX(fetched_at)`, **not** `MAX(date)`. The date column is how far
ahead a brand's published schedule runs and stays in the future long after the
fetch breaks: Kraverz routinely publishes four weeks out, so a `MAX(date)` check
would call it healthy for a month after it died.

Before this existed the watch list was three Madison Culver's stores, and no
Milwaukee brand was monitored by anything.

### Data Flow
```
Upstream Brand Sites → Cloudflare Worker (KV + D1)
(Culver's, Kopp's,        │
 Gille's, Hefner's,       ├── .ics feed (calendar clients)
 Kraverz, Oscar's)        ├── JSON API v1 (consumers)
                           ├── GitHub Pages (map, alerts, radar, siri)
                           ├── Social cards (SVG OG images)
                           └── Forecast endpoint (ML predictions)
                                  │
                        ┌─────────┴──────────┐
                        ▼                    ▼
                  Python pipeline       Tidbyt display
                  (calendar sync)       (pixel art)
```

Each brand has a dedicated upstream fetcher. Culver's uses `__NEXT_DATA__` JSON, Kopp's/Gille's/Hefner's/Kraverz/Oscar's parse HTML. The Worker caches fetched data in KV (24h TTL) and dual-writes snapshots to D1 for historical queries.

### Pixlet Config Constraint
Pixlet only accepts string `key=value` pairs. Flavor data is passed as flattened params:
```
flavor_0="Name" flavor_date_0="2026-02-20" flavor_1="Name" flavor_date_1="2026-02-21"
```
The Starlark app reads these with `config.get("flavor_{}".format(i))` in a loop.

### Brand Colors
- Culver's dark blue: `#005696` — use for Google Calendar event color and any branded UI elements

### Configuration
- `config.yaml` — locations (primary/backup), calendar ID, tidbyt device config
- `.env` — `TIDBYT_API_TOKEN` for device deployment
- `credentials/` — Google OAuth credentials (gitignored)

## Tidbyt Display Constraints

The Tidbyt display is **64×32 pixels**. This is the critical constraint for all Starlark layout work:
- `tom-thumb` font: ~4px per character width
- Three-day view: 3 mini cones × 11px = 33px, leaving ~31px for spacing
- Flavor text labels must be ≤6 characters for 3-column layout to fit
- `format_flavor_for_display()` uses abbreviation maps and base-noun anchoring to compress names
- Always limit rendered flavors to `flavors[:3]` in three-day view
- Use `space_evenly` (not `space_around`) for consistent cone spacing

## Starlark Specifics
- Starlark is Python-like but not Python: no f-strings (use `.format()`), limited builtins
- The Starlark app is a pure renderer — all data fetching is in Python
- `render.star` and `schema.star` are the only imports needed

## External Rate Limits

Assume all external endpoints have rate limits. Document known limits before issuing bulk requests.

| Service | Known limit | Notes |
|---|---|---|
| Wayback Machine CDX API | ~50 req/min | Enforced in `backfill_wayback_isolated.py`; bust with `--cdx-rpm` |
| Wayback Machine playback | ~12 req/min | Enforced in same script; separate token bucket |
| Culver's upstream site | Undocumented | Respect crawl-delay; fixture captures in `tools/capture_fixture.py` |
| OSM / Nominatim | 1 req/sec | Required for geocoding in `tools/build_manifest.py` |
| Cloudflare Worker (own) | 100k req/day free tier | Workers don't rate-limit themselves; KV reads burn quota |

**Rule for agents and batch scripts:** Before bulk-fetching any external endpoint, confirm rate limit, add explicit sleep/token-bucket, and document the limit in a comment at the call site. No silent tight loops against external services.

## Multi-Agent Coordination

When multiple Claude Code or Codex sessions work in parallel, follow these rules to prevent branch conflicts and squashed work:

1. **Worktree isolation by default** — Codex tasks run in their own git worktree (`Task tool isolation: "worktree"`). Each agent gets a branch from HEAD and merges forward only. No force-push, no rebase onto shared branches.

2. **Claim tasks before starting** — Before beginning a TODO item, write your session identifier next to the task in `TODO.md` (e.g., `- [ ] **Task name** [claimed: codex-session-abc]`). Commit the claim immediately. If a task is already claimed, skip it.

3. **Merge-only-forward rule** — After completing work on a feature branch, open a PR or merge to `main`. Never reset or rebase a branch that another session may have branched from.

4. **Cross-session communication via TODO.md** — Do not rely on in-memory context or WORKLOG.md for coordination. If you discover a blocker or dependency, note it in `TODO.md` next to the relevant task.

5. **Test gate before merge** — `cd worker && npm test` must pass (all tests green) before merging any branch. A session may not merge if tests are failing.

## Widget JS Three-File Sync Discipline

The widget JavaScript lives in two canonical locations that must stay byte-identical:

- `widgets/custard-today.js` — source of record
- `docs/assets/custard-today.js` — GitHub Pages serving path

The `widget-sync` CI job runs `diff widgets/custard-today.js docs/assets/custard-today.js` on every push and PR. If the files diverge, CI fails.

**Rule:** Any edit to either file must be copied to the other in the same commit. There is no build step — copying is manual. CI is the safety net, not the workflow.

## Language & Voice

Two distinct tones depending on audience:

### User-Facing (site copy, alerts, map UI)
- Clear and concise first, clever second
- Weather-themed metaphors where natural: "flavor forecast", "what's scooping", "today's outlook"
- No jargon, no tech references — write for someone checking their phone at Culver's
- Brevity wins: if it can be said in fewer words, use fewer words

### Technical (README, CLAUDE.md, commit messages, code comments)
- Playful enterprise-SaaS energy: "flavor intelligence platform", "custard telemetry", "upstream flavor pipeline"
- Maintains credibility — the architecture is real, the tongue is in cheek
- Treat frozen custard infrastructure with the gravity of a Fortune 500 observability stack
- Code comments stay practical; the SaaS voice lives in docs and descriptions
