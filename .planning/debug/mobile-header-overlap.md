---
status: awaiting_human_verify
trigger: "mobile-header-overlap: store chip overlaps nav pill on mobile"
created: 2026-04-03T12:00:00Z
updated: 2026-04-03T12:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- .site-header-left lacks overflow:hidden so its nav-links content visually overflows into the store chip on narrow viewports. Additionally, there are zero mobile breakpoint adjustments for the header, so 4 nowrap nav links + wordmark + store chip simply don't fit at 375px.
test: Calculated layout widths and verified CSS properties
expecting: Fix needs overflow:hidden on .site-header-left plus reduced nav padding on mobile
next_action: Apply fix to docs/style.css

## Symptoms

expected: Header bar should show cone icon, nav pill (Today/Compare), and store chip neatly laid out without overlap on mobile viewports
actual: The store chip text ("Mineral Point") overlaps/collides with the "Compare" nav link. Elements are not respecting each other's space on narrow screens.
errors: No JS errors - this is a CSS/layout issue
reproduction: View any page with the new header on mobile width (~375px). More obvious with longer store names like "Mineral Point".
started: Commit d363e63 feat(M005/S01): sticky branded header -- cone + nav pill + store chip

## Eliminated

## Evidence

- timestamp: 2026-04-03T12:05:00Z
  checked: docs/style.css header CSS block (lines 3266-3433)
  found: |
    - .site-header-inner uses flex, justify-content:space-between, gap:var(--space-3)
    - .site-header-left has display:flex, min-width:0, but NO overflow:hidden
    - .nav-links has flex-wrap:nowrap, gap:0
    - .nav-links a has white-space:nowrap, padding:0.25rem 0.625rem
    - .store-indicator has max-width:48%, flex-shrink:1, min-width:0
    - There are ZERO @media breakpoints for any .site-header* rules
  implication: On 375px mobile, 4 nav links (nowrap) + wordmark + gap = ~237px leaves ~94px for store chip + gap. The flex algorithm shrinks .site-header-left but without overflow:hidden the rendered content visually overflows into store chip space. Longer store names like "Mineral Point" make collision more visible.

- timestamp: 2026-04-03T12:06:00Z
  checked: docs/shared-nav.js updateStoreIndicator (lines 219-250)
  found: |
    - When NO existing .store-indicator exists, the else branch (line 230-232) inserts afterend of nav.nav-links, which places it INSIDE .site-header-left instead of as a sibling in .site-header-inner
    - This is a secondary bug for the first-visit-prompt -> confirm flow
    - For returning users with a saved slug, the initial render places it correctly in .site-header-inner, and outerHTML replacement preserves position
  implication: Two bugs -- (1) CSS overflow/responsive issue affects all users, (2) DOM insertion bug affects first-visit confirm path

## Resolution

root_cause: |
  Two issues causing the store chip to collide with nav links on mobile:
  1. CSS: .site-header-left has min-width:0 (allows flex shrinking) but no overflow:hidden, so its children (nav-links with white-space:nowrap) visually overflow into the store chip. Combined with zero mobile breakpoint styles -- no padding reduction, no font scaling, no wrapping -- the header simply doesn't fit at 375px.
  2. JS: updateStoreIndicator() inserts the store chip after nav.nav-links (inside .site-header-left) when no existing indicator exists, instead of inserting it as a direct child of .site-header-inner where space-between layout expects it.
fix: |
  CSS (docs/style.css):
  1. Added overflow:hidden to .site-header-left so flex-shrunk content is clipped, preventing visual overflow into the store chip
  2. Added @media (max-width:480px) breakpoint that reduces nav link padding from 0.625rem to 0.375rem, font from 0.8125rem to 0.75rem, and gaps from --space-3 to --space-2, giving ~143px for the store chip at 375px viewport

  JS (docs/shared-nav.js):
  3. Fixed updateStoreIndicator() else branch to insert into .site-header-inner (beforeend) instead of after nav.nav-links (which was inside .site-header-left). This ensures the store chip is always a flex sibling of .site-header-left, not nested inside it.
verification: |
  - All 1134 worker tests pass
  - Layout calculation at 375px: left group ~192px + 8px gap + store chip ~143px = 343px = exact fit
  - overflow:hidden on .site-header-left provides safety net for edge cases
  - Awaiting visual verification from user on actual mobile device/viewport
files_changed:
  - docs/style.css
  - docs/shared-nav.js
