# T17 — Splines: free-space channel routing

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Sub-task B of the three-part Bezier
spline implementation (D4). T16 built `ObstaclePolygon[]` and
`buildObstaclePolygons`. T17 routes edges through free space around
those polygons. T18 (next) will fit Bezier curves to the resulting
polylines.

Porting rules: port dotsplines.c faithfully, preserve function
names, bug-for-bug compat.

## Task

Read Section B of `plans/dot-engine-parity/batch-1/T4-splines-findings.md`
and implement free-space edge routing in `src/core/dot/splines.ts`.

Key deliverables per findings:

1. **`routePolyline(start, end, obstacles)`** — finds a polyline
   path from `start` to `end` that does not pass through any
   obstacle polygon. Returns `Point[]` (2+ points, start and end
   included). If no obstacles block the direct segment, returns
   `[start, end]`.

2. **Visibility graph construction** — build a graph of "corner"
   vertices (obstacle polygon corners inflated by a clearance
   margin) plus the start/end points; edges connect pairs that have
   clear line-of-sight.

3. **Shortest-path through visibility graph** — BFS or Dijkstra
   on the visibility graph to find the minimum-turn path from
   start to end.

4. **`routeFlatEdge(edge, obstacles, rankDir)`** — routes flat
   edges (same-rank source and target, `edge.from.rank ===
   edge.to.rank`). Flat edges curve "around" both nodes by adding
   two waypoints above (TB/BT) or to the side (LR/RL) of the
   nodes, then routing through free space. Port `make_flat_edge`
   from dotsplines.c.

5. Update `routeEdges` to call `routePolyline` (or `routeFlatEdge`)
   for each real edge, replacing the current two-point `[start,
   end]` assignment. The polyline waypoints become the input to
   T18's Bezier fitter. Until T18 lands, store them directly in
   `edge.points`.

6. Do NOT implement Bezier fitting — that is T18. T17's output is
   a polyline (straight-line segments).

## Write-set

- `src/core/dot/splines.ts` (add routing section; keep obstacle
  polygons from T16; keep spread points from computeSpreadPoints)
- `tests/unit/dot/splines.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T4-splines-findings.md` (Section B)
- `src/core/dot/splines.ts` (full file — T16 must be merged first)
- `src/core/dot/types.ts`
- `~/git/graphviz/lib/dotgen/dotsplines.c` (if findings ambiguous;
  focus on `make_regular_edge`, `make_flat_edge`, visibility graph
  helpers)

## Interface Contract (consumed by T18)

```typescript
// Exported for T18 to call before Bezier fitting
export function routePolyline(
  start: Point,
  end: Point,
  obstacles: ObstaclePolygon[],
): Point[];

// Used internally; exported for testing
export function routeFlatEdge(
  edge: DotEdge,
  obstacles: ObstaclePolygon[],
  rankDir: DotWorkingGraph['rankDir'],
): Point[];
```

`Point` is `{ x: number; y: number }` (already defined locally in
splines.ts — do not re-export it).

## Acceptance Criteria

- Given start and end with no obstacles between them, when
  `routePolyline()`, then returns exactly `[start, end]`
- Given start and end with one obstacle polygon directly on the
  straight-line path, when `routePolyline()`, then the returned
  polyline does not intersect the obstacle
- Given a flat edge (from.rank === to.rank) between two adjacent
  nodes, when `routeFlatEdge()`, then the returned polyline bends
  around both nodes without passing through either
- Given a flat edge where `to` is to the left of `from` (reversed
  flat), when `routeFlatEdge()`, then the route bends correctly
  for the direction
- Existing routing behavior passes: `npm test` with all prior
  splines tests still green

## Quality Bar

`npm test` passes. `npm run typecheck` clean.
