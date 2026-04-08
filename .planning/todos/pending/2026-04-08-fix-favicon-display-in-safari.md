---
created: 2026-04-08T02:13:31.576Z
title: Fix favicon display in Safari
area: docs
files:
  - docs/favicon.ico
  - docs/index.html
---

## Problem

The favicon in Safari's address bar shows a low-resolution or incorrectly rendered custard cone icon. The screenshot shows the cone emoji appearing pixelated/wrong in Safari's URL bar at https://custard.chriskaschner.com. Safari has specific requirements for favicons (apple-touch-icon, SVG favicon support) that may not be met by the current setup.

## Solution

TBD -- investigate:
1. Whether an `apple-touch-icon.png` is provided (Safari prefers this)
2. Whether the favicon is being served at the right sizes (Safari needs 180x180 for touch icon)
3. Whether a `<link rel="icon" type="image/svg+xml">` would render better
4. Check if GitHub Pages is serving the favicon with correct MIME type
