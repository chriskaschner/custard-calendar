# T02: 34-social-sharing 02

**Slice:** S05 — **Milestone:** M002

## Description

Add quiz skip-to-result mode, flavor-themed share text, and per-flavor share icons on the Radar flavor entries (week strip on homepage).

Purpose: When someone clicks a shared quiz result or flavor link, they see meaningful content immediately and are encouraged to engage (take the quiz, explore flavors). Share buttons generate the URLs that Plan 01's crawler interception and OG cards power. Per user decision, flavor share links use `radar.html?flavor=X` (radar.html redirects to index.html preserving query params, where today-page.js handles the ?flavor= param).

Output: Modified engine.js with skip-to-result path, modified today-page.js with flavor highlight and Radar share icons, updated quiz.html with CTA button, CSS for highlight animation.

## Must-Haves

- [ ] "A user arriving at quiz.html?archetype=cool-front&flavor=Turtle sees the quiz result card immediately without taking the quiz"
- [ ] "The skip-to-result page shows a 'Take the quiz yourself' CTA button that starts the quiz fresh"
- [ ] "Share button on quiz result uses flavor-themed text: 'I'm a {Archetype} ({Flavor}) -- what's your custard personality?'"
- [ ] "A user arriving at index.html?flavor=Turtle (via radar.html redirect) sees the page scroll to and highlight the matching flavor in the Radar week strip"
- [ ] "Radar flavor cards have small share icons that copy a radar.html?flavor=X link to clipboard per user decision"

## Files

- `docs/quizzes/engine.js`
- `docs/quiz.html`
- `docs/today-page.js`
- `docs/style.css`
