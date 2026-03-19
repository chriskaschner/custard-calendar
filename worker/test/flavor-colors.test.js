import { describe, it, expect } from 'vitest';
import {
  getFlavorProfile,
  renderConeSVG,
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

const TIER_SPECS = [
  { name: 'Mini', fn: renderConeSVG, spec: MINI_SPEC },
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
