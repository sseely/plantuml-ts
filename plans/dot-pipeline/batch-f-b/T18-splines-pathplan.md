# T18 — splines pathplan integration

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. The existing
`splines.ts` routes edges but does not use pathplan for obstacle avoidance.
This task wires the pathplan library (T14) and routespl (T15) into splines.ts
so edges route around node bounding boxes using the authentic Graphviz approach.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Update `src/core/dot/splines.ts`:

1. Import `routesplines` from `../pathplan/index.js` (T14) and `routesplines`
   converter from `../common/routespl.js` (T15).

2. Build the obstacle map: for each node in the graph, compute its bounding
   polygon using `nodeboundingbox` (from T15's shapes.ts) and add it to the
   visibility graph.

3. For each edge, call pathplan's routing to find a path around obstacles,
   then convert to B-spline control points via routespl.

4. Fall back to the existing straight-line or box-corridor routing if pathplan
   returns no path (e.g., for very short edges or self-loops).

Read `~/git/graphviz/lib/dotgen/dotsplines.c` to understand how Graphviz
wires these together.

## Write-set

- `src/core/dot/splines.ts` (modify)

## Read-set

- `src/core/dot/splines.ts` — current routing implementation
- `src/core/pathplan/index.ts` — T14 output
- `src/core/common/routespl.ts` — T15 output
- `src/core/common/shapes.ts` — T15 output
- `~/git/graphviz/lib/dotgen/dotsplines.c` — authoritative wiring reference

## Acceptance criteria

- Given a graph where a direct edge would pass through an intermediate node,
  when the pipeline runs after T18, then the edge routes around the node.
- Given a self-loop edge, when the pipeline runs, then the self-loop is not
  rerouted (falls back to existing self-loop logic).
- Given a graph with no intermediate obstacles, when the pipeline runs, then
  edges are straight or nearly straight (no unnecessary curves introduced).
- All existing spline routing tests still pass.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
