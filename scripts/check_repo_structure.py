#!/usr/bin/env python3
"""
Repo structure enforcement check.

Fails if any tracked top-level directory is not listed in REPO_CONTRACT.md.
Uses `git ls-tree HEAD` so locally gitignored dirs (tmp/, data/, etc.) are ignored.
Run in CI on every push/PR to main.

Usage:
    uv run python scripts/check_repo_structure.py
"""

import subprocess
import sys

# Canonical allowlist from REPO_CONTRACT.md.
# Update here AND in REPO_CONTRACT.md when adding a new top-level directory.
ALLOWED_DIRS = {
    'analytics',
    'archive',
    'docs',
    'logs',       # empty dir kept via logs/.gitkeep; cron log target
    'scripts',
    'src',
    'tests',
    'tidbyt',
    'tools',
    'widgets',
    'worker',
    '.claude',    # Claude Code project settings (.claude/settings.json)
    '.github',
    '.planning',  # GSD planning documents (phases, research, plans)
}


def tracked_top_level_dirs():
    result = subprocess.run(
        ['git', 'ls-tree', '--name-only', 'HEAD'],
        capture_output=True, text=True, check=True,
    )
    dirs = []
    for line in result.stdout.splitlines():
        name = line.strip()
        if not name:
            continue
        # ls-tree returns both files and trees; check if it's a tree
        type_result = subprocess.run(
            ['git', 'ls-tree', '-d', '--name-only', 'HEAD', name],
            capture_output=True, text=True,
        )
        if type_result.stdout.strip():
            dirs.append(name)
    return dirs


def main():
    try:
        dirs = tracked_top_level_dirs()
    except subprocess.CalledProcessError as e:
        print(f'Could not query git tree: {e}')
        sys.exit(1)

    violations = [d for d in dirs if d not in ALLOWED_DIRS]

    if violations:
        print('Repo structure violation: unexpected tracked top-level directories.')
        print('Add them to REPO_CONTRACT.md and scripts/check_repo_structure.py,')
        print('or remove/archive them if no longer needed.')
        print()
        for v in sorted(violations):
            print(f'  {v}/')
        sys.exit(1)

    print(f'Repo structure OK ({len(dirs)} tracked top-level dirs, all allowed).')
    sys.exit(0)


if __name__ == '__main__':
    main()
