# T15 — Edge label placement pass

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Edge labels (relationship labels on
class/component/state diagrams) are currently placed at the geometric
midpoint of the edge polyline. This causes label-on-node collisions
in dense graphs. The fix is a post-coordinate-assignment pass that
places labels along the edge but shifts them away from node bounding
boxes.

This is a new file — no upstream C equivalent (graphviz handles
labels differently via the aux graph in position.c, but plantuml
adds labels post-layout). Design the placement pass to be simple
and correct rather than trying to match graphviz exactly.

## Task

1. Create `src/core/dot/edgelabels.ts` with `placeEdgeLabels(graph)`
2. Place each edge label at the midpoint of its edge polyline
3. If that midpoint falls inside any node bounding box, shift
   along the perpendicular until clear
4. If two edge labels overlap each other, shift the later one
5. Wire into `src/core/dot/index.ts` after `routeEdges` and before
   returning the graph
6. Add `labelX?: number; labelY?: number` to `DotEdge` in types.ts

## Write-set

- `src/core/dot/edgelabels.ts` (new)
- `src/core/dot/index.ts`
- `src/core/dot/types.ts`
- `tests/unit/dot/edgelabels.test.ts` (new)

## Read-set

- `src/core/dot/index.ts`
- `src/core/dot/types.ts`
- `src/core/dot/splines.ts` (understand point format)

## Acceptance Criteria

- Given an edge with a label and coordinates set, when
  `placeEdgeLabels()`, then `edge.labelX` and `edge.labelY`
  are set to a point on or near the edge midpoint
- Given a label midpoint that falls inside a node's bounding box,
  when `placeEdgeLabels()`, then the label is shifted perpendicular
  to the edge until its bounding box clears the node
- Given two edges whose label midpoints overlap, when
  `placeEdgeLabels()`, then their bounding boxes do not intersect
- Given an edge with no label, when `placeEdgeLabels()`, then
  `edge.labelX` and `edge.labelY` remain undefined

## Quality Bar

`npm test` passes. `npm run typecheck` clean. 90/90/90 coverage.
