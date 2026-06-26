# Decision Journal

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-05-03 | T6 | class2 not added to mincross.ts — will be called from index.ts (T7) per D1. | D1 specifies class2 runs between assignRanks and minimizeCrossings in index.ts. Adding it inside minimizeCrossings would couple two pipeline stages incorrectly and prevent index.ts from controlling the call site. |
| 2026-05-03 | F-B visual QA | numeric-node-ids collinear long-edge routing logged as known issue; mission continues. | Long edge 1→3 is rendered (3 arrow markers confirmed) but routes through same x-column as 1→2 and 2→3, making it visually hidden. This is a pre-existing position.ts regression not introduced by T18/T19 (T18 only modified routeShortEdge; T19 added xlabel wiring only). Not a new Tier 1 stop condition for F-B. |
