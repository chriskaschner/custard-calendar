---
estimated_steps: 3
estimated_files: 8
skills_used:
  - lint
---

# T02: Update HTML og:image meta tags from SVG to PNG

**Slice:** S03 — PNG OG Page Cards
**Milestone:** M004

## Description

Update all 8 HTML files in `docs/` that have `og:image` meta tags to reference the new `.png` endpoints instead of `.svg`. Also fix incorrect slug mappings: `updates.html` should use `alerts` (not `forecast`), `widget.html` should use `widget` (not `forecast`), `compare.html` should use `compare` (new slug from T01), `fun.html` should use `fun` (new slug from T01).

## Steps

1. **Update each HTML file's `og:image` meta tag.** The changes are:

   | File | Current value | New value |
   |---|---|---|
   | `docs/index.html` | `/og/page/forecast.svg` | `/og/page/forecast.png` |
   | `docs/compare.html` | `/og/page/forecast.svg` | `/og/page/compare.png` |
   | `docs/fun.html` | `/og/page/forecast.svg` | `/og/page/fun.png` |
   | `docs/map.html` | `/og/page/map.svg` | `/og/page/map.png` |
   | `docs/quiz.html` | `/og/page/quiz.svg` | `/og/page/quiz.png` |
   | `docs/group.html` | `/og/page/group.svg` | `/og/page/group.png` |
   | `docs/updates.html` | `/og/page/forecast.svg` | `/og/page/alerts.png` |
   | `docs/widget.html` | `/og/page/forecast.svg` | `/og/page/widget.png` |

   Use the `edit` tool for each file. The exact old text to match is the full `<meta property="og:image" content="...">` line.

2. **Verify no SVG og:image references remain:**
   ```bash
   rg "og:image.*\.svg" docs/*.html
   ```
   Should return nothing.

3. **Verify all 8 PNG references are correct:**
   ```bash
   rg "og:image.*\.png" docs/*.html
   ```
   Should return exactly 8 lines, each with the correct slug for that page.

## Must-Haves

- [ ] All 8 HTML files reference `.png` og:image URLs (not `.svg`)
- [ ] Each page references a slug that exists in `PAGE_CARD_DEFS` (forecast, compare, fun, map, quiz, group, alerts, widget)
- [ ] `updates.html` references `alerts.png` (not `forecast.png`)
- [ ] `compare.html` references `compare.png` and `fun.html` references `fun.png` (new T01 slugs)
- [ ] Zero SVG og:image references remain across all docs HTML files
- [ ] Full worker test suite still passes

## Verification

- `rg "og:image.*\.svg" docs/*.html` — returns nothing (exit code 1)
- `rg "og:image.*\.png" docs/*.html | wc -l` — returns 8
- `cd worker && npm test` — still all green (HTML changes don't affect worker tests, but confirm no regressions)

## Inputs

- `worker/src/social-card.js` — T01 added `compare` and `fun` to `PAGE_CARD_DEFS`, so those slugs are now valid
- `docs/index.html` — has `og:image` meta tag to update
- `docs/compare.html` — has `og:image` meta tag to update
- `docs/fun.html` — has `og:image` meta tag to update
- `docs/map.html` — has `og:image` meta tag to update
- `docs/quiz.html` — has `og:image` meta tag to update
- `docs/group.html` — has `og:image` meta tag to update
- `docs/updates.html` — has `og:image` meta tag to update
- `docs/widget.html` — has `og:image` meta tag to update

## Expected Output

- `docs/index.html` — og:image updated to `/og/page/forecast.png`
- `docs/compare.html` — og:image updated to `/og/page/compare.png`
- `docs/fun.html` — og:image updated to `/og/page/fun.png`
- `docs/map.html` — og:image updated to `/og/page/map.png`
- `docs/quiz.html` — og:image updated to `/og/page/quiz.png`
- `docs/group.html` — og:image updated to `/og/page/group.png`
- `docs/updates.html` — og:image updated to `/og/page/alerts.png`
- `docs/widget.html` — og:image updated to `/og/page/widget.png`
