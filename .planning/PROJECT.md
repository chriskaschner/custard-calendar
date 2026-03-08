# Custard Calendar -- Site Restructuring

## What This Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores -- primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). The backend/API layer is feature-complete. The presentation layer has been restructured from 11 loosely connected pages to a focused product organized around 4 use cases with clear navigation (Today, Compare, Map, Fun), persistent store selection, and progressive disclosure.

## Core Value

A family in the car (or on the couch) can instantly see what flavors are at their nearby stores and decide where to go -- no friction, no hunting through pages.

## Requirements

### Validated

- Store indicator with geolocation and persistent store selection -- v1.0
- Today page: flavor above the fold at 375px, rarity tags, multi-store row, progressive disclosure -- v1.0
- Compare page: store-by-day grid, accordion expand, exclusion filters, mobile card stack -- v1.0
- Fun page: quiz mode cards, Mad Libs, Group Vote, Fronts -- v1.0
- Get Updates page: consolidated Calendar/Widget/Siri/Alerts setup, inline alert signup -- v1.0
- 4-item nav (Today, Compare, Map, Fun) with functional labels on every page -- v1.0
- Unified card system with design tokens and seasonal rarity suppression -- v1.0
- Hero cone PNG pipeline with SVG fallback -- v1.0

### Active

- [ ] Old page redirects preserving query params (scoop, radar, calendar, widget, siri, alerts) -- RDIR-01..03
- [ ] Map flavor family exclusion filter -- MAPE-01..02
- [ ] Quiz image-based answer options on mobile -- FUNP-01
- [ ] Quiz mode visual differentiation -- FUNP-02
- [ ] Design token consumption across all CSS rules (tech debt from v1.0)
- [ ] Hero cone PNGs for remaining ~136 flavors (tech debt from v1.0)

### Out of Scope

- Worker/API layer changes -- feature-complete for all four use cases
- User accounts/authentication -- localStorage sufficient, accounts add friction
- Mobile native app -- web-first, PWA works well
- Push notifications -- email alerts and calendar subs already serve this
- Dark mode toggle -- ship light, respect prefers-color-scheme later
- Hamburger menu -- 4 items fit at 375px, visible nav outperforms hidden
- Analytics/stats dashboard -- enrichment as contextual nudges, not dashboards
- Social features/sharing/reviews -- no transaction layer
- Distance radius slider on map -- users think in "stores I'd drive to" not miles

## Context

Shipped v1.0 with 12,592 lines across 63 files. Static HTML/CSS/JS on GitHub Pages.
Tech stack: Cloudflare Worker (API), vanilla JS (IIFE pattern), Playwright (browser tests), GitHub Pages (hosting).
810+ Worker tests, 32+ Playwright tests, 179 Python tests.

**Current state:**
- 15 HTML pages with shared navigation and store indicator
- 4 primary nav destinations (Today, Compare, Map, Fun)
- Get Updates accessible via footer and contextual CTAs
- Unified .card component system with design tokens defined
- Hero cone PNG pipeline for 40 profiled flavors with SVG fallback

## Constraints

- **Hosting**: GitHub Pages for frontend (no build step, no SSR, static HTML/CSS/JS only)
- **API**: Cloudflare Worker -- no changes to Worker code
- **Mobile**: All decision-making views must work at 375px width
- **Compatibility**: Old URLs must redirect to new locations (no broken bookmarks)
- **No frameworks**: Vanilla JS with `window.CustardPlanner` global pattern

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Presentation-layer only | Backend is feature-complete; all gaps are UX/structure | Good -- 15 plans, 2 hours, zero API changes |
| IIFE module pattern | No build step on GitHub Pages, matches codebase conventions | Good -- shared-nav.js, today-page.js, compare-page.js, fun-page.js, updates-page.js all IIFE |
| Day-first card stack for Compare | Mobile-first at 375px, better than table columns | Good -- usable, tested at 375px |
| Get Updates as page (not drawer) | Simple, one URL, consolidates 4 setup flows | Good -- 5 UPDT requirements satisfied |
| 4-item nav (Today/Compare/Map/Fun) | Clarity over cleverness; fits 375px without hamburger | Good -- tested on all 15 pages |
| Worker /api/v1/geolocate proxy | Mixed-content and browser intercept issues with direct ip-api.com | Good -- clean HTTPS path |
| CustomEvent bridge (sharednav:storechange) | Cross-component communication without coupling | Good -- used by Today, Compare, index |
| SVG-to-PNG hero cone pipeline | Higher fidelity hero images, SVG fallback for unknowns | Good -- 40 PNGs, works well |
| Seasonal rarity suppression | Prevent misleading "overdue!" claims for seasonal flavors | Good -- isSeasonalFlavor() guard |
| Phase 2+3 parallel execution | Both depend only on Phase 1, no interdependency | Good -- saved time |

---
*Last updated: 2026-03-08 after v1.0 milestone*
