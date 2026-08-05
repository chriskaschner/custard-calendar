"""Tests for scripts/fetch_oscars.py.

The ingest exists because oscarscustard.com 403s Cloudflare Worker egress with a
bot challenge. The two things worth pinning down are that a challenge served to
this runner fails loudly rather than publishing junk, and that the rows it
writes match what the Worker's own recordSnapshot() would have written.
"""

from __future__ import annotations

import io
import sys
import urllib.error
from pathlib import Path
from unittest.mock import patch

import pytest

_project_root = str(Path(__file__).resolve().parents[2])
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.fetch_oscars import (
    OSCARS_SLUGS,
    build_snapshot_sql,
    fetch_source,
    sql_quote,
)

CHALLENGE_BODY = (
    '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>'
)

FLAVORS = [
    {"date": "2026-08-04", "title": "Twix Twirl -or- Mango Berry",
     "normalized_flavor": "twix twirl or mango berry", "description": ""},
    {"date": "2026-08-05", "title": "Drum...Stixxx!",
     "normalized_flavor": "drum stixxx", "description": "cone"},
]


# ---------------------------------------------------------------------------
# sql_quote
# ---------------------------------------------------------------------------

def test_sql_quote_escapes_apostrophes():
    # Oscar's flavor names are full of them -- "Oscar's Delight", "Grand Ol' Flavor".
    assert sql_quote("Oscar's Delight") == "'Oscar''s Delight'"


def test_sql_quote_handles_none():
    assert sql_quote(None) == "NULL"


# ---------------------------------------------------------------------------
# build_snapshot_sql
# ---------------------------------------------------------------------------

def test_writes_rows_for_both_slugs():
    sql = build_snapshot_sql(FLAVORS, "2026-08-05T02:00:00+00:00")
    for slug in OSCARS_SLUGS:
        assert sql.count(f"'{slug}'") == len(FLAVORS)
    assert len(OSCARS_SLUGS) == 2


def test_preserves_history_with_the_workers_conflict_guard():
    # Copied from snapshot-writer.js: a re-fetch may correct a recent day but
    # must not rewrite older history.
    sql = build_snapshot_sql(FLAVORS, "2026-08-05T02:00:00+00:00")
    assert "ON CONFLICT(slug, date) DO UPDATE SET" in sql
    assert "WHERE excluded.date >= date('now', '-7 days')" in sql


def test_carries_brand_and_normalized_flavor():
    sql = build_snapshot_sql(FLAVORS, "2026-08-05T02:00:00+00:00")
    assert "'Oscar''s'" in sql
    assert "'twix twirl or mango berry'" in sql


# ---------------------------------------------------------------------------
# fetch_source challenge handling
# ---------------------------------------------------------------------------

def _http_error(code, body):
    return urllib.error.HTTPError(
        url="https://example.com", code=code, msg="err", hdrs=None,
        fp=io.BytesIO(body.encode()),
    )


def test_bot_challenge_fails_with_an_actionable_message():
    with patch("scripts.fetch_oscars.urllib.request.urlopen",
               side_effect=_http_error(403, CHALLENGE_BODY)):
        with pytest.raises(SystemExit) as exc:
            fetch_source()
    message = str(exc.value)
    assert "bot challenge" in message
    assert "allowlist" in message


def test_challenge_body_served_with_200_is_still_rejected():
    # A 200 carrying a challenge page would otherwise parse to zero flavors and
    # quietly publish an empty schedule.
    class FakeResp:
        def read(self):
            return CHALLENGE_BODY.encode()

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    with patch("scripts.fetch_oscars.urllib.request.urlopen", return_value=FakeResp()):
        with pytest.raises(SystemExit) as exc:
            fetch_source()
    assert "challenge page" in str(exc.value)


def test_other_http_errors_surface_the_status():
    with patch("scripts.fetch_oscars.urllib.request.urlopen",
               side_effect=_http_error(500, "boom")):
        with pytest.raises(SystemExit) as exc:
            fetch_source()
    assert "500" in str(exc.value)


def test_successful_fetch_returns_the_body():
    class FakeResp:
        def read(self):
            return b'[{"content":{"rendered":"<p>ok</p>"}}]'

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    with patch("scripts.fetch_oscars.urllib.request.urlopen", return_value=FakeResp()):
        assert fetch_source() == '[{"content":{"rendered":"<p>ok</p>"}}]'
