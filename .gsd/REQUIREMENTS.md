# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R011 — Widget bootstrap: one-copy-paste install with store slug pre-configured
- Class: primary-user-loop
- Status: active
- Description: widget.html generates a short (~10 line) personalized bootstrap snippet with the user's store slug baked in. User copies it once into Scriptable, runs it, and the full widget script is automatically downloaded, saved, and configured. No manual Parameter field entry.
- Why it matters: The current 5-step, 3-copy-paste flow with manual code navigation actively turns away non-technical users. This is the single biggest friction point in the widget funnel.
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: Contract verified — widget.html generates personalized bootstrap snippet with store slug; 1109 Worker tests pass. UAT pending: real iOS device paste-and-run.
- Notes: Requires a Worker endpoint to serve the full widget script. Bootstrap must handle naming the script and saving it to the Scriptable directory.

### R012 — Widget multi-store setup without manual code editing
- Class: primary-user-loop
- Status: active
- Description: Multi-store widget mode is configured entirely through the widget.html UI — user picks 2-3 stores, gets a ready-to-go bootstrap snippet with MODE and slugs pre-configured. No editing of JS source code.
- Why it matters: Multi-store mode currently requires editing the script source to add `MODE="multi"` and a `slugs` array — a developer-only operation that no regular user would attempt.
- Source: user
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: Contract verified — widget.html multi-store mode toggle generates snippet with MODE="multi" and slugs array (up to 3 stores). UAT pending: real iOS device multi-store install.
- Notes: Bootstrap snippet must include both MODE and slugs configuration.

### R013 — Widget self-update from API
- Class: continuity
- Status: active
- Description: The installed widget script can update itself from the Custard Calendar API without requiring the user to re-paste code. Updates happen automatically (on run or periodically) and preserve the user's store configuration.
- Why it matters: The current widget requires manual re-paste of 628 lines whenever the script is updated. Users with the old version silently miss improvements and bug fixes.
- Source: inferred
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: Contract verified — WIDGET_VERSION constant + fire-and-forget checkForUpdate() in widget JS; /api/v1/widget/version returns version JSON; 16 widget-routes tests pass. Uses alert-not-overwrite pattern (D007). UAT pending: version mismatch alert on real device.
- Notes: Self-update uses version-check-and-alert (not auto-overwrite). User is directed to widget.html to re-run bootstrap with updated code.

### R015 — PNG og:image on all pages
- Class: launchability
- Status: active
- Description: All 8 pages currently using SVG og:image meta tags are migrated to PNG endpoints. When any page URL is shared on Twitter, Facebook, iMessage, WhatsApp, Discord, or Slack, a real 1200×630 preview image renders.
- Why it matters: SVG og:image is universally unsupported by social platforms. Every shared link currently previews as a blank card, completely undermining shareability — one of the project's validated capabilities.
- Source: user
- Primary owning slice: M004/S03
- Supporting slices: none
- Validation: unmapped
- Notes: Requires converting the SVG renderPageCard function to a PNG renderer using workers-og (ImageResponse). The pattern is already proven by quiz and flavor rarity PNG cards. Affected pages: index, compare, updates, map, quiz, group, fun, widget.

### R016 — Widget JS file sync automation
- Class: operability
- Status: active
- Description: The manual copy step between `widgets/custard-today.js` (canonical source) and `docs/assets/custard-today.js` is replaced by either automated sync or a CI gate that detects divergence.
- Why it matters: Any edit to one file without copying to the other causes widget behavior divergence between the GitHub Pages-served version and the canonical source. This has been flagged in KNOWLEDGE.md as a recurring risk.
- Source: user
- Primary owning slice: M004/S04
- Supporting slices: none
- Validation: unmapped
- Notes: Could be a CI check (diff + fail), a pre-commit hook, or a build script. CI check is simplest and lowest friction.

### R017 — Worker endpoint to serve widget bootstrap script
- Class: integration
- Status: active
- Description: A Worker API endpoint serves the full widget script (or a customized version) so the bootstrap snippet can download it programmatically. Endpoint should support query parameters for store slug and mode configuration.
- Why it matters: The bootstrap approach requires a stable, versioned URL where the full widget script lives. Serving from the Worker (rather than raw GitHub) gives us cache control, versioning, and the ability to inject configuration.
- Source: inferred
- Primary owning slice: M004/S01
- Supporting slices: none
- Validation: Contract verified — GET /api/v1/widget/script returns text/javascript with 24h cache-control; GET /api/v1/widget/version returns JSON with 1h cache; rate-limited at 60/h and 120/h; 16 vitest tests pass.
- Notes: Server endpoint is stateless — serves canonical JS unchanged. Config injection is client-side (D006).

## Validated

### R014 — Rarity threshold unification across all surfaces
- Status: validated
- Class: quality-attribute
- Source: user
- Primary owning slice: M004/S02
- Validation: Contract verified — all three files (route-today.js, social-card.js, planner-domain.js) use identical > 150 / > 90 thresholds. 13-assertion boundary-value test in rarity-threshold-consistency.test.js prevents drift. rarityLabel(130) → 'Rare' everywhere. 1122 Worker tests pass.
- Notes: Standardized on 150/90 (D005). social-card.js was the outlier at 120/60, now aligned.

### SIMP-01 — Zero-traffic pages consolidated or redirected
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S03
- Validation: validated
- Notes: forecast-map.html replaced with redirect stub. compare.html and fun.html kept per D004.

### SIMP-02 — Navigation reflects reduced page count with no more than 4 items
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S03
- Validation: validated
- Notes: Nav has exactly 4 items (Today, Compare, Map, Fun). Trivially satisfied.

### SHARE-01 — Quiz results shareable with optimized og:image
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S05
- Validation: validated
- Notes: PNG og:image via /og/quiz/{archetype}/{flavor}.png. Crawler interception active.

### SHARE-02 — Flavor rarity stats shareable as social content
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S05
- Validation: validated
- Notes: PNG og:image via /og/flavor/{flavor-name}.png. Week strip share icons.

### HOME-01 — Single primary card with today's flavor above the fold
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S04
- Validation: validated

### HOME-02 — Week-ahead section collapsed by default
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S04
- Validation: validated

### HOME-03 — No visible layout shift during data load (CLS < 0.1)
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S04
- Validation: validated

### HOME-04 — Unified visual language across homepage sections
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S04
- Validation: validated

### SIMP-03 — ML prediction roadmap formally closed
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S01
- Validation: validated

### PERF-01 — LCP P90 under 3 seconds
- Status: validated
- Class: core-capability
- Source: inferred
- Primary owning slice: M002/S04
- Validation: validated

## Deferred

### R018 — Dark mode via prefers-color-scheme
- Class: quality-attribute
- Status: deferred
- Description: Automatic dark mode support using CSS custom property overrides in a prefers-color-scheme: dark media query.
- Why it matters: Users browsing at night or with system dark mode get a jarring bright page. The design token system is 85% ready (79 variables, 670 usages) but ~115 hardcoded color values remain.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: User explicitly deferred. Revisit when the 115 hardcoded colors are audited.

## Out of Scope

### R019 — Push notifications
- Class: constraint
- Status: out-of-scope
- Description: Native or web push notifications for flavor alerts.
- Why it matters: Prevents scope confusion — email alerts and calendar subscriptions already serve this need.
- Source: user
- Validation: n/a

### R020 — ES modules refactor
- Class: constraint
- Status: out-of-scope
- Description: Migrating IIFE pattern to ES modules.
- Why it matters: Too architecturally disruptive for GitHub Pages (no build step). IIFE pattern is established and working.
- Source: user
- Validation: n/a

### R021 — Native mobile app
- Class: constraint
- Status: out-of-scope
- Description: iOS or Android native app.
- Why it matters: Web-first approach with Scriptable widget covers iOS. No validated user demand for native.
- Source: user
- Validation: n/a

### R022 — User accounts / authentication
- Class: constraint
- Status: out-of-scope
- Description: User accounts, login, or server-side preference storage.
- Why it matters: localStorage is sufficient. Accounts add friction with no validated benefit.
- Source: user
- Validation: n/a

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R011 | primary-user-loop | active | M004/S01 | none | contract verified, UAT pending |
| R012 | primary-user-loop | active | M004/S01 | none | contract verified, UAT pending |
| R013 | continuity | active | M004/S01 | none | contract verified, UAT pending |
| R014 | quality-attribute | validated | M004/S02 | none | contract verified, test gate |
| R015 | launchability | active | M004/S03 | none | unmapped |
| R016 | operability | active | M004/S04 | none | unmapped |
| R017 | integration | active | M004/S01 | none | contract verified, UAT pending |
| SIMP-01 | core-capability | validated | M002/S03 | none | validated |
| SIMP-02 | core-capability | validated | M002/S03 | none | validated |
| SHARE-01 | core-capability | validated | M002/S05 | none | validated |
| SHARE-02 | core-capability | validated | M002/S05 | none | validated |
| HOME-01 | core-capability | validated | M002/S04 | none | validated |
| HOME-02 | core-capability | validated | M002/S04 | none | validated |
| HOME-03 | core-capability | validated | M002/S04 | none | validated |
| HOME-04 | core-capability | validated | M002/S04 | none | validated |
| SIMP-03 | core-capability | validated | M002/S01 | none | validated |
| PERF-01 | core-capability | validated | M002/S04 | none | validated |
| R018 | quality-attribute | deferred | none | none | unmapped |
| R019 | constraint | out-of-scope | none | none | n/a |
| R020 | constraint | out-of-scope | none | none | n/a |
| R021 | constraint | out-of-scope | none | none | n/a |
| R022 | constraint | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 6
- Mapped to slices: 6
- Validated: 11
- Unmapped active requirements: 0
