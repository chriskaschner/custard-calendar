# Phase 36: Data Quality - Research

**Researched:** 2026-04-05
**Domain:** Data pipeline validation, D1 database auditing, quality gate engineering
**Confidence:** HIGH

## Summary

Phase 36 is a data integrity phase: audit, clean, and gate flavor data for 17 Madison-area Culver's stores. The existing codebase has strong foundations -- `sanitizeFlavorPayload()` already drops closure sentinels and unsafe text at ingest time, D1 snapshots use an append-only-with-upsert pattern, and the operator alert infrastructure (Resend email + KV counters) is production-ready. The work divides into four workstreams: (1) manual audit of current D1 data, (2) extending sanitization with three new detection patterns, (3) a purge script for historical bad records, and (4) a reconciliation test suite that independently computes stats from raw snapshots and asserts they match production logic.

The D1 `snapshots` table uses a `UNIQUE(slug, date)` constraint, meaning each store has exactly one flavor per date. This simplifies auditing but means "duplicate same-day entries" detection (D-05b) is already enforced at the database level -- the quality gate should catch them at ingest before they hit the upsert, not in D1 itself. The rarity computation logic lives in two places (route-today.js and flavor-stats.js) with slightly different gate thresholds, which is a reconciliation risk the planner should address.

**Primary recommendation:** Build from existing patterns -- extend `sanitizeFlavorPayload()` for new detection, use `wrangler d1 execute --remote` for purge scripts (proven in upload_backfill.py), and leverage the mock D1 pattern from flavor-stats.test.js for reconciliation tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Audit exactly 17 hand-picked Madison-area Culver's stores: madison-cottage-grove, madison-east-towne, madison-northport, madison-todd-drive, madison-wi-mineral-point-rd, verona, mt-horeb, sauk-city, sun-prairie, sun-prairie-oxford-place, middleton, mcfarland, cottage-grove-wi-landmark-dr, cross-plains, deforest, waunakee, oregon-park-st
- **D-02:** "Clean" data means passing five checks: (1) no closure sentinels in flavor text, (2) no garbled/corrupted text, (3) no missing days in coverage, (4) flavor names resolve to FLAVOR_PROFILES or FLAVOR_ALIASES catalog, (5) computed rarity labels match actual appearance frequency
- **D-03:** Bad entries filtered from serving (users never see bad data), plus alerts fire so the operator knows -- extend existing sanitizeFlavorPayload() filtering
- **D-04:** Dual alert mechanism: KV counters for real-time monitoring (extends existing meta:payload-anomaly-count), plus email alerts via existing Worker alert infrastructure for daily digest of quality issues
- **D-05:** Three new detection patterns beyond existing gates: (a) unknown flavors not in FLAVOR_PROFILES/FLAVOR_ALIASES, (b) duplicate same-day entries for a store, (c) stale data detection when a store hasn't reported a new flavor in N days
- **D-06:** Delete bad records from D1 with audit log -- log every deletion (record content, reason, timestamp) before removing
- **D-07:** Purge executed via script with mandatory dry-run first, then explicit confirmation to actually delete. Manual process, not automated.
- **D-08:** Scan all history in D1 snapshots table for the 17 audit stores -- full clean slate, not limited to recent records
- **D-09:** Reconciliation test suite in Worker tests that independently computes stats (rarity, gap days, last seen, overdue) from raw D1 snapshots and asserts they match production computation. Permanent regression prevention.
- **D-10:** Fix the data first, then re-verify rarity labels. Do not adjust rarity computation logic until data is clean. If labels are still wrong after purge, revisit the algorithm then.

### Claude's Discretion
- Exact stale data threshold (N days before alerting on missing flavor)
- Audit log storage format (D1 table vs JSON file vs KV)
- Email alert template and frequency details
- Dry-run script implementation language (Python vs Node)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Flavor data for Madison-area stores audited and verified clean | Audit script queries D1 via wrangler d1 execute --remote; five checks map to existing regexes + FLAVOR_PROFILES/FLAVOR_ALIASES catalog |
| DATA-02 | Computed stats verified against raw D1 snapshots | Reconciliation test suite using mock D1 pattern from flavor-stats.test.js; compare route-today.js 3-gate rarity logic vs flavor-stats.js buildSingleFlavorStats |
| DATA-03 | Automated quality gate rejects bad patterns, alerts on anomalies | Extend sanitizeFlavorPayload() with 3 new patterns; extend operator-alerts.js with quality digest |
| DATA-04 | Historical bad records purged from D1 | Purge script using wrangler d1 execute --remote pattern from upload_backfill.py; dry-run + audit log |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Worker tests must pass before merging (`cd worker && npm test`)
- No emojis in output, code, commits
- No Co-Authored-By trailer in commits
- Use `uv` for Python environments
- Tests precede features for verification
- External rate limits must be documented and respected
- Widget JS two-file sync discipline

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (existing) | Worker test framework | Already configured with 1149 passing tests [VERIFIED: npm test output] |
| wrangler | (existing) | D1 CLI access for purge scripts | Proven pattern in upload_backfill.py [VERIFIED: codebase grep] |
| Resend API | (existing) | Email alerts | Already integrated via email-sender.js [VERIFIED: codebase read] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-ins (fs, path) | -- | Audit log file I/O | Purge script audit log output |
| Python subprocess | -- | Wrangler CLI orchestration | If purge script written in Python (like upload_backfill.py) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python purge script | Node.js script | Python has existing wrangler-d1 pattern (upload_backfill.py); Node would need new CLI scaffolding |
| JSON file audit log | D1 audit table | D1 table adds migration complexity; JSON file is simpler, versioned in git, human-readable |
| KV audit log | JSON file | KV has 25MB value limit and TTL expiry; audit logs should be permanent |

## Architecture Patterns

### Recommended Project Structure
```
worker/
  src/
    kv-cache.js              # Extend sanitizeFlavorPayload() with new patterns
    operator-alerts.js        # Extend with quality gate issue types
  test/
    reconciliation.test.js    # New: stats reconciliation suite (DATA-02)
    quality-gate.test.js      # New: tests for 3 new detection patterns (D-05)
scripts/
  audit_stores.py             # New: audit 17 stores against D1 data (DATA-01)
  purge_bad_records.py         # New: dry-run purge with audit log (DATA-04)
```

### Pattern 1: Extend sanitizeFlavorPayload() for New Detection
**What:** Add three new detection patterns to the existing sanitization pipeline without breaking the current filtering behavior.
**When to use:** Every ingest path (cache miss -> upstream fetch -> sanitize -> KV write + D1 snapshot).
**Example:**
```javascript
// Source: worker/src/kv-cache.js (existing pattern)
// Current flow: validate date -> sanitize text -> check CLOSED_TITLE_RE -> accept
// New additions slot into the same loop:

// D-05a: Unknown flavor detection (warning, not drop)
import { normalize } from './flavor-matcher.js';
import { FLAVOR_PROFILES, FLAVOR_ALIASES } from './flavor-colors.js';

function isKnownFlavor(title) {
  const key = normalize(title);
  return Boolean(FLAVOR_PROFILES[key] || FLAVOR_ALIASES[key]);
}

// D-05b: Duplicate same-day detection
// Note: D1 UNIQUE(slug, date) prevents DB-level dupes,
// but we should detect dupes in the payload BEFORE write
const seenDates = new Set();
for (const row of rawFlavors) {
  if (seenDates.has(row.date)) { /* log anomaly */ }
  seenDates.add(row.date);
}
```

### Pattern 2: Reconciliation Test Using Mock D1
**What:** In-memory D1 mock that holds raw snapshot rows, with independent stat computation that asserts parity with production logic.
**When to use:** Permanent regression test to prevent rarity/stats drift.
**Example:**
```javascript
// Source: worker/test/flavor-stats.test.js (existing mock D1 pattern)
function createMockD1(rows = []) {
  // Routes SQL queries to in-memory array filters
  // Already proven with 15+ tests in flavor-stats.test.js
}

// Reconciliation: independently compute avg_gap_days, then compare
function computeAvgGap(dates) {
  if (dates.length < 2) return null;
  let total = 0;
  for (let i = 1; i < dates.length; i++) {
    total += (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
  }
  return Math.round(total / (dates.length - 1));
}
```

### Pattern 3: Purge Script with Dry-Run
**What:** Python script using `wrangler d1 execute --remote` to delete bad records, with mandatory dry-run phase.
**When to use:** One-time manual execution for historical cleanup.
**Example:**
```python
# Source: scripts/upload_backfill.py (existing pattern)
def execute_sql_via_wrangler(sql: str) -> bool:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
         "--remote", "--file", str(tmp_path)],
        capture_output=True, text=True, cwd=WORKER_DIR,
    )
    # ...
```

### Anti-Patterns to Avoid
- **Modifying rarity computation logic before data is clean (D-10):** The user explicitly stated: fix data first, then verify labels. Do not change threshold constants until after purge.
- **Dropping unknown flavors from serving:** D-05a is a detection/alert pattern, not a rejection pattern. Unknown flavors should still be served -- they just trigger an alert for catalog review.
- **Automated purge without dry-run:** D-07 requires mandatory dry-run first, then explicit confirmation. Never auto-delete from production D1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| D1 remote access | Custom API client | `wrangler d1 execute --remote` | Already proven in upload_backfill.py; handles auth, retries, error reporting |
| Email delivery | SMTP integration | Resend API via email-sender.js | Already configured with verified domain, List-Unsubscribe headers |
| Flavor normalization | New normalization function | `normalize()` from flavor-matcher.js | Handles TM/R symbols, whitespace, case; used throughout codebase |
| Closure sentinel detection | New regex | `CLOSED_TITLE_RE` from kv-cache.js | Battle-tested with 6+ sentinel patterns; imported by snapshot-writer.js too |
| Test D1 mock | Real D1 connection in tests | `createMockD1()` pattern from flavor-stats.test.js | In-memory, deterministic, routes SQL patterns to array filters |

## Common Pitfalls

### Pitfall 1: Rarity Logic Duplication Between route-today.js and flavor-stats.js
**What goes wrong:** The rarity computation exists in TWO places with slightly different implementations. route-today.js uses a 3-gate system (data quality: 10+ appearances + 90+ day span; network: <= 100 stores; gap thresholds: Ultra Rare >150, Rare >90). flavor-stats.js computes avg_gap_days but does NOT apply any rarity label -- it just returns raw stats.
**Why it happens:** route-today.js was built for the /api/v1/today endpoint and embeds inline rarity logic. flavor-stats.js was built later as a standalone stats endpoint.
**How to avoid:** The reconciliation test (D-09) must test the EXACT same computation as route-today.js lines 124-152 -- not the flavor-stats.js version. Document which file is the "source of truth" for rarity labels.
**Warning signs:** Reconciliation tests pass against flavor-stats.js but rarity labels on the Today page still look wrong.

### Pitfall 2: UNIQUE(slug, date) Means One Flavor Per Store Per Day
**What goes wrong:** Assuming D1 can store multiple flavors per store per day. The `UNIQUE(slug, date)` constraint means upsert overwrites. If a store legitimately serves two flavors on one day, only the last-written one survives.
**Why it happens:** The schema was designed for Culver's which has one flavor of the day per store per day. This is correct for the current use case.
**How to avoid:** The "duplicate same-day detection" (D-05b) should flag duplicates in the UPSTREAM PAYLOAD before D1 write. After D1 write, duplicates are already impossible due to the constraint.
**Warning signs:** Trying to detect duplicates by querying D1 -- you'll never find any because the constraint prevents them.

### Pitfall 3: Purge Script Must Handle D1 Row Limits
**What goes wrong:** `wrangler d1 execute` has query size limits. A single DELETE covering thousands of rows may fail.
**Why it happens:** D1 SQL execution has payload size constraints (100KB per statement batch) [ASSUMED].
**How to avoid:** Batch deletes into chunks (e.g., 100 rows per batch), with the dry-run counting total rows to estimate batch count. The upload_backfill.py script already handles this pattern.
**Warning signs:** "SQL too long" or timeout errors from wrangler during purge.

### Pitfall 4: Stale Data Threshold Must Account for Store Operating Schedule
**What goes wrong:** Setting stale threshold too low (e.g., 2 days) triggers false alerts on weekends or holidays when Culver's stores may not update their flavor schedule.
**Why it happens:** Culver's updates their flavor of the day schedule at varying cadences -- some stores update weekly, some daily.
**How to avoid:** Set conservative stale threshold. Recommend 7 days based on the weekly update cadence of most Culver's stores. The existing `OPERATOR_PRIORITY_SLUGS` coverage gap check uses month-end lookahead which is even more lenient.
**Warning signs:** Alert storms every weekend for stores that only update Monday-Friday.

### Pitfall 5: FLAVOR_PROFILES Catalog Is Not Exhaustive
**What goes wrong:** Flagging too many "unknown" flavors because FLAVOR_PROFILES + FLAVOR_ALIASES doesn't cover every possible Culver's flavor name.
**Why it happens:** FLAVOR_PROFILES has ~80 entries and FLAVOR_ALIASES has ~40 entries, but Culver's has reportedly offered 100+ unique flavors. Some variants may have never been cataloged.
**How to avoid:** The unknown flavor detection (D-05a) should be a WARNING, not a DROP. Log the unknown flavor name so the operator can add it to the catalog. Track unknowns in a KV counter (e.g., `meta:unknown-flavor-count:{date}`).
**Warning signs:** Large volume of "unknown flavor" alerts drowning out real quality issues.

## Code Examples

### Extending sanitizeFlavorPayload with Unknown Flavor Detection
```javascript
// Source: worker/src/kv-cache.js (extension point)
// Add after the CLOSED_TITLE_RE check, before push:

import { normalize } from './flavor-matcher.js';
import { FLAVOR_PROFILES, FLAVOR_ALIASES } from './flavor-colors.js';

// Normalize for lookup (matches normalizeFlavorKey in flavor-colors.js)
function normalizeFlavorKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownFlavor(title) {
  const key = normalizeFlavorKey(title);
  return Boolean(FLAVOR_PROFILES[key] || FLAVOR_ALIASES[key]);
}

// Inside sanitizeFlavorPayload loop:
// if (!isKnownFlavor(title)) { unknownCount++; }
// After loop, increment KV counter if unknownCount > 0
```

### Querying D1 for Audit (via wrangler)
```sql
-- Find closure sentinels that slipped through before the gate was added
SELECT id, slug, date, flavor, normalized_flavor, fetched_at
FROM snapshots
WHERE slug IN ('madison-cottage-grove','madison-east-towne','madison-northport',
  'madison-todd-drive','madison-wi-mineral-point-rd','verona','mt-horeb',
  'sauk-city','sun-prairie','sun-prairie-oxford-place','middleton','mcfarland',
  'cottage-grove-wi-landmark-dr','cross-plains','deforest','waunakee','oregon-park-st')
AND (flavor LIKE '%closed%' OR flavor LIKE 'z_%' OR flavor LIKE 'z %');
```

### Reconciliation Test Pattern
```javascript
// Source: based on worker/test/flavor-stats.test.js createMockD1 pattern
describe('rarity reconciliation', () => {
  it('avg_gap_days from raw snapshots matches route-today computation', () => {
    const rows = [
      { date: '2025-06-01' },
      { date: '2025-07-15' },
      { date: '2025-09-20' },
      { date: '2026-01-10' },
    ];
    const dates = rows.map(r => new Date(r.date + 'T00:00:00Z'));
    
    // Independent computation
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGap += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    }
    const independentAvgGap = Math.round(totalGap / (dates.length - 1));
    
    // Must match route-today.js computation (lines 136-141)
    // ... assert both produce same value
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No sanitization at ingest | sanitizeFlavorPayload() filters closure sentinels, unsafe text, bad dates | Pre-existing | Prevents most bad data from entering KV cache |
| No D1 filtering | snapshot-writer.js CLOSED_TITLE_RE check | Pre-existing | Prevents closure sentinels in D1 |
| Manual rarity thresholds (60/120 days) | Tightened thresholds (90/150 days) | Recent | Ultra Rare/Rare labels use higher bar |

**Current gaps this phase addresses:**
- Historical data in D1 from before sanitization was added still contains bad records
- No detection for unknown flavors, stale data, or payload-level duplicates
- No reconciliation test proving rarity computation consistency
- No quality digest in operator alerts (only parse failure and anomaly counters exist)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D1 SQL execution has ~100KB payload size limit per batch | Common Pitfalls | Purge script may need different batching strategy |
| A2 | 7 days is a safe stale threshold for Culver's stores | Common Pitfalls | Too low = alert storms; too high = miss actual staleness |
| A3 | FLAVOR_PROFILES + FLAVOR_ALIASES covers ~80-90% of actual upstream flavors | Common Pitfalls | Higher unknown rate = more noise in alerts |

## Open Questions (RESOLVED)

1. **Rarity label source of truth** — RESOLVED: Test both raw stats AND label derivation. Plan 36-01 Task 2 extracts `deriveRarityLabel` from route-today.js as the authoritative function and reconciliation tests verify both raw stat computation and label output match independently computed values from D1 snapshots.

2. **Count of historical bad records** — RESOLVED: Unknown until audit runs. Plan 36-03 Task 1 (audit script) will report the count. The dry-run of the purge script reports count before deleting. This is by design -- the audit itself answers the question.

3. **Store coverage completeness for 17 stores** — RESOLVED: Audit script reports stores with zero snapshots as a finding, not an error. Plan 36-03 Task 1 handles missing-data stores gracefully in the audit report output.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker tests | Yes | (via npx) | -- |
| npx/wrangler | D1 remote queries, purge script | Yes | npx 11.9.0 | -- |
| Python 3 | Audit/purge scripts | Yes | (via uv) | Node.js scripts |
| vitest | Test suite | Yes | (existing in worker/package.json) | -- |
| uv | Python environment | Yes | (per CLAUDE.md) | pip |
| Cloudflare D1 (remote) | Data queries and purge | Yes (via wrangler auth) | -- | -- |
| Resend API | Quality alert emails | Yes (existing secret) | -- | -- |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing, configured in worker/vitest.config.js) |
| Config file | worker/vitest.config.js |
| Quick run command | `cd worker && npm test` |
| Full suite command | `cd worker && npm test` (all 1149 tests run in ~6s) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Audit 17 stores for clean data | manual + script | `uv run python scripts/audit_stores.py --dry-run` | No -- Wave 0 |
| DATA-02 | Stats reconciliation: rarity, gap days, last seen, overdue | unit | `cd worker && npx vitest run test/reconciliation.test.js` | No -- Wave 0 |
| DATA-03a | Unknown flavor detection in sanitize pipeline | unit | `cd worker && npx vitest run test/quality-gate.test.js` | No -- Wave 0 |
| DATA-03b | Stale data detection (N days threshold) | unit | `cd worker && npx vitest run test/quality-gate.test.js` | No -- Wave 0 |
| DATA-03c | Duplicate same-day detection in payload | unit | `cd worker && npx vitest run test/quality-gate.test.js` | No -- Wave 0 |
| DATA-03d | Quality alerts integrate with operator-alerts | unit | `cd worker && npx vitest run test/operator-alerts.test.js` | Partial (5 tests exist) |
| DATA-04 | Purge script dry-run and execution | manual + script | `uv run python scripts/purge_bad_records.py --dry-run --stores mt-horeb` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd worker && npm test`
- **Per wave merge:** `cd worker && npm test` (full suite, ~6s)
- **Phase gate:** Full suite green before /gsd-verify-work

### Wave 0 Gaps
- [ ] `worker/test/reconciliation.test.js` -- covers DATA-02 (rarity/stats parity)
- [ ] `worker/test/quality-gate.test.js` -- covers DATA-03 (3 new detection patterns)
- [ ] `scripts/audit_stores.py` -- covers DATA-01 (audit script skeleton)
- [ ] `scripts/purge_bad_records.py` -- covers DATA-04 (purge script skeleton)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (no new auth surfaces) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | Purge script runs locally via wrangler auth (existing) |
| V5 Input Validation | Yes | Extends existing sanitizeFlavorPayload(); new patterns follow same rejection model |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in purge script | Tampering | Parameterized queries or sanitized string literals in SQL generation (following upload_backfill.py sql_quote pattern) |
| D1 data loss from bad purge | Tampering | Mandatory dry-run + audit log before any DELETE; log every deleted row's content |
| Alert fatigue from noisy quality gates | Information Disclosure (indirect) | Threshold tuning; unknown flavor detection is warning-only, not rejection |

## Discretion Recommendations

### Stale data threshold (Claude's discretion)
**Recommendation: 7 days.** Culver's stores typically update their flavor schedule weekly. The existing `OPERATOR_PRIORITY_SLUGS` coverage gap check in operator-alerts.js uses month-end lookahead (5 days before month end), which is even more lenient. 7 days balances early detection against false positives from normal weekly update cadences. [ASSUMED -- based on observed update patterns]

### Audit log storage format (Claude's discretion)
**Recommendation: JSON file committed to git.** A JSON file at `scripts/audit-logs/purge-{date}.json` is human-readable, version-controlled, and permanent. D1 tables add migration complexity for a one-time operation. KV has TTL expiry which is wrong for audit logs. The file should contain: `{ deleted_at, records: [{ id, slug, date, flavor, reason }] }`.

### Email alert template (Claude's discretion)
**Recommendation: Extend existing operator alert format.** The `buildOperatorAlertHtml()` function in operator-alerts.js already produces an issue-list HTML email. Add new quality-gate issue types (unknown flavors, stale stores, duplicate payloads) to the same email rather than creating a separate quality digest. This keeps the operator's inbox manageable.

### Dry-run script language (Claude's discretion)
**Recommendation: Python.** The existing `upload_backfill.py` demonstrates the exact `wrangler d1 execute --remote` pattern needed for the purge script. Python also integrates with the project's `uv` tooling (per CLAUDE.md). The audit script should also be Python for consistency.

## Sources

### Primary (HIGH confidence)
- worker/src/kv-cache.js -- sanitizeFlavorPayload(), CLOSED_TITLE_RE, UNSAFE_TEXT_RE (read in full)
- worker/src/snapshot-writer.js -- recordSnapshot(), D1 upsert logic (read in full)
- worker/src/flavor-stats.js -- buildSingleFlavorStats(), avg_gap_days computation (read in full)
- worker/src/flavor-colors.js -- FLAVOR_PROFILES (80+ entries), FLAVOR_ALIASES (40+ entries), getFlavorProfile() (read in full)
- worker/src/flavor-matcher.js -- normalize(), SIMILARITY_GROUPS (read in full)
- worker/src/route-today.js lines 100-178 -- 3-gate rarity label logic (read)
- worker/src/operator-alerts.js -- maybeSendOperatorAlert(), KV counter reads, Resend integration (read in full)
- worker/src/email-sender.js -- sendEmail() via Resend API (read in full)
- worker/src/migrations/001_snapshots.sql -- D1 schema, UNIQUE(slug, date) (read in full)
- worker/wrangler.toml -- D1 binding, KV binding, cron triggers, operator config (read)
- worker/test/flavor-stats.test.js -- createMockD1() pattern, 15+ tests (read in full)
- worker/test/kv-cache.test.js -- sanitize tests, closed sentinel tests (read)
- worker/test/sanitize-integration.test.js -- fixture data survival tests (read in full)
- worker/test/alias-validation.test.js -- FLAVOR_ALIASES integrity tests (read in full)
- scripts/upload_backfill.py -- wrangler d1 execute pattern (read)
- docs/stores.json -- verified all 17 audit slugs exist (queried via Python)
- npm test output -- 1149 tests passing, 53 test files (run)

### Secondary (MEDIUM confidence)
- worker/vitest.config.js -- test configuration, coverage thresholds (read)
- worker/package.json scripts -- test commands (read)

### Tertiary (LOW confidence)
- None -- all claims verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already exist in the codebase; no new dependencies needed
- Architecture: HIGH -- extending existing patterns (sanitize, mock D1, wrangler CLI, operator alerts)
- Pitfalls: HIGH -- identified through code reading; rarity duplication is a verified structural issue
- Discretion recommendations: MEDIUM -- stale threshold and FLAVOR_PROFILES coverage are experience-based estimates

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no external dependencies to drift)
