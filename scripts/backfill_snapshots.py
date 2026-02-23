#!/usr/bin/env python3
"""Backfill D1 snapshots table from local SQLite backfill data.

Reads from data/backfill/flavors.sqlite, normalizes flavors using the
same logic as flavor-matcher.js, and uploads to D1 via wrangler.

Usage:
    uv run python scripts/backfill_snapshots.py                    # All stores
    uv run python scripts/backfill_snapshots.py --store mt-horeb
    uv run python scripts/backfill_snapshots.py --dry-run
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

D1_DATABASE_NAME = "custard-snapshots"
WORKER_DIR = Path(__file__).resolve().parents[1] / "worker"
SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "backfill" / "flavors.sqlite"

BATCH_SIZE = 200

# Brand detection patterns mirroring BRAND_REGISTRY in worker/src/index.js
BRAND_PATTERNS = [
    (re.compile(r"^kopps-"), "Kopp's"),
    (re.compile(r"^gilles$"), "Gille's"),
    (re.compile(r"^hefners$"), "Hefner's"),
    (re.compile(r"^kraverz$"), "Kraverz"),
    (re.compile(r"^oscars"), "Oscar's"),
]


def brand_from_slug(slug: str) -> str:
    """Derive brand name from slug, matching Worker BRAND_REGISTRY patterns."""
    for pattern, brand in BRAND_PATTERNS:
        if pattern.search(slug):
            return brand
    return "Culver's"


def normalize_flavor(name: str) -> str:
    """Normalize a flavor name exactly as flavor-matcher.js does.

    Strips registered/trademark/copyright symbols, lowercases,
    collapses whitespace, and trims.
    """
    if not name:
        return ""
    result = name
    result = result.replace("\u00ae", "")  # (R)
    result = result.replace("\u2122", "")  # (TM)
    result = result.replace("\u00a9", "")  # (C)
    result = result.lower()
    result = re.sub(r"\s+", " ", result)
    result = result.strip()
    return result


def sql_quote(value: str) -> str:
    """SQL-quote a string for inline VALUES clauses."""
    return "'" + value.replace("'", "''") + "'"


def read_sqlite(store: str | None = None) -> list[dict]:
    """Read rows from the backfill SQLite database."""
    if not SQLITE_PATH.exists():
        print(f"SQLite file not found: {SQLITE_PATH}", file=sys.stderr)
        return []

    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row

    if store:
        rows = conn.execute(
            "SELECT store_slug, flavor_date, title, description, fetched_at "
            "FROM flavors WHERE store_slug = ? ORDER BY flavor_date",
            (store,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT store_slug, flavor_date, title, description, fetched_at "
            "FROM flavors ORDER BY store_slug, flavor_date"
        ).fetchall()

    conn.close()
    return [dict(r) for r in rows]


def build_sql_batch(rows: list[dict]) -> str:
    """Build a SQL batch of INSERT ON CONFLICT DO NOTHING statements."""
    lines = []
    for row in rows:
        slug = row["store_slug"]
        brand = brand_from_slug(slug)
        date = row["flavor_date"]
        flavor = row["title"]
        normalized = normalize_flavor(flavor)
        description = row.get("description", "") or ""
        fetched_at = row.get("fetched_at", "")

        lines.append(
            "INSERT INTO snapshots (brand, slug, date, flavor, normalized_flavor, description, fetched_at) "
            f"VALUES ({sql_quote(brand)}, {sql_quote(slug)}, {sql_quote(date)}, "
            f"{sql_quote(flavor)}, {sql_quote(normalized)}, {sql_quote(description)}, "
            f"{sql_quote(fetched_at)}) "
            "ON CONFLICT(slug, date) DO NOTHING;"
        )
    return "\n".join(lines) + "\n"


def execute_sql(sql: str) -> bool:
    """Execute SQL against remote D1 via wrangler."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)

    result = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", D1_DATABASE_NAME,
            "--remote",
            "--file", str(tmp_path),
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)

    if result.returncode != 0:
        print(f"D1 batch failed: {result.stderr}", file=sys.stderr)
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill D1 snapshots from SQLite")
    parser.add_argument("--store", type=str, default=None,
                        help="Backfill a single store slug")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print SQL without executing")
    args = parser.parse_args()

    rows = read_sqlite(args.store)
    if not rows:
        print("No rows to backfill.", file=sys.stderr)
        return 1

    print(f"Found {len(rows)} rows to backfill")

    total_batches = (len(rows) + BATCH_SIZE - 1) // BATCH_SIZE
    uploaded = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        sql = build_sql_batch(batch)

        if args.dry_run:
            print(f"--- Batch {batch_num}/{total_batches} ({len(batch)} rows) ---")
            print(sql[:500])
            if len(sql) > 500:
                print(f"... ({len(sql)} chars total)")
            uploaded += len(batch)
            continue

        print(f"Uploading batch {batch_num}/{total_batches} ({len(batch)} rows)...")
        if execute_sql(sql):
            uploaded += len(batch)
        else:
            print(f"Batch {batch_num} failed, stopping.", file=sys.stderr)
            break

    print(f"Backfilled {uploaded}/{len(rows)} rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
