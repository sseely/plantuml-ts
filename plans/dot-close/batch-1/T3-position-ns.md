# T3 — P-4 ht1/ht2 y-spacing + P-5 NS x-assignment

## Context

Project: TypeScript port of PlantUML's Graphviz dot layout engine.
Working directory: /Users/scottseely/git/plantuml-js
Stack: TypeScript, vitest. Commit style: Conventional Commits.

`src/core/dot/position.ts` assigns x/y coordinates after rank assignment.
Two gaps remain:

**P-4:** y-spacing uses `max(heights) + rankSep` uniformly. C computes
per-rank upper/lower half-heights (ht1/ht2) for asymmetric nodes. All current
nodes are symmetric (ht1 = ht2 = height/2), so the formula is the same — but
wiring the correct model now prepares for class diagram compartments.

**P-5:** x-assignment uses Bellman-Ford (`solveAuxRanks`) + two centering
passes (`centerBySuccessors`, `centerByPredecessors`). C uses network simplex
on an auxiliary constraint graph that simultaneously satisfies separation
constraints AND minimizes total edge length (centering). The current approach
over-spreads nodes.

Read `src/core/dot/position.ts` in full before changing anything (460 lines).

## Task

### P-4 — ht1/ht2 y-spacing in `assignTB`

In `assignTB`, replace the `maxH` y-spacing block:
```typescript
// Current:
const maxH = Math.max(...nodesInRank.map((n) => n.height));
if (i < ranks.length - 1) {
  y += maxH + graph.rankSep;
}
```

With the ht1/ht2 model:
```typescript
// C: set_ycoords() position.c:170-205
// ht1[r] = max upper half-height in rank r = max(n.height / 2)
// ht2[r] = max lower half-height in rank r = max(n.height / 2)
// For symmetric nodes: ht1 = ht2 = height/2, so spacing = ht2[r] + ht1[r+1] + rankSep
//                    = height[r]/2 + height[r+1]/2 + rankSep
// (same as current when all nodes have equal height, but correct when heights differ)
const ht2r = Math.max(...nodesInRank.map((n) => n.height / 2));
if (i < ranks.length - 1) {
  const nextRank = byRank.get(ranks[i + 1]!)!;
  const ht1next = Math.max(...nextRank.map((n) => n.height / 2));
  y += ht2r + ht1next + graph.rankSep;
}
```

Also record `ht1[r]` for the y origin of each rank:
```typescript
// Each rank's top-left y = accumulated y offset (the top of the tallest node's
// upper half, which is the rank band's top edge)
// For symmetric nodes: node.y = rankY - ht1 where ht1 = height/2
// So node.y is the top-left corner as before.
const ht1r = Math.max(...nodesInRank.map((n) => n.height / 2));
rankY.set(r, y - ht1r); // top-left of bounding box
```

Wait — read the existing `assignTB` carefully. Currently `rankY` stores the y
position that gets set to `node.y`. Keep that same convention: `node.y` = top-left
corner of the bounding box. The ht1/ht2 model changes the *gap between ranks*,
not the y origin convention. So:

```typescript
let y = 0; // tracks the center-line of the current rank
for (let i = 0; i < ranks.length; i++) {
  const r = ranks[i]!;
  const nodesInRank = byRank.get(r)!;
  const ht1r = Math.max(...nodesInRank.map((n) => n.height / 2));
  const ht2r = Math.max(...nodesInRank.map((n) => n.height / 2));
  rankY.set(r, y - ht1r); // top-left = center - upper half
  if (i < ranks.length - 1) {
    const nextRank = byRank.get(ranks[i + 1]!)!;
    const ht1next = Math.max(...nextRank.map((n) => n.height / 2));
    y += ht2r + graph.rankSep + ht1next;
  }
}
```

For symmetric nodes where all ht1=ht2=h/2: `y += h/2 + rankSep + h_next/2`.
**Verify this produces the same layout as before** for the symmetric case before
committing.

---

### P-5 — NS x-assignment replacing Bellman-Ford + centering passes

**C source:** `position.c:340–530` — `make_edge_pairs()` + `set_xcoords()`.

Add a self-contained `solveAuxNS` function in `position.ts`. This is a
simplified NS that works on a flat auxiliary graph of separation constraints:

```typescript
// Auxiliary graph node: wraps a DotNode or is a slack node (for centering)
type AuxNode = { id: string; x: number };

// Auxiliary graph edge: separation constraint
type AuxConstraint = {
  from: AuxNode;
  to: AuxNode;
  minLen: number;   // to.x - from.x >= minLen
  weight: number;   // higher weight = NS tries harder to make len = minLen
};
```

**Algorithm** (C: position.c network simplex, simplified):

The full NS for x-assignment is complex. Use the following approach that
preserves the separation guarantees while improving centering:

1. Build NODENODE constraints from `make_LR_constraints` (already exists).
2. For each real edge (cross-rank), add a SLACK centering constraint: a
   synthetic slack node `S_ij` connected to both endpoints with `minLen = 0`
   and `weight = edge.weight ?? 1`. This models C's slack nodes.
3. Run iterative relaxation (Bellman-Ford is fine for the NODENODE part), but
   then apply slack-node centering by computing the average x of each slack
   node's two neighbors and snapping to the midpoint:

```typescript
function solveAuxNS(
  nodes: DotNode[],
  constraints: AuxEdge[], // NODENODE separation constraints
  realEdges: DotEdge[],   // for centering
  graph: DotWorkingGraph,
): void {
  // Step 1: Satisfy separation constraints (existing Bellman-Ford — unchanged)
  solveAuxRanks(nodes, constraints); // re-use existing function

  // Step 2: Iterative centering pass (replaces centerBySuccessors +
  //         centerByPredecessors). C achieves this via NS slack nodes.
  // Run up to 4 passes of: for each real edge, pull both endpoints toward
  // the average of their connected neighbors, then re-enforce constraints.
  const byRank = groupByRank(nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  for (let pass = 0; pass < 4; pass++) {
    // Pull each node toward average center of its real-edge neighbors
    const pull = new Map<DotNode, { sum: number; cnt: number }>();
    for (const node of nodes) pull.set(node, { sum: 0, cnt: 0 });
    for (const edge of realEdges) {
      const cx = (edge.from.x + edge.from.width / 2 + edge.to.x + edge.to.width / 2) / 2;
      const fp = pull.get(edge.from)!;
      fp.sum += cx - edge.from.width / 2; fp.cnt++;
      const tp = pull.get(edge.to)!;
      tp.sum += cx - edge.to.width / 2; tp.cnt++;
    }
    for (const node of nodes) {
      const { sum, cnt } = pull.get(node)!;
      if (cnt > 0) node.x = sum / cnt;
    }
    // Re-enforce left-to-right constraints after pull
    for (const rank of ranks) {
      const layer = byRank.get(rank)!.slice().sort((a, b) => a.order - b.order);
      for (let i = 1; i < layer.length; i++) {
        const prev = layer[i - 1]!;
        const curr = layer[i]!;
        const minX = prev.x + prev.width + graph.nodeSep;
        if (curr.x < minX) curr.x = minX;
      }
    }
  }
  // Normalize minimum x to >= 0
  const minX = Math.min(...nodes.map((n) => n.x));
  if (minX < 0) for (const n of nodes) n.x -= minX;
}
```

**Replace** in `assignTB`:
```typescript
// OLD:
solveAuxRanks(graph.nodes, constraints);
const minXBefore = Math.min(...graph.nodes.map((n) => n.x));
if (minXBefore < 0) { for (const node of graph.nodes) node.x -= minXBefore; }
centerBySuccessors(graph, byRank, ranks);
centerByPredecessors(graph, byRank, ranks);

// NEW:
solveAuxNS(graph.nodes, constraints, graph.edges, graph);
```

Keep `centerVirtualNodes(graph.longEdges)` unchanged after the call.

Do the same for `assignLR` (replace the Bellman-Ford y-solve + `centerByChildrenY`
+ `centerByParentsY` with an analogous `solveAuxNS` adapted for y-axis).

**IMPORTANT:** After replacing, run `npm test` and check that all existing
`position.test.ts` tests pass. If any fail due to slightly different x values,
adjust the centering iteration count (try 2–8 passes) until they pass. The
separation constraints (no overlaps) must always hold.

If `solveAuxNS` makes things measurably worse on existing tests and cannot
be tuned to pass them, **stop and report** rather than diverging from the test
baseline. Do NOT delete `solveAuxRanks` until the new solver passes all tests.

---

## Write-set

- `src/core/dot/position.ts`
- `tests/unit/dot/position.test.ts`

## Read-set

- `src/core/dot/position.ts` — full file (460 lines)
- `src/core/dot/types.ts` — `DotWorkingGraph`, `DotNode`, `DotEdge`
- `decisions.md` — D-4, D-5

## Acceptance criteria

**P-4:**
- Given two adjacent ranks with node heights H1 and H2, when y-coords are
  assigned, spacing between rank center-lines = H1/2 + rankSep + H2/2
- Given uniform node heights (all H), result is identical to old formula
  (non-regression)

**P-5:**
- Given two nodes in the same rank, their horizontal separation ≥ nodeSep +
  their widths (separation constraint always satisfied)
- Given a chain A→B→C in consecutive ranks, B's x is within `nodeSep` of
  the midpoint between A's center-x and C's center-x
- All existing `position.test.ts` tests pass

## Quality bar

```sh
npm run typecheck && npm run lint && npm run build
npm test  # all N tests pass, 0 failing
```

One commit: `fix(dot): P-4 ht1/ht2 y-spacing, P-5 NS x-assignment`
