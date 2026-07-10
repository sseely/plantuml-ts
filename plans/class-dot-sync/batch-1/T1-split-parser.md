# T1 — Pure-move split: parser COMMANDS table → class-commands.ts

## Context
plantuml-ts (TypeScript port of PlantUML; vitest, eslint, 500-line file
cap enforced by lint). `src/diagrams/class/parser.ts` is 498 lines — at the
cap. Batch 2 (T6 newpage) must add a command; split first (decisions.md#d6).

## Task
Behavior-free move: lift the `COMMANDS` dispatch-table array
(parser.ts ~lines 150–414) into a new `src/diagrams/class/class-commands.ts`.
`parser.ts` keeps `ParseState`, `ensureClassifier`/`registerInNamespace`
helpers, and the `parseClass` driver loop (462–497). Preserve every name
verbatim (porting doctrine — no renames, no cleanup, no reordering of
command patterns: match order is load-bearing).

## Write-set
- `src/diagrams/class/parser.ts` (shrinks)
- `src/diagrams/class/class-commands.ts` (new)

## Read-set
- `src/diagrams/class/parser.ts` (whole file — it's being split)
- `plans/class-dot-sync/decisions.md#d6`

## Acceptance criteria
- Given any class corpus fixture, when parsed before/after, then the AST is
  identical (spot-check via existing parser unit tests — all must pass
  unmodified).
- Given the split, when `wc -l` runs, then both files are ≤450 lines
  (headroom for T6).
- Given `npm test && npm run typecheck && npm run lint && npm run build`,
  then all pass.

## Observability
N/A — no new observable operations.

## Rollback
Reversible (pure move; revert the commit).

## Commit
`refactor(class): lift COMMANDS table into class-commands.ts`
(body: pure move for 500-line cap headroom, no behavior change)
