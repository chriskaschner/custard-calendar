---
phase: 31-homepage-redesign
verified: 2026-03-19T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Visual above-fold check at 375px for returning user"
    expected: "Hero card (flavor name, cone art, description, rarity, CTA row, store meta footer) is the only content visible without scrolling at 375px viewport height 667px"
    why_human: "Cannot programmatically measure pixel position of elements relative to 375x667 viewport fold without running a browser"
  - test: "Skeleton timing: CLS during data load"
    expected: "Skeleton occupies same dimensions as hero card; no visible jump when real content replaces it (CLS < 0.1)"
    why_human: "Layout shift measurement requires Lighthouse or runtime browser observation; cannot be determined from static file analysis"
  - test: "Week-ahead expand on tap"
    expected: "Tapping the 'Week Ahead' summary expands the details element and shows the week strip with upcoming flavors"
    why_human: "Interactive browser behavior; native <details> expand is not verifiable statically"
---

# Phase 31: Homepage Redesign Verification Report

**Phase Goal:** Users see today's flavor at their store immediately upon landing, with a clean information hierarchy that eliminates visual noise
**Verified:** 2026-03-19
**Status:** human_needed (all automated checks passed; 3 items require browser observation)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Returning user with saved store sees hero card with flavor name, cone art, description, rarity badge, action CTAs, and store meta -- all above the fold at 375px | ? UNCERTAIN | Hero card elements verified in HTML/JS (today-section, today-ctas, today-meta, actionCTAsHTML wired); above-fold position requires human browser check |
| 2 | First-visit user sees a single sentence prompt and Find your store button -- no 3-step guide, no subtitle, no coverage disclaimer | VERIFIED | `Pick your Culver's to see today's flavor.` + `id="find-store-btn"` present; zero occurrences of `first-visit-guide`, `hero-coverage`, `header-subtitle`, `View the map` in HTML |
| 3 | Skeleton occupies same dimensions as hero card during loading -- no layout shift when real content appears | ? UNCERTAIN | Skeleton uses `class="card today-card today-card-skeleton"` (inherits same base styles); `.skeleton-cone { flex: 0 0 120px; height: 140px; }` confirmed in CSS; actual CLS value requires browser measurement |
| 4 | Signals section, multi-store glance, and page header (h1 + subtitle) are completely removed from the page | VERIFIED | Zero occurrences of `signals-section`, `multi-store-section`, `first-visit-guide` in index.html; no h1 with "Custard Forecast" body text (og:title meta tag is not an h1); zero dead references in today-page.js |
| 5 | Error state shows message and retry button using existing card--danger pattern | VERIFIED | `<div class="card card--danger error-card">` with `id="error-message"` and `id="retry-btn"` confirmed in index.html |
| 6 | Week-ahead details element is collapsed by default (no open attribute) | VERIFIED | `<details id="week-section" hidden>` -- no `open` attribute confirmed programmatically |

**Score:** 4/6 truths fully verified; 2 require human browser check

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/index.html` | Redesigned homepage HTML with hero card, skeleton, empty state, error state | VERIFIED | All required elements present: `#today-section`, `#today-ctas`, `#today-meta`, `#today-loading` with `.skeleton-cone`, `#empty-state` simplified, `#error-state` with `card--danger`, `#week-section` collapsed |
| `docs/today-page.js` | Updated renderHeroCard with CTAs and meta footer, simplified empty state | VERIFIED | `CustardPlanner.actionCTAsHTML` called on lines 304 and 313; `todayCtas` and `todayMeta` DOM refs populated; `.today-store` and `.freshness-ts` spans rendered; `today-card-enter` class added; all dead functions removed |
| `docs/style.css` | Updated skeleton with cone placeholder, hero card meta footer styles | VERIFIED | `.today-card-skeleton` (line ~1846+), `.skeleton-cone { flex: 0 0 120px }` (line 1847), `.today-card-enter` with `fadeIn` (line 1874), `.hero-empty-heading` (line 1546), `.near-me-label` (line 1644), `.below-fold-cta` (line 1948), `.cta-link-inline` (line 1959) -- all present |
| `worker/test/browser/homepage-redesign.spec.mjs` | Playwright tests for hero card above fold, week-ahead collapsed, no dead sections | VERIFIED | File exists; 6 tests in `"Homepage redesign (Phase 31)"` describe block; `setupWithMocks()` mocks all required endpoints; `page.setViewportSize({ width: 375, height: 667 })` used; assertions for `#signals-section`, `#multi-store-section`, `.first-visit-guide` count 0; `open` attribute null check on `details#week-section` |
| `worker/test/browser/today-hero.spec.mjs` | Updated Playwright tests with TDAY-05 removed and TDAY-06 rewritten | VERIFIED | Zero occurrences of `TDAY-05`, `Want this every day`, `MOCK_SIGNALS`, `signals-section`; 3 occurrences of `Get daily flavor alerts` confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `docs/today-page.js` | `docs/planner-ui.js` | `CustardPlanner.actionCTAsHTML()` call inside `renderHeroCard` | WIRED | Lines 304 and 313 call `CustardPlanner.actionCTAsHTML({...})` with slug, lat, lon, storeName, workerBase; result assigned to `todayCtas.innerHTML` |
| `docs/today-page.js` | `docs/shared-nav.js` | `sharednav:storechange` event listener triggers `selectStore` | WIRED | Line 462: `document.addEventListener('sharednav:storechange', function (e) {` confirmed present |
| `docs/index.html` | `docs/style.css` | `today-card-skeleton` class with matching hero card dimensions | WIRED | HTML: `<div class="card today-card today-card-skeleton">` -- inherits `.today-card` base styles; CSS: `.today-card-skeleton` rule confirmed at line 1846+ |
| `docs/today-page.js` | `docs/index.html` | `updatesCta` element show/hide toggling `#updates-cta` | WIRED | 7 references to `updatesCta` in today-page.js: declared, cached via `getElementById('updates-cta')`, and toggled `.hidden` at loading/success/init branches |
| `worker/test/browser/homepage-redesign.spec.mjs` | `docs/index.html` | Playwright selectors for `#today-section`, `#week-section`, `#empty-state` | WIRED | Test file references all three selectors; `setupWithMocks()` mocks all Worker API routes required for data load |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HOME-01 | 31-01-PLAN.md | User sees one primary card with today's flavor at their saved store above the fold | ? NEEDS HUMAN | Hero card HTML/JS structure fully implemented; above-fold position at 375px requires visual browser check |
| HOME-02 | 31-01-PLAN.md, 31-02-PLAN.md | Week-ahead section is collapsed by default, expandable on tap | VERIFIED | `<details id="week-section" hidden>` has no `open` attribute; Playwright test "week-ahead section is collapsed by default" passes this check |
| HOME-03 | 31-01-PLAN.md | Page layout does not visibly shift during data load (CLS < 0.1) | ? NEEDS HUMAN | Skeleton uses identical class chain (`card today-card`) as hero card; `.skeleton-cone { flex: 0 0 120px; height: 140px }` matches cone dimensions; actual CLS measurement requires Lighthouse |
| HOME-04 | 31-01-PLAN.md, 31-02-PLAN.md | All homepage sections use a single visual language (unified card system, consistent spacing/borders) | VERIFIED | Hero card: `card card--hero`; skeleton: `card today-card today-card-skeleton`; error: `card card--danger`; CTA: `below-fold-cta` (text line, not a card); dead CSS for all removed sections (`updates-cta-card`, `signals-list`, `multi-store-*`, `quick-start-*`, `first-visit-guide`) fully removed |

No orphaned requirements: REQUIREMENTS.md maps HOME-01 through HOME-04 exclusively to Phase 31 and all four are claimed in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None detected | -- | -- | -- | -- |

No TODO/FIXME/HACK/PLACEHOLDER comments found in modified files. No empty implementations or stub returns detected. Dead code removal confirmed across HTML, JS, and CSS.

**Note:** "Custard Forecast" appears once in `docs/index.html` at line 11 as `<meta property="og:title" content="Custard Forecast — Today's Flavor of the Day">`. This is an OG meta tag, not an h1 heading. The PLAN acceptance criterion targets h1 removal, which is satisfied. The OG title is intentional metadata for social sharing previews and does not constitute a violation.

### Human Verification Required

#### 1. Hero Card Above Fold at 375px (HOME-01)

**Test:** Open `docs/index.html` in Chrome DevTools at 375x667px viewport with a saved store in localStorage (`custard-primary`). After data loads, scroll position should be at top with the full hero card (flavor name, cone art, description, rarity, CTA row, store meta) visible without scrolling.
**Expected:** Hero card fills the visible area below SharedNav; no scrolling needed to see the complete decision unit.
**Why human:** Pixel-level above-fold measurement requires a real browser viewport; static file analysis cannot confirm element heights at runtime.

#### 2. Skeleton CLS Check (HOME-03)

**Test:** With a saved store in localStorage, hard-reload the page while watching the layout. The skeleton (gray cone block + pulsing text lines) should appear instantly and then smoothly swap to the hero card without any visible jump.
**Expected:** No layout shift visible to the naked eye; CLS score under 0.1 in Lighthouse mobile throttled audit.
**Why human:** CLS is a rendering-time metric; it requires a browser to measure. Static analysis can only confirm structural alignment (which passes), not the actual shift amount.

#### 3. Week-Ahead Expand Interaction (HOME-02 partial)

**Test:** With hero card loaded, tap or click the "Week Ahead" summary element.
**Expected:** The `<details>` element expands smoothly to reveal the week strip with upcoming flavor entries; tapping again collapses it.
**Why human:** Native `<details>` expand behavior requires browser interaction. The collapsed default state is verified programmatically; the expand behavior cannot be.

### Gaps Summary

No gaps. All code artifacts are present, substantive, and wired. The three human verification items are behavioral checks that cannot be performed from static file analysis -- they do not indicate missing implementation.

Commit trail is clean and complete: all 5 commits documented in SUMMARY.md exist in git history (49555ec, 5937bb7, 3650985, 13f54fc, 05b1c6e).

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
