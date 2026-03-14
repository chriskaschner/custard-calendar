"""Static analysis tests for card/button unification (CARD-01, CARD-02, CARD-03).

Verifies that:
- .card base class exists with required properties
- Only 3 button base types exist (.btn-primary, .btn-secondary, .btn-text)
- Button and card modifiers exist in style.css
- Zero inline style overrides on button elements in HTML/JS
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
STYLE_CSS = DOCS_DIR / "style.css"

# Button properties that should not appear as inline styles on button elements
BUTTON_PROPERTIES = re.compile(
    r"(padding|background|border-radius|color|width|display)\s*:",
    re.IGNORECASE,
)

# Allowed button base type class names (not modifiers)
ALLOWED_BUTTON_BASES = {"btn", "btn-primary", "btn-secondary", "btn-text"}

# Legacy button allowlist emptied by Plan 03 -- all domain-specific buttons remapped.
LEGACY_BUTTON_ALLOWLIST = set()


# -----------------------------------------------------------------------
# CARD-01: .card base class exists with required properties
# -----------------------------------------------------------------------


def test_card_base_class_exists():
    """style.css defines .card with border-radius, box-shadow, and border."""
    text = STYLE_CSS.read_text()
    match = re.search(r"\.card\s*\{([^}]+)\}", text, re.DOTALL)
    assert match, ".card class definition not found in style.css"
    block = match.group(1)
    assert "border-radius" in block, ".card must define border-radius"
    assert "box-shadow" in block, ".card must define box-shadow"
    assert "border" in block, ".card must define border"


# -----------------------------------------------------------------------
# CARD-02: Button system consolidated to 3 base types
# -----------------------------------------------------------------------


def test_btn_text_base_type_exists():
    """style.css defines .btn-text with no-background, brand-color, underline properties."""
    text = STYLE_CSS.read_text()
    match = re.search(r"\.btn-text\s*\{([^}]+)\}", text, re.DOTALL)
    assert match, ".btn-text class definition not found in style.css"
    block = match.group(1)
    assert "background" in block, ".btn-text must define background (none)"
    assert "border" in block, ".btn-text must define border (none)"
    assert "color" in block, ".btn-text must define color (brand)"
    assert "text-decoration" in block, ".btn-text must define text-decoration (underline)"


def test_only_three_button_base_types():
    """Only .btn-primary, .btn-secondary, .btn-text exist as button base types.

    Scans style.css for .btn-{word} definitions (not .btn--{word} modifiers).
    Known legacy classes in LEGACY_BUTTON_ALLOWLIST are permitted during
    migration -- Plan 03 will remove them.
    """
    text = STYLE_CSS.read_text()
    # Match .btn-{word} at the start of a CSS rule (not .btn--{word} modifiers)
    # This captures class definitions like .btn-primary { or .btn-search {
    btn_defs = re.findall(r"\.(btn-[a-zA-Z]+)\s*[\{,:]", text)
    # Deduplicate
    found_bases = set(btn_defs)
    # Remove allowed bases and legacy allowlist
    unexpected = found_bases - ALLOWED_BUTTON_BASES - LEGACY_BUTTON_ALLOWLIST
    assert not unexpected, (
        f"Found unexpected button base types in style.css "
        f"(only .btn-primary, .btn-secondary, .btn-text should exist): {unexpected}"
    )


# -----------------------------------------------------------------------
# CARD-03: Zero inline style overrides on buttons
# -----------------------------------------------------------------------


# All inline button styles eliminated by Plan 03.
_HTML_INLINE_BUTTON_STYLE_BASELINE = 0


def test_no_inline_button_styles_in_html():
    """HTML files have at most N inline style attributes on button elements.

    Scans all .html files in docs/ for <button> or <a> elements that have
    both a btn/button class AND a style="" attribute containing button
    properties (padding, background, border-radius, color, width, display).

    Uses a baseline count that starts at current violations and is driven
    to 0 by Plan 03.
    """
    inline_style_re = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    violations = []

    for html_file in sorted(DOCS_DIR.glob("*.html")):
        text = html_file.read_text()
        for i, line in enumerate(text.splitlines(), start=1):
            # Check lines that have both a btn/button-related class and a style attr
            has_btn_class = bool(re.search(r'class="[^"]*\bbtn', line, re.IGNORECASE))
            has_button_tag = bool(re.search(r"<button\b", line, re.IGNORECASE))
            if not (has_btn_class or has_button_tag):
                continue
            for m in inline_style_re.finditer(line):
                style_val = m.group(1)
                if BUTTON_PROPERTIES.search(style_val):
                    violations.append(
                        f"  {html_file.name}:{i}: style=\"{style_val}\""
                    )

    assert len(violations) <= _HTML_INLINE_BUTTON_STYLE_BASELINE, (
        f"Found {len(violations)} inline button style violations in HTML "
        f"(baseline: {_HTML_INLINE_BUTTON_STYLE_BASELINE}):\n"
        + "\n".join(violations)
    )


# All inline button styles eliminated by Plan 03.
_JS_INLINE_BUTTON_STYLE_BASELINE = 0


def test_no_inline_button_styles_in_js():
    """JS files have at most N innerHTML/insertAdjacentHTML strings with
    inline button styles.

    Scans docs/*.js for lines containing style=" with button properties
    (padding, background, border-radius, color, width, display) inside
    innerHTML or template string contexts.

    Uses a baseline count approach -- starts at current violations and
    Plan 03 drives to 0.
    """
    inline_style_re = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    violations = []

    for js_file in sorted(DOCS_DIR.glob("*.js")):
        text = js_file.read_text()
        for i, line in enumerate(text.splitlines(), start=1):
            for m in inline_style_re.finditer(line):
                style_val = m.group(1)
                if BUTTON_PROPERTIES.search(style_val):
                    violations.append(
                        f"  {js_file.name}:{i}: style=\"{style_val}\""
                    )

    assert len(violations) <= _JS_INLINE_BUTTON_STYLE_BASELINE, (
        f"Found {len(violations)} inline button style violations in JS "
        f"(baseline: {_JS_INLINE_BUTTON_STYLE_BASELINE}):\n"
        + "\n".join(violations)
    )


# -----------------------------------------------------------------------
# Button modifiers
# -----------------------------------------------------------------------


def test_button_modifiers_exist():
    """style.css defines .btn--block, .btn--sm, and .btn--danger modifiers."""
    text = STYLE_CSS.read_text()
    required_modifiers = {
        ".btn--block": r"\.btn--block\s*\{",
        ".btn--sm": r"\.btn--sm\s*\{",
        ".btn--danger": r"\.btn--danger\s*\{",
    }
    missing = []
    for name, pattern in required_modifiers.items():
        if not re.search(pattern, text):
            missing.append(name)
    assert not missing, (
        f"Missing button modifiers in style.css: {missing}"
    )


# -----------------------------------------------------------------------
# Card modifiers
# -----------------------------------------------------------------------


def test_card_modifiers_exist():
    """style.css defines .card--accent, .card--success, .card--danger,
    and .card--overlay modifiers."""
    text = STYLE_CSS.read_text()
    required_modifiers = {
        ".card--accent": r"\.card--accent\s*\{",
        ".card--success": r"\.card--success\s*\{",
        ".card--danger": r"\.card--danger\s*\{",
        ".card--overlay": r"\.card--overlay\s*\{",
    }
    missing = []
    for name, pattern in required_modifiers.items():
        if not re.search(pattern, text):
            missing.append(name)
    assert not missing, (
        f"Missing card modifiers in style.css: {missing}"
    )
