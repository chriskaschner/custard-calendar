"""Tests verifying redirect stub correctness for legacy pages.

Seven legacy HTML pages (scoop, radar, calendar, widget, siri, alerts,
forecast-map) have been replaced with minimal redirect stubs. Each stub uses a
meta-refresh plus a JS fallback that forwards query params and hash fragments
to the destination.
"""

from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"

# Redirect destination mapping
REDIRECT_MAP = {
    "scoop.html": "index.html",
    "radar.html": "index.html",
    "calendar.html": "updates.html",
    "widget.html": "updates.html",
    "siri.html": "updates.html",
    "alerts.html": "updates.html",
    "forecast-map.html": "index.html",
}

# JS/CSS files that should NOT appear in redirect stubs
FORBIDDEN_RESOURCES = ["shared-nav.js", "style.css", "planner-shared.js", "today-page.js"]


class TestRedirectStubs:
    """Each redirect stub has the correct meta-refresh destination."""

    def test_scoop_redirects_to_index(self):
        content = (DOCS_DIR / "scoop.html").read_text()
        assert 'content="0;url=index.html"' in content

    def test_radar_redirects_to_index(self):
        content = (DOCS_DIR / "radar.html").read_text()
        assert 'content="0;url=index.html"' in content

    def test_calendar_redirects_to_updates(self):
        content = (DOCS_DIR / "calendar.html").read_text()
        assert 'content="0;url=updates.html"' in content

    def test_widget_redirects_to_updates(self):
        content = (DOCS_DIR / "widget.html").read_text()
        assert 'content="0;url=updates.html"' in content

    def test_siri_redirects_to_updates(self):
        content = (DOCS_DIR / "siri.html").read_text()
        assert 'content="0;url=updates.html"' in content

    def test_alerts_redirects_to_updates(self):
        content = (DOCS_DIR / "alerts.html").read_text()
        assert 'content="0;url=updates.html"' in content

    def test_forecast_map_redirects_to_index(self):
        content = (DOCS_DIR / "forecast-map.html").read_text()
        assert 'content="0;url=index.html"' in content


class TestRedirectStubMinimal:
    """Redirect stubs must not load shared JS/CSS stack and must be small."""

    def test_no_forbidden_resources(self):
        offenders = []
        for filename in REDIRECT_MAP:
            content = (DOCS_DIR / filename).read_text()
            for resource in FORBIDDEN_RESOURCES:
                if resource in content:
                    offenders.append(f"{filename} contains {resource}")
        assert offenders == [], (
            f"Redirect stubs must not load JS/CSS stack: {offenders}"
        )

    def test_file_size_under_1000_bytes(self):
        too_large = []
        for filename in REDIRECT_MAP:
            size = (DOCS_DIR / filename).stat().st_size
            if size > 1000:
                too_large.append(f"{filename} is {size} bytes")
        assert too_large == [], (
            f"Redirect stubs must be under 1000 bytes: {too_large}"
        )


class TestRedirectQueryParams:
    """Each redirect stub forwards query params via window.location.search."""

    def test_query_param_forwarding(self):
        missing = []
        for filename in REDIRECT_MAP:
            content = (DOCS_DIR / filename).read_text()
            if "window.location.search" not in content:
                missing.append(filename)
        assert missing == [], (
            f"These stubs are missing query param forwarding: {missing}"
        )


class TestRedirectHashFragments:
    """Each redirect stub forwards hash fragments via window.location.hash."""

    def test_hash_fragment_forwarding(self):
        missing = []
        for filename in REDIRECT_MAP:
            content = (DOCS_DIR / filename).read_text()
            if "window.location.hash" not in content:
                missing.append(filename)
        assert missing == [], (
            f"These stubs are missing hash fragment forwarding: {missing}"
        )


class TestMultiHtmlDirect:
    """multi.html must redirect directly to index.html, not scoop.html."""

    def test_multi_meta_refresh_points_to_index(self):
        content = (DOCS_DIR / "multi.html").read_text()
        assert 'content="0;url=index.html"' in content, (
            "multi.html meta refresh must point to index.html, not scoop.html"
        )

    def test_multi_js_redirect_points_to_index(self):
        content = (DOCS_DIR / "multi.html").read_text()
        assert "window.location.replace('index.html'" in content, (
            "multi.html JS redirect must point to index.html, not scoop.html"
        )
