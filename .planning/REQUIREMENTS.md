# Requirements: Custard Calendar

**Defined:** 2026-03-08
**Core Value:** A family can instantly see what flavors are at their nearby stores and decide where to go

## v1.1 Requirements

Requirements for production launch and polish. Each maps to roadmap phases.

### Deployment

- [ ] **DEPL-01**: Site is live at custard.chriskaschner.com with all v1.0 changes deployed
- [ ] **DEPL-02**: Cloudflare Worker is deployed with current API routes
- [ ] **DEPL-03**: Live site passes smoke test (nav, today page, compare, fun, updates)

### Design Tokens

- [ ] **TOKN-01**: All CSS color values use design token variables
- [ ] **TOKN-02**: All CSS spacing values use design token variables
- [ ] **TOKN-03**: Inline styles in fun.html and updates.html converted to token variables

### Quiz Polish

- [ ] **QUIZ-01**: Quiz modes are visually distinct from each other (unique styling per mode)

## Future Requirements

Deferred from v1.1. Tracked for future milestones.

### Redirects

- **RDIR-01**: Old page URLs redirect to new locations preserving query params
- **RDIR-02**: scoop, radar, calendar, widget, siri, alerts pages redirect correctly
- **RDIR-03**: Redirect responses use appropriate HTTP status codes

### Map

- **MAPE-01**: Flavor family exclusion filter on forecast map
- **MAPE-02**: Filter state persists across page visits

### Quiz

- **FUNP-01**: Quiz uses image-based answer options on mobile

### Tech Debt

- **DEBT-01**: Hero cone PNGs generated for remaining ~136 flavors
- **DEBT-02**: SW registered on fun.html and updates.html
- **DEBT-03**: planner-shared.js refactored from 1,624-line monolith

## Out of Scope

| Feature | Reason |
|---------|--------|
| Worker/API changes | Feature-complete for all use cases |
| User accounts | localStorage sufficient, accounts add friction |
| Mobile native app | Web-first, PWA works well |
| Dark mode toggle | Ship light, respect prefers-color-scheme later |
| Analytics dashboard | Enrichment as contextual nudges, not dashboards |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPL-01 | Phase 7 | Pending |
| DEPL-02 | Phase 7 | Pending |
| DEPL-03 | Phase 7 | Pending |
| TOKN-01 | Phase 6 | Pending |
| TOKN-02 | Phase 6 | Pending |
| TOKN-03 | Phase 6 | Pending |
| QUIZ-01 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after roadmap creation*
