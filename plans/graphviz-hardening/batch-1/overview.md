# Batch 1 — Small Immediate Fixes

Three independent gaps fixed in a single commit. All are in-place edits;
no new functions except `minmax_edges2`.

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | M-2 + R-3 + S-4 | typescript-pro | mincross.ts, rank.ts, splines.ts, mincross.test.ts, rank.test.ts, splines.test.ts | — | [x] |

## What T1 does

1. **M-2** (`mincross.ts`): Add `flatMatrix` parameter to `sortLayerByMedian`;
   check flat constraints before comparing medians; update 2 call sites.

2. **R-3** (`rank.ts`): Add `minmax_edges2()` private function; call it at
   line 1280 (after `minmax_edges()`, before `rank1()`).

3. **S-4** (`splines.ts`): Delete `adjustEndpoints` function and its export.
   Remove from `splines.test.ts` if tested directly.

## Commit

```
fix(dot): M-2 flat guard, R-3 minmax_edges2, S-4 dead export
```
