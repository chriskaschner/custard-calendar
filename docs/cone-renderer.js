/**
 * Shared cone renderer -- pixel-art custard cone SVG generation.
 *
 * Extracted from duplicated inline code in index.html, radar.html, and map.html.
 * Uses var throughout (no build step, vanilla JS).
 *
 * Usage: include via <script src="cone-renderer.js"></script> before page scripts.
 * Sets globals: flavorColorData, loadFlavorColors, normalizeFlavorKey,
 *   getFlavorProfileLocal, getFlavorBaseColor, resolveToppingSlots,
 *   resolveHDToppingSlots, lightenHex, renderMiniConeSVG, renderMiniConeHDSVG,
 *   heroConeSrc, renderHeroCone,
 *   FALLBACK_BASE_COLORS, FALLBACK_CONE_COLORS, FALLBACK_TOPPING_COLORS,
 *   FALLBACK_RIBBON_COLORS
 */

/* global WORKER_BASE */

// ---------------------------------------------------------------------------
// Fallback color constants (used when API data unavailable)
// ---------------------------------------------------------------------------

var FALLBACK_BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#6F4E37',
  chocolate_custard: '#5A3825',
  dark_chocolate: '#3B1F0B',
  mint: '#2ECC71',
  mint_andes: '#1A8A4A',
  strawberry: '#FF6B9D',
  cheesecake: '#FFF5E1',
  caramel: '#C68E17',
  butter_pecan: '#F2E7D1',
  peach: '#FFE5B4',
  lemon: '#FFF176',
  blackberry: '#6B3FA0',
  espresso: '#2C1503',
  cherry: '#C41E3A',
  pumpkin: '#D2691E',
  banana: '#F0E68C',
  coconut: '#FFFAF0',
  root_beer: '#5C3317',
  pistachio: '#93C572',
  orange: '#FF8C00',
  blue_moon: '#5B9BD5',
  maple: '#C9882C'
};

var FALLBACK_CONE_COLORS = { waffle: '#D2691E', waffle_dark: '#B8860B' };

var FALLBACK_TOPPING_COLORS = {
  oreo: '#1A1A1A',
  andes: '#0A3726',
  dove: '#2B1A12',
  pecan: '#8B5A2B',
  cashew: '#897E6C',
  heath: '#DAA520',
  butterfinger: '#E6A817',
  cookie_dough: '#917C60',
  strawberry_bits: '#A10E2B',
  raspberry: '#E91E63',
  peach_bits: '#BF7200',
  salt: '#4B4B4B',
  snickers: '#C4A060',
  cake: '#4A2800',
  cheesecake_bits: '#FFF8DC',
  m_and_m: '#FF7D7D',
  reeses: '#D4A017',
  brownie: '#ADA59C',
  blueberry: '#3B1F6B',
  pie_crust: '#C99E76',
  blackberry_drupe: '#AEA1BB',
  chocolate_chip: '#3B2314',
  sprinkles: '#D63384',
  graham_cracker: '#8B6914',
  coconut_flakes: '#F5F5DC',
  cherry_bits: '#8B0000',
  caramel_chips: '#9E6B23',
  pretzel: '#B07D3B',
  pumpkin_spice: '#6B3410',
  marshmallow_bits: '#FFFAED',
  candy_cane: '#B91C35',
  cookie_crumbs: '#7B5B32',
  fudge_bits: '#1C0B00'
};

var FALLBACK_RIBBON_COLORS = {
  caramel: '#D38B2C',
  peanut_butter: '#D4A017',
  marshmallow: '#FFFFFF',
  chocolate_syrup: '#1A0A00',
  fudge: '#3B1F0B'
};

// ---------------------------------------------------------------------------
// Canonical topping shapes (synced with worker/src/flavor-colors.js)
// ---------------------------------------------------------------------------

var _CANONICAL_TOPPING_SHAPES = {
  dot:     [[0,0],[1,0],[0,1],[1,1]],
  chunk:   [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
  sliver:  [[0,0],[0,1],[0,2]],
  flake:   [[0,0],[1,0],[2,0]],
  scatter: [[0,0],[2,1]]
};

var _CANONICAL_SHAPE_MAP = {
  oreo: 'dot', salt: 'dot', m_and_m: 'dot', reeses: 'dot',
  sprinkles: 'dot', candy_cane: 'dot', blueberry: 'dot',
  blackberry_drupe: 'dot', raspberry: 'dot', strawberry_bits: 'dot',
  peach_bits: 'dot', cherry_bits: 'dot',
  pecan: 'chunk', pretzel: 'chunk', brownie: 'chunk',
  cookie_dough: 'chunk', cake: 'chunk', snickers: 'chunk',
  cashew: 'chunk', butterfinger: 'chunk',
  chocolate_chip: 'sliver', heath: 'sliver', andes: 'sliver',
  dove: 'sliver', fudge_bits: 'sliver', caramel_chips: 'sliver',
  coconut_flakes: 'flake', graham_cracker: 'flake', pie_crust: 'flake',
  cookie_crumbs: 'flake', pumpkin_spice: 'flake',
  marshmallow_bits: 'scatter', cheesecake_bits: 'scatter'
};

// ---------------------------------------------------------------------------
// PRNG + color utilities for HD scatter renderer
// ---------------------------------------------------------------------------

function _mulberry32(seed) {
  var s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function darkenHex(hex, amount) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  var dr = Math.round(r * (1 - amount));
  var dg = Math.round(g * (1 - amount));
  var db = Math.round(b * (1 - amount));
  return '#' + [dr, dg, db].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// HD scatter topping list resolver
// ---------------------------------------------------------------------------

function resolveHDScatterToppingList(profile) {
  var tops = (profile && profile.toppings) || [];
  var density = (profile && profile.density) || 'standard';
  if (density === 'pure') return [];
  if (density === 'standard') {
    if (tops.length === 0) return [];
    var result = [];
    for (var i = 0; i < 10; i++) result.push(tops[i % tops.length]);
    return result;
  }
  if (density === 'double') {
    if (tops.length === 0) return [];
    var primary = tops[0];
    var secondary = tops[1] || primary;
    var dResult = [];
    for (var di = 0; di < 12; di++) dResult.push(di % 3 === 2 ? secondary : primary);
    return dResult;
  }
  if (density === 'explosion') {
    if (tops.length === 0) return [];
    var eResult = [];
    for (var ei = 0; ei < 14; ei++) eResult.push(tops[ei % tops.length]);
    return eResult;
  }
  if (density === 'overload') {
    if (tops.length === 0) return [];
    var oResult = [];
    for (var oi = 0; oi < 10; oi++) oResult.push(tops[0]);
    return oResult;
  }
  return tops.slice();
}

var FALLBACK_FLAVOR_ALIASES = {
  "reeses peanut butter cup": "really reese's",
  "reese's peanut butter cup": "really reese's",
  "pb cup": "really reese's",
  'georgia peach pecan': 'georgia peach',
  'oreo cookies and cream': 'oreo cookie cheesecake',
  'cookie dough craze': 'crazy for cookie dough',
  'chocolate decadence': 'dark chocolate decadence',
  'dark chocolate peanut butter crunch': 'dark chocolate pb crunch',
  'snickers': 'snickers swirl',
  'salted caramel pecan': 'salted double caramel pecan',
  'vanilla custard': 'vanilla',
  'butter pecan custard': 'butter pecan',
  'turtle sundae': 'turtle',
  'caramel turtle sundae': 'caramel turtle',
  'double strawberry custard': 'double strawberry',
  'brownie batter': 'brownie thunder',
  'mint oreo': 'mint cookie',
  'oreo mint': 'mint cookie',
  'oreo cheesecake cookie': 'oreo cookie cheesecake',
  'heath bar crunch': 'chocolate heath crunch',
  // Phase 16-01: Chocolate-family variant aliases
  'choc m&m': 'm&m swirl',
  "bonfire smores": "bonfire s'mores",
  "s'mores": "bonfire s'mores",
  // Phase 16-02: Vanilla-family variant aliases
  'raspberry cream': 'red raspberry',
  'butterfinger': 'butter finger blast',
  'cookies and cream': 'cookies & cream',
  'oreo cookies & cream': 'cookies & cream',
  'kit kat': 'kit kat bar',
  'rice krispy treat': 'rice krispie treat',
  'rice krispie': 'rice krispie treat',
  "baileys irish cream": "bailey's irish cream",
  // Phase 16-03: Fruit/specialty-family variant aliases
  'grasshopper': 'grasshopper fudge',
  'root beer': 'root beer float',
  'key lime pie': 'key lime custard pie',
  'key lime': 'key lime custard pie',
  'coconut pie': 'coconut cream pie',
  'banana pie': 'banana cream pie'
};

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

var flavorColorData = null;

// ---------------------------------------------------------------------------
// API loader
// ---------------------------------------------------------------------------

function loadFlavorColors() {
  return fetch(WORKER_BASE + '/api/v1/flavor-colors')
    .then(function(resp) {
      if (resp.ok) return resp.json();
      return null;
    })
    .then(function(data) {
      if (data) flavorColorData = data;
    })
    .catch(function() {});
}

// ---------------------------------------------------------------------------
// Flavor key normalization (handles unicode quotes, TM/R symbols, whitespace)
// ---------------------------------------------------------------------------

function normalizeFlavorKey(flavorName) {
  return String(flavorName || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Profile and color lookups
// ---------------------------------------------------------------------------

function getFlavorProfileLocal(flavorName) {
  if (!flavorColorData || !flavorName) return null;
  var profiles = flavorColorData.profiles || {};
  var key = normalizeFlavorKey(flavorName);
  if (profiles[key]) return profiles[key];

  // Alias resolution (uses API aliases if loaded, falls back to hardcoded)
  var aliases = (flavorColorData && flavorColorData.aliases) || FALLBACK_FLAVOR_ALIASES;
  var canonical = aliases[key];
  if (canonical && profiles[canonical]) return profiles[canonical];

  return null;
}

function getFlavorBaseColor(flavorName) {
  if (!flavorName) return FALLBACK_BASE_COLORS.vanilla;

  var key = normalizeFlavorKey(flavorName);
  var profiles = flavorColorData ? (flavorColorData.profiles || {}) : {};
  var baseColors = flavorColorData ? (flavorColorData.base_colors || {}) : {};
  var profile = profiles[key];
  if (!profile) {
    var aliases = (flavorColorData && flavorColorData.aliases) || FALLBACK_FLAVOR_ALIASES;
    var canonical = aliases[key];
    if (canonical) profile = profiles[canonical];
  }
  if (profile && baseColors[profile.base]) return baseColors[profile.base];

  if (key.includes('mint')) return baseColors.mint || FALLBACK_BASE_COLORS.mint;
  if (key.includes('dark choc')) return baseColors.dark_chocolate || FALLBACK_BASE_COLORS.dark_chocolate;
  if (key.includes('chocolate') || key.includes('cocoa')) return baseColors.chocolate || FALLBACK_BASE_COLORS.chocolate;
  if (key.includes('strawberry')) return baseColors.strawberry || FALLBACK_BASE_COLORS.strawberry;
  if (key.includes('cheesecake')) return baseColors.cheesecake || FALLBACK_BASE_COLORS.cheesecake;
  if (key.includes('caramel')) return baseColors.caramel || FALLBACK_BASE_COLORS.caramel;
  if (key.includes('peach')) return baseColors.peach || FALLBACK_BASE_COLORS.peach;
  if (key.includes('butter pecan')) return baseColors.butter_pecan || FALLBACK_BASE_COLORS.butter_pecan;
  return baseColors.vanilla || FALLBACK_BASE_COLORS.vanilla;
}

// ---------------------------------------------------------------------------
// Topping slot resolution
// ---------------------------------------------------------------------------

function resolveToppingSlots(profile) {
  var tops = (profile && profile.toppings) || [];
  var density = (profile && profile.density) || 'standard';
  if (density === 'pure') return [];
  if (density === 'double') {
    var sl = tops.length > 0 ? [tops[0], tops[0]] : [];
    if (tops.length > 1) sl.push(tops[1]);
    return sl;
  }
  if (density === 'explosion') return tops.slice(0, 4);
  if (density === 'overload') return tops.length > 0 ? [tops[0], tops[0]] : [];
  return tops.slice(0, 4);
}

function resolveHDToppingSlots(profile) {
  var tops = (profile && profile.toppings) || [];
  var density = (profile && profile.density) || 'standard';
  if (density === 'pure') return [];
  if (density === 'double') {
    if (tops.length === 0) return [];
    var primary = tops[0];
    var secondary = tops[1] || primary;
    return [primary, primary, secondary, primary, secondary, primary, secondary];
  }
  if (density === 'explosion') {
    if (tops.length === 0) return [];
    var slots = [];
    for (var i = 0; i < 8; i++) slots.push(tops[i % tops.length]);
    return slots;
  }
  if (density === 'overload') return tops.length > 0 ? [tops[0], tops[0], tops[0], tops[0], tops[0], tops[0]] : [];
  if (tops.length === 0) return [];
  var standardSlots = [];
  for (var si = 0; si < 6; si++) standardSlots.push(tops[si % tops.length]);
  return standardSlots;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function lightenHex(hex, amount) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  var lr = Math.round(r + (255 - r) * amount);
  var lg = Math.round(g + (255 - g) * amount);
  var lb = Math.round(b + (255 - b) * amount);
  return '#' + [lr, lg, lb].map(function(c) { return c.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Standard cone SVG (9x11 pixel grid)
// ---------------------------------------------------------------------------

function renderMiniConeSVG(flavorName, scale) {
  if (!flavorName) return '';

  var baseColors = flavorColorData ? (flavorColorData.base_colors || {}) : {};
  var ribbonColors = flavorColorData ? (flavorColorData.ribbon_colors || {}) : {};
  var toppingColors = flavorColorData ? (flavorColorData.topping_colors || {}) : {};
  var coneColors = flavorColorData ? (flavorColorData.cone_colors || FALLBACK_CONE_COLORS) : FALLBACK_CONE_COLORS;

  var profile = getFlavorProfileLocal(flavorName);
  var baseColor = (profile ? baseColors[profile.base] : null) || getFlavorBaseColor(flavorName);
  var ribbonKey = profile ? profile.ribbon : null;
  var hasRibbon = ribbonKey && (!profile || profile.density !== 'pure');
  var ribbonColor = hasRibbon ? ((ribbonColors[ribbonKey] || FALLBACK_RIBBON_COLORS[ribbonKey]) || null) : null;
  var tSlotKeys = resolveToppingSlots(profile);

  var s = scale || 5;
  var rects = [];

  // Scoop base fill (rounded top; full-width bottom overhangs cone by 1px each side)
  var scoopRows = [[3,5],[2,6],[1,7],[1,7],[1,7]];
  for (var row = 0; row < scoopRows.length; row++) {
    var sc = scoopRows[row][0], ec = scoopRows[row][1];
    for (var col = sc; col <= ec; col++) {
      rects.push('<rect x="' + (col*s) + '" y="' + (row*s) + '" width="' + s + '" height="' + s + '" fill="' + baseColor + '"/>');
    }
  }

  // Topping placement: use per-flavor l2_toppings override when present (precise
  // per-pixel layout), otherwise fall back to 4 fixed slots across rows 1-4.
  if (profile && profile.l2_toppings) {
    for (var li = 0; li < profile.l2_toppings.length; li++) {
      var lt = profile.l2_toppings[li];
      var lColor = toppingColors[lt[2]] || FALLBACK_TOPPING_COLORS[lt[2]];
      if (!lColor) continue;
      rects.push('<rect x="' + (lt[0]*s) + '" y="' + (lt[1]*s) + '" width="' + s + '" height="' + s + '" fill="' + lColor + '"/>');
    }
  } else {
    // Fixed topping slots T1-T4: distributed across rows 1-4 so toppings span
    // the full scoop height. T1:(3,1) T2:(6,2) T3:(3,3) T4:(5,4)
    var tSlots = [[3,1],[6,2],[3,3],[5,4]];
    for (var ti = 0; ti < tSlotKeys.length && ti < tSlots.length; ti++) {
      var tColor = toppingColors[tSlotKeys[ti]] || FALLBACK_TOPPING_COLORS[tSlotKeys[ti]];
      if (!tColor) continue;
      rects.push('<rect x="' + (tSlots[ti][0]*s) + '" y="' + (tSlots[ti][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + tColor + '"/>');
    }
  }

  // Fixed ribbon slots: R1(3,0) R2(4,1) R3(5,2)
  if (ribbonColor) {
    var rSlots = [[3,0],[4,1],[5,2]];
    for (var ri = 0; ri < rSlots.length; ri++) {
      rects.push('<rect x="' + (rSlots[ri][0]*s) + '" y="' + (rSlots[ri][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + ribbonColor + '"/>');
    }
  }

  // Cone checkerboard (rows 5-8) + tip (row 9)
  var coneRows = [[2,6],[2,6],[3,5],[3,5]];
  for (var cr = 0; cr < coneRows.length; cr++) {
    var csc = coneRows[cr][0], cec = coneRows[cr][1];
    for (var col2 = csc; col2 <= cec; col2++) {
      var wc = ((cr + col2) % 2 === 0) ? coneColors.waffle : coneColors.waffle_dark;
      rects.push('<rect x="' + (col2*s) + '" y="' + ((cr+5)*s) + '" width="' + s + '" height="' + s + '" fill="' + wc + '"/>');
    }
  }
  rects.push('<rect x="' + (4*s) + '" y="' + (9*s) + '" width="' + s + '" height="' + s + '" fill="' + coneColors.waffle_dark + '"/>');

  return '<svg class="mini-cone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (9*s) + ' ' + (10*s) + '" width="' + (9*s) + '" height="' + (10*s) + '" shape-rendering="crispEdges">' + rects.join('') + '</svg>';
}

// ---------------------------------------------------------------------------
// HD cone SVG (18x22 pixel grid)
// ---------------------------------------------------------------------------

function renderMiniConeHDSVG(flavorName, scale) {
  if (!flavorName) return '';

  var baseColors = flavorColorData ? (flavorColorData.base_colors || {}) : {};
  var ribbonColors = flavorColorData ? (flavorColorData.ribbon_colors || {}) : {};
  var toppingColors = flavorColorData ? (flavorColorData.topping_colors || {}) : {};
  var coneColors = flavorColorData ? (flavorColorData.cone_colors || FALLBACK_CONE_COLORS) : FALLBACK_CONE_COLORS;
  var CONE_TIP = '#8B5A2B';

  var profile = getFlavorProfileLocal(flavorName);
  var baseColor = (profile ? baseColors[profile.base] : null) || getFlavorBaseColor(flavorName);
  var ribbonKey = profile ? profile.ribbon : null;
  var hasRibbon = ribbonKey && (!profile || profile.density !== 'pure');
  var ribbonColor = hasRibbon ? ((ribbonColors[ribbonKey] || FALLBACK_RIBBON_COLORS[ribbonKey]) || null) : null;
  var highlightColor = lightenHex(baseColor, 0.3);
  var shadowColor = darkenHex(baseColor, 0.10);

  var s = scale || 5;
  var rects = [];

  // Deterministic seed from flavor name
  var seed = flavorName.split('').reduce(function(a, c) { return (a * 31 + c.charCodeAt(0)) | 0; }, 0);
  var rng = _mulberry32(seed);

  // HD scoop rows [startCol, endCol] for rows 0-10
  var hdScoopRows = [[4,13],[3,14],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[3,14]];

  // 1. Base scoop fill
  for (var row = 0; row < hdScoopRows.length; row++) {
    var sc = hdScoopRows[row][0], ec = hdScoopRows[row][1];
    for (var col = sc; col <= ec; col++) {
      rects.push('<rect x="' + (col*s) + '" y="' + (row*s) + '" width="' + s + '" height="' + s + '" fill="' + baseColor + '"/>');
    }
  }

  // 2. Highlight (upper-left shine)
  var hlSlots = [[4,0],[3,1]];
  for (var hi = 0; hi < hlSlots.length; hi++) {
    rects.push('<rect x="' + (hlSlots[hi][0]*s) + '" y="' + (hlSlots[hi][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + highlightColor + '"/>');
  }

  // 3. Scatter toppings with Mulberry32 PRNG + collision detection
  var toppingList = resolveHDScatterToppingList(profile);
  var occupied = {};

  for (var pi = 0; pi < toppingList.length; pi++) {
    var toppingKey = toppingList[pi];
    var tColor = toppingColors[toppingKey] || FALLBACK_TOPPING_COLORS[toppingKey];
    if (!tColor) continue;
    var shapeKey = _CANONICAL_SHAPE_MAP[toppingKey] || 'dot';
    var shape = _CANONICAL_TOPPING_SHAPES[shapeKey];

    for (var attempt = 0; attempt < 30; attempt++) {
      var sRow = Math.floor(rng() * hdScoopRows.length);
      var sSc = hdScoopRows[sRow][0], sEc = hdScoopRows[sRow][1];
      var sCol = sSc + Math.floor(rng() * (sEc - sSc + 1));

      // Verify every shape pixel is within scoop bounds and unoccupied
      var valid = true;
      for (var si = 0; si < shape.length; si++) {
        var pc = sCol + shape[si][0];
        var pr = sRow + shape[si][1];
        if (pr >= hdScoopRows.length) { valid = false; break; }
        var rsc = hdScoopRows[pr][0], rec = hdScoopRows[pr][1];
        if (pc < rsc || pc > rec) { valid = false; break; }
        if (occupied[pr * 100 + pc]) { valid = false; break; }
      }

      if (valid) {
        for (var sj = 0; sj < shape.length; sj++) {
          var ppc = sCol + shape[sj][0];
          var ppr = sRow + shape[sj][1];
          occupied[ppr * 100 + ppc] = true;
          rects.push('<rect x="' + (ppc*s) + '" y="' + (ppr*s) + '" width="' + s + '" height="' + s + '" fill="' + tColor + '"/>');
        }
        break;
      }
    }
  }

  // 4. Ribbon slots R1-R6 (S-curve)
  if (ribbonColor) {
    var rSlots = [[7,1],[8,3],[9,4],[10,5],[9,7],[8,9]];
    for (var ri = 0; ri < rSlots.length; ri++) {
      rects.push('<rect x="' + (rSlots[ri][0]*s) + '" y="' + (rSlots[ri][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + ribbonColor + '"/>');
    }
  }

  // 5. Cone (rows 11-19 checkerboard + row 20 tip)
  var coneRows = [[4,13],[4,13],[5,12],[5,12],[6,11],[6,11],[7,10],[7,10],[8,9]];
  for (var cr = 0; cr < coneRows.length; cr++) {
    var csc = coneRows[cr][0], cec = coneRows[cr][1];
    for (var col2 = csc; col2 <= cec; col2++) {
      var wc = ((cr + col2) % 2 === 0) ? coneColors.waffle : coneColors.waffle_dark;
      rects.push('<rect x="' + (col2*s) + '" y="' + ((cr+11)*s) + '" width="' + s + '" height="' + s + '" fill="' + wc + '"/>');
    }
  }
  rects.push('<rect x="' + (8*s) + '" y="' + (20*s) + '" width="' + s + '" height="' + s + '" fill="' + CONE_TIP + '"/>');
  rects.push('<rect x="' + (9*s) + '" y="' + (20*s) + '" width="' + s + '" height="' + s + '" fill="' + CONE_TIP + '"/>');

  return '<svg class="mini-cone" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (18*s) + ' ' + (21*s) + '" width="' + (18*s) + '" height="' + (21*s) + '" shape-rendering="crispEdges">' + rects.join('') + '</svg>';
}

// ---------------------------------------------------------------------------
// Hero cone PNG lookup + fallback
// ---------------------------------------------------------------------------

/**
 * Return the relative path to a hero cone PNG for a given flavor name.
 * Slug: lowercase, non-alphanumeric replaced with hyphens, trimmed.
 * Returns null if flavorName is empty/null.
 */
function heroConeSrc(flavorName) {
  if (!flavorName) return null;
  var key = normalizeFlavorKey(flavorName);
  var canonical = FALLBACK_FLAVOR_ALIASES[key];
  var nameForSlug = canonical || key;
  var slug = nameForSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return null;
  return 'assets/cones/' + slug + '.png';
}

/**
 * Render a hero cone into a container: tries PNG first, falls back to HD SVG.
 * @param {string} flavorName
 * @param {HTMLElement} container - DOM element to render into
 * @param {number} [fallbackScale] - scale for HD SVG fallback (default 6)
 */
function renderHeroCone(flavorName, container, fallbackScale) {
  var src = heroConeSrc(flavorName);
  if (!src) {
    container.innerHTML = renderMiniConeHDSVG(flavorName, fallbackScale || 6);
    return;
  }
  var img = new Image();
  img.alt = flavorName + ' cone';
  img.className = 'hero-cone-img';
  img.src = src;
  img.onerror = function() {
    container.innerHTML = renderMiniConeHDSVG(flavorName, fallbackScale || 6);
  };
  container.innerHTML = '';
  container.appendChild(img);
}
