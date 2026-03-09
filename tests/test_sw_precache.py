"""Tests verifying stores.json is in SW pre-cache and cache-bust params are removed.

The Cache API uses exact URL matching, so `stores.json?v=2026-03-09` would
never match the pre-cached `./stores.json`. All cache-bust params must be
removed, and stores.json must be in STATIC_ASSETS for offline access.
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"


class TestStoresJsonInStaticAssets:
    """sw.js STATIC_ASSETS must include stores.json for offline access."""

    def test_stores_json_in_static_assets(self):
        sw_content = (DOCS_DIR / "sw.js").read_text()

        # Extract the STATIC_ASSETS array content
        match = re.search(r"STATIC_ASSETS\s*=\s*\[(.*?)\]", sw_content, re.DOTALL)
        assert match, "Could not find STATIC_ASSETS array in sw.js"

        assets_block = match.group(1)
        # Check for stores.json (with or without ./ prefix)
        assert "stores.json" in assets_block, (
            "stores.json is not in the STATIC_ASSETS array in sw.js. "
            "It must be added for offline store data access."
        )


class TestNoCacheBustParams:
    """No file in docs/ should contain stores.json?v= cache-bust params."""

    def test_no_cache_bust_params_in_any_file(self):
        offenders = []
        for f in sorted(DOCS_DIR.glob("*.js")):
            if "stores.json?v=" in f.read_text():
                offenders.append(f.name)
        for f in sorted(DOCS_DIR.glob("*.html")):
            if "stores.json?v=" in f.read_text():
                offenders.append(f.name)

        assert offenders == [], (
            f"Cache-bust params 'stores.json?v=' still present in: {offenders}. "
            "These prevent the SW cache from matching the pre-cached stores.json URL."
        )


class TestCacheVersionBumped:
    """CACHE_VERSION must be bumped past v15 to invalidate old caches."""

    def test_cache_version_is_not_v15(self):
        sw_content = (DOCS_DIR / "sw.js").read_text()
        match = re.search(r"CACHE_VERSION\s*=\s*['\"]([^'\"]+)['\"]", sw_content)
        assert match, "Could not find CACHE_VERSION in sw.js"

        version = match.group(1)
        assert version != "custard-v15", (
            f"CACHE_VERSION is still 'custard-v15'. It must be bumped to "
            "at least 'custard-v16' to invalidate old caches after adding stores.json."
        )
