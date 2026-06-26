# T5 — Green all gates, finalize branch

## Context
T1–T4 each committed. This task verifies the full quality bar and resolves any
residual lint/format issues from the deletions and repointing.

## Task
1. Run all four gates in order; fix only what the burn caused:
   - `npm run typecheck`
   - `npm run lint` (autofix import/order/unused issues the deletions exposed)
   - `npm test`
   - `npm run build`
2. Any failure tied to a keeper renderer, the demo, or pre-existing baseline
   issues (see README pre-flight) is **out of scope** — do not fix; log and, if
   it blocks a gate, stop.
3. If lint flags now-unused imports/exports in the 6 repointed layouts, remove
   them (they are in T2's write-set conceptually; small follow-up edits allowed).

## Write-set
- Minimal touch-ups only in already-modified files (lint/format). No new files.

## Read-set
- `README.md#quality-gates`, `README.md#pre-flight-notes`

## Acceptance criteria
- Given `npm run typecheck`, then exit 0.
- Given `npm run lint`, then exit 0.
- Given `npm test`, then exit 0 (skips allowed, zero failures).
- Given `npm run build`, then exit 0 and emits `dist/plantuml-ts.*`.

## Observability
N/A.

## Rollback
Reversible.

## Quality bar
All four gates green. Commit only if touch-ups were needed:
`fix(layout): resolve lint fallout from engine removal`.
