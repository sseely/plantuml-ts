# T0 — Merge, branch, housekeeping

## Context

`feat/consolidate-description-engine` is complete and green (its brief's
summary, 2026-06-26, plus two visual-QA tool commits). This mission starts
from main with that work merged. Several valuable untracked files must be
committed; two stray debug artifacts must get out of the repo root.

## Steps (in order)

1. On `feat/consolidate-description-engine`: run all four quality gates.
   All green → proceed. Not green → STOP (report output).
2. Commit the untracked planning docs and tooling **on this branch** before
   merging:
   - `git add planning/*.md planning/graphviz/ scripts/dot-sync-report.ts`
   - Commit: `docs(planning): commit deep-dives + dot-sync report tooling`
3. Move the stray root artifacts out of the tree (rm is denied in autonomous
   mode; test-results/ is gitignored): `mv svek.dot svek.svg test-results/`.
4. `git checkout main && git merge --no-ff feat/consolidate-description-engine`
   (merge commit — brief requirement). Re-run the four gates on main.
5. `git checkout -b feat/dot-oracle-sync`.
5b. Pin graphviz-ts to a packed snapshot (decisions.md D2): run
   `npm pack` in `~/git/graphviz-ts` if no current tarball exists, then
   `npm install ../graphviz-ts/graphviz-ts-<version>.tgz`. Verify
   package.json now points at the tgz (not the live dir), run the four
   gates, commit: `chore(deps): pin graphviz-ts to packed snapshot`.
6. Add `"Bash(java *:*)"` and `"Bash(git merge *:*)"` to
   `.claude/settings.autonomous.json` allow-list (oracle dumps need java;
   note: `.claude/` is gitignored — local-only edit, no commit).
7. Mark this batch done in the mission README; journal entry with gate
   results.

## Write-set

Git state (merge, branch), `planning/*.md`, `scripts/dot-sync-report.ts`,
`.claude/settings.autonomous.json`, stray file moves.

## Acceptance criteria

- Given main after the merge, when the four gates run, then all pass.
- Given `git status` on the new branch, then no untracked files remain except
  gitignored paths.
- Given the repo root, then `svek.dot`/`svek.svg` are gone from tracked/
  untracked view.

## Observability: N/A — no new observable operations.
## Rollback: Reversible (git revert of merge commit; branch delete).
