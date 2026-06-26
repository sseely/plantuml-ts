# Batch 2 — Routing Classes + Leaf Tiles

Five parallel tasks. All depend on T2 (tile base infrastructure) being complete.
No two tasks write the same file.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | GConnection interface + simple routing (VerticalDown, Horizontal) | typescript-pro | routing/gconnection.ts, routing/gconnection-vertical-down.ts, routing/gconnection-horizontal.ts, routing/index.ts, tests | T2 | [x] |
| T5 | Loop routing (VerticalDownThenBack, DownThenUp, SideThenVerticalThenSide) | typescript-pro | routing/gconnection-vertical-down-then-back.ts, routing/gconnection-down-then-up.ts, routing/gconnection-side-then-vertical-then-side.ts, tests | T2 | [x] |
| T6 | Simple leaf tiles (GtileStart, GtileStop, GtileEnd, GtileBreak, GtileKill) | typescript-pro | tiles/gtile-start.ts, tiles/gtile-stop.ts, tiles/gtile-end.ts, tiles/gtile-break.ts, tiles/gtile-kill.ts, tests | T2 | [x] |
| T7 | Text leaf tiles pt1 (GtileAction, GtileNote) | typescript-pro | tiles/gtile-action.ts, tiles/gtile-note.ts, tests | T2 | [x] |
| T8 | Text leaf tiles pt2 (GtileDiamond, GtileSpot, GtileLabel) | typescript-pro | tiles/gtile-diamond.ts, tiles/gtile-spot.ts, tiles/gtile-label.ts, tests | T2 | [x] |

All five can run in parallel once T2 is complete.
T4 and T5 write different routing files and can run in parallel with each other.
T6, T7, T8 write different tile files and can run in parallel with each other and with T4/T5.
