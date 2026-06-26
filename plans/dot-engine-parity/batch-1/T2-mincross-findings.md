# T2 — mincross.c vs mincross.ts: Findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Verdict

**Three significant gaps**: flat edge handling (entirely missing), virtual node weighting
(missing), BFS-based initial ordering (missing). Iteration parameters match closely.
Cluster support is not needed for PlantUML.

---

## 1. Flat Edge Handling

### 1.1 Upstream Detection (mincross.c)

Flat edges are edges where `from.rank === to.rank`. Represented with
`ED_edge_type(e) == FLATORDER` or `REVERSED` (lines 1064–1067).

### 1.2 flat_breakcycles (mincross.c:1105–1131)

For each rank with flat edges:
1. Initializes flat edge adjacency matrix `GD_rank(g)[r].flat` when any node has flat edges
   (lines 1118–1120).
2. Calls `flat_search()` (lines 1073–1103) — DFS cycle detection:
   - `ND_mark(v) = true`, `ND_onstack(v) = true` on entry (lines 1080–1081).
   - For each flat edge from v: if target is on stack → back-edge → set matrix to reverse
     constraint (line 1090); delete and reverse the edge (lines 1091–1095).
   - If target not visited: recurse (lines 1098–1099).
   - `ND_onstack(v) = false` on exit (line 1102).
3. Stores constraints in `GD_rank(g)[r].flat` adjacency matrix indexed by `flatindex(v)`.

### 1.3 flat_reorder (mincross.c:1339–1408)

- Skips if `!GD_has_flat_edges(g)` (line 1346).
- For each rank, constructs reverse topological sort in `temprank` via `postorder()`
  (lines 1323–1337): marks nodes with no flat out-edges as sources; DFS post-order.
- Rearranges rank nodes to match topological order (lines 1382–1385).
- Deletes non-constraint flat edges and reverses them (lines 1388–1401).

### 1.4 Transpose constraint enforcement — left2right() (mincross.c:557–579)

Called inside `transpose_step()` (line 642). If flat matrix exists for a rank:
returns `matrix_get(M, flatindex(v), flatindex(w))` — true if v must stay left of w.
Prevents swaps that violate flat edge direction constraints.

### 1.5 Current TS status

**No flat edge handling** in mincross.ts.

`buildNeighborMap()` (lines 61–86) explicitly filters to cross-rank edges only:
```typescript
if (edge.from.rank === edge.to.rank - 1) ...  // line 72
if (edge.to.rank === edge.from.rank + 1) ...  // line 80
```

`transpose()` (lines 108–130): no `left2right()` constraint, no adjacency matrix.

**Impact**: Diagrams with `together {}` or `rank=same` constraints produce incorrect
node ordering within ranks.

---

## 2. build_ranks: BFS vs Topological Sort

### 2.1 Upstream (build_ranks, mincross.c:1212–1286)

BFS from source nodes:
1. Finds nodes with no in-edges (pass=0) or no out-edges (pass=1) (lines 1246–1248).
2. `node_queue_t` queue: pop node, install in its rank (line 1255), enqueue unvisited
   neighbors (line 1259).
3. Two passes: pass=0 searches backward from sinks; pass=1 forward from sources.
   Picks the one with fewer crossings (line 1282–1283).

### 2.2 Current TS status

We do not run build_ranks — rank is pre-assigned by `rank.ts`. Initial ordering within
ranks is whatever order nodes appear in the graph's `nodes` array.

**Behavioral difference**: graphviz tries two BFS orderings and picks the better one as
the starting point for WMEDIAN. We start with input order.

**Concrete divergence example** (diamond A→B,C; B,C→D; B and C same rank):
- BFS from source (pass=1) might queue B before C → [B, C] start.
- BFS from sink (pass=0) might queue C before B → [C, B] start.
- Graphviz picks whichever has fewer crossings.
- We start with input order only → may start from a worse position and converge to
  a local minimum.

---

## 3. Virtual Node Weighting

### 3.1 Upstream (virtual_weight, mincross.c:1729–1742)

Weight table (lines 1704–1718):
```c
// node pair        weight
// ordinary×ordinary    1 (C_EE)
// ordinary×virtual     2 (C_VS)
// virtual×virtual      4 (C_VV)
```

Applied in `medians()` (lines 1621–1677): each edge's `ED_xpenalty(e)` is multiplied
by the weight class from the table (lines 1635–1636, 1640).

**Effect**: virtual nodes (long-edge segments) have 4× penalty when they cross each other,
keeping them more stable in their lanes.

### 3.2 Current TS status

`wmedian()` (lines 30–39): all neighbors have equal weight. No distinction between
virtual and ordinary nodes.

**Impact**: Virtual nodes shift more than necessary during WMEDIAN, creating unnecessary
bends in long edges.

---

## 4. Iteration Count and Convergence

### 4.1 Upstream (mincross, mincross.c:690–751)

Parameters:
- `MinQuit = 8` (line 157–158)
- `MaxIter = 24` (line 1768)
- `Convergence = 0.995` (line 159)

Main loop: run WMEDIAN + transpose up to MaxIter times. Break early if trying ≥ MinQuit.
Convergence: if `cur_cross < 0.995 * best_cross`, reset trying counter; else increment.

### 4.2 Current TS (mincross.ts:145–148, 167–202)

```typescript
const MAX_ITER = 24;
const MIN_QUIT = 8;
const CONVERGENCE = 0.995;
const MAX_TRANSPOSE_ROUNDS = 4;
```

Same parameters. **Functionally equivalent** for the core loop.

**Minor difference**: graphviz runs startpass/endpass (two-pass strategy); we run a
single pass. Impact is minor — primarily affects initialization quality.

---

## 5. Cluster Handling

Graphviz implements cluster-aware WMEDIAN (`mincross_clust`, lines 531–555). This handles
subgraph clusters with separate rank structures.

**PlantUML does not generate subgraph clusters**. PlantUML's `together {}` produces
flat edge constraints, not subgraph clusters. **Cluster handling is not needed**.

---

## 6. Corpus Coverage: Flat Edges

Corpus search for `together` / `rank=same`:

**Class diagrams with `together`** (9+ files in tests/corpus/class/):
- `foxosa-41-bono202.puml`, `buxuso-47-tara486.puml`, `mocute-04-lori647.puml`

**Sequence diagrams with `rank=same`** (5+ files in tests/corpus/sequence/):
- `gefoci-23-kato465.puml`: `{rank=same; cl4; cl7}`
- `kesogi-76-keco873.puml`: `{rank=same; titi; toto}`
- `bisava-80-gefo968.puml`: multiple `{rank=same; ...}` statements

Flat edges are actively used. Without support, crossing minimization for these diagrams
deviates from upstream.

---

## 7. Function Mapping

| mincross.c function | TS equivalent | Fidelity |
|--------------------|--------------|---------|
| `mincross()` | `minimizeCrossings()` | Partial — missing multi-pass |
| `mincross_step()` | inlined in main loop | Partial |
| `medians()` | `wmedian()` + `sortLayerByMedian()` | Partial — no virtual weighting |
| `transpose_step()` + `transpose()` | `transpose()` | Partial — no candidate flag, no left2right |
| `build_ranks()` | (caller responsibility) | Missing |
| `flat_breakcycles()` | None | **Missing** |
| `flat_reorder()` | None | **Missing** |
| `flat_search()` | None | **Missing** |
| `left2right()` | None | **Missing** |
| `virtual_weight()` | None | **Missing** |
| `in_cross()` / `out_cross()` | `countCrossings()` | Partial — no port ordering |
| `save_best()` / `restore_best()` | `snapshotOrders()` / `restoreOrders()` | Equivalent |

---

## 8. Implementation Order for T13

1. Add flat edge detection in a separate pre-pass (build adjacency matrix per rank).
2. Implement `flat_breakcycles()` — DFS with onstack detection on flat edges.
3. Implement `flat_reorder()` — postorder topological sort per rank, rearrange nodes.
4. Integrate `left2right()` check into `transpose()` — prevent swaps violating matrix.
5. Add virtual node weighting in `wmedian()` — multiply weight by 1/2/4 based on types.
6. Test against `tests/corpus/class/` files with `together` blocks and
   `tests/corpus/sequence/` files with `rank=same`.
