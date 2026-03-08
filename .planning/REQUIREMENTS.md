# Requirements: Custard Calendar Restructuring

**Defined:** 2026-03-07
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go

## v1 Requirements

Requirements for the presentation-layer restructure. Each maps to roadmap phases.

### Navigation

- [x] **NAV-01**: User sees 4 clear nav items (Today, Compare, Map, Fun) on every page
- [x] **NAV-02**: Nav labels are functional words, not weather metaphor names
- [x] **NAV-03**: "Get Updates" is accessible via footer link or contextual CTA, not primary nav
- [x] **NAV-04**: Nav fits at 375px width without hamburger menu or overflow

### Store Experience

- [x] **STOR-01**: First-time visitor is geolocated to nearest store automatically on page load
- [x] **STOR-02**: First-visit geolocation shows confirmation prompt ("Showing flavors for [store] -- change?")
- [x] **STOR-03**: User sees compact store indicator in header showing current store name and city
- [x] **STOR-04**: User can tap "change" on store indicator to open full store picker on demand
- [x] **STOR-05**: Store selection persists across pages via existing localStorage mechanism

### Today Page

- [x] **TDAY-01**: User sees today's flavor at their store above the fold at 375px (cone image, flavor name, description)
- [x] **TDAY-02**: Rarity tag displays on today's flavor card when the flavor is rare
- [x] **TDAY-03**: Week-ahead section is a collapsed `<details>` element, not visible by default
- [x] **TDAY-04**: If user has multiple stores saved, a compact multi-store row shows today's flavor at each
- [x] **TDAY-05**: One contextual flavor signal displays inline when relevant (e.g., "peaks on Sundays")
- [x] **TDAY-06**: "Want this every day?" CTA links to Get Updates page
- [x] **TDAY-07**: Page does not contain Drive ranking cards, hero card duplication, calendar preview, mini-map, or score badges

### Compare Page

- [x] **COMP-01**: User sees a grid of their saved stores (2-4) across next 2-3 days
- [x] **COMP-02**: Each grid cell shows cone image, flavor name, and rarity tag if rare
- [x] **COMP-03**: User can tap any grid cell to expand it showing full description, directions link, and historical pattern
- [x] **COMP-04**: Rare flavor cells have a visual highlight ("only every 400 days!")
- [x] **COMP-05**: Flavor family exclusion filter chips above grid (No Nuts, No Mint, etc.)
- [x] **COMP-06**: Toggling an exclusion chip hides stores/cells with matching flavors
- [x] **COMP-07**: Grid is usable at 375px width (scroll-snap, swipeable cards, or equivalent mobile pattern)
- [x] **COMP-08**: Data comes from existing `/api/v1/drive` endpoint (no new API endpoints)

### Fun Page

- [x] **FUN-01**: Quiz modes displayed as visual cards with name and one-line description, not a dropdown
- [x] **FUN-02**: Mad Libs mode offers 3 pre-populated word choices + 1 write-in option per blank
- [x] **FUN-03**: Quiz results map to actually-available nearby flavors with store CTAs
- [x] **FUN-04**: Group Vote is accessible from Fun page as a card or section
- [x] **FUN-05**: Fronts (flavor weather map) is accessible from Fun page, no primary nav link

### Get Updates

- [x] **UPDT-01**: Single page consolidates setup flows for Calendar, Widget, Siri, and Alerts
- [x] **UPDT-02**: Each channel shows brief description and setup instructions
- [x] **UPDT-03**: Alert signup form works inline on the page (not a redirect)
- [x] **UPDT-04**: Store context carries from referring page (pre-fills store if user came from Today)
- [x] **UPDT-05**: Contextual "Want this every day?" CTAs on Today and Compare link to this page

### Visual Polish

- [ ] **VIZP-01**: Consistent cone rendering tier used across all homepage elements
- [x] **VIZP-02**: Unified card system with shared border, background, spacing, and typography
- [x] **VIZP-03**: Rarity/overdue copy accounts for seasonality (suppress misleading cadence claims for seasonal flavors)
- [ ] **VIZP-04**: Cone asset quality pipeline from low-res Tidbyt tier up to hero-level pixel art per context

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Redirects

- **RDIR-01**: Old page URLs (scoop, radar, calendar, widget, siri, alerts) redirect to new locations preserving query params
- **RDIR-02**: Redirects use JS `location.replace()` for query param preservation (not meta-refresh)
- **RDIR-03**: Old pages show "This page has moved" banner with link to new location

### Map Enhancement

- **MAPE-01**: Flavor family exclusion filter toggle chips on map view
- **MAPE-02**: Exclusion chips work alongside existing brand filter (additive filtering)

### Fun Page Polish

- **FUNP-01**: Image-based answer options on mobile (cone/image cards instead of text grids)
- **FUNP-02**: Quiz mode visual differentiation (each mode feels distinct)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Worker/API layer changes | Feature-complete for all four use cases |
| Prediction/accuracy dashboard | Data is confirmed ~30 days out; prediction solves a non-problem |
| User accounts / authentication | localStorage sufficient; accounts add friction and compliance burden |
| Analytics/stats page | Enrichment as contextual nudges, not dashboards |
| AI-powered recommendations | 176 flavors is too small a dataset; rarity scoring IS the recommendation |
| Social features / sharing / reviews | No transaction layer; the data IS the social proof |
| Push notifications | Email alerts and calendar subs already serve this; push adds complexity |
| Loyalty/points/rewards | No transaction to reward; quizzes and rarity are the gamification |
| Dark mode toggle | Adds CSS complexity; ship light, respect prefers-color-scheme later |
| Hamburger menu | 4 items fit at 375px; visible nav outperforms hidden nav |
| Distance radius slider on map | Users think in "stores I'd drive to" not miles; zoom-and-pan is the control |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 1 | Complete (01-01) |
| STOR-02 | Phase 1 | Complete (01-01) |
| STOR-03 | Phase 1 | Complete (01-01) |
| STOR-04 | Phase 1 | Complete (01-01) |
| STOR-05 | Phase 1 | Complete (01-01) |
| TDAY-01 | Phase 2 | Complete |
| TDAY-02 | Phase 2 | Complete |
| TDAY-03 | Phase 2 | Complete |
| TDAY-04 | Phase 2 | Complete |
| TDAY-05 | Phase 2 | Complete |
| TDAY-06 | Phase 2 | Complete |
| TDAY-07 | Phase 2 | Complete |
| COMP-01 | Phase 3 | Complete |
| COMP-02 | Phase 3 | Complete |
| COMP-03 | Phase 3 | Complete |
| COMP-04 | Phase 3 | Complete |
| COMP-05 | Phase 3 | Complete |
| COMP-06 | Phase 3 | Complete |
| COMP-07 | Phase 3 | Complete |
| COMP-08 | Phase 3 | Complete |
| FUN-01 | Phase 4 | Complete |
| FUN-02 | Phase 4 | Complete |
| FUN-03 | Phase 4 | Complete |
| FUN-04 | Phase 4 | Complete |
| FUN-05 | Phase 4 | Complete |
| UPDT-01 | Phase 4 | Complete |
| UPDT-02 | Phase 4 | Complete |
| UPDT-03 | Phase 4 | Complete |
| UPDT-04 | Phase 4 | Complete |
| UPDT-05 | Phase 4 | Complete |
| NAV-01 | Phase 4 | Complete |
| NAV-02 | Phase 4 | Complete |
| NAV-03 | Phase 4 | Complete |
| NAV-04 | Phase 4 | Complete |
| VIZP-01 | Phase 5 | Pending |
| VIZP-02 | Phase 5 | Complete |
| VIZP-03 | Phase 5 | Complete |
| VIZP-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
