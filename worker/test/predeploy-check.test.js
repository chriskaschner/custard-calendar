/**
 * Guards the deploy guard. Each case here is a way the 2026-08-01 outage could
 * recur: deploying from the wrong directory, deploying a config with no `main`
 * (which makes wrangler build a no-op asset server), or deploying while a stray
 * gitignored wrangler config sits at the repo root.
 */
import { describe, it, expect } from 'vitest';
import { collectDeployBlockers, STRAY_ROOT_CONFIGS } from '../scripts/predeploy-check.mjs';

const REPO_ROOT = '/repo';
const WORKER_DIR = '/repo/worker';
const GOOD_CONFIG = [
  'name = "custard-calendar"',
  'main = "src/index.js"',
  'compatibility_date = "2024-09-23"',
].join('\n');

/** Filesystem stub: `files` maps absolute path to contents. */
function fs(files) {
  return {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readText: (p) => files[p],
  };
}

function check(overrides = {}) {
  const files = overrides.files || { '/repo/worker/wrangler.toml': GOOD_CONFIG };
  return collectDeployBlockers({
    cwd: overrides.cwd || WORKER_DIR,
    workerDir: WORKER_DIR,
    repoRoot: REPO_ROOT,
    ...fs(files),
  });
}

describe('collectDeployBlockers', () => {
  it('passes on a correct deploy from worker/', () => {
    expect(check()).toEqual([]);
  });

  it('tolerates an unnormalized cwd', () => {
    expect(check({ cwd: '/repo/worker/' })).toEqual([]);
    expect(check({ cwd: '/repo/worker/../worker' })).toEqual([]);
  });

  it('blocks a deploy launched from the repo root', () => {
    const blockers = check({ cwd: REPO_ROOT });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/must run from \/repo\/worker/);
  });

  it('blocks a config with no main, which builds a no-op asset server', () => {
    const blockers = check({
      files: { '/repo/worker/wrangler.toml': 'name = "custard-calendar"' },
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/no `main`/);
  });

  it('blocks a config with no name, which could target the wrong Worker', () => {
    const blockers = check({
      files: { '/repo/worker/wrangler.toml': 'main = "src/index.js"' },
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/no `name`/);
  });

  it('blocks when wrangler.toml is missing entirely', () => {
    const blockers = check({ files: {} });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/Missing \/repo\/worker\/wrangler\.toml/);
  });

  it.each(STRAY_ROOT_CONFIGS)('blocks a stray root %s', (filename) => {
    const blockers = check({
      files: {
        '/repo/worker/wrangler.toml': GOOD_CONFIG,
        [`/repo/${filename}`]: '{}',
      },
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(new RegExp(`Stray ${filename.replace('.', '\\.')}`));
    // The message must say how to fix it -- the file is invisible to git status.
    expect(blockers[0]).toMatch(/rm \/repo\//);
  });

  it('reproduces the exact 2026-08-01 config that caused the outage', () => {
    // Root wrangler.jsonc with the production Worker name, an assets directory,
    // and no main -- deployed from the root.
    const blockers = check({
      cwd: REPO_ROOT,
      files: {
        '/repo/worker/wrangler.toml': GOOD_CONFIG,
        '/repo/wrangler.jsonc': JSON.stringify({
          name: 'custard-calendar',
          assets: { directory: 'public' },
        }),
      },
    });
    expect(blockers).toHaveLength(2);
    expect(blockers.join('\n')).toMatch(/must run from/);
    expect(blockers.join('\n')).toMatch(/Stray wrangler\.jsonc/);
  });

  it('reports every independent problem at once', () => {
    const blockers = check({ cwd: REPO_ROOT, files: {} });
    expect(blockers.length).toBeGreaterThanOrEqual(2);
  });
});
