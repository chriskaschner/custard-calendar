import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { FLAVOR_PROFILES } from '../src/flavor-colors.js';

const CONES_DIR = resolve(import.meta.dirname, '../../docs/assets/cones');
const CONE_RENDERER_PATH = resolve(import.meta.dirname, '../../docs/cone-renderer.js');
const GENERATE_SCRIPT_PATH = resolve(import.meta.dirname, '../../scripts/generate-hero-cones.mjs');
const SW_PATH = resolve(import.meta.dirname, '../../docs/sw.js');

describe('PNG asset count', () => {
  it('docs/assets/cones/ has exactly FLAVOR_PROFILES.length PNG files', () => {
    const files = readdirSync(CONES_DIR).filter(f => f.endsWith('.png'));
    const expectedCount = Object.keys(FLAVOR_PROFILES).length;
    expect(files.length).toBe(expectedCount);
  });
});

describe('heroConeSrc alias resolution', () => {
  const rendererSource = readFileSync(CONE_RENDERER_PATH, 'utf-8');
  const generateSource = readFileSync(GENERATE_SCRIPT_PATH, 'utf-8');

  it('heroConeSrc contains FALLBACK_FLAVOR_ALIASES for alias resolution', () => {
    // Extract heroConeSrc function body
    const match = rendererSource.match(/function heroConeSrc\([\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('FALLBACK_FLAVOR_ALIASES');
  });

  it('heroConeSrc uses normalizeFlavorKey for unicode normalization', () => {
    const match = rendererSource.match(/function heroConeSrc\([\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('normalizeFlavorKey');
  });

  it('slug regex in generate-hero-cones.mjs matches heroConeSrc slug regex', () => {
    // Extract slug pattern from generate script: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const genMatch = generateSource.match(/\.replace\(\/\[\^a-z0-9\]\+\/g,\s*'-'\)\.replace\(\/\^-\|-\$\/g,\s*''\)/);
    expect(genMatch).not.toBeNull();

    // The same slug pattern should exist in cone-renderer.js heroConeSrc
    const heroMatch = rendererSource.match(/function heroConeSrc[\s\S]*?\.replace\(\/\[\^a-z0-9\]\+\/g,\s*'-'\)\.replace\(\/\^-\|-\$\/g,\s*''\)/);
    expect(heroMatch).not.toBeNull();
  });
});

describe('CACHE_VERSION', () => {
  it('docs/sw.js contains custard-v24', () => {
    const swSource = readFileSync(SW_PATH, 'utf-8');
    expect(swSource).toContain('custard-v24');
  });
});
