"""Static analysis tests for inline style elimination (DTKN-03).

Verifies that:
- compare.html has zero inline style= attributes
- index.html has zero inline style= attributes
- New CSS classes (.header-subtitle, .footer-disclaimer, .compare-empty-heading) consume design tokens
- .hidden class exists in style.css
- JS files: zero .style.display in compare-page.js and shared-nav.js
- JS files: zero .style.color in updates-page.js
- today-page.js: dynamic brand colors documented exception (.style.borderLeftColor/.color)
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
STYLE_CSS = DOCS_DIR / "style.css"

INLINE_STYLE_RE = re.compile(r'\bstyle="[^"]*"', re.IGNORECASE)
# Matches .style.display, .style.fontWeight, .style.color, .style.borderLeftColor, etc.
JS_STYLE_ASSIGN_RE = re.compile(r'\.style\.\w+\s*=')


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


# -----------------------------------------------------------------------
# DTKN-03: JS .style.display enforcement -- compare-page.js
# -----------------------------------------------------------------------


def test_no_style_display_in_compare_js():
    """compare-page.js has zero .style.display assignments."""
    js = (DOCS_DIR / "compare-page.js").read_text()
    pattern = re.compile(r'\.style\.display\s*=')
    violations = []
    for i, line in enumerate(js.splitlines(), start=1):
        for m in pattern.finditer(line):
            violations.append(f"  compare-page.js:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} .style.display assignments in compare-page.js "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03: JS .style.display enforcement -- shared-nav.js
# -----------------------------------------------------------------------


def test_no_style_display_in_shared_nav_js():
    """shared-nav.js has zero .style.display assignments."""
    js = (DOCS_DIR / "shared-nav.js").read_text()
    pattern = re.compile(r'\.style\.display\s*=')
    violations = []
    for i, line in enumerate(js.splitlines(), start=1):
        for m in pattern.finditer(line):
            violations.append(f"  shared-nav.js:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} .style.display assignments in shared-nav.js "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03: JS .style.color enforcement -- updates-page.js
# -----------------------------------------------------------------------


def test_no_style_color_in_updates_js():
    """updates-page.js has zero .style.color assignments."""
    js = (DOCS_DIR / "updates-page.js").read_text()
    pattern = re.compile(r'\.style\.color\s*=')
    violations = []
    for i, line in enumerate(js.splitlines(), start=1):
        for m in pattern.finditer(line):
            violations.append(f"  updates-page.js:{i}: {m.group(0)}")
    assert len(violations) == 0, (
        f"Found {len(violations)} .style.color assignments in updates-page.js "
        f"(expected 0):\n" + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03: today-page.js dynamic brand colors -- documented exception
# -----------------------------------------------------------------------


def test_today_page_dynamic_brand_exception():
    """today-page.js: .style.borderLeftColor and .style.color are allowed for dynamic brand colors.

    These assignments use runtime-dynamic per-store brand colors from a BRAND_COLORS lookup
    table. The colors vary per brand (Culver's blue, Kopp's black, Gille's gold, etc.) and
    cannot be replaced with static CSS classes. This test documents the exception and enforces
    that ONLY borderLeftColor and color are used (no other .style.* assignments).
    """
    js = (DOCS_DIR / "today-page.js").read_text()
    # Allowed dynamic style properties for brand colors
    allowed_props = {"borderLeftColor", "color"}
    all_style_re = re.compile(r'\.style\.(\w+)\s*=')

    violations = []
    for i, line in enumerate(js.splitlines(), start=1):
        for m in all_style_re.finditer(line):
            prop = m.group(1)
            if prop not in allowed_props:
                violations.append(f"  today-page.js:{i}: .style.{prop} = ...")
    assert len(violations) == 0, (
        f"Found {len(violations)} unexpected .style.* assignments in today-page.js "
        f"(only .style.borderLeftColor and .style.color are allowed for dynamic brand colors):\n"
        + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# DTKN-03: CSS classes for JS patterns exist
# -----------------------------------------------------------------------


def test_fronts_tick_confirmed_class():
    """style.css contains .fronts-tick--confirmed with font-weight and color."""
    css = STYLE_CSS.read_text()
    match = re.search(r"\.fronts-tick--confirmed\s*\{([^}]+)\}", css, re.DOTALL)
    assert match, ".fronts-tick--confirmed class definition not found in style.css"
    block = match.group(1)
    assert "font-weight" in block, ".fronts-tick--confirmed must set font-weight"
    assert "var(--brand)" in block, ".fronts-tick--confirmed must use var(--brand) token"


def test_text_success_class():
    """style.css contains .text-success using a state-success token."""
    css = STYLE_CSS.read_text()
    match = re.search(r"\.text-success\s*\{([^}]+)\}", css, re.DOTALL)
    assert match, ".text-success class definition not found in style.css"
    block = match.group(1)
    assert "var(--state-success" in block, ".text-success must use a --state-success token"


def test_text_danger_class():
    """style.css contains .text-danger using a state-danger token."""
    css = STYLE_CSS.read_text()
    match = re.search(r"\.text-danger\s*\{([^}]+)\}", css, re.DOTALL)
    assert match, ".text-danger class definition not found in style.css"
    block = match.group(1)
    assert "var(--state-danger" in block, ".text-danger must use a --state-danger token"
