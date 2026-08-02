/**
 * Alias sync CI gate.
 *
 * FLAVOR_ALIASES exists in four places. Cone PNGs are named after canonical
 * FLAVOR_PROFILES keys, so a surface whose alias table is behind silently serves
 * a generic cone for every flavor it cannot resolve. That is exactly what
 * happened: the two widget copies sat at 37 entries while the canonical table
 * grew to 77, so iOS widget users got generic cones for 40 flavors with nothing
 * failing anywhere.
 *
 * The existing `widget-sync` CI job only diffs widgets/custard-today.js against
 * docs/assets/custard-today.js. Both being equally stale passes that check --
 * and did. This gate compares all copies against the canonical source instead.
 *
 * Modeled on palette-sync.test.js, which guards the color dicts the same way.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLAVOR_ALIASES, FLAVOR_PROFILES } from '../src/flavor-colors.js';

const testDir = import.meta.dirname;

/** Every downstream copy that must track the canonical table. */
const SYNC_TARGETS = [
  { name: 'widgets/custard-today.js', path: resolve(testDir, '../../widgets/custard-today.js') },
  { name: 'docs/assets/custard-today.js', path: resolve(testDir, '../../docs/assets/custard-today.js') },
  { name: 'worker/src/widget-routes.js', path: resolve(testDir, '../src/widget-routes.js') },
  { name: 'docs/cone-renderer.js', path: resolve(testDir, '../../docs/cone-renderer.js'), varName: 'FALLBACK_FLAVOR_ALIASES' },
];

/**
 * Regex source for a single-or-double quoted JS string, allowing escapes and any
 * character that is not the opening delimiter. Flavor names are full of
 * apostrophes -- "reese's", "cookies 'n cream", "s'mores" -- so a naive
 * ['"]([^'"]+)['"] truncates at the first inner quote and silently reports real
 * entries as missing.
 *
 * `delimGroup` is the capture-group number this pattern's own delimiter will
 * occupy in the assembled regex; the backreference must point at it, so two
 * concatenated copies cannot both use \1.
 */
function quotedPattern(delimGroup) {
  return "(['\"])((?:\\\\.|(?!\\" + delimGroup + ")[^\\\\])*)\\" + delimGroup;
}

function unescapeJs(raw) {
  return raw.replace(/\\(.)/g, '$1');
}

/**
 * Parse an alias object literal out of a JS source file.
 * Handles both quote styles; the widget copies use double, flavor-colors mixes.
 */
function parseAliasTable(content, varName = 'FLAVOR_ALIASES') {
  const re = new RegExp(`(?:var|const)\\s+${varName}\\s*=\\s*\\{`);
  const start = content.search(re);
  if (start === -1) return null;

  const open = content.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') depth--;
    i++;
  }

  const body = content.slice(open + 1, i - 1);
  const table = new Map();
  const pairRe = new RegExp(quotedPattern(1) + '\\s*:\\s*' + quotedPattern(3), 'g');
  for (const m of body.matchAll(pairRe)) {
    table.set(unescapeJs(m[2]), unescapeJs(m[4]));
  }
  return table;
}

describe('parseAliasTable', () => {
  // The parser is load-bearing: a silent parse failure makes every sync
  // assertion below pass vacuously. Apostrophe-heavy flavor names are exactly
  // where a naive quote regex breaks, so pin that behavior first.
  it('handles apostrophes, mixed quote styles, and escapes', () => {
    const src = [
      'var FLAVOR_ALIASES = {',
      `  "reese's peanut butter cup": "really reese's",`,
      `  "cookies 'n cream": "oreo cookie cheesecake",`,
      `  's\\'mores': 'bonfire s\\'mores',`,
      `  'plain': "simple",`,
      '};',
    ].join('\n');

    const table = parseAliasTable(src);
    expect(table.get("reese's peanut butter cup")).toBe("really reese's");
    expect(table.get("cookies 'n cream")).toBe('oreo cookie cheesecake');
    expect(table.get("s'mores")).toBe("bonfire s'mores");
    expect(table.get('plain')).toBe('simple');
    expect(table.size).toBe(4);
  });

  it('returns null when the declaration is absent', () => {
    expect(parseAliasTable('var SOMETHING_ELSE = {};')).toBeNull();
  });
});

describe('FLAVOR_ALIASES stays in sync across every surface', () => {
  it.each(SYNC_TARGETS)('$name matches the canonical table', ({ path, varName }) => {
    const table = parseAliasTable(readFileSync(path, 'utf8'), varName);
    expect(table, 'alias table not found -- did the declaration change shape?').not.toBeNull();

    const missing = Object.keys(FLAVOR_ALIASES).filter(k => !table.has(k));
    const extra = [...table.keys()].filter(k => !(k in FLAVOR_ALIASES));
    const wrong = [...table.entries()]
      .filter(([k, v]) => k in FLAVOR_ALIASES && FLAVOR_ALIASES[k] !== v)
      .map(([k, v]) => `${k}: expected "${FLAVOR_ALIASES[k]}", got "${v}"`);

    expect(missing, 'aliases present canonically but absent here').toEqual([]);
    expect(extra, 'aliases here that no longer exist canonically').toEqual([]);
    expect(wrong, 'aliases pointing at a different canonical flavor').toEqual([]);
  });

  it('every alias target is a real profile, on every surface', () => {
    // A target that is not a FLAVOR_PROFILES key slugs to a PNG that does not
    // exist, so the surface silently degrades to a generic cone.
    for (const { name, path, varName } of SYNC_TARGETS) {
      const table = parseAliasTable(readFileSync(path, 'utf8'), varName);
      const dangling = [...table.values()].filter(v => !(v in FLAVOR_PROFILES));
      expect(dangling, `${name} has aliases pointing at non-existent profiles`).toEqual([]);
    }
  });

  it('guards a table large enough to be the real one', () => {
    // Cheap tripwire: if a parse regression silently yields an empty Map, the
    // equality assertions above would pass vacuously against an empty canonical.
    expect(Object.keys(FLAVOR_ALIASES).length).toBeGreaterThanOrEqual(70);
    for (const { name, path, varName } of SYNC_TARGETS) {
      const table = parseAliasTable(readFileSync(path, 'utf8'), varName);
      expect(table.size, `${name} parsed suspiciously small`).toBeGreaterThanOrEqual(70);
    }
  });
});
