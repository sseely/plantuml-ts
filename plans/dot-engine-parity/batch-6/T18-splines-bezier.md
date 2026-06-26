# T18 — Splines: Bezier control point fitting

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Sub-task C of the three-part Bezier
spline implementation (D4). T16 built obstacle polygons; T17 routes
polylines through free space. T18 fits cubic Bezier control points
to those polylines and wires the full pipeline into `routeEdges`.

Porting rules: port dotsplines.c faithfully, preserve function
names, bug-for-bug compat.

## Task

Read Section C and D of
`plans/dot-engine-parity/batch-1/T4-splines-findings.md`
and implement Bezier fitting + final pipeline integration in
`src/core/dot/splines.ts`.

Key deliverables per findings:

1. **`fitBezier(polyline)`** — converts a polyline (from T17) into
   a sequence of cubic Bezier control points. For a polyline with
   N waypoints the output is a flat `Point[]` compatible with SVG
   cubic Bezier (`C` command): `[P0, CP1, CP2, P1, CP1, CP2, P2,
   ...]`. Port `completeregularpath` from dotsplines.c.

2. **`adjustEndpoints(points, fromNode, toNode, rankDir)`** — moves
   the first and last control points to lie exactly on the node
   boundary face (not floating near it). Port `adjustregularpath`
   from dotsplines.c. This ensures arrowheads land precisely on
   node borders.

3. **Update `routeEdges`** — replace the current T17 two-point
   assignment with the full pipeline:
   ```
   obstacles = buildObstaclePolygons(graph.nodes)
   spreadPoints = computeSpreadPoints(...)
   per edge:
     polyline = routePolyline(start, end, obstacles)  [or routeFlatEdge]
     bezier   = fitBezier(polyline)
     edge.points = adjustEndpoints(bezier, ...)
   ```

4. **Renderer compatibility** — `edge.points` after T18 is a
   cubic B-spline control point array. The renderer must emit an
   SVG path using these as `M ... C ...` commands. Check whether
   the existing renderer already handles multi-point edges this
   way; if it expects straight-line `L` segments, add a `spline:
   boolean` flag to `DotEdge` so the renderer can choose the
   correct path command.

5. **Self-loop Bezier** — update `routeSelfLoop` to use Bezier
   control points consistent with the new format (the existing
   4-point cubic Bezier is likely already correct; verify it
   matches the control-point convention chosen for step 1).

## Write-set

- `src/core/dot/splines.ts` (Bezier section + full pipeline wiring)
- `src/core/dot/types.ts` (add `spline?: boolean` to `DotEdge`
  if renderer compatibility requires it)
- `tests/unit/dot/splines.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T4-splines-findings.md` (Sections C, D)
- `src/core/dot/splines.ts` (full file — T17 must be merged first)
- `src/core/dot/types.ts`
- `src/diagrams/class/renderer.ts` (how it renders `edge.points`)
- `~/git/graphviz/lib/dotgen/dotsplines.c` (if findings ambiguous;
  focus on `completeregularpath`, `adjustregularpath`)

## Interface Contract

```typescript
// Internal; exported for testing only
export function fitBezier(polyline: Point[]): Point[];

// Internal; exported for testing only
export function adjustEndpoints(
  points: Point[],
  fromNode: DotNode,
  toNode: DotNode,
  rankDir: DotWorkingGraph['rankDir'],
): Point[];
```

The `edge.points` layout after T18:
- Straight/polyline edges with 2 waypoints: remains as-is
- Multi-waypoint edges: cubic Bezier control points in groups of 3
  (CP1, CP2, anchor) following SVG `C` convention, starting from
  `M edge.points[0]`

## Acceptance Criteria

- Given a straight two-point polyline `[A, B]`, when `fitBezier()`,
  then returns `[A, B]` unchanged (degenerate case: no curves needed)
- Given a three-point polyline `[A, M, B]`, when `fitBezier()`,
  then returns 7 points `[A, cp1, cp2, M, cp3, cp4, B]` where
  cp1/cp2 and cp3/cp4 form smooth cubic Bezier segments
- Given Bezier points where the first point is not on the `from`
  node boundary, when `adjustEndpoints()`, then the first point is
  moved to the nearest point on the exit face
- Given Bezier points where the last point is not on the `to` node
  boundary, when `adjustEndpoints()`, then the last point is moved
  to the nearest point on the entry face
- Given a graph where an edge's straight-line path passes through
  an intermediate node, when `routeEdges()` with the full T16+T17+T18
  pipeline, then `edge.points` traces a path that avoids the obstacle
- All existing splines tests continue to pass

## Quality Bar

`npm test` passes. `npm run typecheck` clean. 90/90/90 coverage.
