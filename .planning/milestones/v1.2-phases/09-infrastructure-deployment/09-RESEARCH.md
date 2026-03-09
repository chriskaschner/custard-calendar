# Phase 9: Infrastructure & Deployment - Research

**Researched:** 2026-03-09
**Domain:** CI pipeline, GitHub Pages deployment, Service Worker caching, static site infrastructure
**Confidence:** HIGH

## Summary

Phase 9 covers four distinct infrastructure concerns: fixing CI so the repo structure check passes with `.planning/` tracked, pushing all unpushed commits to origin/main so GitHub Pages deploys the latest code, expanding service worker registration to all user-facing pages, and adding `stores.json` to the SW pre-cache for offline access. The cache-bust cleanup (removing `?v=` query params from `stores.json` fetches) is a prerequisite for correct SW caching -- the service worker caches by exact URL, so `stores.json?v=2026-03-09` would never match the pre-cached `./stores.json`.

All four tasks are well-understood, low-risk changes to existing infrastructure. The codebase already has a working service worker (`docs/sw.js` at version `custard-v15`), existing SW registration patterns in 4 files, a CI workflow in `.github/workflows/ci.yml`, and GitHub Pages deployment via the `docs/` directory. The work is largely mechanical: adding entries to allowlists, removing query params, and copy-pasting a 2-line snippet.

**Primary recommendation:** Execute in dependency order: CI fix first (unblocks push), then push to deploy, then cache-bust cleanup + SW changes (which need a CACHE_VERSION bump and another push).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Curl-based smoke tests, same pattern as v1.1
- Check 6 pages: index.html, compare.html, map.html, fun.html, updates.html, quiz.html (main nav + pages with recent changes)
- Each test checks for shared nav presence AND a page-specific content marker (e.g., quiz.html checks for data-quiz-mode, fun.html checks for quiz mode cards)
- Reusable shell script at scripts/smoke_test_deploy.sh for future deploys
- Remove all 9 stores.json ?v= cache-bust params in one sweep (shared-nav.js, today-page.js, compare-page.js, map.html, widget.html, calendar.html, scoop.html, radar.html, alerts.html)
- Legacy pages (scoop, radar, alerts) will become redirect stubs in Phase 10 anyway
- Stale-while-revalidate is the caching strategy for stores.json -- same as all other static assets
- No network-first exception needed; store location data changes rarely
- Add SW registration to ALL user-facing pages: index.html, compare.html, quiz.html, map.html, fun.html, updates.html (6 pages added to existing widget.html + calendar.html = 8 total)
- Skip legacy pages that Phase 10 will replace with redirect stubs
- Inline 2-line snippet per page (matches existing widget.html/calendar.html pattern) -- no centralization
- No offline indicator UI -- silent caching, pages look the same online and offline

### Claude's Discretion
- CACHE_VERSION bump strategy and numbering
- CI fix implementation details (adding .planning to ALLOWED_DIRS)
- Git push sequencing and any merge conflict resolution
- Smoke test script structure and exact content markers per page

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | CI repo structure check passes with .planning/ included in REPO_CONTRACT.md | `scripts/check_repo_structure.py` ALLOWED_DIRS set (line 18-32) needs `.planning` added; REPO_CONTRACT.md table needs matching entry |
| INFR-02 | All commits pushed to origin/main and deployment verified at custard.chriskaschner.com | 4 unpushed commits identified; smoke test script validates deployment; GitHub Pages serves from `docs/` |
| INFR-03 | Service worker registered on fun.html and updates.html | fun.html and updates.html currently lack SW registration; 2-line inline snippet pattern verified from widget.html |
| INFR-04 | stores.json included in SW pre-cache for offline access | `docs/sw.js` STATIC_ASSETS array needs `./stores.json`; 9 files have `?v=` cache-bust params that must be removed first |
</phase_requirements>

## Standard Stack

### Core
| Component | Version/Location | Purpose | Status |
|-----------|-----------------|---------|--------|
| Service Worker | `docs/sw.js` custard-v15 | Pre-cache static assets, stale-while-revalidate | Working, needs stores.json added |
| CI workflow | `.github/workflows/ci.yml` | Repo structure + worker tests + python tests | Working, needs .planning allowlisted |
| GitHub Pages | `docs/` directory | Static site hosting | Deployed, 4 commits behind |
| Repo structure check | `scripts/check_repo_structure.py` | Enforces ALLOWED_DIRS contract | Working, needs .planning added |

### Supporting
| Component | Location | Purpose | When Used |
|-----------|----------|---------|-----------|
| REPO_CONTRACT.md | Root | Authoritative directory allowlist docs | Must update alongside check script |
| Smoke test script | `scripts/smoke_test_deploy.sh` (NEW) | Curl-based deploy verification | After each push to main |

## Architecture Patterns

### Current SW Registration Pattern

Two variants exist in the codebase:

**Variant A: Inline in HTML** (widget.html line 965-966, calendar.html line 673-674)
```html
<script>
  // ... other page init code ...

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }
</script>
```

**Variant B: Inside external JS file** (today-page.js line 647-648, compare-page.js line 925-926)
```javascript
// At end of init/DOMContentLoaded handler:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
```

**Decision from CONTEXT.md:** Use inline 2-line snippet (Variant A) for all new registrations. However, index.html and compare.html already have registration via their JS files (Variant B). Adding a duplicate inline snippet would cause double registration attempts -- harmless but untidy. The planner should decide whether to skip those two or accept the duplication.

### Current SW Registration Status

| Page | Has SW Registration | Via | Action Needed |
|------|-------------------|-----|---------------|
| widget.html | YES | inline HTML (line 965) | None |
| calendar.html | YES | inline HTML (line 673) | None |
| index.html | YES | today-page.js (line 647) | Already covered |
| compare.html | YES | compare-page.js (line 925) | Already covered |
| fun.html | NO | -- | Add inline snippet |
| updates.html | NO | -- | Add inline snippet |
| quiz.html | NO | -- | Add inline snippet |
| map.html | NO | -- | Add inline snippet |

### Cache-Bust Removal Targets

All 9 files containing `stores.json?v=`:

| File | Line | Context |
|------|------|---------|
| `docs/shared-nav.js` | 85 | `var url = 'stores.json?v=' + new Date()...` |
| `docs/today-page.js` | 116 | `return fetch('stores.json?v=' + new Date()...` |
| `docs/compare-page.js` | 174 | `return fetch('stores.json?v=' + new Date()...` |
| `docs/map.html` | 933 | `const resp = await fetch('stores.json?v=' + ...` |
| `docs/widget.html` | 544 | `var resp = await fetch('stores.json?v=' + ...` |
| `docs/calendar.html` | 197 | `const resp = await fetch('stores.json?v=' + ...` |
| `docs/scoop.html` | 60 | `var storesResp = await fetch('stores.json?v=' + ...` |
| `docs/radar.html` | 802 | `const resp = await fetch('stores.json?v=' + ...` |
| `docs/alerts.html` | 280 | `const resp = await fetch('stores.json?v=' + ...` |

**Replacement pattern:** Change `'stores.json?v=' + new Date().toISOString().slice(0, 10)` to just `'stores.json'` in all 9 files.

### CI Fix Architecture

Two files need updating in sync:

1. **`scripts/check_repo_structure.py`** line 18-32: Add `'.planning'` to `ALLOWED_DIRS` set
2. **`REPO_CONTRACT.md`**: Add `.planning/` row to the Allowed Top-Level Directories table

The CI workflow already runs `uv run python scripts/check_repo_structure.py` on push to main and PRs. Once `.planning` is tracked and pushed, the check will fail until the allowlist is updated.

### Smoke Test Script Structure

Based on CONTEXT.md decisions, `scripts/smoke_test_deploy.sh` should:

```bash
#!/usr/bin/env bash
# Smoke test: verify deployment at custard.chriskaschner.com
# Usage: ./scripts/smoke_test_deploy.sh

BASE_URL="https://custard.chriskaschner.com"
FAIL=0

check_page() {
  local path="$1"
  local nav_marker="$2"
  local content_marker="$3"
  local url="${BASE_URL}/${path}"

  body=$(curl -sL "$url")

  if ! echo "$body" | grep -q "$nav_marker"; then
    echo "FAIL: $path missing nav marker: $nav_marker"
    FAIL=1
  fi

  if ! echo "$body" | grep -q "$content_marker"; then
    echo "FAIL: $path missing content marker: $content_marker"
    FAIL=1
  fi

  if [ $FAIL -eq 0 ]; then
    echo "OK: $path"
  fi
}

# Check each page for shared nav + page-specific content
check_page "index.html" "<nav" "custard-today"
check_page "compare.html" "<nav" "compare-grid"
check_page "map.html" "<nav" "map-container"
check_page "fun.html" "<nav" "quiz-cards"
check_page "updates.html" "<nav" "updates-feed"
check_page "quiz.html" "<nav" "data-quiz-mode"

exit $FAIL
```

**Note:** The exact content markers should be verified against each page's actual HTML. The markers above are illustrative -- the planner should specify exact markers based on existing `id=` or `data-` attributes.

### CACHE_VERSION Bump Strategy

Current version: `custard-v15`. Recommendation for this phase:

- Bump to `custard-v16` when adding `./stores.json` to STATIC_ASSETS
- This forces all clients to re-download the full cache including the newly added stores.json
- The version bump should happen in the same commit as the STATIC_ASSETS addition and cache-bust removal
- Single bump for all SW changes in this phase (not one per modification)

### Git Push Sequencing

Current state: 4 unpushed commits on main:
```
a66932e feat(08-01): add per-mode accent borders to fun.html quiz cards
bf04990 feat(08-01): implement quiz mode visual differentiation in engine.js and quiz.html
48c3f41 test(08-01): add failing test for quiz mode visual differentiation
05e1fdf docs: resolve debug compare-page-broken
```

Recommended sequence:
1. Make CI fix commit (`.planning` allowlist) -- this must land before or with the push
2. Push all commits (existing 4 + new CI fix) to origin/main
3. Wait for GitHub Pages deployment
4. Make SW/cache-bust changes, commit, push again
5. Run smoke test script to verify final deployment

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Offline caching | Custom fetch interceptor | Existing `sw.js` stale-while-revalidate pattern | Already working, battle-tested across pages |
| Deploy verification | Manual browser checks | `scripts/smoke_test_deploy.sh` curl script | Repeatable, scriptable, CI-compatible |
| Cache invalidation | Custom versioning scheme | `CACHE_VERSION` bump in sw.js | Built-in browser cache lifecycle |

## Common Pitfalls

### Pitfall 1: Cache-bust params defeating SW pre-cache
**What goes wrong:** If `stores.json?v=2026-03-09` is fetched but `./stores.json` is in STATIC_ASSETS, the service worker treats them as different URLs. The cached version is never served, and offline access fails.
**Why it happens:** Query params create distinct cache keys in the Cache API.
**How to avoid:** Remove ALL `?v=` params from stores.json fetches BEFORE (or in same commit as) adding to STATIC_ASSETS.
**Warning signs:** stores.json appearing in network tab on every page load despite being in STATIC_ASSETS.

### Pitfall 2: Forgetting to bump CACHE_VERSION
**What goes wrong:** Adding stores.json to STATIC_ASSETS without bumping the version means existing service workers never re-install. Users with the old SW never get stores.json cached.
**Why it happens:** The install event only fires when CACHE_VERSION changes.
**How to avoid:** Bump CACHE_VERSION in the same commit as STATIC_ASSETS changes.
**Warning signs:** New installs work offline but returning visitors don't.

### Pitfall 3: CI fix and push ordering
**What goes wrong:** If `.planning/` is pushed without updating ALLOWED_DIRS first, CI fails on the push.
**Why it happens:** `.planning/` is already tracked locally but not in the allowlist.
**How to avoid:** Commit the ALLOWED_DIRS fix before or in the same push as any commit that tracks `.planning/`.
**Warning signs:** Red CI badge after push.

### Pitfall 4: SW registration in quiz.html with ES module
**What goes wrong:** quiz.html uses `<script type="module" src="quizzes/engine.js">` as its last script. Adding an inline `<script>` after a module script is fine, but the order of execution differs (modules are deferred).
**Why it happens:** Module scripts execute after regular scripts.
**How to avoid:** The SW registration snippet is a regular `<script>` (not module), so it will execute before engine.js. This is fine -- SW registration is async and doesn't depend on page content.
**Warning signs:** None expected, but worth knowing the execution order.

### Pitfall 5: REPO_CONTRACT.md and check script out of sync
**What goes wrong:** Updating only the Python script but not REPO_CONTRACT.md (or vice versa) creates a documentation drift.
**Why it happens:** They're maintained separately with a comment saying "Update here AND in REPO_CONTRACT.md."
**How to avoid:** Always update both in the same commit.
**Warning signs:** The comment on line 17 of check_repo_structure.py warns about this.

## Code Examples

### Adding .planning to ALLOWED_DIRS
```python
# In scripts/check_repo_structure.py, add to ALLOWED_DIRS set (line 18-32):
ALLOWED_DIRS = {
    'analytics',
    'archive',
    'docs',
    'logs',
    'scripts',
    'src',
    'tests',
    'tidbyt',
    'tools',
    'widgets',
    'worker',
    '.claude',
    '.github',
    '.planning',    # GSD planning documents
}
```

### Adding .planning to REPO_CONTRACT.md
```markdown
| `.planning/` | GSD planning documents (phases, research, plans) | @chriskaschner | No |
```

### Adding stores.json to SW STATIC_ASSETS
```javascript
// In docs/sw.js, add to STATIC_ASSETS array:
const CACHE_VERSION = 'custard-v16';  // bumped from v15
const STATIC_ASSETS = [
  './',
  './index.html',
  // ... existing entries ...
  './icon-512.svg',
  './stores.json',     // NEW: offline store data
];
```

### Removing cache-bust params (all 9 files)
```javascript
// BEFORE (9 files):
fetch('stores.json?v=' + new Date().toISOString().slice(0, 10))

// AFTER:
fetch('stores.json')
```

### Adding SW registration to a page (inline pattern)
```html
<!-- Add before </body>, after last <script> tag -->
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }
</script>
```

### Smoke test page check function
```bash
check_page() {
  local path="$1"
  local nav_marker="$2"
  local content_marker="$3"
  local url="${BASE_URL}/${path}"
  local body
  body=$(curl -sL --max-time 10 "$url")

  local ok=1
  if ! echo "$body" | grep -q "$nav_marker"; then
    echo "FAIL: $path missing shared nav"
    ok=0
  fi
  if ! echo "$body" | grep -q "$content_marker"; then
    echo "FAIL: $path missing content marker: $content_marker"
    ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "PASS: $path"
  else
    FAILURES=$((FAILURES + 1))
  fi
}
```

## State of the Art

| Current State | Change Needed | Impact |
|---------------|---------------|--------|
| `stores.json?v=` cache-bust on 9 files | Remove query params, rely on SW stale-while-revalidate | Enables proper SW caching |
| SW registered on 4/8 user-facing pages | Add to remaining 4 pages | Full offline coverage |
| `custard-v15` cache version | Bump to `custard-v16` | Forces re-cache with stores.json |
| `.planning/` not in ALLOWED_DIRS | Add to allowlist + REPO_CONTRACT.md | CI passes |
| 4 unpushed commits | Push to origin/main | GitHub Pages serves latest code |

## Open Questions

1. **Duplicate SW registration for index.html and compare.html**
   - What we know: Both pages already register SW via their JS files (today-page.js, compare-page.js). CONTEXT.md says "6 pages added."
   - What's unclear: Whether to add redundant inline snippets to those pages too, or count them as already covered.
   - Recommendation: Skip inline snippets for index.html and compare.html since they already register via JS. Only add to the 4 pages that truly lack it (fun.html, updates.html, quiz.html, map.html). The success criteria only explicitly names fun.html and updates.html for INFR-03.

2. **Smoke test content markers**
   - What we know: Each page needs a page-specific content marker for the smoke test.
   - What's unclear: Exact HTML attributes/content to grep for on each page.
   - Recommendation: Implementer should inspect each page's HTML for stable `id=` or `data-` attributes. Examples from the codebase: quiz.html has `data-quiz-mode`, fun.html has quiz card sections, etc.

3. **GitHub Pages deployment timing**
   - What we know: Push to main triggers deployment. Pages typically deploys within 1-3 minutes.
   - What's unclear: Whether to wait and verify between pushes or batch everything.
   - Recommendation: Two pushes -- first for CI fix + existing commits, second for SW changes. Run smoke test after second push.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python) + Vitest (Worker) + Playwright (browser) |
| Config file | `pyproject.toml` (pytest), `worker/vitest.config.js`, `worker/playwright.config.mjs` |
| Quick run command | `cd custard-calendar && uv run pytest tests/test_static_assets.py -x` |
| Full suite command | `cd custard-calendar && uv run pytest tests/ scripts/tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | CI repo structure check passes with .planning | unit | `cd custard-calendar && uv run python scripts/check_repo_structure.py` | Yes (existing script IS the test) |
| INFR-02 | Deployment verified at custard.chriskaschner.com | smoke | `cd custard-calendar && bash scripts/smoke_test_deploy.sh` | No -- Wave 0 |
| INFR-03 | SW registered on fun.html and updates.html | unit | `cd custard-calendar && uv run pytest tests/test_sw_registration.py -x` | No -- Wave 0 |
| INFR-04 | stores.json in SW pre-cache, no ?v= params | unit | `cd custard-calendar && uv run pytest tests/test_sw_precache.py -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `uv run pytest tests/test_static_assets.py tests/test_sw_registration.py tests/test_sw_precache.py -x`
- **Per wave merge:** `uv run pytest tests/ scripts/tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_sw_registration.py` -- covers INFR-03: verify all 8 user-facing pages have serviceWorker registration
- [ ] `tests/test_sw_precache.py` -- covers INFR-04: verify stores.json in STATIC_ASSETS, no ?v= cache-bust params remain
- [ ] `scripts/smoke_test_deploy.sh` -- covers INFR-02: curl-based deployment verification (6 pages)

Note: INFR-01 is self-testing -- `scripts/check_repo_structure.py` is both the enforcement tool and the test. Running it with `.planning/` tracked and in the allowlist validates the requirement.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `docs/sw.js`, `scripts/check_repo_structure.py`, `.github/workflows/ci.yml`, `REPO_CONTRACT.md`
- Grep results for `serviceWorker`, `stores.json?v=` across all `docs/` files
- Git log and status for unpushed commit tracking

### Secondary (MEDIUM confidence)
- Service Worker Cache API behavior (query params create distinct cache keys) -- well-established browser specification behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components are existing codebase artifacts inspected directly
- Architecture: HIGH - patterns copied verbatim from working code in the same repo
- Pitfalls: HIGH - cache-bust/SW interaction is well-documented browser behavior; all other pitfalls derived from direct code inspection

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable infrastructure, no external dependency changes expected)
