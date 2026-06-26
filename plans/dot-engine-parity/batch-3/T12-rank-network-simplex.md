# T12 — Network simplex rank assignment + rank constraints

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. Rank assignment currently uses a
longest-path forward pass plus a backward normalization pass
(~136 lines). The graphviz C original uses network simplex — a
min-cost flow algorithm on a feasible spanning tree with
enter/leave edge pivots and cut-value maintenance.

Architecture decision D1: implement the full algorithm, not an
approximation.

Porting rules: port rank.c faithfully, preserve function names
(rank1, dot_rank, collapse_rankset, etc.), bug-for-bug compatibility.

## Task

Read `plans/dot-engine-parity/batch-1/T1-rank-findings.md` and
implement the full network simplex rank assignment per rank.c.

1. **Feasible spanning tree construction** — initial spanning tree
   from the DAG; assign initial ranks from the tree
2. **Slack and cut-value computation** — for each tree edge, compute
   slack (rank diff − minLen) and cut-value (sum of non-tree edge
   weights crossing the cut)
3. **Pivot loop** — find negative cut-value tree edge (leave edge);
   find minimum slack non-tree edge crossing the same cut (enter
   edge); swap; update cut-values; repeat until no negative cut-values
4. **Rank normalization** — shift all ranks so minimum is 0
5. **Rank constraints** — same/min/max rank via union-find ranksets
   (collapse_rankset); minmax_edges for constraint enforcement
6. **Virtual node insertion** — preserve existing behavior from
   current rank.ts (edges spanning >1 rank get virtual nodes)
7. **types.ts additions** — add fields needed by network simplex
   (tree edge flag, cut-value, slack) per T1 findings

Replace the current `assignRanks` implementation entirely.
The backward normalization pass is superseded by network simplex
and should be removed.

## Write-set

- `src/core/dot/rank.ts`
- `src/core/dot/types.ts`
- `tests/unit/dot/rank.test.ts`

## Read-set

- `plans/dot-engine-parity/batch-1/T1-rank-findings.md` (primary)
- `src/core/dot/rank.ts`
- `src/core/dot/types.ts`
- `~/git/graphviz/lib/dotgen/rank.c` (reference if findings ambiguous)
- `tests/unit/dot/rank.test.ts`

## Interface Contracts

`assignRanks(graph: DotWorkingGraph): void` — same signature.
All existing tests must pass (network simplex should produce
equivalent or better ranks than longest-path for those cases).

## Acceptance Criteria

- Given a linear chain A→B→C, when `assignRanks()`, then ranks
  are 0, 1, 2 (unchanged from current behavior)
- Given a diamond A→B, A→C, B→D, C→D, when `assignRanks()`,
  then rank(D) − rank(A) = 2 (network simplex must not increase span)
- Given a graph where network simplex reduces total edge span vs
  longest-path, when `assignRanks()`, then total span is minimized
  (the key correctness improvement)
- Given two nodes with a `sameRank` constraint, when `assignRanks()`,
  then both nodes have identical rank
- Given a `minRank`/`maxRank` pair, when `assignRanks()`, then the
  constrained node's rank is within [min, max]
- All existing rank.test.ts tests continue to pass

## Quality Bar

`npm test` passes. `npm run typecheck` clean. The 90/90/90 coverage
thresholds must be met for rank.ts.
