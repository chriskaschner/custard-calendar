"""Static analysis tests for inline style elimination (DTKN-03).

Verifies that:
- compare.html has zero inline style= attributes
- index.html has zero inline style= attributes
- forecast-map.html HTML elements (not inline JS) have zero inline style= attributes
- New CSS classes (.header-subtitle, .footer-disclaimer, .compare-empty-heading) consume design tokens
- .hidden class exists in style.css
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
STYLE_CSS = DOCS_DIR / "style.css"

INLINE_STYLE_RE = re.compile(r'\bstyle="[^"]*"', re.IGNORECASE)


# -----------------------------------------------------------------------
# DTKN-03a: compare.html has zero inline style= attributes
# -----------------------------------------------------------------------


def test_compare_zero_inline_styles():
    """compare.html has 0 inline style= attributes."""
    html = (DOCS_DIR / "compare.html").read_text()
    violations = []
    for i, line in enumerate(html.splitlines(), start=1):
        for m in INLINE_STYLE_RE.finditer(line):
            violations.append(f"  compare.html:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} inline style= attributes in compare.html "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03b: index.html has zero inline style= attributes
# -----------------------------------------------------------------------


def test_index_zero_inline_styles():
    """index.html has 0 inline style= attributes."""
    html = (DOCS_DIR / "index.html").read_text()
    violations = []
    for i, line in enumerate(html.splitlines(), start=1):
        for m in INLINE_STYLE_RE.finditer(line):
            violations.append(f"  index.html:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} inline style= attributes in index.html "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03c: forecast-map.html HTML elements have zero inline style= attributes
# -----------------------------------------------------------------------


def test_forecast_map_zero_html_inline_styles():
    """forecast-map.html HTML elements (before first <script> tag) have 0 inline style= attributes."""
    html = (DOCS_DIR / "forecast-map.html").read_text()
    # Only check the HTML markup section -- stop at the first <script> tag
    # that contains inline JS (not external src scripts)
    lines = html.splitlines()
    violations = []
    for i, line in enumerate(lines, start=1):
        # Stop at inline script blocks (not external <script src="...">)
        stripped = line.strip()
        if stripped == "<script>" or (stripped.startswith("<script>") and 'src=' not in stripped):
            break
        for m in INLINE_STYLE_RE.finditer(line):
            violations.append(f"  forecast-map.html:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} inline style= attributes in forecast-map.html HTML "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03g: New CSS classes consume design tokens (var(--*))
# -----------------------------------------------------------------------


def test_new_classes_use_tokens():
    """New CSS classes (.header-subtitle, .footer-disclaimer, .compare-empty-heading) use var(--*) tokens."""
    css = STYLE_CSS.read_text()

    classes_to_check = [".header-subtitle", ".footer-disclaimer", ".compare-empty-heading"]
    for cls_name in classes_to_check:
        # Find the class definition block
        pattern = re.escape(cls_name) + r"\s*\{([^}]+)\}"
        match = re.search(pattern, css, re.DOTALL)
        assert match, f"{cls_name} class definition not found in style.css"
        block = match.group(1)
        assert "var(--" in block, (
            f"{cls_name} must consume design tokens (var(--*)) but block is: {block.strip()}"
        )


# -----------------------------------------------------------------------
# Hidden class exists
# -----------------------------------------------------------------------


def test_hidden_class_exists():
    """style.css contains .hidden { display: none !important; }"""
    css = STYLE_CSS.read_text()
    match = re.search(r"\.hidden\s*\{([^}]+)\}", css, re.DOTALL)
    assert match, ".hidden class definition not found in style.css"
    block = match.group(1)
    assert "display" in block, ".hidden must set display property"
    assert "none" in block, ".hidden must set display: none"
    assert "!important" in block, ".hidden must use !important"
