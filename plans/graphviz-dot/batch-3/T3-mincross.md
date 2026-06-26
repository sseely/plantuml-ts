# T3 — Crossing Minimization

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript library rendering PlantUML diagrams to SVG.
This task implements the third stage of the Graphviz dot pipeline: ordering
nodes within each rank layer to minimize edge crossings between adjacent
layers. Uses the barycentric heuristic with multiple forward/backward passes.

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

**Reference:** `~/git/plantuml/src/smetana/core/dot15/mincross__c.java` (2,003 lines).
Do NOT port `smetana/core/` C runtime emulation — use native TypeScript.

**Prerequisites:** T1 created `types.ts`. T2 created `rank.ts`. Nodes have
`.rank` set. This task assigns `.order` (position within rank layer).

## Task

Create:
1. **`src/core/dot/mincross.ts`** — implements `minimizeCrossings(graph)`.
2. **`tests/unit/dot/mincross.test.ts`** — unit tests.

Tests must set up working graphs manually (pre-assign `.rank` values) rather
than calling `assignRanks()` — this keeps the unit test isolated.

## Write-set

```
src/core/dot/mincross.ts           (create)
tests/unit/dot/mincross.test.ts    (create)
```

## Read-set

- `src/core/dot/types.ts` — DotWorkingGraph, DotNode (has `.rank`, `.order`)
- `~/git/plantuml/src/smetana/core/dot15/mincross__c.java` — reference impl
- `plans/graphviz-dot/decisions.md` — D3, D4

## Interface Contract

```typescript
export function minimizeCrossings(graph: DotWorkingGraph): void
```

After this call, every node in `graph.nodes` has `node.order >= 0`.
Nodes in the same rank have distinct order values (0, 1, 2, …).
The ordering minimizes edge crossings between adjacent rank layers.

## Algorithm Notes

**Simplification for this phase:** Skip flat edges (same-rank edges) and
cluster subgraphs — these don't appear in basic layered graphs.

1. **Initial ordering**: Assign initial order by DFS post-order from
   nodes with rank=0 (or nodes with no in-edges). This gives a consistent
   starting point before the barycentric passes.

2. **Build rank layers**: Group nodes by rank into `layers: DotNode[][]`
   where `layers[r]` is the ordered list of nodes at rank r.

3. **Forward pass** (r = 0 → maxRank):
   For each node v in layer r, compute barycenter:
   `b(v) = mean of order values of v's predecessors in layer r-1`
   If v has no predecessors, use its current order as barycenter.
   Sort `layers[r]` by barycenter ascending. Re-assign order values.

4. **Backward pass** (r = maxRank → 0):
   Same, but use successor order values in `layer r+1`.

5. **Count crossings**: Between adjacent layers r and r+1. Use the
   merge-sort counting approach (O(e log e)):
   - Sort edges by (source.order, target.order)
   - Count inversions in target.order sequence = crossing count

6. **Iterate**: Repeat forward+backward for up to 24 iterations (or until
   crossing count stops improving). Keep the ordering that produced the
   minimum total crossings.

7. **Write back**: Set `node.order` from the best ordering found.

## Acceptance Criteria

- **Given** A₀→B₁ and A₁→B₀ (1 crossing), **when** `minimizeCrossings()`, **then** result has 0 crossings
- **Given** layer already in optimal order, **when** `minimizeCrossings()`, **then** order values are non-decreasing (no unnecessary shuffle)
- **Given** disconnected nodes in same rank, **when** `minimizeCrossings()`, **then** all receive distinct order values
- **Given** graph where no improvement is possible, **when** `minimizeCrossings()` called twice, **then** produces the same ordering

## TDD Workflow

Write tests BEFORE implementation — strictly red/green:
1. Write `mincross.test.ts` with one `it()` per acceptance criterion — all fail
2. Run `npm test` to confirm they fail (red)
3. Write minimum `mincross.ts` to pass the first test (green)
4. Continue test-by-test until all pass

Set up test graphs manually (pre-assign `.rank` and `.order` values).
Do not call `assignRanks()` from tests — this is a unit test of mincross only.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```
