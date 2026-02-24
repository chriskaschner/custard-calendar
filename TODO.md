# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Product Direction (2026-02-25)

Core value: **confirmed flavor data, discovery, and notifications.** The weather metaphor is the presentation layer (flavor fronts, forecast, outlook) but the data underneath is real confirmed schedules, not predictions. ML predictions stay in the background as a "maybe coming soon" accent -- not the headline.

Analytics data has two strong non-prediction uses: **(1) flavor rarity as shareable content** -- "this flavor appears 3.7% of the time" is interesting trivia grounded in real observation, good for social posts, email digests, and flavor cards; **(2) quiz-to-location matching** -- a personality quiz maps you to a flavor archetype, then confirmed schedule data answers "is your flavor scooping near you today?" The quiz is the fun hook; the confirmed schedule is the utility.

## KPIs and Guardrails

**Primary KPIs:** session-to-action rate, recommendation acceptance rate, share of Confirmed recommendations, freshness SLA, reliability calibration.

**Secondary KPIs:** flavor-signal engagement, quiz-to-action conversion.

**Guardrails:** preflight before each agent task, isolate work by worktree+branch, maintain one shipping lane + one delight lane.

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

- [ ] **Explicit trigger rules** -- define when Estimated fill activates vs. showing "No data."
- [ ] **UX separation** -- Estimated always labeled, always ranked below Confirmed/Watch. Clear visual distinction.
- [ ] **Test coverage** -- trigger rules covered by tests to prevent accidental promotion of Estimated to Confirmed.

## Next -- Personality Mad Lib -> Nearby Match

Quiz/Mad Lib maps personality/archetype to flavor preferences, then calls planner engine with location/radius.

- [ ] **Planner integration** -- quiz output drives real trip planning actions via shared planner engine, not just a personality card.
- [ ] **Actionable results** -- always return in-radius match, nearest outside radius, and alternatives with CTAs.

## Next -- Flavor Signals and Stories

Turn high-specificity seasonal/store insights into explainable content with evidence thresholds.

- [ ] **Signal detection** -- statistically gated pattern recognition (e.g., How Now Brown Cow over-index signatures). Plain-language explanation with evidence.
- [ ] **Surface across pages** -- Forecast signal card, Radar "why this," Map store signature line, weekly email "Wild Find."
- [ ] **Action linkage** -- every signal links to an action (Alert, Calendar, Directions).

## Next/Later -- Map/Fronts Visual v2

PCA/category overlays + improved weather-motion aesthetics, tied directly to decisions.

- [ ] **Decision-driven visuals** -- visuals clarify where/when to go, not just look better.
- [ ] **Interaction-to-action metrics** -- measure and improve. No usability/performance regressions.

## Later -- Refactor / Re-Architecture

"Are we DRY?", "Can rendering be standardized?", "If built today, what architecture wins do we capture?"

- [ ] **DRY audit** -- duplicated logic across Worker, docs, widget, OG tooling, Tidbyt (especially flavor/cone image generation).
- [ ] **Canonical render spec** -- palette + geometry + toppings with adapters per surface.
- [ ] **Shared decision/certainty modules** -- extract to reduce cross-page divergence, enforce contracts by tests.
- [ ] **Decompose large modules** -- formalize API/data contracts to prevent drift.
- [ ] **Greenfield target architecture** -- define data layer, decision layer, presentation layer. Migrate incrementally, not rewrite. Staged cutovers with rollback safety.

## Someday/Maybe

Not active. Only promote if they clearly improve core decision KPIs.

- [ ] **Alexa skill** -- custom skill using `/api/v1/today` (requires Amazon dev account + certification)
- [ ] **Android widget** -- parity with iOS Scriptable widget using `/api/v1` data
- [ ] **Madison-area brand expansion** -- selection methodology for adding new brands beyond MKE geo
- [ ] **Flavor chatbot** -- conversational Q&A for flavor info via web chat UI
- [ ] **Pairwise flavor voting** -- group "where should we go tonight?" (deprioritized, no clear MVP)

## Background -- Analytics as Content

The analytics pipeline's best output isn't predictions -- it's **flavor intelligence**: rarity scores, streak tracking, frequency stats, similarity clusters. All grounded in what actually happened, surfaced as shareable content and discovery tools.

- [ ] **Add DoW + seasonality features** -- 38 flavors show significant day-of-week bias. Add to FrequencyRecency and MarkovRecency models. Expected +5-8% top-1 accuracy.
- [ ] **Implement ensemble predictor** -- combine FR (40%), Markov (40%), PCA-collaborative (20%). Current 3.2% top-1 -> maybe 5-6%.
- [ ] **Expand overdue watch-list** -- show top 5 overdue flavors in emails (currently 3).
- [ ] **Confidence intervals in forecast output** -- P95 uncertainty bands.
- [ ] **Fix NMF convergence** -- increase max_iter to 1000, test n_components=5.
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
