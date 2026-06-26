# Mission: splines.ts Long-Edge Routing Rewrite (Phase D)

## Objective

Replace the current Catmull-Rom waypoint approach in `routeLongEdge` with
box-corridor routing (`makeBBoxCorridors` + `routeLongEdgeInCorridor`), then
add tailport exit points (S-1), labeled flat edge routing (S-5), and
multi-edge long fanning (S-6). Only `src/core/dot/splines.ts` is modified.

**Gaps closed:** S-1, S-3, S-5, S-6

## Branch

`feat/dot-passthrough` (current working branch)

## Quality Gates

```sh
npm test && npm run typecheck && npm run lint && npm run build
```

All four must pass after every batch before committing.

**Pre-existing coverage note:** Branch coverage is currently 89.92% (just below
the 90% threshold), causing `npm test` to exit 1 even though all 3240 tests
pass. This is a pre-existing condition from Mission 1 additions to `rank.ts`
and `mincross.ts`. The quality gate for tests is: **all tests pass** (look for
`Tests N passed` with 0 failing). Do not fail a batch solely because the branch
coverage threshold is not met — but do not make it worse.

## Constraints

**Stop if:**
- Any file outside `splines.ts` / `splines.test.ts` needs changes
- Two consecutive quality gate failures on the same check
- A type error would require adding `BoxCorridor` to `types.ts` (contradicts D-1)
- The corridor implementation would require importing from `position.ts` or
  `rank.ts` at runtime

**Push forward when:**
- A test helper needs a minor adjustment to support new test cases
- Corridor midpoint calculation has an off-by-one — use the simpler formula
- `tailportY` is absent on an edge — treat as `0` (vertical midpoint)
- Minor lint auto-fixes (unused imports, trailing whitespace)
- A batch completes with fewer lines than estimated

## Batches

| Batch | Description | Status |
|-------|-------------|--------|
| [Batch 1](batch-1/overview.md) | Box-corridor routing core (S-3) | [x] |
| [Batch 2](batch-2/overview.md) | tailStartPoint + S-1 | [x] |
| [Batch 3](batch-3/overview.md) | Labeled flat (S-5) + fanning (S-6) | [x] |

## Links

- [Architecture Decisions](decisions.md)
- [Decision Journal](decision-journal.md)
- [Data Flow Diagram](diagrams/data-flow.md)
- [Component Map](diagrams/component-map.md)
- Gap reference: `planning/dot-layout-deepdive.md` (S-1, S-3, S-5, S-6)
- C source: `~/git/graphviz/lib/dotgen/dotsplines.c`, `~/git/graphviz/lib/common/routespl.c`

## Mission Summary

**Completed 2026-05-03**

| Item | Result |
|------|--------|
| Tasks completed | 3 / 3 |
| Commits | 3 (one per batch) |
| Decisions | 5 pre-made, 0 flagged for review |
| Tests before | 3240 |
| Tests after | 3257 (+17: +9 T1, +4 T2, +4 T3) |
| Quality gates | All pass (typecheck, lint, build); all 3257 tests pass |

**Gaps closed:** S-1, S-3, S-5, S-6
