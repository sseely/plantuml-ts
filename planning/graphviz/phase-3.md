# Phase 3 — Bezier Spline Edge Routing

## Goal

Implement stage 5 of the pipeline: route each edge as a smooth Bezier
spline. Short edges get straight or single-bend paths. Long edges (those
with virtual node chains from Phase 1) are routed through the virtual node
positions and fitted with a smooth cubic Bezier. Self-loops get a circular
arc.

By the end of Phase 3, `layout()` is a complete function: given a graph
with node sizes, it returns pixel coordinates for all nodes and point
lists for all edges.

## Write-set

```
src/core/dot/splines.ts      — edge routing (create)
src/core/dot/index.ts        — wire all stages into layout() entry point (update)
tests/unit/dot/splines.test.ts   — (create)
tests/unit/dot/layout.test.ts    — end-to-end layout() tests (create)
```

## Read-set

- `~/git/plantuml/src/smetana/core/dot15/dotsplines__c.java`
- `src/core/dot/types.ts`
- `src/core/dot/acyclic.ts`, `rank.ts`, `mincross.ts`, `position.ts`
- `planning/graphviz/algorithm.md` — stage 5 description

## Interface Contracts

### `src/core/dot/splines.ts`

```typescript
export function routeEdges(graph: DotWorkingGraph): void;
// Mutates edge.points for every edge in graph.edges.
// graph.nodes must have .x, .y (Phase 2) set.
// For reversed edges, points are reversed so arrowhead points correctly.
// Virtual nodes and edges are consumed; not exposed in output.
```

### `src/core/dot/index.ts`

```typescript
export function layout(input: DotInputGraph): DotLayoutResult;
// Composes all five stages:
//   buildWorkingGraph(input)
//   → removeAcyclic(wg)
//   → assignRanks(wg)
//   → minimizeCrossings(wg)
//   → assignCoordinates(wg)
//   → routeEdges(wg)
//   → extractResult(wg)
// Returns DotLayoutResult with only original (non-virtual) nodes/edges.
```

## Acceptance Criteria

### Splines stage

- **Given** a simple A→B edge (adjacent ranks), **when** `routeEdges()`,
  **then** `edge.points` has at least 2 points (start and end).
- **Given** a simple A→B edge, **when** `routeEdges()`, **then** start
  point lies on A's bounding box border and end point lies on B's
  bounding box border (within ±1px tolerance).
- **Given** a long edge A→(virtual)→B, **when** `routeEdges()`, **then**
  the path passes through the virtual node's position and is smooth
  (no sharp right-angle bends).
- **Given** a reversed edge (marked by acyclic stage), **when**
  `routeEdges()`, **then** the output `edge.points` run from `edge.from`
  to `edge.to` in the original direction (arrowhead is correct).
- **Given** a self-loop A→A, **when** `routeEdges()`, **then**
  `edge.points` forms a curve that starts and ends on node A's boundary.

### End-to-end `layout()`

- **Given** a linear graph A→B→C, **when** `layout()`, **then**
  result has 3 nodes and 2 edges with non-empty points.
- **Given** a graph with no nodes, **when** `layout()`, **then**
  result is `{ nodes:[], edges:[], width:0, height:0 }`.
- **Given** a single node, **when** `layout()`, **then**
  result has 1 node at `x≥0, y≥0` and 0 edges.
- **Given** two nodes with an edge, **when** `layout()`, **then**
  `result.width > 0` and `result.height > 0`.
- **Given** `rankDir='LR'`, **when** `layout()` on A→B→C, **then**
  B.x > A.x and C.x > B.x (left-to-right ordering).
- **Given** a diamond graph, **when** `layout()`, **then** all 4
  node bounding boxes are non-overlapping.
- **Given** a graph with a reversed edge, **when** `layout()`,
  **then** output edge IDs match input edge IDs (virtual nodes filtered out).

## Quality Bar

- `npm test` — all tests pass
- `npm run typecheck` — zero errors
- `npm run lint` — zero errors
- 90%+ line and branch coverage for splines.ts and index.ts

## Implementation Notes

### Short edge routing (adjacent ranks)

For edge u→v where `rank(v) = rank(u) + 1`:
- Start point: center-bottom of u's bounding box (TB direction)
- End point: center-top of v's bounding box
- If start and end are close to collinear: straight line
- Otherwise: a single quadratic Bezier with control point at the midpoint

### Long edge routing (via virtual nodes)

For edge u→v where `rank(v) - rank(u) > 1`:
Phase 1 inserted virtual nodes `vn1, vn2, ...` and replacement edges
`u→vn1→vn2→...→v`. After position assignment, these virtual nodes have
(x, y) coordinates.

Routing:
1. Collect the point list: `[exitPoint(u), vn1.center, vn2.center, ..., entryPoint(v)]`
2. Fit a smooth cubic Bezier through these points using the "smooth
   polyline" technique (same as the current use case renderer's
   `buildEdgePath` for multi-point paths):
   - Each intermediate point becomes a quadratic bezier control point
   - Actual curve passes through midpoints between consecutive control points

### Self-loop routing

For edge u→u:
- Emit a circular arc that exits the right side of u and re-enters the
  top, giving a clockwise loop visible to the right of the node.
- Approximate with a cubic Bezier: two control points offset to the
  upper-right of the node center.

### Exit/entry points on node boundary

For TB direction:
- Exit point (source node): `(node.x + node.width/2, node.y + node.height)`
- Entry point (target node): `(node.x + node.width/2, node.y)`

For LR direction: use right/left midpoints instead.

### Extracting the final result

After routing, `extractResult(wg)` builds `DotLayoutResult`:
- Include only non-virtual nodes
- Include only non-virtual edges (original edges, using their original IDs)
- For reversed edges: edge.points already corrected by routeEdges
- Total width = max(node.x + node.width) + margin
- Total height = max(node.y + node.height) + margin
- Default margin: 12px (matches ELK's padding behavior)
