# Batch 4 — Mincross + Position

Two tasks that can run in parallel after Batch 3. Both depend on
the types.ts changes from T12 but do not conflict with each other.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T13 | mincross.ts — flat edges + BFS build_ranks | typescript-pro | mincross.ts, mincross.test.ts | T2, T12 | [x] |
| T14 | position.ts — auxiliary-graph x-coords | typescript-pro | position.ts, position.test.ts | T3, T12 | [x] |

No write-set conflicts. Launch both simultaneously after T12 lands.
