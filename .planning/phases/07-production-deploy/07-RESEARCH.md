# Phase 7: Production Deploy - Research

**Researched:** 2026-03-08
**Domain:** GitHub Pages deployment, Cloudflare Worker deployment, production smoke testing
**Confidence:** HIGH

## Summary

Phase 7 is a deployment phase, not a development phase. The codebase is complete -- 49 commits on `main` in the `custard-calendar` repo are ahead of `origin/main` and need to be pushed. GitHub Pages is already configured to serve from `main:docs/` at `custard.chriskaschner.com` with HTTPS enforced and a valid certificate (expires 2026-05-22). The Cloudflare Worker is already deployed and serving API requests at the same domain.

The current live site serves the pre-v1.0 restructure content. Pages like `compare.html`, `fun.html`, and `updates.html` return GitHub 404s because they don't exist on the remote yet. Once the 49 commits are pushed, GitHub Pages will automatically rebuild and serve the updated `docs/` directory. The Worker does NOT need redeployment -- no `worker/src/` files changed in these 49 commits (only `worker/test/browser/` files were added).

**Primary recommendation:** Push the 49 unpushed commits to `origin/main`, wait for GitHub Pages to rebuild (typically 30-60 seconds), then run smoke tests against the live site to verify all pages load and the API responds.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPL-01 | Site is live at custard.chriskaschner.com with all v1.0 changes deployed | Push 49 commits to origin/main; GitHub Pages auto-deploys from main:docs/ |
| DEPL-02 | Cloudflare Worker is deployed with current API routes | Worker is already deployed (last deployment 2026-03-01); no worker/src/ changes in the 49 commits -- no redeployment needed; verify with API smoke test |
| DEPL-03 | Live site passes smoke test (nav, today page, compare, fun, updates) | Playwright browser tests exist for all pages; curl-based smoke tests can verify live URLs |
</phase_requirements>

## Standard Stack

### Core (Existing Infrastructure -- No New Tools)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Pages | N/A | Static site hosting from `main:docs/` | Already configured, CNAME set, HTTPS enforced |
| Cloudflare Worker | wrangler 4.67.0 | API backend (KV + D1) | Already deployed, 810 tests passing |
| git | system | Push 49 commits to remote | Standard version control |
| curl | system | HTTP smoke testing | Simple, scriptable, no dependencies |
| Playwright | 1.58.2 | Browser-level smoke tests | Already configured in worker/playwright.config.mjs |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| gh CLI | system | Check Pages build status, CI status | Post-push verification |
| Python http.server | system | Local smoke test server (Playwright uses this) | Pre-push local validation |

### Alternatives Considered

None. This is a deployment phase using existing infrastructure. No new tools needed.

## Architecture Patterns

### Deployment Architecture (Already Configured)

```
custard.chriskaschner.com
    |
    +-- /docs/*  --> GitHub Pages (static HTML/CSS/JS)
    |               Source: main branch, /docs directory
    |               CNAME: custard.chriskaschner.com
    |               HTTPS: enforced, cert valid until 2026-05-22
    |
    +-- /api/*   --> Cloudflare Worker (custard-calendar)
    |               KV: FLAVOR_CACHE (1642a7da...)
    |               D1: custard-snapshots (fa11cb69...)
    |               Crons: daily alerts, weekly digest, weekly report
    |
    +-- /v1/*    --> Cloudflare Worker (legacy routes)
    +-- /*.ics   --> Cloudflare Worker (calendar feeds)
```

### Deployment Flow

```
1. git push origin main          (push 49 commits)
2. GitHub Pages auto-builds      (30-60 seconds)
3. CI runs automatically         (worker-tests, python-tests, repo-structure)
4. Smoke test live URLs          (curl or browser)
```

### Pattern: Pre-Push Validation

**What:** Run all tests locally before pushing to catch issues before they go live.
**When to use:** Always, before any production push.
**Steps:**
1. Worker unit tests: `cd worker && npm test` (810 tests, ~3.4s)
2. Playwright browser tests: `cd worker && npm run test:browser -- --workers=1` (30 specs)
3. Python tests: `uv run pytest tests/ -v` (design tokens, static assets, browser clickthrough)

### Pattern: Post-Deploy Smoke Test

**What:** Verify the live site responds correctly after deployment.
**When to use:** After every push to main.
**Targets:**
- `https://custard.chriskaschner.com/` (Today page - index.html)
- `https://custard.chriskaschner.com/compare.html` (Compare page)
- `https://custard.chriskaschner.com/map.html` (Map page)
- `https://custard.chriskaschner.com/fun.html` (Fun page)
- `https://custard.chriskaschner.com/updates.html` (Get Updates page)
- `https://custard.chriskaschner.com/api/v1/today?slug=mt-horeb` (Worker API)

### Anti-Patterns to Avoid

- **Redeploying the Worker unnecessarily:** No `worker/src/` files changed. Running `wrangler deploy` would push the same code and risk deployment churn. Only redeploy if worker source changes.
- **Skipping pre-push validation:** The 49 commits span v1.0 through v1.1. A broken push to main breaks the live site immediately.
- **Force-pushing:** Never force-push to main. The 49 commits are clean, linear history.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP status checks | Custom monitoring script | `curl -sI -o /dev/null -w '%{http_code}'` | One-liner, no dependencies |
| GitHub Pages build status | Poll the site | `gh api repos/{owner}/{repo}/pages/builds/latest` | API gives definitive build status |
| Browser smoke tests | Manual clicking | Existing Playwright suite (30 specs) | Already written, covers all pages |
| CI verification | Watch the GitHub UI | `gh run list --limit 1` | Scriptable status check |

**Key insight:** All verification tools already exist in this repo. The deployment phase needs zero new code.

## Common Pitfalls

### Pitfall 1: GitHub Pages Build Delay
**What goes wrong:** Push commits, immediately test, get stale content.
**Why it happens:** GitHub Pages takes 30-90 seconds to rebuild after push.
**How to avoid:** Check build status via `gh api repos/chriskaschner/custard-calendar/pages/builds/latest` before testing. Wait for `status: "built"`.
**Warning signs:** Seeing old content or 404s immediately after push.

### Pitfall 2: Service Worker Caching Stale Content
**What goes wrong:** Browser shows old site even after deployment due to SW cache.
**Why it happens:** `sw.js` uses stale-while-revalidate strategy with `CACHE_VERSION = 'custard-v15'`. Old SW serves cached content while fetching new version.
**How to avoid:** For smoke testing, use `curl` or incognito/private browsing. The SW will update on its own for end users (skipWaiting + clients.claim pattern is already in place).
**Warning signs:** Browser shows old content but curl shows new content.

### Pitfall 3: CORS Blocking API Requests from Live Site
**What goes wrong:** API calls from the live site fail with CORS errors.
**Why it happens:** Worker's `ALLOWED_ORIGIN` is set to `https://custard.chriskaschner.com`. If Pages serves from a different origin, CORS blocks requests.
**How to avoid:** This is already correctly configured. The CNAME file contains `custard.chriskaschner.com` and Worker's ALLOWED_ORIGIN matches. Just verify API requests work from the live page, not just via curl.
**Warning signs:** Console errors showing "Access-Control-Allow-Origin" mismatches.

### Pitfall 4: CI Failures on Push
**What goes wrong:** Push triggers CI (worker-tests, python-tests, repo-structure), and a job fails.
**Why it happens:** Tests may depend on environment (Chrome binary path, uv sync, etc.) that differs from local.
**How to avoid:** Review CI configuration. Worker tests pass locally (810/810). Note that browser tests (`test_browser_clickthrough.py`) are skipped in CI via `SKIP_BROWSER_TESTS=1`.
**Warning signs:** `gh run list` showing failed status after push.

### Pitfall 5: Pushing Sensitive Files
**What goes wrong:** `.env`, `config.yaml`, or credentials accidentally pushed.
**Why it happens:** 49 commits is a lot of history -- easy to miss one bad file.
**How to avoid:** The `.gitignore` already covers `.env`, `config.yaml`, `credentials/`. Run `git diff --name-only origin/main..HEAD` to review all files in the push. Already verified: 94 files changed, all appropriate (docs/*, worker/test/browser/*, tests/*, .planning/*).
**Warning signs:** Secret scan CI job failing after push.

## Code Examples

### Pre-Push Test Commands
```bash
# Worker unit tests (810 tests, ~3.4s)
cd worker && npm test

# Playwright browser tests (30 specs, ~60s)
cd worker && npm run test:browser -- --workers=1

# Python static asset + design token tests
cd .. && uv run pytest tests/test_static_assets.py tests/test_design_tokens.py -v
```

### Push to Production
```bash
# From custard-calendar repo root
git push origin main
```

### Check GitHub Pages Build Status
```bash
gh api repos/chriskaschner/custard-calendar/pages/builds/latest --jq '.status'
# Expected: "built"
```

### Smoke Test Commands (Post-Deploy)
```bash
# Check each page returns HTTP 200
for page in "" "compare.html" "map.html" "fun.html" "updates.html"; do
  STATUS=$(curl -sI -o /dev/null -w '%{http_code}' "https://custard.chriskaschner.com/$page")
  echo "$page: $STATUS"
done

# Check Worker API returns valid JSON
curl -s "https://custard.chriskaschner.com/api/v1/today?slug=mt-horeb" | python3 -m json.tool > /dev/null && echo "API OK" || echo "API FAIL"
```

### Check CI Status After Push
```bash
gh run list --repo chriskaschner/custard-calendar --limit 1
```

## State of the Art

| Current State | Target State | Action |
|---------------|-------------|--------|
| 49 commits ahead of remote | Remote matches local | `git push origin main` |
| Live site serves pre-v1.0 content | Live site serves v1.1 content | Push triggers GitHub Pages rebuild |
| Worker deployed 2026-03-01 | Worker deployed 2026-03-01 (no change needed) | Verify API still responds |
| No CI run for 49 commits | CI validates push | Push triggers CI automatically |

**Key fact:** The Worker was last deployed 2026-03-01 and no `worker/src/` files changed in the 49 unpushed commits. The Worker does NOT need redeployment.

## Open Questions

1. **GitHub Pages build timing**
   - What we know: Builds typically take 30-90 seconds. Status checkable via API.
   - What's unclear: Whether 49-commit push takes longer than typical incremental builds.
   - Recommendation: Poll build status before running smoke tests. Allow up to 5 minutes.

2. **Browser-based smoke testing against live site**
   - What we know: Playwright is configured to test against `127.0.0.1:{port}` with a local http.server. Existing tests cover all pages.
   - What's unclear: Whether Playwright can be pointed at the live URL for a production smoke test.
   - Recommendation: Use curl-based smoke tests for live site verification. Playwright tests against local serve as the pre-push gate. A user navigating the live site is the ultimate verification for DEPL-03.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 (browser), vitest 3.0 (worker unit), pytest (Python) |
| Config file | worker/playwright.config.mjs, worker/vitest.config.js |
| Quick run command | `cd worker && npm test` |
| Full suite command | `cd worker && npm test && npm run test:browser -- --workers=1` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPL-01 | Site live at custard.chriskaschner.com | smoke | `curl -sI -o /dev/null -w '%{http_code}' https://custard.chriskaschner.com/` | N/A (curl) |
| DEPL-02 | Worker responds to API requests | smoke | `curl -s "https://custard.chriskaschner.com/api/v1/today?slug=mt-horeb" \| python3 -m json.tool` | N/A (curl) |
| DEPL-03 | Nav pages load without errors | smoke + browser | `curl -sI` for each page + manual nav check | Partial -- Playwright tests exist for local, curl for live |

### Sampling Rate
- **Pre-push:** `cd worker && npm test` (810 unit tests)
- **Pre-push:** `cd worker && npm run test:browser -- --workers=1` (30 Playwright specs)
- **Post-push:** curl smoke tests against live URLs
- **Phase gate:** All 5 nav pages return HTTP 200, API returns valid JSON

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. No new test files needed. Smoke testing uses curl against live URLs.

## Sources

### Primary (HIGH confidence)
- Local repository analysis: `git log --oneline origin/main..HEAD` -- 49 commits ahead
- Local repository analysis: `git diff --name-only origin/main..HEAD` -- 94 files, no worker/src/ changes
- GitHub API: `gh api repos/chriskaschner/custard-calendar/pages` -- Pages config confirmed (main:docs/, CNAME set, HTTPS enforced)
- Live site verification: `curl -sI https://custard.chriskaschner.com/` -- returns HTTP 200, serves old content
- Live API verification: `curl -s "https://custard.chriskaschner.com/api/v1/today?slug=mt-horeb"` -- returns valid JSON
- Worker test suite: `npm test` -- 810/810 passing
- Wrangler deployments: last Worker deploy was 2026-03-01

### Secondary (MEDIUM confidence)
- GitHub Pages rebuild timing: 30-90 seconds typical based on GitHub documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing infrastructure, no new tools needed
- Architecture: HIGH - all deployment paths already configured and verified
- Pitfalls: HIGH - based on direct observation of current live site vs local state

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- deployment infrastructure doesn't change frequently)
