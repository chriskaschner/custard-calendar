# Requirements: Custard Calendar v1.2

**Defined:** 2026-03-09
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go

## v1.2 Requirements

Requirements for v1.2 Feature Completion & Cleanup. Each maps to roadmap phases.

### Infrastructure

- [x] **INFR-01**: CI repo structure check passes with .planning/ included in REPO_CONTRACT.md
- [x] **INFR-02**: All commits pushed to origin/main and deployment verified at custard.chriskaschner.com
- [x] **INFR-03**: Service worker registered on fun.html and updates.html
- [x] **INFR-04**: stores.json included in SW pre-cache for offline access

### Redirects

- [x] **RDIR-01**: Old pages (scoop, radar, calendar, widget, siri, alerts) redirect to correct destinations
- [x] **RDIR-02**: Redirects preserve query parameters and hash fragments from bookmarked URLs

### Design System

- [x] **DSGN-01**: Mad Libs chip elements use CSS classes with design tokens instead of inline styles

### Architecture

- [x] **ARCH-01**: planner-shared.js split into focused modules preserving window.CustardPlanner public API
- [x] **ARCH-02**: All existing Playwright tests pass after refactoring with no regressions

### Map

- [ ] **MAP-01**: User can filter map markers by flavor family using exclusion chips
- [ ] **MAP-02**: Map exclusion filter state persists across page loads via localStorage

### Quiz

- [ ] **QUIZ-01**: User sees image-based answer options for quiz questions on mobile

### Compare

- [x] **CMPR-01**: User can compare flavors across multiple stores side-by-side

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Asset Pipeline

- **CONE-01**: Hero cone PNGs generated for remaining ~136 flavors via existing sharp pipeline

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ES modules for refactoring | Too disruptive; IIFE namespace extension preserves existing patterns |
| Shared exclusion state between Map and Compare | Different user intents on different pages |
| Server-side redirects via Cloudflare Worker | Worker is out of scope; client-side redirects sufficient |
| Horizontal scroll comparison table | Rejected in v1.0 for 375px; day-first card stack works |
| Worker/API changes | Backend is feature-complete |
| Dark mode toggle | Ship light, respect prefers-color-scheme later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 9 | Complete |
| INFR-02 | Phase 9 | Complete |
| INFR-03 | Phase 9 | Complete |
| INFR-04 | Phase 9 | Complete |
| RDIR-01 | Phase 10 | Complete |
| RDIR-02 | Phase 10 | Complete |
| DSGN-01 | Phase 10 | Complete |
| ARCH-01 | Phase 11 | Complete |
| ARCH-02 | Phase 11 | Complete |
| MAP-01 | Phase 12 | Pending |
| MAP-02 | Phase 12 | Pending |
| QUIZ-01 | Phase 12 | Pending |
| CMPR-01 | Phase 12 | Complete |

**Coverage:**
- v1.2 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
