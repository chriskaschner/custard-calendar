# Phase 36: Data Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 36-data-quality
**Areas discussed:** Audit scope & store list, Quality gate behavior, Historical purge policy, Stats verification method

---

## Audit Scope & Store List

| Option | Description | Selected |
|--------|-------------|----------|
| Geographic radius from Madison | Pick all Culver's within ~30mi of downtown Madison | |
| Hand-pick a list | User provides the exact store slugs | Yes |
| All WI stores in stores.json | Broader scope -- audit every Wisconsin store | |

**User's choice:** Hand-picked list of 17 stores
**Notes:** User specified cities: Madison, Verona, Fitchburg (not found), Mt. Horeb, Sauk City, Sun Prairie, Middleton, McFarland, Cottage Grove, Cross Plains, DeForest, Waunakee, Oregon. Resolved to 17 slugs.

| Option | Description | Selected |
|--------|-------------|----------|
| No closure sentinels | Existing CLOSED_TITLE_RE pattern | Yes |
| No garbled/corrupted text | HTML entities, mojibake, non-printable chars | Yes |
| No missing days | Every store has flavor entry for every day | Yes |
| Flavor names resolve to known catalog | Matches FLAVOR_PROFILES or FLAVOR_ALIASES | Yes |

**User's choice:** All four checks plus computed stats sanity
**Notes:** User flagged "ultra rare every 30 days doesn't make sense" -- rarity labels should match actual frequency

---

## Quality Gate Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Filter + alert | Bad entries silently filtered, alert fires | Yes |
| Block entire store response | Serve nothing for store until fixed | |
| Serve with warning flag | Show data but mark as unreliable | |

**User's choice:** Filter + alert

| Option | Description | Selected |
|--------|-------------|----------|
| Email via existing alert system | Daily digest piggyback on handleAlertRoute | |
| KV counter + manual check | Increment counters, check /health | |
| Both email and KV counters | KV for real-time, email for daily digest | Yes |

**User's choice:** Both email and KV counters

| Option | Description | Selected |
|--------|-------------|----------|
| Unknown flavors | Reject flavors not in profiles/aliases | Yes |
| Duplicate same-day entries | Flag multiple flavors for same store+date | Yes |
| Stale data detection | Alert if store hasn't reported in N days | Yes |
| You decide | Claude picks additional patterns | |

**User's choice:** Unknown flavors, duplicate same-day entries, stale data detection

---

## Historical Purge Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Delete with audit log | Remove bad records, log every deletion first | Yes |
| Soft delete (flag, don't remove) | Add 'excluded' column, filter in queries | |
| Hard delete, no audit | Just DELETE rows | |

**User's choice:** Delete with audit log

| Option | Description | Selected |
|--------|-------------|----------|
| Script with dry-run first | Report what would be deleted, require confirmation | Yes |
| One-time migration in Worker | D1 migration that cleans on deploy | |
| Worker API endpoint | Admin-gated /admin/purge endpoint | |

**User's choice:** Script with dry-run first

| Option | Description | Selected |
|--------|-------------|----------|
| All history | Scan every record in D1 snapshots table | Yes |
| Last 90 days only | Only purge recent bad records | |
| Since store was added | Per-store from first snapshot date | |

**User's choice:** All history

---

## Stats Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Reconciliation test suite | Worker tests computing stats independently from raw snapshots | Yes |
| One-time audit script | Python script for initial verification | |
| Both -- script now, tests ongoing | One-time script + permanent test suite | |

**User's choice:** Reconciliation test suite

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the data first | Purge bad records, then re-verify labels | Yes |
| Tighten rarity logic now | Add sanity checks to computation | |
| Both -- fix data AND add guardrail | Clean data AND add runtime sanity check | |

**User's choice:** Fix the data first

---

## Folded Todos

- **Alert on failed flavors and stores** -- folded into scope (aligns with D-04/D-05)

## Deferred Ideas

- **Add analytics tracking** -- reviewed, not folded (general tracking, not data quality specific)

## Claude's Discretion

- Stale data threshold (N days)
- Audit log storage format
- Email alert template and frequency
- Dry-run script implementation language
