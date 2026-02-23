#!/usr/bin/env node
/**
 * Generate the pixel-art OG image for social sharing.
 *
 * Renders a 1200x630 SVG scene: pixel-art cloud raining HD cones
 * in different flavors, with diagonal rain streaks.
 *
 * Usage:
 *   cd worker
 *   node scripts/generate-og-image.mjs > /tmp/og.svg
 *   npx resvg-cli /tmp/og.svg ../docs/og-calendar.png
 */

import { renderConeHDSVG } from '../src/flavor-colors.js';

const W = 1200;
const H = 630;
const PX = 8; // pixel block size for cloud

// Cloud palette
const OUTLINE = '#4472B8';
const BODY = '#FFFFFF';
const HIGHLIGHT = '#E8F4FF';
const SHADOW = '#C8D8E8';
const UNDERBELLY = '#B0C4D8';

// Rain palette
const RAIN_COLOR = '#6BA4D4';

// Eight flavors chosen for maximum visual contrast
const CONE_FLAVORS = [
  'Double Strawberry',         // pink
  'Mint Explosion',            // green + toppings
  'Dark Chocolate Decadence',  // dark brown pure
  'Caramel Cashew',            // vanilla + caramel ribbon
  'Chocolate Volcano',         // chocolate + mixed toppings
  'Georgia Peach',             // peach
  "Really Reese's",            // chocolate + PB ribbon
  'Raspberry Cheesecake',      // cheesecake + raspberry
];

function extractInner(svg) {
  return svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
}

/**
 * Build a proper pixel-art cloud using overlapping circle puffs.
 * Each puff is an ellipse rasterized to the pixel grid. Outline is
 * computed by checking neighbors. Highlight on upper interior,
 * shadow on lower interior.
 */
function buildCloud() {
  // Cloud grid dimensions
  const cols = Math.ceil(W / PX);
  const rows = Math.ceil(H / PX);

  // Initialize grid: 0 = empty
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols));

  // Define puffs as ellipses: { cx, cy, rx, ry } in pixel-block coords
  // Cloud centered at col ~75 (600px / 8px), pushed toward top
  const puffs = [
    // Three top bumps
    { cx: 52, cy: 10, rx: 13, ry: 10 }, // left bump
    { cx: 75, cy: 7, rx: 15, ry: 11 },  // center bump (tallest)
    { cx: 98, cy: 9, rx: 12, ry: 10 },  // right bump
    // Main body (wide base connecting everything)
    { cx: 75, cy: 18, rx: 35, ry: 9 },
    // Fill gaps between bumps
    { cx: 63, cy: 13, rx: 12, ry: 8 },
    { cx: 87, cy: 12, rx: 12, ry: 8 },
  ];

  // Fill puffs into grid (mark as body=2)
  for (const puff of puffs) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = (c - puff.cx) / puff.rx;
        const dy = (r - puff.cy) / puff.ry;
        if (dx * dx + dy * dy <= 1.0) {
          grid[r][c] = 2; // body
        }
      }
    }
  }

  // Mark outline: body pixels adjacent to empty
  // We'll render outline as a separate pass
  const outline = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) continue;
      // Check 4-neighbors
      const neighbors = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
        [r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === 0) {
          outline[r][c] = 1;
          break;
        }
      }
    }
  }

  // Determine highlight/shadow regions
  // For each puff, upper 40% = highlight, lower 20% = shadow
  const shading = Array.from({ length: rows }, () => new Uint8Array(cols)); // 0=body, 1=highlight, 2=shadow, 3=underbelly
  for (const puff of puffs) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 0) continue;
        const dx = (c - puff.cx) / puff.rx;
        const dy = (r - puff.cy) / puff.ry;
        if (dx * dx + dy * dy > 1.0) continue;

        // Vertical position within this puff (-1 to +1)
        const yNorm = (r - puff.cy) / puff.ry;

        if (yNorm < -0.3 && shading[r][c] !== 1) {
          shading[r][c] = 1; // highlight (upper)
        } else if (yNorm > 0.7) {
          shading[r][c] = 3; // underbelly
        } else if (yNorm > 0.5 && shading[r][c] !== 1) {
          shading[r][c] = 2; // shadow
        }
      }
    }
  }

  // Render to SVG rects
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) continue;

      let fill;
      if (outline[r][c]) {
        fill = OUTLINE;
      } else if (shading[r][c] === 1) {
        fill = HIGHLIGHT;
      } else if (shading[r][c] === 2) {
        fill = SHADOW;
      } else if (shading[r][c] === 3) {
        fill = UNDERBELLY;
      } else {
        fill = BODY;
      }

      rects.push(`<rect x="${c * PX}" y="${r * PX}" width="${PX}" height="${PX}" fill="${fill}"/>`);
    }
  }

  return rects.join('');
}

/**
 * Diagonal rain streaks between cloud and cones.
 * Each streak is 2-3 pixel blocks at ~30 degree angle.
 */
function buildRain() {
  const rects = [];
  // Rain streaks: [x, y] starting positions, each streak is 4 blocks diagonal
  const streaks = [
    // Row 1 (below cloud)
    [180, 230], [280, 225], [380, 235], [490, 228], [590, 232],
    [700, 225], [800, 238], [900, 228], [1000, 235],
    // Row 2
    [220, 290], [330, 295], [450, 285], [560, 292], [670, 288],
    [780, 295], [880, 285], [960, 292],
    // Row 3
    [260, 350], [370, 345], [500, 355], [620, 348], [740, 352],
    [850, 345], [940, 350],
    // Row 4
    [300, 410], [430, 405], [560, 412], [690, 408], [810, 415],
    // Row 5
    [350, 465], [490, 460], [640, 468], [770, 462],
  ];

  for (const [x, y] of streaks) {
    // Each streak: 4 blocks going down-right diagonally
    for (let i = 0; i < 4; i++) {
      rects.push(`<rect x="${x + i * PX}" y="${y + i * PX * 2}" width="${PX}" height="${PX * 2}" fill="${RAIN_COLOR}" opacity="0.7"/>`);
    }
  }
  return rects.join('');
}

function buildScene() {
  // 8 cones in 3 staggered rows, scattered like rain
  const coneScale = 5;
  const coneConfigs = [
    // Row 1 (3 cones)
    { flavor: CONE_FLAVORS[0], x: 190, y: 260 },
    { flavor: CONE_FLAVORS[1], x: 510, y: 250 },
    { flavor: CONE_FLAVORS[2], x: 860, y: 265 },
    // Row 2 (3 cones, offset)
    { flavor: CONE_FLAVORS[3], x: 310, y: 370 },
    { flavor: CONE_FLAVORS[4], x: 640, y: 360 },
    { flavor: CONE_FLAVORS[5], x: 980, y: 375 },
    // Row 3 (2 cones)
    { flavor: CONE_FLAVORS[6], x: 420, y: 470 },
    { flavor: CONE_FLAVORS[7], x: 760, y: 465 },
  ];

  const coneGroups = coneConfigs.map(({ flavor, x, y }) => {
    const svg = renderConeHDSVG(flavor, coneScale);
    const inner = extractInner(svg);
    return `<g transform="translate(${x},${y})">${inner}</g>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">
  <!-- Background: light warm gray like the reference -->
  <rect width="${W}" height="${H}" fill="#F0EDE8"/>

  <!-- Pixel-art cloud -->
  ${buildCloud()}

  <!-- Diagonal rain streaks -->
  ${buildRain()}

  <!-- Falling HD cones -->
  ${coneGroups}
</svg>`;
}

console.log(buildScene());
