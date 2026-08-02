#!/usr/bin/env node
/**
 * Refuses to deploy when the conditions that took production down on 2026-08-01
 * are present.
 *
 * What happened: `wrangler deploy` was run from the repo root instead of
 * `worker/`. Wrangler scaffolded `/wrangler.jsonc` with `name = "custard-calendar"`
 * -- the production Worker name -- plus `assets: { directory: "public" }` and no
 * `main`. With no `main`, wrangler builds a no-op asset server, so the deploy
 * replaced the real Worker with a static server for four stale Hugo files. Every
 * route 404'd on both domains, including the .ics feed.
 *
 * It hid well. `wrangler.jsonc` is gitignored, so it never appears in
 * `git status`, and the bad deploy prints an ordinary success message. The only
 * tell is that a correct deploy lists the three `schedule:` cron triggers and a
 * broken one does not.
 *
 * This guard covers `npm run deploy`. It cannot stop a bare `npx wrangler deploy`
 * from the wrong directory -- deploy through the npm script, which also pins
 * `--config` so the working directory cannot decide which config wins.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Config filenames wrangler will pick up at the repo root. */
export const STRAY_ROOT_CONFIGS = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];

/**
 * Collect reasons this deploy must not proceed.
 * Pure: all filesystem access is injected so this is unit-testable.
 *
 * @param {Object} opts
 * @param {string} opts.cwd - Directory the deploy was invoked from
 * @param {string} opts.workerDir - Directory that owns the real wrangler.toml
 * @param {string} opts.repoRoot - Repo root, checked for stray configs
 * @param {(p: string) => boolean} opts.exists
 * @param {(p: string) => string} opts.readText
 * @returns {string[]} Human-readable blockers; empty means safe to deploy
 */
export function collectDeployBlockers({ cwd, workerDir, repoRoot, exists, readText }) {
  const blockers = [];

  if (resolve(cwd) !== resolve(workerDir)) {
    blockers.push(
      `Deploy must run from ${workerDir}, not ${resolve(cwd)}.\n` +
      '    Running wrangler from the repo root makes it scaffold a root wrangler.jsonc\n' +
      '    that deploys a no-op asset server over the real Worker.'
    );
  }

  const configPath = join(workerDir, 'wrangler.toml');
  if (!exists(configPath)) {
    blockers.push(`Missing ${configPath}. Nothing would pin the deploy to the real Worker.`);
  } else {
    const config = readText(configPath);
    if (!/^\s*main\s*=/m.test(config)) {
      blockers.push(
        `${configPath} has no \`main\`. Wrangler builds a no-op asset server when\n` +
        '    `main` is absent, which is exactly the 2026-08-01 outage.'
      );
    }
    if (!/^\s*name\s*=/m.test(config)) {
      blockers.push(
        `${configPath} has no \`name\`. Wrangler would infer one from the directory,\n` +
        '    which can silently target the wrong Worker.'
      );
    }
  }

  for (const filename of STRAY_ROOT_CONFIGS) {
    const strayPath = join(repoRoot, filename);
    if (exists(strayPath)) {
      blockers.push(
        `Stray ${filename} at the repo root: ${strayPath}\n` +
        '    This is gitignored, so it will not show up in `git status`. Wrangler may\n' +
        '    deploy it instead of worker/wrangler.toml. Delete it, then retry:\n' +
        `        rm ${strayPath}`
      );
    }
  }

  return blockers;
}

function main() {
  const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const blockers = collectDeployBlockers({
    cwd: process.cwd(),
    workerDir,
    repoRoot: resolve(workerDir, '..'),
    exists: existsSync,
    readText: (p) => readFileSync(p, 'utf8'),
  });

  if (blockers.length > 0) {
    console.error('\nDeploy blocked -- these would risk replacing the live Worker:\n');
    blockers.forEach((b, i) => console.error(`  ${i + 1}. ${b}\n`));
    console.error('See TODO.md "make a root-level wrangler deploy impossible".\n');
    process.exit(1);
  }

  console.log('Predeploy checks passed. After deploying, confirm the output lists all');
  console.log('three `schedule:` cron triggers -- a no-op asset deploy omits them.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
