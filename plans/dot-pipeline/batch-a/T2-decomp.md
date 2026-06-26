# T2 — decomp.ts

## Context

plantuml-js is a TypeScript port of PlantUML. This task ports `decomp.c`,
which decomposes a graph into connected components and handles rank constraint
propagation across components.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/decomp.c` to `src/core/dot/decomp.ts`.

The file's purpose: identify connected components in the graph; assign each
component an independent rank space; propagate `min`/`max`/`source`/`sink`
rank constraints within each component.

Key functions to port:
- `nodeInduce(g, subg)` — induce subgraph node set
- `edgeInduce(g, subg)` — induce subgraph edge set
- `decompose(g, pass)` — main decomposition entry point

## Write-set

- `src/core/dot/decomp.ts` (create)
- `tests/unit/dot/decomp.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/decomp.c` — authoritative source
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/decomp.java`
- `src/core/dot/types.ts` — DotWorkingGraph, DotNode
- `src/core/dot/rank.ts` — see how ranks are currently assigned, so decomp integrates cleanly

## Interface contracts

Export:
```typescript
export function decompose(graph: DotWorkingGraph): DotWorkingGraph[];
```

Returns one sub-graph per connected component. Each sub-graph shares the same
`DotNode`/`DotEdge` objects (not copies) so rank assignments propagate back
to the original nodes.

## Acceptance criteria

- Given a disconnected graph with two separate chains A→B and C→D, when
  `decompose` runs, then it returns two sub-graphs each with 2 nodes.
- Given a connected graph, when `decompose` runs, then it returns a
  single-element array containing all nodes.
- Given a graph with a `source` rank constraint on node X, when `decompose`
  runs, then the component containing X correctly marks X as the source.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Write tests first (TDD). Coverage for decomp.ts ≥90/90/90.
