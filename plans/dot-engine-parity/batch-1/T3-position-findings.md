# T3 — position.c vs position.ts: Findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Verdict

**Major divergence.** position.ts uses linear greedy packing with a post-hoc centering
heuristic. position.c solves x-coordinate assignment as a constraint graph problem (rank
assignment on an auxiliary graph) that guarantees `nodeSep` for all node widths and
correctly centers virtual nodes between their real endpoints.

---

## 1. Auxiliary Graph Approach

### 1.1 Entry point: dot_position (position.c:127–154)

```
dot_position()
  → create_aux_edges()    // build constraint graph
  → rank(aux_graph)       // network simplex solver → writes x-coords into ND_rank()
  → set_xcoords()         // extract ND_rank as x; restore original rank
  → set_ycoords()         // y-coordinate assignment
```

### 1.2 create_aux_edges (position.c:525–532)

Calls:
1. `make_LR_constraints()` (lines 218–324) — left-right separation constraints between
   adjacent same-rank nodes.
2. `make_edge_pairs()` (lines 327–352) — port offset constraints for edge labels.
3. `pos_clusters()` (lines 491–499) — cluster containment constraints (not needed now).
4. `compress_graph()` (lines 501–523) — optional graph-size compression.

### 1.3 make_LR_constraints (position.c:218–324)

For each rank, for each adjacent pair (u, v):
```c
width = ND_rw(u) + ND_lw(v) + nodesep;   // line 264
make_aux_edge(u, v, width, 0);            // minLen = width
```
Creates a constraint edge `u → v` with `minLen = right_width(u) + left_width(v) + nodeSep`.

Network simplex then solves: `v.rank - u.rank ≥ minLen` for all constraint edges.
**This guarantees no two adjacent nodes overlap regardless of their widths.**

### 1.4 set_xcoords (position.c:569–584)

After network simplex overwrites `ND_rank(v)` with the x-solution:
```c
ND_coord(v).x = ND_rank(v);   // extract x-coordinate
ND_rank(v) = i;               // restore original rank
```

### 1.5 Current TS: assignTB (position.ts)

```typescript
let x = 0;
for (const node of nodesInRank) {
    node.x = x;
    x += node.width + graph.nodeSep;
}
centerBySuccessors(graph, byRank, ranks);
```

Linear left-to-right pack, then `centerBySuccessors()` shifts nodes to center over their
descendants. Order-dependent; ignores varying widths in the centering step.

**No constraint graph. No solver. No separation guarantees after centering.**

---

## 2. Node Separation Enforcement

**graphviz guarantee** (position.c:264):
`minLen = rw(u) + lw(v) + nodeSep`. Solver ensures all adjacent pairs satisfy this.

**TS overlap scenario**:
- Rank: [Wide(w=200), Narrow(w=50), Wide(w=200)]
- Linear assign: Wide1.x=0, Narrow.x=220, Wide2.x=290.
- If `centerBySuccessors` shifts Narrow left by 40 (to center over child): Narrow.x=180.
- But Wide2.x still = 290; Wide2.right = 490. Narrow.right = 180+50 = 230. OK here.
- However if Wide1 also shifts right, Wide1.right = 200 > Narrow.x = 180 → **overlap**.

The auxiliary graph approach prevents this because all separation constraints are solved
simultaneously rather than sequentially.

---

## 3. Virtual Node Centering

### 3.1 Upstream (make_edge_pairs, position.c:327–352)

Creates a SLACKNODE `sn` per long edge. Two constraint edges:
```c
make_aux_edge(sn, tail, m0 + 1, weight);   // distance from slack node to tail
make_aux_edge(sn, head, m1 + 1, weight);   // distance from slack node to head
ND_rank(sn) = MIN(ND_rank(tail) - m0 - 1, ...);  // initial x estimate
```

Port offsets `m0`, `m1` computed from `ED_head_port` / `ED_tail_port`. The solver
places `sn` horizontally between tail and head, weighted toward the midpoint.

### 3.2 Current TS

Virtual nodes have `width=0, height=0`. In `assignTB` they're packed just like any
other node in their rank:
```typescript
node.x = x;
x += node.width + nodeSep;  // 0 + nodeSep
```

Virtual node x-coordinate is order-dependent, not geometrically derived from endpoints.

**Impact**: Long edges may not travel in straight columns; edge routing must compensate.

---

## 4. Cluster Containment

`contain_clustnodes()` (position.c:354–368), `separate_subclust()` (lines 454–484):
creates left/right bounding box slack nodes for each cluster; adds containment and
separation constraints to the aux graph.

**PlantUML does not use graphviz subgraph clusters.** `together {}` blocks become
flat edge constraints (see T2). No cluster containment implementation needed.

---

## 5. Y-Coordinate Assignment

### 5.1 set_ycoords (position.c:729–822)

1. Scan ranks for max height (distinguishes `ht1` above baseline and `ht2` below, lines 737–769).
2. Compute cluster label heights recursively via `clust_ht()` (lines 682–727).
3. Assign y starting from bottom rank (line 777):
   ```c
   delta = fmax(rank[r+1].pht2 + rank[r].pht1 + GD_ranksep, cluster_sep);
   y[r] = y[r+1] + delta;
   ```
   Spacing = max(primitive node sep, cluster-aware sep).
4. Copy same y to all nodes in rank (lines 820–821).

### 5.2 Current TS

```typescript
const maxH = Math.max(...nodesInRank.map(n => n.height));
y += maxH + graph.rankSep;
```

Simple max-height-per-rank + rankSep. No cluster awareness. **Functionally adequate**
for current PlantUML scope (no cluster labels). If cluster labels are added, this must
be revisited.

---

## 6. Corpus Coverage: Wide-Node Overlap Risk

**Activity diagrams** (tests/corpus/activity/lopone-15-xiki477.puml and similar):
- Very wide action boxes (>400px text content).
- In adjacent rank with narrow decision diamond → overlap risk after centering.

**Component nesting** (tests/corpus/component/ multiple files):
- 2–3 levels deep. Deeply nested parents are wide; siblings in parent rank may collide
  if centering moves one toward its child and into a sibling.

**Sequence diagrams with dense lifelines**: many narrow participant boxes in one rank;
less risk since widths are uniform.

---

## 7. Function Mapping

| position.c function | TS equivalent | Fidelity |
|--------------------|--------------|---------|
| `dot_position()` | `assignCoordinates()` | Partial — no aux graph |
| `create_aux_edges()` | None | **Missing** — critical |
| `make_LR_constraints()` | Implicit in `assignTB` greedy packing | Partial — no constraint edges |
| `make_edge_pairs()` | None | Missing — port offsets |
| `pos_clusters()` | None | Not needed |
| `set_xcoords()` | Integrated in `assignTB` | Partial |
| `set_ycoords()` | `assignTB` / `assignLR` | Partial — no cluster awareness |
| `expand_leaves()` | None | Missing |
| `connectGraph()` | None | Missing — multi-component graphs |

---

## 8. Implementation Path for T14

1. **Build aux edge list** (model on `make_LR_constraints`):
   - For each rank, for each adjacent pair (u, v) by order:
     `constraint.minLen = u.width + nodeSep + v.width`
   - Store as a temporary auxiliary graph.

2. **Run rank assignment on aux graph**:
   - Call `assignRanks()` from rank.ts — reuse existing solver.
   - The resulting "ranks" are x-coordinates.

3. **Extract x-coordinates**:
   - `node.x = node.rank` (the aux rank value).
   - Restore original rank for the next pipeline stage.

4. **Virtual node centering**:
   - Add SLACKNODE per long edge with two constraint edges:
     `minLen_to_tail = abs(tailPort.x - headPort.x) + 1` (or uniform midpoint if no ports)
   - Let the solver place it between endpoints.

5. **y-coordinate assignment**:
   - Keep current approach (max-height-per-rank + rankSep) — adequate for present scope.

**Priority**: Steps 1–3 fix the separation guarantee and are required. Steps 4–5 are
improvements; step 4 improves long-edge routing quality.
