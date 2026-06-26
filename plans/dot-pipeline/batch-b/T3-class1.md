# T3 — class1.ts

## Context

plantuml-js is a TypeScript port of PlantUML. This task ports `class1.c`,
which classifies edges as tree/forward/cross/back and builds the feasible
spanning tree used by network simplex rank assignment.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/class1.c` to `src/core/dot/class1.ts`.

The file's purpose: DFS-classify all edges (tree/forward/back/cross), then
construct a tight spanning tree by iteratively adding the tightest edge
(minimum slack) not yet in the tree. This is the setup phase for the network
simplex algorithm in rank.ts.

Key functions to port:
- `dfs_cutval(e, v)` — DFS cut value calculation
- `init_cutvalues(g)` — initialize all tree edge cut values
- `class1(g)` — main entry point: classify edges + build tight spanning tree

Also add `type?: 'tree' | 'forward' | 'cross' | 'back'` to `DotEdge` in
`types.ts` (D2). This is the only types.ts change in this task.

## Write-set

- `src/core/dot/class1.ts` (create)
- `tests/unit/dot/class1.test.ts` (create)
- `src/core/dot/types.ts` (modify: add `type` field to DotEdge)

## Read-set

- `~/git/graphviz/lib/dotgen/class1.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/class1.java`
- `src/core/dot/types.ts` — current DotEdge, DotNode, DotWorkingGraph
- `src/core/dot/rank.ts` — understand how the spanning tree is currently used

## Architecture decisions

- D2: edge type is `'tree' | 'forward' | 'cross' | 'back'` string literal on DotEdge.type

## Interface contracts

Export:
```typescript
export function class1(graph: DotWorkingGraph): void;
```

After `class1`, every edge in `graph.edges` has `edge.type` set.
Tree edges also have `edge.inTree = true`.

## Acceptance criteria

- Given a simple chain A→B→C, when `class1` runs, then the two edges are
  classified as 'tree' edges and `inTree` is true on both.
- Given a graph with a back-edge (A→B, B→A after acyclic), when `class1`
  runs, then the back-going edge is classified as 'back'.
- Given a graph where the tight tree is a subset of all edges, when `class1`
  runs, then `inTree` is true on exactly `|nodes| - 1` edges.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Write tests first (TDD). Coverage for class1.ts ≥90/90/90.
