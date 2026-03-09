"""Tests verifying service worker registration across all user-facing pages.

Every user-facing page must register the service worker so that static
assets (including stores.json) are available offline after first visit.
"""

from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"

# All 8 user-facing pages that must have SW registration
USER_FACING_PAGES = [
    "index.html",
    "compare.html",
    "map.html",
    "fun.html",
    "updates.html",
    "quiz.html",
    "widget.html",
    "calendar.html",
]

# Pages that register via their JS file instead of inline HTML
JS_REGISTRATION = {
    "index.html": "today-page.js",
    "compare.html": "compare-page.js",
}

# Pages that must have inline SW registration in their HTML
INLINE_PAGES = ["widget.html", "calendar.html", "fun.html", "updates.html", "quiz.html", "map.html"]


class TestAllPagesHaveSWRegistration:
    """Every user-facing page must register sw.js (inline or via JS file)."""

    def test_all_8_pages_have_sw_registration(self):
        missing = []
        for page in USER_FACING_PAGES:
            if page in JS_REGISTRATION:
                # Check the JS file for serviceWorker registration
                js_file = DOCS_DIR / JS_REGISTRATION[page]
                assert js_file.exists(), f"{JS_REGISTRATION[page]} does not exist"
                content = js_file.read_text()
            else:
                # Check the HTML file for inline serviceWorker registration
                html_file = DOCS_DIR / page
                assert html_file.exists(), f"{page} does not exist"
                content = html_file.read_text()

            if "serviceWorker" not in content:
                missing.append(page)

        assert missing == [], (
            f"These pages are missing SW registration: {missing}. "
            "Each must contain a serviceWorker.register('sw.js') call."
        )


class TestInlineSWRegistration:
    """Pages that register SW inline must have the snippet in their HTML."""

    def test_fun_html_has_inline_sw_registration(self):
        content = (DOCS_DIR / "fun.html").read_text()
        assert "serviceWorker" in content, "fun.html missing inline SW registration"

    def test_updates_html_has_inline_sw_registration(self):
        content = (DOCS_DIR / "updates.html").read_text()
        assert "serviceWorker" in content, "updates.html missing inline SW registration"

    def test_quiz_html_has_inline_sw_registration(self):
        content = (DOCS_DIR / "quiz.html").read_text()
        assert "serviceWorker" in content, "quiz.html missing inline SW registration"

    def test_map_html_has_inline_sw_registration(self):
        content = (DOCS_DIR / "map.html").read_text()
        assert "serviceWorker" in content, "map.html missing inline SW registration"
