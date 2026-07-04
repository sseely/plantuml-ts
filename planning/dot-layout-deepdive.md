# DOT Layout Engine — Deep Algorithm Gap Analysis

This document captures every gap found between the authoritative graphviz C source
(`~/git/graphviz/lib/dotgen/`) and the TypeScript port in `src/core/dot/` after a
systematic function-by-function comparison. All gaps include precise C source
line references.

---

## Overview of the pipeline

```
removeAcyclic → edgelabel_ranks → assignRanks → minimizeCrossings → assignCoordinates → routeEdges
(acyclic.ts)    (index.ts:84)     (rank.ts)      (mincross.ts)       (position.ts)       (splines.ts)
```

The C pipeline is:
```
acyclic → edgelabel_ranks → class1 → minmax_edges → minmax_edges2 → rank1 → expand_ranksets
       → class2 (creates virtual + label nodes) → mincross → position → splines
```

The TypeScript collapses `class2`'s virtual-node creation into `rank.ts` (correct placement)
but has several other omissions detailed below.

---

## PART 1 — rank.ts gaps

Reference files: `~/git/graphviz/lib/dotgen/rank.c`, `~/git/graphviz/lib/dotgen/class2.c`

### Gap R-1: Plain virtual node width is 0 instead of `nodeSep`

**File:** `src/core/dot/rank.ts:1317–1318`

**C source:** `class2.c:42–46` — `incr_width()`:
```c
static void incr_width(graph_t *g, node_t *vn) {
    double w = GD_nodesep(agroot(g));
    ND_lw(vn) += w / 2;
    ND_rw(vn) += w / 2;
}
```
Every virtual node on every rank (not just label nodes) gets `lw = rw = nodeSep/2`,
giving a total width of `nodeSep`. This minimum width is used by `make_LR_constraints`
in position.c to prevent adjacent virtual nodes on the same rank from being packed
to zero separation.

**TypeScript:**
```typescript
width: isLabelSlot ? (edge.labelWidth ?? 0) : 0,  // ← 0 for plain virtual nodes
```

**Impact:** In dense diagrams with many long-span edges, virtual nodes on shared ranks
can collapse to zero x-separation, causing the spline routing to generate near-vertical
segments and overlapping parallel edge paths.

**Fix:** Replace with:
```typescript
width: isLabelSlot
  ? (edge.labelWidth ?? 0) + graph.nodeSep   // class2.c:28,35: lw=nodeSep, rw=labelWidth
  : graph.nodeSep,                            // class2.c:44-46: plain virtual gets nodeSep
```

---

### Gap R-2: Label virtual node width missing the `lw = nodeSep` padding

**File:** `src/core/dot/rank.ts:1319`

**C source:** `class2.c:23–38` — `label_vnode()`:
```c
ND_lw(v) = GD_nodesep(agroot(g));     // left half = nodesep (padding)
ND_rw(v) = dimen.x;                    // right half = label width
// Total effective width = nodesep + labelWidth
```

**TypeScript:** `width = edge.labelWidth ?? 0` — uses only the label width, omits the
`nodeSep` left-padding. This means the separation constraint in `make_LR_constraints`
underestimates needed space by `nodeSep` on the left side.

**Fix:** Covered by Gap R-1's fix above (both are in the same line).

---

### Gap R-3: `minmax_edges2` is not implemented

**File:** `src/core/dot/rank.ts` — missing function

**C source:** `rank.c:421–444`
```c
static void minmax_edges2(graph_t *g, int slen) {
    // For every leader node with no out-edges: add zero-weight edge to maxset
    // For every leader node with no in-edges: add zero-weight edge from minset
    // minlen = slen (1 if source/sink rank type, 0 otherwise)
    // weight = 0
}
// Called at rank.c:513-514, after minmax_edges() and before rank1()
```

**Impact:** Nodes with no in-edges are not constrained to appear at or after the
`min`/`source` rank set when such sets are declared. In practice this only matters
for diagrams that explicitly use `rank=source` or `rank=min` subgraph attributes.

**Fix:** Add and call before `rank1()`:
```typescript
// rank.c:421-444
function minmax_edges2(graph: DotWorkingGraph): void {
  const minLeader = graph.minSetLeader ? ufFind(graph.minSetLeader) : null;
  const maxLeader = graph.maxSetLeader ? ufFind(graph.maxSetLeader) : null;
  if (!minLeader && !maxLeader) return;
  const slenX = minLeader?.ranktype === 'source' ? 1 : 0;
  const slenY = maxLeader?.ranktype === 'sink'   ? 1 : 0;
  for (const n of graph.nodes) {
    if (ufFind(n) !== n) continue;
    const hasOut = graph.edges.some(e => ufFind(e.from) === n);
    const hasIn  = graph.edges.some(e => ufFind(e.to)   === n);
    if (!hasOut && maxLeader && n !== maxLeader)
      graph.edges.push({ id: `__mm2_max_${n.id}`, from: n, to: maxLeader,
                         weight: 0, minLen: slenY, reversed: false, points: [] });
    if (!hasIn && minLeader && n !== minLeader)
      graph.edges.push({ id: `__mm2_min_${n.id}`, from: minLeader, to: n,
                         weight: 0, minLen: slenX, reversed: false, points: [] });
  }
}
```

---

## PART 2 — position.ts gaps

Reference files: `~/git/graphviz/lib/dotgen/position.c`

### Gap P-1: No odd-rank half-separation for label-node ranks

**File:** `src/core/dot/position.ts` — `make_LR_constraints` function

**C source:** `position.c:230–241`:
```c
if (GD_has_labels(g->root) & EDGE_LABEL) {
    sep[0] = GD_nodesep(g);  // even ranks (real nodes): full separation
    sep[1] = 5;               // odd ranks (label nodes): 5px minimum
}
nodesep = sep[i & 1];        // i = rank index, parity selects the value
// position.c:264: width = ND_rw(u) + ND_lw(v) + nodesep
```

Label ranks (always odd after `edgelabel_ranks` doubles all minLens) use only 5px
of separation between sibling nodes, because the label node's `ND_rw` already encodes
the true clearance requirement.

**TypeScript:** Always uses `graph.nodeSep` regardless of rank parity. This causes
label-heavy diagrams to be artificially wide because label nodes on the same rank push
each other apart by the full nodeSep instead of 5px.

**Impact:** Diagrams with edge labels are wider than they should be.

**Fix:**
```typescript
// In make_LR_constraints (position.ts):
const hasLabels = graph.edges.some(e => e.label) || graph.longEdges.some(e => e.labelNode);
const nodesep = (hasLabels && (rank & 1) !== 0) ? 5 : graph.nodeSep;
```

Also add `hasEdgeLabels?: boolean` to `DotWorkingGraph` (types.ts) and set it in
`edgelabel_ranks` (index.ts:84–93) so position.ts can read it without scanning.

---

### Gap P-2: `centerVirtualNodes` overwrites label node's constraint-solved x

**File:** `src/core/dot/position.ts:237–249` — `centerVirtualNodes`

**C source:** `position.c:569–584` — `set_xcoords()`:
```c
/* After NS solve, x is ND_rank(v) set by rank() on the auxiliary graph */
for (v in all_nodes) ND_coord(v).x = ND_rank(v) * xf;
```
In C, label virtual nodes get their x from the network-simplex solution of the
auxiliary constraint graph. There is no separate geometric interpolation step.

**TypeScript:**
```typescript
// centerVirtualNodes resets ALL virtual nodes on a long edge:
for (let i = 0; i < count; i++) {
  const vn = longEdge.virtualNodes[i]!;
  const centerX = srcX + (dstX - srcX) * (i + 1) / (count + 1);
  vn.x = centerX - vn.width / 2;   // ← unconditionally overwrites label node x
}
```

The label node's width was already included in the separation constraints during
`solveAuxRanks`, which correctly pushed rank-neighbors apart to make room. Then
`centerVirtualNodes` replaces that computed position with geometric linear interpolation,
potentially moving the label node outside the gap that was reserved for it.

**Impact:** Label nodes can overlap rank neighbors after the constraint-solve gap is
discarded. The text is positioned correctly relative to the node but the node itself
is no longer in the space reserved for it.

**Fix:** Skip label nodes in `centerVirtualNodes`:
```typescript
for (let i = 0; i < count; i++) {
  const vn = longEdge.virtualNodes[i]!;
  if (vn === longEdge.labelNode) continue;  // C: label vnode x from NS solve
  const centerX = srcX + (dstX - srcX) * (i + 1) / (count + 1);
  vn.x = centerX - vn.width / 2;
}
```

---

### Gap P-3: LR path missing odd-rank separation rule

**File:** `src/core/dot/position.ts` — `assignLR` inline constraint loop

Same issue as P-1 but in the LR code path. The separation between nodes on each
"rank" (which is a column in LR mode) uses uniform `graph.nodeSep`. Apply the same
parity check using the rank index.

**C source:** `position.c:230–241` — same code path; `GD_flip` switches axis but the
rank-parity logic is unchanged.

---

## PART 3 — mincross.ts gaps

Reference files: `~/git/graphviz/lib/dotgen/mincross.c`

### Gap M-1: `flat_mval` missing — label nodes with zero normal-edge neighbors

**File:** `src/core/dot/mincross.ts` — `wmedian`/`buildNeighborMap`

**C source:** `mincross.c:1589–1617` — `flat_mval()`, called at `mincross.c:1672–1674`:
```c
if (ND_out(n).size == 0 && ND_in(n).size == 0) {
    if (flat_mval(g, n, pass)) hasfixed = TRUE;
    continue;
}
```
`flat_mval()` assigns `mval` to nodes with zero normal-edge in/out by looking at their
flat-edge neighbors (flat-edge label virtual nodes fall into this category once flat-edge
label nodes are created). Without it, such nodes get `mval = -1` and sink to the end
of their rank.

**TypeScript:** `buildNeighborMap` returns an empty array for nodes with no normal edges;
`wmedian` returns -1, placing the node last. This is wrong when the node has flat-edge
neighbors from which a sensible position can be derived.

**Fix:**
```typescript
// In wmedian() or sortLayerByMedian(), after wmedian returns -1:
if (median === -1 && hasFlatNeighbors(node, flatAdj, flatAdjRev)) {
  median = flatMval(node, layer, flatAdj, flatAdjRev);
  // C: mincross.c:1589-1617 — use highest-order flat-in neighbor + 1,
  //    or lowest-order flat-out neighbor - 1
}
```

---

### Gap M-2: `left2right` guard missing from `sortLayerByMedian`

**File:** `src/core/dot/mincross.ts` — `sortLayerByMedian`

**C source:** `mincross.c:1430–1433` — inside `reorder()`:
```c
if (left2right(g, lp, rp)) {
    lp++;   // keep lp left of rp, skip comparison
    continue;
}
```
Before comparing two nodes by median value, `reorder()` checks if a flat constraint
requires one to stay left of the other. If so, the median comparison is skipped.

**TypeScript:** `sortLayerByMedian` sorts purely by median value. The flat-constraint
enforcement is only in `transpose()`. This means each median-sort pass can silently
undo the flat ordering that `flat_reorder()` just established, causing unnecessary
extra iterations and potentially suboptimal final orderings.

**Fix:**
```typescript
layer.sort((a, b) => {
  // C: reorder() mincross.c:1430-1433
  if (rankConstraints?.get(a.id)?.has(b.id)) return -1;
  if (rankConstraints?.get(b.id)?.has(a.id)) return 1;
  const ma = wmedian(...);
  const mb = wmedian(...);
  // ... rest unchanged
});
```

---

### Gap M-3: Crossing count is global and O(E²) instead of per-rank O(n·deg)

**File:** `src/core/dot/mincross.ts` — `countCrossings`

**C source:** `mincross.c:1512–1549` — `rcross()`:
```c
static int rcross(graph_t *g, int r) {
    // Sweep-line with count array: O(n·deg) per rank-pair
    // Cached per-rank with valid flag; invalidated only when a swap occurs
}
// ncross() calls rcross(r) for each rank pair, uses cache
```

**TypeScript:** `countCrossings(edges)` iterates all edge pairs globally — O(E²) total.
Every call recomputes the full graph. Since `transpose()` calls this before and after
every candidate swap, the total complexity is O(swaps × E²).

**Impact:** Performance degradation on larger diagrams (20+ nodes). Correctness is
not affected.

**Fix:** Implement per-rank crossing count with the sweep-line algorithm, plus a
`rankValid: Map<number, boolean>` cache invalidated on swaps:
```typescript
// C: rcross() mincross.c:1512-1549
function countCrossingsForRank(
  topLayer: DotNode[], bottomLayer: DotNode[], edges: DotEdge[]
): number {
  const n = bottomLayer.length + 1;
  const cnt = new Int32Array(n);
  let crossings = 0;
  for (const top of topLayer) {
    for (const e of edges) {
      if (e.from !== top) continue;
      const ord = e.to.order;
      for (let k = ord + 1; k < n; k++) crossings += cnt[k]!;
    }
    for (const e of edges) {
      if (e.from !== top) continue;
      cnt[e.to.order]++;
    }
  }
  return crossings;
}
```

---

### Gap M-4: `virtual_weight` does not distinguish SINGLETON nodes

**File:** `src/core/dot/mincross.ts` — `edgeWeight`

**C source:** `mincross.c:1703–1742` — `virtual_weight()`:
```c
// 3×3 weight table:
//            from\to | ORDINARY | SINGLETON | VIRTUAL
//            ORDINARY|    1     |     2     |    2
//           SINGLETON|    2     |     1     |    2
//             VIRTUAL|    2     |     2     |    4
int wt = vw[endpoint_class(agtail(e))][endpoint_class(aghead(e))];
// SINGLETON = weight_class <= 1 (node with only one non-flat edge)
```

**TypeScript:** `edgeWeight` maps to 4/2/1 for V–V / V–R / R–R. SINGLETON maps to
ORDINARY (1) in all cases. This misses the extra weight given to singleton edges
(they should get weight 2, not 1), which can cause singleton nodes to be suboptimally
ordered relative to their single neighbor.

---

## PART 4 — splines.ts gaps

Reference files: `~/git/graphviz/lib/dotgen/dotsplines.c`,
`~/git/graphviz/lib/common/splines.c`, `~/git/graphviz/lib/common/routespl.c`

### Gap S-1: `tailportY` is stored but never used in routing

**File:** `src/core/dot/splines.ts` — all `route*` functions

**C source:** `splines.c:378–573` — `beginpath()`:
```c
// tailport is an absolute x/y offset from node center
P->start.p = add_pointf(ND_coord(tailnode), ED_tail_port(e).p);
// Port side (TOP/BOTTOM/LEFT/RIGHT) determines exit face and routing box
```

**TypeScript:** `DotEdge.tailportY` is set from input (`index.ts:55–56`), used in
`mincross.ts:97` for ordering, but **never referenced in `splines.ts`**. Every edge
exits from `ellipseEdgePoint(edge.from, center(edge.to))` — which picks the closest
ellipse intersection, ignoring any port specification.

**Impact:** Sequence diagram lifeline arrows, which rely on `tailportY` to connect at
specific vertical positions on node boundaries, connect at the wrong y position.

**Fix:** In `routeShortEdge` and `routeLongEdge`, when `edge.tailportY !== undefined`:
```typescript
// C: beginpath() splines.c:392 — start.p = node_center + port.p
function tailStartPoint(edge: DotEdge): Point {
  const node = edge.from;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  if (edge.tailportY !== undefined) {
    const portY = cy + edge.tailportY * node.height;
    // Route from the node's right or left face at the port y:
    return { x: node.x + node.width, y: portY };
  }
  return ellipseEdgePoint(node, center(edge.to));
}
```

---

### Gap S-2: Edge routing uses own label node as obstacle

**File:** `src/core/dot/splines.ts:203–208` — `buildObstaclePolygons`

**C source:** `dotsplines.c:2227–2249` — `neighbor()`:
```c
// Label virtual nodes act as hard boundaries — routing stops at them
// when computing lateral neighbors. But each edge routes THROUGH its
// own label virtual node, not around it.
```

**TypeScript:** `buildObstaclePolygons` includes all non-zero-size nodes as obstacles.
This means an edge with a label will try to route around its own label virtual node,
since that node has non-zero width/height.

**Fix:** Pass each edge's own virtual node IDs as an exclusion set:
```typescript
const ownVirtualIds = new Set([
  ...(edge.virtualNodes ?? []).map(n => n.id),
]);
// Build obstacles from all nodes EXCEPT this edge's own virtual chain
const obstacles = buildObstaclePolygons(graph.nodes, ownVirtualIds);
```

---

### Gap S-3: `maximal_bbox` / box-corridor routing absent — edges can pass through nodes

**File:** `src/core/dot/splines.ts` — `routeLongEdge`

**C source:** `dotsplines.c:2168–2225` — `maximal_bbox()`, called from `make_regular_edge`
lines 1783–1845:
```c
// For each virtual node vn, compute the allowed horizontal band:
//   left  boundary = nearest left sibling's right edge
//   right boundary = nearest right sibling's left edge (minus label rw if vn is label node)
// Assemble into a `boxes` corridor from tail to head
// Call routesplines(boxes) once to produce a smooth spline through the corridor
```

**TypeScript:** Uses virtual node centers as bezier waypoints with Catmull-Rom smoothing.
No per-rank routing channel is computed; the curve passes through virtual node centers
but has no guarantee of staying within the available horizontal band. Adjacent nodes
from other edges can be in the path.

**Impact:** In dense diagrams with many parallel long edges, edges can visually pass
through unrelated nodes.

**Fix:** This is a substantial undertaking. Minimum viable approximation:
```typescript
// After constraint-solving gives virtual node x positions,
// for each adjacent pair of virtual nodes compute the inter-rank midpoint
// and use it as an additional waypoint to pull the curve through the channel:
const waypoints: Point[] = [start];
for (let i = 0; i < virtualNodes.length; i++) {
  const vn = virtualNodes[i]!;
  waypoints.push({ x: vn.x + vn.width / 2, y: vn.y + vn.height / 2 });
  if (i + 1 < virtualNodes.length) {
    const next = virtualNodes[i + 1]!;
    waypoints.push({
      x: (vn.x + vn.width / 2 + next.x + next.width / 2) / 2,
      y: (vn.y + vn.height + next.y) / 2,
    });
  }
}
waypoints.push(end);
```

Full fix requires implementing `maximal_bbox` (`dotsplines.c:2168–2225`) and
`completeregularpath` (`dotsplines.c:1914–1946`).

---

### Gap S-4: `adjustEndpoints` is defined but never called from `routeEdges`

**File:** `src/core/dot/splines.ts` — `routeEdges` function

The function `adjustEndpoints` is exported but the `routeEdges` pipeline does not
call it. Each individual route function (`routeShortEdge`, `routeLongEdge`, etc.)
calls `ellipseEdgePoint` inline instead. The `adjustEndpoints` function itself
partially ports `makeregularend` from `dotsplines.c:1952–1958`, but the port is
incomplete (it snaps to the node face, not to the rank-band bottom as the C code does).

**Fix:** Either integrate `adjustEndpoints` properly into each route function, or
remove the dead export. See the `makeregularend` C code at `dotsplines.c:1952–1958`
for the correct rank-height-based endpoint extension.

---

### Gap S-5: Labeled flat edge routing not implemented

**File:** `src/core/dot/splines.ts:449–478` — `routeFlatEdge`

**C source:** `dotsplines.c:1314–1416` — `make_flat_labeled_edge()`:
```c
// When a flat edge has a label: use the label virtual node's x position as
// an intermediate routing point, build three routing boxes (tail→label,
// label width, label→head), call routesplines() through that corridor.
```

**TypeScript:** `routeFlatEdge` handles only the unlabeled detour arc case. Labeled
flat edges fall through to the same path, and the label node's position is not
used to guide the curve.

---

### Gap S-6: Multi-edge x-shifting not applied to long edges

**File:** `src/core/dot/splines.ts` — `routeLongEdge`

**C source:** `dotsplines.c:1885–1907` — inside `make_regular_edge()`:
```c
// For cnt > 1 parallel long edges sharing a corridor:
// shift virtual node x by (i - cnt/2) * Multisep for each edge i
```

**TypeScript:** `routeParallelEdge` fans short edges but there is no equivalent
fanning for multi-rank parallel edges. Multiple long edges sharing the same virtual
node chain appear as a single thick line.

---

## PART 5 — Implementation priority matrix

| Gap | File | Lines | Severity | Effort |
|-----|------|-------|----------|--------|
| R-1/R-2: Virtual node width | `rank.ts:1317–1319` | 2 | High | Trivial (2-line fix) |
| P-1: Odd-rank nodesep = 5 | `position.ts:make_LR_constraints` | ~10 | High | Small |
| P-2: Label node x overwrite | `position.ts:237–249` | ~5 | High | Small |
| S-1: tailportY ignored | `splines.ts:route*` | ~20 | High | Medium |
| M-2: flat constraint in sort | `mincross.ts:sortLayerByMedian` | ~5 | Medium | Small |
| R-3: minmax_edges2 missing | `rank.ts` | ~25 | Medium | Small |
| S-2: Own label as obstacle | `splines.ts:buildObstaclePolygons` | ~5 | Medium | Small |
| M-1: flat_mval missing | `mincross.ts` | ~30 | Medium | Medium |
| M-3: O(E²) crossing count | `mincross.ts:countCrossings` | ~50 | Low | Medium |
| P-3: LR odd-rank nodesep | `position.ts:assignLR` | ~5 | Medium | Small |
| S-3: No box-corridor routing | `splines.ts:routeLongEdge` | ~150 | Medium | Large |
| S-4: adjustEndpoints dead code | `splines.ts` | ~10 | Low | Small |
| S-5: Labeled flat edge routing | `splines.ts:routeFlatEdge` | ~80 | Low | Medium |
| S-6: Multi-edge long fanning | `splines.ts:routeLongEdge` | ~30 | Low | Medium |
| M-4: SINGLETON weight | `mincross.ts:edgeWeight` | ~10 | Low | Small |

---

## PART 6 — How to fix these as a batch

Recommended task grouping:

**Batch A (trivial fixes, one commit):**
- R-1/R-2: Fix virtual node widths (`rank.ts:1317–1319`)
- R-3: Add `minmax_edges2` (`rank.ts`)
- S-4: Remove or integrate `adjustEndpoints` (`splines.ts`)

**Batch B (position solver fixes, one commit):**
- Add `hasEdgeLabels` flag to `DotWorkingGraph` (types.ts)
- Set it in `edgelabel_ranks` (index.ts)
- P-1: Odd-rank nodesep (position.ts `make_LR_constraints`)
- P-2: Skip label nodes in `centerVirtualNodes` (position.ts)
- P-3: LR path odd-rank nodesep (position.ts `assignLR`)

**Batch C (mincross fixes, one commit):**
- M-2: `left2right` guard in sort (mincross.ts)
- M-3: Per-rank O(n·deg) crossing count (mincross.ts)
- M-1: `flat_mval` for isolated nodes (mincross.ts)

**Batch D (splines port/head port routing, one commit):**
- S-1: Apply `tailportY` in routing (splines.ts)
- S-2: Exclude own virtual chain from obstacles (splines.ts)

**Batch E (long-edge corridor routing, large, later):**
- S-3: Box-corridor approach (`maximal_bbox` / `completeregularpath`)
- S-5: Labeled flat edge routing
- S-6: Multi-edge long fanning

Batches A–D are all small-to-medium changes that individually improve correctness.
Batch E is a significant architectural addition to the routing system.
