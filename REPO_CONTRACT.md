# Repo Contract

Defines the allowed structure, ownership, and rules for this monorepo.
This file is authoritative. New top-level directories require an update here before landing.

## Allowed Top-Level Directories

| Directory | Purpose | Owner | CI/Deploy |
|---|---|---|---|
| `worker/` | Cloudflare Worker (production API + KV/D1) | @chriskaschner | Yes -- `wrangler deploy` |
| `docs/` | GitHub Pages static web app (9 public pages) | @chriskaschner | Yes -- GitHub Pages |
| `src/` | Python pipeline library (calendar sync, flavor service) | @chriskaschner | Yes -- pytest |
| `analytics/` | ML prediction pipeline (batch forecasts, accuracy eval) | @chriskaschner | Yes -- pytest |
| `scripts/` | Operational scripts (backfill, forecast refresh, metrics) | @chriskaschner | Partial -- scheduled |
| `tests/` | Python integration tests | @chriskaschner | Yes -- pytest |
| `tidbyt/` | Canonical Tidbyt Starlark renderer | @chriskaschner | No (manual deploy) |
| `widgets/` | Canonical Scriptable widget source | @chriskaschner | No (manual deploy) |
| `tools/` | One-off generators, fixture capture, and dev utilities | @chriskaschner | No |
| `logs/` | Cron log target (`.gitkeep` only; `logs/*.log` is gitignored) | @chriskaschner | No |
| `archive/` | Inactive code preserved for reference | @chriskaschner | No |
| `.claude/` | Claude Code project settings (`settings.json`) | @chriskaschner | No |
| `.github/` | CI workflows and issue templates | @chriskaschner | Yes |
| `.planning/` | GSD planning documents (phases, research, plans) | @chriskaschner | No |

## Forbidden at Root

- No runtime source files at repo root (move to the appropriate directory above)
- No plaintext credential files, even if gitignored (use `~/.config/` or a secret manager)
- No generated build artifacts, coverage reports, or render outputs
- No duplicate implementations of the same surface (one canonical source per display target)

## Generated Artifact Rules

Generated files must NOT be committed unless they are:
1. Static assets required at deploy time by GitHub Pages (e.g., `docs/stores.json`, `docs/flavors.json`)
2. Seeded metrics modules regenerated on a documented cadence (`worker/src/trivia-metrics-seed.js`)

Everything else (coverage, sprites, audit HTML, local DB files, backfill checkpoints) lives in gitignored paths.

## docs/ Boundary

`docs/` is the GitHub Pages web app root. Only these file types belong there:

- HTML pages (public-facing)
- JavaScript modules loaded by those pages
- CSS stylesheets
- Static data files required at page load (`stores.json`, `flavors.json`)
- OG/favicon images (`og-*.png`, `favicon.svg`, `icon-*.svg`)
- Manifest and service worker (`manifest.json`, `sw.js`)
- Vendor libraries (`docs/vendor/`)

Engineering docs, audit HTML, sprite grids, planning documents, and generated asset variants
do NOT belong in `docs/`. Place them in `archive/`, `tools/`, or gitignore them.

Exception: `docs/flavor-audit.html` and `docs/multi.html` are development QA tools served by
GitHub Pages for convenience. Pending migration decision -- they are not public product pages.

## Naming Conventions

- Worker source: `worker/src/*.js`
- Worker tests: `worker/test/*.test.js` (unit), `worker/test/browser/*.spec.mjs` (Playwright)
- Python library: `src/*.py`
- Python tests: `tests/*.py` (integration), `scripts/tests/*.py` (script-level)
- Analytics: `analytics/*.py`, `analytics/tests/*.py`
- Tool scripts: `tools/*.mjs` or `tools/*.py`
- Archive: `archive/<surface-name>/` (one directory per archived surface)

## archive/ Revival Criteria

Code in `archive/` is inactive. To promote to first-class:
1. Add CI/deploy coverage (it must be tested and deployed automatically)
2. Add an owner entry in this file
3. Write a brief rationale in `archive/<name>/README.md`
4. Open a PR updating this contract

Current archive contents:
- `archive/alexa/` -- Alexa skill (flavor-of-the-day voice query). No active CI or deployment.
  Revival requires: ASK CLI toolchain, AWS Lambda deploy, and integration tests.
- `archive/tidbyt-community-pr/` -- Snapshot of the community Tidbyt PR (direct Culver's API).
  Canonical internal renderer is `tidbyt/culvers_fotd.star` (pure renderer, Worker API).
  Revival: update to Worker API + submit updated PR to tidbyt/community.

## CI Gates (target state)

| Gate | Tool | Trigger |
|---|---|---|
| Worker tests | Vitest (810 tests) | Push to main, PR |
| Worker browser tests | Playwright (32 tests) | Push to main, PR |
| Python tests | pytest (~179 tests) | Push to main, PR |
| Metrics seed freshness | Vitest | Push to main |
| Repo structure policy | `scripts/check_repo_structure.py` in `ci.yml` | Push to main, PR |
| Secret scanning | TruffleHog (`.github/workflows/security.yml`) | Push to main, PR |
