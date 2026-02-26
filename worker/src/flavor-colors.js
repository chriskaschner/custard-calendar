/**
 * Canonical flavor color system for custard visualization.
 *
 * Ported from tidbyt/culvers_fotd.star -- single source of truth for flavor
 * profiles, color palettes, and cone rendering. Used by social cards, Radar
 * mini-cones, and the /api/v1/flavor-colors endpoint.
 */

export const BASE_COLORS = {
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
};

export const RIBBON_COLORS = {
  caramel: '#D38B2C',
  peanut_butter: '#D4A017',
  marshmallow: '#FFFFFF',
  chocolate_syrup: '#1A0A00',
  fudge: '#3B1F0B',
};

export const TOPPING_COLORS = {
  oreo: '#1A1A1A',
  andes: '#1FAE7A',
  dove: '#2B1A12',
  pecan: '#8B5A2B',
  cashew: '#D4C4A8',
  heath: '#DAA520',
  butterfinger: '#E6A817',
  cookie_dough: '#C4A882',
  strawberry_bits: '#FF1744',
  raspberry: '#E91E63',
  peach_bits: '#FF9800',
  salt: '#FFFFFF',
  snickers: '#C4A060',
  cake: '#4A2800',
  cheesecake_bits: '#FFF8DC',
  m_and_m: '#FF4444',
  reeses: '#D4A017',
  brownie: '#2D1700',
  blueberry: '#3B1F6B',
  pie_crust: '#C4966A',
};

export const CONE_COLORS = {
  waffle: '#D2691E',
  waffle_dark: '#B8860B',
};

/**
 * Flavor profiles: lowercase name -> { base, ribbon, toppings, density }
 */
export const FLAVOR_PROFILES = {
  'dark chocolate pb crunch': { base: 'dark_chocolate', ribbon: 'peanut_butter', toppings: ['butterfinger'], density: 'standard' },
  'chocolate caramel twist': { base: 'chocolate', ribbon: 'caramel', toppings: ['dove'], density: 'standard' },
  'mint explosion': { base: 'mint', ribbon: null, toppings: ['oreo', 'andes', 'dove'], density: 'explosion' },
  'turtle dove': { base: 'vanilla', ribbon: 'marshmallow', toppings: ['pecan', 'dove'], density: 'standard' },
  'double strawberry': { base: 'strawberry', ribbon: null, toppings: ['strawberry_bits'], density: 'double' },
  'turtle cheesecake': { base: 'cheesecake', ribbon: 'caramel', toppings: ['dove', 'pecan', 'cheesecake_bits'], density: 'explosion' },
  'caramel turtle': { base: 'caramel', ribbon: null, toppings: ['pecan', 'dove'], density: 'standard' },
  'andes mint avalanche': { base: 'mint_andes', ribbon: null, toppings: ['andes', 'andes', 'dove'], density: 'standard' },
  'oreo cookie cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['oreo', 'cheesecake_bits'], density: 'standard' },
  "devil's food cake": { base: 'dark_chocolate', ribbon: null, toppings: ['cake', 'dove'], density: 'standard' },
  'caramel cashew': { base: 'vanilla', ribbon: 'caramel', toppings: ['cashew'], density: 'standard' },
  'butter pecan': { base: 'butter_pecan', ribbon: null, toppings: ['pecan'], density: 'standard' },
  'caramel chocolate pecan': { base: 'chocolate_custard', ribbon: 'caramel', toppings: ['pecan', 'pecan', 'dove', 'pecan'], density: 'explosion' },
  'dark chocolate decadence': { base: 'dark_chocolate', ribbon: null, toppings: [], density: 'pure' },
  'caramel fudge cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'mint cookie': { base: 'mint', ribbon: null, toppings: ['oreo'], density: 'double' },
  'caramel pecan': { base: 'caramel', ribbon: null, toppings: ['pecan'], density: 'standard' },
  "really reese's": { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'raspberry cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['raspberry', 'cheesecake_bits'], density: 'standard' },
  'chocolate covered strawberry': { base: 'vanilla', ribbon: null, toppings: ['strawberry_bits', 'dove'], density: 'standard' },
  'caramel peanut buttercup': { base: 'vanilla', ribbon: 'peanut_butter', toppings: ['dove'], density: 'standard' },
  'turtle': { base: 'vanilla', ribbon: 'caramel', toppings: ['dove', 'pecan'], density: 'standard' },
  'georgia peach': { base: 'peach', ribbon: null, toppings: ['peach_bits'], density: 'standard' },
  'georgia peach pecan': { base: 'peach', ribbon: null, toppings: ['peach_bits', 'pecan'], density: 'standard' },
  'snickers swirl': { base: 'chocolate', ribbon: 'caramel', toppings: ['snickers'], density: 'standard' },
  'chocolate volcano': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo', 'dove', 'm_and_m'], density: 'explosion' },
  'oreo cookie overload': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo'], density: 'overload' },
  'salted double caramel pecan': { base: 'vanilla', ribbon: 'caramel', toppings: ['pecan', 'salt'], density: 'double' },
  'crazy for cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'chocolate heath crunch': { base: 'chocolate', ribbon: null, toppings: ['heath'], density: 'standard' },
  'double butter pecan': { base: 'vanilla', ribbon: null, toppings: ['pecan'], density: 'double' },
  // Catalog entries without prior profiles
  'blackberry cobbler': { base: 'blackberry', ribbon: null, toppings: ['pie_crust', 'pie_crust', 'pie_crust'], density: 'standard' },
  'brownie thunder': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['brownie'], density: 'standard' },
  'chocolate oreo volcano': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['oreo', 'dove'], density: 'explosion' },
  'lemon berry layer cake': { base: 'lemon', ribbon: null, toppings: ['blueberry', 'cake'], density: 'standard' },
  'lemon dash cookie': { base: 'lemon', ribbon: null, toppings: ['oreo'], density: 'standard' },
  'oreo cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['oreo', 'cheesecake_bits'], density: 'standard' },
  'peanut butter cup': { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'salted caramel pecan pie': { base: 'caramel', ribbon: null, toppings: ['pecan', 'salt', 'pie_crust'], density: 'explosion' },
  'strawberry cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['strawberry_bits', 'cheesecake_bits'], density: 'standard' },
  'vanilla': { base: 'vanilla', ribbon: null, toppings: [], density: 'pure' },
};

export const CONE_TIP_COLOR = '#8B5A2B';

const DEFAULT_PROFILE = { base: 'vanilla', ribbon: null, toppings: [], density: 'standard' };

/**
 * Look up flavor profile by name with fuzzy matching.
 * Tries: exact match -> unicode normalized -> keyword fallback -> default.
 */
export function getFlavorProfile(name) {
  if (!name) return DEFAULT_PROFILE;
  const key = name.toLowerCase();

  if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];

  // Normalize unicode curly quotes
  const normalized = key.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  if (FLAVOR_PROFILES[normalized]) return FLAVOR_PROFILES[normalized];

  // Keyword fallback
  if (key.includes('double butter pecan')) return { base: 'vanilla', ribbon: null, toppings: ['pecan'], density: 'double' };
  if (key.includes('mint')) return { base: 'mint', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('dark choc')) return { base: 'dark_chocolate', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('chocolate') || key.includes('cocoa')) return { base: 'chocolate', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('strawberry')) return { base: 'strawberry', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('cheesecake')) return { base: 'cheesecake', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('caramel')) return { base: 'caramel', ribbon: 'caramel', toppings: [], density: 'standard' };
  if (key.includes('peach')) return { base: 'peach', ribbon: null, toppings: [], density: 'standard' };
  if (key.includes('butter pecan')) return { base: 'butter_pecan', ribbon: null, toppings: ['pecan'], density: 'standard' };
  if (key.includes('vanilla')) return { base: 'vanilla', ribbon: null, toppings: [], density: 'standard' };

  return DEFAULT_PROFILE;
}

/**
 * Resolve topping slots based on density encoding (matches Tidbyt cone_spec).
 * Returns array of topping color keys for fixed-slot placement.
 */
function resolveToppingSlots(profile) {
  const toppings = profile.toppings || [];
  const density = profile.density || 'standard';
  if (density === 'pure') return [];
  if (density === 'double') {
    const slots = toppings.length > 0 ? [toppings[0], toppings[0]] : [];
    if (toppings.length > 1) slots.push(toppings[1]);
    return slots;
  }
  if (density === 'explosion') return toppings.slice(0, 4);
  if (density === 'overload') return toppings.length > 0 ? [toppings[0], toppings[0]] : [];
  return toppings.slice(0, 4); // standard
}

/**
 * Render an SVG cone for a flavor at the given scale.
 *
 * Grid: 9x11 pixels matching Tidbyt mini-cone spec.
 * Rendering: base fill -> fixed-slot toppings -> fixed-slot ribbon -> cone.
 * Ribbon wins at T4/R3 overlap. Scoop has rounded top+bottom.
 * Cone uses Tidbyt checkerboard (#D2691E / #B8860B) with 1px tip.
 *
 * @param {string} flavorName
 * @param {number} [scale=1]
 * @returns {string} SVG markup
 */
export function renderConeSVG(flavorName, scale = 1) {
  const profile = getFlavorProfile(flavorName);
  const baseColor = BASE_COLORS[profile.base] || BASE_COLORS.vanilla;
  const ribbonKey = profile.ribbon;
  const hasRibbon = ribbonKey && profile.density !== 'pure';
  const ribbonColor = hasRibbon ? (RIBBON_COLORS[ribbonKey] || null) : null;
  const toppingSlots = resolveToppingSlots(profile);

  const w = 9 * scale;
  const h = 10 * scale;
  const s = scale;
  const rects = [];

  // Scoop (rows 0-4, rounded top; full-width bottom sits wider than cone)
  const scoopRows = [
    [3, 5],   // row 0: cols 3-5 (narrow crown)
    [2, 6],   // row 1: cols 2-6 (taper)
    [1, 7],   // row 2: cols 1-7 (full width)
    [1, 7],   // row 3
    [1, 7],   // row 4: full-width bottom (overhangs cone by 1px each side)
  ];

  // Base fill
  for (let row = 0; row < scoopRows.length; row++) {
    const [sc, ec] = scoopRows[row];
    for (let col = sc; col <= ec; col++) {
      rects.push(`<rect x="${col * s}" y="${row * s}" width="${s}" height="${s}" fill="${baseColor}"/>`);
    }
  }

  // Fixed topping slots (T1-T4): distributed across rows 1-4 so toppings
  // span the full scoop height rather than clustering in a horizontal band.
  // T1:(3,1) T2:(6,2) T3:(3,3) T4:(5,4) -- no ribbon collision with any slot
  const tSlots = [[3,1],[6,2],[3,3],[5,4]];
  for (let i = 0; i < toppingSlots.length && i < tSlots.length; i++) {
    const color = TOPPING_COLORS[toppingSlots[i]];
    if (!color) continue;
    const [tx, ty] = tSlots[i];
    rects.push(`<rect x="${tx * s}" y="${ty * s}" width="${s}" height="${s}" fill="${color}"/>`);
  }

  // Fixed ribbon slots (R1-R3) -- rendered after toppings, ribbon wins at overlap
  // R1: (3,0), R2: (4,1), R3: (5,2)
  if (ribbonColor) {
    const rSlots = [[3,0],[4,1],[5,2]];
    for (const [rx, ry] of rSlots) {
      rects.push(`<rect x="${rx * s}" y="${ry * s}" width="${s}" height="${s}" fill="${ribbonColor}"/>`);
    }
  }

  // Cone (rows 5-8: checkerboard, row 9: 1px tip)
  const coneRows = [
    [2, 6],  // row 5: 5px
    [2, 6],  // row 6: 5px
    [3, 5],  // row 7: 3px
    [3, 5],  // row 8: 3px
  ];
  for (let row = 0; row < coneRows.length; row++) {
    const [sc, ec] = coneRows[row];
    for (let col = sc; col <= ec; col++) {
      const color = ((row + col) % 2 === 0) ? CONE_COLORS.waffle : CONE_COLORS.waffle_dark;
      rects.push(`<rect x="${col * s}" y="${(row + 5) * s}" width="${s}" height="${s}" fill="${color}"/>`);
    }
  }
  // Tip at (4, 9)
  rects.push(`<rect x="${4 * s}" y="${9 * s}" width="${s}" height="${s}" fill="${CONE_COLORS.waffle_dark}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

/**
 * Blend a hex color toward white by the given amount (0..1).
 * lightenHex('#000000', 0.5) -> '#808080'
 */
export function lightenHex(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return '#' + [lr, lg, lb].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Resolve HD topping slots (8 slots) based on density encoding.
 * Same density logic as the 9x11 version, scaled to 8 slots.
 */
export function resolveHDToppingSlots(profile) {
  const toppings = profile.toppings || [];
  const density = profile.density || 'standard';
  if (density === 'pure') return [];
  if (density === 'double') {
    // Denser than standard: 7 slots weighted toward primary topping.
    if (toppings.length === 0) return [];
    const primary = toppings[0];
    const secondary = toppings[1] || primary;
    return [primary, primary, secondary, primary, secondary, primary, secondary];
  }
  if (density === 'explosion') {
    // Cycle through all toppings to fill 8 slots
    if (toppings.length === 0) return [];
    const slots = [];
    for (let i = 0; i < 8; i++) {
      slots.push(toppings[i % toppings.length]);
    }
    return slots;
  }
  if (density === 'overload') {
    // Very dense single-topping look.
    return toppings.length > 0 ? [toppings[0], toppings[0], toppings[0], toppings[0], toppings[0], toppings[0]] : [];
  }
  // Standard HD: fill 6 slots by cycling available toppings.
  if (toppings.length === 0) return [];
  const slots = [];
  for (let i = 0; i < 6; i++) {
    slots.push(toppings[i % toppings.length]);
  }
  return slots;
}

/**
 * Render an HD SVG cone for a flavor at the given scale.
 *
 * Grid: 18x22 pixels -- doubled resolution for smoother curves, more
 * topping/ribbon detail, and a specular highlight on the scoop.
 *
 * @param {string} flavorName
 * @param {number} [scale=1]
 * @returns {string} SVG markup
 */
export function renderConeHDSVG(flavorName, scale = 1) {
  const profile = getFlavorProfile(flavorName);
  const baseColor = BASE_COLORS[profile.base] || BASE_COLORS.vanilla;
  const ribbonKey = profile.ribbon;
  const hasRibbon = ribbonKey && profile.density !== 'pure';
  const ribbonColor = hasRibbon ? (RIBBON_COLORS[ribbonKey] || null) : null;
  const toppingSlots = resolveHDToppingSlots(profile);
  const highlightColor = lightenHex(baseColor, 0.3);

  const w = 18 * scale;
  const h = 21 * scale;
  const s = scale;
  const rects = [];

  // Scoop (rows 0-11): flat rectangle with just corners nipped,
  // matching the 9x11 shape (5->7->7->7->7->5 doubled).
  // Each entry: [startCol, endCol]
  const scoopRows = [
    [4, 13],   // row 0: 10px (top corners nipped)
    [3, 14],   // row 1: 12px
    [2, 15],   // row 2: 14px (full width)
    [2, 15],   // row 3: 14px
    [2, 15],   // row 4: 14px
    [2, 15],   // row 5: 14px
    [2, 15],   // row 6: 14px
    [2, 15],   // row 7: 14px
    [2, 15],   // row 8: 14px
    [2, 15],   // row 9: 14px
    [3, 14],   // row 10: 12px (full-width bottom; overhangs cone by 1px each side)
  ];

  // Base fill
  for (let row = 0; row < scoopRows.length; row++) {
    const [sc, ec] = scoopRows[row];
    for (let col = sc; col <= ec; col++) {
      rects.push(`<rect x="${col * s}" y="${row * s}" width="${s}" height="${s}" fill="${baseColor}"/>`);
    }
  }

  // Highlight slots (upper-left specular shine)
  const hlSlots = [[4, 0], [3, 1]];
  for (const [hx, hy] of hlSlots) {
    rects.push(`<rect x="${hx * s}" y="${hy * s}" width="${s}" height="${s}" fill="${highlightColor}"/>`);
  }

  // Fixed topping slots (T1-T8): distributed top-to-bottom so toppings span
  // the full scoop height. Standard density uses first 6 (rows 0,1,3,4,6,7);
  // explosion density uses all 8 (adds rows 9,10). Asymmetric placement avoids
  // mirrored look.
  const tSlots = [[5,0],[11,1],[4,3],[13,4],[5,6],[12,7],[4,9],[11,10]];
  for (let i = 0; i < toppingSlots.length && i < tSlots.length; i++) {
    const color = TOPPING_COLORS[toppingSlots[i]];
    if (!color) continue;
    const [tx, ty] = tSlots[i];
    rects.push(`<rect x="${tx * s}" y="${ty * s}" width="${s}" height="${s}" fill="${color}"/>`);
  }

  // Fixed ribbon slots (R1-R6, S-curve through center)
  if (ribbonColor) {
    const rSlots = [[7,1],[8,3],[9,4],[10,5],[9,7],[8,9]];
    for (const [rx, ry] of rSlots) {
      rects.push(`<rect x="${rx * s}" y="${ry * s}" width="${s}" height="${s}" fill="${ribbonColor}"/>`);
    }
  }

  // Cone (rows 11-19: checkerboard taper + 2px tip)
  const coneRows = [
    [4, 13],  // row 11: 10px
    [4, 13],  // row 12: 10px
    [5, 12],  // row 13:  8px
    [5, 12],  // row 14:  8px
    [6, 11],  // row 15:  6px
    [6, 11],  // row 16:  6px
    [7, 10],  // row 17:  4px
    [7, 10],  // row 18:  4px
    [8, 9],   // row 19:  2px
  ];
  for (let row = 0; row < coneRows.length; row++) {
    const [sc, ec] = coneRows[row];
    for (let col = sc; col <= ec; col++) {
      const color = ((row + col) % 2 === 0) ? CONE_COLORS.waffle : CONE_COLORS.waffle_dark;
      rects.push(`<rect x="${col * s}" y="${(row + 11) * s}" width="${s}" height="${s}" fill="${color}"/>`);
    }
  }
  // Tip row 20: 2px dark
  rects.push(`<rect x="${8 * s}" y="${20 * s}" width="${s}" height="${s}" fill="${CONE_TIP_COLOR}"/>`);
  rects.push(`<rect x="${9 * s}" y="${20 * s}" width="${s}" height="${s}" fill="${CONE_TIP_COLOR}"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}
