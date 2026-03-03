# Repo Cleanup Plan

Date: 2026-03-03  
Status: Planning only (no structural moves executed yet)

## Why This Exists

This repo currently mixes production code, experiments, generated artifacts, local state, and credential files in one place. That creates avoidable risk, onboarding friction, and operational ambiguity.

This document defines a pragmatic cleanup strategy focused on:

1. Security first.
2. Clear project boundaries.
3. Incremental migration with low blast radius.
4. Enforced standards so entropy does not return.

## Current Problems (Observed)

1. `alexa/` exists but is not in active CI/deploy paths.
2. Local plaintext credential files exist under `credentials/` (gitignored but still poor hygiene).
3. Overlapping display/runtime surfaces exist across `tidbyt/`, `apps/culversforecast/`, `widgets/`, and `docs/assets/`.
4. `docs/` is overloaded with both web runtime assets and engineering artifacts.
5. Untracked/generated local churn is high (`tmp/`, `data/`, `worker/coverage/`, `.claude/checkpoints/`, etc.), making signal-to-noise poor.

## North Star

Use one monorepo with explicit, enforceable boundaries:

1. `apps/` for deployable runtimes.
2. `packages/` for shared libraries/contracts.
3. `research/` for notebooks and experiments.
4. `ops/` for operational tooling/runbooks.
5. `archive/` for intentionally inactive code.
6. No credentials inside repo tree (even if gitignored).

## Proposed Target Structure

1. `apps/worker` (from current `worker/`).
2. `apps/pipeline` (from root `main.py`, `src/`, pipeline-oriented scripts/tests).
3. `apps/web` (from static app currently in `docs/`).
4. `apps/display` (canonical Tidbyt + Scriptable sources, deduplicated).
5. `research/analytics` (from `analytics/`).
6. `archive/alexa` (unless promoted to first-class product with CI/deploy ownership).
7. `ops/` for automation and repo-level operational scripts.

## Execution Plan (Incremental, No Big-Bang)

### Phase 0: Freeze + Classify (1 day)

1. Produce keep/move/archive/delete matrix for every top-level directory.
2. Assign owner for each active surface.
3. Mark all directories as one of: active runtime, shared lib, research, archived, generated, local-only.

### Phase 1: Security Hardening (1 day, first priority)

1. Move runtime credentials out of repo tree (`~/.config/...` or secret manager).
2. Rotate any token that may have existed in local plaintext files.
3. Add CI secret scanning and local pre-commit secret checks.
4. Keep `.env.example`; forbid committed `.env` and in-repo credential JSON.

### Phase 2: Repo Contract (1 day)

1. Create `REPO_CONTRACT.md` with allowed top-level directories and rules.
2. Define where generated artifacts are allowed.
3. Define naming/versioning conventions.
4. Define ownership + code-review requirements per area.

### Phase 3: Path Migration (2-4 days)

1. Move with `git mv` to preserve history.
2. Add temporary compatibility wrappers for old paths.
3. Update CI paths and scripts one surface at a time.
4. Keep PRs narrow and reversible.

### Phase 4: De-dup + Archive (1-2 days)

1. Choose one canonical Tidbyt source tree.
2. Choose one canonical Scriptable source tree.
3. Remove/archive stale duplicates and one-off generated variants.
4. Move Alexa to `archive/` with explicit revival criteria (or promote to first-class with CI/deploy/docs).

### Phase 5: Enforcement (1 day)

1. Add CI gate for repo structure policy.
2. Add CI gate to fail on disallowed paths/artifacts.
3. Add preflight script checks for local noise and forbidden files.
4. Add contributor doc updates and onboarding checklist.

## Non-Negotiable Guardrails

1. Root stays clean: only repo metadata and high-level docs.
2. No generated artifacts in tracked source trees unless explicitly allowed.
3. No credentials anywhere under repo directory.
4. Every top-level directory has one owner and one purpose.
5. CI fails on policy violations.

## Definition of Done

1. Fresh clone/bootstrap yields low-noise status.
2. No plaintext credential files in repo tree.
3. All directories map to documented contract + owner.
4. CI covers all active apps and no orphan lanes.
5. Alexa is explicitly archived or fully promoted (no limbo).
6. One canonical implementation path per display/render surface.

## PR Sequence (Recommended)

1. PR1: Add `REPO_CONTRACT.md`, cleanup roadmap docs, and policy scaffolding.
2. PR2: Security hardening (credentials migration + scanner hooks + docs).
3. PR3: `apps/worker` and CI path updates.
4. PR4: `apps/pipeline` extraction and script/test path updates.
5. PR5: `apps/web` extraction and static asset boundary cleanup.
6. PR6: Display surface dedupe (`apps/display`) and dead path removal.
7. PR7: `research/analytics` normalization and archive unused artifacts.
8. PR8: Archive Alexa or promote with full production standards.
9. PR9: Final policy gates + contributor workflow hardening.

## Immediate Next Step

Create the keep/move/archive/delete matrix for all current top-level directories and lock that before moving files.
