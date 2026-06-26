# Batch 4 — Coordinate Assignment + Wire-Up

Two sequential tasks. T13 builds the coordinate-assignment phase; T14 builds
the top-level entry point and wires the renderer to the new pipeline.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T13 | tile-coordinates.ts — walk tile tree, assign canvas coords, emit flat arrays | typescript-pro | layout/tile-coordinates.ts, layout/swimlane-context.ts, tests | All Batch 3 | [x] |
| T14 | tile-layout.ts entry point + renderer rewire | typescript-pro | layout/tile-layout.ts, src/diagrams/activity/renderer.ts (import only), tests | T13 | [x] |

T13 must complete before T14 starts (T14 imports tile-coordinates.ts).
