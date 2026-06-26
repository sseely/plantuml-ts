# Mission: Close Dot Engine — Final Gaps (Phases E–F + deferred)

## Objective

Close all remaining algorithmic gaps in `src/core/dot/`:

- **M-1** — `flat_mval`: nodes with zero normal-edge neighbors sink incorrectly
- **M-3** — O(E²) crossing count: replace with per-rank O(n·deg) + cache
- **M-4** — SINGLETON weight: `edgeWeight` ignores singleton classification
- **R-4** — `TB_balance`: hub nodes cluster at earliest feasible rank
- **P-4** — ht1/ht2 y-spacing: compute per-rank half-heights explicitly
- **P-5** — NS x-assignment: replace Bellman-Ford `solveAuxRanks` with NS on
  auxiliary constraint graph

## Branch

`feat/dot-passthrough` (current working branch)

## Quality Gates

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

All four must pass after every batch before committing.

**Pre-existing coverage note:** Branch coverage is ~89.9% (just below the 90%
threshold); `npm test` exits 1 even when all tests pass. The gate for tests is:
**all tests pass** (look for `Tests N passed` with 0 failing). Do not fail a
batch solely because the coverage threshold isn't met — but do not make it
worse.

## Constraints

**Stop if:**
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- P-5 NS solver requires adding fields to `types.ts` (contradicts D-5)
- P-5 produces visually worse output — existing `position.test.ts` tests fail
- T3 would require importing NS internals from `rank.ts` at runtime

**Push forward when:**
- Minor lint auto-fixes
- A test helper needs a minor adjustment
- TB_balance (R-4) produces no visible change on current fixtures — expected
- M-4 SINGLETON weight change has no visible effect on current tests — expected
- NS converges in fewer iterations than estimated

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | T1 (M-1+M-3+M-4) ‖ T2 (R-4) ‖ T3 (P-4+P-5) | [x] |

## Links

- [Architecture Decisions](decisions.md)
- [Decision Journal](decision-journal.md)
- [Data Flow Diagram](diagrams/data-flow.md)
- [Component Map](diagrams/component-map.md)
- Gap reference: `planning/dot-layout-deepdive.md` and `planning/graphviz-audit.md`
- C source: `~/git/graphviz/lib/dotgen/mincross.c`, `rank.c`, `position.c`

## Mission Summary

**Completed:** 2026-05-03  
**Tasks completed:** 3/3 (T1, T2, T3)  
**Commits:** 3 (one per task, matching declared write-sets)

### Results

| Task | Gaps | Commit | Tests |
|------|------|--------|-------|
| T1 | M-1 flat_mval, M-3 per-rank crossing cache, M-4 SINGLETON weight | `021c7e6` | Pass |
| T2 | R-4 TB_balance post-NS rank quality | `3a13955` | Pass |
| T3 | P-4 ht1/ht2 y-spacing, P-5 NS x-assignment | `94b227f` | Pass |

**Final test count:** 3294 passed, 0 failing  
**typecheck:** clean  
**lint:** clean  
**build:** clean  
**branch coverage:** 89.99% (pre-existing, 0.01% below threshold — not regressed)

### Notable decisions logged

- T2 (TB_balance): used `e.from.rank + e.minLen` for earliest feasible rank to
  respect minLen constraints (naive `predMaxRank + 1` would have violated edges
  with minLen > 1, e.g., Gansner canonical `A→T minLen=3`)
