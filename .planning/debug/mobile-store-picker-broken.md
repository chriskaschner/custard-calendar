---
status: awaiting_human_verify
trigger: "mobile-store-picker-broken: bottom sheet shows input controls instead of store list"
created: 2026-04-03T00:00:00Z
updated: 2026-04-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- On iOS Safari, the searchInput.focus() call on line 447 of shared-nav.js immediately opens the virtual keyboard when the store picker opens. iOS does not reduce 100vh when the keyboard appears, so the panel's max-height still spans the full screen. The keyboard covers the bottom ~40-50% of the viewport, hiding the store list behind the keyboard. The user only sees: drag handle + title + search input + keyboard toolbar (prev/next arrows + Done), with the store list invisible below the keyboard.
test: Verified in Playwright at 375x667 that the HTML/CSS is structurally correct -- list items render and are visible when no keyboard is present. The bug is exclusively caused by the auto-focus triggering the iOS keyboard.
expecting: Removing auto-focus on mobile will let users see the store list immediately. They can still tap the search field to filter.
next_action: Implement fix: skip searchInput.focus() on mobile (touch devices), apply fix, verify

## Symptoms

expected: Tapping the store chip in the header opens a bottom sheet with a scrollable list of stores the user can pick from. Store names should be visible and tappable.
actual: The bottom sheet opens with "Select a store" title and X close button, but instead of a store list, it shows up/down arrow buttons, a checkmark, and a text input. The user has to type a store name (e.g., "Horeb") with no list visible. This looks like a native HTML input or select element rendering its default mobile UI instead of a custom store list.
errors: No JS errors visible - this is a UI/UX issue where the wrong element type may be used
reproduction: Open any page on mobile (real device or DevTools responsive mode ~375px), tap the store chip in the header to open the store picker bottom sheet
started: Introduced in commits d363e63 and 5e90353 (sticky branded header + bottom sheet store picker)

## Eliminated

## Evidence

- timestamp: 2026-04-03T00:01:00Z
  checked: shared-nav.js buildStorePickerHTML() function
  found: The function correctly builds an <ul class="store-picker-list"> with <li class="store-picker-item"> elements for each store. No <select> element involved. Uses <input type="text"> for search only.
  implication: The store list IS being rendered as HTML list items, not a native <select>. The "up/down arrows + checkmark" the user sees is likely the iOS input accessory bar (keyboard toolbar), not a native select picker.

- timestamp: 2026-04-03T00:02:00Z
  checked: style.css store-picker styles (lines 3505-3715)
  found: .store-picker uses position:fixed inset:0 z-index:1000 flex align-items:flex-end. .store-picker-panel has max-height:calc(100vh - header - 8px) flex-direction:column overflow:hidden. .store-picker-list has flex:1 overflow-y:auto. On mobile, the panel animates up from bottom (sheet-up animation).
  implication: The layout looks correct in theory. The list gets flex:1 which should fill remaining space. But overflow:hidden on the panel could clip the list if the flex children exceed the panel height.

- timestamp: 2026-04-03T00:03:00Z
  checked: showStorePicker() line 447 -- searchInput.focus()
  found: The search input is auto-focused when the picker opens. On iOS mobile, this triggers the virtual keyboard to appear immediately.
  implication: On iOS, 100vh does NOT shrink when the keyboard appears. The panel's max-height is still full screen minus header. But the keyboard covers the bottom ~40-50% of the screen. The store list, which is at the bottom of the flex column, would be behind the keyboard. Combined with the immediate focus, the user never sees the list before the keyboard covers it.

- timestamp: 2026-04-03T00:04:00Z
  checked: Playwright tests at 375x667 viewport with both 3 and 1012 stores
  found: In headless Chromium (no virtual keyboard), the store picker renders correctly. Panel fills from header to bottom, list items are visible and scrollable. With 3 stores: list at y=490, h=177px. With 1012 stores: list at y=230, h=437px. All items have non-zero bounding boxes.
  implication: The HTML/CSS structure is correct. The bug is exclusively caused by iOS keyboard behavior triggered by the auto-focus on the search input. Without the keyboard, the list is fully visible and functional.

- timestamp: 2026-04-03T00:05:00Z
  checked: iOS Safari keyboard behavior with position:fixed elements and 100vh
  found: iOS Safari does not reduce CSS vh units when the virtual keyboard appears. The keyboard overlays the bottom of the viewport. A bottom sheet panel with max-height:calc(100vh-...) renders at full height but the lower portion is hidden behind the keyboard. The "up/down arrow buttons and checkmark" the user described are the iOS input accessory bar (form navigation toolbar that appears above the keyboard with <> arrows and Done button).
  implication: Root cause confirmed. The auto-focus on searchInput.focus() immediately opens the keyboard, hiding the store list. The user only sees the top portion of the panel (title, search input) plus the keyboard toolbar, and assumes the store list is missing.

## Resolution

root_cause: searchInput.focus() on line 447 of shared-nav.js immediately opens the iOS virtual keyboard when the store picker bottom sheet opens. iOS Safari does not shrink CSS vh units when the keyboard appears, so the panel maintains full height but the keyboard covers the lower ~40-50% of the viewport, hiding the entire store list. The user only sees the panel header, search input, and iOS keyboard toolbar (prev/next arrows + Done button).
fix: In shared-nav.js showStorePicker(), skip searchInput.focus() on touch/mobile devices (detected via 'ontouchstart' in window or navigator.maxTouchPoints > 0). On desktop, auto-focus is preserved for keyboard-first UX. This prevents iOS Safari's virtual keyboard from opening immediately and covering the store list.
verification: 4 Playwright tests pass at 375x667 viewport -- (1) list visible with 3 stores, (2) list visible with 1012 stores, (3) search NOT auto-focused on touch devices, (4) search IS auto-focused on desktop. All 15 related nav/store browser tests pass (nav-375px, nav-clickthrough, nav-footer, primary-store-persistence, today-onboarding). CSS unchanged.
files_changed: [docs/shared-nav.js, worker/test/browser/store-picker-mobile.spec.mjs]
