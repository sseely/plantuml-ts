# T1 — rank.c vs rank.ts: Findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Verdict

**Major divergence.** rank.ts uses a two-pass longest-path heuristic. rank.c uses full
network simplex (min-cost flow on a feasible spanning tree). Rank constraints
(`same/min/max/source/sink`) are parsed in types.ts but never consumed.

---

## 1. Algorithm Gaps

### 1.1 Forward Pass (Current — rank.ts:44–59)

Topological sort + single forward sweep: `successor.rank = max(successor.rank, node.rank + edge.minLen)`.

Equivalent in rank.c: called via `rank()` at line 456 — but rank.c's `rank()` is the network
simplex solver, not a simple sweep. The sweeping approach is only an initialization step.

### 1.2 Backward Normalization (Current — rank.ts:61–85)

Reverse topological pass: moves nodes down (increases rank) if successors allow.
Computes `maxFeasible = min(successor.rank - minLen)` and uses it.

**Not in rank.c**: graphviz achieves tighter layouts through iterative pivot operations,
not a single backward pass. The backward pass is a heuristic; network simplex is optimal.

### 1.3 Virtual Node Insertion (rank.ts:87–136)

For edges with `span > minLen`, insert `span - 1` virtual nodes. Replace long edge with
unit-length chain. Store original in `graph.longEdges`.

**rank.c equivalent**: Same concept. `cleanup1()` (line 81) handles virtual edge removal.
`ED_to_virt()` / `ED_to_orig()` macros (lines 119–127) track chains. Not a gap.

### 1.4 Missing: Network Simplex Core

The full network simplex algorithm is **absent** from rank.ts. This is the largest gap.

**Pseudocode** (inferred from rank.c structure):
```
function network_simplex(graph):
  tree = feasible_tree(graph)           // spanning tree, all edges slack ≥ 0
  assign_ranks_from_tree(tree)

  while true:
    e = find_negative_slack_nontree_edge(graph)  // non-tree edge, slack < 0
    if e is null: break                  // optimal

    cycle = find_cycle(tree, entering=e)
    leaving = edge_with_min_cut_value(cycle)
    exchange_edge(tree, entering=e, leaving=leaving)
    update_ranks(tree)

  return
```

**Key functions** in rank.c:
- `rank()` (called at line 456) — network simplex solver. Defined externally (likely `level.c`).
- `feasible_tree()` — constructs initial spanning tree with slack ≥ 0. External.
- `slack(e)` — `to.rank - from.rank - minLen`. External.
- `exchange_edge()` — pivot: add entering, remove leaving. External.
- `cut value` — min-cost flow value on a tree edge; DFS-derived.

All unknowns can be resolved by reading `~/git/graphviz/lib/dotgen/level.c`.

---

## 2. Rank Constraint Support

### 2.1 Current TS Status

`DotInputNode.attributes.rank` (types.ts:5–7) is defined but **never consumed** by `assignRanks`.

### 2.2 Graphviz Implementation

**Rankset collapsing** (`collapse_rankset`, rank.c:179–216):
- Union-find merge: `UF_union(u, v)` (lines 188, 315) groups nodes in the same rankset.
- Ranktype stored in `ND_ranktype(u) = kind`.
- min/source ranksets: merged into `GD_minset(g)` (line 199).
- max/sink ranksets: merged into `GD_maxset(g)` (line 207).

**Collapse entry** (`collapse_sets`, rank.c:347–363): Recurse through subgraphs calling
`collapse_rankset` for each one with a rank attribute.

**Enforcement via edge reversal** (`minmax_edges`, rank.c:389–419):
- Max-rankset node with outgoing edges → reverse them (line 408).
- Min-rankset node with incoming edges → reverse them (line 415).
- Returns length info for virtual edge creation (line 418).

**Virtual edge anchoring** (`minmax_edges2`, rank.c:422–440):
- Adds virtual edges from sinks → max-rankset and min-rankset → sources.
- Prevents rankset nodes from floating away from their constrained position.

**Propagation** (`expand_ranksets`, rank.c:466–501):
- After ranking, copy leader's rank to all union-find members.

### 2.3 Required New Type Fields

**DotNode** additions:
```typescript
ranktype?: 'same' | 'min' | 'max' | 'source' | 'sink';
ufParent?: DotNode;    // union-find parent
ufSize?: number;       // union-find rank
```

**DotEdge** additions:
```typescript
slack?: number;        // to.rank - from.rank - minLen
inTree?: boolean;      // part of feasible spanning tree
cutValue?: number;     // for finding entering edges
```

**DotWorkingGraph** additions:
```typescript
minSetLeader?: DotNode | null;   // leader of min/source rankset
maxSetLeader?: DotNode | null;   // leader of max/sink rankset
treeRoot?: DotNode;              // root of spanning tree
```

---

## 3. Edge Cases

| Case | rank.c behavior | rank.ts behavior | Gap |
|------|----------------|-----------------|-----|
| Disconnected components | Ranks each component independently (`rank1` loops over `GD_comp`, lines 447–458) | Topological sort on whole graph; components get assigned independently by accident | Minor — no explicit component tracking but output is usually correct |
| Self-loops | `acyclic()` call at line 512 reverses them first | `topologicalOrder` never enqueues a node whose in-degree never reaches 0 → **silently drops the node** | **Critical** — self-loops cause rank.ts to drop nodes |
| `minLen > 1` | Handled correctly by network simplex as arbitrary constraint | Correctly inserts virtual nodes when `span > minLen` (line 92) | None |
| Zero-node graph | Early exit at line 40 | Early exit at lines 40–42 | None |
| Only virtual nodes | Virtual nodes treated as normal nodes | Virtual nodes get rank from chain insertion (line 101) | None |

**Critical fix required**: Self-loops cause rank.ts to silently drop nodes. `acyclic.ts` must
be called and break cycles **before** `assignRanks`.

---

## 4. Corpus Coverage

Scanned `tests/corpus/sequence/` for rank-constraint syntax (`rank=same`, `rank=source`,
`rank=sink`, `rank=min`, `rank=max`):

| File | Constraint type |
|------|----------------|
| gefoci-23-kato465.puml | `{rank=same; cl4; cl7}` |
| bisava-80-gefo968.puml | `{rank=same; sh0004; ...}` |
| vofumu-22-juge103.puml | `{rank=same; sh0005; sh0004}` |
| kesogi-76-keco873.puml | `{rank=same; titi; toto}` |
| riceki-05-kaga613.puml | `{rank=same; sh0009; sh0010}` |
| kozaju-75-xote548.puml | `{rank=same; cl4; cl7}` |
| sipure-79-vesa192.puml | `{rank=source; a;}`, `{rank=sink; y1;...}` |
| necufe-72-molu081.puml | `{rank=source;...}`, `{rank=sink;...}` |
| sutisu-89-kapa227.puml | `{rank=min;...}`, `{rank=max;...}` |
| rapeba-21-jonu784.puml | `{rank=min;...}`, `{rank=max;...}` |

11 files confirmed. All use same/min/max/source/sink — no compound constraints.

---

## 5. Function Mapping

| rank.c function | Line | TS equivalent | Fidelity |
|----------------|------|--------------|---------|
| `dot_rank` | 522 | `assignRanks` | Low — entry point only |
| `dot1_rank` | 503 | `assignRanks` + new layers | Low — no rankset collapsing, no network simplex |
| `collapse_rankset` | 180 | None | Missing |
| `collapse_sets` | 347 | None | Missing |
| `minmax_edges` | 390 | None | Missing |
| `minmax_edges2` | 422 | None | Missing |
| `rank1` | 447 | Loop in `assignRanks` | Low — no component partitioning |
| `rank()` (external) | 456 call | None | **Must implement** — network simplex solver |
| `feasible_tree` (external) | 511 call | None | **Must implement** |
| `expand_ranksets` | 466 | None | Missing |
| `edgelabel_ranks` | 165 | None | Not needed yet |

---

## 6. Implementation Roadmap for T12

1. Implement union-find (`UF_union`, `UF_find` with path compression)
2. Implement `collapse_rankset` + `collapse_sets` for rank attribute parsing
3. Implement `minmax_edges` + `minmax_edges2` for constraint enforcement
4. Implement feasible spanning tree construction
5. Implement network simplex core: slack computation, entering/leaving edge selection, pivot
6. Implement `expand_ranksets` to propagate ranks from leaders to members
7. Fix self-loop handling: ensure `acyclic` runs before rank assignment

Estimated: 600–1200 lines. Network simplex alone ~200–300; rankset support ~100–200;
feasible tree and union-find ~200.
