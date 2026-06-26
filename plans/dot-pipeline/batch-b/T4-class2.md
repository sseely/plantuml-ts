# T4 — class2.ts

## Context

plantuml-js is a TypeScript port of PlantUML. This task ports `class2.c`,
the most important missing piece. class2 creates virtual node chains for
long edges (rank span > 1) and virtual label nodes for labeled edges.
Currently rank.ts has an inline approximation of this that must later be
removed (T5). T4 builds the correct replacement.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port `~/git/graphviz/lib/dotgen/class2.c` to `src/core/dot/class2.ts`.

The file's purpose:
1. `make_chain(g, orig_edge)` — for a long edge (from.rank → to.rank, span > 1),
   insert N−1 virtual nodes at each intermediate rank and replace the original
   edge with a chain of N unit-length edges through them.
2. `label_vnode(g, edge)` — for an edge with a label, create a special virtual
   node at the midpoint rank with `width = graph.nodeSep + edge.labelWidth` and
   `height = edge.labelHeight`. This node participates in layout and is later
   read by `extractResult` in index.ts to position the label.
3. `class2(g)` — iterate over all edges; call make_chain for span>1, then
   label_vnode for labeled edges.

**Critical:** After class2, the original long edge is removed from
`graph.edges` and moved to `graph.longEdges`. The chain edges (unit-length
segments) replace it in `graph.edges`. The virtual chain nodes are added to
`graph.nodes`.

## Write-set

- `src/core/dot/class2.ts` (create)
- `tests/unit/dot/class2.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/dotgen/class2.c` — authoritative
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/dotgen/class2.java`
- `src/core/dot/types.ts` — DotEdge (labelNode, virtualNodes fields already present)
- `src/core/dot/rank.ts:1367-1407` — inline virtual chain code this will replace;
  read it to understand the current approach and ensure class2.ts is a superset

## Interface contracts

Export:
```typescript
export function class2(graph: DotWorkingGraph): void;
```

Post-conditions:
- All edges with `(to.rank - from.rank) > 1` have been moved to `longEdges`
  and replaced by chains in `edges`
- Labeled edges have a `labelNode: DotNode` set (virtual, added to `graph.nodes`)
- All virtual nodes have `virtual: true`

## Acceptance criteria

- Given an edge A→C where A.rank=0, C.rank=2, when `class2` runs, then the
  original edge is in `longEdges` and two unit-length edges A→B, B→C exist
  in `edges` with B virtual and B.rank=1.
- Given a labeled edge A→B, when `class2` runs, then `edge.labelNode` is set,
  `edge.labelNode.virtual = true`, and `edge.labelNode.width ≥ edge.labelWidth`.
- Given an edge of rank span 1 with no label, when `class2` runs, then the
  edge remains in `graph.edges` unchanged and no virtual nodes are added.
- Given a labeled long edge (span > 1), when `class2` runs, then both the
  virtual chain AND the label node are created.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
Write tests first (TDD). Coverage for class2.ts ≥90/90/90.
