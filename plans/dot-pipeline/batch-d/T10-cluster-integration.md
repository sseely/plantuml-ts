# T10 — Cluster integration

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. T8 and T9 built
cluster.ts and compound.ts. This task wires them into the existing pipeline
and adds cluster metadata to the type system.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **`src/core/dot/types.ts`**: add to `DotNode`:
   - `clusterId?: string` (D3)
   
   Add to `DotWorkingGraph`:
   - `clusters: Map<string, DotNode[]>` (D3)

2. **`src/core/dot/index.ts`**: in `buildWorkingGraph`, initialize
   `clusters: new Map()`. After `removeAcyclic`, call `dot_clust(graph)` and
   `compoundEdges(graph)` before `assignRanks`.

3. **`src/core/dot/rank.ts`**: respect cluster rank bounds — when a node has
   a `clusterId`, its rank must fall within the cluster's computed bounds.
   Read `~/git/graphviz/lib/dotgen/rank.c` for how cluster constraints feed
   into the rank assignment.

4. **`src/core/dot/mincross.ts`**: ensure crossing minimization respects
   cluster boundaries — nodes within a cluster are ordered relative to each
   other within their rank before inter-cluster ordering. Read cluster.c and
   mincross.c for the `cluster_heuristic` approach.

5. **`src/core/dot/position.ts`**: cluster border node spacing — border nodes
   added by dot_clust should have zero width/height but still participate in
   x-coordinate assignment to enforce cluster visual boundaries.

## Write-set

- `src/core/dot/types.ts` (modify)
- `src/core/dot/index.ts` (modify)
- `src/core/dot/rank.ts` (modify)
- `src/core/dot/mincross.ts` (modify)
- `src/core/dot/position.ts` (modify)

## Read-set

- `src/core/dot/cluster.ts` — T8 output
- `src/core/dot/compound.ts` — T9 output
- `~/git/graphviz/lib/dotgen/rank.c` — cluster constraint integration
- `~/git/graphviz/lib/dotgen/mincross.c` — cluster_heuristic
- `~/git/graphviz/lib/dotgen/position.c` — border node handling
- All existing `tests/unit/dot/*.test.ts` files — ensure none break

## Stop condition

If this task requires editing files beyond {rank.ts, mincross.ts, position.ts,
index.ts, types.ts}, STOP and document in the decision journal.

## Acceptance criteria

- Given a graph with a cluster subgraph containing nodes A and B, when the
  full pipeline runs, then A and B are visually inside the cluster boundary.
- Given a compound edge from node X to cluster_C, when the pipeline runs,
  then the edge terminates at cluster_C's border node, not at a node inside.
- Given the full test suite, when T10 is complete, then all tests pass.

## Visual QA gate

Run `pnpm visual:compare` then invoke `plantuml-visual-qa` agent. Any new
Tier 1 failure in the dot section must be fixed before Batch E.

## Quality bar

All four quality gates: `npm test && npm run typecheck && npm run lint && npm run build`.
