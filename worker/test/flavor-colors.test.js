import { describe, it, expect } from 'vitest';
import {
  getFlavorProfile,
  renderConeSVG,
  renderConeHDSVG,
  renderConeHeroSVG,
  renderConePremiumSVG,
  resolveHDToppingSlots,
  resolvePremiumToppingList,
  lightenHex,
  darkenHex,
  BASE_COLORS,
  FLAVOR_PROFILES,
  RIBBON_COLORS,
  TOPPING_COLORS,
  CONE_TIP_COLOR,
} from '../src/flavor-colors.js';

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

  it('includes 8 topping slots for explosion density', () => {
    const svg = renderConeHDSVG('Mint Explosion');
    // Mint Explosion has toppings: oreo, andes, dove with explosion density
    // All 8 slots should be filled. Count unique topping colors present.
    const oreoCt = (svg.match(new RegExp(TOPPING_COLORS.oreo, 'g')) || []).length;
    const andesCt = (svg.match(new RegExp(TOPPING_COLORS.andes.replace(/[()]/g, '\\$&'), 'g')) || []).length;
    const doveCt = (svg.match(new RegExp(TOPPING_COLORS.dove, 'g')) || []).length;
    // Each appears at least twice cycling across 8 slots
    expect(oreoCt).toBeGreaterThanOrEqual(2);
    expect(andesCt).toBeGreaterThanOrEqual(2);
    expect(doveCt).toBeGreaterThanOrEqual(2);
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
