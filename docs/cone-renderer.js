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
 *   FALLBACK_BASE_COLORS, FALLBACK_CONE_COLORS, FALLBACK_TOPPING_COLORS,
 *   FALLBACK_RIBBON_COLORS
 */

/* global WORKER_BASE */

// ---------------------------------------------------------------------------
// Fallback color constants (used when API data unavailable)
// ---------------------------------------------------------------------------

var FALLBACK_BASE_COLORS = {
  vanilla: '#F5DEB3',
  chocolate: '#7B4A2E',
  dark_chocolate: '#4B2E2E',
  mint: '#8FD9A8',
  strawberry: '#E88AAE',
  caramel: '#C58A45',
  cheesecake: '#F3E7CB',
  butter_pecan: '#F2E7D1',
  peach: '#F1B37C'
};

var FALLBACK_CONE_COLORS = { waffle: '#D2691E', waffle_dark: '#B8860B' };

var FALLBACK_TOPPING_COLORS = {
  oreo: '#3A2E2A',
  andes: '#1FAE7A',
  cookie_dough: '#C48A5A',
  brownie: '#4B2E2E',
  peanut_butter_cup: '#7B4A2E',
  pecan: '#A56A43',
  caramel_bits: '#C58A45',
  heath: '#C58A45',
  raspberry: '#B24A64',
  reeses: '#A56A43'
};

var FALLBACK_RIBBON_COLORS = {
  caramel: '#C58A45',
  fudge: '#4B2E2E',
  peanut_butter: '#9B6A3A',
  marshmallow: '#EDE3D1',
  strawberry: '#B24A64',
  lemon: '#F2D14C',
  blackberry: '#5A3D6E'
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
  return profiles[key] || null;
}

function getFlavorBaseColor(flavorName) {
  if (!flavorName) return FALLBACK_BASE_COLORS.vanilla;

  var key = normalizeFlavorKey(flavorName);
  var profiles = flavorColorData ? (flavorColorData.profiles || {}) : {};
  var baseColors = flavorColorData ? (flavorColorData.base_colors || {}) : {};
  var profile = profiles[key];
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

  // Fixed topping slots: T1(2,1) T2(6,1) T3(3,3) T4(5,2)
  var tSlots = [[2,1],[6,1],[3,3],[5,2]];
  for (var ti = 0; ti < tSlotKeys.length && ti < tSlots.length; ti++) {
    if (ti === 3 && hasRibbon) continue;
    var tColor = toppingColors[tSlotKeys[ti]] || FALLBACK_TOPPING_COLORS[tSlotKeys[ti]];
    if (!tColor) continue;
    rects.push('<rect x="' + (tSlots[ti][0]*s) + '" y="' + (tSlots[ti][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + tColor + '"/>');
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
  var tSlotKeys = resolveHDToppingSlots(profile);
  var highlightColor = lightenHex(baseColor, 0.3);

  var s = scale || 5;
  var rects = [];

  // Scoop (rows 0-10; full-width bottom overhangs cone by 1px each side)
  var scoopRows = [[4,13],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15]];
  for (var row = 0; row < scoopRows.length; row++) {
    var sc = scoopRows[row][0], ec = scoopRows[row][1];
    for (var col = sc; col <= ec; col++) {
      rects.push('<rect x="' + (col*s) + '" y="' + (row*s) + '" width="' + s + '" height="' + s + '" fill="' + baseColor + '"/>');
    }
  }

  // Highlight (upper-left shine)
  var hlSlots = [[4,0],[3,1]];
  for (var hi = 0; hi < hlSlots.length; hi++) {
    rects.push('<rect x="' + (hlSlots[hi][0]*s) + '" y="' + (hlSlots[hi][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + highlightColor + '"/>');
  }

  // Topping slots T1-T8
  var tSlots = [[4,2],[12,1],[6,3],[14,5],[3,6],[11,7],[5,9],[13,8]];
  for (var ti = 0; ti < tSlotKeys.length && ti < tSlots.length; ti++) {
    var tColor = toppingColors[tSlotKeys[ti]] || FALLBACK_TOPPING_COLORS[tSlotKeys[ti]];
    if (!tColor) continue;
    rects.push('<rect x="' + (tSlots[ti][0]*s) + '" y="' + (tSlots[ti][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + tColor + '"/>');
  }

  // Ribbon slots R1-R6 (S-curve)
  if (ribbonColor) {
    var rSlots = [[7,1],[8,3],[9,4],[10,5],[9,7],[8,9]];
    for (var ri = 0; ri < rSlots.length; ri++) {
      rects.push('<rect x="' + (rSlots[ri][0]*s) + '" y="' + (rSlots[ri][1]*s) + '" width="' + s + '" height="' + s + '" fill="' + ribbonColor + '"/>');
    }
  }

  // Cone (rows 11-19 checkerboard + row 20 tip)
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
