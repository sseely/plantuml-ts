# Phase 2 — Crossing Minimization + Brandes-Köpf Coordinate Assignment

## Goal

Implement stages 3 and 4 of the pipeline. By the end of Phase 2, every
node has both a rank (from Phase 1) and x/y pixel coordinates. Tests
verify that node bounding boxes don't overlap and that edge crossings
are reduced by crossing minimization relative to a naive sort.

## Write-set

```
src/core/dot/mincross.ts     — crossing minimization (create)
src/core/dot/position.ts     — Brandes-Köpf coord assignment (create)
tests/unit/dot/mincross.test.ts  — (create)
tests/unit/dot/position.test.ts  — (create)
```

## Read-set

- `~/git/plantuml/src/smetana/core/dot15/mincross__c.java`
- `~/git/plantuml/src/smetana/core/dot15/position__c.java`
- `src/core/dot/types.ts` — DotWorkingGraph, DotNode, DotEdge
- `src/core/dot/rank.ts` — rank assignment output (nodes have `.rank`)
- `planning/graphviz/algorithm.md` — stage 3 and 4 descriptions
- `planning/graphviz/decisions.md` — D3, D4

## Architecture Decisions (relevant)

- **D3**: Mutable working graph — mutate `node.order`, `node.x`, `node.y`
- **D4**: No C-style integer ID arrays; use object references and Maps

## Interface Contracts

### `src/core/dot/mincross.ts`

```typescript
export function minimizeCrossings(graph: DotWorkingGraph): void;
// Mutates node.order for every non-virtual node in graph.nodes.
// Also sets order for virtual nodes in long-edge chains.
// graph.nodes must already have .rank set (Phase 1).
```

### `src/core/dot/position.ts`

```typescript
export function assignCoordinates(graph: DotWorkingGraph): void;
// Mutates node.x and node.y for every node in graph.nodes.
// graph.nodes must already have .rank (Phase 1) and .order (Phase 2a).
// Applies rankDir: TB places ranks top-to-bottom; LR left-to-right.
```

Both functions mutate in place (D3). They do not return values.

## Acceptance Criteria

### Crossing minimization

- **Given** two parallel edges A₀→B₁ and A₁→B₀ (one crossing),
  **when** `minimizeCrossings()`, **then** result has 0 crossings
  (nodes reordered so A₀→B₀, A₁→B₁).
- **Given** a layer with 3 nodes already in optimal order,
  **when** `minimizeCrossings()`, **then** `node.order` values are
  non-decreasing (no unnecessary shuffle).
- **Given** disconnected nodes in the same rank,
  **when** `minimizeCrossings()`, **then** they still receive distinct
  `order` values.
- **Given** a graph where barycentric sort can't reduce crossings further,
  **when** `minimizeCrossings()` with multiple passes, **then** it
  converges (returns same ordering on consecutive passes).

### Coordinate assignment

- **Given** two nodes in the same rank, **when** `assignCoordinates()`,
  **then** their bounding boxes do not overlap (x separation ≥ nodeSep).
- **Given** two nodes in adjacent ranks (TB direction), **when**
  `assignCoordinates()`, **then** y values differ by at least
  `max(height) + rankSep`.
- **Given** a single node, **when** `assignCoordinates()`,
  **then** `node.x ≥ 0` and `node.y ≥ 0`.
- **Given** `rankDir = 'LR'`, **when** `assignCoordinates()`,
  **then** higher-rank nodes have strictly greater x values (not y).
- **Given** `rankDir = 'TB'`, **when** `assignCoordinates()`,
  **then** higher-rank nodes have strictly greater y values.
- **Given** four nodes arranged in a diamond (ranks 0, 1, 1, 2),
  **when** `assignCoordinates()`, **then** the two rank-1 nodes have
  different x values and neither overlaps the rank-0 or rank-2 node.

## Quality Bar

- `npm test` — all tests pass
- `npm run typecheck` — zero errors
- `npm run lint` — zero errors
- 90%+ line and branch coverage for mincross.ts and position.ts

## Implementation Notes

### Mincross — barycentric heuristic

Reference: `mincross__c.java` (2,003 lines). Key sections:

1. **Initial ordering**: Order nodes within each rank by DFS post-order
   from root nodes (nodes with rank 0 or with no in-edges).

2. **Forward pass** (rank 0 → max rank):
   For each node in rank r, compute barycenter:
   `b(v) = mean of order values of v's predecessors in rank r-1`
   Sort rank r nodes by barycenter. Ties broken by current order.

3. **Backward pass** (rank max → 0):
   Same but using successor order values in rank r+1.

4. **Count crossings**: Between rank r and r+1, count pairs of edges
   that cross (O(e log e) algorithm using merge sort). Keep best ordering.

5. Repeat forward+backward for a fixed number of iterations (Smetana
   uses 24 by default). Return the ordering with minimum total crossings.

**Simplification:** Smetana handles flat edges (same rank) and cluster
subgraphs. For Phase 2, skip flat edges (no same-rank edges in dot
layered graphs by default) and ignore clusters until Phase 4.

### Brandes-Köpf coordinate assignment

Reference: `position__c.java` (1,954 lines). The algorithm has 4 sub-passes:

#### Sub-pass structure (for TB direction)

1. **Mark type-1 conflicts**: A type-1 conflict is a non-inner segment
   that crosses an inner segment. Inner segments connect virtual nodes
   in long-edge chains. Mark conflicted edges so they're not used as
   alignment roots.

2. **Four alignments**: For each of (top, bottom) × (left, right):
   - **Vertical alignment**: Build a "block" structure. Each block has a
     root node. Within a block, nodes are stacked vertically aligned.
   - **Horizontal compaction**: For each block, assign x so that the
     block is as far left (or right) as possible given `nodeSep`.

3. **Balance**: The final x for each node is the median of its x values
   across the four alignments. This cancels out the asymmetric bias of
   any single alignment direction.

4. **Shift to x≥0**: Translate all x values so the minimum is 0.

**y-coordinate assignment** (simpler):
`node.y = node.rank × (maxNodeHeightInRank + rankSep)`

where `maxNodeHeightInRank` is the tallest node in that rank layer.
Accumulate y offsets per rank to handle variable-height nodes.

**LR direction**: Swap x and y assignments throughout.
