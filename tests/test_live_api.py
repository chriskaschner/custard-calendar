"""Live API integration smoke tests for the Custard Calendar Worker.

Verifies that the deployed Worker API responds with the shapes that
the Python pipeline and all sibling repos depend on. A failure here
means a production API regression that would silently break consumers.

Run:
    uv run pytest tests/test_live_api.py -v

These tests make real HTTP requests. Skip in offline CI by setting
SKIP_LIVE_API=1.

    SKIP_LIVE_API=1 uv run pytest tests/test_live_api.py -v
"""

from __future__ import annotations

import json
import os
import urllib.request

import pytest

WORKER_BASE = "https://custard.chriskaschner.com"
PRIORITY_SLUG = "mt-horeb"

_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "custard-calendar-smoke-test/1.0",
}

SKIP_LIVE = os.environ.get("SKIP_LIVE_API", "").strip() == "1"
skip_if_offline = pytest.mark.skipif(SKIP_LIVE, reason="SKIP_LIVE_API=1")


def _get(path: str) -> tuple[int, dict]:
    url = f"{WORKER_BASE}{path}"
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, {}


# ---------------------------------------------------------------------------
# /api/v1/flavors
# ---------------------------------------------------------------------------

class TestFlavorsEndpoint:
    @skip_if_offline
    def test_returns_200(self):
        status, _ = _get(f"/api/v1/flavors?slug={PRIORITY_SLUG}")
        assert status == 200, f"Expected 200, got {status}"

    @skip_if_offline
    def test_has_flavors_array(self):
        _, body = _get(f"/api/v1/flavors?slug={PRIORITY_SLUG}")
        assert "flavors" in body
        assert isinstance(body["flavors"], list)

    @skip_if_offline
    def test_flavors_have_required_fields(self):
        _, body = _get(f"/api/v1/flavors?slug={PRIORITY_SLUG}")
        flavors = body.get("flavors", [])
        assert len(flavors) > 0, "flavors array is empty"
        for i, f in enumerate(flavors):
            assert "title" in f, f"flavors[{i}] missing 'title'"
            assert "date" in f, f"flavors[{i}] missing 'date'"
            assert isinstance(f["title"], str) and f["title"], \
                f"flavors[{i}].title must be a non-empty string"
            assert isinstance(f["date"], str) and len(f["date"]) == 10, \
                f"flavors[{i}].date must be YYYY-MM-DD, got {f.get('date')!r}"

    @skip_if_offline
    def test_date_is_iso8601(self):
        _, body = _get(f"/api/v1/flavors?slug={PRIORITY_SLUG}")
        for i, f in enumerate(body.get("flavors", [])):
            date = f.get("date", "")
            parts = date.split("-")
            assert len(parts) == 3 and len(parts[0]) == 4, \
                f"flavors[{i}].date not YYYY-MM-DD: {date!r}"


# ---------------------------------------------------------------------------
# /api/v1/stores
# ---------------------------------------------------------------------------

class TestStoresEndpoint:
    @skip_if_offline
    def test_returns_200(self):
        status, _ = _get(f"/api/v1/stores?q={PRIORITY_SLUG}")
        assert status == 200, f"Expected 200, got {status}"

    @skip_if_offline
    def test_has_stores_array(self):
        _, body = _get(f"/api/v1/stores?q={PRIORITY_SLUG}")
        assert "stores" in body
        assert isinstance(body["stores"], list)

    @skip_if_offline
    def test_stores_have_required_fields(self):
        _, body = _get(f"/api/v1/stores?q={PRIORITY_SLUG}")
        stores = body.get("stores", [])
        assert len(stores) > 0, f"No stores returned for query '{PRIORITY_SLUG}'"
        for i, s in enumerate(stores):
            assert "name" in s, f"stores[{i}] missing 'name'"
            assert "slug" in s, f"stores[{i}] missing 'slug'"

    @skip_if_offline
    def test_mt_horeb_slug_in_results(self):
        _, body = _get(f"/api/v1/stores?q={PRIORITY_SLUG}")
        slugs = [s.get("slug") for s in body.get("stores", [])]
        assert PRIORITY_SLUG in slugs, \
            f"Expected '{PRIORITY_SLUG}' in results, got: {slugs}"


# ---------------------------------------------------------------------------
# /api/v1/today
# ---------------------------------------------------------------------------

class TestTodayEndpoint:
    @skip_if_offline
    def test_returns_200(self):
        status, _ = _get(f"/api/v1/today?slug={PRIORITY_SLUG}")
        assert status == 200, f"Expected 200, got {status}"

    @skip_if_offline
    def test_has_flavor_field(self):
        _, body = _get(f"/api/v1/today?slug={PRIORITY_SLUG}")
        # flavor may be null if store has no data today, but key must exist
        assert "flavor" in body, "Response missing 'flavor' key"

    @skip_if_offline
    def test_has_store_field(self):
        _, body = _get(f"/api/v1/today?slug={PRIORITY_SLUG}")
        assert "store" in body, "Response missing 'store' key"


# ---------------------------------------------------------------------------
# API version header
# ---------------------------------------------------------------------------

class TestApiVersionHeader:
    @skip_if_offline
    def test_version_header_present(self):
        """Worker sets API-Version on v1 responses."""
        url = f"{WORKER_BASE}/api/v1/flavors?slug={PRIORITY_SLUG}"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            version = resp.headers.get("API-Version", "")
            assert version, "API-Version header missing from /api/v1/ response"
            assert version == "1", f"Expected API-Version '1', got {version!r}"
