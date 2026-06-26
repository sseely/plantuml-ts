# T12 — conc.ts + rank update

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. `conc.c` implements
edge concentration — merging parallel edges between two nodes into a single
visual edge with a concentration node. This reduces visual clutter in dense
graphs.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

1. **Create `src/core/dot/conc.ts`**: port
   `~/git/graphviz/lib/dotgen/conc.c`.
   
   Key function: `concentrate(g)` — detect parallel edges (same from/to pair),
   replace them with a concentration diamond node and two edges.

2. **Update `src/core/dot/rank.ts`**: call `concentrate(graph)` at the right
   point during rank setup (before network simplex runs on the concentrated
   graph). Read `~/git/graphviz/lib/dotgen/rank.c` to find where conc is called.

## Write-set

- `src/core/dot/conc.ts` (create)
- `src/core/dot/rank.ts` (modify)
- `tests/unit/dot/conc.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/conc.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/conc.java`
- `src/core/dot/rank.ts` — where to insert the concentrate() call
- `~/git/graphviz/lib/dotgen/rank.c` — context for where conc is called

## Interface contracts

Export:
```typescript
export function concentrate(graph: DotWorkingGraph): void;
```

Modifies graph in-place: adds concentration nodes (virtual), replaces
parallel edges with concentrated paths.

## Acceptance criteria

- Given two edges A→B and A→B (parallel), when `concentrate` runs, then
  there is one concentration node C and edges A→C, C→B instead of two A→B.
- Given a graph with no parallel edges, when `concentrate` runs, then the
  graph is unchanged.
- Given a concentrated graph, when the full pipeline runs, then the layout
  result does not have two separate edges between the same node pair.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
