# Batch 2 — BFS Initial Ordering (M-5)

Adds BFS-seeded passes 0 and 1 before the iterative mincross loop.
Depends on Batch 1 (T1) because T1 adds the `flatMatrix` parameter
that pass 0 and 1 must thread through.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | M-5 BFS passes 0+1 | typescript-pro | mincross.ts, mincross.test.ts | T1 | [ ] |

## What T2 does

Inserts before the `for (let iter = 0; iter < MAX_ITER; iter++)` loop
in `minimizeCrossings` (`mincross.ts:375`):

- **Pass 0**: BFS from source nodes (those at `minRank`), assign layer
  orders top-down using average position of neighbors in the layer above.
- **Pass 1**: BFS from sink nodes (those at `maxRank`), assign layer
  orders bottom-up.
- After each pass, call `flat_reorder(layers, flatMatrix)`.
- Snapshot `bestCrossings` and `bestSnapshot` after both passes.

C reference: `mincross.c:1762–1830`.

## Commit

```
fix(dot): M-5 BFS-seeded initial ordering in mincross
```
