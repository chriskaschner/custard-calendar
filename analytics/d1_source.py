"""Read flavor observations from the live D1 `snapshots` table.

D1 is the dual-write target the Worker fills on every cron run, so it carries
current data that the frozen backfill sqlite cannot. As of 2026-08-02 it holds
~210k rows across ~1,000 stores spanning 2015-08-02 onward, against ~60k rows
across 522 stores ending 2026-03-31 in the backfill -- strictly more data, and
current.

Column names differ from the backfill schema and are aliased here so callers
get one shape regardless of source.

Access goes through the operator's existing wrangler auth rather than a new
secret or Worker route: these are read-only analytics queries run from a
laptop, and wrangler already holds credentials for D1.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pandas as pd

# analytics/ lives one level below the repo root; wrangler must run from worker/.
DEFAULT_WORKER_DIR = Path(__file__).resolve().parent.parent / "worker"

DEFAULT_D1_DATABASE = "custard-snapshots"

# D1 caps response size, and wrangler buffers the whole payload in memory.
DEFAULT_BATCH_SIZE = 10000


def _d1_query(
    database: str,
    sql: str,
    timeout_s: int = 180,
    worker_dir: Path | str = DEFAULT_WORKER_DIR,
) -> list[dict]:
    """Run one read-only SQL statement against remote D1 via wrangler.

    Uses the operator's existing wrangler auth -- no new secret and no new
    Worker surface. Requires `npx wrangler login` (or CLOUDFLARE_API_TOKEN).
    """
    proc = subprocess.run(
        [
            "npx", "wrangler", "d1", "execute", database,
            "--remote", "--json", "--command", sql,
        ],
        cwd=str(worker_dir),
        capture_output=True,
        text=True,
        timeout=timeout_s,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"wrangler d1 execute failed ({proc.returncode}).\n"
            f"Run `npx wrangler login` from worker/ if this is an auth error.\n"
            f"{proc.stderr.strip()[:2000]}"
        )

    # wrangler prints human-readable banners around the JSON payload.
    text = proc.stdout
    start = text.find("[")
    if start == -1:
        raise RuntimeError(f"No JSON array in wrangler output: {text[:500]}")
    payload = json.loads(text[start:])

    rows: list[dict] = []
    for block in payload:
        rows.extend(block.get("results", []) or [])
    return rows


def empty_flavor_frame(dataset_label: str) -> pd.DataFrame:
    """Empty frame with the same dtypes a populated one would have.

    Dtypes matter: a plain `pd.DataFrame(columns=[...])` gives `flavor_date`
    object dtype, and concatenating that with real frames downgrades the whole
    column, breaking the `.dt` accessor downstream.
    """
    return pd.DataFrame(
        {
            "store_slug": pd.Series(dtype="object"),
            "flavor_date": pd.Series(dtype="datetime64[ns]"),
            "title": pd.Series(dtype="object"),
            "description": pd.Series(dtype="object"),
            "source": pd.Series(dtype="object"),
            "fetched_at": pd.Series(dtype="object"),
            "dataset": pd.Series(dtype="object"),
        }
    )


def load_flavors_d1(
    database: str = DEFAULT_D1_DATABASE,
    batch_size: int = DEFAULT_BATCH_SIZE,
    worker_dir: Path | str = DEFAULT_WORKER_DIR,
) -> pd.DataFrame:
    """Load live snapshot rows from D1, paginated.

    Returns the backfill schema: store_slug, flavor_date, title, description,
    source, fetched_at, dataset.
    """
    frames: list[pd.DataFrame] = []
    offset = 0
    while True:
        sql = (
            "SELECT slug AS store_slug, date AS flavor_date, flavor AS title, "
            "COALESCE(description, '') AS description, 'd1' AS source, fetched_at "
            f"FROM snapshots ORDER BY id LIMIT {int(batch_size)} OFFSET {int(offset)}"
        )
        rows = _d1_query(database, sql, worker_dir=worker_dir)
        if not rows:
            break
        frames.append(pd.DataFrame(rows))
        if len(rows) < batch_size:
            break
        offset += batch_size

    if not frames:
        return empty_flavor_frame("d1")

    df = pd.concat(frames, ignore_index=True)
    df["dataset"] = "d1"
    df["flavor_date"] = pd.to_datetime(df["flavor_date"], errors="coerce")
    df = df.dropna(subset=["store_slug", "flavor_date", "title"]).copy()
    return df.reset_index(drop=True)
