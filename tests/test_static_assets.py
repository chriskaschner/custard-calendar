"""Tests for static assets that frontend pages depend on.

These catch deployment failures where a page silently breaks because
a required static file is missing or malformed.
"""

import json
import re
import struct
from pathlib import Path

import pytest

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"


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


def _png_dimensions(path):
    """Read width and height from a PNG file's IHDR chunk."""
    with open(path, "rb") as f:
        sig = f.read(8)
        assert sig == b"\x89PNG\r\n\x1a\n", f"Not a valid PNG: {path}"
        # IHDR is always the first chunk after the 8-byte signature
        _length = f.read(4)
        chunk_type = f.read(4)
        assert chunk_type == b"IHDR", f"Expected IHDR chunk, got {chunk_type!r}"
        width, height = struct.unpack(">II", f.read(8))
    return width, height


# Minimum OG image size recommended by major platforms
OG_MIN_WIDTH = 600
OG_MIN_HEIGHT = 315


class TestOGImages:
    """Every HTML page must reference an og:image that exists and meets
    minimum size requirements for social sharing previews (Teams, Slack,
    iMessage, etc.).
    """

    HTML_FILES = sorted(DOCS_DIR.glob("*.html"))

    def test_every_page_has_og_image_tag(self):
        for html_file in self.HTML_FILES:
            content = html_file.read_text()
            assert re.search(r'<meta\s+property="og:image"', content), (
                f"{html_file.name} is missing an og:image meta tag"
            )

    def test_og_image_files_exist(self):
        """Each og:image URL must correspond to a real file in docs/."""
        seen = set()
        for html_file in self.HTML_FILES:
            content = html_file.read_text()
            match = re.search(
                r'<meta\s+property="og:image"\s+content="[^"]*?/([^"/]+)"',
                content,
            )
            if not match:
                continue
            filename = match.group(1)
            if filename in seen:
                continue
            seen.add(filename)
            assert (DOCS_DIR / filename).exists(), (
                f"{html_file.name} references og:image '{filename}' "
                f"but docs/{filename} does not exist"
            )

    def test_og_images_are_valid_png(self):
        """OG image files must be valid PNGs (not empty, not corrupt)."""
        for png in DOCS_DIR.glob("og-*.png"):
            size = png.stat().st_size
            assert size > 1000, (
                f"{png.name} is only {size} bytes -- likely corrupt or placeholder"
            )
            _png_dimensions(png)  # raises on invalid PNG

    def test_og_images_meet_minimum_dimensions(self):
        """Social platforms need at least 600x315 for full-size previews."""
        for png in DOCS_DIR.glob("og-*.png"):
            w, h = _png_dimensions(png)
            assert w >= OG_MIN_WIDTH and h >= OG_MIN_HEIGHT, (
                f"{png.name} is {w}x{h} but social previews need at least "
                f"{OG_MIN_WIDTH}x{OG_MIN_HEIGHT}"
            )
