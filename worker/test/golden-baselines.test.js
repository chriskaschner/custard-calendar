/**
 * Pixelmatch golden baseline visual regression tests (VALD-03).
 *
 * Generates and compares PNG baselines for every profiled flavor across
 * all 4 rendering tiers (Mini 9x11, HD 18x21, Premium 24x28, Hero 36x42).
 *
 * Zero tolerance threshold -- rendering is deterministic (seeded PRNG),
 * so any pixel difference is a real change.
 *
 * Regenerate baselines after intentional changes:
 *   UPDATE_GOLDENS=1 npx vitest run golden-baselines.test.js
 */

import { describe, it, expect } from 'vitest';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderConeSVG, renderConeHDSVG, renderConeHeroSVG, renderConePremiumSVG,
  FLAVOR_PROFILES,
} from '../src/flavor-colors.js';
import { renderToPixels, pixelMapToRGBA } from './helpers/render-to-pixels.js';

const GOLDENS_DIR = path.join(import.meta.dirname, 'fixtures', 'goldens');

const TIERS = [
  { name: 'mini',    fn: renderConeSVG,        w: 9,  h: 11 },
  { name: 'hd',      fn: renderConeHDSVG,      w: 18, h: 21 },
  { name: 'premium', fn: renderConePremiumSVG,  w: 24, h: 28 },
  { name: 'hero',    fn: renderConeHeroSVG,     w: 36, h: 42 },
];

const ALL_FLAVORS = Object.keys(FLAVOR_PROFILES);
const UPDATE = process.env.UPDATE_GOLDENS === '1';

/**
 * Convert flavor name to filesystem-safe slug.
 * "really reese's" -> "really-reese-s"
 */
function flavorSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Encode RGBA buffer as PNG and write to disk.
 * Creates parent directories if needed.
 */
function saveGolden(rgba, width, height, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
}

/**
 * Load a golden PNG baseline.
 * Returns { data: Uint8Array, width, height } or null if file missing.
 */
function loadGolden(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(buffer);
  return { data: new Uint8Array(png.data), width: png.width, height: png.height };
}

/**
 * Render a flavor at a specific tier to an RGBA buffer.
 */
function renderFlavor(flavorName, tier) {
  const svg = tier.fn(flavorName, 1);
  const pixelMap = renderToPixels(svg);
  return pixelMapToRGBA(pixelMap, tier.w, tier.h);
}

if (UPDATE) {
  describe('golden baselines -- UPDATE mode', () => {
    it('regenerates all golden baselines', () => {
      let count = 0;
      for (const tier of TIERS) {
        for (const flavorName of ALL_FLAVORS) {
          const rgba = renderFlavor(flavorName, tier);
          const filePath = path.join(GOLDENS_DIR, tier.name, `${flavorSlug(flavorName)}.png`);
          saveGolden(rgba, tier.w, tier.h, filePath);
          count++;
        }
      }
      console.log(`GOLDEN: Updated ${count} baseline PNGs across ${TIERS.length} tiers`);
    });
  });
} else {
  describe('golden baselines -- pixelmatch regression', () => {
    for (const tier of TIERS) {
      describe(`${tier.name} (${tier.w}x${tier.h})`, () => {
        for (const flavorName of ALL_FLAVORS) {
          it(`${flavorName}`, () => {
            const filePath = path.join(GOLDENS_DIR, tier.name, `${flavorSlug(flavorName)}.png`);
            const golden = loadGolden(filePath);
            if (!golden) {
              throw new Error(
                `Missing golden baseline: ${filePath}\n` +
                `Run UPDATE_GOLDENS=1 npm test to generate baselines.`
              );
            }
            expect(golden.width).toBe(tier.w);
            expect(golden.height).toBe(tier.h);
            const current = renderFlavor(flavorName, tier);
            const numDiff = pixelmatch(current, golden.data, null, tier.w, tier.h, { threshold: 0 });
            expect(numDiff).toBe(0);
          });
        }
      });
    }
  });
}
