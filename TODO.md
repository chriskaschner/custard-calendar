# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Product Direction (2026-02-25)

Core value: **confirmed flavor data, discovery, and notifications.** The weather metaphor is the presentation layer (flavor fronts, forecast, outlook) but the data underneath is real confirmed schedules, not predictions. ML predictions stay in the background as a "maybe coming soon" accent -- not the headline.

Analytics data has two strong non-prediction uses: **(1) flavor rarity as shareable content** -- "this flavor appears 3.7% of the time" is interesting trivia grounded in real observation, good for social posts, email digests, and flavor cards; **(2) quiz-to-location matching** -- a personality quiz maps you to a flavor archetype, then confirmed schedule data answers "is your flavor scooping near you today?" The quiz is the fun hook; the confirmed schedule is the utility.

## KPIs and Guardrails

**Primary KPIs:** session-to-action rate, recommendation acceptance rate, share of Confirmed recommendations, freshness SLA, reliability calibration.

**Secondary KPIs:** flavor-signal engagement, quiz-to-action conversion.

**Guardrails:** preflight before each agent task, isolate work by worktree+branch, maintain one shipping lane + one delight lane.

## Now -- Historical Metrics Activation Strategy

Revisit the expanded historical corpus (330,490 clean rows across 998 stores, 2015-08-02 to 2026-03-31) and systematically use it across product surfaces.

- [x] **Canonical metrics contract + refresh cadence** -- `scripts/generate_intelligence_metrics.py` now emits the canonical seed module (`worker/src/trivia-metrics-seed.js`) and Worker tests enforce seed contract/version plus freshness (<=45 days). README now documents weekly/pre-release refresh cadence. (2026-02-24)
- [x] **Worker metrics API surface** -- added `GET /api/v1/metrics/intelligence` (versioned and cacheable) exposing dataset summary, coverage counts/state coverage, top flavors, top stores, seasonal spotlights, and HNBC month/year snapshots from the generated metrics seed. (2026-02-24)
- [x] **Planner ranking enrichment** -- planner now derives bounded historical tie-breakers (max +0.35 input into rarity channel, +0.07 effective score cap) from metrics seed lookups: store observation depth, flavor store_count rarity, and peak-month seasonal concentration. Certainty/distance remain dominant. (2026-02-24)
- [x] **Forecast/Radar/Map context modules (frequency rank + in-season month)** -- global_rank + peak_month from `/api/v1/metrics/context/flavor/{name}` now surface on Radar day cards (rarity badge + cadence copy) and Map popups (rarity chip + peak month). (2026-02-25)
- [ ] **Store specialty flavor** -- per-store "what flavor appears here disproportionately vs. national average?" Currently the context endpoint is flavor-level only. Requires a new query: for a given slug, rank flavors by (store_frequency / national_frequency). Surface in Map popup and Radar next-best-store card.
- [ ] **Alerts + weekly digest intelligence blocks** -- include one high-signal historical callout per send (seasonal spotlight, rare-find cadence, or state leaderboard delta) with evidence counts and source window.
- [ ] **Quiz + social expansion** -- extend trivia beyond multiple-choice into ranking/fill-in formats backed by metrics seed; feed the same facts into OG trivia cards for shareability.
- [ ] **Measurement plan** -- instrument and review uplift from metrics-informed surfaces (quiz completion, CTA clickthrough, social share rate, email open-to-click), with before/after baselines and rollback thresholds.

## Now -- Planner Core

Build one shared recommendation engine used by Forecast/Map/Radar/Fronts/Quiz: "Where should I go, within my radius and time window, for flavors I care about?"

- [x] **Shared planner engine** -- `worker/src/planner.js`: haversine distance, certainty-weighted scoring (40% certainty, 30% distance, 20% rarity, 10% preference), `/api/v1/plan` endpoint. 32 tests. (2026-02-26)
- [x] **Certainty tiers** -- `worker/src/certainty.js`: Confirmed/Watch/Estimated/None with score caps (1.0/0.7/0.5/0). 21 tests. (2026-02-26)
- [x] **Consistent action CTAs** -- `CustardPlanner.actionCTAsHTML()` shared renderer for Directions/Set Alert/Subscribe. Wired into index.html today card. Confirmed recs show all three; estimated omit Directions. (2026-02-26)

## Now -- Weather Brand Reframe

Keep weather-style branding (Forecast, Radar, Fronts) while clarifying product truth: mostly deterministic schedule planning.

- [x] **Certainty state on every recommendation** -- all surfaces (index, radar, planner-shared) use certainty tiers (Confirmed/Watch/Estimated) instead of probability-based confidence buckets. Prediction bars show "Estimated" label, not raw percentages. (2026-02-26)
- [x] **Reframe forecast email confidence wording** -- replaced "Strong/Moderate chance (X%)" with "Estimated outlook" prose, dropped raw percentages from email predictions, added "Based on historical patterns" disclaimer. certainty_tier replaces confidence buckets. (2026-02-26)

## Now/Next -- Reliability Intelligence Layer (Watch)

Per-store Calendar Reliability Index from day-over-day confirmed schedule behavior.

- [x] **Compute reliability index** -- `worker/src/reliability.js`: freshness lag, missing-window rate, recovery time. Persists to D1 `store_reliability`. 26 tests. (2026-02-26)
- [x] **Use reliability in ranking** -- planner engine feeds `reliability_tier` into certainty determination; Watch-tier results cap at 0.7 score. (2026-02-26)
- [x] **Surface reliability status** -- Watch banner on index + radar pages via `CustardPlanner.fetchReliability()` + `watchBannerHTML()`. Amber badge with reason text when store has watch/unreliable tier. (2026-02-26)

## Next -- Gap-Fill Strategy (Estimated)

Use probabilistic fill only when schedule data is missing, incomplete, or beyond known horizon.

- [x] **Explicit trigger rules** -- `worker/src/certainty.js`: MIN_PROBABILITY (0.02, ~3x random), MIN_HISTORY_DEPTH (14 days), MAX_FORECAST_AGE_HOURS (168). Below thresholds = NONE, not misleading Estimated. Planner passes `history_depth` + `forecastAgeHours`. (2026-02-27)
- [x] **Test coverage** -- 26 certainty tests + 34 planner tests cover all threshold boundaries, staleness, and quality filtering. 452 total tests. (2026-02-27)
- [x] **UX separation** -- Estimated labeled everywhere (badges, prediction bars, accent bars). Gray accent bar (#bdbdbd) vs brand-colored for Confirmed. 0.85 opacity, dashed borders, no Directions CTA, no description for Estimated cards. Ranked below Confirmed/Watch by certainty score weights (1.0/0.7/0.5). (2026-02-27)

## Next -- Personality Mad Lib -> Nearby Match

Quiz/Mad Lib maps personality/archetype to flavor preferences, then calls planner engine with location/radius.

- [x] **Planner integration** -- quiz results use `CustardPlanner.actionCTAsHTML()` for Directions/Alert/Calendar CTAs. Matched stores get all three CTAs; outside-radius stores get Alert/Calendar; no-match gets general alert link. (2026-02-27)
- [x] **Actionable results** -- always shows in-radius match, nearest outside radius (with distance), and alternates. Three result states: matched within radius (full CTAs), matched outside radius (nearest store shown with Alert/Calendar), no match (alert link + archetype reference). (2026-02-27)

## Next -- Quiz: Rotating Question Pool and UX Polish

Expand beyond the single "what flavor are you" quiz into a rotating pool of quiz modes with location-aware question weighting.

- [x] **Rotating question pool** -- each shipped quiz mode now has a 15-question pool (`question_count: 5`), engine samples a fresh 5-question session each run, and sampling weights toward trait profiles implied by currently-available nearby flavors. Location changes re-mix the pool. (2026-02-24)
- [x] **Multiple quiz modes** -- shipped six selectable modes loaded from separate JSON files in `engine.js`: Weather, Flavor Personality, Date Night, Flavor Trivia Challenge, Build Your Perfect Scoop, Custard Compatibility. Trivia mode is currently static-scored; data-driven trivia API integration remains tracked in the Data-Driven Trivia section below. (2026-02-24)
- [x] **Fallback flavor encouragement** -- when no archetype match is nearby, shows encouraging nudge pointing to nearest available flavor with Directions/Alert/Subscribe CTAs. Rotates 4 template phrases. Covers both no-match and outside-radius cases. (2026-02-28)
- [ ] **Flavor asset parity audit + canonicalization (primary)** -- run a full cross-surface review everywhere a flavor appears (Forecast, Radar, Map, Fronts, Quiz results, Widget, Tidbyt, OG/social). For each flavor, compare displayed name, description copy, and visual asset output (cone/marker/card variants); publish mismatch report, then align all surfaces to one canonical source of truth.
- [ ] **Quiz question/asset consistency pass (secondary)** -- review all quiz mode question banks for naming and flavor-reference consistency, remove contradictory or duplicate phrasing, and align question option visuals/text with the same canonical flavor asset definitions.
- [ ] **Pixel art / branding alignment** -- establish consistent art direction for all pixel sprites. Target aesthetic sits between Superbrothers: Sword & Sworcery EP (moody, minimal, atmospheric) and Dave the Diver (colorful, charming, detail-rich). Current sprites are functional but need a coherent palette and style guide. Apply across quiz icons, cone renderer, and any future illustration surfaces.
- [ ] **Cross-page visual language alignment** -- quiz.html has its own gradients, color palette (--quiz-ink, --quiz-sky, etc.), border radii, and card styles that diverge from the rest of the site. Audit all 9 pages and extract a shared design language: common CSS variables, card/panel patterns, background treatment, typography scale. Either pull quiz.html into the existing style.css conventions or promote the best of both into a unified system. Goal: every page feels like the same product.
- [ ] **Accessibility audit** -- ensure all pages meet WCAG 2.1 AA: sufficient color contrast, keyboard navigation, focus indicators, alt text on images/SVGs, ARIA labels on interactive elements, screen reader support for quiz options and result cards. Quiz option icons already use aria-hidden; verify labels are accessible. Test with VoiceOver/NVDA.
- [x] **Weather quiz not defaulting** -- verified config path order is correct (weather-v1 first). Browser test updated to assert weather-v1 as default. Was likely browser cache on first report. (2026-02-28)
- [x] **Weather quiz icons: real artwork** -- 8 new pixel art sprites: sun, storm, sunset, night (sky patterns) + snowflake, leaf, warm-sun, flame (temperatures). 14 new weather palette entries. Icons render inside option cards at scale 4. Replaces plain color circles. (2026-02-28)

## Next -- Quiz: Data-Driven Trivia Content

Flavor and store errata powered by real D1 snapshot data. Questions generated from analytics, not hand-written. Shareable social content doubles as quiz questions.

- [x] **Metrics-pack powered trivia prompts** -- `scripts/generate_intelligence_metrics.py` now emits `worker/src/trivia-metrics-seed.js`, and `/api/v1/trivia` augments (or falls back to) this seed for top flavor frequency, top store, seasonal spotlight, HNBC month, and coverage questions when D1 windows are sparse or unavailable. (2026-02-24)
- [x] **Trivia question API** -- `GET /api/v1/trivia` now generates multiple-choice questions from D1 snapshot aggregates (state/store flavor leaders, rarity, spread, volume), includes `correct_option_id`, and is cached for 15 minutes. Route is wired through versioned API with unit + integration tests. (2026-02-24)
- [ ] **Quiz content integration** -- trivia mode now hydrates from `/api/v1/trivia` (with static fallback) and validates multiple-choice answers client-side using `correct_option_id`; ranking and fill-in-the-blank formats remain to be added.
- [ ] **Social sharing cards** -- trivia answers as shareable OG images. "Did you know? Mint Explosion was served 47 times at the Mt. Horeb store last year -- more than any other location." SVG card at `/v1/og/trivia/{question_id}.svg`.
- [ ] **State and regional leaderboards** -- "Most common FOTD in WI vs IL vs MN." Per-state flavor rankings from snapshots. Surface on quiz results and as standalone shareable content.

## Next -- Flavor Signals and Stories

Turn high-specificity seasonal/store insights into explainable content with evidence thresholds.

- [x] **Signal detection** -- `worker/src/signals.js`: 5 signal types (overdue, dow_pattern, seasonal, active_streak, rare_find). Statistically gated: chi-squared for DOW (p<0.05), 1.5x ratio for overdue, 50% concentration for seasonal. `/api/v1/signals/{slug}` endpoint. 31 tests, 483 total. (2026-02-27)
- [x] **Surface across pages** -- Signal cards on Forecast (index.html) and Radar (radar.html) via shared `CustardPlanner.fetchSignals()`. Color-coded accent bars per signal type. (2026-02-27)
- [x] **Action linkage** -- Every signal card has a CTA: overdue/seasonal -> Set Alert, dow_pattern -> Subscribe, streak/rare_find -> Directions. Built into `signalCardHTML()` in planner-shared.js. (2026-02-27)

## Next/Later -- Map/Fronts Visual v2

PCA/category overlays + improved weather-motion aesthetics, tied directly to decisions.

- [x] **Decision-driven visuals** -- Map + Fronts popups now show Confirmed badges and Directions/Alert/Calendar CTAs via `CustardPlanner.actionCTAsHTML()`. Map result cards also have CTAs. Forecast-mode and confirmed-mode popups both enhanced. (2026-02-27)
- [x] **Interaction-to-action metrics** -- D1 `interaction_events` table, `POST /api/v1/events` (sendBeacon), `GET /api/v1/events/summary`. Tracks CTA clicks (directions/alert/subscribe), signal card views (IntersectionObserver), and map/fronts popup opens. Anonymous (page_load_id + CF geo, no cookies). (2026-02-24)

## Later -- Refactor / Re-Architecture

"Are we DRY?", "Can rendering be standardized?", "If built today, what architecture wins do we capture?" Full plan in WORKLOG.md.

- [x] **DRY audit** -- Identified 7 duplication hotspots: certainty thresholds (CRITICAL fix applied), escapeHtml (11 files), similarity groups (2 implementations), flavor families, haversine (8 files), WORKER_BASE (9 hardcoded, 1 URL mismatch), brand colors. (2026-02-27)
- [x] **WORKER_BASE consolidation** -- single source of truth in planner-shared.js, replaced 9 hardcoded constants across 10 files. Fixed URL mismatch (5 pages used workers.dev instead of canonical custard.chriskaschner.com). Browser test mocks updated. (2026-02-28)
- [x] **escapeHtml consolidation** -- 7 inline definitions removed, all pages alias CustardPlanner.escapeHtml. (2026-02-28)
- [x] **haversine consolidation** -- inline definition in calendar.html removed, uses CustardPlanner.haversineMiles. (2026-02-28)
- [x] **Flavor config API** -- `GET /api/v1/flavor-config` returns similarity groups + flavor families + brand colors from single server source (`flavor-matcher.js`). `planner-shared.js` bootstraps from this endpoint with local fallback constants, eliminating manual sync drift. (2026-02-24)
- [x] **Shared decision/certainty modules** -- Fixed critical threshold divergence: planner-shared.js now matches worker/src/certainty.js (MIN_PROBABILITY=0.02, MIN_HISTORY_DEPTH=14, MAX_FORECAST_AGE_HOURS=168). Added escapeHtml export. (2026-02-27)
- [x] **Decompose index.js** -- extracted `route-today.js`, `route-calendar.js`, `route-nearby.js`, `kv-cache.js`, and `brand-registry.js`; index.js now 489 lines. Named exports (`getFetcherForSlug`, `getBrandForSlug`, `getFlavorsCached`) preserved via re-export for test compatibility. (2026-02-24)
- [ ] **Canonical render spec** -- palette + geometry + toppings with adapters per surface.
- [ ] **Greenfield target architecture** -- three-layer model: Presentation (docs), Decision (planner/certainty/signals/reliability as pure functions), Data (KV/D1 access). Incremental migration, not rewrite.
- [ ] **CLAUDE.md + Codex rules: rate limit awareness** -- add explicit rule: always assume external endpoints have rate limits, document known limits before bulk requests. Applies especially to Wayback Machine, upstream brand sites, and OSM/Nominatim. Sync rules between CLAUDE.md (this repo) and any codex task definitions.
- [ ] **CLAUDE.md / Codex consistency** -- audit CLAUDE.md and codex task instructions for drift. Ensure both reflect same commands, architecture, constraints, and conventions. Single source of truth where possible.
- [ ] **Multi-agent coordination** -- prevent agents from stepping on each other's branches or squashing work. Options to evaluate: (1) content-hash IDs on TODO items so agents can reference specific tasks unambiguously, (2) branch-per-task convention with merge-only-forward rule (no force push, no rebase onto shared branches), (3) lock file or claim mechanism in TODO.md (agent writes its name next to a task before starting), (4) worktree isolation as default for Codex tasks so each agent gets its own branch from HEAD. Document the chosen protocol in CLAUDE.md so both Claude Code and Codex sessions follow it.
- [ ] **Platform architecture review (executive)** -- five principal risks identified; address in order: (1) **Contract drift**: custard-tidbyt and custard-scriptable both implement their own flavor-name parsing, API response mapping, and store-slug resolution -- any Worker API change silently breaks them. Fix: publish a machine-readable API contract (OpenAPI or JSON schema) as part of Worker deploy; add smoke tests in each sibling repo that hit the live API and assert schema version. (2) **Duplicate client implementations**: at least 3 repos each maintain `haversine`, `flavorMatchScore`, and store-lookup logic. Fix: extract a published `@custard/client` npm package (or a single canonical JS module the Worker serves) so all clients share one implementation. (3) **CI asymmetry**: Worker has 450+ tests; GitHub Pages frontend has Playwright smoke tests only; Python pipeline has pytest but no live-API integration gate. Fix: add a nightly integration test that runs the full fetch->calendar->tidbyt pipeline against staging Worker, fails loudly if any leg breaks. (4) **Doc drift**: CLAUDE.md, README, and inline code comments are the only sources of architecture truth, and they diverge. Fix: maintain a lightweight `ARCHITECTURE.md` (data flow diagram + layer contracts) that is required to update before any PR touching cross-layer interfaces. (5) **Monolithic Worker growth**: index.js decomposition started but the Worker is the only deploy unit -- a bad route handler can silently kill the entire platform. Fix: evaluate Worker Services (route isolation) or at minimum enforce per-route unit test coverage gates in CI. Recommended direction: treat custard-calendar Worker as platform kernel; all sibling repos are consumers of its stable v1 API, not peers.

## Someday/Maybe

Not active. Only promote if they clearly improve core decision KPIs.

- [ ] **Alexa skill** -- custom skill using `/api/v1/today` (requires Amazon dev account + certification)
- [ ] **iOS Scriptable widget: multi-store mode** -- add a configurable mode that shows today's flavor for the user's top 3 selected stores (with quick per-store fallback when one store has no current data).
- [ ] **Android widget** -- parity with iOS Scriptable widget using `/api/v1` data
- [ ] **Madison-area brand expansion** -- selection methodology for adding new brands beyond MKE geo
- [ ] **Flavor chatbot** -- conversational Q&A for flavor info via web chat UI
- [ ] **Pairwise flavor voting** -- group "where should we go tonight?" (deprioritized, no clear MVP)

## Background -- Analytics as Content

The analytics pipeline's best output isn't predictions -- it's **flavor intelligence**: rarity scores, streak tracking, frequency stats, similarity clusters. All grounded in what actually happened, surfaced as shareable content and discovery tools.

- [x] **Refresh local dataset metrics snapshot** -- recomputed scale/coverage across `backfill`, `backfill-national`, and `backfill-wayback`; combined cleaned corpus now 330,490 rows across 998 stores (2015-08-02 to 2026-03-31). Added pause-point + resume command to WORKLOG. (2026-02-24)
- [ ] **Add DoW + seasonality features** -- 38 flavors show significant day-of-week bias. Add to FrequencyRecency and MarkovRecency models. Expected +5-8% top-1 accuracy.
- [ ] **Implement ensemble predictor** -- combine FR (40%), Markov (40%), PCA-collaborative (20%). Current 3.2% top-1 -> maybe 5-6%.
- [x] **Expand overdue watch-list** -- n_overdue default raised from 3 to 5 in forecast_writer.py. (2026-02-27)
- [ ] **Confidence intervals in forecast output** -- P95 uncertainty bands.
- [x] **Fix NMF convergence** -- max_iter raised from 500 to 1000 in collaborative.py. Test fixture still warns (sparse synthetic data), production should converge. n_components=5 needs accuracy evaluation. (2026-02-27)
- [ ] **Cluster-based transfer learning** -- PCA cluster centroid as prior for sparse stores.
- [ ] **Embedding-based fallback recommendations** -- "if X unavailable, try Y."
- [ ] **Cluster-personalized forecast emails** -- compare store to its PCA cluster centroid.

## Completed

<details>
<summary>Shipped features and fixes (click to expand)</summary>

### Product Features
- [x] Confirmed flavor fronts -- default "Confirmed Today" mode with family-colored markers + smooth 400ms day crossfade (2026-02-25)
- [x] Near-me-now -- auto-geolocate on first visit, 5 nearest stores with cone icon and distance (2026-02-25)
- [x] Map category chips -- 9 flavor family filters, non-matching markers fade to 15% opacity (2026-02-25)
- [x] Calendar subscription CTA -- one-click .ics copy after today card loads (2026-02-25)
- [x] Flavor intelligence API -- `/api/v1/flavor-stats/{slug}` with overdue, seasonality, DoW bias, streaks, store personality, cross-store rarity (2026-02-25)
- [x] Quiz availability rewrite -- only returns actually-available flavors via archetype + similarity group intersection (2026-02-25)
- [x] Quiz 10pm cutover -- late-night messaging when stores are closing (2026-02-25)
- [x] Full rarity spectrum -- Common (50-75th) + Staple (>75th) tiers, every flavor classified (2026-02-25)
- [x] Radar confirmed-data reframe -- confirmed days prominent (blue tint), predicted days recessive (gray, reduced opacity) (2026-02-25)
- [x] Homepage copy reframe -- "confirmed schedule" language, weather voice preserved (2026-02-25)
- [x] Voice assistant integration (Siri) -- `/api/v1/today` with spoken + spoken_verbose, setup page with store picker (2026-02-23)
- [x] Flavor Radar Phase 1+2 -- 7-day outlook, next-best-store, rarity/streak badges, accuracy dashboard (2026-02-22)
- [x] Forecast weather-map page -- flavor fronts with day slider, hotspot panel (2026-02-23)
- [x] First-visit homepage onboarding (2026-02-23)
- [x] Cross-page nav consistency -- unified nav across all docs pages (2026-02-24)
- [x] Calendar preview on Forecast page (2026-02-24)
- [x] iOS Scriptable widget -- small + medium modes, setup guide, nav link (2026-02-25)
- [x] Forecast accuracy tracking (2026-02-23)
- [x] Weekly digest emails with forecast prose (2026-02-23)
- [x] Tidbyt daily push workflow (2026-02-24)
- [x] Accuracy + snapshot hardening (2026-02-23)
- [x] Forecast pipeline reliability (2026-02-23)
- [x] Flavor rarity badge on Forecast page (2026-02-23)
- [x] PCA baseline -- beats NMF, decision: use PCA for map category overlays (2026-02-25)

### Engineering
- [x] Cone renderer extraction -- `docs/cone-renderer.js` shared module (2026-02-25)
- [x] Analytics review follow-through -- 11 findings -> 9 prioritized tasks (2026-02-25)
- [x] Fix alert dedup ordering (2026-02-23)
- [x] Keep `/health` public when auth enabled (2026-02-23)
- [x] Fail fast when email disabled (2026-02-23)
- [x] Remove duplicate Calendar lookups (2026-02-23)
- [x] Eliminate KV N+1 subscription scans (2026-02-23)
- [x] Break Worker circular dependency (2026-02-23)
- [x] Correct API error semantics (2026-02-23)
- [x] Harden D1 scripts against SQL injection (2026-02-23)
- [x] Regression tests for missing behavior (2026-02-23)
- [x] Clean documentation drift (2026-02-23)

### Bugs / Polish
- [x] Fix map subtitle -- multi-brand copy across map.html, forecast-map.html (2026-02-25)
- [x] Fix quiz 404 -- quiz.html shipped with personality engine (2026-02-25)
- [x] Fix Tidbyt workflow -- pixlet download URL updated for new asset naming (2026-02-25)
- [x] Google Calendar subscription alerts -- tip for disabling default notifications (2026-02-25)
- [x] HD cone topping density (2026-02-23)
- [x] Tidbyt cone scoop geometry (2026-02-24)
- [x] OG share image (2026-02-23)
- [x] Siri page, API URL, spoken text fixes (2026-02-23)
- [x] Google Calendar event color (2026-02-23)
- [x] Radar rarity badges + next-best-store fixes (2026-02-23)
- [x] Forecast weather graphic + pixel art system (2026-02-23)
- [x] Cross-page display consistency (2026-02-23)
- [x] Map cone markers, contrast, edge artifacts, pan/zoom stability (2026-02-23/24)
- [x] Index keyboard navigation (2026-02-24)
- [x] Siri shortcut verbose output (2026-02-24)

### Infrastructure
- [x] Flavor intelligence analytics pipeline -- 6-phase ML, 79 Python + 5 Worker tests (2026-02-22)
- [x] API v1 versioning + Bearer auth (2026-02-22)
- [x] D1 snapshots + metrics (2026-02-22)
- [x] KV write hardening (2026-02-22)
- [x] Multi-brand config, store geocoding, brand flavor matching (2026-02-21/22)
- [x] Alert email subscriptions (2026-02-21)
- [x] Social cards, OG images, README (2026-02-22)
- [x] Tidbyt community app (2026-02-22)
- [x] custard.chriskaschner.com subdomain + HTTPS (2026-02-21)
</details>
