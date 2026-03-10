/**
 * Alias validation CI gate.
 *
 * Ensures FLAVOR_ALIASES integrity:
 *   - Every alias target exists in FLAVOR_PROFILES (no dangling references)
 *   - No alias key duplicates a FLAVOR_PROFILES key (would be unreachable)
 *   - All alias keys are pre-normalized (normalizeFlavorKey output)
 *   - getFlavorProfile resolves aliases to the correct canonical profile
 *   - Existing behavior (exact match, unicode, keyword fallback, default) unchanged
 */
import { describe, it, expect } from 'vitest';
import {
  FLAVOR_ALIASES,
  FLAVOR_PROFILES,
  getFlavorProfile,
} from '../src/flavor-colors.js';

// ---------------------------------------------------------------------------
// Alias dict structural integrity
// ---------------------------------------------------------------------------

describe('FLAVOR_ALIASES structural integrity', () => {
  it('every alias target exists as a key in FLAVOR_PROFILES', () => {
    for (const [alias, target] of Object.entries(FLAVOR_ALIASES)) {
      expect(
        FLAVOR_PROFILES[target],
        `Alias "${alias}" -> "${target}" has no matching FLAVOR_PROFILES key`
      ).toBeDefined();
    }
  });

  it('no alias key duplicates a FLAVOR_PROFILES key', () => {
    for (const alias of Object.keys(FLAVOR_ALIASES)) {
      expect(
        FLAVOR_PROFILES[alias],
        `Alias key "${alias}" also exists in FLAVOR_PROFILES (redundant -- exact match wins)`
      ).toBeUndefined();
    }
  });

  it('all alias keys are already-normalized (lowercase, no TM/R, ASCII quotes, single spaces)', () => {
    const normalizeRe = /^[a-z0-9 '"\-,.!&]+$/;
    for (const alias of Object.keys(FLAVOR_ALIASES)) {
      // Must be lowercase
      expect(alias).toBe(alias.toLowerCase());
      // Must not contain TM or R symbols
      expect(alias).not.toMatch(/[\u00ae\u2122]/);
      // Must not contain curly quotes
      expect(alias).not.toMatch(/[\u2018\u2019]/);
      // Must not contain double spaces
      expect(alias).not.toMatch(/  /);
      // Must not have leading/trailing whitespace
      expect(alias).toBe(alias.trim());
    }
  });

  it('has at least 15 alias entries', () => {
    expect(Object.keys(FLAVOR_ALIASES).length).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// Alias resolution via getFlavorProfile
// ---------------------------------------------------------------------------

describe('getFlavorProfile alias resolution', () => {
  it('resolves each alias to the correct canonical profile', () => {
    for (const [alias, target] of Object.entries(FLAVOR_ALIASES)) {
      const resolved = getFlavorProfile(alias);
      const canonical = FLAVOR_PROFILES[target];
      expect(
        resolved,
        `getFlavorProfile("${alias}") should resolve to the "${target}" profile`
      ).toEqual(canonical);
    }
  });

  it('resolves "Reeses Peanut Butter Cup" to really reese\'s profile', () => {
    const profile = getFlavorProfile('Reeses Peanut Butter Cup');
    expect(profile.base).toBe('chocolate');
    expect(profile.ribbon).toBe('peanut_butter');
    expect(profile.toppings).toContain('reeses');
  });

  it('resolves alias names with mixed case', () => {
    // Aliases should work regardless of input casing
    for (const [alias, target] of Object.entries(FLAVOR_ALIASES)) {
      const upperInput = alias.charAt(0).toUpperCase() + alias.slice(1);
      const resolved = getFlavorProfile(upperInput);
      const canonical = FLAVOR_PROFILES[target];
      expect(resolved).toEqual(canonical);
    }
  });
});

// ---------------------------------------------------------------------------
// Existing behavior preserved
// ---------------------------------------------------------------------------

describe('getFlavorProfile existing behavior unchanged', () => {
  it('exact match still takes precedence over alias', () => {
    // 'peanut butter cup' exists in FLAVOR_PROFILES directly
    const profile = getFlavorProfile('Peanut Butter Cup');
    expect(profile.base).toBe('chocolate');
    expect(profile.ribbon).toBe('peanut_butter');
  });

  it('unicode curly quote normalization still works', () => {
    const profile = getFlavorProfile('really reese\u2019s');
    expect(profile.base).toBe('chocolate');
    expect(profile.ribbon).toBe('peanut_butter');
  });

  it('keyword fallback still works for unknown names', () => {
    const profile = getFlavorProfile('Triple Mint Surprise');
    expect(profile.base).toBe('mint');
  });

  it('returns default vanilla profile for completely unknown names', () => {
    const profile = getFlavorProfile('Unicorn Rainbow');
    expect(profile.base).toBe('vanilla');
    expect(profile.ribbon).toBeNull();
    expect(profile.toppings).toEqual([]);
    expect(profile.density).toBe('standard');
  });

  it('returns default for null/undefined input', () => {
    expect(getFlavorProfile(null).base).toBe('vanilla');
    expect(getFlavorProfile(undefined).base).toBe('vanilla');
  });
});
