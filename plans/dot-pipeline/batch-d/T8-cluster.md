# T8 — cluster.ts

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. Graphviz supports
cluster subgraphs (subgraphs whose name starts with "cluster_"). This task
ports `cluster.c` which handles cluster rank assignment and cluster border
node injection.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/cluster.c` to `src/core/dot/cluster.ts`.

Key responsibilities of cluster.c:
- `dotclusterrank(g, cl, minrank, maxrank)` — compute rank constraints for a
  cluster subgraph: all nodes in the cluster must be between minrank and
  maxrank
- `dot_clust(g)` — main entry: detect cluster subgraphs, assign cluster rank
  bounds, add border nodes (invisible nodes added at the cluster's min/max
  rank to enforce the cluster boundary in layout)

The TypeScript version operates on `DotWorkingGraph`. For cluster detection,
use the `DotInputGraph`'s subgraph metadata if present, or fall back to
naming conventions.

## Write-set

- `src/core/dot/cluster.ts` (create)
- `tests/unit/dot/cluster.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/cluster.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/cluster.java`
- `src/core/dot/types.ts` — current DotWorkingGraph (clusters field added in T10; for now read the current types)
- `src/core/dot/rank.ts` — understand how rank constraints propagate

## Architecture decisions

- D3: cluster membership uses `DotNode.clusterId` + `DotWorkingGraph.clusters` map.
  T8 should accept a graph and cluster map (populated externally). The actual
  type additions to types.ts happen in T10. T8 may use local interfaces if needed.

## Interface contracts

Export:
```typescript
export interface ClusterBounds { minRank: number; maxRank: number; }
export function dot_clust(graph: DotWorkingGraph): Map<string, ClusterBounds>;
```

Returns a map of clusterId → rank bounds. T10 will add border nodes using
this information.

## Acceptance criteria

- Given a graph with two subgraphs where subgraph S1 has nodes at ranks 0-1
  and subgraph S2 has nodes at ranks 2-3, when `dot_clust` runs, then S1 has
  bounds {minRank:0, maxRank:1} and S2 has bounds {minRank:2, maxRank:3}.
- Given a flat graph with no cluster subgraphs, when `dot_clust` runs, then
  it returns an empty map.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
