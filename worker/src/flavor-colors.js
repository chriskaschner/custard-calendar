/**
 * Canonical flavor color system for custard visualization.
 *
 * Ported from tidbyt/culvers_fotd.star -- single source of truth for flavor
 * profiles, color palettes, and cone rendering. Used by the /api/v1/flavor-colors
 * endpoint and as L0 mini-cone fallback. Social cards use L5 AI PNGs.
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
  // Phase 15 additions
  espresso: '#2C1503',         // dark coffee brown (distinct from chocolate/dark_chocolate)
  cherry: '#C41E3A',           // bright cherry red (distinct from strawberry pink)
  pumpkin: '#D2691E',          // warm orange-brown (distinct from caramel gold / peach pale)
  banana: '#F0E68C',           // pale yellow-green (distinct from lemon bright / vanilla wheat)
  coconut: '#FFFAF0',          // floral white / cream (distinct from cheesecake / vanilla)
  root_beer: '#5C3317',        // deep amber-brown (distinct from caramel / chocolate)
  pistachio: '#93C572',        // muted sage green (distinct from mint / mint_andes)
  orange: '#FF8C00',           // bright dark-orange (distinct from peach / pumpkin)
  blue_moon: '#5B9BD5',        // bright periwinkle blue (real Midwest custard flavor)
  maple: '#C9882C',            // warm amber (distinct from caramel gold / butter_pecan cream)
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
  andes: '#0A3726',             // contrast-adjusted: 3:1 on mint_andes (was #1FAE7A)
  dove: '#2B1A12',
  pecan: '#8B5A2B',
  cashew: '#897E6C',             // contrast-adjusted: 3:1 on vanilla (was #D4C4A8)
  heath: '#DAA520',
  butterfinger: '#E6A817',
  cookie_dough: '#917C60',       // contrast-adjusted: 3:1 on vanilla (was #C4A882)
  strawberry_bits: '#A10E2B',    // contrast-adjusted: 3:1 on strawberry (was #FF1744)
  raspberry: '#E91E63',
  peach_bits: '#BF7200',         // contrast-adjusted: 3:1 on peach (was #FF9800)
  salt: '#4B4B4B',               // contrast-adjusted: 3:1 on caramel (was #FFFFFF)
  snickers: '#C4A060',
  cake: '#4A2800',
  cheesecake_bits: '#FFF8DC',
  m_and_m: '#FF7D7D',           // contrast-adjusted: 3:1 on chocolate (was #FF4444)
  reeses: '#D4A017',
  brownie: '#ADA59C',           // contrast-adjusted: 3:1 on chocolate (was #2D1700)
  blueberry: '#3B1F6B',
  pie_crust: '#C99E76',           // contrast-adjusted: 3:1 on blackberry (was #C4966A)
  blackberry_drupe: '#AEA1BB',  // contrast-adjusted: 3:1 on blackberry (was #3D1F5C)
  // Phase 15 additions -- demand-driven from unprofiled flavor audit
  chocolate_chip: '#3B2314',     // dark chocolate morsel (pairs with vanilla/banana/coconut)
  sprinkles: '#D63384',           // vivid magenta-pink (contrast-adjusted: 3:1 on vanilla; exempt on chocolate/blue_moon)
  graham_cracker: '#8B6914',     // dark golden crumb (contrast-adjusted: 3:1 on cheesecake/banana; exempt on pumpkin)
  coconut_flakes: '#F5F5DC',     // off-white shreds (pairs with chocolate; structural exempt on coconut/pistachio)
  cherry_bits: '#8B0000',        // dark cherry red (pairs with vanilla; structural exempt on cherry/chocolate)
  caramel_chips: '#9E6B23',      // deep amber chip (pairs with vanilla/espresso; structural exempt on chocolate)
  pretzel: '#B07D3B',            // golden pretzel brown (pairs with root_beer; structural exempt on chocolate/caramel)
  pumpkin_spice: '#6B3410',      // dark cinnamon-sienna (contrast-adjusted: 3:1 on vanilla/maple; exempt on pumpkin)
  marshmallow_bits: '#FFFAED',   // warm white pieces (pairs with chocolate/espresso/root_beer)
  candy_cane: '#B91C35',          // deep peppermint red (contrast-adjusted: 3:1 on vanilla/mint)
  cookie_crumbs: '#7B5B32',      // dark sandy cookie crumb (contrast-adjusted: 3:1 on vanilla/banana)
  fudge_bits: '#1C0B00',         // near-black fudge chunk (pairs with vanilla/cheesecake/lemon)
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
  'turtle cheesecake': { base: 'cheesecake', ribbon: 'caramel', toppings: ['pecan', 'dove', 'pecan'], density: 'explosion' },
  'caramel turtle': { base: 'caramel', ribbon: 'fudge', toppings: ['pecan', 'dove', 'pecan'], density: 'explosion' },
  'andes mint avalanche': { base: 'mint_andes', ribbon: null, toppings: ['andes', 'andes', 'dove'], density: 'standard' },
  'oreo cookie cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['oreo'], density: 'double' },
  "devil's food cake": { base: 'chocolate_custard', ribbon: null, toppings: ['cake', 'dove'], density: 'standard' },
  'caramel cashew': { base: 'vanilla', ribbon: 'caramel', toppings: ['cashew'], density: 'standard' },
  'butter pecan': { base: 'butter_pecan', ribbon: null, toppings: ['pecan'], density: 'standard' },
  'caramel chocolate pecan': { base: 'chocolate_custard', ribbon: 'caramel', toppings: ['pecan', 'pecan', 'dove', 'pecan'], density: 'explosion' },
  'dark chocolate decadence': { base: 'dark_chocolate', ribbon: null, toppings: [], density: 'pure' },
  'caramel fudge cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'mint cookie': { base: 'mint', ribbon: null, toppings: ['oreo'], density: 'double' },
  'caramel pecan': { base: 'caramel', ribbon: null, toppings: ['pecan'], density: 'standard' },
  "really reese's": { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'raspberry cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['raspberry'], density: 'double' },
  'chocolate covered strawberry': { base: 'vanilla', ribbon: null, toppings: ['strawberry_bits', 'dove'], density: 'standard' },
  'caramel peanut buttercup': { base: 'vanilla', ribbon: 'peanut_butter', toppings: ['dove'], density: 'standard' },
  'turtle': { base: 'vanilla', ribbon: 'caramel', toppings: ['pecan', 'dove'], density: 'standard' },
  'georgia peach': { base: 'peach', ribbon: null, toppings: ['peach_bits'], density: 'standard' },
  'snickers swirl': { base: 'chocolate', ribbon: 'caramel', toppings: ['snickers'], density: 'standard' },
  'chocolate volcano': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo', 'dove', 'm_and_m'], density: 'explosion' },
  'oreo cookie overload': { base: 'chocolate', ribbon: 'chocolate_syrup', toppings: ['oreo'], density: 'overload' },
  'salted double caramel pecan': { base: 'vanilla', ribbon: 'caramel', toppings: ['pecan', 'salt'], density: 'double' },
  'crazy for cookie dough': { base: 'vanilla', ribbon: 'fudge', toppings: ['cookie_dough'], density: 'standard' },
  'chocolate heath crunch': { base: 'chocolate', ribbon: null, toppings: ['heath'], density: 'standard' },
  'double butter pecan': { base: 'vanilla', ribbon: null, toppings: ['pecan'], density: 'double' },
  // Catalog entries without prior profiles
  'blackberry cobbler': {
    base: 'blackberry', ribbon: null, toppings: ['pie_crust', 'pie_crust', 'pie_crust'], density: 'standard',
    // L2 override: 3 blackberry drupes + 3 crust dots, spread within inner scoop,
    // each topping at least 2px from image edge. [col, row, colorKey]
    l2_toppings: [
      [2, 2, 'blackberry_drupe'], [5, 2, 'pie_crust'],
      [3, 3, 'pie_crust'],        [6, 3, 'blackberry_drupe'],
      [4, 4, 'blackberry_drupe'], [6, 4, 'pie_crust'],
    ],
  },
  'brownie thunder': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['brownie', 'dove', 'brownie'], density: 'explosion' },
  'chocolate oreo volcano': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['oreo', 'dove'], density: 'explosion' },
  'lemon berry layer cake': { base: 'lemon', ribbon: null, toppings: ['blueberry', 'cake'], density: 'standard' },
  'lemon dash cookie': { base: 'lemon', ribbon: null, toppings: ['oreo'], density: 'standard' },
  'oreo cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['oreo'], density: 'double' },
  'peanut butter cup': { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'salted caramel pecan pie': { base: 'caramel', ribbon: null, toppings: ['pecan', 'salt', 'pie_crust'], density: 'explosion' },
  'strawberry cheesecake': { base: 'cheesecake', ribbon: null, toppings: ['strawberry_bits'], density: 'double' },
  'vanilla': { base: 'vanilla', ribbon: null, toppings: [], density: 'pure' },
  // Phase 16-01: Chocolate-family batch (chocolate, dark_chocolate, espresso bases)
  'bonfire s\'mores': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['graham_cracker'], density: 'standard' },
  'brownie batter overload': { base: 'chocolate', ribbon: null, toppings: ['brownie'], density: 'overload' },
  'brownie explosion': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['brownie', 'brownie', 'dove'], density: 'explosion' },
  'cappuccino almond fudge': { base: 'espresso', ribbon: 'fudge', toppings: ['cashew'], density: 'standard' },
  'cappuccino cookie crumble': { base: 'espresso', ribbon: null, toppings: ['cookie_crumbs'], density: 'standard' },
  'death by chocolate': { base: 'dark_chocolate', ribbon: 'chocolate_syrup', toppings: ['brownie', 'dove'], density: 'explosion' },
  'double marshmallow oreo': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['oreo'], density: 'double' },
  'm&m cookie dough': { base: 'chocolate', ribbon: null, toppings: ['m_and_m', 'cookie_dough'], density: 'standard' },
  'm&m swirl': { base: 'chocolate', ribbon: null, toppings: ['m_and_m'], density: 'standard' },
  'midnight toffee': { base: 'dark_chocolate', ribbon: null, toppings: ['heath'], density: 'standard' },
  'mooey gooey twist': { base: 'chocolate', ribbon: 'caramel', toppings: ['cookie_dough'], density: 'standard' },
  'mudd pie': { base: 'espresso', ribbon: 'fudge', toppings: ['oreo', 'cookie_crumbs'], density: 'standard' },
  'pb brownie': { base: 'chocolate', ribbon: 'peanut_butter', toppings: ['brownie'], density: 'standard' },
  'rocky road': { base: 'chocolate', ribbon: 'marshmallow', toppings: ['cashew', 'chocolate_chip'], density: 'standard' },
  'tiramisu': { base: 'espresso', ribbon: 'marshmallow', toppings: ['cake', 'dove'], density: 'standard' },
  'triple chocolate kiss': { base: 'dark_chocolate', ribbon: 'chocolate_syrup', toppings: ['dove'], density: 'standard' },
  'twix mix': { base: 'chocolate', ribbon: 'caramel', toppings: ['cookie_crumbs'], density: 'standard' },
  // Phase 16-02: Vanilla-family batch (vanilla, butter_pecan bases)
  'badger claw': { base: 'vanilla', ribbon: 'caramel', toppings: ['cashew', 'fudge_bits'], density: 'standard' },
  "bailey's irish cream": { base: 'vanilla', ribbon: 'chocolate_syrup', toppings: [], density: 'pure' },
  'boston cream': { base: 'vanilla', ribbon: 'chocolate_syrup', toppings: ['cake'], density: 'standard' },
  'butter brickle': { base: 'butter_pecan', ribbon: null, toppings: ['heath'], density: 'standard' },
  'butter finger blast': { base: 'vanilla', ribbon: null, toppings: ['butterfinger'], density: 'standard' },
  'butterfinger pecan': { base: 'vanilla', ribbon: null, toppings: ['butterfinger', 'pecan'], density: 'standard' },
  'cashew delight': { base: 'vanilla', ribbon: 'caramel', toppings: ['cashew'], density: 'standard' },
  'chunky peanut butter dream': { base: 'vanilla', ribbon: 'peanut_butter', toppings: ['reeses'], density: 'standard' },
  'cookie dough craving': { base: 'vanilla', ribbon: null, toppings: ['cookie_dough'], density: 'standard' },
  'cookies & cream': { base: 'vanilla', ribbon: null, toppings: ['oreo'], density: 'standard' },
  'just drummy': { base: 'vanilla', ribbon: null, toppings: ['cake'], density: 'standard' },
  'kit kat bar': { base: 'vanilla', ribbon: null, toppings: ['heath'], density: 'standard' },
  'kit kat swirl': { base: 'vanilla', ribbon: 'chocolate_syrup', toppings: ['heath'], density: 'standard' },
  'nestle crunch swirl': { base: 'vanilla', ribbon: 'chocolate_syrup', toppings: ['cookie_crumbs'], density: 'standard' },
  'peanut butter cookie dough': { base: 'vanilla', ribbon: 'peanut_butter', toppings: ['cookie_dough'], density: 'standard' },
  'pecan toffee crunch': { base: 'vanilla', ribbon: null, toppings: ['pecan', 'heath'], density: 'standard' },
  'polar bear tracks': { base: 'vanilla', ribbon: 'fudge', toppings: ['reeses'], density: 'standard' },
  'raspberry cordial': { base: 'vanilla', ribbon: null, toppings: ['raspberry', 'dove'], density: 'standard' },
  'red raspberry': { base: 'vanilla', ribbon: null, toppings: ['raspberry'], density: 'standard' },
  'rice krispie treat': { base: 'vanilla', ribbon: 'marshmallow', toppings: ['cookie_crumbs'], density: 'standard' },
  'toffee pecan': { base: 'butter_pecan', ribbon: null, toppings: ['heath', 'pecan'], density: 'standard' },
  // Phase 16-02: Caramel-family batch (caramel, maple bases)
  'maple pecan': { base: 'maple', ribbon: null, toppings: ['pecan'], density: 'standard' },
  'nutty caramel apple': { base: 'caramel', ribbon: null, toppings: ['pecan', 'caramel_chips'], density: 'standard' },
  // Phase 16-03: Fruit-family batch (cherry, banana, lemon, orange bases)
  'banana cream pie': { base: 'banana', ribbon: null, toppings: ['graham_cracker', 'cookie_crumbs'], density: 'standard' },
  'burgundy cherry': { base: 'cherry', ribbon: null, toppings: ['cherry_bits'], density: 'standard' },
  'cheri amour amaretto': { base: 'cherry', ribbon: null, toppings: ['cherry_bits'], density: 'standard' },
  'cherry pecan': { base: 'cherry', ribbon: null, toppings: ['cherry_bits', 'pecan'], density: 'standard' },
  'creamy lemon crumble': { base: 'lemon', ribbon: null, toppings: ['cookie_crumbs'], density: 'standard' },
  'key lime custard pie': { base: 'lemon', ribbon: null, toppings: ['graham_cracker'], density: 'standard' },
  'orange creamsicle': { base: 'orange', ribbon: null, toppings: [], density: 'pure' },
  // Phase 16-03: Specialty-family batch (blue_moon, coconut, mint, pistachio, pumpkin, root_beer bases)
  'blue moon': { base: 'blue_moon', ribbon: null, toppings: [], density: 'pure' },
  'coconut cream pie': { base: 'coconut', ribbon: null, toppings: ['coconut_flakes', 'graham_cracker'], density: 'standard' },
  'grasshopper fudge': { base: 'mint', ribbon: 'fudge', toppings: ['oreo'], density: 'standard' },
  'pistachio': { base: 'pistachio', ribbon: null, toppings: [], density: 'pure' },
  'pumpkin pecan': { base: 'pumpkin', ribbon: null, toppings: ['pecan', 'pumpkin_spice'], density: 'standard' },
  'pumpkin pie': { base: 'pumpkin', ribbon: null, toppings: ['graham_cracker', 'pumpkin_spice'], density: 'standard' },
  'root beer float': { base: 'root_beer', ribbon: null, toppings: ['marshmallow_bits'], density: 'standard' },
};

export const CONE_TIP_COLOR = '#8B5A2B';

/**
 * Normalize a flavor name for alias/profile lookup.
 * Strips TM/R symbols, normalizes curly quotes, lowercases, collapses whitespace.
 * Matches the normalizeFlavorKey() in docs/cone-renderer.js exactly.
 */
function normalizeFlavorKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u00ae\u2122]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flavor aliases: maps variant/duplicate/historical flavor names to their
 * canonical FLAVOR_PROFILES key. All keys are pre-normalized (normalizeFlavorKey
 * output). All values are existing FLAVOR_PROFILES keys.
 *
 * Only includes names that do NOT already have their own FLAVOR_PROFILES entry.
 * If a name already exists in FLAVOR_PROFILES, it gets exact-match precedence
 * and an alias would be unreachable.
 *
 * Phase 16 will add aliases for newly-profiled flavors in the same commits.
 */
export const FLAVOR_ALIASES = {
  // Peanut butter cup family -- "Reeses Peanut Butter Cup" variant appears in
  // SIMILARITY_GROUPS but has no profile; canonical is "Really Reese's"
  "reeses peanut butter cup": "really reese's",
  "reese's peanut butter cup": "really reese's",
  "pb cup": "really reese's",

  // Georgia Peach variants -- KNOWN_FLAVORS_FALLBACK has "Georgia Peach Pecan"
  'georgia peach pecan': 'georgia peach',

  // OREO family -- "OREO Cookies and Cream" in KNOWN_FLAVORS_FALLBACK, no profile
  'oreo cookies and cream': 'oreo cookie cheesecake',

  // Cookie Dough reversal -- common customer variant naming
  'cookie dough craze': 'crazy for cookie dough',

  // Shortened/colloquial names for profiled flavors
  'chocolate decadence': 'dark chocolate decadence',
  'dark chocolate peanut butter crunch': 'dark chocolate pb crunch',
  'snickers': 'snickers swirl',
  'salted caramel pecan': 'salted double caramel pecan',

  // "Custard" suffix variants -- upstream data sometimes appends "custard"
  'vanilla custard': 'vanilla',
  'butter pecan custard': 'butter pecan',

  // Turtle family variants
  'turtle sundae': 'turtle',
  'caramel turtle sundae': 'caramel turtle',

  // Double variants
  'double strawberry custard': 'double strawberry',

  // Brownie/thunder variants
  'brownie batter': 'brownie thunder',

  // Historical / marketing renames
  'mint oreo': 'mint cookie',
  'oreo mint': 'mint cookie',

  // Cheesecake shorthand
  'oreo cheesecake cookie': 'oreo cookie cheesecake',

  // Heath bar variant
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
  'banana pie': 'banana cream pie',
};

const DEFAULT_PROFILE = { base: 'vanilla', ribbon: null, toppings: [], density: 'standard' };

/**
 * Look up flavor profile by name with fuzzy matching.
 * Tries: exact match -> unicode normalized -> alias resolution -> keyword fallback -> default.
 */
export function getFlavorProfile(name) {
  if (!name) return DEFAULT_PROFILE;
  const key = name.toLowerCase();

  if (FLAVOR_PROFILES[key]) return FLAVOR_PROFILES[key];

  // Normalize unicode curly quotes
  const normalized = key.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  if (FLAVOR_PROFILES[normalized]) return FLAVOR_PROFILES[normalized];

  // Alias resolution (after normalize, before keyword fallback)
  const nfk = normalizeFlavorKey(key);
  const canonical = FLAVOR_ALIASES[nfk];
  if (canonical && FLAVOR_PROFILES[canonical]) {
    return FLAVOR_PROFILES[canonical];
  }

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

  // Topping placement: use per-flavor l2_toppings override if defined,
  // otherwise fall back to 4 fixed slots distributed across scoop rows 1-4.
  if (profile.l2_toppings) {
    for (const [tx, ty, colorKey] of profile.l2_toppings) {
      const color = TOPPING_COLORS[colorKey];
      if (color) rects.push(`<rect x="${tx * s}" y="${ty * s}" width="${s}" height="${s}" fill="${color}"/>`);
    }
  } else {
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
