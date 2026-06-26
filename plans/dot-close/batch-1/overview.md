# Batch 1 — All Remaining Dot Gaps (Parallel)

Three independent tasks writing to different files — run all in parallel.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | M-1 flat_mval + M-3 per-rank crossings + M-4 SINGLETON weight | typescript-pro | mincross.ts, mincross.test.ts | — | [x] |
| T2 | R-4 TB_balance | typescript-pro | rank.ts, rank.test.ts | — | [x] |
| T3 | P-4 ht1/ht2 + P-5 NS x-assignment | typescript-pro | position.ts, position.test.ts | — | [x] |

## Commit messages

```
fix(dot): M-1 flat_mval, M-3 per-rank crossings, M-4 SINGLETON weight
fix(dot): R-4 TB_balance post-NS rank quality
fix(dot): P-4 ht1/ht2 y-spacing, P-5 NS x-assignment
```
