# T3 — Delete the in-house graphviz engines

## Context
After T2, nothing in `src/` imports the engines. Delete them. `core/dot` dies
entirely — its consumer types now live in `core/graph-layout.types.ts` (T1).

## Task
Delete these directories in full:
`src/core/dot`, `src/core/circo`, `src/core/fdp`, `src/core/neato`,
`src/core/osage`, `src/core/pack`, `src/core/patchwork`, `src/core/pathplan`,
`src/core/sfdp`, `src/core/twopi`, `src/core/label`.

Then verify no dangling references remain in `src/`:
`rg "core/(dot|circo|fdp|neato|osage|pack|patchwork|pathplan|sfdp|twopi|label)/" src`
must return nothing. If it does, the reference is outside the planned write-set —
**stop** and log it (a consumer was missed in T2).

## Write-set
- Delete: `src/core/{dot,circo,fdp,neato,osage,pack,patchwork,pathplan,sfdp,twopi,label}/`

## Read-set
- `decisions.md#d4` (types already relocated in T1)

## Acceptance criteria
- Given `src/core`, when listed, then none of the 11 engine dirs exist.
- Given `rg "core/<engine>/" src`, when run, then zero matches.
- Given `npm run typecheck`, when run, then it compiles (the dark-six now resolve
  layout via the stubbed chokepoint).

## Observability
N/A.

## Rollback
Reversible — `git checkout` restores the deleted dirs.

## Quality bar
`npm run typecheck` passes. Commit: `refactor(layout): delete in-house graphviz
engines (superseded by graphviz-ts)`. Body: list the 11 dirs + LOC removed.
