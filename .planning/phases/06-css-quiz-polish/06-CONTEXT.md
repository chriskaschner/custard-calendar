# Phase 6: CSS + Quiz Polish - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Consume design tokens across all CSS rules (colors, spacing) and add visual differentiation between quiz modes. No new features, no layout changes -- purely token adoption and quiz mode visual identity.

</domain>

<decisions>
## Implementation Decisions

### Quiz Mode Visual Differentiation
- 6 quiz modes (Classic, Weather, Trivia, Date Night, Build-a-Scoop, Compatibility) get visual differentiation
- Mad Libs keeps its existing featured card treatment on fun.html -- not included in differentiation work
- Differentiation approach is Claude's discretion (color themes per mode, icon+tint, or hybrid)
- Scope includes both fun.html quiz cards and quiz.html engine page at Claude's discretion

### Inline Style Strategy
- fun.html and updates.html both have <style> blocks with 20+ hardcoded values
- Strategy (move to style.css vs tokenize in-place) is Claude's discretion
- Either way, hardcoded hex colors and magic numbers must be replaced with token variables

### Token Gaps
- Some hardcoded values (box-shadows, pill radius 999px, in-between spacing like 0.375rem) have no matching token
- Claude decides which new tokens to add vs which edge-case values to leave hardcoded
- Existing token set: 17 tokens (colors, typography, spacing, radius, border)

### Claude's Discretion
- Quiz mode differentiation approach (color themes vs icon+tint vs hybrid)
- Whether fun.html quiz cards get mode-specific styling or only quiz.html engine
- Whether inline styles move to style.css or stay in-page with token variables
- Which new tokens to create for values without existing tokens
- Shadow token system creation (if warranted)
- Pill radius tokenization

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `:root` token block in style.css (lines 1-32): 17 existing tokens for colors, typography, spacing
- Quiz-specific tokens in quiz.html (lines 17-27): --quiz-ink, --quiz-sky, --quiz-accent, etc.
- `.card` base class + BEM variants (.card--hero, .card--quiz, etc.)
- Quiz engine (engine.js): handles mode switching via `state.activeQuiz` and `populateVariantSelect()`

### Established Patterns
- BEM-style card variants: `.card--hero`, `.card--compare-day`, `.card--quiz`
- Quiz tokens defined separately in quiz.html `:root`, not in main style.css
- IIFE module pattern for page JS files
- No build step -- direct CSS custom properties, no preprocessor

### Integration Points
- style.css: main stylesheet linked from all pages
- fun.html: static hub with `.card--quiz` links to `quiz.html?mode=X-v1`
- quiz.html: inline `<style>` block (lines 16-438) with quiz-specific CSS
- updates.html: inline `<style>` block (lines 23-151) with page-specific CSS
- engine.js: renders questions dynamically, could add mode-specific CSS classes via `state.activeQuiz.id`

### Hardcoded Value Inventory
- 80+ instances of `#005696` (should be `--brand`)
- Multiple gray tones (#333, #444, #555, #666) should map to `--text` or `--text-muted`
- `#ddd` used directly instead of `--border` token
- `#1a1a1a` used instead of `--text-primary` token
- Light blues (#f0f4f8, #f0f7ff, #eef4fb) not tokenized

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches. User gave Claude full discretion on implementation choices for this phase.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 06-css-quiz-polish*
*Context gathered: 2026-03-08*
