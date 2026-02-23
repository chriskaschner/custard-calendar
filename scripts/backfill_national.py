#!/usr/bin/env python3
"""National backfill: fetch all stores not yet in the local SQLite.

Reads the store manifest (docs/stores.json), skips stores already in the DB,
and fetches flavor calendars from the Worker API for the rest. Uses a thread
pool for parallel fetching with a write lock on SQLite.

Usage:
    python scripts/backfill_national.py
    python scripts/backfill_national.py --workers 20
    python scripts/backfill_national.py --batch-size 100
    python scripts/backfill_national.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

API_BASES = [
    "https://custard.chriskaschner.com",
    "https://custard-calendar.chris-kaschner.workers.dev",
]
USER_AGENT = "custard-backfill/2.0"
DB_PATH = Path("data/backfill/flavors.sqlite")
MANIFEST_PATH = Path("docs/stores.json")

db_lock = threading.Lock()
counter_lock = threading.Lock()
stats = {"success": 0, "failures": 0, "flavors": 0, "done": 0}


def fetch_flavors(slug: str, timeout: int = 30) -> dict:
    last_err: Exception | None = None
    for base in API_BASES:
        url = f"{base}/api/v1/flavors?slug={slug}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last_err = err
            continue
    raise last_err if last_err else RuntimeError("Unknown fetch failure")


def process_store(slug: str, conn: sqlite3.Connection, fetched_at: str, total: int) -> None:
    try:
        data = fetch_flavors(slug)
        flavors = data.get("flavors", [])

        with db_lock:
            for f in flavors:
                conn.execute(
                    """INSERT OR IGNORE INTO flavors
                       (store_slug, flavor_date, title, description, source, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (slug, f.get("date", ""), f.get("title", ""),
                     f.get("description", ""), "worker-api", fetched_at),
                )
            conn.commit()

        with counter_lock:
            stats["success"] += 1
            stats["flavors"] += len(flavors)
            stats["done"] += 1
            n = stats["done"]
        print(f"[{n}/{total}] {slug}: {len(flavors)} flavors", flush=True)

    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        with counter_lock:
            stats["failures"] += 1
            stats["done"] += 1
            n = stats["done"]
        print(f"[{n}/{total}] {slug}: ERROR {err}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="National flavor backfill")
    parser.add_argument("--workers", type=int, default=10, help="Parallel fetch threads (default 10)")
    parser.add_argument("--batch-size", type=int, default=0, help="Max stores to fetch (0=all)")
    parser.add_argument("--dry-run", action="store_true", help="Show counts without fetching")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text())
    all_slugs = [s["slug"] for s in manifest["stores"]]

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    existing = set(r[0] for r in conn.execute("select distinct store_slug from flavors").fetchall())
    missing = [s for s in all_slugs if s not in existing]

    print(f"manifest={len(all_slugs)} existing={len(existing)} missing={len(missing)}")

    if args.dry_run:
        return 0

    target = missing[:args.batch_size] if args.batch_size > 0 else missing
    if not target:
        print("nothing to fetch")
        return 0

    fetched_at = datetime.now(timezone.utc).isoformat()
    total = len(target)
    print(f"fetching {total} stores with {args.workers} threads...\n")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_store, slug, conn, fetched_at, total): slug for slug in target}
        for future in as_completed(futures):
            future.result()  # propagate exceptions

    conn.close()
    print(f"\ndone: success={stats['success']} failures={stats['failures']} flavors_added={stats['flavors']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
