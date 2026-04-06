# Phase 36: Data Quality - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and clean flavor data for 17 Madison-area launch stores so public-facing pages show trustworthy information. Build automated quality gates to prevent bad data from reaching users going forward. Does NOT include SEO pages, social features, or new UI -- purely data pipeline integrity.

</domain>

<decisions>
## Implementation Decisions

### Audit scope & store list
- **D-01:** Audit exactly 17 hand-picked Madison-area Culver's stores: madison-cottage-grove, madison-east-towne, madison-northport, madison-todd-drive, madison-wi-mineral-point-rd, verona, mt-horeb, sauk-city, sun-prairie, sun-prairie-oxford-place, middleton, mcfarland, cottage-grove-wi-landmark-dr, cross-plains, deforest, waunakee, oregon-park-st
- **D-02:** "Clean" data means passing five checks: (1) no closure sentinels in flavor text, (2) no garbled/corrupted text, (3) no missing days in coverage, (4) flavor names resolve to FLAVOR_PROFILES or FLAVOR_ALIASES catalog, (5) computed rarity labels match actual appearance frequency

### Quality gate behavior
- **D-03:** Bad entries filtered from serving (users never see bad data), plus alerts fire so the operator knows -- extend existing sanitizeFlavorPayload() filtering
- **D-04:** Dual alert mechanism: KV counters for real-time monitoring (extends existing meta:payload-anomaly-count), plus email alerts via existing Worker alert infrastructure for daily digest of quality issues
- **D-05:** Three new detection patterns beyond existing gates: (a) unknown flavors not in FLAVOR_PROFILES/FLAVOR_ALIASES, (b) duplicate same-day entries for a store, (c) stale data detection when a store hasn't reported a new flavor in N days

### Historical purge policy
- **D-06:** Delete bad records from D1 with audit log -- log every deletion (record content, reason, timestamp) before removing
- **D-07:** Purge executed via script with mandatory dry-run first, then explicit confirmation to actually delete. Manual process, not automated.
- **D-08:** Scan all history in D1 snapshots table for the 17 audit stores -- full clean slate, not limited to recent records

### Stats verification
- **D-09:** Reconciliation test suite in Worker tests that independently computes stats (rarity, gap days, last seen, overdue) from raw D1 snapshots and asserts they match production computation. Permanent regression prevention.
- **D-10:** Fix the data first, then re-verify rarity labels. Do not adjust rarity computation logic until data is clean. If labels are still wrong after purge, revisit the algorithm then.

### Folded Todos
- **Alert on failed flavors and stores** -- aligns with D-04/D-05; quality gate alerts should cover both flavor-level and store-level failures (e.g., store returning no data for multiple days)

### Claude's Discretion
- Exact stale data threshold (N days before alerting on missing flavor)
- Audit log storage format (D1 table vs JSON file vs KV)
- Email alert template and frequency details
- Dry-run script implementation language (Python vs Node)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ingest & validation pipeline
- `worker/src/kv-cache.js` -- sanitizeFlavorPayload(), CLOSED_TITLE_RE, UNSAFE_TEXT_RE, anomaly KV counters
- `worker/src/snapshot-writer.js` -- recordSnapshot(), D1 upsert logic, closure sentinel filtering at write time

### Rarity & stats computation
- `worker/src/flavor-stats.js` -- buildSingleFlavorStats(), avg_gap_days, seasonality, dow_bias, overdue calculations
- `worker/src/route-today.js` lines 124-152 -- three-gate rarity label logic (10+ appearances, 90+ day span, gap thresholds)

### Data normalization & matching
- `worker/src/flavor-matcher.js` -- normalize() function, FLAVOR_PROFILES, FLAVOR_ALIASES

### Store manifest
- `worker/src/store-index.js` -- store slug registry, auto-generated from stores.json
- `docs/stores.json` -- full store list with city, state, address, coordinates

### Existing tests
- `worker/test/snapshot-writer.test.js` -- D1 upsert, closure filtering, missing field rejection tests
- `worker/test/flavor-stats.test.js` -- gap calculation, rarity label, seasonality tests with mock D1

### Requirements
- `.planning/REQUIREMENTS.md` -- DATA-01 through DATA-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sanitizeFlavorPayload()` in kv-cache.js: already filters closure sentinels, unsafe text, bad dates, enforces length limits -- extend with new patterns (D-05)
- `CLOSED_TITLE_RE` regex: proven closure sentinel detection -- reuse in purge script
- `normalize()` in flavor-matcher.js: text normalization for deduplication
- KV anomaly counters (`meta:payload-anomaly-count`): existing pattern for tracking quality issues
- Worker email alert infrastructure (`handleAlertRoute`): existing delivery mechanism for quality digests
- D1 mock pattern in `flavor-stats.test.js`: in-memory D1 mock for reconciliation tests

### Established Patterns
- Brand fetchers follow a common interface (fetch, parse, return normalized data)
- D1 snapshots use append-only upsert with `(slug, date)` unique constraint
- KV counters use `meta:` prefix namespace for operational metrics
- Worker tests use vitest with mock KV/D1 bindings

### Integration Points
- Quality gate hooks into existing `sanitizeFlavorPayload()` (pre-KV-write) and `recordSnapshot()` (pre-D1-write)
- Alert emails integrate with existing `handleAlertRoute()` in Worker
- Purge script needs Cloudflare D1 API access (wrangler d1 execute or REST API)
- Reconciliation tests connect to same mock D1 pattern used in flavor-stats.test.js

</code_context>

<specifics>
## Specific Ideas

- "Ultra rare every 30 days doesn't make sense most of the time" -- user-reported issue where rarity labels contradict actual appearance frequency. Root cause likely bad data inflating avg_gap_days.
- Fix data before algorithm: explicitly do NOT change rarity computation logic until after purge + verification proves the data is clean.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

### Reviewed Todos (not folded)
- **Add analytics tracking** -- general tracking, not specific to data quality. Belongs in a future observability phase.

</deferred>

---

*Phase: 36-data-quality*
*Context gathered: 2026-04-05*
