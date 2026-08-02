---
status: resolved
trigger: "The Week Ahead section on the site shows 'No data' for some days (e.g., Sunday Apr 5). Culver's and Kopp's aren't scraping flavors."
created: 2026-04-03T00:00:00Z
updated: 2026-08-02T00:00:00Z
---

## Current Focus

hypothesis: Two separate issues confirmed -- see Resolution
test: n/a (root causes confirmed, fix shipped in 02a5038)
expecting: n/a
next_action: none -- closed

## Symptoms

expected: Week Ahead section should show flavor data for upcoming days, at least for the next few days where upstream sites publish data
actual: "No data" appears for some days in the Week Ahead. User says Culver's and Kopp's aren't scraping. Today's flavor and tomorrow seem to have data, but Sunday (Apr 5) shows "No data".
errors: No visible errors on the page
reproduction: View the main page and check Week Ahead section. Some days show "No data" where flavors should be.
started: Current issue as of 2026-04-03. Kopp's has been broken since the sanitization regex was introduced (commit 472668d). Culver's Apr 5 gap is expected (Easter).

## Eliminated

- hypothesis: Culver's upstream site changed its __NEXT_DATA__ format
  evidence: API returns 60 flavors for mt-horeb, all dates present except Apr 5. Parser working correctly.
  timestamp: 2026-04-04T00:40:00Z

- hypothesis: Kopp's changed its HTML structure
  evidence: parseKoppsHtml() works perfectly locally -- extracts 28 flavors from current HTML. The parser is fine.
  timestamp: 2026-04-04T00:45:00Z

- hypothesis: Kopp's URL redirect (flavor-forecast -> flavor-preview) breaks fetch
  evidence: Cloudflare Worker fetch follows redirects automatically. Network logs show 301 -> 301 -> 200 chain completing successfully.
  timestamp: 2026-04-04T00:48:00Z

- hypothesis: Cloudflare Bot Management blocks Worker-to-Kopp's subrequest
  evidence: Network trace in wrangler logs shows successful 200 response from kopps.com. Data is received.
  timestamp: 2026-04-04T00:48:00Z

## Evidence

- timestamp: 2026-04-04T00:38:00Z
  checked: Live API response for mt-horeb (Culver's)
  found: 60 flavors returned, all dates from Apr 1-May 31 present EXCEPT Apr 5
  implication: Culver's scraping works fine. Apr 5 gap is specific to this date.

- timestamp: 2026-04-04T00:39:00Z
  checked: What day is April 5, 2026
  found: Easter Sunday 2026. Culver's locations are closed on Easter.
  implication: The Apr 5 "No data" for Culver's is EXPECTED behavior, not a bug.

- timestamp: 2026-04-04T00:40:00Z
  checked: Live API response for kopps-greenfield
  found: Returns 502 error: "Failed to fetch flavor data. Please try again later."
  implication: Kopp's scraping is genuinely broken. All 3 Kopp's locations affected (shared KV key).

- timestamp: 2026-04-04T00:43:00Z
  checked: Kopp's upstream HTML with local Node.js
  found: parseKoppsHtml returns 28 valid flavors from current live HTML.
  implication: Parser is fine. Problem is in the sanitization pipeline.

- timestamp: 2026-04-04T00:48:00Z
  checked: Wrangler local dev with error logging added to handleApiFlavors
  found: Error is "No valid flavor entries after sanitization for kopps-greenfield" thrown at kv-cache.js:236
  implication: sanitizeFlavorPayload rejects ALL 28 Kopp's entries. Need to check why.

- timestamp: 2026-04-04T00:50:00Z
  checked: sanitizeFlavorPayload against Kopp's parsed data
  found: All 28 entries dropped. Dates valid, titles valid, but descriptions fail SAFE_TEXT_RE validation.
  implication: The pipe character "|" in descriptions is the culprit.

- timestamp: 2026-04-04T00:52:00Z
  checked: SAFE_TEXT_RE regex in kv-cache.js
  found: Regex /^[\p{L}\p{N}\s.,''\u2019\u201C\u201D&()!:+\-/%\u00ae\u2122]*$/u does NOT include pipe "|"
  implication: Kopp's fetcher joins multi-flavor descriptions with " | " (line 129), which the sanitizer rejects.

- timestamp: 2026-04-04T00:53:00Z
  checked: sanitizeText logic in kv-cache.js lines 50-56
  found: When SAFE_TEXT_RE fails, sanitizeText returns null. Then at line 77, condition (descriptionRaw && description == null) drops the entry.
  implication: Entries with invalid descriptions are fully dropped, not just description-stripped.

- timestamp: 2026-04-04T00:54:00Z
  checked: Git history for SAFE_TEXT_RE introduction
  found: Added in commit 472668d (feat: enforce route-class auth and abuse guards). Pipe was never included.
  implication: Kopp's has been broken since this commit was deployed. Regression since the auth guards feature.

- timestamp: 2026-04-04T00:55:00Z
  checked: All 1134 worker tests
  found: All pass. No test covers Kopp's data flowing through sanitizeFlavorPayload.
  implication: Test gap -- Kopp's integration path (parse -> sanitize) is untested.

## Resolution

root_cause: TWO SEPARATE ISSUES:

1. **Culver's Apr 5 gap (NOT A BUG):** April 5, 2026 is Easter Sunday. Culver's restaurants are closed on Easter, so the upstream site does not publish a Flavor of the Day for that date. The "No data" for Sunday is expected and correct.

2. **Kopp's fully broken (BUG):** The SAFE_TEXT_RE regex in `worker/src/kv-cache.js` (line 7) does not include the pipe character `|`. Kopp's fetcher joins multiple flavor descriptions with ` | ` (kopp-fetcher.js line 129). When sanitizeFlavorPayload runs, EVERY Kopp's entry fails the description regex check, sanitizeText returns null, and the entry is dropped (kv-cache.js line 77). Since ALL entries are dropped (0 valid, 28 raw), kv-cache.js line 236 throws "No valid flavor entries after sanitization", which surfaces as a 502 to the API consumer. This has been broken since commit 472668d introduced the SAFE_TEXT_RE regex.

fix: |
  Shipped in 02a5038.

  1. **Kopp's 502:** flipped the `SAFE_TEXT_RE` allowlist in `worker/src/kv-cache.js`
     to an `UNSAFE_TEXT_RE` blocklist (`/[<>`{}]/`). Injection characters are still
     rejected; ordinary punctuation like the pipe that Kopp's uses to join
     multi-flavor descriptions now passes. Added per-brand sanitize integration
     tests covering all 7 brands so this class of regression fails in CI rather
     than in production.
  2. **Culver's holiday gaps:** `docs/today-page.js` now detects Easter,
     Thanksgiving, and Christmas and renders a "Closed for {holiday}" card with
     the buster cone image instead of "No data".
verification: |
  - Kopp's confirmed serving in production 2026-08-02:
    `/api/v1/flavors?slug=kopps-greenfield` returns 200 with flavor entries
    (previously 502 across all 3 Kopp's locations).
  - Per-brand sanitize integration tests in `worker/test/sanitize-integration.test.js`.
files_changed:
  - worker/src/kv-cache.js
  - worker/test/kv-cache.test.js
  - worker/test/sanitize-integration.test.js
  - docs/today-page.js
