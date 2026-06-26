# Batch 1 — Rename + Tile Base Infrastructure + Skinparam

Three independent tasks. T2 and T3 have no dependencies. T1 is also
independent but its output (renamed import paths) must land before Batch 2
agents start reading activity source files.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Rename layout.ts → layout.old.ts, update imports | typescript-pro | layout.old.ts, index.ts | — | [x] |
| T2 | Build tile base: Tile interface, TileLeaf, TileComposite, GPoint, hooks | typescript-pro | tiles/tile.ts, tiles/points.ts, tiles/index.ts, tests | — | [x] |
| T3 | Extend skinparam with activity-specific keys (add only) | typescript-pro | src/core/skinparam.ts, tests | — | [x] |

All three can run in parallel.
