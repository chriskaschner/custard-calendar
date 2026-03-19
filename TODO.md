# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Product Direction (2026-02-25)

Core value: **confirmed flavor data, discovery, and notifications.** The weather metaphor is the presentation layer (flavor fronts, forecast, outlook) but the data underneath is real confirmed schedules, not predictions. ML predictions stay in the background as a "maybe coming soon" accent -- not the headline.

Analytics data has two strong non-prediction uses: **(1) flavor rarity as shareable content** -- "this flavor appears 3.7% of the time" is interesting trivia grounded in real observation, good for social posts, email digests, and flavor cards; **(2) quiz-to-location matching** -- a personality quiz maps you to a flavor archetype, then confirmed schedule data answers "is your flavor scooping near you today?" The quiz is the fun hook; the confirmed schedule is the utility.

## KPIs and Guardrails

**Primary KPIs:** session-to-action rate, recommendation acceptance rate, share of Confirmed recommendations, freshness SLA, reliability calibration.

**Secondary KPIs:** flavor-signal engagement, quiz-to-action conversion.

**Guardrails:** preflight before each agent task, isolate work by worktree+branch, maintain one shipping lane + one delight lane.

## Priority Queue (Prod Refinement First)

Focus order for the next cycle: tighten production quality and measurement before expanding scope.

1. ~~**P0: CI gate stability + rapid triage discipline**~~ -- closed 2026-03-03. CI fully green: Worker tests (810), Python tests, browser tests (32) all passing. Security Scan (TruffleHog) fixed (event-aware base SHA). Repo-structure CI gate added. SRI enforcement catches unhashed CDN scripts.

2. ~~**P0: Complete post-deploy UX verification in production (Phase 0 blocker)**~~ -- closed 2026-03-03. Chip rerank/no-refetch confirmed by code review. Mini-map pin/card sync bug fixed + 4 browser specs. URL/localStorage state confirmed. Drive retry + SW cache smoke check passed.

3. ~~**P0: Close mini-map synchronization acceptance criterion**~~ -- closed 2026-03-03. setActiveSlug regression fixed, 4 browser specs (initial activate, hover sync, post-rerank persistence, pin click).

4. ~~**P1: Public-readiness OG preview verification**~~ -- closed 2026-03-03. Added scoop + group to PAGE_CARD_DEFS; /og/page/scoop.svg and /og/page/group.svg return 200. og:image added to scoop.html and group.html; full OG block added to privacy.html. Worker 75c13e21.

5. ~~**P1: Card explainability standard**~~ -- closed 2026-03-03. Structured drive-explain block with matched/avoid chips, rarity/novelty sentences, “Familiar pick” fallback.

6. ~~**P1: Tomorrow-aware fallback behavior**~~ -- closed 2026-03-03. Drive uses tomorrow's confirmed schedule as fallback (source=confirmed_tomorrow, certainty=confirmed, "Tomorrow's flavor" kicker, no Directions CTA).

7. ~~**P1: Filter dictionary expansion + regression coverage**~~ -- closed 2026-03-03. Added praline to NUTS_PATTERN; 8 false-positive regression tests.

8. ~~**P1: Secondary-surface handoff polish**~~ -- closed 2026-03-03. Map/Subscribe/Radar links added inside every drive card’s Details section with slug-aware URLs.

9. ~~**P1: .ics event body layout for Apple Calendar truncation**~~ -- fixed 2026-03-01. Reordered DESCRIPTION: flavor description → Backup Options → URL. Reduced 3-blank-line gap to 1. Test 15 added. Worker `f0f7c880`.

10. ~~**P2: Public-readiness cosmetic/meta polish**~~ -- closed 2026-03-03. siri.html already uses #005696 (no legacy tokens found). og:image gaps on scoop/group/privacy resolved in item 4. Alerts placeholder copy ("you@example.com") retained as intentional UX.

11. ~~**P2: Preference-model hardening**~~ -- closed 2026-03-03. 300ms debounce, Reset button, beforeunload flush, legacy migration + corruption browser tests. Share is already handled by buildDriveUrlState URL encoding.

12. ~~**P2: Architecture debt paydown (time-boxed)**~~ -- closed 2026-03-03. Parity audit: cone-renderer.js now handles l2_toppings (Blackberry Cobbler now renders identically client/server). Removed dead cone-renderer.js script tag from quiz.html. ASSET_SPEC.md updated with canonical surface→tier table, l2_toppings parity rule, blackberry_drupe color.

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
- [x] **Fix The Scoop empty results** -- replaced broken `culvers.com/api/locator/getLocations` call with coordinate-based nearby search: generated `worker/src/store-coords.js` (Map<slug, {lat,lng,name,address}> for all 1,012 stores), rewrote `handlePlan()` to parse `lat,lon` from location param, find nearby stores by haversine, batch-fetch flavors via `getFlavorsCached`. Removed `transformLocatorStores()`. 8 new tests. 701 total pass. (2026-02-28)
- [x] **Fix widget 3-store in-app preview** -- `config.widgetFamily` is null when running a Scriptable script in-app, causing `widgetSize` to default to "small" even when `MODE="multi"` is set. Fixed by defaulting to "medium" when `isMultiMode` is true, so the in-app preview correctly shows `buildMultiStore()`. (2026-02-28)

## Now -- Today's Drive (Index-first) Rollout

Status note: production-shipped on 2026-03-01 (PR #7 merge commit `d240a83`, Worker version `28f29b1f-afed-4d65-ba47-a760971d6031`).

- [x] **New decision API surface** -- `GET /api/v1/drive` shipped in Worker with deterministic tagging, hard constraints, score buckets, sort modes (`match|detour|rarity|eta`), nearby leaderboard, and include-estimated fallback behavior. Covered by `worker/test/drive.test.js` + integration coverage. (2026-02-28)
- [x] **Shared local-first preference contract** -- `custard:v1:preferences` added in `docs/planner-shared.js` with defaults + legacy migration (`custard-primary`, `custard-secondary`) + URL merge precedence + save/build helpers. (2026-02-28)
- [x] **Index canonical Today’s Drive UX** -- `docs/index.html` now mounts shared `docs/todays-drive.js` at top of main content with route editor (2-5 stores), chips, sort controls, ranked cards, interactive mini-map, and local reranking without refetching on chip toggles. (2026-02-28)
- [x] **Scoop compatibility alias** -- `docs/scoop.html` now serves as compatibility/deep-link surface for `?stores=` (widget flows) using the same shared Today’s Drive module. (2026-02-28)
- [x] **Drive browser + nav regression coverage** -- added Playwright specs for index Today’s Drive and scoop deep-link compatibility; nav click-through expectations updated to include The Scoop. (2026-02-28)
- [x] **Scoop dual-day card detail** -- `/api/v1/drive` now supports `include_tomorrow=1` (confirmed-only) and Scoop renders an in-card Tomorrow block with fallback copy ("No confirmed flavor posted yet") when no confirmed tomorrow exists. Browser coverage added in `scoop-compat.spec.mjs`. (2026-02-28)
- [x] **Production rollout + validation gate** -- release branch cut, CI fixed/green, merged to `main`, deployed to production, and live smoke checks run for `/health`, `/api/v1/drive` (including `include_tomorrow=1`), Scoop compatibility wiring, and analytics report modes (`--days`, `--weekly`). (2026-03-01)

## Now -- Group Vote ("Where Are We Going?")

Driver picks 2-5 candidate stores, shares a join code, everyone votes yes/meh/no on today’s FOTD, winner is the store with fewest hard-nos (most yeses breaks ties).

- [x] **Worker API** -- `worker/src/group-routes.js`: POST /api/v1/group/create (generates 6-char code, writes KV session + votes, 4h TTL), GET /api/v1/group/:code (tally + winner), POST /api/v1/group/vote (voter_id merge, re-vote overwrites). Rate limits: 10 creates/hr, 60 votes/hr per IP. 15 tests in `worker/test/group-routes.test.js`. (2026-03-01)
- [x] **Winner algorithm** -- `computeWinner()`: sort by no ASC, yes DESC, alpha fallback. Minimize misery over maximize enthusiasm. (2026-03-01)
- [x] **Frontend** -- `docs/group.html`: single-page app with three phases: create (store autocomplete, slug badges), vote (FOTD cards from /api/v1/drive, yes/meh/no buttons, submit + 5s polling), results (winner card, directions CTA, flavor similarity note via embedded SIMILARITY_GROUPS, runner-up tallies). QR code via `qrcode@1.5.3` from unpkg. Voter ID in sessionStorage. (2026-03-01)
- [x] **Nav link** -- "Group" link added to all 12 docs HTML files (index, calendar, map, radar, alerts, siri, forecast-map, quiz, widget, scoop, privacy, group). (2026-03-01)
- [x] **Deployed** -- Worker version `27b12fae-db6c-4870-9310-626de1c18f19`, live smoke test passed (create → get → vote all return correct JSON). (2026-03-01)

## Next -- Today’s Drive Comprehensive Plan (Packaged Brief)

Goal: make the route-first decision experience the default product behavior while keeping discovery surfaces (map/calendar/radar) as secondary paths.

Status baseline: core Drive API + index/scoop shared module are now in production; remaining work is refinement + deeper post-deploy UX validation.

### Phase 0 — Production hardening and parity (P0)

- [x] **Ship current Today’s Drive stack to production** -- completed with merged `main`, production deploy, and live smoke verification for `/api/v1/drive`, index Drive asset load, and scoop deep-link compatibility wiring. (2026-03-01)
- [x] **Scoop dual-day context block** -- implemented via `include_tomorrow=1` on Scoop with confirmed-only tomorrow payload/fallback copy. (2026-02-28)
- [x] **Widget 3-store/3-day visual parity** -- Scriptable widget now uses shared medium-row renderer for both 3-day and 3-store views (aligned hierarchy + right-aligned rarity tags) and widget preview copy/docs reflect parity contract. (2026-02-28)
- [x] **Post-deploy verification checklist** -- chip rerank/no-refetch: confirmed by code review (rerenderFromRaw, no fetch on chip/sort). Mini-map pin/card sync: bug found and fixed (setActiveSlug not called after rerenderFromRaw when activeSlug already set). 4 browser specs added covering initial activate, hover sync, post-rerank persistence, pin click. URL/localStorage state: confirmed via code review (history.replaceState on every savePrefs, URL takes precedence on load). Manual route-edit and mobile/desktop UI walkthroughs remain optional nice-to-have. (2026-03-03)
- [x] **Drive retry + SW cache smoke check** -- production /api/v1/drive returns confirmed cards with real flavor data. Root cause of prior 500s was null fetchFlavorsFn crash (kv cache miss path); fixed and deployed as Worker 93bfd9d8. Browser tests (28/28) and worker tests (801/801) all green. Nav test updated to include Group link. (2026-03-03)

### Phase 1 — UX completeness and trust signals (P1)

- [x] **Card explainability standard** -- replaced single-line drive-rec with structured drive-explain block: matched boost tags as [Chip] chips, avoid tags as muted chips, rarity sentence (“Rare: ~Xd apart”) or novelty (“First time recently”), fallback “Familiar pick” when no signals. (2026-03-03)
- [x] **Tomorrow-aware fallback behavior** -- when today has no confirmed flavor and include_tomorrow=0, drive uses tomorrow's confirmed schedule as fallback (source=confirmed_tomorrow, certainty=confirmed, “Tomorrow's flavor” kicker, no Directions CTA). Scoop mode (include_tomorrow=1) suppresses fallback. 2 new tests. (2026-03-03)
- [x] **Filter dictionary expansion pass** -- added praline to NUTS_PATTERN; 8 false-positive regression tests covering word boundaries, multi-tag flavors, and non-match cases (Peachy Keen != nuts, Chocolate Lava Cake != cheesecake, Mint Chocolate Chip != coffee). (2026-03-03)
- [x] **Secondary-surface handoff polish** -- Map, Subscribe, Radar links added inside every drive card's Details section. URLs: /map.html?focus=slug, /calendar.html?slug=slug, /radar.html?store=slug. (2026-03-03)

### Phase 2 — Preference model evolution (P1/P2)

- [x] **Local preferences v1 hardening** -- 300ms debounce on saveDrivePreferences with beforeunload flush; resetDrivePreferences clears v1 + legacy keys; Reset button in route editor UI. 6 browser tests (debounce, reset, migration, corruption, flush). (2026-03-03)
- [ ] **Route profile roadmap** -- keep one active route now, but define migration path to optional named multi-route profiles (`work/weekend`) without breaking existing keys.
- [x] **State schema governance** -- legacy migration covered by browser tests (corrupt v1 JSON fallback, corrupt legacy key fallback, legacy-to-v1 migration). Version field validated in sanitizeDrivePreferences. (2026-03-03)

### P0 -- Homepage visual coherence audit

The homepage is a mess of disconnected visual elements. Drive cards, hero flavor card, minimap, week-ahead row, cone icons, and score badges all use different sizing, spacing, and styling conventions. Nothing looks like it belongs together.

Specific issues observed (2026-03-03):
- [ ] **Cone icon sizing in Drive cards** -- renderMiniConeSVG renders at pixel-art scale that doesn't match card text; needs either a constrained CSS size or a purpose-built inline icon tier
- [ ] **Drive card vs hero card inconsistency** -- the hero "Today's Flavor" card below the Drive section uses completely different layout, typography, and cone rendering (HD cone) than the Drive cards above it; looks like two different products
- [ ] **Minimap mostly blank** -- when route stores are far apart, pins sit at opposite corners of an empty light-blue rectangle; needs either a real tile background or tighter bounds padding
- [ ] **Score badge styling** -- orange "68" circles float with no visual connection to the card content; unclear what the number means without reading documentation
- [ ] **Week Ahead row cones** -- different scale/rendering tier than Drive card cones; another visual register that doesn't match
- [ ] **Overall card/section hierarchy** -- Drive cards, hero card, overdue alert, calendar CTA, and week-ahead all stack with inconsistent borders, backgrounds, and spacing; needs a unified card system
- [ ] **Rarity/overdue copy fails sniff test** -- "Pumpkin Pecan usually appears every 19 days but hasn't been seen in 97 days" is absurd. Pumpkin Pecan is a seasonal flavor that barely appears outside fall. The avg_gap_days calculation doesn't account for seasonality, so it produces misleading cadence claims. Overdue alerts need a seasonal filter or the cadence copy needs to be suppressed for flavors with strong seasonal concentration.

Goal: a single visual language across all homepage sections so it reads as one product, not six widgets duct-taped together.

### Phase 3 — Optional sync architecture (P2+)

- [ ] **Anonymous sync design spike** -- evaluate Level 2 sync model (random local user_id + tokenized sync link) with explicit KV vs D1 tradeoff and write-rate constraints.
- [ ] **Persistence decision record** -- choose KV blob vs D1 structured storage based on expected write frequency, query needs, and operational simplicity.
- [ ] **Security/privacy review for sync** -- ensure no accidental user identity coupling; document retention and delete semantics before implementation.

### Test and rollout gates

- [x] **Worker tests** -- `/api/v1/drive` coverage now includes `include_tomorrow` confirmed/null behavior and backward-compatible omitted-field behavior. (2026-02-28)
- [x] **Browser tests** -- Scoop tomorrow rendering/fallback assertions added, alerts telemetry flow test added, and existing Drive/nav specs remain green. (2026-02-28)
- [x] **Widget parity proof** -- added fixed screenshot checklist artifact at `docs/screenshots/widget-parity-checklist.md` to gate before/after captures for release notes. (2026-02-28)
- [x] **Metrics instrumentation tie-in** -- Drive/Scoop/alerts/index telemetry now emits through the unified event path and appears in summary-compatible event types. (2026-02-28)

### Acceptance criteria (rollup)

- [x] Homepage remains route-first and performant with 2-5 store ranking cards.
- [x] Scoop shows today card plus tomorrow context block when tomorrow data exists.
- [x] Chips/sort rerank instantly with no unnecessary network calls.
- [x] Mini-map pins stay synchronized with card buckets and focus/hover behavior. Fixed setActiveSlug regression + 4 browser specs. (2026-03-03)
- [x] Preferences persist via `custard:v1:preferences` and URL state sharing works reliably.
- [x] Widget 3-store view visually mirrors 3-day design language, including right-aligned rarity tags.

### Public-readiness follow-ups (non-blocking unless noted)

- [x] **OG social card endpoint verification (P1)** -- confirmed: og:image tags resolve through `/og/page/{slug}.svg` on all pages. scoop.svg, group.svg verified 200 in production. Real share-preview spot-check remains a manual nice-to-have. (2026-03-03)
- [x] **Meta consistency for Scoop + Privacy (P2)** -- scoop.html has og:image + twitter:card. privacy.html has og:title/url/type (no social card — policy page). (2026-03-03)
- [x] **Siri brand color token cleanup (P2)** -- verified: siri.html already uses #005696 throughout, no #003366 found. (2026-03-03)
- [ ] **Alerts placeholder copy review (P2)** -- decide whether `placeholder=\"you@example.com\"` remains intentional UX copy or should be revised to a less developer-toned variant.

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

## Later -- Security

- [x] **M2 endpoint access policy (Public Reads + Guardrails)** -- Worker now uses route classes: public-read, public-write, and admin-read. `ADMIN_ACCESS_TOKEN` bearer auth is enforced for `/api/v1/events/summary`, `/api/v1/quiz/personality-index`, `/api/v1/analytics/geo-eda`, `/api/v1/metrics/accuracy`, and `/api/v1/metrics/accuracy/{slug}`; `/health` remains public. (2026-02-28)
- [x] **M2 browser-origin hardening for write paths** -- write endpoints remain public but browser `Origin` checks are enforced with env-driven allowlists (`PUBLIC_WRITE_ALLOWED_ORIGINS`, `ALERT_ALLOWED_ORIGINS`) including canonical domain `https://custard.chriskaschner.com`. (2026-02-28)
- [x] **M4 abuse throttling for expensive reads/writes** -- centralized KV rate limiter now enforces per-IP limits on `/api/v1/metrics/*`, `/api/v1/forecast/*`, `/api/v1/plan`, `/api/v1/signals/*`, `/api/v1/flavor-stats/*`, `/v1/og/*`, plus public write telemetry endpoints. (2026-02-28)

## Security/Observability Status Ledger

Canonical status values: `Open | Partial | Resolved | Accepted`. Security status truth lives here.

| ID | Status | Owner file(s) | Verification test(s) | Last verified | Reference commit |
|---|---|---|---|---|---|
| M1 | Resolved | `worker/src/route-nearby.js`, `worker/src/rate-limit.js` | `worker/test/rate-limit.test.js` | 2026-02-28 | fda5064 |
| M2 | Resolved | `worker/src/index.js`, `worker/wrangler.toml` | `worker/test/integration.test.js`, `worker/test/rate-limit.test.js` | 2026-02-28 | working-tree |
| M3 | Resolved | `worker/src/alert-routes.js` | `worker/test/alerts.test.js`, `worker/test/rate-limit.test.js` | 2026-02-28 | fda5064 |
| M4 | Resolved | `worker/src/index.js`, `worker/src/rate-limit.js`, `worker/src/route-nearby.js` | `worker/test/rate-limit.test.js`, `worker/test/metrics.test.js` | 2026-02-28 | working-tree |
| M5 | Resolved | `worker/src/index.js`, `worker/src/alert-routes.js`, `docs/*.html` | `worker/test/integration.test.js`, `tests/test_static_assets.py` | 2026-02-28 | working-tree |
| M6 | Resolved | `docs/map.html`, `docs/forecast-map.html`, `docs/vendor/leaflet-heat-0.2.0.js`, `docs/widget.html` | `tests/test_static_assets.py` | 2026-02-28 | working-tree |
| L1 | Resolved | `worker/src/index.js`, `worker/src/events.js`, `worker/src/quiz-routes.js`, `worker/src/metrics.js`, `worker/src/route-nearby.js` | `worker/test/integration.test.js`, `worker/test/metrics.test.js` | 2026-02-28 | working-tree |
| L2 | Accepted | `worker/src/alert-routes.js` | `worker/test/alerts.test.js` | 2026-02-28 | accepted-risk |
| L3 | Accepted | `worker/src/alert-routes.js` | `worker/test/alerts.test.js` | 2026-02-28 | accepted-risk |
| L4 | Accepted | `worker/src/alert-routes.js`, `worker/src/index.js` | `worker/test/alerts.test.js` | 2026-02-28 | accepted-risk |
| L5 | Resolved | `worker/src/index.js` | `worker/test/integration.test.js` | 2026-02-28 | working-tree |
| L6 | Resolved | `src/calendar_sync.py` | `tests/test_calendar_sync.py` | 2026-02-28 | 8272007 |
| X1 | Resolved | `worker/src/kv-cache.js`, `worker/src/index.js` | `worker/test/kv-cache.test.js`, `worker/test/health.test.js` | 2026-02-28 | working-tree |
| X2 | Accepted | `apps/culversfotd/culvers_fotd.star` | `manual-review` | 2026-02-28 | accepted-risk |
| X3 | Accepted | `config.yaml`, `apps/culversfotd/culvers_fotd.star` | `manual-review` | 2026-02-28 | accepted-risk |

## Later -- Refactor / Re-Architecture

"Are we DRY?", "Can rendering be standardized?", "If built today, what architecture wins do we capture?" Full plan in WORKLOG.md.

- [x] **DRY audit** -- Identified 7 duplication hotspots: certainty thresholds (CRITICAL fix applied), escapeHtml (11 files), similarity groups (2 implementations), flavor families, haversine (8 files), WORKER_BASE (9 hardcoded, 1 URL mismatch), brand colors. (2026-02-27)
- [x] **WORKER_BASE consolidation** -- single source of truth in planner-shared.js, replaced 9 hardcoded constants across 10 files. Fixed URL mismatch (5 pages used workers.dev instead of canonical custard.chriskaschner.com). Browser test mocks updated. (2026-02-28)
- [x] **escapeHtml consolidation** -- 7 inline definitions removed, all pages alias CustardPlanner.escapeHtml. (2026-02-28)
- [x] **haversine consolidation** -- inline definition in calendar.html removed, uses CustardPlanner.haversineMiles. (2026-02-28)
- [x] **Flavor config API** -- `GET /api/v1/flavor-config` returns similarity groups + flavor families + brand colors from single server source (`flavor-matcher.js`). `planner-shared.js` bootstraps from this endpoint with local fallback constants, eliminating manual sync drift. (2026-02-24)
- [x] **Shared decision/certainty modules** -- Fixed critical threshold divergence: planner-shared.js now matches worker/src/certainty.js (MIN_PROBABILITY=0.02, MIN_HISTORY_DEPTH=14, MAX_FORECAST_AGE_HOURS=168). Added escapeHtml export. (2026-02-27)
- [x] **Decompose index.js** -- extracted `route-today.js`, `route-calendar.js`, `route-nearby.js`, `kv-cache.js`, and `brand-registry.js`; index.js now 489 lines. Named exports (`getFetcherForSlug`, `getBrandForSlug`, `getFlavorsCached`) preserved via re-export for test compatibility. (2026-02-24)
- [ ] **Mad Libs quality + variety** -- current mad libs feel unnatural; expand beyond the single template to multiple options and revisit question/answer quality
- [ ] **Flavor asset parity audit + canonicalization** -- full cross-surface review: displayed name, description copy, and visual asset output (cone/marker/card variants) everywhere a flavor appears (Forecast, Radar, Map, Fronts, Quiz results, Widget, Tidbyt, OG/social); publish mismatch report, align all surfaces to one canonical source of truth. Blocked on asset generation work. Phases 1–5 (profiles, collisions, Tidbyt sync, OG cards, comparison tool) already complete.
- [ ] **Canonical render spec** -- palette + geometry + toppings with adapters per surface.
  - [x] **Hero cone renderer reevaluation** -- redesigned from scratch as 36×42 grid v2: fixed topping slots (same as HD cone, no scatter), 4-pixel specular highlight at upper-left dome (not a rectangle), 3-pixel occlusion shadow at lower-right edge, 9-point S-curve ribbon 2px wide (no staircase artifact at scale 8). lightenHex(0.25) highlight, darkenHex(0.12) shadow. Toppings and ribbon non-overlapping by geometry. Audit page updated to scale 4 (144×168px). 646 tests pass. (2026-02-26)
- [ ] **Greenfield target architecture** -- three-layer model: Presentation (docs), Decision (planner/certainty/signals/reliability as pure functions), Data (KV/D1 access). Incremental migration, not rewrite.
- [x] **CLAUDE.md + Codex rules: rate limit awareness** -- External Rate Limits table + explicit agent/batch rule already in CLAUDE.md. (2026-02-25)
- [x] **CLAUDE.md doc fixes** -- updated Worker test count (343 -> 574, 21 -> 32 suites), Python test counts (142 -> 179, analytics 99 -> 117), page count (5 -> 9), added analytics_report.py command. Fixed timezone bug in reliability.test.js isoDate helper. (2026-02-25)
- [x] **CLAUDE.md / Codex consistency** -- audited commands, test counts, and architecture; all updated to match current state. (2026-02-25)
- [x] **Multi-agent coordination** -- protocol documented in CLAUDE.md: worktree isolation, task claim convention, merge-only-forward rule, TODO.md as cross-session coordination channel, test gate before merge. (2026-02-25)
- [x] **Platform architecture review (executive)** -- five principal risks identified and mitigated. ARCHITECTURE.md created at repo root (data flow diagram, three-layer model, API contract points, risk register). `/api/v1/schema` endpoint added to Worker returning machine-readable API contract with `schema_version` field. `.github/workflows/ci.yml` added: runs Worker tests + Python tests on every push/PR to main. Risks 2 and 5 documented as partial mitigations (monitor, no action needed now). 666 Worker tests pass. (2026-02-26)

## Strategy -- Marketing and Product Direction

Consumer habit product first, intelligence platform second. One promise everywhere: "Know today's flavor, plan your week, never miss your favorites."

**Product tier model:**
- Core utility: Forecast + Alerts + Calendar
- Assistive utility: Map + Radar
- Delight/acquisition: Quiz + Fronts + Widget + Tidbyt

**180-day roadmap:**
- [x] **0-45 days: Focus + Consistency** -- (2) Homepage hero simplified to one primary CTA ("Find your store") + one secondary ("View the map"); quiz CTA removed from hero. (3) User-facing copy already consumer-focused; no enterprise language in HTML pages. (4) `docs/privacy.html` created with data-use explainer (no cookies, anonymous session ID, alert email opt-in, third-party services); Privacy link added to footer of all 9 docs pages. Item (1) (sister repo endpoint unification) tracked separately. (2026-02-25)
- [x] **45-90 days: Growth Loops** -- (1) [x] Share button on all 9 pages via `CustardPlanner.initShareButton()` in `planner-shared.js`; uses Web Share API with clipboard fallback; reads og:url + og:title meta tags. (2) [x] Quiz results are shareable: `history.replaceState` writes `?archetype=<id>&flavor=<name>` when result renders; "Share your result" button in result section (stronger style than footer share). Deep-links to map (existing result-map-link) and alerts (existing CTAs). (3) [x] Channel cross-promo: alert + digest emails get Radar/Map/Widget return links; email brand color #003366 -> #005696; widget.html gets "More from Custard Calendar" section with Alerts, Calendar, and Radar cards. (2026-02-26) (4) Removed: SEO landing templates moved to Someday/Maybe.
- [x] **90-180 days: Personalization + Defensibility** -- Items 1-4 implemented (2026-02-27).

  **1. "My Custard" saved state (MVP: localStorage, no auth)** -- `planner-shared.js` gains `getSavedStore()`, `setSavedStore()`, `getFavorites()`, `addFavorite()`, `removeFavorite()` using `custard-favorites` key. `alerts.html` pre-fills saved favorites on catalog load and persists add/remove actions. `index.html` already auto-loaded saved store. (2026-02-27)

  **2. Radar reframe: decision assistant, not feature showcase** -- "Best option today" card added above 7-day grid on `radar.html`. Calls `/api/v1/plan?location=lat,lng&radius=25`, renders top Confirmed result with `CustardPlanner.actionCTAsHTML()`. 7-day section renamed "Full Outlook". Hidden if no Confirmed results or no store coordinates. (2026-02-27)

  **3. Recurring editorial email moments** -- `sendWeeklyDigestEmail()` in `email-sender.js` gains two new blocks: (1) `signalOfWeekBlock` — top signal (signals[0]) rendered with signal type label in a blue-bordered card above the existing signals section; (2) `raritySpotlightBlock` — `findRaritySpotlightForWeek()` in `alert-checker.js` queries D1 for week flavors with avg_gap_days > 60, passes result as `raritySpotlight` param, rendered in a purple-bordered card with Set Alert link. Both blocks are additive; no schema changes. (2026-02-27)

  **4. ML confidence gates (already shipped — document the policy)** -- Certainty thresholds (`MIN_PROBABILITY = 0.02`, `MIN_HISTORY_DEPTH = 14`, `MAX_FORECAST_AGE_HOURS = 168`) documented in `ARCHITECTURE.md` Decision Layer section. (2026-02-27)

- [ ] **Greenfield target architecture: formalize layer discipline** -- `ARCHITECTURE.md` now documents target state, current gaps, and migration rule. Current gaps: rarity query inline in alert-checker (move to flavor-stats.js), brand-specific locator logic in planner.js (multi-brand abstraction when needed). See ARCHITECTURE.md "Greenfield Target Architecture" section.

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
- [x] **Scriptable widget UX polish** -- cone colors aligned to `#D2691E`/`#F5DEB3` canonical palette; `w.url` added to all builders in both custard-scriptable.js and custard-today.js so tapping opens `custard.chriskaschner.com?store=SLUG`; multi-store falls back to root. (2026-02-27)
- [x] **Scriptable widget multi-view visual parity** -- 3-day and 3-store now share one medium-row renderer in `docs/assets/custard-today.js` (same label/title/description stack, right-aligned rarity tags, aligned spacing hierarchy). `docs/widget.html` preview layout updated to mirror this parity contract, and screenshot checklist added at `docs/screenshots/widget-parity-checklist.md`. (2026-02-28)
- [x] **custard-tidbyt contract smoke test** -- `tests/test_api_contract.py` in custard-tidbyt: 9 live smoke tests covering /api/v1/flavors (title/date shape), /api/v1/stores (slug/name shape), API-Version header. Fixed WORKER_BASE from workers.dev to custard.chriskaschner.com. SKIP_LIVE_API=1 to skip in offline CI. (2026-02-26)
- [x] **Tidbyt daily deploy not running** -- root cause: `TIDBYT_API_TOKEN` and `TIDBYT_DEVICE_ID` secrets were not set in GitHub repo. `main.py` was also swallowing the missing-token error and exiting 0 (silent false success). Fixed: secrets added, `device_id` moved from hardcoded workflow value to `TIDBYT_DEVICE_ID` secret, `--tidbyt-only` now exits 1 on push failure. (2026-02-27)

## Next -- Page Metrics and Usage Visibility

**Current state:** action tracking is fully built (`interaction_events` D1 table, `POST /api/v1/events` sendBeacon, `GET /api/v1/events/summary`, `analytics_report.py`) and now wired across docs surfaces. Event schema includes page/store/filter/widget + referrer/device fields; page-view rollout, legacy index store-select parity, and alert funnel completion events are implemented.

**Two-track approach:**

**Track 1 — Extend existing event system** (adds product-specific intelligence)
- [x] **Page view events (finish rollout)** -- `planner-shared.js` now auto-emits page views across docs surfaces and forwards `referrer`/`device_type` through the browser payload path. (2026-02-28)
- [x] **Store select event (complete parity)** -- legacy index dropdown store selection now emits `store_select` so all store-pick paths are measured consistently. (2026-02-28)
- [x] **Scoop-specific events** -- Scoop now emits `filter_toggle` and `widget_tap` via the shared Today’s Drive surface (chip actions and `?stores=` entry attribution). (2026-02-28)
- [x] **Alert funnel events** -- alerts page now emits `alert_form_view` on load and `alert_subscribe_success` on successful subscribe responses. (2026-02-28)
- [x] **Summary endpoint additions** -- `GET /api/v1/events/summary` returns `by_device_type` and `top_referrers`, and reporting parity is now shipped in `scripts/analytics_report.py`. (2026-02-28)

**Standard metrics Track 1 covers once shipped:**
- Page views per page (which of 10 pages gets traffic)
- Session counts (daily unique `page_load_id` values)
- Traffic sources (referrer breakdown: direct, search, social, widget)
- Device split (mobile vs desktop — important for widget users)
- Top stores by engagement (store_select events)
- Scoop filter popularity (which flavor chips get used)
- Widget-to-web attribution (widget_tap rate)
- Alert subscription funnel (view → intent → confirm)

**Track 2 — Cloudflare Web Analytics beacon** (adds passive/complementary data)
- [x] **CF beacon on all docs pages** -- added Cloudflare Web Analytics beacon to all 11 docs pages (index, map, radar, alerts, siri, calendar, quiz, widget, privacy, scoop, forecast-map). Token: c050ff4e79d54b2abbb60587137d0bb2. No cookies, GDPR-compliant, bot-filtered. (2026-02-27)
- Standard metrics Track 2 adds: bot-filtered traffic baseline, time-on-page, bounce rate per page, browser/OS distribution, more accurate unique visitor count.

**Implementation order:** Track 1 page_view completion first (immediate visibility into passive visits), then store_select parity on legacy index picker, then alert funnel completion events, then `analytics_report.py` parity.

**Track 3 — Automated weekly reporting**
- [x] **Weekly metrics digest** -- `analytics_report.py` now supports `--weekly`, prints YES/NO weekly signal answers, widget taps by slug, Scoop filter activity, and referrer domain buckets, while standard mode now includes `by_device_type` + `top_referrers` sections. (2026-02-28)

## Now -- Licensing and Testing

- [x] **License update: non-commercial clause** -- added `LICENSE` at repo root: code under custom non-commercial source license; content/data under CC BY-NC 4.0. Commercial use requires prior written consent. Brand disclaimer included. (2026-02-26)
- [x] **Test coverage gate** -- installed `@vitest/coverage-v8@^3.x`; added `coverage` block to `worker/vitest.config.js` (provider: v8, thresholds: branch 60%, function 70%, line 70%); added `test:coverage` script to `package.json`. First report: 96.41% lines, 72.44% branches, 93.21% functions -- all above threshold. Top gap modules: `email-sender.js` (46% branch), `hotspot-targets.js` (47% branch), `metrics.js` (58% branch). (2026-02-26)
- [x] **Test suite speed and CI hardening** -- per-file coverage floors added to vitest.config.js (email-sender 63%, snapshot-targets 75%, metrics 59%); 15 new Worker tests covering email-sender.js (sendConfirmationEmail, forecast block) + snapshot-targets.js (KV/DB error catch paths) + metrics.js (flavor-context route + specialty D1 catch); `tests/test_live_api.py` added to Python suite: 12 live smoke tests covering /api/v1/flavors, /api/v1/stores, /api/v1/today, API-Version header with SKIP_LIVE_API=1 guard. 595 Worker tests pass. Runtime 2.56s. (2026-02-26)
- [x] **Data quality testing strategy review** -- the mt-horeb D1 sparseness issue (10 rows vs 53 in local SQLite) went undetected because there was no automated gate comparing D1 depth against local backfill. Shipped: (1) `.github/workflows/data-quality.yml` -- weekly scheduled workflow with two jobs: D1 backfill coverage check (priority stores mt-horeb/verona/madison-todd-drive at 90% threshold) and metrics seed freshness gate (<=45 days); (2) `scripts/check_metrics_seed_freshness.py` -- reads `trivia-metrics-seed.js`, extracts `generated_at`, exits nonzero if seed exceeds threshold; 7 pytest tests in `scripts/tests/test_check_metrics_seed_freshness.py`; (3) flavor-stats D1 fixture test in `worker/test/metrics.test.js`: 15 realistic Caramel Cashew rows for mt-horeb, asserts `recent_history` length >= 10 and `total_days` >= 10. (2026-02-26)

## Someday/Maybe

Not active. Only promote if they clearly improve core decision KPIs.

- [ ] **"Go or add a topping?" preference-driven decision card** -- core problem: a user's primary stores often have FOTDs they don't love; they need a fast answer to "is it worth driving further, or would a topping get me close enough?" Two-phase flow: (1) minimal binary preference intake ("Mint: yes/no, Chocolate: yes/no, Nuts: yes/no, Fruity: yes/no" — 4-6 questions max, no quiz overhead) builds a lightweight taste profile; (2) for each nearby FOTD, score it against the profile and decide: strong match → go, weak match → check if a single standard topping closes the gap (see Flavor modification recommendations below), no match → show next nearest store with a match. Output is a single "Today's call" card: best store name + FOTD + optional topping suggestion + drive distance, with a secondary row for the next-best option. Keeps the decision local (no account required). Prerequisite: modification map from item below. Integration point: planner-shared.js preference contract already stores binary-ish favorites; could extend `custard:v1:preferences` with a `taste_profile` sub-key to persist without re-asking each visit.

- [ ] **Flavor modification recommendations ("close enough" FOTD hacks)** -- given a user's preferred flavor and today's available FOTD options at nearby stores, recommend stores where a simple add-in transforms the FOTD into a close approximation of the desired flavor. Example: user wants Mint Explosion; store serves Mint Cookie → "Add Andes Mints to get close." Requires: (1) canonical add-in catalog (Andes mints, hot fudge, caramel sauce, strawberry, oreos, pecans, sprinkles — confirm what Culver's actually offers at the counter); (2) a modification map keyed on `(base_fotd_profile, add_in) → approximates_flavor` — likely encoded alongside FLAVOR_PROFILES in `flavor-colors.js` or a new `flavor-modifications.js`; (3) a similarity threshold so only genuinely close matches are shown (not "add caramel sauce to Dark Chocolate Decadence = Caramel Turtle"); (4) surface in the planner result card as a secondary recommendation row: "Today's FOTD + [add-in] ≈ [desired flavor]". Prerequisite: confirm which toppings/add-ins are standardly available vs. store-discretionary. Good candidate for Quiz/personality flow where user states a flavor preference.

- [ ] **Flavor catalog browser with profile filtering** -- expose the full flavor catalog to users as a browsable/filterable page. Filters: base custard (vanilla, chocolate, mint, caramel, cheesecake, etc.), toppings present (oreo, pecan, andes, etc.), ribbon type (caramel, fudge, marshmallow, none). Data already exists in `/api/v1/flavor-colors` (profiles + color palettes) and `/api/v1/flavors/catalog` (catalog entries with descriptions). UI: grid of flavor cards with mini cone visual, filter chips at top. Could live at `docs/flavors.html` or as a tab on `docs/radar.html`. Stretch: "flavors like X" cross-links to similar flavors via SIMILARITY_GROUPS in `flavor-matcher.js`.

- [ ] **Alexa skill** -- custom skill using `/api/v1/today` (requires Amazon dev account + certification)
- [x] **iOS Scriptable widget: multi-store mode** -- implemented as `buildMultiStore()` in `widgets/custard-today.js`; `MODE="multi"` + `slugs=[...]` injected by widget.html copy-script for 3-store layout. Widget page redesigned with three layout cards, type selector, multi-slot picker, and default WI store previews. (2026-02-25). Visual alignment pass (2026-02-26): branded header color from first store (matches today/3-day), "Your Stores" label dropped, city name replaces date label with same typography, description added below flavor name, rarity right-aligned in city row using RARITY_COLORS map, padding/spacing matches buildMedium.
- [ ] **Android widget** -- parity with iOS Scriptable widget using `/api/v1` data
- [ ] **Madison-area brand expansion** -- selection methodology for adding new brands beyond MKE geo
- [ ] **Flavor chatbot** -- conversational Q&A for flavor info via web chat UI
- [x] **Group vote: "where are we going?" session** -- promoted from Someday/Maybe; shipped 2026-03-01. See "Now -- Group Vote" section above. KV-backed ephemeral sessions (4h TTL), join code + QR, yes/meh/no voting, minimize-misery winner algorithm, flavor similarity note, 15 tests. `docs/group.html` + `worker/src/group-routes.js` + nav link on all 12 pages.
- [ ] **Tidbyt cone animation** -- add sparkle or other animation to the Tidbyt cone render.

## Won't Do

Formally closed items. Documented rationale for why these will not be built.

### ML Prediction Pipeline (closed 2026-03-19)

Strategic rationale: The analytics pipeline confirmed that Culver's publishes flavor schedules deterministically. Confirmed schedule accuracy is ~100%; ML prediction top-1 accuracy is 3.2%. The confirmed schedule IS the product. Prediction infrastructure has no user-visible value and would add maintenance burden without improving the core experience. See REQUIREMENTS.md SIMP-03.

- [x] **Ensemble predictor** -- Won't Do. FR/Markov/PCA ensemble targets ~5-6% top-1 accuracy from 3.2% baseline. The confirmed schedule IS the product (99%+ accuracy); prediction accuracy improvements have no user-visible value. Closed 2026-03-19.
- [x] **Confidence intervals in forecast output** -- Won't Do. P95 uncertainty bands on predictions are meaningless when predictions themselves have 3.2% accuracy. The product surfaces confirmed schedules, not probabilistic forecasts. Closed 2026-03-19.
- [x] **Cluster-based transfer learning** -- Won't Do. PCA cluster centroids as priors for sparse stores is prediction infrastructure with no surface value. Confirmed schedule data from upstream sites provides 100% accuracy for covered stores. Closed 2026-03-19.
- [x] **Cluster-personalized forecast emails** -- Won't Do. Comparing store to PCA cluster centroid for email personalization is prediction-framed. Weekly digest emails already ship confirmed schedules and flavor signals -- no user value from adding probabilistic cluster comparisons. Closed 2026-03-19.

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
- [x] **Add DoW + seasonality features** -- Added `_compute_dow_bonus()` and `_compute_seasonal_bonus()` to FrequencyRecencyModel. Weight blend updated: freq=0.60, recency=0.20, dow=0.10, seasonal=0.10. Min 5 appearances threshold prevents sparse-store noise. 4 new synthetic-data tests (peak day, insufficient data, seasonal concentration, weights sum to 1). 16 analytics/tests/test_predict.py tests pass. (2026-02-26)
- [x] **Expand overdue watch-list** -- n_overdue default raised from 3 to 5 in forecast_writer.py. (2026-02-27)
- [x] **Fix NMF convergence** -- max_iter raised from 500 to 1000 in collaborative.py. Test fixture still warns (sparse synthetic data), production should converge. n_components=5 needs accuracy evaluation. (2026-02-27)

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
