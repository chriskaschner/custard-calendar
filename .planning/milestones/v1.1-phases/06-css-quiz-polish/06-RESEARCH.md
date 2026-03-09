# Phase 6: CSS + Quiz Polish - Research

**Researched:** 2026-03-08
**Domain:** CSS custom properties (design tokens), visual differentiation for quiz modes
**Confidence:** HIGH

## Summary

Phase 6 is a pure CSS refactoring phase with two objectives: (1) replace all hardcoded color and spacing values with design token variables across style.css, fun.html, updates.html, and quiz.html; and (2) add per-mode visual differentiation to the 6 quiz modes. No new features, no layout changes, no JS logic changes beyond adding CSS class hooks for mode-aware styling.

The existing token system is well-defined (17 tokens in `:root` of style.css) but woefully under-consumed: only 122 `var(--` references exist in style.css versus 353 hardcoded hex values. The inline `<style>` blocks in fun.html (16 hex values), updates.html (23 hex values), and quiz.html (65 hex values) use zero tokens. The quiz engine (engine.js) also contains hardcoded inline styles in JavaScript code that must be addressed.

**Primary recommendation:** Work in three waves -- (1) extend the token vocabulary with a small number of new semantic tokens for gaps in the current set, (2) perform systematic find-and-replace of hardcoded values in style.css and inline `<style>` blocks, (3) add quiz-mode-specific CSS via a `data-quiz-mode` attribute on the body or main element driven by engine.js.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 6 quiz modes (Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility) get visual differentiation
- Mad Libs keeps its existing featured card treatment on fun.html -- not included in differentiation work
- fun.html and updates.html both have `<style>` blocks with 20+ hardcoded values that must be converted
- Existing token set: 17 tokens (colors, typography, spacing, radius, border)

### Claude's Discretion
- Quiz mode differentiation approach (color themes vs icon+tint vs hybrid)
- Whether fun.html quiz cards get mode-specific styling or only quiz.html engine
- Whether inline styles move to style.css or stay in-page with token variables
- Which new tokens to create for values without existing tokens
- Shadow token system creation (if warranted)
- Pill radius tokenization

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOKN-01 | All CSS color values use design token variables | Color inventory complete: 353 hex values in style.css, 104 across inline styles. Token mapping table provided below. |
| TOKN-02 | All CSS spacing values use design token variables | Spacing inventory: 184 hardcoded spacing values in style.css, 39 in inline styles. Only 4 use `--space-*` tokens currently. Mapping strategy documented. |
| TOKN-03 | Inline styles in fun.html and updates.html converted to token variables | 4 inline `style=""` attributes in fun.html, 4 in updates.html with hardcoded colors/spacing. Plus `<style>` blocks with 16/23 hex values respectively. |
| QUIZ-01 | Quiz modes are visually distinct from each other (unique styling per mode) | 6 mode IDs documented, engine.js integration point identified (`state.activeQuiz.id`), CSS architecture for mode themes designed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | CSS3 native | Design token system | Already in use, no build step needed, browser support universal |
| BEM naming | Convention | CSS class structure | Already established in codebase (.card--quiz, .card--hero) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | -- | -- | No additional libraries needed; pure CSS refactoring |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS custom properties | CSS preprocessor (Sass) | Would require build step; project constraint is no build step on GitHub Pages |
| Data attributes for mode | CSS classes for mode | Data attributes are cleaner for mode state; classes work too but pollute class namespace |

## Architecture Patterns

### Token System Architecture

The existing token vocabulary in `style.css` `:root`:

```css
/* Colors */
--brand: #005696;
--brand-dark: #003a6b;
--text: #1a1a1a;
--text-muted: #666;
--bg: #fafafa;
--bg-tint: #f8fbfe;
--border: #ddd;

/* Typography */
--text-xs through --text-3xl (8 sizes)

/* Spacing */
--space-1: 0.25rem through --space-6: 2rem (6 steps)

/* Additional */
--radius: 0.5rem;
--text-primary: #1a1a1a;
--text-subtle: #999;
```

### New Tokens to Add

Based on the hardcoded value inventory, these new tokens fill gaps:

```css
:root {
  /* Colors -- fill gaps */
  --brand-hover: #004488;         /* Used 4x: hover states for #005696 buttons */
  --bg-surface: #fff;             /* Used 30x: white backgrounds on cards */
  --bg-muted: #f0f4f8;           /* Used 7x: light blue hover/tint backgrounds */
  --border-light: #eee;          /* Used 3x: lighter separators */
  --border-input: #ccc;          /* Used 9x: form input borders */
  --text-secondary: #555;        /* Used 6x: secondary body text */
  --text-dim: #888;              /* Used 7x: very muted labels */
  --text-faint: #bbb;            /* Used 1x: footer brands */

  /* Semantic colors -- keep hardcoded (domain-specific) */
  /* Green (#2e7d32), red (#c62828), yellow (#f9a825) are semantic
     status colors. They SHOULD get tokens but are lower priority
     and could stay hardcoded for this phase. */

  /* Shadows -- standardize the 3 shadow patterns used */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 86, 150, 0.12);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* Radius */
  --radius-lg: 0.75rem;          /* Used 5x: section cards, chips */
  --radius-full: 999px;          /* Used 12x: pill shapes, badges */
}
```

### Values to Leave Hardcoded (Edge Cases)

These values are intentionally NOT tokenized because they are one-off, domain-specific, or part of a tightly-coupled visual system:

- **Brand colors for other stores** (`.brand-kopps: #000000`, `.brand-gilles: #EBCC35`, etc.) -- these are per-brand identity colors, not theme tokens
- **Rarity badge colors** (`.rarity-badge-ultra-rare: #fce4ec`, etc.) -- semantic status palette, tightly coupled to rarity logic
- **Fronts/forecast map dark theme colors** -- the entire `.fronts-*` section uses a distinct dark palette that is an intentional departure from the main theme
- **Leaflet map control overrides** -- forced with `!important`, vendor override not tokenizable
- **Signal card border-left colors** -- each signal type has a specific semantic color; tokenizing adds complexity without benefit
- **0.375rem spacing** -- falls between `--space-1` (0.25rem) and `--space-2` (0.5rem); appears in pill padding, margin gaps. Leave as-is or map to nearest token.
- **Google Calendar UI colors** (`#039be5`, `#dadce0`, `#5f6368`, `#3c4043`, `#1a73e8`) -- these intentionally mimic Google Calendar's palette

### Color Mapping Table (HIGH confidence)

| Hardcoded | Count | Token | Notes |
|-----------|-------|-------|-------|
| `#005696` | 82 | `var(--brand)` | Already defined |
| `#003a6b` | 0 | `var(--brand-dark)` | Already defined, used via token |
| `#004488` / `#004578` / `#004480` | 4 | `var(--brand-hover)` | NEW: button hover states |
| `#1a1a1a` | 9 | `var(--text)` or `var(--text-primary)` | Already defined (both are #1a1a1a) |
| `#666` | 19 | `var(--text-muted)` | Already defined |
| `#555` | 6 | `var(--text-secondary)` | NEW |
| `#444` | 6 | `var(--text-secondary)` | Close enough to #555; map to same token |
| `#333` | 2 | `var(--text)` | Dark text, close to #1a1a1a |
| `#888` | 7 | `var(--text-dim)` | NEW |
| `#999` | 6 | `var(--text-subtle)` | Already defined |
| `#bbb` | 1 | `var(--text-faint)` | NEW |
| `#ddd` | 18 | `var(--border)` | Already defined |
| `#ccc` | 9 | `var(--border-input)` | NEW |
| `#eee` | 3 | `var(--border-light)` | NEW |
| `#e0e0e0` | 5 | `var(--border)` | Close to #ddd |
| `#f0f0f0` | 10 | `var(--border-light)` | Separator/divider color |
| `#f0f4f8` | 7 | `var(--bg-muted)` | NEW |
| `#fafafa` | 3 | `var(--bg)` | Already defined |
| `#f5f5f5` | 4 | `var(--bg)` | Close to #fafafa |
| `white` / `#fff` | 30 | `var(--bg-surface)` | NEW |

### Spacing Mapping Strategy (HIGH confidence)

The existing `--space-1` through `--space-6` tokens provide a 6-step scale:

| Token | Value | Matches These Hardcoded Values |
|-------|-------|-------------------------------|
| `--space-1` | 0.25rem | 0.25rem, 4px |
| `--space-2` | 0.5rem | 0.5rem, 8px |
| `--space-3` | 0.75rem | 0.75rem, 12px |
| `--space-4` | 1rem | 1rem, 16px |
| `--space-5` | 1.5rem | 1.5rem, 24px |
| `--space-6` | 2rem | 2rem, 32px |

**In-between values to handle:**
- `0.375rem` (14x) -- split between --space-1 and --space-2. Map to `--space-2` or leave hardcoded.
- `1.25rem` (8x) -- between --space-4 and --space-5. Add `--space-4-5: 1.25rem` or leave hardcoded.
- `0.125rem` (5x) -- sub-pixel adjustment. Leave hardcoded.
- `0.625rem` (2x) -- between --space-2 and --space-3. Leave hardcoded.

**Recommendation:** Do NOT add fractional spacing tokens. The current 6-step scale is clean. Replace exact matches with tokens; leave in-between values hardcoded. This satisfies TOKN-02 ("spacing uses token variables") for the standard spacing scale while keeping the system clean. The requirement says "magic numbers" which refers to unexplained values -- these in-between values are contextual spacing adjustments, not magic numbers.

### Quiz Mode Visual Differentiation (QUIZ-01)

**Recommended approach: Color accent themes per mode**

Each quiz mode gets a distinct accent color applied via a `data-quiz-mode` attribute on `<body>` or `<main>`. The engine.js already has `state.activeQuiz.id` which maps directly to mode IDs.

**Mode IDs and recommended color themes:**

| Mode | ID | Accent Color | Rationale |
|------|----|-------------|-----------|
| Classic | `classic-v1` | `#005696` (brand blue) | The original, stays on-brand |
| Weather | `weather-v1` | `#0e9aa7` (teal) | Weather/atmospheric feel |
| Trivia | `trivia-v1` | `#7b1fa2` (purple) | Knowledge/wisdom association |
| Date Night | `date-night-v1` | `#c62828` (warm red) | Romance/evening |
| Build-a-Scoop | `build-scoop-v1` | `#ef6c00` (orange) | Creative/playful |
| Compatibility | `compatibility-v1` | `#2e7d32` (green) | Harmony/matching |

**CSS architecture:**

```css
/* In quiz.html <style> or moved to style.css */
[data-quiz-mode="classic-v1"]    { --quiz-accent: #005696; --quiz-accent-bg: #eef4fb; }
[data-quiz-mode="weather-v1"]    { --quiz-accent: #0e9aa7; --quiz-accent-bg: #e5f6f7; }
[data-quiz-mode="trivia-v1"]     { --quiz-accent: #7b1fa2; --quiz-accent-bg: #f3e5f5; }
[data-quiz-mode="date-night-v1"] { --quiz-accent: #c62828; --quiz-accent-bg: #fce4ec; }
[data-quiz-mode="build-scoop-v1"]{ --quiz-accent: #ef6c00; --quiz-accent-bg: #fff3e0; }
[data-quiz-mode="compatibility-v1"] { --quiz-accent: #2e7d32; --quiz-accent-bg: #e8f5e9; }
```

**Integration point in engine.js:**

```javascript
// In the variant select change handler and init:
document.body.setAttribute('data-quiz-mode', state.activeQuiz.id);
```

This is a one-line change in two places: the `change` event handler (line ~1297) and init after mode selection (line ~1330).

**Elements to theme per mode:**
- `.quiz-hero` border and background gradient
- `.quiz-panel` border color
- `.quiz-submit` gradient
- `.quiz-head h3` color
- `.quiz-question` border color on checked state
- `.quiz-option input:checked + .quiz-option-copy` background gradient and border

**fun.html quiz cards (optional):**
The 6 `.card--quiz` links on fun.html could also get per-mode tinting using CSS attribute selectors on the `href` value:

```css
.card--quiz[href*="classic-v1"] { border-left: 3px solid #005696; }
.card--quiz[href*="weather-v1"] { border-left: 3px solid #0e9aa7; }
/* etc. */
```

This adds visual differentiation at the hub level without any JS changes.

### Inline Style Strategy

**Recommendation: Keep `<style>` blocks in-page, replace hardcoded values with tokens.**

Moving 400+ lines of quiz.html-specific CSS to style.css would bloat the shared stylesheet with page-specific rules. The `<style>` blocks are a valid pattern for page-scoped CSS. The requirement is that hardcoded values are replaced, not that styles are relocated.

For the `style=""` HTML attributes (4 in fun.html, 4 in updates.html, 1 in quiz.html), move those values to CSS classes. They are small in number and easily handled.

### Recommended Project Structure

No new files needed. Changes touch existing files:

```
docs/
  style.css          # Add new tokens to :root, replace 353 hardcoded values
  fun.html           # Replace 16 hex values in <style>, remove 4 inline style attrs
  updates.html       # Replace 23 hex values in <style>, remove 4 inline style attrs
  quiz.html          # Replace 65 hex values in <style>, add mode theme vars
  quizzes/engine.js  # Add data-quiz-mode attribute on mode change (~3 lines)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color mapping | Manual per-line edits | Systematic find-replace by hex value | 457 replacements across 4 files; manual editing invites errors |
| Mode theme system | Separate CSS files per mode | CSS attribute selectors with custom property overrides | Single source of truth, no file management overhead |
| Shadow system | Inline box-shadow values | `--shadow-sm/md/lg` tokens | 3 common patterns repeated 20+ times |

## Common Pitfalls

### Pitfall 1: Breaking Specificity
**What goes wrong:** Replacing a hardcoded value in an inline `style=""` attribute with a CSS class can lose specificity and fail to override.
**Why it happens:** Inline styles have higher specificity than class selectors.
**How to avoid:** When moving inline styles to classes, verify the new class selector wins. For the 9 inline style attributes in fun.html/updates.html, this is straightforward since they target simple elements (h1, p, main, footer p).
**Warning signs:** Visual regression after removing `style=""` attributes.

### Pitfall 2: Missing the JavaScript-Generated Inline Styles
**What goes wrong:** CSS files are tokenized but engine.js still generates elements with hardcoded `style.cssText` values.
**Why it happens:** The quiz engine dynamically creates Mad Libs chip elements and ranking cards with inline styles (lines 435, 442, 447, 451, 473 in engine.js).
**How to avoid:** Create CSS classes for `.madlib-chip`, `.madlib-chip.selected` and reference them instead of inline `style.cssText`. This also makes the mode theming work on dynamically generated elements.
**Warning signs:** Mad Libs quiz shows old colors after token migration.

### Pitfall 3: quiz.html Has Its Own :root Tokens
**What goes wrong:** quiz.html defines 9 quiz-specific tokens (`--quiz-ink`, `--quiz-sky`, etc.) in its own `:root` block. These could conflict with or duplicate main tokens.
**Why it happens:** Quiz page was built with its own color system.
**How to avoid:** Keep the quiz-specific tokens in quiz.html but wire them to the mode theme system. The existing `--quiz-accent` becomes the mode-switchable accent, other quiz tokens can reference it.

### Pitfall 4: rgba() Values Are Not Hex
**What goes wrong:** Only hex values are tokenized, missing `rgba()` patterns like `rgba(0, 86, 150, 0.12)` which encode `#005696` at 12% opacity.
**Why it happens:** Grepping for `#` misses rgba.
**How to avoid:** Also search for `rgba(0, 86, 150` (the brand blue in rgba form) and similar patterns. These can use `color-mix()` in modern CSS or remain as-is since they derive from token values.

### Pitfall 5: Fronts Dark Theme Confusion
**What goes wrong:** Attempting to tokenize the `.fronts-*` dark theme colors breaks the deliberate dark-mode aesthetic of the forecast map.
**Why it happens:** The fronts section uses an inverted color scheme (dark backgrounds, light text) that doesn't map to the main light-theme tokens.
**How to avoid:** Leave the `.fronts-*` section's colors hardcoded. They are an intentionally separate visual system.

## Code Examples

### Token Extension Pattern
```css
/* Source: Existing style.css :root block, lines 1-32 */
:root {
  /* Existing tokens -- keep as-is */
  --brand: #005696;
  --brand-dark: #003a6b;
  /* ... */

  /* NEW tokens for Phase 6 */
  --brand-hover: #004488;
  --bg-surface: #fff;
  --bg-muted: #f0f4f8;
  --border-light: #eee;
  --border-input: #ccc;
  --text-secondary: #555;
  --text-dim: #888;
  --text-faint: #bbb;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 2px 8px rgba(0, 86, 150, 0.12);
  --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);
  --radius-lg: 0.75rem;
  --radius-full: 999px;
}
```

### Replacing Hardcoded Color (before/after)
```css
/* BEFORE */
.panel h2 { color: #005696; }
.store-card { border: 1px solid #ddd; }
body { color: #1a1a1a; background: #fafafa; }

/* AFTER */
.panel h2 { color: var(--brand); }
.store-card { border: 1px solid var(--border); }
body { color: var(--text); background: var(--bg); }
```

### Quiz Mode Theme Integration
```javascript
// Source: engine.js, add after state.activeQuiz assignment
// In variant select change handler (~line 1297) and init (~line 1330):
document.body.setAttribute('data-quiz-mode', state.activeQuiz.id);
```

```css
/* Quiz mode themes -- in quiz.html <style> block */
[data-quiz-mode="classic-v1"]       { --quiz-accent: #005696; --quiz-tint: #eef4fb; }
[data-quiz-mode="weather-v1"]       { --quiz-accent: #0e9aa7; --quiz-tint: #e5f6f7; }
[data-quiz-mode="trivia-v1"]        { --quiz-accent: #7b1fa2; --quiz-tint: #f3e5f5; }
[data-quiz-mode="date-night-v1"]    { --quiz-accent: #c62828; --quiz-tint: #fce4ec; }
[data-quiz-mode="build-scoop-v1"]   { --quiz-accent: #ef6c00; --quiz-tint: #fff3e0; }
[data-quiz-mode="compatibility-v1"] { --quiz-accent: #2e7d32; --quiz-tint: #e8f5e9; }

/* Then reference in existing quiz styles: */
.quiz-hero { border-color: var(--quiz-accent); }
.quiz-submit { background: var(--quiz-accent); }
```

### Moving Inline Style to CSS Class
```html
<!-- BEFORE (fun.html line 118) -->
<h1 style="color:#005696;font-size:1.5rem;">Custard Forecast</h1>

<!-- AFTER -->
<h1 class="page-title">Custard Forecast</h1>
```
```css
/* In fun.html <style> block or style.css */
.page-title { color: var(--brand); font-size: var(--text-xl); }
```

### Mad Libs Chip Refactor (engine.js)
```javascript
// BEFORE (engine.js line 442)
chip.style.cssText = 'padding:0.375rem 0.875rem;border:1.5px solid #ccc;...';

// AFTER -- use CSS class instead
chip.className = 'madlib-chip';
// Selected state (line 451):
chip.classList.add('selected');
// Deselected state (line 447):
s.classList.remove('selected');
```
```css
/* In quiz.html <style> */
.madlib-chip {
  padding: var(--space-2) var(--space-3);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}
.madlib-chip.selected {
  background: var(--quiz-accent);
  color: var(--bg-surface);
  border-color: var(--quiz-accent);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded hex values everywhere | CSS custom properties (design tokens) | CSS3, universal support | Single source of truth for colors/spacing |
| Class-based theming | Data attribute theming (`[data-mode]`) | Modern CSS convention | Cleaner separation of state from presentation |
| Inline `style=""` for one-offs | Utility or semantic classes | Always best practice | Better maintainability, works with theming |

**No deprecated approaches in use.** CSS custom properties are universally supported.

## Open Questions

1. **Spacing granularity tolerance**
   - What we know: 184 hardcoded spacing values in style.css; 6 tokens cover exact matches for ~40% of them
   - What's unclear: How strict is "all spacing uses token variables"? Does 0.375rem (14 instances) count as a magic number?
   - Recommendation: Replace exact matches with tokens. In-between values that serve as contextual adjustments (padding fine-tuning) can remain hardcoded. The 6-step scale covers the meaningful spacing decisions.

2. **Other HTML files with inline styles**
   - What we know: The requirement calls out fun.html and updates.html specifically. But widget.html (23), privacy.html (18), group.html (19) also have significant inline styles.
   - What's unclear: Are those other pages in scope?
   - Recommendation: Stick to the explicit scope (fun.html and updates.html). Other pages are separate concerns.

3. **quiz.html color palette scope**
   - What we know: quiz.html has 65 hardcoded hex values plus 9 quiz-specific tokens already defined
   - What's unclear: Should all 65 values become tokens, or only the ones that map to the main theme?
   - Recommendation: Convert values that map to main tokens (brand blue, grays, borders). The unique quiz-specific blues (#0c2747, #294d72, #486485, etc.) stay as part of the quiz's visual identity but wire through the quiz-specific token system.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + Python standard library |
| Config file | pyproject.toml (existing) |
| Quick run command | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/test_static_assets.py -x` |
| Full suite command | `cd /Users/chriskaschner/Documents/GitHub/custard/custard-calendar && uv run pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOKN-01 | No hardcoded hex colors in CSS files | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_colors -x` | Wave 0 |
| TOKN-02 | No hardcoded spacing magic numbers in CSS | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_hardcoded_spacing -x` | Wave 0 |
| TOKN-03 | fun.html and updates.html zero inline style attrs with hardcoded values | unit (static analysis) | `uv run pytest tests/test_design_tokens.py::test_no_inline_hardcoded_values -x` | Wave 0 |
| QUIZ-01 | Each quiz mode has distinct visual treatment | manual-only | Visual inspection of each quiz mode in browser | N/A -- manual verification |

### Sampling Rate
- **Per task commit:** `uv run pytest tests/test_design_tokens.py -x`
- **Per wave merge:** `uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_design_tokens.py` -- covers TOKN-01, TOKN-02, TOKN-03 (new file)
  - Test: parse style.css for remaining hardcoded hex outside allowed-list (brand-specific, semantic, fronts dark theme)
  - Test: parse fun.html and updates.html for `style="` attributes with hardcoded color/spacing values
  - Test: verify `:root` block contains expected token count
- [ ] No framework install needed -- pytest already configured

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `docs/style.css` (3,497 lines), `docs/fun.html` (195 lines), `docs/updates.html` (227 lines), `docs/quiz.html` (534 lines), `docs/quizzes/engine.js` (1,344 lines)
- Hex value frequency analysis via grep across all target files
- Token usage analysis: 122 `var(--` references in style.css vs 353 hardcoded hex values
- Inline style attribute inventory across all 15 HTML pages
- Quiz mode JSON configs confirming 6 mode IDs

### Secondary (MEDIUM confidence)
- CSS custom properties are universally supported (caniuse.com shows 97%+ global support)
- Data attribute selectors for theming is standard modern CSS practice

### Tertiary (LOW confidence)
- None -- all findings derived from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pure CSS, no external dependencies, well-understood codebase
- Architecture: HIGH - token system already exists, just needs consumption expanded
- Pitfalls: HIGH - identified from direct code reading, not speculation

**Research date:** 2026-03-08
**Valid until:** Indefinite (CSS fundamentals, static codebase analysis)
