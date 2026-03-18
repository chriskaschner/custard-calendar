import { describe, it, expect } from 'vitest';
import {
  getFlavorProfile,
  renderConeSVG,
  renderConeHDSVG,
  renderConeHeroSVG,
  renderConePremiumSVG,
  resolveHDToppingSlots,
  resolveHDScatterToppingList,
  resolvePremiumToppingList,
  resolveHeroToppingList,
  _CANONICAL_TOPPING_SHAPES,
  _CANONICAL_SHAPE_MAP,
  lightenHex,
  darkenHex,
  BASE_COLORS,
  FLAVOR_PROFILES,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_TIP_COLOR,
} from '../src/flavor-colors.js';
import { renderToPixels, stableHash } from './helpers/render-to-pixels.js';

describe('getFlavorProfile', () => {
  it('returns exact match for known flavor', () => {
    const profile = getFlavorProfile('Mint Explosion');
    expect(profile.base).toBe('mint');
    expect(profile.toppings).toContain('oreo');
    expect(profile.density).toBe('explosion');
  });

  it('normalizes unicode curly quotes', () => {
    // \u2019 = right single curly quote
    const profile = getFlavorProfile('really reese\u2019s');
    expect(profile.base).toBe('chocolate');
    expect(profile.ribbon).toBe('peanut_butter');
  });

  it('falls back to keyword match for unknown flavor', () => {
    const profile = getFlavorProfile('Triple Mint Surprise');
    expect(profile.base).toBe('mint');
  });

  it('returns default vanilla profile for completely unknown flavor', () => {
    const profile = getFlavorProfile('Unicorn Rainbow');
    expect(profile.base).toBe('vanilla');
    expect(profile.ribbon).toBeNull();
    expect(profile.toppings).toEqual([]);
    expect(profile.density).toBe('standard');
  });

  it('andes mint avalanche uses a darker base than mint explosion', () => {
    const avalanche = getFlavorProfile('Andes Mint Avalanche');
    const explosion = getFlavorProfile('Mint Explosion');
    expect(avalanche.base).not.toBe(explosion.base);
    expect(BASE_COLORS[avalanche.base]).toBeDefined();
  });

  it('salted double caramel pecan uses vanilla base for caramel ribbon contrast', () => {
    const profile = getFlavorProfile('Salted Double Caramel Pecan');
    expect(profile.base).toBe('vanilla');
    expect(profile.ribbon).toBe('caramel');
    expect(profile.toppings).toContain('pecan');
  });
});

describe('renderConeSVG', () => {
  it('returns valid SVG markup', () => {
    const svg = renderConeSVG('Mint Explosion');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('</svg>');
  });

  it('uses correct base color for flavor', () => {
    const svg = renderConeSVG('Mint Explosion');
    // Mint base color
    expect(svg).toContain(BASE_COLORS.mint);

    const chocolateSvg = renderConeSVG('Dark Chocolate Decadence');
    expect(chocolateSvg).toContain(BASE_COLORS.dark_chocolate);
  });
});

describe('lightenHex', () => {
  it('produces a lighter color', () => {
    const result = lightenHex('#000000', 0.5);
    expect(result).toBe('#808080');
  });

  it('returns white when amount is 1', () => {
    expect(lightenHex('#336699', 1)).toBe('#FFFFFF');
  });

  it('returns the same color when amount is 0', () => {
    expect(lightenHex('#336699', 0)).toBe('#336699');
  });
});

describe('resolveHDToppingSlots', () => {
  it('returns empty array for pure density', () => {
    expect(resolveHDToppingSlots({ toppings: ['oreo'], density: 'pure' })).toEqual([]);
  });

  it('returns dense 6-slot cycle for standard density', () => {
    const slots = resolveHDToppingSlots({ toppings: ['oreo', 'andes', 'dove'], density: 'standard' });
    expect(slots).toHaveLength(6);
    expect(slots).toEqual(['oreo', 'andes', 'dove', 'oreo', 'andes', 'dove']);
  });

  it('returns 8 cycling slots for explosion density', () => {
    const slots = resolveHDToppingSlots({ toppings: ['oreo', 'andes', 'dove'], density: 'explosion' });
    expect(slots).toHaveLength(8);
    expect(slots[0]).toBe('oreo');
    expect(slots[3]).toBe('oreo'); // cycles
    expect(slots[1]).toBe('andes');
  });

  it('returns 6 repeated slots for overload density', () => {
    const slots = resolveHDToppingSlots({ toppings: ['oreo'], density: 'overload' });
    expect(slots).toEqual(['oreo', 'oreo', 'oreo', 'oreo', 'oreo', 'oreo']);
  });

  it('returns weighted 7-slot mix for double density', () => {
    const slots = resolveHDToppingSlots({ toppings: ['strawberry_bits', 'dove'], density: 'double' });
    expect(slots).toEqual(['strawberry_bits', 'strawberry_bits', 'dove', 'strawberry_bits', 'dove', 'strawberry_bits', 'dove']);
  });
});

describe('resolveHDScatterToppingList', () => {
  it('returns empty array for pure density', () => {
    expect(resolveHDScatterToppingList({ toppings: ['oreo'], density: 'pure' })).toEqual([]);
  });

  it('returns ~10 pieces for standard density with 2 toppings', () => {
    const list = resolveHDScatterToppingList({ toppings: ['oreo', 'andes'], density: 'standard' });
    expect(list).toHaveLength(10);
    // Cycles through toppings
    expect(list[0]).toBe('oreo');
    expect(list[1]).toBe('andes');
    expect(list[2]).toBe('oreo');
  });

  it('returns ~12 pieces for double density', () => {
    const list = resolveHDScatterToppingList({ toppings: ['oreo', 'andes'], density: 'double' });
    expect(list).toHaveLength(12);
    // Primary weighted 2:1 over secondary
    expect(list[0]).toBe('oreo');   // primary
    expect(list[1]).toBe('oreo');   // primary
    expect(list[2]).toBe('andes');  // secondary
  });

  it('returns ~14 pieces for explosion density', () => {
    const list = resolveHDScatterToppingList({ toppings: ['oreo', 'andes', 'dove'], density: 'explosion' });
    expect(list).toHaveLength(14);
    // Cycles through all toppings
    expect(list[0]).toBe('oreo');
    expect(list[1]).toBe('andes');
    expect(list[2]).toBe('dove');
    expect(list[3]).toBe('oreo');
  });

  it('returns ~10 pieces monochrome for overload density', () => {
    const list = resolveHDScatterToppingList({ toppings: ['oreo', 'andes'], density: 'overload' });
    expect(list).toHaveLength(10);
    // All same topping (monochrome)
    for (const t of list) expect(t).toBe('oreo');
  });

  it('returns empty array when toppings list is empty', () => {
    expect(resolveHDScatterToppingList({ toppings: [], density: 'standard' })).toEqual([]);
    expect(resolveHDScatterToppingList({ toppings: [], density: 'explosion' })).toEqual([]);
  });
});

describe('renderConeHDSVG', () => {
  it('returns valid SVG with 18x21 viewBox', () => {
    const svg = renderConeHDSVG('Mint Explosion');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 18 21"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('</svg>');
  });

  it('scales correctly', () => {
    const svg = renderConeHDSVG('Mint Explosion', 5);
    expect(svg).toContain('viewBox="0 0 90 105"');
    expect(svg).toContain('width="90"');
    expect(svg).toContain('height="105"');
  });

  it('includes highlight pixels lighter than base', () => {
    const svg = renderConeHDSVG('Dark Chocolate Decadence');
    const base = BASE_COLORS.dark_chocolate;
    // Highlight is base lightened 30%, which must be different from base
    expect(svg).toContain(lightenHex(base, 0.3));
  });

  it('contains more topping rects than previous 8-slot max for explosion density', () => {
    const svg = renderConeHDSVG('Mint Explosion');
    // Mint Explosion has toppings: oreo, andes, dove with explosion density
    // With scatter + shapes, should produce many more topping pixels than old 8 fixed slots
    const oreoCt = (svg.match(new RegExp(TOPPING_COLORS.oreo, 'g')) || []).length;
    const andesCt = (svg.match(new RegExp(TOPPING_COLORS.andes.replace(/[()]/g, '\\$&'), 'g')) || []).length;
    const doveCt = (svg.match(new RegExp(TOPPING_COLORS.dove, 'g')) || []).length;
    const totalToppingRects = oreoCt + andesCt + doveCt;
    // Old renderer had max 8 topping rects; new scatter should have more
    expect(totalToppingRects).toBeGreaterThan(8);
  });

  it('output is deterministic (same input = identical SVG)', () => {
    const svg1 = renderConeHDSVG('Mint Explosion');
    const svg2 = renderConeHDSVG('Mint Explosion');
    expect(svg1).toBe(svg2);
  });

  it('vanilla (pure density) contains zero topping-colored rects', () => {
    const svg = renderConeHDSVG('Vanilla');
    // Exclude topping colors that collide with structural colors (cone tip, waffle, base)
    const structuralColors = new Set([CONE_TIP_COLOR, BASE_COLORS.vanilla]);
    for (const [key, color] of Object.entries(TOPPING_COLORS)) {
      if (structuralColors.has(color)) continue; // skip color collisions
      const count = (svg.match(new RegExp(color.replace(/[()]/g, '\\$&'), 'g')) || []).length;
      if (count > 0) {
        throw new Error(`Vanilla (pure) SVG contains topping color ${key}=${color} (${count} times)`);
      }
    }
  });

  it('includes 6 ribbon slots when ribbon present', () => {
    const svg = renderConeHDSVG('Chocolate Caramel Twist');
    const ribbonColor = RIBBON_COLORS.caramel;
    const count = (svg.match(new RegExp(ribbonColor, 'g')) || []).length;
    expect(count).toBe(6);
  });

  it('includes cone tip color', () => {
    const svg = renderConeHDSVG('Vanilla');
    expect(svg).toContain(CONE_TIP_COLOR);
  });

  it('uses correct base color', () => {
    const svg = renderConeHDSVG('Mint Explosion');
    expect(svg).toContain(BASE_COLORS.mint);
  });
});

describe('darkenHex', () => {
  it('produces a darker color', () => {
    const result = darkenHex('#FFFFFF', 0.5);
    expect(result).toBe('#808080');
  });

  it('returns black when amount is 1', () => {
    expect(darkenHex('#336699', 1)).toBe('#000000');
  });

  it('returns the same color when amount is 0', () => {
    expect(darkenHex('#336699', 0)).toBe('#336699');
  });

  it('darkens each channel proportionally', () => {
    // #80C0FF darkened by 0.25: each channel * 0.75
    const result = darkenHex('#80C0FF', 0.25);
    const r = Math.round(0x80 * 0.75).toString(16).padStart(2, '0').toUpperCase();
    const g = Math.round(0xC0 * 0.75).toString(16).padStart(2, '0').toUpperCase();
    const b = Math.round(0xFF * 0.75).toString(16).padStart(2, '0').toUpperCase();
    expect(result).toBe(`#${r}${g}${b}`);
  });
});

describe('renderConeHeroSVG', () => {
  it('returns valid SVG markup', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('</svg>');
  });

  it('uses 36x42 grid at scale 1', () => {
    const svg = renderConeHeroSVG('Vanilla');
    expect(svg).toContain('viewBox="0 0 36 42"');
    expect(svg).toContain('width="36"');
    expect(svg).toContain('height="42"');
  });

  it('scales correctly', () => {
    const svg = renderConeHeroSVG('Vanilla', 8);
    expect(svg).toContain('viewBox="0 0 288 336"');
    expect(svg).toContain('width="288"');
    expect(svg).toContain('height="336"');
  });

  it('includes base color in scoop fill', () => {
    const svg = renderConeHeroSVG('Mint Explosion');
    expect(svg).toContain(BASE_COLORS.mint);
  });

  it('includes highlight color (lighter than base)', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    const base = BASE_COLORS.chocolate_custard;
    expect(svg).toContain(lightenHex(base, 0.25));
  });

  it('includes shadow color (darker than base)', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    const base = BASE_COLORS.chocolate_custard;
    expect(svg).toContain(darkenHex(base, 0.12));
  });

  it('includes ribbon color when flavor has ribbon', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    // caramel ribbon color should appear
    expect(svg).toContain(RIBBON_COLORS.caramel);
  });

  it('includes ribbon primary color pixels when flavor has ribbon', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    // ribbon is now 1px wide -- primary color only, no highlight overlay
    expect(svg).toContain(RIBBON_COLORS.caramel);
  });

  it('no ribbon pixels for pure density flavor', () => {
    const svg = renderConeHeroSVG('Dark Chocolate Decadence');
    // pure density -- no ribbon, no toppings. Check colors that cannot collide
    // with the dark_chocolate base (#3B1F0B == RIBBON_COLORS.fudge, so skip fudge).
    expect(svg).not.toContain(RIBBON_COLORS.caramel);
    expect(svg).not.toContain(RIBBON_COLORS.marshmallow);
    expect(svg).not.toContain(RIBBON_COLORS.peanut_butter);
  });

  it('includes topping colors for flavors with toppings', () => {
    const svg = renderConeHeroSVG('Caramel Chocolate Pecan');
    expect(svg).toContain(TOPPING_COLORS.pecan);
  });

  it('is deterministic -- same output for same flavor name', () => {
    const svg1 = renderConeHeroSVG('Caramel Chocolate Pecan', 5);
    const svg2 = renderConeHeroSVG('Caramel Chocolate Pecan', 5);
    expect(svg1).toBe(svg2);
  });

  it('produces different output for different flavor profiles', () => {
    const svgCCP = renderConeHeroSVG('Caramel Chocolate Pecan', 1);
    const svgTurtle = renderConeHeroSVG('Turtle', 1);
    // Different profiles (base/ribbon/toppings) -> different SVG
    expect(svgCCP).not.toBe(svgTurtle);
  });

  it('includes cone tip color', () => {
    const svg = renderConeHeroSVG('Vanilla');
    expect(svg).toContain(CONE_TIP_COLOR);
  });

  it('renders pure vanilla with no toppings or ribbon', () => {
    const svg = renderConeHeroSVG('Vanilla');
    // Should have base color but no known topping or ribbon colors.
    // Exclude CONE_TIP_COLOR from topping check: pecan and cone tip share #8B5A2B.
    expect(svg).toContain(BASE_COLORS.vanilla);
    for (const [key, c] of Object.entries(TOPPING_COLORS)) {
      if (c === CONE_TIP_COLOR) continue;  // color collision with cone tip
      expect(svg).not.toContain(c);
    }
    for (const c of Object.values(RIBBON_COLORS)) {
      if (c === BASE_COLORS.vanilla) continue;  // skip any base-color collisions
      expect(svg).not.toContain(c);
    }
  });

  it('renders Butter Pecan with pecan topping color', () => {
    const svg = renderConeHeroSVG('Butter Pecan');
    expect(svg).toContain(TOPPING_COLORS.pecan);
  });
});

describe('resolvePremiumToppingList', () => {
  it('returns empty array for pure density', () => {
    expect(resolvePremiumToppingList({ toppings: ['oreo'], density: 'pure' })).toEqual([]);
  });

  it('returns same toppings for standard density', () => {
    const result = resolvePremiumToppingList({ toppings: ['oreo', 'andes'], density: 'standard' });
    expect(result).toEqual(['oreo', 'andes']);
  });

  it('returns each topping doubled for explosion density', () => {
    const result = resolvePremiumToppingList({ toppings: ['oreo', 'andes', 'dove'], density: 'explosion' });
    expect(result).toHaveLength(6);
    expect(result).toEqual(['oreo', 'oreo', 'andes', 'andes', 'dove', 'dove']);
  });

  it('returns 6 identical items for overload density', () => {
    const result = resolvePremiumToppingList({ toppings: ['oreo'], density: 'overload' });
    expect(result).toEqual(['oreo', 'oreo', 'oreo', 'oreo', 'oreo', 'oreo']);
  });

  it('doubles first topping for double density', () => {
    const result = resolvePremiumToppingList({ toppings: ['strawberry_bits', 'dove'], density: 'double' });
    expect(result).toEqual(['strawberry_bits', 'strawberry_bits', 'dove']);
    // first appears 2x
    expect(result.filter(t => t === 'strawberry_bits')).toHaveLength(2);
  });
});

describe('renderConePremiumSVG', () => {
  it('returns valid SVG markup', () => {
    const svg = renderConePremiumSVG('Mint Explosion');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('</svg>');
  });

  it('uses 24x28 viewBox at scale 1', () => {
    const svg = renderConePremiumSVG('Vanilla');
    expect(svg).toContain('viewBox="0 0 24 28"');
    expect(svg).toContain('width="24"');
    expect(svg).toContain('height="28"');
  });

  it('scales correctly: scale 6 gives viewBox 0 0 144 168', () => {
    const svg = renderConePremiumSVG('Vanilla', 6);
    expect(svg).toContain('viewBox="0 0 144 168"');
    expect(svg).toContain('width="144"');
    expect(svg).toContain('height="168"');
  });

  it('includes base color for Mint Explosion', () => {
    const svg = renderConePremiumSVG('Mint Explosion');
    expect(svg).toContain(BASE_COLORS.mint);
  });

  it('includes highlight color (lightenHex base 0.22) for Caramel Chocolate Pecan', () => {
    const svg = renderConePremiumSVG('Caramel Chocolate Pecan');
    const base = BASE_COLORS.chocolate_custard;
    expect(svg).toContain(lightenHex(base, 0.22));
  });

  it('includes shadow color (darkenHex base 0.10) for Caramel Chocolate Pecan', () => {
    const svg = renderConePremiumSVG('Caramel Chocolate Pecan');
    const base = BASE_COLORS.chocolate_custard;
    expect(svg).toContain(darkenHex(base, 0.10));
  });

  it('includes ribbon color when flavor has ribbon', () => {
    const svg = renderConePremiumSVG('Caramel Chocolate Pecan');
    expect(svg).toContain(RIBBON_COLORS.caramel);
  });

  it('no ribbon for pure density flavor', () => {
    const svg = renderConePremiumSVG('Dark Chocolate Decadence');
    // dark_chocolate base == RIBBON_COLORS.fudge (#3B1F0B) — skip fudge check
    expect(svg).not.toContain(RIBBON_COLORS.caramel);
    expect(svg).not.toContain(RIBBON_COLORS.marshmallow);
    expect(svg).not.toContain(RIBBON_COLORS.peanut_butter);
  });

  it('includes topping color for flavor with toppings', () => {
    const svg = renderConePremiumSVG('Caramel Chocolate Pecan');
    // pecan color appears (also matches CONE_TIP_COLOR but still verifies toppings render)
    expect(svg).toContain(TOPPING_COLORS.pecan);
  });

  it('is deterministic -- same output for same flavor name and scale', () => {
    const svg1 = renderConePremiumSVG('Caramel Chocolate Pecan', 3);
    const svg2 = renderConePremiumSVG('Caramel Chocolate Pecan', 3);
    expect(svg1).toBe(svg2);
  });

  it('produces different output for different flavor profiles', () => {
    const svgCCP = renderConePremiumSVG('Caramel Chocolate Pecan', 1);
    const svgTurtle = renderConePremiumSVG('Turtle', 1);
    expect(svgCCP).not.toBe(svgTurtle);
  });

  it('includes cone tip color', () => {
    const svg = renderConePremiumSVG('Vanilla');
    expect(svg).toContain(CONE_TIP_COLOR);
  });

  it('renders pure vanilla with base color and no unexpected topping or ribbon colors', () => {
    const svg = renderConePremiumSVG('Vanilla');
    expect(svg).toContain(BASE_COLORS.vanilla);
    // No topping colors (skip those matching CONE_TIP_COLOR due to color collision)
    for (const [, c] of Object.entries(TOPPING_COLORS)) {
      if (c === CONE_TIP_COLOR) continue;
      expect(svg).not.toContain(c);
    }
    // No ribbon colors (skip any that equal base color)
    for (const c of Object.values(RIBBON_COLORS)) {
      if (c === BASE_COLORS.vanilla) continue;
      expect(svg).not.toContain(c);
    }
  });
});

// =============================================================
// Canonical shape map + hero density resolver
// =============================================================

describe('_CANONICAL_TOPPING_SHAPES', () => {
  it('has exactly 5 shape keys: dot, chunk, sliver, flake, scatter', () => {
    const keys = Object.keys(_CANONICAL_TOPPING_SHAPES).sort();
    expect(keys).toEqual(['chunk', 'dot', 'flake', 'scatter', 'sliver']);
  });

  it('dot shape is 2x2', () => {
    expect(_CANONICAL_TOPPING_SHAPES.dot).toEqual([[0,0],[1,0],[0,1],[1,1]]);
  });

  it('chunk shape is 3x2', () => {
    expect(_CANONICAL_TOPPING_SHAPES.chunk).toEqual([[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]);
  });

  it('sliver shape is 1x3', () => {
    expect(_CANONICAL_TOPPING_SHAPES.sliver).toEqual([[0,0],[0,1],[0,2]]);
  });

  it('flake shape is 3x1', () => {
    expect(_CANONICAL_TOPPING_SHAPES.flake).toEqual([[0,0],[1,0],[2,0]]);
  });

  it('scatter shape is two offset pixels', () => {
    expect(_CANONICAL_TOPPING_SHAPES.scatter).toEqual([[0,0],[2,1]]);
  });
});

describe('_CANONICAL_SHAPE_MAP', () => {
  it('has an entry for every TOPPING_COLORS key', () => {
    const toppingKeys = Object.keys(TOPPING_COLORS);
    for (const key of toppingKeys) {
      expect(_CANONICAL_SHAPE_MAP).toHaveProperty(key);
    }
  });

  it('all map values are valid shape keys', () => {
    const validShapes = Object.keys(_CANONICAL_TOPPING_SHAPES);
    for (const [key, shape] of Object.entries(_CANONICAL_SHAPE_MAP)) {
      expect(validShapes).toContain(shape);
    }
  });
});

describe('resolveHeroToppingList', () => {
  it('pure density returns empty array', () => {
    expect(resolveHeroToppingList({ toppings: ['oreo'], density: 'pure' })).toEqual([]);
  });

  it('standard density with 2 toppings returns 16 pieces cycling toppings', () => {
    const result = resolveHeroToppingList({ toppings: ['oreo', 'andes'], density: 'standard' });
    expect(result).toHaveLength(16);
    // Should cycle: oreo, andes, oreo, andes, ...
    expect(result[0]).toBe('oreo');
    expect(result[1]).toBe('andes');
    expect(result[2]).toBe('oreo');
  });

  it('double density returns 20 pieces with primary weighted 2:1', () => {
    const result = resolveHeroToppingList({ toppings: ['strawberry_bits', 'dove'], density: 'double' });
    expect(result).toHaveLength(20);
    // Primary should appear more than secondary
    const primaryCount = result.filter(t => t === 'strawberry_bits').length;
    const secondaryCount = result.filter(t => t === 'dove').length;
    expect(primaryCount).toBeGreaterThan(secondaryCount);
  });

  it('explosion density returns 24 pieces cycling all toppings', () => {
    const result = resolveHeroToppingList({ toppings: ['oreo', 'andes', 'dove'], density: 'explosion' });
    expect(result).toHaveLength(24);
    expect(result[0]).toBe('oreo');
    expect(result[1]).toBe('andes');
    expect(result[2]).toBe('dove');
  });

  it('overload density returns 16 pieces of single topping', () => {
    const result = resolveHeroToppingList({ toppings: ['oreo'], density: 'overload' });
    expect(result).toHaveLength(16);
    expect(result.every(t => t === 'oreo')).toBe(true);
  });

  it('returns empty array when toppings are empty for any density', () => {
    expect(resolveHeroToppingList({ toppings: [], density: 'standard' })).toEqual([]);
    expect(resolveHeroToppingList({ toppings: [], density: 'double' })).toEqual([]);
    expect(resolveHeroToppingList({ toppings: [], density: 'explosion' })).toEqual([]);
    expect(resolveHeroToppingList({ toppings: [], density: 'overload' })).toEqual([]);
  });
});

describe('renderConeHeroSVG scatter upgrade', () => {
  it('mint explosion (explosion density) has more than 8 topping rects', () => {
    const svg = renderConeHeroSVG('mint explosion', 1);
    // Count topping-colored rects (oreo #1A1A1A, andes #0A3726, dove #2B1A12)
    const oreoCount = (svg.match(/#1A1A1A/g) || []).length;
    const andesCount = (svg.match(/#0A3726/g) || []).length;
    const doveCount = (svg.match(/#2B1A12/g) || []).length;
    const totalToppingRects = oreoCount + andesCount + doveCount;
    expect(totalToppingRects).toBeGreaterThan(8);
  });

  it('vanilla (pure density) has zero topping-colored rects', () => {
    const svg = renderConeHeroSVG('vanilla', 1);
    for (const [key, color] of Object.entries(TOPPING_COLORS)) {
      if (color === CONE_TIP_COLOR) continue;
      expect(svg).not.toContain(color);
    }
  });

  it('output is deterministic (same input produces identical SVG)', () => {
    const svg1 = renderConeHeroSVG('turtle', 1);
    const svg2 = renderConeHeroSVG('turtle', 1);
    expect(svg1).toBe(svg2);
  });
});

// =============================================================
// Cone renderer quality gate
// =============================================================

/**
 * Compute the set of all valid pixel keys for a tier spec.
 * Valid = pixel is within the scoop zone, cone zone, or tip zone.
 * tipPixels entries are [row, startCol, endCol].
 */
function buildValidSet(spec) {
  const valid = new Set();
  spec.scoopMask.forEach(([sc, ec], row) => {
    for (let col = sc; col <= ec; col++) valid.add(`${col},${row}`);
  });
  const coneStart = spec.scoopMask.length;
  spec.coneMask.forEach(([sc, ec], ri) => {
    const row = coneStart + ri;
    for (let col = sc; col <= ec; col++) valid.add(`${col},${row}`);
  });
  for (const [row, sc, ec] of spec.tipPixels) {
    for (let col = sc; col <= ec; col++) valid.add(`${col},${row}`);
  }
  return valid;
}

// -- Tier specs: explicit masks derived from renderer source constants --
//
// minCoverage: exact pixel counts from the mask geometry (sum of ec-sc+1 per row).
// The base fill always covers the full mask, so these are structural minimums
// that catch any skipped rows or truncated geometry in the renderer.
// tipPixels: [row, startCol, endCol] -- at least one pixel must be present.

const MINI_SPEC = {
  gridW: 9,
  gridH: 10,
  // scoopRows from renderConeSVG: rows 0-4
  scoopMask: [[3,5],[2,6],[1,7],[1,7],[1,7]],
  // coneRows from renderConeSVG: rows 5-8
  coneMask:  [[2,6],[2,6],[3,5],[3,5]],
  // tip pixel at (4,9) -- uses CONE_COLORS.waffle_dark, not CONE_TIP_COLOR
  tipPixels: [[9, 4, 4]],
  // 3+5+7+7+7 = 29 scoop; 5+5+3+3 = 16 cone; 1 tip
  minCoverage: { scoop: 29, cone: 16, tip: 1 },
};

const HD_SPEC = {
  gridW: 18,
  gridH: 21,
  // scoopRows from renderConeHDSVG: rows 0-10
  scoopMask: [
    [4,13],[3,14],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[2,15],[3,14],
  ],
  // coneRows from renderConeHDSVG: rows 11-19
  coneMask: [
    [4,13],[4,13],[5,12],[5,12],[6,11],[6,11],[7,10],[7,10],[8,9],
  ],
  // tip: two pixels at row 20, cols 8-9 (CONE_TIP_COLOR)
  tipPixels: [[20, 8, 9]],
  // 10+12+14×8+12 = 146 scoop; 10+10+8+8+6+6+4+4+2 = 58 cone; 2 tip
  minCoverage: { scoop: 146, cone: 58, tip: 2 },
};

const PREMIUM_SPEC = {
  gridW: 24,
  gridH: 28,
  // _PREM_SCOOP_ROWS: rows 0-13
  scoopMask: [
    [3,18],[1,22],[0,23],[0,23],[0,23],[0,23],[0,23],
    [0,23],[1,22],[2,20],[3,18],[4,16],[5,15],[6,14],
  ],
  // _PREM_CONE_ROWS: rows 14-27
  coneMask: [
    [5,19],[5,19],[6,18],[6,18],[7,17],[7,17],[8,16],
    [8,16],[9,15],[9,15],[10,14],[10,14],[11,13],[11,13],
  ],
  // tip: rect(11, 27, 3, 1, CONE_TIP_COLOR) -- cols 11-13 at row 27 (within last cone row)
  tipPixels: [[27, 11, 13]],
  // 16+22+24×6+22+19+16+13+11+9 = 272 scoop; 2×(15+13+11+9+7+5+3) = 126 cone; 3 tip
  minCoverage: { scoop: 272, cone: 126, tip: 3 },
};

const HERO_SPEC = {
  gridW: 36,
  gridH: 42,
  // _HERO_SCOOP_ROWS: rows 0-21
  scoopMask: [
    [8,27],[6,29],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],
    [4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[4,31],[6,29],[7,28],
  ],
  // _HERO_CONE_ROWS: rows 22-39
  coneMask: [
    [7,28],[7,28],[9,26],[9,26],[11,24],[11,24],[13,22],[13,22],[14,21],[14,21],
    [15,20],[15,20],[16,19],[16,19],[16,19],[16,19],[17,18],[17,18],
  ],
  // tip: rect(17, 40/41, 2, 1, CONE_TIP_COLOR) -- cols 17-18 at rows 40-41
  tipPixels: [[40, 17, 18],[41, 17, 18]],
  // 20+24+28×18+24+22 = 594 scoop; 22+22+18+18+14+14+10+10+8+8+6+6+4×4+2+2 = 176 cone; 4 tip
  minCoverage: { scoop: 594, cone: 176, tip: 4 },
};

const TIER_SPECS = [
  { name: 'Mini',    fn: renderConeSVG,       spec: MINI_SPEC    },
  { name: 'HD',      fn: renderConeHDSVG,     spec: HD_SPEC      },
  { name: 'Premium', fn: renderConePremiumSVG, spec: PREMIUM_SPEC },
  { name: 'Hero',    fn: renderConeHeroSVG,   spec: HERO_SPEC    },
];

const ALL_FLAVOR_NAMES = Object.keys(FLAVOR_PROFILES);

// -- Structural invariants: all flavors x all tiers --

describe('cone structural invariants — all flavors x all tiers', () => {
  for (const { name, fn, spec } of TIER_SPECS) {
    const validSet = buildValidSet(spec);
    const coneStart = spec.scoopMask.length;

    it(`${name}: every pixel is within grid bounds and valid zone`, () => {
      for (const flavorName of ALL_FLAVOR_NAMES) {
        const pixels = renderToPixels(fn(flavorName, 1));
        for (const key of pixels.keys()) {
          const [x, y] = key.split(',').map(Number);
          if (x < 0 || x >= spec.gridW || y < 0 || y >= spec.gridH) {
            throw new Error(`${flavorName}: pixel (${x},${y}) outside ${spec.gridW}x${spec.gridH} grid`);
          }
          if (!validSet.has(key)) {
            throw new Error(`${flavorName}: pixel (${x},${y}) outside valid zone (scoop+cone+tip)`);
          }
        }
      }
    });

    it(`${name}: zone coverage meets minimums (scoop, cone, tip)`, () => {
      for (const flavorName of ALL_FLAVOR_NAMES) {
        const pixels = renderToPixels(fn(flavorName, 1));

        let scoopCount = 0;
        spec.scoopMask.forEach(([sc, ec], row) => {
          for (let col = sc; col <= ec; col++) {
            if (pixels.has(`${col},${row}`)) scoopCount++;
          }
        });
        if (scoopCount < spec.minCoverage.scoop) {
          throw new Error(
            `${flavorName}: scoop has ${scoopCount} pixels, expected >= ${spec.minCoverage.scoop}`
          );
        }

        let coneCount = 0;
        spec.coneMask.forEach(([sc, ec], ri) => {
          const row = coneStart + ri;
          for (let col = sc; col <= ec; col++) {
            if (pixels.has(`${col},${row}`)) coneCount++;
          }
        });
        if (coneCount < spec.minCoverage.cone) {
          throw new Error(
            `${flavorName}: cone has ${coneCount} pixels, expected >= ${spec.minCoverage.cone}`
          );
        }

        let tipCount = 0;
        for (const [tipRow, sc, ec] of spec.tipPixels) {
          for (let col = sc; col <= ec; col++) {
            if (pixels.has(`${col},${tipRow}`)) tipCount++;
          }
        }
        if (tipCount < spec.minCoverage.tip) {
          throw new Error(
            `${flavorName}: tip has ${tipCount} pixels, expected >= ${spec.minCoverage.tip}`
          );
        }
      }
    });

    it(`${name}: renders identically on two calls (determinism)`, () => {
      for (const flavorName of ALL_FLAVOR_NAMES) {
        const h1 = stableHash(renderToPixels(fn(flavorName, 1)));
        const h2 = stableHash(renderToPixels(fn(flavorName, 1)));
        if (h1 !== h2) {
          throw new Error(`${flavorName}: non-deterministic (h1=${h1} h2=${h2})`);
        }
      }
    });
  }
});

// -- Golden pixel hashes: Tier-1 flavors x all tiers --
//
// To initialize or update:  UPDATE_GOLDENS=1 npm test
// The run prints "GOLDEN: 'key': 'hash'," lines to stdout.
// Copy those values into the table below, then commit.
// Entries set to null are skipped silently (not yet initialized).

const GOLDEN_HASHES = {
  'Mini/vanilla':                   'baa42cd3',
  'Mini/mint explosion':            '27445862',
  'Mini/chocolate caramel twist':   '89184d20',
  'Mini/dark chocolate decadence':  'a85a6964',
  'Mini/caramel chocolate pecan':   '74926315',
  'HD/vanilla':                     '6af5b3e3',
  'HD/mint explosion':              '3d6ff643',
  'HD/chocolate caramel twist':     '9eba3bb9',
  'HD/dark chocolate decadence':    '8a7c8271',
  'HD/caramel chocolate pecan':     '22775571',
  'Premium/vanilla':                'cc0e3069',
  'Premium/mint explosion':         'e35eb910',
  'Premium/chocolate caramel twist':'d0e8b426',
  'Premium/dark chocolate decadence':'03b26551',
  'Premium/caramel chocolate pecan':'95a4d691',
  'Hero/vanilla':                   '2ef6df7b',
  'Hero/mint explosion':            '412c233e',
  'Hero/chocolate caramel twist':   '68b702b7',
  'Hero/dark chocolate decadence':  '2385a85f',
  'Hero/caramel chocolate pecan':   '16f101ed',
};

const GOLDEN_FLAVORS = [
  'vanilla',
  'mint explosion',
  'chocolate caramel twist',
  'dark chocolate decadence',
  'caramel chocolate pecan',
];

describe('cone golden hashes — Tier-1 flavors x all tiers', () => {
  for (const { name, fn } of TIER_SPECS) {
    for (const flavorName of GOLDEN_FLAVORS) {
      const key = `${name}/${flavorName}`;
      it(key, () => {
        const hash = stableHash(renderToPixels(fn(flavorName, 1)));
        if (process.env.UPDATE_GOLDENS === '1') {
          console.log(`GOLDEN: '${key}': '${hash}',`);
          return;
        }
        if (GOLDEN_HASHES[key] === null) {
          // Not yet initialized. Run UPDATE_GOLDENS=1 npm test to populate.
          return;
        }
        expect(hash).toBe(GOLDEN_HASHES[key]);
      });
    }
  }
});
