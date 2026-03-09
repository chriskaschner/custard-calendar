# Custard Calendar -- Site Restructuring

## What This Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores -- primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). The presentation layer has been restructured from 11 loosely connected pages to a focused product organized around 4 use cases (Today, Compare, Map, Fun), with persistent store selection, progressive disclosure, a 37-token design system, per-mode quiz theming, modular JS architecture (4-file IIFE pattern), and full offline support via service worker. The site is live at custard.chriskaschner.com.

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
- All CSS color and spacing values use design token variables -- v1.1
- Inline styles eliminated from fun.html, updates.html, quiz.html -- v1.1
- Site deployed and verified at custard.chriskaschner.com -- v1.1
- Quiz modes visually distinct with per-mode accent theming -- v1.1
- CI repo structure check passes with .planning/ -- v1.2
- All commits deployed to origin/main with smoke test verification -- v1.2
- SW registered on all user-facing pages with stores.json pre-cached -- v1.2
- Old pages redirect to correct destinations preserving query params -- v1.2
- Mad Libs chips use CSS classes with design tokens instead of inline styles -- v1.2
- planner-shared.js split into focused IIFE sub-modules preserving public API -- v1.2
- All Playwright tests pass after refactoring with no regressions -- v1.2
- Map flavor family exclusion filter with localStorage persistence -- v1.2
- Quiz image-based answer options on mobile -- v1.2
- Compare page multi-store side-by-side with isolated localStorage -- v1.2

### Active

- [ ] Hero cone PNGs for remaining ~136 flavors via existing sharp pipeline
- [ ] Consistent cone rendering tier across all flavors (no mixed Hero/HD display)

## Current Milestone: v1.3 Asset Parity

**Goal:** Every flavor renders at the same quality tier with a proper profile -- no more mixed Hero PNG vs HD SVG fallback on the same page.

**Target features:**
- Profile all ~136 unprofiled flavors in FLAVOR_PROFILES
- Regenerate hero cone PNGs for full catalog via sharp pipeline
- Fix quality issues on existing profiles that look off at Hero tier

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
- ES modules for refactoring -- too disruptive; IIFE namespace extension preserves existing patterns
- Shared exclusion state between Map and Compare -- different user intents on different pages
- Server-side redirects via Cloudflare Worker -- worker is out of scope; client-side redirects sufficient

## Context

Shipped v1.2 with ~368,889 lines across HTML/CSS/JS files. Static HTML/CSS/JS on GitHub Pages.
Tech stack: Cloudflare Worker (API), vanilla JS (4-file IIFE pattern), Playwright (browser tests), GitHub Pages (hosting).
810+ Worker tests, 32+ Playwright tests, 179 Python tests.

**Current state:**
- 15 HTML pages with shared navigation and store indicator
- 6 redirect stubs for legacy page URLs
- 4 primary nav destinations (Today, Compare, Map, Fun)
- Get Updates accessible via footer and contextual CTAs
- 37-token design system fully consumed across all CSS (no hardcoded colors/spacing)
- Per-mode quiz theming via data-quiz-mode attribute selectors (7 modes)
- Hero cone PNG pipeline for 40 profiled flavors with SVG fallback
- Modular JS: planner-shared.js facade (117 lines) + 3 sub-modules (data, domain, ui)
- Service worker v18 covering all pages with stores.json offline
- Map exclusion filter with localStorage persistence
- Quiz image grid on mobile for icon-bearing questions
- Compare page with isolated localStorage for multi-store selection
- Live at custard.chriskaschner.com

## Constraints

- **Hosting**: GitHub Pages for frontend (no build step, no SSR, static HTML/CSS/JS only)
- **API**: Cloudflare Worker -- no changes to Worker code
- **Mobile**: All decision-making views must work at 375px width
- **Compatibility**: Old URLs redirect to new locations (no broken bookmarks)
- **No frameworks**: Vanilla JS with `window.CustardPlanner` global pattern (4-file IIFE)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Presentation-layer only | Backend is feature-complete; all gaps are UX/structure | Good -- 26 plans, ~3 hours, zero API changes |
| IIFE module pattern | No build step on GitHub Pages, matches codebase conventions | Good -- all page modules use IIFE |
| Day-first card stack for Compare | Mobile-first at 375px, better than table columns | Good -- usable, tested at 375px |
| Get Updates as page (not drawer) | Simple, one URL, consolidates 4 setup flows | Good -- 5 UPDT requirements satisfied |
| 4-item nav (Today/Compare/Map/Fun) | Clarity over cleverness; fits 375px without hamburger | Good -- tested on all 15 pages |
| Worker /api/v1/geolocate proxy | Mixed-content and browser intercept issues with direct ip-api.com | Good -- clean HTTPS path |
| CustomEvent bridge (sharednav:storechange) | Cross-component communication without coupling | Good -- used by Today, Compare, index |
| SVG-to-PNG hero cone pipeline | Higher fidelity hero images, SVG fallback for unknowns | Good -- 40 PNGs, works well |
| Seasonal rarity suppression | Prevent misleading "overdue!" claims for seasonal flavors | Good -- isSeasonalFlavor() guard |
| Selector-context-aware CSS testing | Line-only pattern matching produces false positives | Good -- accurate detection of domain-specific sections |
| data-quiz-mode attribute theming | JS sets attribute, CSS responds with per-mode overrides | Good -- 7 modes, clean separation |
| Curl-based production smoke tests | Bypass service worker cache for reliable deploy verification | Good -- all 5 pages verified |
| CSS color-mix for derived accents | Project already uses modern CSS features | Good -- clean derived shades |
| Meta-refresh redirect stubs | Bare HTML (~410 bytes), no JS stack, preserves query params | Good -- minimal, works with bookmarks |
| 3-file monolith split | Balance between granularity and complexity; data/domain/ui separation | Good -- 60 exports preserved, zero regressions |
| Uniform sub-module loading | All 3 sub-modules on every page, no selective loading | Good -- simple, cache-friendly |
| Map exclusion (dimming not hiding) | 0.15 opacity preserves spatial context vs hiding markers | Good -- users see all stores |
| Page-scoped localStorage keys | Separate keys per page prevent cross-page state leaks | Good -- compare/map/preferences isolated |

---
*Last updated: 2026-03-09 after v1.3 milestone started*
