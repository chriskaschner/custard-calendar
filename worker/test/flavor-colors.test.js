import { describe, it, expect } from 'vitest';
import {
  getFlavorProfile,
  renderConeSVG,
  renderConeHDSVG,
  resolveHDToppingSlots,
  lightenHex,
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
