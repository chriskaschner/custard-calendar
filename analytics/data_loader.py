"""Load and clean the backfill SQLite dataset into pandas DataFrames.

Schema: flavors(store_slug TEXT, flavor_date TEXT, title TEXT, description TEXT,
                source TEXT, fetched_at TEXT)
- Primary key: (store_slug, flavor_date)
- Closed days appear as title = 'z *Restaurant Closed Today'
"""

import sqlite3
import warnings
from pathlib import Path

import pandas as pd

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "backfill" / "flavors.sqlite"

# Sentinel values in the dataset for closed stores
CLOSED_MARKERS = {
    "z *Restaurant Closed Today",
    "z *Closed Today for Remodel!",
}

# O11: Columns required for analytics pipeline to function correctly.
REQUIRED_COLUMNS = {"store_slug", "flavor_date", "title"}


def load_raw(db_path: Path | str = DEFAULT_DB) -> pd.DataFrame:
    """Load entire flavors table as-is."""
    con = sqlite3.connect(str(db_path))
    df = pd.read_sql_query("SELECT * FROM flavors", con)
    con.close()
    df["flavor_date"] = pd.to_datetime(df["flavor_date"])
    return df


def load_clean(db_path: Path | str = DEFAULT_DB) -> pd.DataFrame:
    """Load flavors, drop closed-day rows, add convenience columns.

    Returns DataFrame with columns:
        store_slug, flavor_date, title, description, source, fetched_at,
        dow (0=Mon..6=Sun), month, year

    Raises ValueError if required columns are missing.
    Emits UserWarning if the dataset is empty or stale (newest record > 7 days old).
    """
    df = load_raw(db_path)

    # O11: Column validation — fail fast on schema drift
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Backfill DB missing required columns: {missing}")

    # O11: Empty dataset warning
    if len(df) == 0:
        warnings.warn("Backfill DB is empty", UserWarning, stacklevel=2)

    df = df[~df["title"].isin(CLOSED_MARKERS)].copy()

    # O11: Freshness check — warn if newest record is more than 7 days old
    if len(df) > 0:
        newest = df["flavor_date"].max()
        age_days = (pd.Timestamp.now() - newest).days
        if age_days > 7:
            warnings.warn(
                f"Backfill DB may be stale: newest record is {age_days} days old",
                UserWarning,
                stacklevel=2,
            )

    df["dow"] = df["flavor_date"].dt.dayofweek  # 0=Mon, 6=Sun
    df["month"] = df["flavor_date"].dt.month
    df["year"] = df["flavor_date"].dt.year
    return df.reset_index(drop=True)


def flavor_list(df: pd.DataFrame) -> list[str]:
    """Sorted list of unique flavor titles in the dataset."""
    return sorted(df["title"].unique().tolist())


def store_list(df: pd.DataFrame) -> list[str]:
    """Sorted list of unique store slugs in the dataset."""
    return sorted(df["store_slug"].unique().tolist())
