"""Static analysis tests for design token compliance (TOKN-01, TOKN-02, TOKN-03).

Parses CSS and HTML files to verify that hardcoded color hex values and
spacing magic numbers have been replaced with CSS custom property tokens.
"""

import re
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
STYLE_CSS = DOCS_DIR / "style.css"

# ---------------------------------------------------------------------------
# Allowed hardcoded hex colors (domain-specific, intentionally not tokenized)
# ---------------------------------------------------------------------------

# Selector patterns: if the CSS rule's selector matches any of these,
# ALL hex values in that block are allowed.
ALLOWED_SELECTOR_PATTERNS = [
    # Store brand border colors (.brand-kopps, .brand-gilles, etc.)
    r"\.brand-(?:kopps|gilles|oscars|hefners|kraverz|culvers)\b",
    # Rarity badge colors
    r"\.rarity-badge-",
    r"\.popup-rarity-chip\.rarity-",
    # Fronts dark theme (the entire .fronts-* section uses inverted palette)
    r"\.fronts-",
    r"#fronts-map\b",
    # Leaflet map control overrides
    r"\.leaflet-",
    # Signal card semantic colors (data-signal-type selectors)
    r"\[data-signal-type=",
    # Drive bucket semantic colors (great/ok/pass/hard_pass)
    r"\.drive-bucket-",
    r"\.drive-dot\.drive-bucket-",
    # Google Calendar UI components
    r"\.cal-event",
    # Semantic status / match / confirmation components
    r"\.popup-match\b",
    r"\.popup-confirmed\b",
    r"\.match-title\b",
    r"\.store-card-match\b",
    r"\.confidence-strip-",
    r"\.day-card-badge-",
    r"\.day-card-watch\b",
    r"\.day-card-confirmed\b",
    r"\.day-card-predicted",
    r"\.day-card-estimated",
    r"\.day-card-none\b",
    r"\.day-card-highlight\b",
    r"\.prediction-bar-estimated\b",
    r"\.prediction-pct\b",
    # Watch / error / toast semantic blocks
    r"\.watch-banner",
    r"\.error-card\b",
    r"\.error-msg\b",
    r"\.btn-retry",
    r"\.mobile-toast",
    # Suggestion panel (amber semantic)
    r"#suggestions-panel\b",
    # Signal / intelligence components (unique blue palette)
    r"\.signal-",
    r"\.hero-signal\b",
    r"\.historical-context-",
    r"\.overdue-section",
    r"\.similar-section",
    # Drive domain-specific semantic components
    r"\.drive-dealbreaker\b",
    r"\.drive-tag-chip",
    r"\.drive-excluded-item\b",
    r"\.drive-tomorrow\b",
    r"\.drive-map\b",
    r"\.drive-secondary\b",
    r"\.drive-pin\b",
    r"\.drive-pill-remove\b",
    r"\.drive-score-label\b",
    r"\.drive-sort-btn\.is-active\b",
    # Compare page semantic components
    r"\.compare-",
    # Map marker effects
    r"\.flavor-map-marker",
    # Hero empty / first-visit / quick-start domain components
    r"\.hero-empty\s+\.hero-coverage\b",
    r"\.first-visit-guide",
    r"\.quick-start-chip",
    r"\.quick-start-label\b",
    # Calendar CTA components (domain-specific brand tint)
    r"\.calendar-cta-",
    # Share button (domain-specific brand border)
    r"\.share-btn",
    # Multi-store active state
    r"\.multi-store-cell\.active\b",
    # Hotspot section (fronts sidebar -- domain-specific)
    r"\.hotspot-",
    # Compare page
    r"\.compare-filter-chip",
    # Week day card estimated/predicted variants
    r"\.week-day-card-predicted",
    r"\.week-day-card-estimated",
    r"\.week-day-card-none\b",
    # Skeleton loading
    r"\.skeleton-",
    # Badge component (brand tint)
    r"\.badge\b",
    # CTA link hover
    r"\.cta-link:hover\b",
    # Dropdown active state
    r"\.store-dropdown-item\.is-active\b",
    r"\.store-dropdown-item:hover",
    # Updates CTA card
    r"\.updates-cta-card\b",
    # Nudge semantic
    r"\.compare-nudge\b",
]

# Line-level patterns: if the CSS property line itself matches, allow it.
ALLOWED_LINE_PATTERNS = [
    # Leaflet !important overrides
    r"!important",
    # Specific Google Calendar colors on any line
    r"#039be5",
    r"#dadce0",
    r"#5f6368",
    r"#3c4043",
    r"#1a73e8",
    r"#e8eaed",
]

# Hex color regex: matches #xxx, #xxxx, #xxxxxx, #xxxxxxxx
HEX_COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b")


def _parse_css_blocks(filepath: Path) -> list[tuple[str, list[tuple[int, str]]]]:
    """Parse a CSS file into (selector, [(line_number, property_line)]) blocks.

    Skips the :root { ... } block entirely.
    Returns list of (selector_text, property_lines) tuples.
    """
    text = filepath.read_text()
    lines = text.splitlines()
    blocks = []
    current_selector = ""
    current_props: list[tuple[int, str]] = []
    in_root = False
    brace_depth = 0
    root_depth = 0
    in_block = False

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Track :root block to skip it
        if not in_root and stripped.startswith(":root") and "{" in stripped:
            in_root = True
            root_depth = 0

        if in_root:
            root_depth += stripped.count("{") - stripped.count("}")
            if root_depth <= 0:
                in_root = False
            continue

        # Track brace depth for nested blocks (media queries, etc.)
        opens = stripped.count("{")
        closes = stripped.count("}")

        if opens > 0 and not in_block:
            # New selector block
            selector_part = stripped.split("{")[0].strip()
            if selector_part.startswith("@"):
                # Media query or keyframes -- just adjust depth
                brace_depth += opens - closes
                continue
            current_selector = selector_part
            current_props = []
            in_block = True
            brace_depth += opens - closes
            # If the block closes on the same line (single-line rule)
            if closes > 0 and brace_depth <= 0:
                # Single-line rule: extract properties
                inner = stripped.split("{", 1)[1].rsplit("}", 1)[0]
                for prop in inner.split(";"):
                    prop = prop.strip()
                    if prop:
                        current_props.append((i, "  " + prop + ";"))
                blocks.append((current_selector, current_props))
                in_block = False
                brace_depth = 0
                current_selector = ""
                current_props = []
            continue

        if in_block:
            brace_depth += opens - closes
            if closes > 0 and brace_depth <= 0:
                # Block ended
                blocks.append((current_selector, current_props))
                in_block = False
                brace_depth = 0
                current_selector = ""
                current_props = []
            elif stripped and not stripped.startswith("/*") and not stripped.startswith("*") and not stripped.startswith("//"):
                current_props.append((i, line))
            continue

        # Lines outside any block (comments, etc.) -- skip
        continue

    return blocks


def _read_css_outside_root(filepath: Path) -> list[tuple[int, str]]:
    """Return (line_number, line_text) pairs from a CSS file, excluding
    the :root { ... } block."""
    text = filepath.read_text()
    lines = text.splitlines()
    result = []
    in_root = False
    brace_depth = 0
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith(":root") and "{" in stripped:
            in_root = True
            brace_depth = 0
        if in_root:
            brace_depth += stripped.count("{") - stripped.count("}")
            if brace_depth <= 0:
                in_root = False
            continue
        result.append((i, line))
    return result


def _is_allowed_selector(selector: str) -> bool:
    """Return True if the selector matches any allowed selector pattern."""
    for pattern in ALLOWED_SELECTOR_PATTERNS:
        if re.search(pattern, selector, re.IGNORECASE):
            return True
    return False


def _is_allowed_line(line: str) -> bool:
    """Return True if the property line matches any allowed line pattern."""
    for pattern in ALLOWED_LINE_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def _is_inside_comment(line: str) -> bool:
    """Rough check if the line is inside a CSS comment."""
    stripped = line.strip()
    return stripped.startswith("/*") or stripped.startswith("*")


# ---------------------------------------------------------------------------
# Spacing tokens: values that must use var(--space-N) tokens
# ---------------------------------------------------------------------------

SPACING_TOKEN_VALUES = {"0.25rem", "0.5rem", "0.75rem", "1rem", "1.5rem", "2rem"}

# CSS properties that are spacing-related (padding, margin, gap, top, etc.)
SPACING_PROPERTIES = re.compile(
    r"^\s*(?:padding|margin|gap|top|bottom|left|right|row-gap|column-gap)"
    r"(?:-(?:top|bottom|left|right|inline|block|start|end))?\s*:",
    re.IGNORECASE,
)


def _find_hardcoded_spacing(lines: list[tuple[int, str]]) -> list[tuple[int, str, str]]:
    """Find lines with hardcoded spacing values that should use tokens.

    Returns list of (line_number, line_text, matched_value).
    Only checks spacing properties (padding, margin, gap, etc.).
    Skips lines that already use var(--space-*) for the matched value.
    """
    results = []
    for lineno, line in lines:
        # Only check spacing properties
        if not SPACING_PROPERTIES.match(line):
            continue
        # Skip lines inside comments
        if _is_inside_comment(line):
            continue
        # Check for each spacing token value as a standalone value
        for val in SPACING_TOKEN_VALUES:
            pattern = re.compile(
                r"(?<![.\d-])" + re.escape(val) + r"(?!\d)",
            )
            matches = pattern.findall(line)
            if matches:
                # Make sure this isn't already using a var() for this value
                line_without_vars = re.sub(r"var\(--[^)]+\)", "", line)
                if pattern.search(line_without_vars):
                    results.append((lineno, line, val))
    return results


# ===========================================================================
# Tests
# ===========================================================================


def test_token_count():
    """style.css :root block contains at least 30 CSS custom property definitions."""
    text = STYLE_CSS.read_text()
    # Find the :root block
    root_match = re.search(r":root\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}", text, re.DOTALL)
    assert root_match, ":root block not found in style.css"
    root_content = root_match.group(1)
    # Count custom property definitions (--name: value)
    tokens = re.findall(r"--[\w-]+\s*:", root_content)
    assert len(tokens) >= 30, (
        f"Expected at least 30 tokens in :root, found {len(tokens)}: "
        + ", ".join(t.rstrip(":").strip() for t in tokens)
    )


def test_no_hardcoded_colors():
    """No hardcoded hex color values remain in style.css outside allowed-list.

    Uses selector-context-aware checking: if a CSS rule's selector matches
    a known domain-specific pattern, all hex values in that block are allowed.
    """
    blocks = _parse_css_blocks(STYLE_CSS)
    violations = []

    for selector, props in blocks:
        # Skip allowed selectors (domain-specific components)
        if _is_allowed_selector(selector):
            continue

        for lineno, line in props:
            # Skip allowed lines (e.g., !important overrides)
            if _is_allowed_line(line):
                continue
            # Skip comments
            if _is_inside_comment(line):
                continue
            stripped = line.strip()
            if stripped.startswith("@keyframes"):
                continue
            # Find hex colors
            hex_matches = HEX_COLOR_RE.findall(line)
            if hex_matches:
                violations.append(
                    f"  Line {lineno} [{selector}]: {stripped}  (found: {hex_matches})"
                )

    assert not violations, (
        f"Found {len(violations)} lines with hardcoded hex colors in style.css:\n"
        + "\n".join(violations[:30])
        + ("\n  ... and more" if len(violations) > 30 else "")
    )


def test_no_hardcoded_spacing():
    """No hardcoded standard spacing values in spacing properties outside :root."""
    lines = _read_css_outside_root(STYLE_CSS)
    violations = _find_hardcoded_spacing(lines)
    formatted = [
        f"  Line {ln}: {txt.strip()}  (value: {val})"
        for ln, txt, val in violations
    ]
    assert not violations, (
        f"Found {len(violations)} hardcoded spacing values in style.css:\n"
        + "\n".join(formatted[:30])
        + ("\n  ... and more" if len(formatted) > 30 else "")
    )


def test_no_inline_hardcoded_values():
    """fun.html and updates.html have zero style="" attributes with hardcoded
    hex colors or px/rem spacing values.

    NOTE: This test validates TOKN-03 which is addressed in Plan 02.
    It is expected to fail until Plan 02 is executed.
    """
    inline_style_re = re.compile(r'style="([^"]*)"', re.IGNORECASE)
    spacing_re = re.compile(r"\b\d+(?:\.\d+)?(?:px|rem)\b")
    violations = []

    for filename in ("fun.html", "updates.html"):
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            continue
        text = filepath.read_text()
        for i, line in enumerate(text.splitlines(), start=1):
            for m in inline_style_re.finditer(line):
                style_val = m.group(1)
                hex_found = HEX_COLOR_RE.findall(style_val)
                spacing_found = spacing_re.findall(style_val)
                if hex_found or spacing_found:
                    violations.append(
                        f"  {filename}:{i}: style=\"{style_val}\" "
                        f"(hex: {hex_found}, spacing: {spacing_found})"
                    )

    assert not violations, (
        f"Found {len(violations)} inline styles with hardcoded values:\n"
        + "\n".join(violations[:20])
    )


def test_quiz_mode_visual_differentiation():
    """Verify quiz mode visual differentiation wiring (QUIZ-01).

    Static analysis checks:
    1. engine.js sets data-quiz-mode attribute (>= 2 occurrences: init + variant change)
    2. quiz.html has >= 5 [data-quiz-mode] CSS attribute selectors (per-mode styling)
    3. quiz.html has a CSS fallback for --quiz-tint (default appearance without attribute)
    """
    engine_js = DOCS_DIR / "quizzes" / "engine.js"
    quiz_html = DOCS_DIR / "quiz.html"

    # 1. engine.js contains >= 2 occurrences of "data-quiz-mode"
    engine_text = engine_js.read_text()
    engine_count = engine_text.count("data-quiz-mode")
    assert engine_count >= 2, (
        f"engine.js must contain >= 2 occurrences of 'data-quiz-mode' "
        f"(init + variant change), found {engine_count}"
    )

    # 2. quiz.html contains >= 5 [data-quiz-mode] CSS attribute selectors
    quiz_text = quiz_html.read_text()
    mode_selectors = re.findall(r'\[data-quiz-mode', quiz_text)
    assert len(mode_selectors) >= 5, (
        f"quiz.html must contain >= 5 [data-quiz-mode] CSS selectors, "
        f"found {len(mode_selectors)}"
    )

    # 3. quiz.html contains a CSS fallback for --quiz-tint
    assert "var(--quiz-tint" in quiz_text, (
        "quiz.html must contain a var(--quiz-tint) CSS fallback for default styling"
    )

    # 4. fun.html contains >= 6 border-left accent declarations for quiz cards
    fun_html = DOCS_DIR / "fun.html"
    fun_text = fun_html.read_text()
    border_left_lines = re.findall(r'border-left.*solid.*#', fun_text)
    assert len(border_left_lines) >= 6, (
        f"fun.html must contain >= 6 border-left accent declarations for quiz cards, "
        f"found {len(border_left_lines)}"
    )


# ---------------------------------------------------------------------------
# Mad Libs chip CSS compliance (DSGN-01)
# ---------------------------------------------------------------------------


def test_madlib_chip_class_exists():
    """style.css defines a .madlib-chip class (chip element styling)."""
    text = STYLE_CSS.read_text()
    assert re.search(r"\.madlib-chip\s*\{", text), (
        ".madlib-chip class definition not found in style.css"
    )


def test_madlib_chip_selected_uses_quiz_accent():
    """style.css .madlib-chip.selected block uses --quiz-accent token."""
    text = STYLE_CSS.read_text()
    # Find the .madlib-chip.selected block
    match = re.search(
        r"\.madlib-chip\.selected\s*\{([^}]+)\}", text, re.DOTALL
    )
    assert match, ".madlib-chip.selected class not found in style.css"
    block_content = match.group(1)
    assert "--quiz-accent" in block_content, (
        ".madlib-chip.selected must use --quiz-accent token for per-mode "
        f"theming, but block contains: {block_content.strip()}"
    )


def test_madlib_chip_group_class_exists():
    """style.css defines a .madlib-chip-group class with flex layout."""
    text = STYLE_CSS.read_text()
    match = re.search(
        r"\.madlib-chip-group\s*\{([^}]+)\}", text, re.DOTALL
    )
    assert match, ".madlib-chip-group class definition not found in style.css"
    block_content = match.group(1)
    assert "display" in block_content, (
        ".madlib-chip-group must have a display property (flex layout)"
    )


def test_madlib_chip_uses_design_tokens():
    """style.css .madlib-chip class uses design tokens (at least 2 var(--) refs)."""
    text = STYLE_CSS.read_text()
    match = re.search(r"\.madlib-chip\s*\{([^}]+)\}", text, re.DOTALL)
    assert match, ".madlib-chip class definition not found in style.css"
    block_content = match.group(1)
    token_refs = re.findall(r"var\(--", block_content)
    assert len(token_refs) >= 2, (
        f".madlib-chip must use at least 2 design tokens (var(--...)), "
        f"found {len(token_refs)} in: {block_content.strip()}"
    )
