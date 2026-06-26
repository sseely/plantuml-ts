# Decision Journal

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-05-03 | T2 (TB_balance) | `earliest = e.from.rank + e.minLen` (not `predMaxRank + 1`) | Edges with `minLen > 1` must constrain feasible rank range; using `+1` alone would place the node in a rank that violates edge length constraints |
| 2026-05-03 | T3 (solveAuxNS) | 4 centering passes chosen | Matched existing `position.test.ts` baselines; fewer passes under-centered, more added no benefit |
