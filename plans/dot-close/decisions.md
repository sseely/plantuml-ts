# Architecture Decisions

## D-1: M-1 — `flatMval` placement

Add `flatMval(node, layer, flatMatrix)` as a private helper in `mincross.ts`.
Call it from inside the `sortLayerByMedian` sort comparator when `wmedian`
returns -1 for a node and `flatMatrix` is present:

```typescript
let ma = wmedian(neighborMap.get(a.id) ?? []);
if (ma === -1 && flatMatrix) ma = flatMval(a, layer, flatMatrix);
```

`flatMval` logic (C: mincross.c:1589–1617):
- flat-in neighbors of node n: nodes m in the layer where
  `flatMatrix.get(n.rank)?.get(m.id)?.has(n.id)` (m must be left of n)
- flat-out neighbors: nodes m where `flatMatrix.get(n.rank)?.get(n.id)?.has(m.id)`
- if has flat-in: return `Math.max(...flatInOrders) + 1`
- else if has flat-out: return `Math.min(...flatOutOrders) - 1`
- else: return -1 (unchanged)

No signature changes at call sites — `flatMatrix` already flows in.

## D-2: M-3 — replace `countCrossings` entirely

Add `countCrossingsForRank(topLayer, bottomLayer, edges, topRank)` — O(n·deg)
sweep-line (C: rcross() mincross.c:1512–1549).

Add a crossing cache object `{ cache: Map<number, number>, valid: Set<number> }`
passed through `transpose` and `minimizeCrossings`. On each swap at rank R,
invalidate entries for rank pairs (R-1, R) and (R, R+1).

Delete the old O(E²) `countCrossings` function entirely.

## D-3: M-4 — SINGLETON classification via Set

Compute `singletonIds: Set<string>` once in `minimizeCrossings` before the
sweep loop. A node is SINGLETON if it has ≤1 non-flat (cross-rank) edge in
`graph.edges`. Pass `singletonIds` to `buildNeighborMap`, which passes it to
`edgeWeight`.

Updated weight table (C: virtual_weight mincross.c:1703–1742):
```
          from\to | ORDINARY | SINGLETON | VIRTUAL
          ORDINARY|    1     |     2     |    2
         SINGLETON|    2     |     1     |    2
           VIRTUAL|    2     |     2     |    4
```

## D-4: P-4 — ht1/ht2 on-the-fly, no type changes

All current nodes are symmetric: ht1 = ht2 = height/2. Compute inline in
`assignTB`. Do NOT add ht1/ht2 fields to `types.ts` — that belongs when class
diagram compartments produce asymmetric nodes. For now the formula reduces to
the same result as before; adding it correctly positions the code for when
compartments arrive.

## D-5: P-5 — self-contained NS solver in position.ts

Add `solveAuxNS(nodes, constraints, edges, graph)` directly in `position.ts`.
Do NOT extract or share rank.ts NS — rank.ts NS is entangled with virtual-node
creation and the `NSCtx` / `Subtree` types. Sharing risks breaking rank
assignment.

The auxiliary graph (C: position.c:340–530 `make_edge_pairs` + `set_xcoords`):
- **NODENODE edges**: one per adjacent node pair per rank (same as existing
  `AuxEdge` constraints from `make_LR_constraints`) — minLen = separation,
  weight = 1
- **SLACKNODE edges**: one per real edge — a synthetic "slack" node sits between
  the edge endpoints and is attracted to the midpoint; this is what C's NS
  achieves with slack nodes. Simplified: add a centering penalty by including
  edges with minLen=0 and a weight proportional to the edge's original weight.

The NS for x-assignment is structurally simpler than rank.ts NS: no subtrees,
no cut-value propagation, no DFS ranges. A straightforward spanning-tree NS
with the same pivot loop structure suffices.

Replace `solveAuxRanks(nodes, constraints)` and the two centering pass calls
(`centerBySuccessors`, `centerByPredecessors`) in `assignTB` with a single
`solveAuxNS(...)` call. Keep `centerVirtualNodes` unchanged.

Do the same for `assignLR` (replace the Bellman-Ford y-solve + centering
passes with NS).
