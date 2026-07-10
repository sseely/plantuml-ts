# T2 — Pure-move split: layout DOT builders → class-dot-graph.ts

## Context
Same project context as T1. `src/diagrams/class/layout.ts` is exactly 500
lines — at the cap. Batch 2 (T5/T7/T8) edits the DOT-graph construction;
split first (decisions.md#d6).

## Task
Behavior-free move: lift the DOT-graph construction cluster into a new
`src/diagrams/class/class-dot-graph.ts`:
`nonEmptyNamespaceIds` (:190), `buildDotClusters` (:215), `buildDotEdges`
(:239), `KIND_SHAPE` + `buildDotNodes` (:256-291), `buildDotGraph` (:298),
`EDGE_DECORATION_MAP`/`HIERARCHICAL` (:160-174). `layout.ts` keeps
`layoutClass` and the geometry-mapping cluster (`buildClassifierGeos`,
`buildNamespaceGeos`, `attachEdgeLabel`, `buildEdgeGeos`). Names verbatim.

## Write-set
- `src/diagrams/class/layout.ts` (shrinks)
- `src/diagrams/class/class-dot-graph.ts` (new)

## Read-set
- `src/diagrams/class/layout.ts` (whole file)
- `plans/class-dot-sync/decisions.md#d6`

## Acceptance criteria
- Given the class corpus, when `npx tsx scripts/dot-sync-report.ts class`
  runs after the move, then structurally EQUAL = 357 (unchanged).
- Given the split, when `wc -l` runs, then both files are ≤420 lines.
- Given all four gates, then all pass.

## Observability
N/A.

## Rollback
Reversible (pure move).

## Commit
`refactor(class): lift DOT-graph builders into class-dot-graph.ts`
