/**
 * Pixel art sprite renderer for quiz option icons.
 * Each sprite is an array of row strings. Characters map to colors.
 * Renders as crisp SVG matching the cone renderer aesthetic.
 */

var PALETTE = {
  '.': null, // transparent
  // Animals
  'B': '#3e2723', // dark brown / black
  'b': '#8d6e63', // brown
  'w': '#ffffff', // white
  'y': '#fdd835', // yellow (eyes/beak)
  'o': '#e65100', // orange (fox)
  'O': '#ff8f00', // light orange
  'g': '#c8a24e', // golden
  'G': '#e0c068', // light golden
  'n': '#546e7a', // blue-gray (dolphin)
  'N': '#78909c', // light blue-gray
  'a': '#b0bec5', // dolphin belly
  'f': '#37474f', // dark fin
  // Instruments
  'R': '#8d6e63', // wood brown
  'r': '#a1887f', // light wood
  'D': '#5d4037', // drum dark
  'd': '#795548', // drum body
  'S': '#bdbdbd', // silver/metal
  's': '#9e9e9e', // dark silver
  'P': '#424242', // pipe dark
  'p': '#616161', // pipe
  'T': '#8e0000', // tartan red
  't': '#c62828', // tartan light
  'L': '#1b5e20', // tartan green
};

var SPRITES = {
  // OWL: ear tufts, big round eyes, stocky body
  'owl': [
    '.Bb..bB.',
    '.BwBBwB.',
    '.ByBByB.',
    '..BBBB..',
    '.bBBBBb.',
    'bBBBBBBb',
    '.bBByBb.',
    '..bBBb..',
    '..b..b..',
    '.bB..Bb.',
  ],
  // FOX: pointed ears, orange body, white chest
  'fox': [
    'o......o',
    'oo....oo',
    'oow..woo',
    'owwwwwwo',
    'owBwwBwo',
    '.owwwwo.',
    '..owwo..',
    '.oooooo.',
    '.o....o.',
    'oo....oo',
  ],
  // GOLDEN RETRIEVER: floppy ears, golden, happy
  'golden-retriever': [
    '..gGGg..',
    '.gGGGGg.',
    'ggGGGGgg',
    'GgBGGBgG',
    'GgGGGGgG',
    '.gGBBGg.',
    '..gGGg..',
    '.gGGGGg.',
    '.gGGGGg.',
    '..g..g..',
  ],
  // DOLPHIN: curved body, dorsal fin, snout
  'dolphin': [
    '....f...',
    '...fn...',
    '..fNNn..',
    '.nNNNNn.',
    'nNNaNNNn',
    'NNaaNNnn',
    '.nNNNn..',
    '..nnn.f.',
    '........',
    '........',
  ],
  // DRUMS: pair of drums with crossed sticks
  'drums': [
    '..s..s..',
    '..s..s..',
    '.sDDDs..',
    '.dDDDDs.',
    '.dDDDDs.',
    'sDDDDDDs',
    'sDDDDDDs',
    '.dDDDDd.',
    '.dddddd.',
    '..ssss..',
  ],
  // BASS: upright/electric bass body + neck
  'bass': [
    '....s...',
    '....R...',
    '....R...',
    '....R...',
    '...RR...',
    '..RRRR..',
    '.rRBBRr.',
    '.rRBBRr.',
    '..RRRR..',
    '...rr...',
  ],
  // GUITAR: acoustic shape
  'guitar': [
    '.....ss.',
    '....sRs.',
    '....R...',
    '....R...',
    '...RR...',
    '..RRRR..',
    '.RRBBRR.',
    '.RRBBRR.',
    '..RRRR..',
    '...RR...',
  ],
  // BAGPIPES: bag + three drones + chanter
  'bagpipes': [
    '.P..P.P.',
    '.P..P.P.',
    '.P..P.P.',
    '.PttPtP.',
    'tTTTTTt.',
    'TTTTTTT.',
    'tTTTTTt.',
    '.tTTTt..',
    '..tPt...',
    '...P....',
  ],
};

/**
 * Render a named pixel sprite as an SVG string.
 * @param {string} name - sprite key from SPRITES
 * @param {number} scale - pixel size in output (default 3)
 * @returns {string} SVG markup or empty string
 */
function renderPixelSprite(name, scale) {
  var rows = SPRITES[name];
  if (!rows) return '';
  scale = scale || 3;
  var h = rows.length;
  var w = rows[0].length;
  var svgW = w * scale;
  var svgH = h * scale;
  var rects = '';
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var ch = rows[y][x];
      var color = PALETTE[ch];
      if (!color) continue;
      rects += '<rect x="' + (x * scale) + '" y="' + (y * scale) +
        '" width="' + scale + '" height="' + scale + '" fill="' + color + '"/>';
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW +
    '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH +
    '" shape-rendering="crispEdges" style="vertical-align:middle">' + rects + '</svg>';
}

/**
 * Render a color swatch as an SVG circle.
 * @param {string} hex - color hex value
 * @param {number} size - diameter (default 28)
 * @returns {string} SVG markup
 */
function renderColorSwatch(hex, size) {
  size = size || 28;
  var r = size / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size +
    '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
    '" style="vertical-align:middle">' +
    '<circle cx="' + r + '" cy="' + r + '" r="' + (r - 1) +
    '" fill="' + hex + '" stroke="#ccc" stroke-width="1"/></svg>';
}

/**
 * Resolve an icon field from quiz JSON into SVG markup.
 * Supports "color:#hex" and "pixel:spriteName" formats.
 * @param {string} iconStr - the icon field value
 * @param {number} scale - pixel scale for sprites
 * @returns {string} SVG markup or empty string
 */
function resolveQuizIcon(iconStr, scale) {
  if (!iconStr) return '';
  if (iconStr.startsWith('color:')) {
    return renderColorSwatch(iconStr.slice(6), 28);
  }
  if (iconStr.startsWith('pixel:')) {
    return renderPixelSprite(iconStr.slice(6), scale || 3);
  }
  return '';
}

// Export for use in engine.js
window.QuizSprites = {
  renderPixelSprite: renderPixelSprite,
  renderColorSwatch: renderColorSwatch,
  resolve: resolveQuizIcon,
};
