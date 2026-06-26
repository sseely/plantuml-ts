# T11 — sameport.ts + splines update

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. sameport.c handles
edges that share the same port on a node (e.g., multiple edges all entering
the top of a node). Without sameport, they overlap. This task ports sameport.c
and updates splines.ts to use sameport-aware anchor selection.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **Create `src/core/dot/sameport.ts`**: port
   `~/git/graphviz/lib/dotgen/sameport.c`.
   
   Key function: `sameport(g)` — for groups of edges sharing a port, compute
   fan-out anchor offsets so the edges spread out instead of stacking.

2. **Update `src/core/dot/splines.ts`**: add sameport-aware anchor selection.
   After `sameport(graph)` has run (called from index.ts or splines itself),
   use the computed offsets when generating edge start/end control points.

## Write-set

- `src/core/dot/sameport.ts` (create)
- `src/core/dot/splines.ts` (modify)
- `tests/unit/dot/sameport.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/sameport.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/samePort.java`
- `src/core/dot/splines.ts` — current routing implementation
- `~/git/graphviz/lib/dotgen/dotsplines.c` — see how sameport interacts with spline routing

## Interface contracts

Export:
```typescript
export function sameport(graph: DotWorkingGraph): void;
```

Adds port offset metadata to edges (e.g., `edge.portOffset?: number`) so
splines.ts can spread them.

## Acceptance criteria

- Given two edges both entering the top of node N, when `sameport` runs and
  splines routes them, then the two edges arrive at slightly different x
  offsets on N's top edge (not stacked).
- Given edges with no shared ports, when `sameport` runs, then no edge
  attributes are modified.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
