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
- [x] **Store specialty flavor** -- `computeStoreSpecialtyFromD1()` CTE query computes (store_pct / national_pct) ratio; `GET /api/v1/metrics/context/store/{slug}` now returns `specialty_flavor: { title, ratio, store_count } | null`; Map popup injects specialty below rarity chip via `enrichPopupStoreSpecialty()`. (2026-02-25)
- [x] **Alerts + weekly digest intelligence blocks** -- `computeSignalsFromDb()` exported from signals.js; alert-checker fetches signals once per slug and passes top signal to `sendAlertEmail` (signal card block) and top 2 to `sendWeeklyDigestEmail` (This Week's Signals section). (2026-02-25)
- [x] **Quiz + social expansion** -- ranking questions ("order rarest to most common") and fill-in ("what is the top flavor?") added to `/api/v1/trivia`; OG trivia cards at `/og/trivia/{slug}.svg` for 4 slugs (top-flavor, rarest-flavor, hnbc-season, top-store); `quiz_events` table now records `page_load_id`; map popup rarity and specialty surfaces emit `popup_open` telemetry. 557 Worker tests pass. (2026-02-25)
- [x] **Measurement plan** -- `scripts/analytics_report.py` CLI pulls `/api/v1/events/summary` + `/api/v1/quiz/personality-index` with Bearer auth; prints CTA clicks, popup opens, signal views, quiz completions, match rate, trivia accuracy; `--baseline` flag appends snapshot to WORKLOG.md. 14 tests. (2026-02-25)

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
  - [x] **Phase 5 — comparison tool** -- `docs/flavor-audit.html` loads from `/api/v1/flavor-colors` + `/api/v1/flavors/catalog` and renders every flavor in a grid: mini cone, map marker, HD card, OG/social size, color swatches + profile metadata. Status badges (aligned/no-profile/profile-only). Name collision section shows 5 conflicting pairs side by side. Filter bar. Use this page to drive Phases 1–4 fixes. (2026-02-25)
  - [x] **Phase 1 — add missing profiles** -- added 10 profiles to flavor-colors.js: Blackberry Cobbler, Brownie Thunder, Chocolate Oreo Volcano, Lemon Berry Layer Cake, Lemon Dash Cookie, OREO Cheesecake, Peanut Butter Cup, Salted Caramel Pecan Pie, Strawberry Cheesecake, Vanilla. Also new base colors (lemon, blackberry) and topping colors (brownie, blueberry, pie_crust). (2026-02-25)
  - [x] **Phase 2 — resolve name collisions** -- DB-backed verdicts for all 5 pairs: Georgia Peach Pecan (fabricated, deleted), OREO Cookies and Cream (fabricated, deleted), Chocolate Oreo Volcano (real/retired 2023, historical), Salted Caramel Pecan Pie (real/retired 2025, historical), Peanut Butter Cup (same product as Really Reese's, old Culver's name through 2021, historical), OREO Cheesecake (distinct Gille's current name, kept). (2026-02-25)
  - [x] **Phase 3 — Tidbyt sync** -- synced tidbyt/culvers_fotd.star FLAVOR_PROFILES to match flavor-colors.js: added mint_andes/lemon/blackberry base colors, brownie/blueberry/pie_crust topping colors, 11 new profiles (double butter pecan + 10 from Phase 1). Updated andes mint avalanche base to mint_andes. Updated keyword fallback for lemon/blackberry. (2026-02-25)
  - [x] **Phase 4 — dynamic per-page OG cards** -- `GET /og/page/{slug}.svg` generates 1200x630 SVG cards for 9 site pages (forecast, calendar, alerts, map, quiz, radar, siri, widget, fronts); each card shows a page-specific headline/subhead and a pixel-art cone; flavor-colored accent bar; 24h cache. Updated og:image in all 9 docs pages. 5 new tests; 574 total. (2026-02-25)
- [x] **Quiz question/asset consistency pass (secondary)** -- removed deleted flavor refs (Georgia Peach Pecan, OREO Cookies and Cream) from flavor-matcher.js (FLAVOR_FAMILIES + SIMILARITY_GROUPS) and flavor-archetypes.json (Steady Classic, Explorer Jetstream archetypes); replaced with valid current flavors (Lemon Dash Cookie, Double Butter Pecan, Lemon Berry Layer Cake). 569 tests pass. (2026-02-25)
- [x] **Custard Mad Libs** -- new quiz mode `quiz-mad-libs-v1.json` with 5 multiple-choice questions that each fill a slot in a custard story template (`madlib_template` field). Options have `madlib_label` for story insertion and `traits` for archetype scoring. engine.js: `selected` now destructured from `collectAnswers`; narrative block checks `madlib_template` and builds story with `{q1}`-`{q5}` + `{flavor}` substitution, bolded with brand color. Appended to QUIZ_CONFIG_PATHS. `<strong>` in `.result-narrative` styled with `#005696`. (2026-02-25)
- [x] **Pixel art / branding alignment** -- topping slots redistributed to span full scoop height (T1-T4 rows 1-4, T1-T8 rows 0-10 HD) in both cone-renderer.js and flavor-colors.js; color corrections: dove #2B1A12, pecan #8B5A2B, caramel ribbon #D38B2C; added chocolate_custard base; profile fixes for andes mint (removed incorrect chocolate_syrup ribbon), caramel chocolate pecan (explosion density), caramel pecan (caramel base). Applied consistently across all four render functions. (2026-02-26)
- [x] **Main-page forecast image resolution review** -- topping slot geometry corrected (see pixel art alignment above); SVG crispEdges already set on all cones; scale parameters documented (standard scale 5=45x50px, HD scale 5=90x105px); OG cards use renderConeHDSVG at scale 10 (180x210px). (2026-02-26)
- [x] **Full asset quality review** -- extended flavor-audit.html: (1) Tidbyt pixel column: mini cone at scale 1 with CSS ×5 pixelated zoom shows actual device pixel art; (2) Map marker column now shows cone on both dark and light map tile backgrounds for contrast check; (3) HD scale columns updated to match documented usage (HD×5 for Radar cards, HD×8 for Hero/OG); (4) Quality flags auto-detected per row: sparse toppings (explosion/overload density but <3 toppings defined), unknown topping colors, long names >24 chars (Tidbyt abbreviation needed), pure density with unused toppings listed; (5) "Flagged" filter chip in filter bar; stat counter in header. (2026-02-26)
- [x] **Mad Libs v2: write-in answers + keyword mapping** -- new fill_in_madlib question type in engine.js: renders as free-text input, scoreTextAgainstOptions() maps user text to best-matching option via keyword arrays, accumulates that option's traits + madlib_label. Narrative fallback uses raw text when no keyword match. quiz-mad-libs-v1.json updated: all 5 questions now fill_in_madlib with placeholders and per-option keyword arrays (10-15 keywords each). Archetype recommendation unchanged. 580 Worker + 66 Python tests pass. (2026-02-26)
- [x] **Cross-page visual language alignment** -- replaced all `#003366` (old brand color) with `#005696` (canonical Culver's blue) across style.css and all 9 docs pages; fixed meta theme-color tags; added `:root` CSS variables (`--brand`, `--brand-dark`, `--text`, `--text-muted`, `--bg`, `--border`, `--radius`) to style.css as a shared token foundation. (2026-02-25)
- [x] **Accessibility audit** -- WCAG 2.1 AA fixes applied: (1) added `:focus-visible` styles to style.css for all interactive elements; (2) aria-label + aria-hidden on SVG icon geo buttons in index.html and map.html; (3) role="group" + aria-label on brand-chip and flavor-family-chip button groups in map.html; (4) role="alert" + aria-live="polite" on subscribe-status div in alerts.html; (5) aria-hidden="true" on decorative cone containers in index.html and widget.html. (2026-02-25)
- [x] **Weather quiz not defaulting** -- verified config path order is correct (weather-v1 first). Browser test updated to assert weather-v1 as default. Was likely browser cache on first report. (2026-02-28)
- [x] **Weather quiz icons: real artwork** -- 8 new pixel art sprites: sun, storm, sunset, night (sky patterns) + snowflake, leaf, warm-sun, flame (temperatures). 14 new weather palette entries. Icons render inside option cards at scale 4. Replaces plain color circles. (2026-02-28)

## Next -- Quiz: Data-Driven Trivia Content

Flavor and store errata powered by real D1 snapshot data. Questions generated from analytics, not hand-written. Shareable social content doubles as quiz questions.

- [x] **Metrics-pack powered trivia prompts** -- `scripts/generate_intelligence_metrics.py` now emits `worker/src/trivia-metrics-seed.js`, and `/api/v1/trivia` augments (or falls back to) this seed for top flavor frequency, top store, seasonal spotlight, HNBC month, and coverage questions when D1 windows are sparse or unavailable. (2026-02-24)
- [x] **Trivia question API** -- `GET /api/v1/trivia` now generates multiple-choice questions from D1 snapshot aggregates (state/store flavor leaders, rarity, spread, volume), includes `correct_option_id`, and is cached for 15 minutes. Route is wired through versioned API with unit + integration tests. (2026-02-24)
- [x] **Quiz content integration** -- trivia mode fetches live questions from `/api/v1/trivia` via `dynamic_source` in `quiz-trivia-v1.json`; `hydrateDynamicQuiz` in engine.js fetches + caches (15 min TTL); `collectAnswers` validates `correct_option_id` and shows `Trivia: X/Y correct` in result. Full D1 + metrics-seed fallback chain. (2026-02-25 verified)
- [x] **Quiz trivia: expanded formats** -- ranking and fill-in question types added to `/api/v1/trivia` via `buildRankingQuestion()` + `buildFillInQuestion()` from metrics seed. Client engine dispatches by `question.type`, scores ranking by exact order match, fill_in by normalized string match, and shows correct answers in result section. (2026-02-25)
- [x] **Social sharing cards** -- OG trivia cards at `/og/trivia/{slug}.svg` (top-flavor, rarest-flavor, hnbc-season, top-store). 1200x630 SVG with "Did you know?" header, headline, fact line, optional cone, 24h cache. (2026-02-25)
- [x] **State and regional leaderboards** -- `GET /api/v1/leaderboard/state` aggregates D1 snapshots by state via in-memory store-index join; falls back to metrics_seed national rankings; surfaces on quiz result page after submit. 9 tests. (2026-02-25)
- [x] **Intra-WI metro leaderboards** -- city-to-metro mapping (30+ WI cities) added to leaderboard.js; D1 aggregation now produces `wi_metro_leaders: { madison, milwaukee, other }` alongside state leaders; each metro bucket has the same `label + top[]` shape as state leaders. (2026-02-25)
- [x] **Geo-aware leaderboard quiz questions** -- trivia Q1 now targets user's detected state (from request.cf.region) instead of the global top-volume state. Q5 (state volume ranking) is suppressed when state is known. State codes expanded to full names in prompts. 2 new tests. 569 total. (2026-02-25)

## Next -- Flavor Signals and Stories

Turn high-specificity seasonal/store insights into explainable content with evidence thresholds.

- [x] **Signal detection** -- `worker/src/signals.js`: 5 signal types (overdue, dow_pattern, seasonal, active_streak, rare_find). Statistically gated: chi-squared for DOW (p<0.05), 1.5x ratio for overdue, 50% concentration for seasonal. `/api/v1/signals/{slug}` endpoint. 31 tests, 483 total. (2026-02-27)
- [x] **Surface across pages** -- Signal cards on Forecast (index.html) and Radar (radar.html) via shared `CustardPlanner.fetchSignals()`. Color-coded accent bars per signal type. (2026-02-27)
- [x] **Action linkage** -- Every signal card has a CTA: overdue/seasonal -> Set Alert, dow_pattern -> Subscribe, streak/rare_find -> Directions. Built into `signalCardHTML()` in planner-shared.js. (2026-02-27)
- [x] **Elevate Flavor Signals on main page** -- moved `signals-section` to immediately after `today-section` (above calendar-cta); added `hero-signal` CSS class with stronger border (2px, darker), larger headline/explanation font, wider accent bar; changed fetch limit to 1 (single highest-confidence signal); removed header label (section is self-describing via the card). (2026-02-26)

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
  - [x] **Hero cone renderer reevaluation** -- redesigned from scratch as 36×42 grid v2: fixed topping slots (same as HD cone, no scatter), 4-pixel specular highlight at upper-left dome (not a rectangle), 3-pixel occlusion shadow at lower-right edge, 9-point S-curve ribbon 2px wide (no staircase artifact at scale 8). lightenHex(0.25) highlight, darkenHex(0.12) shadow. Toppings and ribbon non-overlapping by geometry. Audit page updated to scale 4 (144×168px). 646 tests pass. (2026-02-26)
- [ ] **Greenfield target architecture** -- three-layer model: Presentation (docs), Decision (planner/certainty/signals/reliability as pure functions), Data (KV/D1 access). Incremental migration, not rewrite.
- [x] **CLAUDE.md + Codex rules: rate limit awareness** -- External Rate Limits table + explicit agent/batch rule already in CLAUDE.md. (2026-02-25)
- [x] **CLAUDE.md doc fixes** -- updated Worker test count (343 -> 574, 21 -> 32 suites), Python test counts (142 -> 179, analytics 99 -> 117), page count (5 -> 9), added analytics_report.py command. Fixed timezone bug in reliability.test.js isoDate helper. (2026-02-25)
- [x] **CLAUDE.md / Codex consistency** -- audited commands, test counts, and architecture; all updated to match current state. (2026-02-25)
- [x] **Multi-agent coordination** -- protocol documented in CLAUDE.md: worktree isolation, task claim convention, merge-only-forward rule, TODO.md as cross-session coordination channel, test gate before merge. (2026-02-25)
- [ ] **Platform architecture review (executive)** -- five principal risks identified; address in order: (1) **Contract drift**: custard-tidbyt and custard-scriptable both implement their own flavor-name parsing, API response mapping, and store-slug resolution -- any Worker API change silently breaks them. Fix: publish a machine-readable API contract (OpenAPI or JSON schema) as part of Worker deploy; add smoke tests in each sibling repo that hit the live API and assert schema version. (2) **Duplicate client implementations**: at least 3 repos each maintain `haversine`, `flavorMatchScore`, and store-lookup logic. Fix: extract a published `@custard/client` npm package (or a single canonical JS module the Worker serves) so all clients share one implementation. (3) **CI asymmetry**: Worker has 450+ tests; GitHub Pages frontend has Playwright smoke tests only; Python pipeline has pytest but no live-API integration gate. Fix: add a nightly integration test that runs the full fetch->calendar->tidbyt pipeline against staging Worker, fails loudly if any leg breaks. (4) **Doc drift**: CLAUDE.md, README, and inline code comments are the only sources of architecture truth, and they diverge. Fix: maintain a lightweight `ARCHITECTURE.md` (data flow diagram + layer contracts) that is required to update before any PR touching cross-layer interfaces. (5) **Monolithic Worker growth**: index.js decomposition started but the Worker is the only deploy unit -- a bad route handler can silently kill the entire platform. Fix: evaluate Worker Services (route isolation) or at minimum enforce per-route unit test coverage gates in CI. Recommended direction: treat custard-calendar Worker as platform kernel; all sibling repos are consumers of its stable v1 API, not peers.

## Strategy -- Marketing and Product Direction

Consumer habit product first, intelligence platform second. One promise everywhere: "Know today's flavor, plan your week, never miss your favorites."

**Product tier model:**
- Core utility: Forecast + Alerts + Calendar
- Assistive utility: Map + Radar
- Delight/acquisition: Quiz + Fronts + Widget + Tidbyt

**180-day roadmap:**
- [x] **0-45 days: Focus + Consistency** -- (2) Homepage hero simplified to one primary CTA ("Find your store") + one secondary ("View the map"); quiz CTA removed from hero. (3) User-facing copy already consumer-focused; no enterprise language in HTML pages. (4) `docs/privacy.html` created with data-use explainer (no cookies, anonymous session ID, alert email opt-in, third-party services); Privacy link added to footer of all 9 docs pages. Item (1) (sister repo endpoint unification) tracked separately. (2026-02-25)
- [x] **45-90 days: Growth Loops** -- (1) [x] Share button on all 9 pages via `CustardPlanner.initShareButton()` in `planner-shared.js`; uses Web Share API with clipboard fallback; reads og:url + og:title meta tags. (2) [x] Quiz results are shareable: `history.replaceState` writes `?archetype=<id>&flavor=<name>` when result renders; "Share your result" button in result section (stronger style than footer share). Deep-links to map (existing result-map-link) and alerts (existing CTAs). (3) [x] Channel cross-promo: alert + digest emails get Radar/Map/Widget return links; email brand color #003366 -> #005696; widget.html gets "More from Custard Calendar" section with Alerts, Calendar, and Radar cards. (2026-02-26) (4) Removed: SEO landing templates moved to Someday/Maybe.
- [ ] **90-180 days: Personalization + Defensibility** -- (1) "My Custard" state (saved store + favorites) as first-class home. (2) Reframe Radar as decision assistant ("best nearby option today") not feature showcase. (3) Operationalize rarity/seasonality content into recurring editorial/email moments. (4) ML predictions stay as support signal unless confidence/reliability thresholds are met.

**KPI system (formalize weekly operating cadence):**
- North-star: weekly users who take a planning action (alert subscribe, calendar subscribe, or directions click)
- Acquisition: store-selection rate from landing sessions
- Activation: session-to-first-action within same visit
- Retention: returning action users (7d/28d)
- Content: quiz completion -> action conversion
- Channel: widget/tidbyt install starts -> successful setup
- Current telemetry in `worker/src/events.js` + `worker/src/quiz-routes.js` supports most of this; biggest gap is consistent cohorting across sessions/channels.

**Sister repo strategy:**
- custard-calendar: source of truth (product + API + messaging canon)
- custard-scriptable: distribution adapter with canonical API contract
- custard-tidbyt: community distribution adapter with shared contract tests
- Treat as adapters, not independent products; reduce marketing confusion + breakage risk

## Sister Repos

Sibling repositories that depend on the Worker API. Breakages here are silent user-facing failures.

- [x] **custard-scriptable emergency fix** -- fixed base URL (`workers.dev` -> `custard.chriskaschner.com`), endpoint (`/api/flavors` -> `/api/v1/flavors`), and brand color (`#0057B8` -> `#005696`). Also fixed same workers.dev URL bug in `widgets/custard-today.js` (the canonical widget widget.html links to). `Custard Calendar.js` folded into `widgets/custard-scriptable.js`; custard-scriptable repo is now retired. (2026-02-26)
- [x] **custard-tidbyt contract smoke test** -- `tests/test_api_contract.py` in custard-tidbyt: 9 live smoke tests covering /api/v1/flavors (title/date shape), /api/v1/stores (slug/name shape), API-Version header. Fixed WORKER_BASE from workers.dev to custard.chriskaschner.com. SKIP_LIVE_API=1 to skip in offline CI. (2026-02-26)

## Now -- Licensing and Testing

- [x] **License update: non-commercial clause** -- added `LICENSE` at repo root: code under custom non-commercial source license; content/data under CC BY-NC 4.0. Commercial use requires prior written consent. Brand disclaimer included. (2026-02-26)
- [x] **Test coverage gate** -- installed `@vitest/coverage-v8@^3.x`; added `coverage` block to `worker/vitest.config.js` (provider: v8, thresholds: branch 60%, function 70%, line 70%); added `test:coverage` script to `package.json`. First report: 96.41% lines, 72.44% branches, 93.21% functions -- all above threshold. Top gap modules: `email-sender.js` (46% branch), `hotspot-targets.js` (47% branch), `metrics.js` (58% branch). (2026-02-26)
- [x] **Test suite speed and CI hardening** -- per-file coverage floors added to vitest.config.js (email-sender 63%, snapshot-targets 75%, metrics 59%); 15 new Worker tests covering email-sender.js (sendConfirmationEmail, forecast block) + snapshot-targets.js (KV/DB error catch paths) + metrics.js (flavor-context route + specialty D1 catch); `tests/test_live_api.py` added to Python suite: 12 live smoke tests covering /api/v1/flavors, /api/v1/stores, /api/v1/today, API-Version header with SKIP_LIVE_API=1 guard. 595 Worker tests pass. Runtime 2.56s. (2026-02-26)
- [x] **Data quality testing strategy review** -- the mt-horeb D1 sparseness issue (10 rows vs 53 in local SQLite) went undetected because there was no automated gate comparing D1 depth against local backfill. Shipped: (1) `.github/workflows/data-quality.yml` -- weekly scheduled workflow with two jobs: D1 backfill coverage check (priority stores mt-horeb/verona/madison-todd-drive at 90% threshold) and metrics seed freshness gate (<=45 days); (2) `scripts/check_metrics_seed_freshness.py` -- reads `trivia-metrics-seed.js`, extracts `generated_at`, exits nonzero if seed exceeds threshold; 7 pytest tests in `scripts/tests/test_check_metrics_seed_freshness.py`; (3) flavor-stats D1 fixture test in `worker/test/metrics.test.js`: 15 realistic Caramel Cashew rows for mt-horeb, asserts `recent_history` length >= 10 and `total_days` >= 10. (2026-02-26)

## Someday/Maybe

Not active. Only promote if they clearly improve core decision KPIs.

- [ ] **Flavor modification recommendations ("close enough" FOTD hacks)** -- given a user's preferred flavor and today's available FOTD options at nearby stores, recommend stores where a simple add-in transforms the FOTD into a close approximation of the desired flavor. Example: user wants Mint Explosion; store serves Mint Cookie → "Add Andes Mints to get close." Requires: (1) canonical add-in catalog (Andes mints, hot fudge, caramel sauce, strawberry, oreos, pecans, sprinkles — confirm what Culver's actually offers at the counter); (2) a modification map keyed on `(base_fotd_profile, add_in) → approximates_flavor` — likely encoded alongside FLAVOR_PROFILES in `flavor-colors.js` or a new `flavor-modifications.js`; (3) a similarity threshold so only genuinely close matches are shown (not "add caramel sauce to Dark Chocolate Decadence = Caramel Turtle"); (4) surface in the planner result card as a secondary recommendation row: "Today's FOTD + [add-in] ≈ [desired flavor]". Prerequisite: confirm which toppings/add-ins are standardly available vs. store-discretionary. Good candidate for Quiz/personality flow where user states a flavor preference.

- [ ] **Flavor catalog browser with profile filtering** -- expose the full flavor catalog to users as a browsable/filterable page. Filters: base custard (vanilla, chocolate, mint, caramel, cheesecake, etc.), toppings present (oreo, pecan, andes, etc.), ribbon type (caramel, fudge, marshmallow, none). Data already exists in `/api/v1/flavor-colors` (profiles + color palettes) and `/api/v1/flavors/catalog` (catalog entries with descriptions). UI: grid of flavor cards with mini cone visual, filter chips at top. Could live at `docs/flavors.html` or as a tab on `docs/radar.html`. Stretch: "flavors like X" cross-links to similar flavors via SIMILARITY_GROUPS in `flavor-matcher.js`.

- [ ] **Alexa skill** -- custom skill using `/api/v1/today` (requires Amazon dev account + certification)
- [x] **iOS Scriptable widget: multi-store mode** -- implemented as `buildMultiStore()` in `widgets/custard-today.js`; `MODE="multi"` + `slugs=[...]` injected by widget.html copy-script for 3-store layout. Widget page redesigned with three layout cards, type selector, multi-slot picker, and default WI store previews. (2026-02-25).
- [ ] **Android widget** -- parity with iOS Scriptable widget using `/api/v1` data
- [ ] **Madison-area brand expansion** -- selection methodology for adding new brands beyond MKE geo
- [ ] **Flavor chatbot** -- conversational Q&A for flavor info via web chat UI
- [ ] **Pairwise flavor voting** -- group "where should we go tonight?" (deprioritized, no clear MVP)

## Data Health -- Store Coverage Audit

Per-store appearance counts visible in the UI come from D1 snapshots (live Worker DB), not from the full local backfill corpus. D1 has significantly less data: mt-horeb shows 10 Caramel Cashew appearances in D1 vs 53 in local SQLite. This makes rarity/cadence metrics misleading for under-loaded stores.

**Priority order for evaluation and fix: mt-horeb → verona → madison-todd-drive → rest of WI → nationwide.**

Local corpus health summary (backfill + wayback combined):
- mt-horeb: 1,475 clean rows, 94 flavors, 2015-09-02 → 2026-03-31, 7 gaps > 14d
- verona: 1,422 clean rows, 100 flavors, 2015-09-02 → 2022-09-30, 6 gaps > 14d
- madison-todd-drive: 1,691 clean rows, 104 flavors, 2015-09-02 → 2023-07-31, 6 gaps > 14d

Known backfill coverage gaps (systematic, not random): 62-93 day holes in spring/summer/fall for all three stores — collection artifact from quarterly fetch windows.

- [x] **Upload full backfill corpus to D1** -- `scripts/upload_backfill.py` ran full national corpus. 165,263/165,663 rows uploaded (0.24% failure rate = D1 constraint violations on pre-existing rows). (2026-02-26)
- [x] **Expose D1 + local backfill data in metrics context** -- `GET /api/v1/metrics/health/{slug}` returns D1 row count, date range, gap count, gaps >14d (capped at 20), and metrics seed age. Verified live for mt-horeb (1,481 rows), verona (1,424 rows), madison-todd-drive (1,696 rows) -- all spanning 2015-2026. 8 unit tests. (2026-02-26)
- [x] **Fix rarity/cadence display for sparse D1 stores** -- implemented hierarchical fallback: `GET /api/v1/metrics/flavor-hierarchy?flavor=X&slug=Y` returns store/metro/state/national scopes with `effective_scope` = first with >= 30 appearances. `rarityBadge()` in radar.html uses hierarchy when store < 30 appearances, appending scope suffix ("Rare (Madison area)", "Rare (WI)", "Rare (nationally)"). 580 tests pass. (2026-02-26)
- [x] **Fix cross-store avg_gap calculation in flavor-hierarchy** -- `queryDatesForSlugs` now returns `{slug, date}` rows; added `computeGapStatsPerSlug()` that groups by slug, averages per-store gaps, and counts total store-day appearances. Metro/state scopes use the new function; store scope unchanged. Regression test added. 637 tests pass. (2026-02-26)
- [x] **Geographic EDA endpoint** -- `GET /api/v1/analytics/geo-eda?scope=metro|state|national&region=...`. Returns `exclusive_flavors` (>= 50% scope store penetration, sorted by appearances), `cadence_variance` (flavors with widest scope vs national avg_gap divergence), `outlier_stores` (z-score >= 1.5 on monthly unique-flavor count vs scope peers). D1 batching in 98-slug groups. Cache-Control: 24h. 22 new tests, 617 total passing. (2026-02-26)

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
