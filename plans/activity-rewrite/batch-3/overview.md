# Batch 3 — Composite Tiles

Four parallel tasks. All depend on Batch 2 (routing classes + leaf tiles)
being complete. No two tasks write the same file.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T9 | GtileTopDown (sequence) + GtileIf | typescript-pro | tiles/gtile-top-down.ts, tiles/gtile-if.ts, tests | T2, T6, T7, T8 | [x] |
| T10 | GtileWhile + GtileRepeat | typescript-pro | tiles/gtile-while.ts, tiles/gtile-repeat.ts, tests | T2, T5, T6, T7, T8 | [x] |
| T11 | GtileFork + GtileSplit | typescript-pro | tiles/gtile-fork.ts, tiles/gtile-split.ts, tests | T2, T4, T5, T6, T7, T8 | [x] |
| T12 | GtileSwitch + GtileGroup + GtilePartition | typescript-pro | tiles/gtile-switch.ts, tiles/gtile-group.ts, tiles/gtile-partition.ts, tests | T2, T6, T7, T8 | [x] |

All four can run in parallel once Batch 2 is complete.
T9, T10, T11, T12 write disjoint tile files.
