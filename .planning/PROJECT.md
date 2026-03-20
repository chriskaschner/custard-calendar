# Custard Calendar -- Site Restructuring

## What This Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores -- primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). The presentation layer has been restructured from 11 loosely connected pages to a focused product organized around 4 use cases (Today, Compare, Map, Fun), with persistent store selection, progressive disclosure, a 37-token design system, per-mode quiz theming, modular JS architecture (4-file IIFE pattern), full offline support via service worker, and consistent Hero cone PNG rendering for all 94 profiled flavors with alias resolution. The site is live at custard.chriskaschner.com.

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
- Hero cone PNGs for all 94 profiled flavors via sharp pipeline -- v1.3
- Consistent cone rendering tier across all flavors (no mixed Hero/HD display) -- v1.3
- CI palette sync gate catches color drift across 4 sync files -- v1.3
- WCAG 3:1 contrast checker for all topping/base combinations -- v1.3
- Pixelmatch golden baselines for visual regression detection -- v1.3
- 94 FLAVOR_PROFILES with base/ribbon/toppings/density covering full catalog -- v1.3
- 37 FLAVOR_ALIASES resolving variant/duplicate/historical names -- v1.3
- Service worker cache v19 ensuring fresh PNG delivery -- v1.3
- Today page hides onboarding banner when store is already selected -- v1.4
- Compare page initializes with single geolocated store, not multiple nearby stores -- v1.4
- Map centers on user's actual GPS position with three-tier fallback -- v1.4
- Map shows nearest store with highlighted marker and "Nearest to you" badge -- v1.4
- Map displays "you are here" dot at user's precise GPS coordinates -- v1.4

- State tokens, card/button unification, inline style elimination across all pages -- v1.5
- Compare page first-load UX fix with SharedNav suppression and single-store init -- v1.5
- Canonical 5-shape topping vocabulary with scatter placement across all cone tiers -- v1.5
- HD and Hero cone renderers upgraded to Mulberry32 PRNG + collision detection -- v1.5
- 94 Hero cone PNGs regenerated with SW cache v20 -- v1.5

- Two-tier art pipeline: L0 micro SVG + L5 AI-generated PNGs for all 94 flavors -- v2.0
- All client/server/widget surfaces migrated to shared L5 PNG art pipeline -- v2.0
- Dead HD/Hero/Premium SVG renderers removed (~990 lines deleted) -- v2.0
- Scriptable widget unified into shared art pipeline with canonical 23-color palette -- v2.0

- ML prediction pipeline formally closed (Won't Do with rationale); TODO.md backlog triaged to reflect reality -- v3.0 Phase 30
- Homepage redesigned around single hero card with CTAs, simplified empty state, CLS skeleton; signals/multi-store/header removed -- v3.0 Phase 31
- localStorage hero cache + SW API stale-while-revalidate for instant return-visit render; Lighthouse LCP gate pending post-deploy -- v3.0 Phase 33

### Active

## Current Milestone: v3.0 Sharpen the Core

**Goal:** Simplify the product to its essential experience, fix performance, and optimize for discoverability -- the first milestone focused on finding users rather than adding features.

**Target features:**
- Redesign homepage with clear information hierarchy (one card: your store's flavor today)
- Consolidate zero-traffic pages and simplify navigation
- Fix LCP cold-start performance (P90 from 10s to <3s)
- Eliminate layout shift during page load (CLS <0.1)
- Optimize quiz/flavor content for social sharing

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
- Premium tier cone rendering -- removed in v2.0
- Test cleanup (dead skipped tests) -- carried from v1.5 Phase 25, low priority
- ML prediction pipeline improvements (ensemble, XGBoost, confidence intervals) -- 3.2% accuracy not useful; confirmed data IS the product
- New quiz modes -- 7 modes sufficient, polish over expansion
- New API endpoints -- 27+ is sufficient surface area
- Feature additions before finding 10 real users -- distribution before features

## Context

Shipped v1.4 with ~371,275 lines across HTML/CSS/JS files. Static HTML/CSS/JS on GitHub Pages.
Tech stack: Cloudflare Worker (API), vanilla JS (4-file IIFE pattern), Playwright (browser tests), GitHub Pages (hosting).
1,351 Worker tests, 49+ Playwright tests (17 new in v1.4), 179 Python tests.

**Current state:**
- 15 HTML pages with shared navigation and store indicator
- 6 redirect stubs for legacy page URLs
- 4 primary nav destinations (Today, Compare, Map, Fun)
- Get Updates accessible via footer and contextual CTAs
- 37-token design system fully consumed across all CSS (no hardcoded colors/spacing)
- Per-mode quiz theming via data-quiz-mode attribute selectors (7 modes)
- 94 Hero cone PNGs with alias resolution and SVG fallback for unknown flavors
- 56-color palette (23 base + 33 topping) with CI sync gate across 4 files
- 94 FLAVOR_PROFILES + 37 FLAVOR_ALIASES = zero unprofiled flavors
- Pixelmatch golden baselines (376 tests) + contrast checker (132 tests)
- Modular JS: planner-shared.js facade (117 lines) + 3 sub-modules (data, domain, ui)
- Service worker v19 covering all pages with stores.json offline
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
| SVG-to-PNG hero cone pipeline | Higher fidelity hero images, SVG fallback for unknowns | Good -- 94 PNGs, full catalog |
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
| 300 DPI supersample + nearest-neighbor resize | Pixel-art-safe rasterization without blur artifacts | Good -- crisp at 144x168 native |
| Zero-tolerance pixelmatch threshold | Deterministic seeded PRNG means any pixel diff is real | Good -- catches genuine regressions |
| FLAVOR_ALIASES with cascading resolution | exact -> normalize -> alias -> keyword -> default | Good -- zero unprofiled flavors |
| Clean-slate PNG regeneration | Delete all 40 old PNGs, regenerate 94 from updated profiles | Good -- consistent quality baseline |
| FALLBACK_FLAVOR_ALIASES in cone-renderer.js | Client-side alias copy avoids API dependency for alias resolution | Good -- works offline, 37/37 in sync |
| Synchronous localStorage guard before async load | Prevents onboarding banner flash for returning users | Good -- zero flash, 4 tests |
| MIN_COMPARE_STORES lowered to 1 | Single geolocated store renders grid immediately with add-more hint | Good -- matches user intent |
| Permissions API gating for GPS | Skip GPS entirely when denied (instant fallback) | Good -- fast path for denied users |
| Position dot interactive:false + zIndexOffset:1000 | Stays above store markers without intercepting clicks | Good -- clean UX |
| Nearest store by slug cross-reference | Links marker highlighting to results badge without marker refs | Good -- clean separation |
| SW mock (no-op sw.js) for Playwright tests | SW intercepts page-level route handlers; mock prevents registration | Good -- reliable test mocking |

---
*Last updated: 2026-03-20 after Phase 33 (Performance) complete*
