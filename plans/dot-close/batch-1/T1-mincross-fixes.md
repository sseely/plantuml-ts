# T1 — M-1 flat_mval + M-3 per-rank crossings + M-4 SINGLETON weight

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Working directory: /Users/scottseely/git/plantuml-js
Stack: TypeScript, vitest. Commit style: Conventional Commits.

Three correctness/performance gaps remain in `src/core/dot/mincross.ts`.
Read that file in full before changing anything — it is 549 lines.

## Task

### M-1 — `flat_mval` for zero-normal-edge nodes

**C source:** `mincross.c:1589–1617` — `flat_mval()`, called when
`ND_out(n).size == 0 && ND_in(n).size == 0`.

**Problem:** nodes with no cross-rank edges get `wmedian = -1` and sink to
the end of their rank layer. When such a node has flat-edge (same-rank) neighbors,
a better position can be derived from them.

**Fix:** Add a private `flatMval` helper and wire it into `sortLayerByMedian`:

```typescript
// C: flat_mval() mincross.c:1589-1617
function flatMval(node: DotNode, layer: DotNode[], flatMatrix: FlatMatrix): number {
  const rankConstraints = flatMatrix.get(node.rank);
  if (!rankConstraints) return -1;
  const flatInOrders: number[] = [];
  const flatOutOrders: number[] = [];
  for (const other of layer) {
    if (other.id === node.id) continue;
    if (rankConstraints.get(other.id)?.has(node.id)) flatInOrders.push(other.order);
    if (rankConstraints.get(node.id)?.has(other.id)) flatOutOrders.push(other.order);
  }
  if (flatInOrders.length > 0) return Math.max(...flatInOrders) + 1;
  if (flatOutOrders.length > 0) return Math.min(...flatOutOrders) - 1;
  return -1;
}
```

In `sortLayerByMedian`, change the median computation from:
```typescript
const ma = wmedian(neighborMap.get(a.id) ?? []);
const mb = wmedian(neighborMap.get(b.id) ?? []);
```
to:
```typescript
let ma = wmedian(neighborMap.get(a.id) ?? []);
if (ma === -1 && flatMatrix) ma = flatMval(a, layer, flatMatrix);
let mb = wmedian(neighborMap.get(b.id) ?? []);
if (mb === -1 && flatMatrix) mb = flatMval(b, layer, flatMatrix);
```

No call-site changes needed — `flatMatrix` already flows into `sortLayerByMedian`.

---

### M-3 — per-rank O(n·deg) crossing count with cache

**C source:** `mincross.c:1512–1549` — `rcross()` + `ncross()` with
`rankValid[]` cache.

**Problem:** `countCrossings(edges)` is O(E²) global. `transpose()` calls it
before and after every candidate swap, making the total O(swaps × E²).

**Fix:**

1. Add per-rank crossing function:
```typescript
// C: rcross() mincross.c:1512-1549
function countCrossingsForRank(
  topLayer: DotNode[],
  bottomLayer: DotNode[],
  edges: DotEdge[],
  topRank: number,
): number {
  const n = bottomLayer.length + 1;
  const cnt = new Int32Array(n);
  let crossings = 0;
  const bottomOrder = new Map<string, number>();
  for (const node of bottomLayer) bottomOrder.set(node.id, node.order);
  const topSorted = topLayer.slice().sort((a, b) => a.order - b.order);
  for (const top of topSorted) {
    const edgesFromTop = edges.filter(
      (e) => e.from === top && e.to.rank === topRank + 1,
    );
    for (const edge of edgesFromTop) {
      const ord = bottomOrder.get(edge.to.id) ?? 0;
      for (let k = ord + 1; k < n; k++) crossings += cnt[k]!;
    }
    for (const edge of edgesFromTop) {
      cnt[bottomOrder.get(edge.to.id) ?? 0]++;
    }
  }
  return crossings;
}
```

2. Add a cache type and helpers:
```typescript
type CrossingCache = { counts: Map<number, number>; valid: Set<number> };

function buildCrossingCache(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  sortedRanks: number[],
): CrossingCache {
  const counts = new Map<number, number>();
  const valid = new Set<number>();
  for (let i = 0; i + 1 < sortedRanks.length; i++) {
    const r = sortedRanks[i]!;
    counts.set(r, countCrossingsForRank(layers.get(r)!, layers.get(sortedRanks[i + 1]!)!, edges, r));
    valid.add(r);
  }
  return { counts, valid };
}

function totalCrossings(
  cc: CrossingCache,
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  sortedRanks: number[],
): number {
  for (let i = 0; i + 1 < sortedRanks.length; i++) {
    const r = sortedRanks[i]!;
    if (!cc.valid.has(r)) {
      cc.counts.set(r, countCrossingsForRank(layers.get(r)!, layers.get(sortedRanks[i + 1]!)!, edges, r));
      cc.valid.add(r);
    }
  }
  return [...cc.counts.values()].reduce((s, v) => s + v, 0);
}

function invalidateCrossingCache(cc: CrossingCache, rank: number): void {
  cc.valid.delete(rank - 1); // pair (rank-1, rank)
  cc.valid.delete(rank);     // pair (rank, rank+1)
}
```

3. Update `transpose` to accept and use the cache:
```typescript
function transpose(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  flatMatrix?: FlatMatrix,
  cc?: CrossingCache,
  sortedRanks?: number[],
): boolean { ... }
```
Inside `transpose`, replace calls to `countCrossings(edges)` with
`totalCrossings(cc!, layers, edges, sortedRanks!)`, and call
`invalidateCrossingCache(cc!, rank)` whenever a swap is accepted.

4. In `minimizeCrossings`, build the cache after the flat-reorder passes:
```typescript
const sortedRanks = [...layers.keys()].sort((a, b) => a - b);
const cc = buildCrossingCache(layers, edges, sortedRanks);
```
Replace all `countCrossings(edges)` calls with `totalCrossings(cc, layers, edges, sortedRanks)`.
Update `transpose(...)` calls to pass `cc` and `sortedRanks`.

5. **Delete** the old `countCrossings` function.

---

### M-4 — SINGLETON weight in `edgeWeight`

**C source:** `mincross.c:1703–1742` — `virtual_weight()` 3×3 table.

**Problem:** `edgeWeight` treats SINGLETON nodes (≤1 non-flat edge) as
ORDINARY, giving weight 1 instead of 2.

**Fix:**

1. In `minimizeCrossings`, compute singleton IDs before the sweep loop:
```typescript
// C: weight_class <= 1 ↔ node has at most 1 non-flat (cross-rank) edge
const normalEdgesPerNode = new Map<string, number>();
for (const node of nodes) normalEdgesPerNode.set(node.id, 0);
for (const edge of edges) {
  if (edge.from.rank !== edge.to.rank) {
    normalEdgesPerNode.set(edge.from.id, (normalEdgesPerNode.get(edge.from.id) ?? 0) + 1);
    normalEdgesPerNode.set(edge.to.id,   (normalEdgesPerNode.get(edge.to.id)   ?? 0) + 1);
  }
}
const singletonIds = new Set<string>(
  [...normalEdgesPerNode.entries()].filter(([, c]) => c <= 1).map(([id]) => id),
);
```

2. Pass `singletonIds` to `buildNeighborMap` and down to `edgeWeight`:
```typescript
function edgeWeight(from: DotNode, to: DotNode, singletonIds: Set<string>): number {
  const fV = from.virtual, tV = to.virtual;
  const fS = !fV && singletonIds.has(from.id);
  const tS = !tV && singletonIds.has(to.id);
  if (fV && tV) return 4;               // V–V
  if (fV || tV) return 2;               // V–* or *–V
  if (fS && tS) return 1;              // S–S
  if (fS || tS) return 2;              // S–O or O–S
  return 1;                            // O–O
}
```

Update `buildNeighborMap` to accept and thread `singletonIds` through to its
`edgeWeight` calls.

---

## Write-set

- `src/core/dot/mincross.ts`
- `tests/unit/dot/mincross.test.ts`

## Read-set

- `src/core/dot/mincross.ts` — full file (549 lines)
- `src/core/dot/types.ts` — `DotNode`, `DotEdge`, `FlatMatrix`
- `decisions.md` — D-1, D-2, D-3

## Acceptance criteria

**M-1:**
- Given a node with 0 cross-rank edges and a flat-in neighbor at order 3,
  when `sortLayerByMedian` runs, the node's wmedian is 4 (max flat-in + 1)
- Given a node with 0 cross-rank edges and no flat neighbors,
  when `sortLayerByMedian` runs, the node still sinks (wmedian = -1)

**M-3:**
- Given two adjacent layers with K crossings, `totalCrossings` returns K
  matching the old `countCrossings` result
- After a swap at rank R, `invalidateCrossingCache(cc, R)` is called and
  only ranks R-1 and R are recomputed on the next `totalCrossings` call

**M-4:**
- Given an ORDINARY→SINGLETON edge, `edgeWeight` returns 2
- Given a SINGLETON→SINGLETON edge, `edgeWeight` returns 1
- Given a VIRTUAL→VIRTUAL edge, `edgeWeight` returns 4 (unchanged)
- All existing mincross tests continue to pass

## Quality bar

```sh
npm run typecheck && npm run lint && npm run build
npm test  # all N tests pass, 0 failing
```

One commit: `fix(dot): M-1 flat_mval, M-3 per-rank crossings, M-4 SINGLETON weight`
