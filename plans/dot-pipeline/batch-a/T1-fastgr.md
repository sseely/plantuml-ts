# T1 — fastgr.ts

## Context

plantuml-js is a TypeScript port of PlantUML. The dot layout pipeline is
being ported to 100% Graphviz fidelity. This task ports the fastgr.c helper
which provides fast adjacency list access for the dot algorithm's inner loops.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/fastgr.c` to `src/core/dot/fastgr.ts`.

The file's purpose: `agflatten` converts the graph's linked-list edge
representation to flat arrays indexed by node order, enabling O(1) random
access during rank assignment and crossing minimization. `unflatten` tears
down the flat arrays when they are no longer needed.

Key functions to port:
- `agflatten_elist(g, e, flag)` — flatten one edge list (in or out)
- `agflatten(g, flag)` — flatten all nodes in all subgraphs
- `unflatten(g)` — free flat arrays

The TypeScript version operates on `DotWorkingGraph`. Since TypeScript uses
GC, "free" means setting the arrays to empty/undefined on DotNode.

## Write-set

- `src/core/dot/fastgr.ts` (create)
- `tests/unit/dot/fastgr.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/fastgr.c` — authoritative source
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/fastGr.java` — Java transpile for reference
- `src/core/dot/types.ts` — DotWorkingGraph, DotNode, DotEdge shapes

## Architecture decisions

- D2 applies: if you add edge type classification here (you shouldn't — that's T3), use string literal union

## Interface contracts

Export:
```typescript
export function agflatten(graph: DotWorkingGraph): void;
export function unflatten(graph: DotWorkingGraph): void;
```

`agflatten` may add `flatIn: DotEdge[]` and `flatOut: DotEdge[]` fields to
each `DotNode`. If you need these fields, add them to `DotNode` in `types.ts`
as optional arrays. Discuss this with the write-set rule: types.ts is NOT in
T1's write-set. If types.ts changes are required, add types.ts to T1's
write-set in the decision journal and proceed.

## Acceptance criteria

- Given a graph with N nodes and E edges, when `agflatten` runs, then each
  node's `flatOut` array contains exactly its outgoing edges.
- Given a flattened graph, when `unflatten` runs, then all flat arrays are
  cleared from the nodes.
- Given a graph with self-loops, when `agflatten` runs, then self-loop edges
  appear in both `flatIn` and `flatOut` of the same node.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Write tests first (TDD). Coverage for fastgr.ts ≥90/90/90.
