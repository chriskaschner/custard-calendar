# Worklog

## Platform Status (2026-02-23)

Comprehensive state of the entire custard telemetry stack.

### Cloudflare Worker (`worker/`)

Fully operational. 336 tests passing across 20 suites.

- 6 brand fetchers: Culver's (`__NEXT_DATA__` JSON), Kopp's, Gille's, Hefner's, Kraverz, Oscar's (HTML parsers)
- KV caching (24h TTL) + D1 snapshot persistence (13,868 snapshots, 857 stores, back to Jan 2024)
- API v1 endpoints: `/flavors`, `/today`, `/stores`, `/forecast/{slug}`, `/metrics/*`, `/flavor-colors`, `/coverage`
- `.ics` calendar feed, dynamic SVG OG social cards
- Alert emails: daily flavor match + weekly digest with forecast prose
- Rarity computation from D1 snapshots (percentile-based: Ultra Rare / Rare / Uncommon)
- Siri spoken text enriched with rarity gap info for rare flavors

### Python Pipeline (`src/`, `main.py`)

Working. Calls Worker API (no direct scraping), writes local cache, syncs Google Calendar (with Blueberry colorId), pushes to Tidbyt.

### Analytics (`analytics/`)

Working. 84 tests passing. Full ML pipeline:
- Data loader, basic metrics (frequency/recency/entropy/surprise)
- Pattern detection (DOW bias, Markov transitions, seasonality)
- Collaborative filtering (NMF store clustering)
- Prediction models (FrequencyRecency, MarkovRecency)
- Batch forecast generation + D1 upload
- Accuracy evaluation (top-1, top-5, log-loss) against D1 snapshots

### Tidbyt (`tidbyt/`)

Working. Pixel-art renderer with 29-profile flavor color system. Community app PR #3182 submitted to `tidbyt/community` (multi-brand, API v1, Typeahead store search across 1,079 stores).

### GitHub Pages (`docs/`)

6 live pages, all functional:

| Page | URL | Description |
|------|-----|-------------|
| Forecast | `index.html` | Today card with rarity badge, 7-day strip, confidence strips, mini pixel-art cones |
| Calendar | `calendar.html` | .ics subscription with Google/Apple buttons, live event preview |
| Map | `map.html` | 1,012 geocoded stores, brand chips, flavor search, distance sorting |
| Radar | `radar.html` | 7-day personalized outlook, next-best-store, rarity/streak badges, accuracy dashboard |
| Alerts | `alerts.html` | Email subscriptions, daily + weekly digest, double opt-in |
| Siri | `siri.html` | Store picker, live preview, Shortcut builder (Show Result, not Speak Text) |

### Test Coverage

| Suite | Tests | Command |
|-------|-------|---------|
| Worker (Vitest) | 336 | `cd worker && npm test` |
| Browser (Playwright) | 2 | `cd worker && npm run test:browser -- --workers=1` |
| Python (pytest) | ~142 | `uv run pytest` |
| Analytics only | 84 | `uv run pytest analytics/tests/ -v` |

### Open Work

| Item | Type | Effort | Notes |
|------|------|--------|-------|
| Alexa skill | Feature | Medium | Custom skill using `/api/v1/today`, needs Amazon dev account + certification |
| Flavor chatbot | Feature | Large | Conversational Q&A via web chat UI over `/api/v1` endpoints |
| Madison brand expansion | Feature | Research | Methodology for adding new brands outside MKE geo |
| HD cone topping density | Polish | Small | Toppings sparse and symmetrically mirrored; need denser asymmetric placement |
| OG share image | Polish | Small | Replace placeholder tilted mint cone with pixel-art custard rain |
| Google Calendar alerts | Known limitation | None | Google ignores VALARM in ICS subscriptions; no code fix possible |
| Pairwise flavor voting | Deprioritized | Large | Group "where should we go tonight?" -- shelved, no clear MVP |

### Session Commits

- `a3ebdec` feat: flavor rarity badge on Forecast page
- `2e2b150` fix: replace Speak Text with Show Result in Siri Shortcut instructions

---

## Session Update (2026-02-23) -- Accuracy Correctness, Snapshot Coverage, Backfill

### Shipped

Eight commits on `codex/kv-d1-hardening` hardening the D1 snapshot pipeline:

1. **Accuracy correctness** -- `evaluate_store_forecasts()` now rejects future dates (was only lower-bounded, so forecasts matched themselves). Adds `n_forecasted` and `n_orphaned` counters. `evaluate_forecasts.py` SQL uses proper date bounds instead of row LIMIT. 4 new Python tests + 1 script test.

2. **Snapshot upsert** -- `INSERT OR IGNORE` made wrong first-writes permanent. Changed to `ON CONFLICT DO UPDATE` with 7-day recency guard so fresh fetches correct stale data while older rows stay immutable.

3. **Cron snapshot harvest** -- Coverage was subscription-only and cache-hit-blind. The cron now resolves `forecast UNION subscription` slugs, skips already-fetched stores, and processes batches of 50 per run with a D1-persisted cursor (`cron_state` table, migration 005). `getFlavorsCached` gains `recordOnHit` option. 8 new Worker tests.

4. **KV 429 resilience** -- Dedup key, run metadata, and flavor catalog KV writes wrapped in try/catch. 3 new Worker tests.

5. **Trending date guard** -- `handleTrending()` this_week query now uses `date <= today`. 1 new Worker test.

6. **Backfill script** -- `scripts/backfill_snapshots.py` reads from `data/backfill/flavors.sqlite` (38K+ rows), normalizes flavors matching `flavor-matcher.js`, derives brand from slug patterns, and uploads in batches of 200 with `ON CONFLICT DO NOTHING`.

7. **Coverage gate** -- `scripts/check_forecast_coverage.py` verifies each forecast slug has at least one snapshot from today/yesterday with `fetched_at` within 48h. Exits non-zero on gaps.

### Validation

- `uv run pytest analytics/tests/test_accuracy.py scripts/tests/ -v` -- 16 passed
- `cd worker && npm test` -- 308 passed (19 suites, up from 296/17)

### Follow-up Ops

1. Apply D1 migration `005_cron_state.sql` in production.
2. Deploy Worker.
3. Run `uv run python scripts/backfill_snapshots.py --store mt-horeb` to seed D1 from SQLite.
4. Run `uv run python scripts/check_forecast_coverage.py` to verify coverage.
5. Run `uv run python scripts/evaluate_forecasts.py --store mt-horeb` to verify accuracy with real data.

---

## Session Update (2026-02-23) -- Accuracy + Email + Calendar Color

### Shipped

Three features on `codex/kv-d1-hardening` building on D1-primary infrastructure:

1. **Google Calendar event color** -- events now use colorId `"9"` (Blueberry, closest to Culver's #005696). Threaded from `config.yaml` -> `main.py` -> `sync_from_cache` -> `sync_calendar` -> `create_or_update_event`. 6 Python tests.

2. **Forecast accuracy tracking** -- compare ML predictions against actual D1 snapshots.
   - `analytics/accuracy.py`: pure-function evaluation (top-1, top-5, log-loss) against forecast JSON + actual snapshots.
   - `scripts/evaluate_forecasts.py`: CLI to query D1 forecasts + snapshots, compute metrics, optionally upload to `accuracy_metrics` table.
   - `worker/src/migrations/004_accuracy.sql`: `accuracy_metrics` table (slug, window, hit rates, log loss, sample count).
   - Worker endpoints: `GET /api/metrics/accuracy` (all stores, grouped) and `GET /api/metrics/accuracy/{slug}` (per-store).
   - 11 Python tests + 4 Worker tests.

3. **Forecast weekly email pipeline** -- the Worker email code was already built. Added `scripts/refresh_forecasts.sh` convenience script to generate + upload forecasts in one command.

### Validation

- `uv run pytest tests/test_calendar_sync.py` -- 6 passed
- `uv run pytest analytics/tests/test_accuracy.py` -- 11 passed
- `cd worker && npm test` -- 296 passed (17 suites)

### Follow-up Ops

1. Apply D1 migration `004_accuracy.sql` in production.
2. Deploy Worker.
3. Run `./scripts/refresh_forecasts.sh --store mt-horeb` to seed forecasts.
4. Run `uv run python scripts/evaluate_forecasts.py --store mt-horeb --upload` to compute + upload accuracy.
5. Verify: `curl https://custard.chriskaschner.com/api/v1/metrics/accuracy/mt-horeb`

---

## Session Update (2026-02-23)

### Shipped In This Session

- KV write budget hardening in Worker runtime:
  - removed KV fetch-counter writes from flavor-cache miss path
  - wrapped flavor and locator cache `kv.put()` calls in best-effort error handling (429-safe)
  - added slug-scoped cache integrity metadata + mismatch rejection for poisoned entries
- Snapshot persistence migrated to D1-only write path:
  - removed KV `snap:*` writes from `snapshot-writer.js`
  - social card flavor lookup now reads snapshot rows from D1 (no KV snapshot dependency)
- Forecast data path moved to D1-primary reads:
  - `forecast.js` now resolves forecasts from D1 first, KV fallback second
  - weekly digest forecast enrichment now uses same D1/KV resolution path
  - added D1 migration `worker/src/migrations/003_forecasts.sql`
  - updated `scripts/upload_forecasts.py` to batch upserts into D1 forecasts table via Wrangler
- Domain configuration updated:
  - `worker/wrangler.toml` `WORKER_BASE_URL` set to `https://custard.chriskaschner.com` (primary)
  - workers.dev remains compatible as runtime fallback endpoint where needed
- Test harness cleanup:
  - `worker/vitest.config.js` now excludes Playwright browser specs so `cd worker && npm test` is reliable
  - refreshed tests for snapshot writer, social card, forecast endpoint, and integration cache hardening cases

### Validation Status

- `cd worker && npm test` passes (291 tests).
- `cd worker && npx vitest run test/*.test.js` passes (291 tests).
- `cd worker && npm run test:browser -- --workers=1` passes (2 Playwright browser tests).

### Follow-up Ops Checklist

1. Apply D1 migration in production (`003_forecasts.sql`).
2. Deploy Worker.
3. Run `uv run python scripts/upload_forecasts.py` to seed D1 forecasts.
4. Verify production endpoints:
   - `/api/v1/flavors?slug=mt-horeb`
   - `/api/v1/flavors?slug=madison-wi-mineral-point-rd`
   - `/api/v1/forecast/mt-horeb`
   - `/v1/og/{slug}/{date}.svg`
5. Monitor Cloudflare KV write usage for 24h (target: well below 1,000/day).

## Session Update (2026-02-22)

### Shipped In This Session

- Phase 1 forecast homepage UX shipped to `main` (`939a026`):
  - `docs/index.html` rewritten as forecast dashboard
  - `docs/calendar.html` created from legacy homepage flow
  - unified 6-link nav across all docs pages
  - `docs/manifest.json` + `docs/sw.js` updated for forecast branding and cache coverage
- Browser smoke testing added and wired into standard test flow:
  - Playwright config in `worker/playwright.config.mjs`
  - nav smoke test in `worker/test/browser/nav-clickthrough.spec.mjs`
  - pytest wrapper in `tests/test_browser_clickthrough.py`
- Radar Phase 2 implemented in `docs/radar.html`:
  - Next Best Store recommendations (cross-store comparison + distance radius)
  - rarity/streak/overdue badges on forecast rows
  - Forecast Accuracy Dashboard (proxy hit-rate, coverage, confidence mix, history depth)
- Radar Phase 2 browser test added in `worker/test/browser/radar-phase2.spec.mjs`.

### Validation Status

- `cd worker && npm run test:browser -- --workers=1` passes (nav + Radar Phase 2 browser tests).
- `.venv/bin/pytest tests/ -v` passes (25 tests, includes browser suite wrapper).

### Next Session Start Point

1. TODO #3: Forecast accuracy tracking (prediction vs actual for WI stores; hit-rate metrics and retraining loop).
2. TODO #2: Alexa skill integration after accuracy tracking baseline is in place.
3. Keep TODO #1 as done; no remaining Phase 2 UI blockers.

## Analytics Pipeline (2026-02-22)

### What Was Built

Full Python analytics layer on the 38,842-row backfill dataset (`data/backfill/flavors.sqlite`): 154 WI stores, 42 unique flavors, Jan 2024 – Mar 2026.

**Files created** (all in `analytics/`, branch `analytics-pipeline`):

| File | Purpose |
|------|---------|
| `__init__.py` | Package init |
| `data_loader.py` | SQLite → DataFrame, filters 2 closed-day sentinels, adds dow/month/year |
| `basic_metrics.py` | Frequency, recency, Shannon entropy, Pielou's evenness, surprise scoring, store summary |
| `patterns.py` | Day-of-week chi-squared, recurrence intervals, seasonal heatmap, seasonal flavor detection |
| `markov.py` | Transition matrices P(tomorrow \| today), top transitions, self-transition rates |
| `collaborative.py` | Store×flavor matrix, NMF decomposition (6 factors), K-Means clustering, geographic mapping |
| `predict.py` | FrequencyRecencyModel, MarkovRecencyModel, XGBoostFlavorModel |
| `evaluate.py` | Time-based train/test split (pre-2026/2026+), top-k accuracy, log loss, NDCG |
| `embeddings.py` | SEED_CATALOG (32 flavors), SIMILARITY_GROUPS, TF-IDF/sentence-transformer embeddings |
| `forecast_writer.py` | Weather-style prose generation, batch JSON export, Claude API integration (optional) |
| `batch_forecast.py` | CLI: `uv run python -m analytics.batch_forecast --store mt-horeb` |
| `review.ipynb` | Jupyter notebook covering all phases with charts |
| `tests/test_basic_metrics.py` | 24 tests |
| `tests/test_patterns.py` | 21 tests |
| `tests/test_collaborative.py` | 13 tests |
| `tests/test_predict.py` | 12 tests |
| `tests/test_embeddings.py` | 9 tests |

**79 tests total**, all passing.

### Key Data Findings

- **42 unique flavors** across 154 WI stores (after filtering 2 closed-day sentinels)
- **~43-day recurrence cycle** for popular flavors at a given store
- **Day-of-week bias** is real for some flavors (chi-squared p < 0.05)
- **Seasonal patterns**: How Now Brown Cow = May only (103 appearances, all in May 2024 + May 2025), berry/fruit flavors skew summer, Pumpkin Pecan skews fall
- **Store clusters** (NMF + K-Means) correlate with geography — regional scheduling calendars likely exist
- **Diversity varies dramatically**: Pielou's evenness ranges from ~0.6 (favorites-heavy) to ~0.95 (even rotation)
- **Markov insight**: Self-transition rate is very low (~2-5%) — stores almost never serve the same flavor two days in a row

### Prediction Model Performance

| Model | Top-1 Accuracy | Top-5 Recall | Notes |
|-------|---------------|-------------|-------|
| Random baseline | 2.4% | 12% | 1/42 flavors |
| FrequencyRecencyModel | ~5-8% | ~20-25% | Best simple model. freq=0.7, recency=0.3 |
| MarkovRecencyModel | ~4-6% | ~15-20% | Transition matrix + recency |

**Key design decision**: Recency uses "overdue ratio" (days_since / expected_interval, clipped to 3.0) not raw days-since. Raw days amplified rare flavors. Fill value = 0.0 for never-served flavors.

**Framing**: Top-5 recall is the useful metric. The actual flavor lands in the top 5 predictions ~20-25% of the time (2x random). Probability calibration matters more than exact prediction.

### Bugs Fixed Along the Way

1. **`cluster_geo_summary` KeyError**: Merge column name mismatch (`store_slug` vs `index` vs `slug`). Fixed with dynamic detection.
2. **Prediction worse than random**: `fill_value=1.0` gave never-served flavors maximum score. Changed to 0.0.
3. **Recency degrading accuracy**: Raw days-since amplified rare flavors. Switched to overdue ratio.
4. **`overdue_flavors` empty DataFrame KeyError**: `pd.DataFrame([])` has no columns. Added explicit column guard.
5. **Files lost after squash merge**: Analytics files were never committed on `flavor-backfill`. Recreated from context.

---

## Product Strategy (2026-02-22)

### The Framing

This is a **decision product**, not a prediction product. The question isn't "what's the probability of Turtle tomorrow?" — it's **"Where and when should I go for the flavor I care about?"** Predictions are intermediate. The end product is an action: Go today, Remind me, See nearby alternatives.

Three user jobs to solve:
1. "Tell me if my favorite is likely soon."
2. "Tell me where nearby I can get it first."
3. "Tell me when this is a rare opportunity."

### Product Philosophy / Guardrails

- **Never present low-confidence predictions as facts.** Always show confidence bucket + reason string.
- **Always provide a fallback card.** "No strong prediction today — here's what we know."
- **Measure actionability, not views.** Success = recommendation acceptance rate, return visits after acting, not page renders.
- **Decision UX, not dashboard UX.** Every card has one clear CTA. Recommendations rank-ordered with one best option.
- **Prediction failures are product inputs.** Log misses, auto-lower confidence for drifting stores, surface "forecast changed" transparency to users.

### Priority Stack Rank

Reordered from original analysis after exec review. Trust infrastructure comes before features.

| Priority | Initiative | User Value | Effort | Risk | Status |
|----------|-----------|-----------|--------|------|--------|
| **Now** | Confidence-aware UI + reason strings | High | Low | Low | TODO — trust layer. Confidence buckets (high/med/low), "why this prediction" tooltips, fallback cards. Must exist before any prediction surfaces in UI. |
| **Now** | Flavor Radar | High | Medium | Medium | TODO — user picks top 3 flavors, sees "likely in next 7 days" with confidence across their stores. Flavor-first, not store-first. |
| **Now** | Next Best Store | High | Medium | Medium | TODO — if favorite not likely at primary store, show nearest store with higher probability. Cross-store recommendation. Leverages collaborative filtering + geolocation. |
| **Now** | Rarity + Streak badges | Medium | Low | Low | TODO — "First appearance in 45 days", "3rd time this month", "Seasonal peak". Combines surprise score with temporal pattern badges. |
| **Next** | Weekly Custard Planner | High | Medium | Medium | TODO — 7-day personalized schedule across selected stores. Interactive (not push), cross-store. Export to calendar. |
| **Next** | "Worth the Trip" score | Medium | Medium | Medium | TODO — composite: `utility = preference_match * p_next_7d * confidence * rarity`. Single decision metric. |
| **Next** | Forecast-powered weekly email | High | Low | Low | TODO — half-built. Merge forecast data into `sendWeeklyDigestEmail()`. Weather-style prose. |
| **Later** | Taste Profile Mode | High | High | High | TODO — infer preference vector from interactions (chocolate-heavy, fruity, nutty). Rank upcoming flavors by preference score. |
| **Later** | Full personalization model | High | High | High | TODO — requires user signal data accumulation before this is viable. |
| **Backlog** | Per-flavor SEO pages | High | Medium | Low | `/flavor/{name}` — each flavor = landing page. Where served today, frequency, seasonal pattern, overdue stores, similar flavors. |
| **Backlog** | Public analytics dashboard | Medium | Medium | Low | Portfolio piece. Seasonal heatmaps, store diversity leaderboard. Internal forecast quality dashboard is higher priority. |
| **Deprioritized** | Pairwise flavor voting | Low | High | High | Multiplayer coordination problem, no clear MVP. |

### Data Strategy

#### Feature Contract (per store/day/flavor)

Every prediction payload should include:
- `p_tomorrow` — probability for tomorrow
- `p_next_7d` — probability within next 7 days
- `confidence` — high / medium / low bucket
- `confidence_reason` — "strong history" / "sparse data" / "seasonal shift" / "new store"
- `rarity_score` — surprise bits
- `seasonality_score` — how seasonal this flavor is (0=year-round, 1=single-month)
- `history_depth` — how many observations back the prediction

Current `batch_forecast.py` outputs only top-N probabilities. Needs enrichment to match this contract.

#### User Signal Contract

Capture over time to improve models:
- Favorites (explicit)
- Skipped suggestions (implicit — shown but not acted on)
- Accepted alternatives (clicked "Next Best Store")
- Interaction timestamps (recency of engagement)
- Thumbs up/down on recommendations (explicit quality signal)

None of this exists yet. Start with favorites (already in alert subscriptions) and build from there.

#### Ranking Formula v1

```
utility = preference_match * p_next_7d * confidence * rarity_bonus
```

Where:
- `preference_match` = 1.0 if in favorites, 0.5 if in same similarity group, 0.2 baseline
- `p_next_7d` = model probability
- `confidence` = 1.0 / 0.7 / 0.4 by bucket
- `rarity_bonus` = 1.0 + 0.2 * min(rarity_score / 5.0, 1.0) — slight boost for rare flavors

### Key Product Decisions

1. **Trust infrastructure before features.** Confidence labels, reason strings, and fallback cards ship before any prediction surfaces in the UI. Wrong predictions without context destroy trust faster than no predictions at all.
2. **Don't ship XGBoost to production.** FrequencyRecency is simpler, nearly as accurate, runs in ms. Keep XGBoost in the notebook for portfolio.
3. **Per-flavor pages are the SEO engine** but are backlog, not now. Core decision UX (Radar, Next Best Store) is higher leverage.
4. **Start capturing user signals immediately.** Favorites already exist in alert subscriptions. Add lightweight interaction logging so preference models have data when we're ready to build them.
5. **Internal forecast quality dashboard before public analytics dashboard.** Track calibration by brand/store (Brier score, top-k hit rate trend). Auto-downgrade confidence for drifting stores.
6. **Brand-specific model tuning.** MKE brands (Kopp's, Gille's, etc.) have different cadence patterns than Culver's. Don't assume one model fits all.

### Feature Detail: Confidence-Aware UI (Now)

Every prediction surface must include:
- **Confidence bucket**: High / Medium / Low — mapped from model certainty + history depth
- **Reason string**: Compact explanation — "Based on 18 months of data" / "Limited history (2 months)" / "Seasonal pattern detected" / "New store, using regional average"
- **Fallback card**: When confidence is too low or data is stale — "No strong prediction today. Here's what's popular at similar stores."
- **Freshness indicator**: "Forecast updated 2h ago" / "Last updated yesterday" with degraded-mode UX when stale

Must define freshness SLOs: prediction age < 24h, API response < 500ms, degraded-mode copy when either is violated.

### Feature Detail: Flavor Radar (Now)

User picks up to 3 favorite flavors. System shows 7-day outlook:

> **Your Flavor Radar — Week of Feb 23**
>
> **Turtle** — High confidence at Mt. Horeb on Wed (12%). Also likely at Madison Todd Dr on Thu.
> **Mint Cookie** — Low confidence this week. Last served 22 days ago (avg gap: 35 days). Getting closer.
> **Caramel Cashew** — Likely tomorrow at Mt. Horeb (9%). *Worth the trip?*

Key metric: % sessions with at least one actionable hit.

### Feature Detail: Next Best Store (Now)

When a user's primary store doesn't have their favorite likely soon:

> **Turtle not in the forecast for Mt. Horeb this week.**
> But there's a **strong chance at Madison (Todd Drive)** on Thursday — 14 miles away.
> [See on map] [Set reminder]

Cross-store recommendation uses: collaborative filtering (which stores rotate similarly), per-store predictions, and haversine distance. Key metric: % sessions where alternative shown AND % return rate after alternative shown.

### Feature Detail: Rarity + Streak Badges (Now)

Two distinct badge types:

**Rarity** (from surprise score):
| Score | Label |
|-------|-------|
| < 2.0 bits | Common |
| 2.0–3.5 | Uncommon |
| 3.5–5.0 | Rare |
| > 5.0 | Ultra Rare |

**Streaks** (from temporal patterns):
- "First appearance in 45 days" — overdue return
- "3rd time this month" — hot streak
- "Seasonal peak — only available May-June" — urgency window
- "New flavor!" — first time at this store

Display in emails, map popups, and radar. Key metric: lift in dwell time and weekly active users.

### Feature Detail: Weekly Custard Planner (Next)

7-day personalized schedule across user's selected stores (primary + backups). Interactive, not just a push email.

> **Your Week — Feb 23–Mar 1**
>
> | Day | Mt. Horeb | Madison (Todd Dr) | Your Pick |
> |-----|-----------|-------------------|-----------|
> | Mon | Caramel Cashew | Turtle | **Turtle** @ Madison |
> | Tue | ??? (Low confidence) | Mint Cookie (Med) | Mint Cookie @ Madison |
> | Wed | Turtle (High) | ??? | **Turtle** @ Mt. Horeb |
> | ... | | | |
>
> [Export to Calendar] [Share with household]

Key metric: planner saves, recurring weekly opens.

### Onboarding Flow

First-run experience should ask:
1. Favorite flavors (up to 3)
2. Max drive radius (5 / 10 / 25 miles)
3. Preferred stores (primary + backups)

Then immediately show one actionable recommendation. Don't make them wait for a weekly email. The alert subscription flow already captures store + favorites — extend it.

### Notification Strategy

Two distinct alert types (beyond current daily/weekly):
- **"Favorite likely tomorrow"** — high-confidence prediction for a favorited flavor
- **"Rare flavor nearby"** — unusual flavor spotted at a nearby store (even if not favorited — discovery moment)

Must include: quiet hours, digest mode option, and "stop suggesting this flavor" to prevent fatigue. Current alert system has daily/weekly toggle — extend with these new trigger types.

### Multi-Brand Differentiation

MKE brands (Kopp's, Gille's, Hefner's, Kraverz, Oscar's) have different cadence patterns than Culver's:
- Culver's: single flavor per day, ~42 flavor pool, ~43-day rotation
- MKE brands: may have multiple daily flavors, different pool sizes, different rotation patterns

Need brand-specific model tuning and confidence calibration. Brand-aware copy and flavor taxonomy normalization in the prediction layer.

### Social / Household Use Cases

- Shared favorites for households ("Your household's flavors this week")
- "Someone in your group will like this today" — cross-preference recommendations
- Requires lightweight account/group concept — possibly just a shared link with combined favorites

### Experimentation Framework

For ranking weights, card formats, and notification timing:
- Predefine success metrics per experiment (retention, recommendation acceptance rate)
- A/B testing infrastructure needed before Taste Profile and full personalization
- Start simple: test ranking formula weight variations on the "Worth the Trip" score

### Forecast Quality Governance (Internal)

- Continuous calibration tracking by store and brand
- Automatic confidence downgrades when model drifts for a store
- Internal dashboard: Brier score, top-k hit rate trend, prediction age distribution
- Build this before the public analytics dashboard

### Data Moat Strategy

- Capture explicit thumbs up/down on recommendations
- Use interaction data to improve preference models faster than any competitor could replicate
- The backfill dataset (38K+ observations) is already a moat — nobody else has historical flavor rotation data

### Partnership / Distribution Readiness

- Lightweight API/feed for affiliates, local discovery apps, or loyalty programs
- UTM/referral hooks if distribution expands
- Current API is already clean enough (`/api/v1/`) — add rate limiting tiers if external consumers appear

### Privacy / Compliance

- Clear location and preference data policy needed before capturing user signals
- Data retention windows (how long do we keep interaction logs?)
- Deletion controls (GDPR-style "forget me" even if not legally required — good practice)
- Current alert system already has one-click unsubscribe and token-gated access — extend this posture

### 90-Day Execution Plan

**Days 1–21: Trust + Radar**
- Ship confidence labels, reason strings, fallback cards
- Ship Flavor Radar v1 (favorites + 7-day outlook)
- Add instrumentation for recommendation acceptance and return behavior
- Enrich forecast payload to match feature contract

**Days 22–45: Cross-Store + Badges**
- Ship Next Best Store recommendations
- Ship rarity + streak badges in emails and map
- Add internal forecast quality dashboard (Brier score, calibration by store)

**Days 46–75: Planner + Signals**
- Ship Weekly Custard Planner with calendar export
- Start preference scoring from implicit behavior (clicked vs skipped)
- Forecast-powered weekly email (simpler lift, builds on planner data)

**Days 76–90: Evaluate + Decide**
- Run A/B on ranking formula weight variations
- Evaluate retention lift from prediction features
- Decide whether to invest in full personalization model based on data

---

## Completed Items (Historical)

### Infrastructure
- [x] Daily snapshot persistence — append-only triple-write in KV
- [x] D1 snapshots + metrics — dual-write KV+D1, metrics endpoints
- [x] API v1 versioning + Bearer auth
- [x] Per-slug fetch budget (3/day) + global circuit breaker (200/day)
- [x] DTSTAMP determinism in ICS
- [x] Kill dual scrapers — Python calls Worker API
- [x] Multi-brand config in config.yaml
- [x] Geocode all 1,012 stores with lat/lng

### Product
- [x] Flavor alert email subscriptions — double opt-in, Resend, cron, security
- [x] Weekly digest emails with star badges and frequency toggle
- [x] Fun rotating quips in alert emails
- [x] Voice assistant integration (Siri) — `/api/v1/today` with `spoken` field
- [x] Social OG cards — dynamic SVG at `/v1/og/{slug}/{date}.svg`
- [x] OG meta tags on all 3 HTML pages
- [x] README with SaaS positioning
- [x] Flavor intelligence analytics pipeline (79 Python tests)

### Map & UI
- [x] Unified distance-sorted store results
- [x] Brand flavor matching on map
- [x] Brand chip filter UI
- [x] Custom flavor autocomplete dropdown
- [x] Map pan/zoom dynamic search with reverse geocoding
- [x] MKE custard hipster easter egg quips
- [x] Strip "culvers" from non-brand-specific code
- [x] custard.chriskaschner.com subdomain + HTTPS

### Tidbyt
- [x] Brand-agnostic theming
- [x] Community app submission
