# T01: 31-homepage-redesign 01

**Slice:** S02 — **Milestone:** M002

## Description

Redesign the homepage hero card to be a complete decision-making unit (flavor + rarity + action CTAs + store meta) and the only content above the fold. Strip the page header, simplify the empty state to a minimal prompt, add a CLS-preventing skeleton with cone placeholder, and wire action CTAs into the hero card.

Purpose: HOME-01 requires the hero card above fold with full decision info. HOME-02 requires week-ahead collapsed by default. HOME-03 requires zero layout shift. HOME-04 requires unified card system usage. This plan delivers the primary content area and ensures the week-ahead details element has no open attribute.
Output: Redesigned index.html with hero card, skeleton, empty state, and error state. Updated today-page.js with CTAs and meta footer. Updated style.css with skeleton cone placeholder.

## Must-Haves

- [ ] "Returning user with saved store sees hero card with flavor name, cone art, description, rarity badge, action CTAs, and store meta -- all above the fold at 375px"
- [ ] "First-visit user sees a single sentence prompt and Find your store button -- no 3-step guide, no subtitle, no coverage disclaimer"
- [ ] "Skeleton occupies same dimensions as hero card during loading -- no layout shift when real content appears"
- [ ] "Signals section, multi-store glance, and page header (h1 + subtitle) are completely removed from the page"
- [ ] "Error state shows message and retry button using existing card--danger pattern"
- [ ] "Week-ahead details element is collapsed by default (no open attribute)"

## Files

- `docs/index.html`
- `docs/today-page.js`
- `docs/style.css`
