# TODO

Canonical task list for Custard Calendar. Checked into git so it persists across sessions and machines.

## Product Direction (2026-02-25)

Core value: **confirmed flavor data, discovery, and notifications.** The weather metaphor is the presentation layer (flavor fronts, forecast, outlook) but the data underneath is real confirmed schedules, not predictions. ML predictions stay in the background as a "maybe coming soon" accent -- not the headline.

Analytics data has two strong non-prediction uses: **(1) flavor rarity as shareable content** -- "this flavor appears 3.7% of the time" is interesting trivia grounded in real observation, good for social posts, email digests, and flavor cards; **(2) quiz-to-location matching** -- a personality quiz maps you to a flavor archetype, then confirmed schedule data answers "is your flavor scooping near you today?" The quiz is the fun hook; the confirmed schedule is the utility.

## Now -- Fixes and Gaps

Things that are broken or misleading today.

- [x] **Fix quiz 404** -- quiz.html shipped with personality engine; homepage CTA works. (2026-02-25)
- [x] **Fix map subtitle** -- updated map.html, forecast-map.html to multi-brand copy. (2026-02-25)
- [x] **Verify Tidbyt daily workflow** -- fixed pixlet download URL (asset naming changed); triggered manual run. (2026-02-25)
- [x] **Enrich widget cards** -- update `widgets/custard-today.js` so medium widget shows flavor icon (cone), name, and description -- closer to the Forecast page cards and the Tidbyt 3-day view. Small widget should also show description if space allows. (2026-02-25)
- [x] **Fix widget.html "Copy Script" on iOS** -- pre-fetch script on page load so click handler is synchronous (preserves user gesture), textarea fallback for older browsers, added "View Script" link as iOS escape hatch. (2026-02-25)
- [x] **Revise rarity classification** -- added Common (50-75th) and Staple (>75th) tiers; every flavor now gets a label. Updated worker, radar, widget, CSS. (2026-02-25)
- [x] **Reframe Radar for confirmed data** -- confirmed days get blue tint + solid border; predicted days recede with gray tones + reduced opacity. Added hint text. (2026-02-25)
- [x] **Reframe homepage copy** -- meta/title/hero/onboarding reframed from "forecast" to "confirmed schedule." Weather voice preserved. (2026-02-25)

## Next -- Confirmed-Data UX

Features that lean into what works.

- [x] **"Near me now" entry point** -- auto-geolocates on first visit, shows 5 closest stores with cone icon, flavor, distance. Click to select. (2026-02-25)
- [x] **Flavor fronts on confirmed data** -- defaults to "Confirmed Today" mode with family-colored markers, toggle to "Forecast" for predictions. 9 flavor families with hotspot sidebar. (2026-02-25)
- [x] **Weather-map animation on confirmed data** -- smooth 400ms crossfade between days (200ms ease-in fade-out + 200ms ease-out fade-in). Softer heatmap blobs (radius 45, blur 40). Bold today tick on timeline. (2026-02-25)
- [x] **Map category chips** -- 9 flavor family filter chips on map page. Non-matching markers fade to 15% opacity. Resets on new search. (2026-02-25)
- [x] **Calendar subscription visibility** -- CTA card appears after today's flavor loads with one-click .ics URL copy. Supplements existing preview at page bottom. (2026-02-25)
- [x] **Flavor quiz -> nearby match** -- quiz matches archetype to confirmed nearby flavors with similarity fallback. (2026-02-25)
- [x] **Quiz: only return actually-available flavors** -- rewrote engine to intersect archetype candidates with `all_flavors_today` from nearby-flavors API; similarity groups as fallback. Never shows unavailable flavors. (2026-02-25)
- [x] **Quiz: "today" means until 10pm local** -- added 10pm cutover detection with late-night messaging. (2026-02-25)
- [x] **Flavor rarity as shareable content** -- `/api/v1/flavor-stats/{slug}?flavor=X` returns appearances, avg gap, annual frequency, seasonality, DoW bias, streaks, cross-store rarity. (2026-02-25)
- [x] **Flavor intelligence metrics** -- new `/api/v1/flavor-stats/{slug}` endpoint with 14 tests. Store overview returns personality (top flavor families) and overdue list. Single-flavor mode returns all metrics from D1 history. (2026-02-25)

## Later -- Polish and Expansion

- [ ] **Alexa skill** -- custom skill using `/api/v1/today` (requires Amazon dev account + certification)
- [ ] **Android widget** -- parity with iOS Scriptable widget using `/api/v1` data
- [ ] **Madison-area brand expansion** -- selection methodology for adding new brands beyond MKE geo
- [ ] **Flavor chatbot** -- conversational Q&A for flavor info via web chat UI
- [ ] **Pairwise flavor voting** -- group "where should we go tonight?" (deprioritized, no clear MVP)

## Background -- Analytics as Content

The analytics pipeline's best output isn't predictions -- it's **flavor intelligence**: rarity scores, streak tracking, frequency stats, similarity clusters. All grounded in what actually happened, surfaced as shareable content and discovery tools.

- [ ] **Add DoW + seasonality features** -- 38 flavors show significant day-of-week bias. Add to FrequencyRecency and MarkovRecency models. Expected +5-8% top-1 accuracy.
- [ ] **Implement ensemble predictor** -- combine FR (40%), Markov (40%), PCA-collaborative (20%). Current 3.2% top-1 -> maybe 5-6%.
- [ ] **Reframe forecast email confidence wording** -- "Moderate chance of X (5%)" is misleading for near-random probabilities.
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
