# Deferred Items -- Phase 07

## CI Repo Structure Check Failure

**Found during:** Task 1 (pre-push validation and push)
**Scope:** Pre-existing -- not caused by this plan's changes
**Issue:** The `.planning/` directory is tracked in git but not listed in `REPO_CONTRACT.md` or `scripts/check_repo_structure.py`. The Repo Structure Check CI job fails with: "unexpected tracked top-level directories: .planning/"
**Suggested fix:** Either add `.planning/` to `REPO_CONTRACT.md` and `scripts/check_repo_structure.py` as an allowed directory, or add `.planning/` to `.gitignore` and remove it from tracking.
**CI run:** https://github.com/chriskaschner/custard-calendar/actions/runs/22849536372
