# Batch 6 — Spline Routing + Bezier Fitting

Two sequential tasks. T17 must complete before T18 starts — T18
consumes T17's `routePolyline` function and owns the final
integration into `routeEdges`.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T17 | Splines: free-space channel routing | typescript-pro | splines.ts (routing section) | T16 | [x] |
| T18 | Splines: Bezier control point fitting | typescript-pro | splines.ts (bezier + integration) | T17 | [x] |

Both tasks write `splines.ts`. Run T17, then T18.
