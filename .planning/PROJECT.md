# Custard Calendar — Site Restructuring

## What This Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores — primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). It uses a weather forecast metaphor ("Custard Forecast") as its design concept. The site has confirmed flavor data ~30 days out and a deep historical dataset (observations back to 2015-08-02 across 971+ stores with 176+ distinct flavors) powering rarity scores, day-of-week patterns, and other analytics.

The backend/API layer is feature-complete. This project restructures the presentation layer from 11 loosely connected pages to a focused product organized around 4 real use cases, with clear navigation (Today, Compare, Map, Fun) and progressive disclosure.

## Core Value

A family in the car (or on the couch) can instantly see what flavors are at their nearby stores and decide where to go — no friction, no hunting through pages.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- [x] Flavor data ingestion from 6 brands via Cloudflare Worker (scraping, KV/D1 caching) — existing
- [x] JSON API v1 serving flavor data, forecasts, signals, rarity, enrichment — existing
- [x] .ics calendar feed (multi-store, RFC 5545 compliant) — existing
- [x] iOS Scriptable widgets in 3 sizes (1 store/1 day, 1 store/3 days, 3 stores/1 day) — existing
- [x] Siri Shortcut integration via /api/v1/today — existing
- [x] Email alerts with daily + weekly digest, double opt-in, rarity spotlight — existing
- [x] Map page with Leaflet, cone markers, brand filter, store specialty — existing
- [x] Quiz engine with 6 modes, archetype-to-flavor matching, nearby flavor CTAs — existing
- [x] Today's Drive scoring (ranks 2-5 stores by certainty, distance, rarity, preference) — existing
- [x] Persistent store selection via localStorage with URL param override — existing
- [x] Certainty tiers (Confirmed/Watch/Estimated/None) replacing prediction confidence — existing
- [x] Flavor enrichment: rarity tags, day-of-week patterns, seasonality, streaks, signals — existing
- [x] Group vote with KV-backed sessions, QR join, minimize-misery algorithm — existing
- [x] Tidbyt display app (separate repo, production, 29 flavor profiles) — existing
- [x] 810+ Worker tests, 32 Playwright tests, 179 Python tests — existing

### Active

<!-- Current scope. Presentation-layer restructuring across 3 phases. -->

- [ ] Persistent store indicator in header (compact, set-once, "change" link)
- [ ] First-visit geolocation auto-selects nearest store with confirmation prompt
- [ ] Today page radical simplification (cone + flavor + description above fold, progressive disclosure)
- [ ] Week-ahead as collapsed section, not default-visible
- [ ] Multi-store glance row for today (if multiple stores saved)
- [ ] Contextual "Want this every day?" CTA linking to Get Updates
- [ ] Compare page: store x day grid (2-4 stores x 2-3 days) with rarity highlights
- [ ] Compare cell expansion (description, directions, historical pattern)
- [ ] Flavor family exclusion filter on Compare (no nuts, no mint, etc.)
- [ ] Nav consolidation from 11+ items to 4 (Today, Compare, Map, Fun)
- [ ] Clear nav labels replacing weather metaphor names
- [ ] Get Updates page consolidating Calendar/Widget/Siri/Alerts setup flows
- [ ] Map flavor family exclusion filter (toggle chips, exclude semantics)
- [ ] Fun page: quiz mode visual cards (not dropdown), image-based answers on mobile
- [ ] Mad Libs word selection UI (3 pre-populated + 1 write-in per blank)
- [ ] Old page redirects preserving query params (scoop, radar, calendar, widget, siri, alerts)
- [ ] Homepage visual coherence (consistent cone rendering, unified card system)
- [ ] Fronts accessible from Fun page as delight feature (no nav link)

### Out of Scope

<!-- Explicit boundaries. -->

- Worker/API layer changes — feature-complete for all four use cases, no new endpoints needed
- Store persistence mechanism changes — localStorage + URL override is correct, just needs UX polish
- Enrichment data pipeline changes — rarity, signals, patterns all working
- Quiz engine logic changes — archetype matching, trivia API, Mad Libs engine all work
- .ics feed endpoint changes — working, don't touch
- Widget/Siri/Alert integration changes — all functional, only consolidating setup pages
- Tidbyt app changes — separate repo, production, complete
- Analytics pipeline changes — ML models, batch forecasts, backfill scripts stable
- Test infrastructure restructuring — add tests for new pages, don't restructure existing
- User accounts/authentication — not needed, localStorage is sufficient
- Mobile native app — web-first

## Context

The codebase has evolved significantly — deep backend infrastructure was built (planner engine, certainty model, signals system, enrichment layer, 810+ Worker tests, 45 API modules) while the presentation layer remained largely unchanged from its original 11-page structure.

**Result:** The APIs and data layer are ready to support all four use cases. The work is almost entirely presentation-layer restructuring in the `docs/` directory (static HTML/CSS/JS served via GitHub Pages).

**Four use cases driving the restructure:**
1. **UC1 "Where should we go?"** — Family comparing 2-4 nearby stores across a few days (Compare page)
2. **UC2 "What's the flavor right now?"** — Quick glance at today's flavor (Today page + delivery channels)
3. **UC3 "What can I eat nearby?"** — Filtered discovery with dietary constraints (Map + Compare filters)
4. **UC4 "Make it fun"** — Quizzes, Mad Libs, games for family entertainment (Fun page)

**Design principles:**
1. Start with the answer (no blank pages, geolocate immediately)
2. Progressive disclosure (answer, then next question, then automation)
3. Delivery channels are setup flows, not features
4. Clarity over cleverness (functional nav labels, weather metaphor in branding only)
5. Mobile-first for decisions (Compare must work at 375px in the car)
6. Enrichment as contextual nudges, not dashboards
7. Store picker must get out of the way
8. Keep the personality (pixel art, weather metaphor branding, Milwaukee Easter eggs)

## Constraints

- **Hosting**: GitHub Pages for frontend (no build step, no SSR, static HTML/CSS/JS only)
- **API**: Cloudflare Worker — no changes to Worker code in this project
- **Mobile**: All decision-making views must work at 375px width
- **Compatibility**: Old URLs must redirect to new locations (no broken bookmarks)
- **No frameworks**: Vanilla JS with `window.CustardPlanner` global pattern, no React/Vue/etc.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Presentation-layer only | Backend is feature-complete; all gaps are UX/structure | -- Pending |
| Compare grid mobile layout | Leave to implementation — try and iterate | -- Pending |
| Get Updates as page vs drawer | Start simple (page), revisit if needed | -- Pending |
| 4-item nav (Today/Compare/Map/Fun) | Clarity over cleverness; weather metaphor stays in branding | -- Pending |
| No prediction/accuracy UI | Data is confirmed ~30 days out; prediction solves a non-problem | -- Pending |

---
*Last updated: 2026-03-07 after initialization*
