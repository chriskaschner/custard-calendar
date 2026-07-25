# Architecture

Custard Calendar: multi-brand frozen custard observability platform.

---

## Data Flow

```
Upstream Brand Sites
(Culver's __NEXT_DATA__,
 Kopp's / Gille's /
 Hefner's / Kraverz /
 Oscar's HTML)
        |
        v
Cloudflare Worker  <---> KV (24h TTL flavor cache)
(worker/src/)      <---> D1 (snapshots, events, reliability,
        |                    cron_runs, subscriptions)
        |
        +---> .ics feed          (calendar clients)
        +---> JSON API v1        (all consumers)
        +---> SVG social cards   (/og/*)
        +---> Forecast endpoint  (/api/v1/forecast/{slug})
        |
   +----+----+
   |         |
   v         v
Python    GitHub Pages
pipeline  (docs/ — 9 HTML pages)
(main.py)   |
   |         +-- planner-shared.js (client hub)
   |         +-- cone-renderer.js
   |         +-- quiz engine (engine.js)
   v
Google Calendar
Tidbyt device
```

---

## Three-Layer Model

### Presentation Layer — `docs/`

Nine HTML pages served via GitHub Pages:

| Page | File | Primary role |
|---|---|---|
| Forecast (home) | `index.html` | Today + signal + plan CTA |
| Custard Map | `map.html` | Leaflet map, flavor fronts |
| Flavor Radar | `radar.html` | 7-day outlook per store |
| Flavor Alerts | `alerts.html` | Email subscription |
| Siri Shortcut | `siri.html` | Voice assistant setup |
| Calendar Sub | `calendar.html` | .ics subscription guide |
| Quiz / Mad Lib | `quiz.html` | Flavor personality quiz |
| Widget Setup | `widget.html` | Scriptable widget guide |
| Privacy | `privacy.html` | Data use explainer |

Shared client modules:
- `planner-shared.js` — `CustardPlanner` class: WORKER_BASE constant, haversine, escapeHtml, share button, certainty tiers, signal cards, reliability banners, action CTAs, store search
- `cone-renderer.js` — browser-side re-export of the four cone render tiers (Mini, HD, Hero, Premium)
- `style.css` — `:root` CSS tokens (`--brand #005696`, `--brand-dark`, `--text`, `--text-muted`, `--bg`, `--border`, `--radius`)

**Cross-layer interface:** Presentation calls Worker via `WORKER_BASE` (set once in `planner-shared.js`). No direct upstream fetches from browser.

---

### Decision Layer — `worker/src/`

Pure functions; no I/O, no KV/D1 reads. Testable in isolation.

| Module | Role |
|---|---|
| `planner.js` | Haversine scoring, certainty-weighted ranking, `/api/v1/plan` |
| `certainty.js` | Confirmed/Watch/Estimated/None tiers, score caps, threshold constants |
| `signals.js` | 5 signal types (overdue, dow_pattern, seasonal, active_streak, rare_find), chi-squared gating |
| `reliability.js` | Per-store Calendar Reliability Index, freshness/missing-window/recovery metrics |
| `flavor-matcher.js` | FLAVOR_FAMILIES, SIMILARITY_GROUPS, BRAND_COLORS, normalize() |

**Rule:** Decision-layer modules must not import from KV-cache, D1 query helpers, or brand fetchers. New decision logic belongs here first; only promoted to a route handler after tests pass.

---

### Data Layer — `worker/src/`

All I/O: KV reads/writes, D1 queries, upstream brand fetches.

| Module | Role |
|---|---|
| `kv-cache.js` | getFlavorsCached(), KV read/write, 24h TTL, D1 snapshot write-through |
| `brand-registry.js` | BRAND_REGISTRY, getFetcherForSlug(), getBrandForSlug() |
| `flavor-fetcher.js` | Dispatches to per-brand fetchers |
| `store-index.js` | Static in-memory store index (slug → name, city, state, lat, lon) |
| `valid-slugs.js` | Allowlist for store slug validation |
| `snapshot-targets.js` | resolveSnapshotTargets(), cron cursor |

D1 tables: `snapshots`, `flavor_stats`, `store_reliability`, `interaction_events`, `quiz_events`, `subscriptions`, `alert_subscriptions`, `cron_runs`, `metrics_cache`.

---

## API Contract Points

The canonical machine-readable schema is at `GET /api/v1/schema` (see `worker/src/api-schema.json`).

Key endpoints and their shapes:

### `GET /api/v1/flavors?slug=<slug>`
```json
{
  "name": "Store Name",
  "flavors": [
    { "title": "Flavor Name", "date": "2026-02-20", "description": "Optional text" }
  ]
}
```

### `GET /api/v1/today?slug=<slug>`
```json
{
  "store": "Store Name",
  "slug": "mt-horeb",
  "brand": "Culver's",
  "date": "2026-02-20",
  "flavor": "Flavor Name",
  "description": "Optional text",
  "rarity": { "appearances": 12, "avg_gap_days": 47, "label": "Rare" },
  "spoken": "Today the flavor of the day at ...",
  "spoken_verbose": "For Thursday..."
}
```

### `GET /api/v1/stores?q=<query>`
```json
{
  "stores": [
    { "slug": "mt-horeb", "name": "Culver's of Mt. Horeb", "brand": "Culver's", "city": "Mt. Horeb", "state": "WI" }
  ]
}
```

### `POST /api/heartbeat/{job}`

Admin-authenticated (`ADMIN_ACCESS_TOKEN` bearer). Records that an external
scheduled job ran. Consumed by the daily operator alert, which reports any job
whose last ping is older than its `OPERATOR_EXPECTED_JOBS` threshold.

```json
{ "ok": true, "job": "tidbyt_daily", "seen_at": "2026-07-25T12:00:00.000Z" }
```

Callers are GitHub Actions workflows, which run outside the Worker and are
therefore invisible to it except through this ping. The KV key is written
without a TTL on purpose: an expired key and a never-run job must look identical
to the alert, and both mean "overdue".

**Contract update rule:** Cross-layer interfaces (`/api/v1/*` response shapes, `planner-shared.js` public API) must be updated in this file before merging any PR that changes them.

---

## Asset Layer

Visual asset catalog (formats, resolutions, color profiles) lives at `docs/ASSET_SPEC.md`. This is the reference for any external asset generation work and the blocker for the flavor asset parity audit.

---

## Risk Register

| # | Risk | Mitigation | Status |
|---|---|---|---|
| 1 | **Contract drift** — sibling repo (custard-tidbyt) implements its own API response mapping; a Worker shape change silently breaks it | Machine-readable schema at `GET /api/v1/schema` (see `worker/src/api-schema.json`); `schema_version` field bumped on breaking changes; sibling repo has smoke tests hitting live API | Mitigated |
| 2 | **Duplicate client logic** — haversine, flavorMatchScore, and store-lookup exist in multiple repos | `haversine` and `escapeHtml` consolidated into `planner-shared.js`; WORKER_BASE single source in same file. Remaining gap: flavor families in planner-shared.js fallback — monitor, no action needed now | Partial |
| 3 | **CI asymmetry** — Worker has 1226 tests; Python pipeline has pytest but no live-API integration gate | `ci.yml` runs both `cd worker && npm test` and `uv run pytest` on every push/PR to main. Playwright browser tests are still not wired into CI | Partial |
| 4 | **Doc drift** — CLAUDE.md and inline comments are sole architecture truth | This file (`ARCHITECTURE.md`) is now the canonical layer contract; required update before any cross-layer interface change | Mitigated |
| 5 | **Monolithic Worker** — index.js is one deploy unit; a bad handler can silently kill the platform | Decomposed into route-today.js, route-calendar.js, route-nearby.js, kv-cache.js, brand-registry.js; per-file coverage thresholds enforced in vitest.config.js; Worker Services would require paid plan, not pursued now | Partial |
| 6 | **Deploy drift** — `wrangler deploy` is manual, so a green `main` does not imply the Worker is running that code. Phase 37 (store pages, sitemap) sat committed and undeployed; production 404'd on every SEO route the milestone existed to ship | None yet. Needs either a deploy job in `ci.yml` or a deployed-version endpoint the tests can assert against | **Open** |
| 7 | **Scheduled workflow auto-disable** — GitHub disables `schedule:` workflows after 60 days of repo inactivity. `Tidbyt Daily Push` and `Data Quality Gate` were silently disabled; the Tidbyt device and the data-quality gate went dark with no alert | Heartbeat protocol: each scheduled workflow POSTs `/api/heartbeat/{job}` on every run (`if: always()`, so it signals liveness not success). `operator-alerts.js` raises a "Scheduled job silent" issue in the daily operator email when a ping is overdue per `OPERATOR_EXPECTED_JOBS` | Mitigated |

---

## Greenfield Target Architecture

The goal is clean layer separation: Presentation never touches storage, Decision layer has no I/O, Data layer has no scoring logic. The current codebase is 70–80% there. This section documents the target state and the gap.

### Target State

**Presentation Layer (`docs/`)**
- All state lives in `localStorage` via `CustardPlanner` helpers (`getSavedStore`, `getFavorites`, etc.)
- All API calls go through `WORKER_BASE` — no direct upstream fetches from browser
- Zero business logic: rendering, event handling, and CTA assembly only
- `planner-shared.js` is the only shared module; no cross-page duplication

**Decision Layer (`worker/src/`)**
- `planner.js`, `certainty.js`, `signals.js`, `reliability.js` are pure functions — no I/O
- All scoring logic lives here; route handlers only marshal I/O and call into this layer
- The certainty policy is encoded in constants, not hidden in conditional branches:
  - `MIN_PROBABILITY = 0.02` (~3x random baseline)
  - `MIN_HISTORY_DEPTH = 14` days
  - `MAX_FORECAST_AGE_HOURS = 168` (7 days)
  - Below any threshold → `NONE`, not a misleading `Estimated`
- New decision logic always gets a unit test before it touches a route handler

**Data Layer (`worker/src/`)**
- `kv-cache.js` owns all KV reads/writes; no other module writes to KV
- `brand-registry.js` owns all upstream fetchers; no route handler fetches upstream directly
- D1 queries are encapsulated in module-level helpers; no inline SQL in route handlers

### Current Gaps (incremental migration targets)

| Gap | Location | Migration path |
|---|---|---|
| Rarity query inline in `alert-checker.js` | `findRaritySpotlightForWeek()` | Move to a `flavor-stats.js` module with a named export |
| Brand-specific logic in `index.js` (`transformLocatorData`) | `worker/src/index.js` | Extract to `planner.js` or `store-index.js` |
| Calendar preview JS inline in `index.html` | `docs/index.html` | Move to `planner-shared.js` if reused; leave inline if not |
| Planner hits Culver's upstream directly | `worker/src/planner.js` | Add multi-brand locator abstraction when other brands need it |

### Migration rule

**Incremental migration, not rewrite.** When touching a file:
1. Move any scoring/decision logic into the Decision layer.
2. Move any KV/D1 I/O into named helpers in the Data layer.
3. Do not rewrite working code; only move boundaries.

A PR that adds new Decision-layer logic without tests, or adds I/O to an existing Decision-layer module, requires explicit justification in the PR description.
