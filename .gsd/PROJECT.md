# Custard Calendar — Polish, Debt, and Widget Fix

## What This Is

Custard Calendar tracks daily "Flavor of the Day" schedules across 1,000+ frozen custard stores — primarily Culver's nationwide, plus Milwaukee-area independents (Kopp's, Gille's, Hefner's, Kraverz, Oscar's). The site is live at custard.chriskaschner.com with 4 primary nav destinations (Today, Compare, Map, Fun), a Scriptable iOS widget, calendar subscriptions, email alerts, and social sharing.

## Core Value

A family in the car (or on the couch) can instantly see what flavors are at their nearby stores and decide where to go — no friction, no hunting through pages.

## Current State

Three milestones complete (M001–M003). The product is shipped and live with:
- 15 HTML pages, 6 redirect stubs, 4-item nav
- 37-token design system, 94 Hero cone PNGs, 56-color palette
- Cloudflare Worker API (27+ endpoints, 1351+ tests)
- Scriptable iOS widget (small/medium/multi-store modes)
- Service worker v27, Playwright browser tests, Python pipeline
- Full telemetry, email alerts, weekly digests, quiz modes

Known issues being addressed in M004:
- ~~Widget setup flow requires multiple copy-paste operations and manual code editing~~ → S01 complete: one-paste bootstrap flow with snippet generator
- SVG og:image meta tags render blank on all social platforms
- Rarity threshold divergence between surfaces
- Widget JS dual-file manual sync (now three-file sync with embedded WIDGET_SCRIPT)

## Architecture / Key Patterns

- **Hosting:** GitHub Pages (static HTML/CSS/JS, no build step, no SSR)
- **API:** Cloudflare Worker with KV + D1 storage
- **JS pattern:** Vanilla JS, 4-file IIFE (`planner-shared.js` facade + 3 sub-modules)
- **Widget:** Scriptable iOS app, plain JS fetching from Worker API
- **Design system:** 79 CSS custom properties, consumed 670 times across stylesheets
- **Art pipeline:** L5 AI-generated PNGs for all 94 profiled flavors
- **OG cards:** workers-og (satori + resvg-wasm) for PNG; legacy SVG endpoints exist but broken for social sharing

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001: Prior Milestones (v1.0–v2.0) — site structure, nav, design system, cone art pipeline
- [x] M002: Sharpen the Core — homepage redesign, page consolidation, performance, social sharing
- [x] M003: Widget Polish — widget cone art, setup page, legacy cleanup
- [ ] M004: Widget Bootstrap & Debt Cleanup — one-paste widget install, PNG OG cards, rarity unification
