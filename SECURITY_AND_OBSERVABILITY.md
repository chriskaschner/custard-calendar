# Security & Observability Review

Last reviewed: 2026-02-22
Scope: custard-calendar (Worker, frontend, Python pipeline) + custard-tidbyt (Starlark app)

## Summary

No critical or high-severity vulnerabilities found. The codebase demonstrates strong security practices across input validation, HTML escaping, email security, and database query parameterization. Findings below are medium/low hardening recommendations and cross-repo trust boundary concerns.

---

## Architecture & Trust Boundaries

```
Culver's website (third-party, untrusted)
    ↓ scrape __NEXT_DATA__
Cloudflare Worker (worker/src/)
    ↓ KV cache + D1 snapshots
    ├── GitHub Pages frontend (docs/)
    ├── Alert emails (Resend API)
    ├── Tidbyt app (custard-tidbyt repo)
    ├── Backfill SQLite (data/backfill/flavors.sqlite)
    │       ↓
    │   Analytics pipeline (analytics/)
    │       ↓
    │   Forecast predictions → KV → /api/v1/forecast/{slug}
    └── ICS calendar subscriptions
```

Key trust boundaries:
1. **Culver's → Worker**: Untrusted upstream. Flavor names/descriptions flow in without allowlist validation.
2. **Worker → Frontend**: Public API with wildcard CORS. Any origin can read responses.
3. **Worker → Email**: Flavor data renders in subscriber inboxes. HTML-escaped but content not validated.
4. **Worker → Tidbyt**: HTTP API consumed by Starlark app. No authentication, relies on HTTPS.
5. **Worker → Analytics**: Backfill script persists data to SQLite, which trains ML models.

---

## Findings

### MEDIUM — M1: SSRF via `/api/nearby-flavors`

**Location:** `worker/src/index.js:640`

The `location` parameter flows into an outbound fetch to Culver's locator API:
```javascript
const locatorUrl = `https://www.culvers.com/api/locator/getLocations?location=${encodeURIComponent(location.trim())}&limit=${limit}`;
```

The Worker acts as an open proxy to Culver's locator. An attacker can:
- Enumerate all Culver's locations through our Worker without rate limits from their IP
- Hammer Culver's API through our Worker, potentially getting our IP blocked
- The `location` param accepts any string (zip, city, coordinates, arbitrary text)

`encodeURIComponent` prevents URL injection, so the fetch target is always `culvers.com`. The risk is abuse volume, not request redirection.

**Status:** Open
**Remediation:** Add per-IP rate limiting to this endpoint (20 req/hour). Consider caching more aggressively — most legitimate use is from the map page with a small set of locations.

---

### MEDIUM — M2: CORS wildcard allows cross-origin abuse

**Location:** `worker/wrangler.toml:13`, `worker/src/index.js:271`

`ALLOWED_ORIGIN = ""` defaults to `Access-Control-Allow-Origin: *`. Any website can:
- Call `/api/v1/alerts/subscribe` (CSRF — see M3)
- Read all API responses (flavor data, metrics, forecast, catalog)
- Probe `/api/v1/alerts/status?token=X` for timing differences

**Status:** Open
**Remediation:** Set `ALLOWED_ORIGIN = "https://custard.chriskaschner.com"` in production wrangler.toml (or via `wrangler secret put`). This is a one-line change.

---

### MEDIUM — M3: No CSRF protection on POST subscribe

**Location:** `worker/src/alert-routes.js:55`, `docs/alerts.html:416-425`

The subscribe endpoint accepts `Content-Type: application/json` POST requests. While this triggers a CORS preflight (which is currently allowed by M2's wildcard), a malicious site could:
1. Craft a POST with a victim's email
2. The preflight passes due to `Access-Control-Allow-Origin: *`
3. A pending subscription is created and a confirmation email sent

The double opt-in requirement limits the impact (attacker can't activate the subscription), but the attacker can spam up to 3 confirmation emails per hour to any email address via the per-email rate limit.

**Status:** Partially mitigated (per-email rate limit at 3/hour, double opt-in required)
**Remediation:** Fixing M2 (restrict CORS origin) eliminates this. Additionally, consider validating the `Origin` header server-side.

---

### MEDIUM — M4: No rate limiting on public read endpoints

**Location:** `worker/src/index.js` (multiple routes)

These endpoints have no per-IP throttling:
- `/api/v1/flavors?slug=X` — triggers upstream fetch (budget-limited to 3/day/slug)
- `/api/v1/today?slug=X` — same
- `/api/v1/stores?q=X` — in-memory search, CPU-bound
- `/api/v1/nearby-flavors` — proxies to Culver's (see M1)
- `/api/v1/metrics/*` — D1 queries
- `/api/v1/forecast/*` — KV reads
- `/v1/og/*` — SVG generation

The fetch budget protects upstream Culver's from exhaustion, but the Worker itself absorbs unbounded load. An attacker can scrape the entire store manifest, all flavor data, and all metrics.

**Status:** Open
**Remediation:** Add lightweight per-IP rate limiting (100 req/min) using Cloudflare's built-in rate limiting rules or a KV-based counter. Prioritize `nearby-flavors`, `metrics`, and `og` endpoints which are most expensive.

---

### MEDIUM — M5: Missing security headers

**Location:** `worker/src/index.js` (all responses), GitHub Pages (docs/)

Neither the Worker nor GitHub Pages set standard security headers:

| Header | Current | Recommended |
|--------|---------|-------------|
| `X-Frame-Options` | Not set | `DENY` |
| `Content-Security-Policy` | Not set | `default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com` |
| `Strict-Transport-Security` | Not set | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | Not set | `nosniff` |

Without `X-Frame-Options`, pages can be iframed for clickjacking attacks. Without CSP, there's no defense-in-depth against XSS.

**Status:** Open
**Remediation:** Add a headers middleware to the Worker fetch handler. For GitHub Pages, add a `_headers` file in `docs/`.

---

### MEDIUM — M6: No SRI on CDN dependencies

**Location:** `docs/map.html:16-17`

Leaflet is loaded from unpkg.com without Subresource Integrity hashes:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
```

Also loads marker icons from `raw.githubusercontent.com` (`docs/map.html:616-625`).

If unpkg.com or the GitHub repo is compromised, malicious JavaScript executes in the context of the page with access to DOM, localStorage, and the ability to call our API.

**Status:** Open
**Remediation:** Add SRI hashes:
```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha384-<hash>" crossorigin=""></script>
```
Or self-host Leaflet in `docs/`.

---

### LOW — L1: Error messages leak internal details

**Location:** `worker/src/index.js:647`, `worker/src/index.js:486`

Raw `err.message` from network errors is returned to clients:
```javascript
{ error: `Failed to reach Culver's locator API: ${err.message}` }
```

Could expose DNS resolution failures, timeout specifics, or internal infrastructure details.

**Status:** Open
**Remediation:** Return generic error messages to clients. Log details server-side with `console.error()`.

---

### LOW — L2: KV race condition on rate limit counters

**Location:** `worker/src/alert-routes.js:129-131`

Rate limit check is read-then-write, not atomic:
```javascript
const ipCount = parseInt(await kv.get(ipKey) || '0', 10);
if (ipCount >= MAX_SUBSCRIBE_PER_IP_PER_HOUR) { ... }
await kv.put(ipKey, String(ipCount + 1), ...);
```

Two concurrent requests could both read `ipCount = 9`, both pass the `>= 10` check, and both increment, allowing 11 requests through. In practice this is a non-issue for current rate limits (10/hour), but it's not atomic.

**Status:** Accepted (low impact)
**Remediation:** None needed at current scale. If rate limiting becomes critical, use Cloudflare Durable Objects for atomic counters.

---

### LOW — L3: Subscription counter can drift

**Location:** `worker/src/alert-routes.js:375-393`

The `incrementEmailCount` / `decrementEmailCount` pattern uses non-atomic read-increment-write on a KV counter (`alert:email-count:{email}`). Concurrent subscribe + unsubscribe could cause the counter to drift. Over time, a user could be locked out of creating new subscriptions (counter shows 5 but they have 3 active).

**Status:** Accepted (unlikely at current scale)
**Remediation:** Consider periodic recount from `alert:sub:*` KV keys, or add a self-healing check when the counter blocks a subscription.

---

### LOW — L4: Confirm URL path coupling

**Location:** `worker/src/alert-routes.js:188`, `worker/src/index.js:284`

Confirmation emails link to `/api/v1/alerts/confirm?token=X`, but the route handler matches on the canonical path `/api/alerts/confirm` (after v1 stripping in `normalizePath()`). If the normalization logic changes, confirmation links in already-sent emails break silently.

**Status:** Accepted (fragile but functional)
**Remediation:** None needed. Document the dependency in code comments.

---

### LOW — L5: Token in query param (auth)

**Location:** `worker/src/index.js:101-114`

Bearer auth supports a `?token=` query param fallback. Query param tokens leak to:
- Browser history
- Referer headers
- CDN/proxy logs

The header-based `Authorization: Bearer` path is preferred.

**Status:** Accepted (legacy support, low risk for a flavor API)
**Remediation:** Consider deprecating `?token=` once all clients use the header.

---

### LOW — L6: Unused pickle import

**Location:** `src/calendar_sync.py:9`

`pickle` is imported but never used. Not a vulnerability, but importing a dangerous deserialization module is a code smell.

**Status:** Open
**Remediation:** Remove the import.

---

## Cross-Repo Findings

### MEDIUM — X1: Data poisoning chain (Culver's → all consumers)

**Scope:** custard-calendar + custard-tidbyt

If Culver's website serves malicious `__NEXT_DATA__` (compromised or redesigned), the Worker trusts it and propagates poisoned data to:

| Consumer | Persistence | Impact |
|----------|------------|--------|
| KV cache | 24h TTL | Stale data served to API consumers |
| D1 snapshots | Permanent | Historical data corrupted |
| Backfill SQLite | Permanent | ML models trained on bad data |
| Alert emails | Sent immediately | Offensive content in subscriber inboxes (HTML-escaped, no XSS) |
| ICS calendars | Until next sync | Malicious event names in calendars |
| Tidbyt display | 12h cache | Garbage text on device screen |
| Forecast models | Until retrained | Predictions skewed |

`escapeHtml()` and RFC 5545 `escapeText()` prevent code execution everywhere. The risk is **content injection** — offensive flavor names, phishing text in descriptions — not XSS or code execution.

**Status:** Open
**Remediation:** Add a flavor name validation layer in the Worker scraper before persisting to KV/D1:
- Length limit (max 100 chars for title, 500 for description)
- Character allowlist (letters, numbers, spaces, common punctuation)
- Optional: known-flavor allowlist (the pool is only ~42 names — anything new could be flagged rather than auto-persisted)

---

### LOW — X2: Tidbyt app trusts Worker API completely

**Scope:** custard-tidbyt

The Starlark app (`apps/culversfotd/culvers_fotd.star`) has no response validation beyond JSON parsing. A compromised Worker could return arbitrary strings in flavor names and dates.

**Actual risk is low** because:
- Starlark sandbox prevents code execution, file access, and process spawning
- Flavor names are truncated to 5 chars for display
- Only first 3 flavors rendered (`flavors[:3]`)
- Worst case: 12 hours of garbage text on a 64x32 pixel display

**Status:** Accepted
**Remediation:** Consider adding response size limit and field length validation in the Starlark app.

---

### LOW — X3: Hardcoded Worker URL in both repos

**Scope:** custard-calendar + custard-tidbyt

Both repos reference `https://custard-calendar.chris-kaschner.workers.dev`:
- `custard-tidbyt`: Hardcoded in Starlark app
- `custard-calendar`: In config.yaml and tools

If the Cloudflare account is compromised or the Worker domain changes, both repos break with no fallback.

**Status:** Accepted (single-author project, low risk)
**Remediation:** None needed at current scale. For future resilience, consider a custom domain with DNS-level failover.

---

## What's Already Done Well

These areas were reviewed and found to be properly implemented:

### Input Validation
- **Slug validation**: Regex whitelist (`/^[a-z0-9][a-z0-9_-]{1,59}$/`) + allowlist check against `VALID_SLUGS` set. Defense-in-depth. (`worker/src/index.js:37, 164`)
- **Email validation**: Regex + length limit (254 chars) + type check. (`worker/src/alert-routes.js:91`)
- **Favorites validation**: Array bounds (1-10), per-item type + length (100 chars). (`worker/src/alert-routes.js:108-122`)
- **Secondary store limit**: Max 3 enforced. (`worker/src/index.js:384-388`)

### HTML/Content Escaping
- **`escapeHtml()`**: Applied consistently in email templates, HTML responses, and SVG cards. Handles `& < > " '`. (`worker/src/email-sender.js:289-297`, `worker/src/alert-routes.js:428-436`)
- **`escapeText()`**: RFC 5545 iCalendar escaping for `\ ; , \n`. (`worker/src/ics-generator.js:49-55`)
- **SVG escaping**: `esc()` in social card generator prevents injection. (`worker/src/social-card.js:92`)
- **Frontend**: `escapeHtml()` + `escapeAttr()` in all HTML pages before DOM insertion. (`docs/map.html:668-675`, `docs/alerts.html:447-449`)

### Email Security
- **Double opt-in**: Confirmation required before activation. (`worker/src/alert-routes.js:76-211`)
- **Cryptographic tokens**: `crypto.randomUUID()` for confirm and unsubscribe tokens. (`worker/src/alert-routes.js:170, 244`)
- **Anti-enumeration**: All code paths return identical success messages regardless of whether email/subscription exists. (`worker/src/alert-routes.js:143-167`)
- **Rate limiting**: Per-IP (10/hour) + per-email (3 pending/hour) + per-email (5 active max). (`worker/src/alert-routes.js:126-157`)
- **Dedup keys**: Prevent re-emailing same flavor/date/subscription within 7 days. (`worker/src/alert-checker.js:92-98`)
- **RFC 6865 compliance**: `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers on all alert emails. (`worker/src/email-sender.js:154-157`)

### Database Security
- **D1 queries**: All use prepared statements with `?` placeholders. No string concatenation. (`worker/src/metrics.js`, `worker/src/snapshot-writer.js:62-73`)
- **KV keys**: All constructed from validated/generated inputs (slugs pass regex+allowlist, tokens are UUIDs, dates are formatted by code). No key injection possible.
- **SQLite (analytics)**: `pd.read_sql_query("SELECT * FROM flavors", con)` — hardcoded query, no user input. (`analytics/data_loader.py:26`)

### Python Security
- **No `shell=True`**: `subprocess.run()` uses list args. (`main.py:130, 150`)
- **Safe YAML**: `yaml.safe_load()` everywhere, never `yaml.load()`. (`main.py:37`, `src/flavor_service.py:231`)
- **No unsafe deserialization**: No `pickle.load()`, no `eval()`, no `exec()`.
- **HTTP timeouts**: All `requests.get()` calls include explicit timeouts. (`src/flavor_service.py:53`)

### Tidbyt Security
- **Starlark sandbox**: No file system access, no arbitrary network calls, no process spawning.
- **Safe JSON parsing**: Built-in Starlark `json` module, no code evaluation.
- **URL encoding**: `humanize.url_encode()` on all user-provided parameters.
- **Graceful fallback**: Three-tier cache (fresh → stale → demo data) prevents crash on API failure.

### Secrets Management
- **`.gitignore`**: Excludes `.env`, `credentials/`, `token.json`, `config.yaml`, `*.json.secret`.
- **Wrangler secrets**: `RESEND_API_KEY` and `ACCESS_TOKEN` configured via `wrangler secret put`, not in toml.
- **No hardcoded credentials**: Verified across all Python, JavaScript, and Starlark files.

### Fetch Budget / Circuit Breaker
- **Per-slug limit**: 3 upstream fetches/day per store. (`worker/src/index.js:34`)
- **Global limit**: 200 upstream fetches/day total. (`worker/src/index.js:33`)
- **Increment after success**: Counter only increments after successful fetch, preventing counter exhaustion on failures. (`worker/src/index.js:255`)

---

## Security Remediation Priority

| # | Finding | Severity | Effort | Action |
|---|---------|----------|--------|--------|
| 1 | M2: CORS wildcard | Medium | 1 min | Set `ALLOWED_ORIGIN` in wrangler.toml |
| 2 | M6: No SRI on Leaflet | Medium | 5 min | Add integrity hashes to script/link tags |
| 3 | M5: Missing security headers | Medium | 10 min | Add X-Frame-Options, X-Content-Type-Options |
| 4 | L1: Error message leaks | Low | 15 min | Genericize error responses |
| 5 | M1: SSRF via nearby-flavors | Medium | 30 min | Add per-IP rate limiting |
| 6 | L6: Unused pickle import | Low | 1 min | Remove import |
| 7 | X1: Data poisoning chain | Medium | 20 min | Add flavor name validation in scraper |
| 8 | M4: No rate limiting on reads | Medium | 1 hour | Add per-IP limits to expensive endpoints |
| 9 | M5: CSP header | Medium | 30 min | Define and deploy Content-Security-Policy |

---
---

# Observability Review

## Current State Summary

The system has **zero operational observability**. User-facing flavor metrics exist (frequency, trending, streaks), but there is no instrumentation for system health, data freshness, pipeline success rates, or error tracking. Every component can fail silently.

---

## What Can Fail Silently Today

### Worker (Cloudflare)

#### O1: Cron execution results are discarded

**Location:** `worker/src/index.js` (scheduled handler)

The `checkAlerts()` and `checkWeeklyDigests()` cron handlers return `{ sent, checked, errors }`, but the caller never logs or persists this. If the cron fails mid-execution, throws an exception, or accumulates errors, nothing is recorded. The `meta:last-alert-run` KV key captures timestamp/checked/sent but **not the errors array**.

**Impact:** Subscribers silently stop receiving emails. No way to detect this without manual testing.

#### O2: Upstream HTML parse failures are invisible

**Location:** `worker/src/flavor-fetcher.js`

When Culver's changes their HTML structure, `parseNextData()` throws with a generic error. Callers catch this and fall back to "See brand website for today's flavor." There is no metric tracking:
- How many stores failed parsing this run
- Whether the failure is a one-off network blip vs a structural HTML change
- Whether it's affecting one store or all 1,000+

**Impact:** If Culver's redesigns their page, all calendars, emails, and the map silently degrade to placeholder text. Nobody is alerted.

#### O3: D1 snapshot writes fail silently

**Location:** `worker/src/snapshot-writer.js:59-78`

```javascript
} catch (err) {
  console.error(`D1 snapshot write failed for ${slug}/${date}: ${err.message}`);
}
```

D1 write failures are caught and logged to `console.error()`, which goes to Cloudflare's ephemeral logs (not queryable, retained ~24h, lossy under load). The error does not propagate — the request succeeds from the user's perspective, but historical data stops accumulating.

**Impact:** Metrics endpoints (`/api/v1/metrics/*`) return increasingly stale data. The D1 database silently stops growing. No alerting.

#### O4: Email send failures are accumulated then lost

**Location:** `worker/src/alert-checker.js:111-132`

Email send errors are pushed to an `errors[]` array, which is returned from `checkAlerts()` — but as noted in O1, the caller discards this. Resend API errors (rate limits, bounces, blocked addresses) are never persisted or monitored.

**Impact:** Subscribers silently stop receiving emails. Bounce rates not tracked. Resend API quota not monitored.

#### O5: Flavor catalog corruption recovered silently

**Location:** `worker/src/flavor-catalog.js`

If the KV-stored flavor catalog is corrupted, the code silently falls back to the seed catalog. New flavors that were previously discovered are lost. No log that corruption occurred.

**Impact:** Flavor catalog regresses to the 32-flavor seed. Users on the alerts page see fewer flavors to choose from. Nobody is alerted.

#### O6: Health endpoint is a lie

**Location:** `worker/src/index.js` (/health route)

```javascript
return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
```

Always returns `ok` regardless of actual system state. Does not check:
- Whether KV is accessible
- Whether D1 is accessible
- Whether cron ran recently
- Whether upstream fetches are succeeding
- Whether email sending is working

**Impact:** External uptime monitors (UptimeRobot, Pingdom) will always report "healthy" even when the system is completely broken.

### Python Pipeline

#### O7: Flavor service stale fallback is silent

**Location:** `src/flavor_service.py`

When the Worker is down, the flavor service falls back to stale cache data with no logging or indication. The cache file has a `timestamp` but no consumer checks its age. The pipeline succeeds with data that could be days old.

**Impact:** Calendar events and Tidbyt display show stale flavors. No alerting on staleness.

#### O8: Main orchestration reports partial failures as success

**Location:** `main.py`

Each pipeline step (fetch → calendar → tidbyt) runs sequentially. If step 1 fails but the cache file exists from a previous run, steps 2 and 3 succeed with old data. The process exits 0 (success). No end-to-end validation that data is fresh.

**Impact:** Scheduled runs (cron/GitHub Actions) show green even when serving stale data.

#### O9: Batch forecast silently skips stores

**Location:** `analytics/batch_forecast.py`

Stores with fewer than 10 observations are silently skipped. If the SQLite database is truncated or corrupted, all stores could be skipped, producing an empty forecast JSON with no error.

**Impact:** Forecast endpoint returns 404 for stores that should have predictions. No alerting.

#### O10: Claude API call has no exception handling

**Location:** `analytics/forecast_writer.py` (generate_forecast_llm)

The `client.messages.create()` call has no try/except. If the Claude API is down, rate-limited, or returns an error, the entire forecast pipeline crashes with an unhandled exception.

**Impact:** Batch forecast generation fails entirely. No graceful degradation.

#### O11: SQLite has no data quality checks

**Location:** `analytics/data_loader.py`

`load_raw()` and `load_clean()` have no error handling on `sqlite3.connect()` or `pd.read_sql_query()`. No validation of:
- Schema (expected columns present?)
- Row count (reasonable number of observations?)
- Data freshness (most recent `flavor_date` within expected window?)
- Data integrity (any NULL store_slugs? Malformed dates?)

**Impact:** Corrupted or truncated SQLite produces garbage analytics/predictions with no warning.

---

## Proposed SLOs and SLIs

### SLO 1: Calendar Availability — 99.5% success rate

**SLI:** Successful `/calendar.ics` responses with real flavor data / total `.ics` requests

**What to measure:**
- Response status codes (200 vs 500/502)
- Presence of actual flavor names vs "See brand website" fallback text
- Number of events in generated calendar (should be ~14-30 per store)

**Breach indicator:** Fallback text appears in >5% of calendar responses for >1 hour.

### SLO 2: Alert Delivery — 99% of matching alerts delivered within 6 hours of cron

**SLI:** Alerts successfully sent / (subscribers × days with flavor match)

**What to measure:**
- Cron execution success/failure
- Per-cron: subscribers checked, emails sent, errors count
- Resend API response codes
- Dedup key write success

**Breach indicator:** `errors.length > 0` in any cron run, or `sent/checked` ratio drops below 50%.

### SLO 3: Data Freshness — All stores updated daily

**SLI:** Stores with successful upstream fetch in last 26 hours / total stores

**What to measure:**
- Last successful fetch timestamp per store (new KV key: `meta:last-fetch:{slug}`)
- Per-store fetch success/failure
- Overall fetch budget utilization (current: `meta:fetch-count`)

**Breach indicator:** Any store not fetched in >48 hours, or >10 stores not fetched in >26 hours.

### SLO 4: Upstream Parsing — 99% of fetches produce valid flavor data

**SLI:** Fetches returning parsed flavors / total fetches (excluding cache hits)

**What to measure:**
- Parse success vs "See brand website" fallback
- Error type: network failure vs HTML structure change vs empty response
- Brand-specific success rates (Culver's vs Kopp's vs others)

**Breach indicator:** Parse failure rate >10% for any single brand, or >5% globally.

### SLO 5: Forecast Freshness — Predictions updated daily

**SLI:** Stores with forecast updated in last 26 hours / stores with sufficient data

**What to measure:**
- Batch forecast execution success/failure
- Number of stores with forecasts generated
- Forecast file timestamp vs current time

**Breach indicator:** Forecast file older than 48 hours, or store count drops by >10% between runs.

---

## What Needs to Be Instrumented

### Tier 1: Persist cron results (highest impact, lowest effort)

The cron handlers already return structured results. Just persist them.

**Worker changes:**
- In the `scheduled` handler, write cron results to D1:
  ```sql
  CREATE TABLE cron_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handler TEXT NOT NULL,        -- 'daily_alerts' | 'weekly_digest'
    ran_at TEXT NOT NULL,         -- ISO timestamp
    checked INTEGER NOT NULL,    -- subscribers evaluated
    sent INTEGER NOT NULL,       -- emails sent
    errors_count INTEGER NOT NULL,
    errors_json TEXT,            -- JSON array of error strings
    duration_ms INTEGER
  );
  ```
- Log per-store fetch outcomes:
  ```sql
  CREATE TABLE fetch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    success INTEGER NOT NULL,    -- 1 or 0
    error_msg TEXT,
    source TEXT,                 -- 'cache' | 'upstream' | 'fallback'
    duration_ms INTEGER
  );
  ```

**Effort:** ~2 hours. Biggest bang for the buck.

### Tier 2: Real health check

Replace the static `/health` endpoint with an actual system check:

```javascript
// /health response
{
  "status": "ok" | "degraded" | "down",
  "timestamp": "...",
  "checks": {
    "kv": { "ok": true },
    "d1": { "ok": true, "last_snapshot": "2026-02-22T..." },
    "cron": { "ok": true, "last_run": "2026-02-22T12:00:00Z", "last_errors": 0 },
    "upstream": { "ok": true, "last_parse_failure": null },
    "email": { "ok": true, "last_send": "2026-02-22T12:05:00Z" }
  }
}
```

Check logic:
- Read `meta:last-alert-run` — verify timestamp within 25 hours
- Read latest `cron_runs` from D1 — verify `errors_count == 0`
- Read `meta:fetch-count` — verify not at circuit breaker limit
- Return `degraded` if any check fails, `down` if critical checks fail

**Effort:** ~3 hours.

### Tier 3: Data freshness tracking

Add per-store last-fetch timestamps:

- On successful upstream fetch, write `meta:last-fetch:{slug}` with ISO timestamp
- Health check scans these to detect stale stores
- New endpoint: `/api/v1/metrics/freshness` returns per-store age

**Effort:** ~1 hour.

### Tier 4: Upstream parse failure detection

Track parse failures by brand and detect HTML structure changes:

- On parse failure, increment `meta:parse-fail:{brand}` counter (daily TTL)
- If counter exceeds threshold (e.g., 5 failures in a day for same brand), set `meta:parse-alarm:{brand}`
- Health check reads alarm keys and includes in response
- Optional: Slack webhook notification on alarm

**Effort:** ~2 hours.

### Tier 5: Email delivery tracking

Log email send results to D1:

```sql
CREATE TABLE email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  resend_status INTEGER,
  error_msg TEXT
);
```

Track bounce rates, success rates, and Resend API health over time. Alert if success rate drops below 95%.

**Effort:** ~2 hours.

### Tier 6: Python pipeline observability

**Batch forecast:**
- Add try/except around Claude API call in `forecast_writer.py`
- Log per-store forecast generation results
- Write summary JSON with: stores_processed, stores_skipped, errors, duration_ms, timestamp
- Exit with non-zero code if errors > 0

**Data loader:**
- Add schema validation on load (expected columns, non-zero row count)
- Log data freshness (max `flavor_date` vs current date)
- Raise warning if data is >48 hours stale

**Main orchestration:**
- Track per-step timing
- Validate cache freshness before calendar/tidbyt steps
- Exit with non-zero code on any step failure (don't mask with stale data)

**Effort:** ~3 hours total.

---

## Alerting Rules

### Critical (immediate notification)

| Rule | Condition | Channel |
|------|-----------|---------|
| Cron failed | `cron_runs.errors_count > 0` or no run in 25h | Email to admin |
| All stores parse-failing | Parse failure rate > 50% for any brand | Email to admin |
| D1 write failures | >5 snapshot write errors in 1 hour | Email to admin |
| Forecast pipeline crash | Batch forecast exits non-zero | GitHub Actions notification |

### Warning (daily digest)

| Rule | Condition | Channel |
|------|-----------|---------|
| Stale stores | Any store not fetched in >48h | Daily summary email |
| Email delivery degraded | Send success rate < 95% over 24h | Daily summary email |
| Fetch budget near limit | Global count > 150/200 (75%) | Daily summary email |
| Forecast staleness | Forecast file older than 48h | Daily summary email |
| Data quality drift | SQLite row count drops or max date stale | Daily summary email |

### Informational (logged, not alerted)

| Rule | What to log |
|------|-------------|
| Per-cron execution | Checked, sent, errors, duration |
| Per-fetch outcome | Slug, source (cache/upstream/fallback), duration |
| Per-email result | Sub ID, success, Resend status code |
| Parse fallback used | Slug, brand, error message |
| Stale cache used | Slug, cache age |

---

## Metrics Dashboard (Internal)

If we build an internal dashboard (even a simple HTML page), these are the key panels:

### System Health
- Cron last-run timestamp + status (green/yellow/red)
- Global fetch budget utilization (bar: used/remaining out of 200)
- D1 snapshot write success rate (last 24h)
- Email send success rate (last 24h)

### Data Freshness
- Stores by last-fetch age (histogram: <6h, 6-12h, 12-24h, 24-48h, >48h)
- Forecast file age
- SQLite backfill age (max flavor_date vs today)

### Upstream Health
- Parse success rate by brand (last 24h)
- Parse failure count by brand (last 7 days, sparkline)
- Fallback usage rate (% of requests serving "See website" text)

### Alert Pipeline
- Subscribers by frequency (daily vs weekly, bar chart)
- Emails sent per day (last 30 days, line chart)
- Error rate per cron run (last 30 days)
- Dedup key count (approximate subscription activity)

---

## Observability Remediation Priority

| # | Item | Impact | Effort | Action |
|---|------|--------|--------|--------|
| 1 | O1: Persist cron results to D1 | Critical | 2h | New `cron_runs` table, log results in scheduled handler |
| 2 | O6: Real health check | Critical | 3h | Replace static `/health` with actual system checks |
| 3 | O2: Parse failure tracking | High | 2h | Counter per brand, alarm key, health check integration |
| 4 | O3: D1 write failure alerting | High | 1h | Propagate or count errors, include in health check |
| 5 | O4: Email send logging | High | 2h | New `email_log` D1 table, track Resend success rate |
| 6 | O7/O8: Python pipeline exit codes | Medium | 1h | Non-zero exit on failure, validate cache freshness |
| 7 | O10: Claude API exception handling | Medium | 15m | Add try/except in `generate_forecast_llm()` |
| 8 | O11: SQLite data quality checks | Medium | 1h | Schema validation, row count, freshness check in `load_clean()` |
| 9 | O9: Forecast skip logging | Low | 30m | Log skipped stores, validate non-zero output |
| 10 | O5: Catalog corruption detection | Low | 30m | Log when fallback to seed occurs |
| 11 | Data freshness tracking | Medium | 1h | Per-store `meta:last-fetch:{slug}` KV keys |
| 12 | Internal metrics dashboard | Low | 4h | Simple HTML page reading from D1 cron_runs/email_log |

---

## Review History

| Date | Reviewer | Scope | Findings |
|------|----------|-------|----------|
| 2026-02-22 | Claude (automated) | Security: Worker, frontend, Python, Tidbyt, cross-repo | 6 medium, 6 low, 3 cross-repo |
| 2026-02-22 | Claude (automated) | Observability: Worker cron, Python pipeline, data freshness | 11 silent failure modes, 5 proposed SLOs, 12 remediation items |
