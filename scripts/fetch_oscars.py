#!/usr/bin/env python3
"""Fetch Oscar's flavors from outside Cloudflare and publish them to KV + D1.

Why this exists: oscarscustard.com sits behind Cloudflare bot protection that
returns a 403 "Just a moment..." challenge to our Worker's egress. Verified on
2026-08-04 from a Worker running on Cloudflare's edge -- every header variant
tried (bot UA, plain Chrome UA, full Chrome + Sec-Fetch-*, no headers at all,
against both the REST API and the public page) was challenged, while the exact
same request from a residential IP returned 200. The block is on the calling
network, not on anything we send, so no fetcher change can fix it. Oscar's had
been dark since 2026-02-22 before anyone noticed.

So the fetch has to happen somewhere that is not Cloudflare. This script runs in
GitHub Actions and writes the result in through the front door.

It writes BOTH stores:
  - D1 snapshots   -- durable, and what the stale-but-honest fallback serves
  - KV cache       -- the Worker's fast path, 24h TTL, shared across both slugs

The parse itself is not reimplemented here; scripts/oscars_parse.mjs calls the
Worker's own parser, sanitizer and cache-record builder so the two paths cannot
drift.

Usage:
    uv run python scripts/fetch_oscars.py --dry-run
    uv run python scripts/fetch_oscars.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import urllib.request
import urllib.error

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_DIR = REPO_ROOT / "worker"
PARSE_SCRIPT = REPO_ROOT / "scripts" / "oscars_parse.mjs"

D1_DATABASE_NAME = "custard-snapshots"
# FLAVOR_CACHE binding in worker/wrangler.toml.
KV_NAMESPACE_ID = "1642a7da91e144cb9b233b940430250c"
KV_TTL_SECONDS = 86400  # Matches KV_TTL_SECONDS in worker/src/kv-cache.js.

SOURCE_URL = "https://www.oscarscustard.com/wp-json/wp/v2/pages?slug=flavors&_fields=content"

# Both Oscar's locations serve the same schedule and share one KV key.
OSCARS_SLUGS = ["oscars-muskego", "oscars-new-berlin"]
BRAND = "Oscar's"

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

CHALLENGE_MARKERS = ("just a moment", "cf-browser-verification", "challenge-platform")


def fetch_source() -> str:
    """GET the WordPress REST payload, failing loudly on a bot challenge."""
    req = urllib.request.Request(
        SOURCE_URL,
        headers={
            "User-Agent": BROWSER_UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.oscarscustard.com/",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        if exc.code == 403 and any(m in body.lower() for m in CHALLENGE_MARKERS):
            raise SystemExit(
                "FAIL: Oscar's served a Cloudflare bot challenge to this runner too.\n"
                "The whole point of running here is to egress from somewhere that is "
                "not blocked, so this host is no better than the Worker.\n"
                "Options: run the fetch from a residential/other network, or ask "
                "Oscar's to allowlist us."
            )
        raise SystemExit(f"FAIL: HTTP {exc.code} fetching Oscar's: {body[:200]}")
    except urllib.error.URLError as exc:
        raise SystemExit(f"FAIL: could not reach Oscar's: {exc.reason}")

    if any(m in body.lower() for m in CHALLENGE_MARKERS):
        raise SystemExit("FAIL: response body looks like a Cloudflare challenge page, not JSON.")
    return body


def parse_payload(raw: str) -> dict:
    """Run the Worker's parser over the payload via scripts/oscars_parse.mjs."""
    result = subprocess.run(
        ["node", str(PARSE_SCRIPT)],
        input=raw,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    if result.returncode != 0:
        raise SystemExit(f"FAIL: parse failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def sql_quote(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def build_snapshot_sql(flavors: list[dict], fetched_at: str) -> str:
    """Upsert rows for both slugs, mirroring recordSnapshot() in the Worker.

    The ON CONFLICT guard is copied from worker/src/snapshot-writer.js: a
    re-fetch may correct a recent day, but must not rewrite history.
    """
    lines = []
    for slug in OSCARS_SLUGS:
        for f in flavors:
            lines.append(
                "INSERT INTO snapshots "
                "(brand, slug, date, flavor, normalized_flavor, description, fetched_at) "
                f"VALUES ({sql_quote(BRAND)}, {sql_quote(slug)}, {sql_quote(f['date'])}, "
                f"{sql_quote(f['title'])}, {sql_quote(f['normalized_flavor'])}, "
                f"{sql_quote(f.get('description', ''))}, {sql_quote(fetched_at)}) "
                "ON CONFLICT(slug, date) DO UPDATE SET "
                "flavor = excluded.flavor, normalized_flavor = excluded.normalized_flavor, "
                "description = excluded.description, fetched_at = excluded.fetched_at "
                "WHERE excluded.date >= date('now', '-7 days');"
            )
    return "\n".join(lines) + "\n"


def execute_sql_via_wrangler(sql: str) -> bool:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False) as tmp:
        tmp.write(sql)
        tmp_path = Path(tmp.name)
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", D1_DATABASE_NAME, "--remote", "--file", str(tmp_path)],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"  wrangler d1 error: {result.stderr.strip()}", file=sys.stderr)
    return result.returncode == 0


def put_kv_record(key: str, record: str) -> bool:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        tmp.write(record)
        tmp_path = Path(tmp.name)
    result = subprocess.run(
        [
            "npx", "wrangler", "kv", "key", "put", key,
            "--namespace-id", KV_NAMESPACE_ID,
            "--path", str(tmp_path),
            # wrangler 4 spells this --ttl; --expiration-ttl is rejected outright.
            "--ttl", str(KV_TTL_SECONDS),
            "--remote",
        ],
        capture_output=True,
        text=True,
        cwd=WORKER_DIR,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"  wrangler kv error: {result.stderr.strip()}", file=sys.stderr)
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Fetch and parse, write nothing")
    args = parser.parse_args()

    print(f"Fetching {SOURCE_URL}")
    payload = parse_payload(fetch_source())
    flavors = payload["flavors"]
    dates = [f["date"] for f in flavors]
    print(
        f"Parsed {len(flavors)} flavors ({min(dates)} -> {max(dates)}), "
        f"{payload['dropped']} dropped of {payload['rawCount']} raw"
    )

    if args.dry_run:
        for f in flavors[:5]:
            print(f"  {f['date']}  {f['title']}")
        print(f"  ... ({len(flavors)} total)")
        print("\nDry run: nothing written.")
        return 0

    fetched_at = datetime.now(timezone.utc).isoformat()

    print(f"Writing {len(flavors) * len(OSCARS_SLUGS)} snapshot rows to D1...")
    if not execute_sql_via_wrangler(build_snapshot_sql(flavors, fetched_at)):
        print("FAIL: D1 write failed", file=sys.stderr)
        return 1

    print(f"Writing KV cache record {payload['cacheKey']} (ttl {KV_TTL_SECONDS}s)...")
    if not put_kv_record(payload["cacheKey"], payload["kvRecord"]):
        # D1 already succeeded, so the stale-but-honest fallback can still serve.
        print("FAIL: KV write failed (D1 write succeeded)", file=sys.stderr)
        return 1

    print(f"OK: Oscar's published for {', '.join(OSCARS_SLUGS)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
