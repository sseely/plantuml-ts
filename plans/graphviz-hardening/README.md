# Mission: Graphviz Layout Engine Hardening (Phases A–C)

## Objective

Apply three algorithm gaps in `src/core/dot/` that are individually small,
independently safe, and improve layout correctness for real diagrams:

- **M-2** — flat-constraint guard in `sortLayerByMedian` (mincross.ts)
- **R-3** — `minmax_edges2` for min/max rank sets (rank.ts)
- **S-4** — remove dead `adjustEndpoints` export (splines.ts)
- **M-5** — BFS-seeded passes 0+1 before the iterative mincross loop
- **M-6** — weakly-connected-component decomposition in mincross

## Branch

`feat/dot-passthrough` (current working branch)

## Quality Gates

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

All four must pass after every batch before committing.

## Constraints

**Stop if:**
- Any file outside the declared write-set needs changes
- Two consecutive quality gate failures on the same check
- A type error in `types.ts` would require changing public signatures
- An implementation contradicts a pre-made architecture decision

**Push forward when:**
- A test helper needs a minor adjustment to support new test cases
- BFS tie-breaking is ambiguous — use stable sort (preserve existing order)
- Minor lint auto-fixes (unused imports, trailing whitespace)
- A batch completes with fewer lines than estimated

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | M-2 + R-3 + S-4 (small fixes) | [x] |
| [Batch 2](batch-2/overview.md) | M-5 BFS initial ordering | [x] |
| [Batch 3](batch-3/overview.md) | M-6 component decomposition | [x] |

## Links

- [Architecture Decisions](decisions.md)
- [Decision Journal](decision-journal.md)
- [Data Flow Diagram](diagrams/data-flow.md)
- [Component Map](diagrams/component-map.md)
- Source audit: `planning/graphviz-audit.md`
- Gap reference: `planning/dot-layout-deepdive.md`

## Mission Summary

**Completed 2026-05-03**

| Item | Result |
|------|--------|
| Tasks completed | 3 / 3 |
| Commits | 3 (one per batch) |
| Decisions | 4 pre-made, 0 flagged for review |
| Tests before | 3239 |
| Tests after | 3240 (+1 net: −11 dead adjustEndpoints tests, +5 M-2/R-3 tests, +7 M-5/M-6 tests) |
| Quality gates | All pass (test, typecheck, lint, build) |

**Gaps closed:** M-2, R-3, S-4, M-5, M-6
