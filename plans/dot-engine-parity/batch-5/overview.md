# Batch 5 — Edge Labels + Spline Obstacle Polygons

Two tasks that run in parallel after Batch 4. No write-set conflicts.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T15 | Edge label placement pass | typescript-pro | edgelabels.ts, index.ts, types.ts, edgelabels.test.ts | T14 | [x] |
| T16 | Splines: obstacle polygon construction | typescript-pro | splines.ts (polygon section), splines.test.ts | T4, T14 | [x] |

T15 creates a new file; T16 modifies splines.ts. No conflicts.
Launch both after T14 is committed.
