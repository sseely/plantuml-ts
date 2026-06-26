# T2 — Network Simplex Ranking + index.ts Stub

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript library rendering PlantUML diagrams to SVG.
This task implements the second stage of the Graphviz dot pipeline: rank
assignment using the network simplex algorithm (Gansner et al. 1993).
Ranks are integer layer numbers (0, 1, 2, …). For every edge u→v,
`rank(v) >= rank(u) + minLen`. The network simplex minimizes total edge
span (sum of rank differences).

**Stack:** TypeScript 5 strict mode, Vitest, ESLint 9. No Jest.

**Reference:** `~/git/plantuml/src/smetana/core/dot15/rank__c.java` (785 lines).
Do NOT port `smetana/core/` C runtime emulation — use native TypeScript.

**Prerequisite:** T1 created `src/core/dot/types.ts` with `DotWorkingGraph`,
`DotNode`, `DotEdge`. Read that file before writing rank.ts.

## Task

1. **`src/core/dot/rank.ts`** — implements `assignRanks(graph)`.
   Mutates `node.rank` for every node. For long edges (rank span > minLen),
   inserts virtual `DotNode` instances and replacement edges into the working
   graph so every edge in the graph spans exactly `minLen` ranks.

2. **`src/core/dot/index.ts`** (stub) — exports a placeholder `layout()`
   that throws `new Error('not yet implemented')`. This makes the module
   importable so later tasks can build on it without breaking typecheck.

3. **`tests/unit/dot/rank.test.ts`** — unit tests for rank.ts.

## Write-set

```
src/core/dot/rank.ts           (create)
src/core/dot/index.ts          (create — stub only)
tests/unit/dot/rank.test.ts    (create)
```

## Read-set

- `src/core/dot/types.ts` — DotWorkingGraph, DotNode, DotEdge
- `~/git/plantuml/src/smetana/core/dot15/rank__c.java` — reference impl
- `plans/graphviz-dot/decisions.md#d4` — TypeScript-native data structures

## Architecture Decisions

- **D2**: Synchronous — no async
- **D3**: Mutates working graph in place; returns void
- **D4**: Object references; `Map<DotNode, number>` for rank/lim/low values rather than parallel arrays
- **D6**: rank.ts is its own module; index.ts is stub only

## Interface Contract

### `src/core/dot/rank.ts`

```typescript
export function assignRanks(graph: DotWorkingGraph): void
```

After this call:
- Every node in `graph.nodes` has `node.rank >= 0`
- For every edge e: `e.to.rank - e.from.rank >= e.minLen`
- For long edges (original span > minLen): `e.virtualNodes` is populated
  with one `DotNode` per intermediate rank; new unit-length edges are
  appended to `graph.edges`; original edge is NOT in `graph.edges`
  (replaced by the chain)
- Minimum rank is 0 (normalized)

### `src/core/dot/index.ts` (stub)

```typescript
import type { DotInputGraph, DotLayoutResult } from './types.js';

export function layout(_input: DotInputGraph): DotLayoutResult {
  throw new Error('dot layout not yet implemented');
}

export type { DotInputGraph, DotInputNode, DotInputEdge,
              DotLayoutResult, DotWorkingGraph, DotNode, DotEdge } from './types.js';
```

## Algorithm Notes (network simplex)

1. **Initial feasible spanning tree**: DFS from source nodes; pick tree
   edges such that `rank(to) - rank(from) = minLen`. Initialize ranks
   along the tree (non-tree edges may violate — that's OK for the start).

2. **Cut values**: For tree edge e=(u,v), cut value = Σ(weights of edges
   crossing cut from head component to tail component) − Σ(reverse).
   Tree edge with cut value < 0 can be replaced to improve objective.

3. **Pivot**: Swap the tree edge with minimum cut value for the non-tree
   edge with minimum "slack" that crosses the cut. Update ranks by the
   slack amount. Recompute cut values.

4. **Normalize**: Shift all ranks so `min(rank) = 0`.

5. **Virtual nodes**: For each remaining edge where
   `to.rank - from.rank > minLen`, insert virtual nodes at each
   intermediate rank. Mark them `virtual: true`. Replace the original
   edge with a chain of unit-length edges in `graph.edges`.

The `rank__c.java` implementation uses `ND_lim` and `ND_low` arrays for
efficient subtree detection during cut value updates. Port these as
`node.lim: number` and `node.low: number` working properties (add them
to DotNode or use a `Map<DotNode, {lim:number, low:number}>`).

## Acceptance Criteria

- **Given** linear A→B→C (minLen=1), **when** `assignRanks()`, **then** `rank(A)=0, rank(B)=1, rank(C)=2`
- **Given** two paths to same sink (A→C, B→C), **when** `assignRanks()`, **then** `rank(C) > rank(A)` and `rank(C) > rank(B)`
- **Given** edge with `minLen=2`, **when** `assignRanks()`, **then** `rank(to) - rank(from) >= 2`
- **Given** diamond A→B, A→C, B→D, C→D, **when** `assignRanks()`, **then** `rank(D) - rank(A) = 2` (optimal)
- **Given** long edge span > minLen, **when** `assignRanks()`, **then** 1 virtual node per intermediate rank in `e.virtualNodes`
- **Given** empty graph, **when** `assignRanks()`, **then** no error, no nodes to rank

## TDD Workflow

Write tests BEFORE implementation — strictly red/green:
1. Write `rank.test.ts` with one `it()` per acceptance criterion — all fail
2. Run `npm test` to confirm they fail (red)
3. Write minimum `rank.ts` to make the first failing test pass (green)
4. Run `npm test` — that test passes, rest still fail
5. Continue test-by-test until all pass
6. Write `index.ts` stub last — it has no logic to test (throws not-implemented)

Do not write implementation code that isn't driven by a failing test.

## Quality Bar

```
npm test && npm run typecheck && npm run lint
```

Pre-existing 993+ tests must still pass.
