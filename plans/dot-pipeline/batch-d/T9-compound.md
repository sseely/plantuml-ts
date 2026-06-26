# T9 — compound.ts

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. Graphviz supports
compound edges — edges that logically connect to a cluster boundary rather
than a specific node. This task ports `compound.c`.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/compound.c` to `src/core/dot/compound.ts`.

Key responsibilities:
- `makeCompoundEdge(g, e)` — for an edge whose head or tail is a cluster
  (identified by `lhead`/`ltail` attributes), find the actual border node
  inside that cluster that the edge should connect to for routing purposes
- `compoundEdges(g)` — iterate over all edges and apply makeCompoundEdge
  to compound edges

The TypeScript version receives a `DotWorkingGraph` after cluster processing
and adjusts edge endpoints to hit cluster border nodes.

## Write-set

- `src/core/dot/compound.ts` (create)
- `tests/unit/dot/compound.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/compound.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/compound.java`
- `src/core/dot/cluster.ts` — T8 output (cluster bounds, border node concept)
- `src/core/dot/types.ts`

## Interface contracts

Export:
```typescript
export function compoundEdges(graph: DotWorkingGraph): void;
```

Modifies edge endpoints in-place: edges whose `lhead`/`ltail` attributes
name a cluster have their `from`/`to` replaced with the appropriate cluster
border node.

## Acceptance criteria

- Given an edge with `lhead = "cluster_A"` and a graph where cluster_A has
  a border node at rank 2, when `compoundEdges` runs, then the edge's `to`
  is set to the cluster_A border node.
- Given a graph with no compound edges, when `compoundEdges` runs, then no
  edge endpoints are modified.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
