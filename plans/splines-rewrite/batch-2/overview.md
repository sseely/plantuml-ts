# Batch 2 — tailStartPoint + S-1

Wire `tailportY` into edge routing so sequence-diagram lifeline arrows connect
at the correct vertical position on node boundaries.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | tailStartPoint; wire into routeShortEdge + routeLongEdgeInCorridor | typescript-pro | splines.ts, splines.test.ts | T1 | [x] |

## What T2 does

1. Add `tailStartPoint(edge, rankDir): Point`  
   — C: `beginpath()` `splines.c:392`  
   — When `edge.tailportY !== undefined`: `portY = cy + tailportY * node.height`;
     return right face for LR, left face for RL, bottom for BT, top for TB  
   — Otherwise: fall back to `ellipseEdgePoint(node, center(edge.to))`
2. Replace the `ellipseEdgePoint(edge.from, ...)` start-point calculation in
   `routeShortEdge` with `tailStartPoint(edge, rankDir)` (gap S-1)
3. Replace the start-point calculation in `routeLongEdgeInCorridor` similarly
4. Add tests for each `rankDir` and for the fallback case

## Note on S-4

`adjustEndpoints` was removed in Mission 1 Batch 1. Nothing to integrate here.

## Commit

```
fix(dot): S-1 tailportY routing via tailStartPoint
```
