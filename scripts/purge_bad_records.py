#!/usr/bin/env python3
"""Purge bad historical records from D1 snapshots table.

Mandatory dry-run first (D-07). Logs every deletion (D-06).
Scans all history for 17 audit stores (D-08).

Detects two categories of bad records:
  1. Closure sentinels: flavor text matching CLOSED_TITLE_RE
  2. Corrupted text: flavor or description containing unsafe characters

Usage:
    uv run python scripts/purge_bad_records.py --dry-run           # Preview only
    uv run python scripts/purge_bad_records.py --execute            # Actually delete
    uv run python scripts/purge_bad_records.py --dry-run --store mt-horeb  # Single store
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"
AUDIT_LOG_DIR = Path(__file__).resolve().parent / "audit-logs"

# D-01: 17 Madison-area Culver's stores
AUDIT_SLUGS = [
    "madison-cottage-grove",
    "madison-east-towne",
    "madison-northport",
    "madison-todd-drive",
    "madison-wi-mineral-point-rd",
    "verona",
    "mt-horeb",
    "sauk-city",
    "sun-prairie",
    "sun-prairie-oxford-place",
    "middleton",
    "mcfarland",
    "cottage-grove-wi-landmark-dr",
    "cross-plains",
    "deforest",
    "waunakee",
    "oregon-park-st",
]

# Closure sentinels -- Python translation of JS regex in kv-cache.js
# JS: /\bclosed\b|^z[_ ]*(store|restaurant)?closed/i
CLOSED_TITLE_RE = re.compile(
    r"\bclosed\b|^z[_ ]*(store|restaurant)?closed", re.IGNORECASE
)

# Garbled/corrupted text
# JS: /[<>`{}]/
UNSAFE_TEXT_RE = re.compile(r"[<>`{}]")

# Batch size for DELETE statements (per RESEARCH Pitfall 3)
DELETE_BATCH_SIZE = 100


def sql_quote(value: str) -> str:
    """SQL-quote a string value for inline queries."""
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def execute_query_via_wrangler(sql: str) -> list[dict] | None:
    """Execute a SELECT query via wrangler d1 execute --remote --json.

    Returns parsed result rows or None on error.
    Uses --command instead of --file to avoid wrangler's batch upload API.
    """
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--command", sql,
            "--json",
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )

    if result.returncode != 0:
        print(f"  wrangler error: {result.stderr.strip()}", file=sys.stderr)
        return None

    try:
        data = json.loads(result.stdout)
        for item in data:
            results = item.get("results", [])
            if results is not None:
                return results
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        print(f"  JSON parse error: {exc}", file=sys.stderr)

    return None


def execute_sql_via_wrangler(sql: str) -> bool:
    """Execute a write SQL statement via wrangler d1 execute --remote.

    Returns True on success, False on error.
    Uses --command instead of --file to avoid wrangler's batch upload API.
    """
    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--command", sql,
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )

    if result.returncode != 0:
        print(f"  wrangler error: {result.stderr.strip()}", file=sys.stderr)
        return False

    return True


def classify_bad_record(row: dict) -> str | None:
    """Classify a record as bad and return the reason, or None if clean."""
    flavor = row.get("flavor", "")
    desc = row.get("description", "") or ""

    if CLOSED_TITLE_RE.search(flavor):
        return "closure_sentinel"
    if UNSAFE_TEXT_RE.search(flavor) or UNSAFE_TEXT_RE.search(desc):
        return "corrupted_text"

    return None


def find_bad_records(slugs: list[str]) -> list[dict]:
    """Query D1 and identify all bad records for the given stores."""
    slug_list = ", ".join(sql_quote(s) for s in slugs)
    sql = (
        f"SELECT id, slug, date, flavor, description, fetched_at "
        f"FROM snapshots WHERE slug IN ({slug_list}) ORDER BY slug, date"
    )

    print(f"Querying D1 for {len(slugs)} stores...")
    rows = execute_query_via_wrangler(sql)

    if rows is None:
        print("ERROR: Failed to query D1. Check wrangler authentication.", file=sys.stderr)
        return []

    print(f"Total records scanned: {len(rows)}")

    bad_records = []
    for row in rows:
        reason = classify_bad_record(row)
        if reason:
            bad_records.append({
                "id": row["id"],
                "slug": row["slug"],
                "date": row["date"],
                "flavor": row["flavor"],
                "reason": reason,
            })

    return bad_records


def write_audit_log(
    bad_records: list[dict],
    mode: str,
    stores_scanned: int,
) -> Path:
    """Write audit log JSON to scripts/audit-logs/purge-{date}.json.

    T-36-07 mitigation: every deleted row is logged before deletion.
    """
    AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.utcnow().strftime("%Y-%m-%d")
    log_path = AUDIT_LOG_DIR / f"purge-{today}.json"

    # If log already exists for today, append a counter
    counter = 1
    while log_path.exists():
        counter += 1
        log_path = AUDIT_LOG_DIR / f"purge-{today}-{counter}.json"

    log_data = {
        "purge_date": today,
        "mode": mode,
        "stores_scanned": stores_scanned,
        "records": bad_records,
        "total_deleted": len(bad_records) if mode == "execute" else 0,
    }

    log_path.write_text(json.dumps(log_data, indent=2) + "\n")
    print(f"Audit log written to: {log_path}")

    return log_path


def execute_purge(bad_records: list[dict]) -> tuple[int, int]:
    """Delete bad records from D1 in batches of DELETE_BATCH_SIZE.

    T-36-05 mitigation: batched deletes prevent runaway operations.

    Returns (deleted_count, failed_count).
    """
    ids = [r["id"] for r in bad_records]
    deleted = 0
    failed = 0

    for i in range(0, len(ids), DELETE_BATCH_SIZE):
        batch = ids[i : i + DELETE_BATCH_SIZE]
        id_list = ", ".join(str(id_) for id_ in batch)
        sql = f"DELETE FROM snapshots WHERE id IN ({id_list});"

        if execute_sql_via_wrangler(sql):
            deleted += len(batch)
            print(f"  Deleted batch [{min(i + len(batch), len(ids))}/{len(ids)}]")
        else:
            failed += len(batch)
            print(f"  FAILED batch starting at index {i}", file=sys.stderr)

    return deleted, failed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Purge bad historical records from D1 snapshots table"
    )
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview bad records without deleting (mandatory first step)",
    )
    mode_group.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete bad records (requires prior --dry-run review)",
    )
    parser.add_argument(
        "--store",
        metavar="SLUG",
        help="Purge a single store slug (default: all 17 audit stores)",
    )
    args = parser.parse_args()

    # Determine target slugs
    if args.store:
        if args.store not in AUDIT_SLUGS:
            print(f"WARNING: {args.store!r} is not in the 17 audit stores. "
                  "Proceeding anyway.", file=sys.stderr)
        slugs = [args.store]
    else:
        slugs = AUDIT_SLUGS

    mode = "dry-run" if args.dry_run else "execute"

    print(f"Custard Calendar D1 Purge")
    print(f"Mode: {mode}")
    print(f"Stores: {len(slugs)}")
    print()

    # Find bad records
    bad_records = find_bad_records(slugs)

    if not bad_records:
        print("\nNo bad records found. Data is clean.")
        # Still write audit log to document the scan
        write_audit_log([], mode, len(slugs))
        return 0

    # Summarize findings
    by_reason: dict[str, int] = defaultdict(int)
    by_store: dict[str, int] = defaultdict(int)
    for rec in bad_records:
        by_reason[rec["reason"]] += 1
        by_store[rec["slug"]] += 1

    print(f"\nBad records found: {len(bad_records)}")
    print("\nBy reason:")
    for reason, count in sorted(by_reason.items()):
        print(f"  {reason}: {count}")
    print("\nBy store:")
    for slug, count in sorted(by_store.items()):
        print(f"  {slug}: {count}")

    print("\nSample records:")
    for rec in bad_records[:10]:
        print(f"  id={rec['id']} slug={rec['slug']} date={rec['date']} "
              f"flavor={rec['flavor']!r} reason={rec['reason']}")
    if len(bad_records) > 10:
        print(f"  ... and {len(bad_records) - 10} more")

    if args.dry_run:
        # Write audit log in dry-run mode (for review)
        write_audit_log(bad_records, "dry-run", len(slugs))
        print(f"\nDry run complete. Review the audit log, then run with --execute to purge.")
        return 1 if bad_records else 0

    # Execute mode: write audit log BEFORE deleting (T-36-07)
    print("\nWriting audit log before deletion...")
    write_audit_log(bad_records, "execute", len(slugs))

    print(f"\nDeleting {len(bad_records)} bad records in batches of {DELETE_BATCH_SIZE}...")
    deleted, failed = execute_purge(bad_records)

    print(f"\nPurge complete: {deleted} deleted, {failed} failed")
    if failed > 0:
        print("WARNING: Some deletions failed. Review wrangler output above.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
