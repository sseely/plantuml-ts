# T13 — mincross.ts: flat edges + BFS build_ranks

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Crossing minimization uses WMEDIAN +
transpose (~205 lines). The C original also handles flat edges
(same-rank connections), uses BFS from sources for rank array
construction, and applies specific virtual node weighting.

Porting rules: port faithfully, preserve function names
(mincross, mincross_step, medians, transpose_step,
flat_breakcycles, flat_reorder, build_ranks), bug-for-bug compat.

## Task

Read `plans/dot-engine-parity/batch-1/T2-mincross-findings.md` and
implement the identified gaps in `src/core/dot/mincross.ts`.

Key additions per findings:
1. **Flat edge detection** — identify edges where from.rank === to.rank
2. **flat_breakcycles** — DFS to detect and break cycles among
   flat edges before ordering
3. **flat_reorder** — adjust node order within ranks to respect
   flat edge direction constraints
4. **BFS build_ranks** — replace topological-sort rank array
   construction with BFS from source nodes per mincross.c
5. **Virtual node weighting** — apply any weighting differences the
   findings identify

## Write-set

- `src/core/dot/mincross.ts`
- `tests/unit/dot/mincross.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T2-mincross-findings.md` (primary)
- `src/core/dot/mincross.ts`
- `src/core/dot/types.ts`
- `~/git/graphviz/lib/dotgen/mincross.c` (if findings ambiguous)
- `tests/unit/dot/mincross.test.ts`

## Acceptance Criteria

- Given two same-rank nodes A and B connected by flat edge A→B,
  when `minimizeCrossings()`, then A.order < B.order (flat edge
  direction respected)
- Given a flat-edge cycle A→B→C→A (all same rank), when
  `minimizeCrossings()`, then it completes without infinite loop
  and produces a valid ordering
- Given a graph where BFS build_ranks differs from topological
  order, when `minimizeCrossings()`, then crossing count ≤ the
  topological-order baseline
- All existing mincross.test.ts tests continue to pass

## Quality Bar

`npm test` passes. `npm run typecheck` clean. 90/90/90 coverage
for mincross.ts.
