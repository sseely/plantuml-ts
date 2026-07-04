# Graphviz Port Audit — Function-by-Function Review

This document is the synthesis of a systematic function-by-function comparison
between the authoritative graphviz C source (`~/git/graphviz/lib/dotgen/`) and
the TypeScript port in `src/core/dot/`. It was generated after running six
parallel deep-audit agents, one per C source file group.

`planning/dot-layout-deepdive.md` predates this audit and focuses on
diagram-visible gaps (R/P/M/S gaps). This document extends it with the
full algorithmic picture, records which gaps have been fixed since that
document was written, and provides a realistic implementation plan.

---

## Executive Summary

| Module | C lines | TS lines | Verdict | Blocking issues |
|--------|---------|----------|---------|-----------------|
| `acyclic.ts` | 70 | 80 | **CORRECT** | None |
| `rank.ts` — NS algorithm | 1107 | ~800 (NS portion) | **SALVAGEABLE** | TB_balance missing |
| `rank.ts` — virtual nodes | `class2.c` 294 | ~150 (embedded) | **CORRECT** | R-1/R-2 already fixed |
| `mincross.ts` | 1809 | 417 | **SALVAGEABLE** | BFS init missing; 4:1 line gap |
| `position.ts` | 1133 | 460 | **SALVAGEABLE** | Bellman-Ford vs NS; ht1/ht2 wrong |
| `splines.ts` | ~4726 | 536 | **REIMPLEMENT** | Architecture incompatible |

"CORRECT" = behavior matches C source for the inputs we generate.
"SALVAGEABLE" = structure is right but specific functions are missing.
"REIMPLEMENT" = the approach is architecturally different and cannot be incrementally fixed.

---

## Status of `dot-layout-deepdive.md` gaps

Several gaps identified in the previous analysis have been applied since
that document was written. Do not re-apply them.

| Gap | Status | Where fixed |
|-----|--------|-------------|
| R-1/R-2: Virtual node widths | **FIXED** | `rank.ts:1321–1323` |
| P-1: Odd-rank nodesep = 5px | **FIXED** | `position.ts:38–39` |
| P-2: Label node x overwrite | **FIXED** | `position.ts:252–254` |
| P-3: LR odd-rank nodesep | **FIXED** | `position.ts:389–390` |
| S-2: Own label as obstacle | **FIXED** | `splines.ts:209–211` |
| R-3: minmax_edges2 | **OPEN** | — |
| M-1: flat_mval | **OPEN** | — |
| M-2: left2right guard | **OPEN** | — |
| M-3: O(E²) crossing count | **OPEN** | — |
| M-4: SINGLETON weight | **OPEN** | — |
| S-1: tailportY in routing | **OPEN** | — |
| S-3: Box-corridor routing | **OPEN** | — |
| S-4: adjustEndpoints dead | **OPEN** | — |
| S-5: Labeled flat edge | **OPEN** | — |
| S-6: Multi-edge long fans | **OPEN** | — |

This document adds gaps not captured in the earlier analysis:
**R-4** (TB_balance), **M-5** (BFS initial ordering), **M-6** (component
decomposition), **P-4** (ht1/ht2 y-spacing model), **P-5** (NS on
auxiliary graph).

---

## Module-by-module analysis

### 1. `acyclic.ts` — CORRECT

**C source:** `~/git/graphviz/lib/dotgen/acyclic.c` (70 lines)
**TS file:** `src/core/dot/acyclic.ts` (80 lines)

The DFS-based back-edge reversal is faithfully ported. The `_r` suffix
edge merging (for synthetic undirected scaffolding edges) is a TS
addition that has no C equivalent but is correct for its purpose.

**Gap:** C's `acyclic.c` initializes node visitation order via
`nodequeue` (BFS from source nodes), giving O(V+E) initialization.
TS iterates `graph.nodes` in insertion order, which is O(N·E) worst
case. This is a **performance gap only** — no behavioral difference
on DAGs (which is all plantuml-js ever produces after preprocessing).

**Verdict:** No action required. Performance gap is academic at
plantuml-js scale (< 200 nodes).

---

### 2. `rank.ts` — NS algorithm — SALVAGEABLE

**C source:** `~/git/graphviz/lib/dotgen/rank.c` (1107 lines)
**TS file:** `src/core/dot/rank.ts:1–~800` (NS portion)

The network simplex core — feasibility tree construction, cut value
computation, pivot loop — is correctly ported. The tight-tree DFS, the
`enter_edge` (leaving-edge search), the `leave_edge` (entering-edge
selection by negative cut value), and the normalize step are all
present and behaviorally correct.

**Missing: Gap R-4 — TB_balance**

C source: `rank.c:314–360` — `TB_balance()`, called at `rank.c:512`
after the NS pivot loop:

```c
static void TB_balance(graph_t *g) {
    // For each node n: if in_degree(n) == out_degree(n)
    //   and (rank(n) - min_rank) < (max_rank - rank(n)):
    //     shift n to a less-populated rank between two ranked neighbors
    // This reduces "lopsided" rank assignments without changing feasibility.
}
```

TB_balance is a quality improvement, not correctness. It resolves the
common case where a node with equal in/out weight is placed at the
earliest feasible rank (which NS naturally prefers) when moving it
later would produce a more balanced layout. Without it, symmetric
graphs have asymmetric rank distributions.

**Visual impact:** Medium. Most noticeable when a diagram has "hub"
nodes with equal in/out degree — they cluster near the top of the
diagram instead of the middle.

**Other minor gaps:**
- `init_rank()` (rank.c:186–219): C uses DFS-based topological pass;
  TS has equivalent but O(V·E) pass. No behavioral difference.
- `enter_edge()` (rank.c:271–311): C uses a SEARCHSIZE limit; TS has
  the same constant (`SEARCHSIZE = 30`). Correct.
- `minmax_edges()` / `minmax_edges2()` (rank.c:421–444): The first is
  implemented; the second (`minmax_edges2`, Gap R-3) is not. See the
  deepdive document for the fix.

---

### 3. `rank.ts` — virtual node creation — CORRECT

**C source:** `~/git/graphviz/lib/dotgen/class2.c` (294 lines)
**TS file:** `src/core/dot/rank.ts:1295–1363` (embedded at end)

Virtual nodes are created for all long edges (span > 1) at the correct
time (after rank assignment). Label virtual nodes are placed at the
midpoint rank. The R-1/R-2 width fix (`nodeSep` for plain, `nodeSep +
labelWidth` for label) has been applied.

**Missing from C's class2.c not in TS:**
- `recover_slack()` (class2.c:156–180): Re-runs NS to absorb extra
  slack after virtual nodes add constraints. Only affects diagrams where
  rank-constraint subgraphs (same/min/max/source/sink) have slack left
  after the initial NS solve. Very rare in plantuml-js inputs.
- Parallel edge merging (class2.c:75–100): When two real edges connect
  the same node pair and span the same ranks, C merges them into one
  virtual chain and records multiplicity. TS creates separate virtual
  chains per edge. Behavioral difference is invisible in the layout
  (each chain still gets its own x-reserved width) but means more nodes
  in `graph.nodes` than C would produce.

**Verdict:** No action required for current diagram types. Both gaps
are edge cases irrelevant to the diagrams plantuml-js generates.

---

### 4. `mincross.ts` — SALVAGEABLE (significant gaps)

**C source:** `~/git/graphviz/lib/dotgen/mincross.c` (1809 lines)
**TS file:** `src/core/dot/mincross.ts` (417 lines)
**Line ratio:** 4.3:1

The skeleton is sound: the median/barycenter sweep, flat_breakcycles,
flat_reorder, transpose, and snapshot/restore are all present and
correct. The main loop structure (24 iterations, convergence test,
best-snapshot tracking) matches C's `do_mincross`. However, roughly
60% of C's functionality is absent.

**Gap M-5 (CRITICAL): BFS initial ordering — passes 0 and 1**

C source: `mincross.c:1762–1830` — `do_mincross()` calls three
pre-optimization passes:

```c
// Pass 0: BFS from source nodes → initial layer ordering
mincross_step(g, 0, &graphx, rank);
// Pass 1: BFS from sink nodes (reverse) → second initial ordering
mincross_step(g, 1, &graphx, rank);
// Pass 2+: alternating forward/backward median sweeps
for (iter = 0; iter < MAX_ITER; ...) {
    mincross_step(g, iter, &graphx, rank);
    ...
}
```

TS has no passes 0 or 1. It starts directly at the alternating sweeps
with `assignLayerOrders` (which just uses insertion order). The BFS
passes seed the sweep with a good initial ordering derived from graph
structure (sources-first, then sinks-first), which dramatically reduces
the number of iterations needed and produces better local optima. The
alternating-sweep-only approach is a known weakness that produces worse
orderings on large graphs.

**Gap M-6: Component decomposition**

C source: `mincross.c:1748–1758` — `decomp()` splits the graph into
weakly connected components, solves each independently, then remerges.
TS treats the entire graph as one component. For disconnected diagrams
(where some nodes have no edges to other nodes), C's component
decomposition produces significantly better orderings because isolated
subgraphs don't cross-pollinate their median values.

**Other gaps (already documented):**

- **M-1** (`flat_mval`): Nodes with zero normal-edge neighbors get
  median = -1 and sink to end of rank. Fix in deepdive doc.
- **M-2** (`left2right` guard in `sortLayerByMedian`): Each median
  sort can undo what `flat_reorder` just did. Fix in deepdive doc.
- **M-3** (O(E²) crossing count): `transpose()` calls `countCrossings`
  globally before and after every swap. C's `rcross()` is per-rank
  O(n·deg) with a cache. Performance gap only.
- **M-4** (SINGLETON weight): `edgeWeight` treats singletons as
  ORDINARY; should be weight 2 per the virtual_weight table.

**Recommended action:** Apply gaps M-5 and M-6 as the highest-priority
mincross work. M-2 next. M-1 and M-3 after.

---

### 5. `position.ts` — SALVAGEABLE (algorithm mismatch)

**C source:** `~/git/graphviz/lib/dotgen/position.c` (1133 lines)
**TS file:** `src/core/dot/position.ts` (460 lines)
**Line ratio:** 2.5:1

The separation constraints and LR/TB coordinate assignment structure
are correct. The previously identified P-1/P-2/P-3 fixes have been
applied. The remaining gaps are algorithmic.

**Gap P-5 (SIGNIFICANT): x-assignment is Bellman-Ford, not NS**

C source: `position.c:340–530` — `set_xcoords()` builds an auxiliary
constraint graph, then runs network simplex on it to find the minimum
total x-displacement that satisfies all separation constraints:

```c
// Auxiliary graph edges: one per adjacent node pair per rank (LR constraints)
//                        one per real edge (slack nodes for centering)
// NS minimizes: sum of absolute edge lengths in the auxiliary graph
// Result: x coordinates are the NS rank assignment on the aux graph
```

TS (`solveAuxRanks`) uses Bellman-Ford (longest-path relaxation) to
satisfy only the LR separation constraints. This correctly finds a
valid x-assignment (no overlaps) but does not minimize total width —
it tends to spread nodes out more than necessary.

The `centerBySuccessors` and `centerByPredecessors` passes are
approximations of what C's SLACKNODE edges do in the NS solve.
The approximation is reasonable for simple graphs but diverges on
graphs with many shared paths or sibling convergence.

**Gap P-4 (MEDIUM): ht1/ht2 model for y-spacing**

C source: `position.c:170–205` — `set_ycoords()` tracks per-rank
upper and lower half-heights separately:

```c
// ht1[r] = max(ND_ht1(n)) for real nodes in rank r  (upper half)
// ht2[r] = max(ND_ht2(n)) for real nodes in rank r  (lower half)
// y_spacing = max(ht2[r-1] + ht1[r] + ranksep, ht2[r-1] + ht1[r] + CL_OFFSET)
```

For nodes with asymmetric height (e.g. nodes where the visual center
is not at the geometric center — compartments, notes), this produces
correct vertical spacing. TS uses `max(heights) + rankSep` uniformly
which over-separates symmetric nodes and under-separates asymmetric
ones.

In practice, all plantuml-js nodes currently have symmetric heights
(the rendering origin is always the top-left of the bounding box and
the center is at height/2). Gap P-4 has no visible impact today but
will matter when class diagram compartments are implemented.

**Recommended action:** Gap P-5 is the right algorithmic fix but is
substantial (~200 lines replacing `solveAuxRanks` + two centering
passes). Do it as part of the class/state diagram greenfield
(phase G-3/G-4) when layout quality matters most. Gap P-4 can wait
until class diagram compartment rendering.

---

### 6. `splines.ts` — REIMPLEMENT

**C source:**
- `~/git/graphviz/lib/dotgen/dotsplines.c` (2309 lines)
- `~/git/graphviz/lib/common/splines.c` (1375 lines)
- `~/git/graphviz/lib/common/routespl.c` (1042 lines)
- **Total: ~4726 lines**

**TS file:** `src/core/dot/splines.ts` (536 lines) — 8.8:1 line gap

The TypeScript port uses a visibility-graph + Dijkstra obstacle
avoidance approach. The C source uses a box-corridor approach built
from pre-computed per-rank routing channels. These are architecturally
incompatible — the TS approach cannot be patched to match C's output.

**Reason the current approach is insufficient:**

C's routing pipeline:
1. **`maximal_bbox()`** (`dotsplines.c:2168–2225`): For each virtual
   node on a long edge, compute the allowed horizontal routing band
   (left boundary = right edge of left sibling; right boundary = left
   edge of right sibling). This gives a per-rank rectangular channel.
2. **`make_regular_edge()`** (`dotsplines.c:1783–1845`): Assemble the
   per-rank bounding boxes into a corridor from tail to head.
3. **`routesplines_()`** → **`Pshortestpath()`** + **`Proutespline()`**
   (`routespl.c`): Find the shortest path through the polygon formed by
   the corridor, then fit a spline through it. The polygon approach
   guarantees the spline stays in the reserved channel.
4. **`clip_and_install()`** (`dotsplines.c:1560–1650`): Binary-search
   bezier clipping against the actual node shape boundary to find the
   precise entry/exit point.
5. **`edge_normalize()`** (`dotsplines.c:1650–1720`): For reversed
   edges, re-reverse control points and swap arrowhead flags.

The TS approach uses virtual node centers as waypoints and Catmull-Rom
smoothing. It has no routing channel, no shortest-path polygon, no
binary-search clipping, and no reversed-edge normalization.

**What the reimplement requires:**

Minimum viable reimplementation for correct long-edge routing:

```
makeBBoxCorridors(longEdge, graph)   — Gap S-3 prerequisite
make_regular_edge(longEdge, corridors) — assemble ranked channel
routePolylineInCorridor(corridor)    — simplified routesplines_
clip_and_install(edge, fromNode, toNode, rankDir) — face snap
edge_normalize(edge)                 — reverse control pts for reversed edges
```

For self-loops, flat edges, and short edges the current approach is
acceptable. The full reimplement is required only for long edges
(span > 1).

**Estimated scope:** 600–900 lines of new TypeScript in splines.ts.
The existing `fitBezier`, `ellipseEdgePoint`, `smoothPolyline`,
`routeParallelEdge`, `routeSelfLoop`, and `routeFlatEdge` can be
retained. Only `routeLongEdge` needs replacement.

**Additional splines gaps that must be addressed in the reimplement:**

- **S-1**: `tailportY` is stored but never used. The rewrite must feed
  `tailportY` into the start-point calculation (`beginpath` equivalent).
- **S-4**: `adjustEndpoints` exists and is exported but is never called
  from `routeEdges`. Either integrate it correctly or remove it.
- **S-5**: Labeled flat edge routing falls through to the detour arc
  path. `make_flat_labeled_edge` must be added.
- **S-6**: Multiple parallel long edges get no x-offset fanning.
  Add a Multisep offset per the `make_regular_edge` multi-edge loop.

---

## Prioritized implementation plan

### Priority 1 — Immediate small fixes (one commit each)

These are individually small and improve existing diagram types now.

**M-2: `left2right` guard in `sortLayerByMedian`** (`mincross.ts:67`)
```typescript
// Inside the sort comparator, before computing medians:
const rankConstraints = flatMatrix?.get(/* rank of a/b */);
if (rankConstraints?.get(a.id)?.has(b.id)) return -1;
if (rankConstraints?.get(b.id)?.has(a.id)) return 1;
```
Note: the current call site does not pass `flatMatrix` to
`sortLayerByMedian`. The signature and call site at lines 382–383
and 390–391 must be updated to thread it through.

**R-3: `minmax_edges2`** (`rank.ts`) — see deepdive doc for code.
Low frequency issue; safe to add in < 30 lines.

**S-4: `adjustEndpoints` dead code** — either call it correctly or
delete it. It is currently exported but unreachable from `routeEdges`.

### Priority 2 — Mincross BFS initial ordering (M-5)

Highest-impact single change. Adds passes 0 and 1 that seed the sweep
with BFS-derived orderings.

C source: `mincross.c:1762–1830` — `mincross_step(g, 0)` and
`mincross_step(g, 1)`. Pass 0 does a BFS from source nodes (zero
in-degree) and assigns layer orders top-down; pass 1 does the same
from sinks bottom-up.

Implementation location: before the `for (let iter = 0; iter < MAX_ITER; iter++)` loop in `minimizeCrossings` (`mincross.ts:375`).

```typescript
// Pass 0: BFS from sources
const sources = [...layers.get(minRank)!];
bfsOrderPass(sources, layers, edges, 'down');
flat_reorder(layers, flatMatrix);

// Pass 1: BFS from sinks (reverse)
const sinks = [...layers.get(maxRank)!];
bfsOrderPass(sinks, layers, edges, 'up');
flat_reorder(layers, flatMatrix);

// Snapshot best from these passes before the iterative loop
bestCrossings = countCrossings(edges);
bestSnapshot = snapshotOrders(nodes);
```

Where `bfsOrderPass` assigns each layer's ordering based on the
average position of neighbors in the adjacent layer (simplified
median without the weighted-median detail).

### Priority 3 — Component decomposition (M-6)

Wraps `minimizeCrossings` with a weakly-connected-components split
before the sweep loop. For diagrams where all nodes are connected this
is a no-op. For diagrams with disconnected clusters it prevents
cross-cluster median corruption.

C source: `decomp.c:130 lines` — `decomp()` / `recomp()`.

Estimated scope: ~60 lines wrapping the existing `minimizeCrossings`
logic.

### Priority 4 — `splines.ts` rewrite (long edges)

This is the largest single item. The rewrite target is `routeLongEdge`
only — the other route functions (`routeShortEdge`, `routeSelfLoop`,
`routeParallelEdge`, `routeFlatEdge`) are adequate.

**Scope within `splines.ts`:**

```
REMOVE: routeLongEdge (current, lines 180–198)

ADD:
  makeBBoxCorridors(edge, graph): BoxCorridor[]
  // C: maximal_bbox() dotsplines.c:2168–2225
  // For each virtual node: left/right x bounds from left/right sibling nodes

  routeLongEdgeInCorridor(edge, corridors): void
  // C: make_regular_edge() dotsplines.c:1783–1845 (simplified)
  //    routesplines_() routespl.c (simplified: path through corridor midpoints)
  //    clip_and_install() dotsplines.c:1560–1650 (simplified: face-snap)
  //    edge_normalize() dotsplines.c:1650–1720 (reverse pts for reversed edges)

  applyTailPort(edge): Point
  // C: beginpath() splines.c:378–573
  // When edge.tailportY defined, start from that y on the node face
```

**Estimated lines:** 600–900 new lines in `splines.ts`.
The `makeBBoxCorridors` function requires reading the positioned
virtual nodes (already in `graph.nodes`) and the original `longEdges`
list (already available). No new data structures needed.

### Priority 5 — NS-on-auxiliary-graph for x-assignment (P-5)

Replace `solveAuxRanks` + `centerBySuccessors` + `centerByPredecessors`
with a single NS solve on the auxiliary constraint graph.

This is medium complexity (~200 lines replacing existing code) and
fixes the "wider than upstream" tendency in label-heavy diagrams. Best
done together with the class/state diagram greenfield to validate
against upstream fixtures.

C source: `position.c:340–530` — `make_edge_pairs()` + `set_xcoords()`.

### Priority 6 — TB_balance (R-4)

Post-NS rank quality improvement. ~50 lines at the end of `assignRanks`
in `rank.ts`. Low priority — only visible on symmetric hub diagrams.

### Defer indefinitely

- **M-3** (O(E²) crossing count): Not a correctness issue. At
  plantuml-js scale (< 200 nodes) the performance is acceptable.
- **M-4** (SINGLETON weight): Very subtle visual difference. Only
  visible on diagrams with single-edge nodes, which are rare.
- **P-4** (ht1/ht2 y-spacing): No visible impact until class diagram
  compartments are implemented.
- **M-1** (`flat_mval`): Only affects nodes with zero normal-edge
  neighbors (flat-edge-only nodes), which is extremely rare in the
  diagram types currently implemented.

---

## Implementation sequencing

```
Phase A (immediate):   M-2, R-3, S-4 cleanup   (< 1 day)
Phase B (next sprint): M-5 BFS initial ordering (0.5 day)
Phase C (next sprint): M-6 component decomp     (0.5 day)
Phase D (G-3/G-4 prep): splines.ts long-edge rewrite (3–4 days)
Phase E (G-3/G-4 prep): P-5 NS x-assignment     (1–2 days)
Phase F (later):       R-4 TB_balance           (0.5 day)
```

Phases D+E together constitute the layout engine hardening needed
before class and state diagram greenfield work begins. They are not
strictly required for sequence, activity, or files diagrams.

Before phase D, apply all remaining Fix Batches from
`planning/dot-layout-deepdive.md` (Batches C and D are still open).
