"""Tests for static assets that frontend pages depend on.

These catch deployment failures where a page silently breaks because
a required static file is missing or malformed.
"""

import json
import re
from pathlib import Path

import pytest

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"
EXTERNAL_SCRIPT_RE = re.compile(r"<script[^>]+src=\"(https?://[^\"]+)\"([^>]*)>", re.IGNORECASE)
ALLOWED_EXTERNAL_SCRIPTS_WITHOUT_SRI = {
    "https://static.cloudflareinsights.com/beacon.min.js",
}


class TestFlavorsJson:
    """docs/flavors.json -- static fallback for the flavor catalog.

    radar.html and alerts.html load this file first before trying the
    Worker API. If it's missing or malformed, flavor search breaks silently.
    """

    def test_file_exists(self):
        assert (DOCS_DIR / "flavors.json").exists(), (
            "docs/flavors.json is missing. Flavor search will fail on pages "
            "served from non-production origins. Regenerate with: "
            "curl -s $WORKER_BASE/api/v1/flavors/catalog > docs/flavors.json"
        )

    def test_valid_json(self):
        data = json.loads((DOCS_DIR / "flavors.json").read_text())
        assert isinstance(data, dict)

    def test_has_flavors_array(self):
        data = json.loads((DOCS_DIR / "flavors.json").read_text())
        assert "flavors" in data
        assert isinstance(data["flavors"], list)
        assert len(data["flavors"]) > 0, "flavors array is empty"

    def test_flavor_entries_have_required_fields(self):
        data = json.loads((DOCS_DIR / "flavors.json").read_text())
        for flavor in data["flavors"]:
            assert "title" in flavor, f"Flavor entry missing 'title': {flavor}"
            assert isinstance(flavor["title"], str)
            assert len(flavor["title"]) > 0

    def test_no_duplicate_titles(self):
        data = json.loads((DOCS_DIR / "flavors.json").read_text())
        titles = [f["title"] for f in data["flavors"]]
        dupes = [t for t in titles if titles.count(t) > 1]
        assert len(dupes) == 0, f"Duplicate flavor titles: {set(dupes)}"


class TestStoresJson:
    """docs/stores.json -- store manifest used by all frontend pages."""

    def test_file_exists(self):
        path = DOCS_DIR / "stores.json"
        # stores.json may be a directory listing or a real file
        # depending on build state. Only check if it exists.
        if not path.exists():
            pytest.skip("stores.json not present (may be generated at deploy time)")

    def test_has_stores_array(self):
        path = DOCS_DIR / "stores.json"
        if not path.exists():
            pytest.skip("stores.json not present")
        data = json.loads(path.read_text())
        # stores.json may be a flat array or {stores: [...]}
        if isinstance(data, list):
            stores = data
        else:
            stores = data.get("stores", data)
        assert isinstance(stores, list)
        assert len(stores) > 0

    def test_store_entries_have_slug_and_state(self):
        path = DOCS_DIR / "stores.json"
        if not path.exists():
            pytest.skip("stores.json not present")
        data = json.loads(path.read_text())
        stores = data if isinstance(data, list) else data.get("stores", data)
        for store in stores[:10]:  # spot-check first 10
            assert "slug" in store, f"Store entry missing 'slug': {store}"
            assert "state" in store, f"Store entry missing 'state': {store}"


class TestFrontendScriptHardening:
    """Static checks for frontend script supply-chain hardening."""

    def _html_files(self):
        return sorted(DOCS_DIR.glob("*.html"))

    def test_no_raw_github_runtime_dependencies(self):
        offenders = []
        for html in self._html_files():
            text = html.read_text()
            if "raw.githubusercontent.com" in text:
                offenders.append(html.name)
        assert offenders == [], (
            "raw.githubusercontent.com runtime dependencies are disallowed in docs pages. "
            f"Found in: {offenders}"
        )

    def test_external_scripts_are_sri_pinned_or_allowlisted(self):
        missing_sri = []
        for html in self._html_files():
            text = html.read_text()
            for src, attrs in EXTERNAL_SCRIPT_RE.findall(text):
                if src in ALLOWED_EXTERNAL_SCRIPTS_WITHOUT_SRI:
                    continue
                has_integrity = "integrity=" in attrs.lower()
                if not has_integrity:
                    missing_sri.append((html.name, src))

        assert missing_sri == [], (
            "External scripts must use SRI unless explicitly allowlisted. Missing integrity: "
            f"{missing_sri}"
        )

    def test_leaflet_heat_is_vendored_locally(self):
        vendor_file = DOCS_DIR / "vendor" / "leaflet-heat-0.2.0.js"
        assert vendor_file.exists(), "Vendored Leaflet heat plugin missing: docs/vendor/leaflet-heat-0.2.0.js"

        forecast_map = (DOCS_DIR / "forecast-map.html").read_text()
        assert "vendor/leaflet-heat-0.2.0.js" in forecast_map
        assert "unpkg.com/leaflet.heat" not in forecast_map
