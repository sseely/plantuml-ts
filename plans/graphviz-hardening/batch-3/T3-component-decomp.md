# T3 — M-6: Weakly-Connected-Component Decomposition in `minimizeCrossings`

## Context

This is a TypeScript port of PlantUML's graphviz dot layout engine.
The project is GPL-3.0, uses vitest for tests, and has strict 90/90/90
coverage thresholds. All layout code lives in `src/core/dot/`.

Key rule: **do not refactor while porting**. Port the C algorithm
faithfully.

Quality gate (run before committing):
```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## Prerequisite

Batch 2 (T2) must be complete. `minimizeCrossings` now includes the
BFS passes 0+1 before the iterative loop.

## Task

Wrap `minimizeCrossings` to split the graph into weakly-connected
components (WCCs), solve each independently, then merge orders back.

**C reference:** `decomp.c` (all 130 lines) — `decomp()` builds the
component partition; `recomp()` merges ranks back.

**Problem:** Currently, a graph with two disconnected clusters (e.g.
A→B in one cluster, C→D in another) runs `wmedian` across all nodes.
Nodes in the unrelated cluster return `mval = -1` and get mixed into
the sorted order, corrupting within-cluster orderings.

### New helper: `findWeaklyConnectedComponents`

Add this private function to `mincross.ts`:

```typescript
// decomp.c — split nodes into weakly connected components.
// Edges are treated as undirected for reachability purposes.
function findWeaklyConnectedComponents(
  nodes: DotNode[],
  edges: DotEdge[],
): DotNode[][] {
  if (nodes.length === 0) return [];

  // Build undirected adjacency
  const adj = new Map<string, DotNode[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.from.rank === e.to.rank) continue; // skip flat edges for WCC
    adj.get(e.from.id)?.push(e.to);
    adj.get(e.to.id)?.push(e.from);
  }

  const visited = new Set<string>();
  const components: DotNode[][] = [];

  for (const start of nodes) {
    if (visited.has(start.id)) continue;
    const component: DotNode[] = [];
    const stack: DotNode[] = [start];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      component.push(node);
      for (const neighbor of adj.get(node.id) ?? []) {
        if (!visited.has(neighbor.id)) stack.push(neighbor);
      }
    }
    components.push(component);
  }

  return components;
}
```

### Changes to `minimizeCrossings`

At the top of `minimizeCrossings`, after building `layers`, `ranks`,
`flatAdj`, and `flatMatrix` — before any BFS passes or the main loop:

```typescript
// decomp.c — detect weakly connected components
const components = findWeaklyConnectedComponents(nodes, edges);

if (components.length > 1) {
  // Solve each component independently, then merge and return.
  // Each component gets its own layer/rank structure.
  let globalOrder = 0;
  for (const component of components) {
    const compNodeSet = new Set(component.map(n => n.id));
    const compEdges = edges.filter(
      e => compNodeSet.has(e.from.id) && compNodeSet.has(e.to.id),
    );
    // Temporarily restrict graph to this component
    const subGraph: DotWorkingGraph = {
      ...graph,
      nodes: component,
      edges: compEdges,
    };
    minimizeCrossings(subGraph);
  }
  // Reassign global orders: components packed left-to-right per rank.
  // Group component nodes by rank, assign orders within each rank group.
  const rankGroups = new Map<number, DotNode[][]>();
  for (const component of components) {
    const compRanks = new Map<number, DotNode[]>();
    for (const n of component) {
      const list = compRanks.get(n.rank);
      if (list) list.push(n);
      else compRanks.set(n.rank, [n]);
    }
    for (const [rank, compLayer] of compRanks) {
      let rg = rankGroups.get(rank);
      if (!rg) { rg = []; rankGroups.set(rank, rg); }
      rg.push(compLayer);
    }
  }
  for (const [, compLayers] of rankGroups) {
    let offset = 0;
    for (const compLayer of compLayers) {
      compLayer.sort((a, b) => a.order - b.order);
      for (const n of compLayer) n.order = offset++;
    }
  }
  return;
}

// Single component — run existing logic unchanged below
```

**Important:** The `minimizeCrossings` function is being called
recursively on sub-graphs. Ensure that the early-return guard at the
top (`if (nodes.length === 0) return;`) covers empty component edge
cases, and that the recursive call does not infinite-loop (it will not,
because each subgraph has `components.length === 1`).

## Write-set

- `src/core/dot/mincross.ts`
- `tests/unit/dot/mincross.test.ts`

## Read-set

- `src/core/dot/mincross.ts` — full file (read it before editing)
- `src/core/dot/types.ts` — `DotWorkingGraph`, `DotNode`, `DotEdge`
- `tests/unit/dot/mincross.test.ts` — existing tests
- `planning/graphviz-audit.md` — Gap M-6 section
- `plans/graphviz-hardening/decisions.md` — D-2 (WCC wrap approach)
- `~/git/graphviz/lib/dotgen/decomp.c` — C reference (all 130 lines)

## Architecture decisions

- See `plans/graphviz-hardening/decisions.md`, especially D-2
- Flat edges (same-rank edges) are ignored for WCC detection — they
  don't create cross-rank connectivity
- Component ordering in the merged result: pack left-to-right in
  the order `findWeaklyConnectedComponents` returns them
- For single-component graphs (the common case), the function returns
  immediately — zero overhead on typical diagrams

## Acceptance criteria

1. **Given** two disconnected subgraphs (A→B and C→D, no edges between
   them), **when** `minimizeCrossings` runs, **then** A and B nodes have
   orders 0,1 within their rank group, and C and D nodes have orders 0,1
   within their rank group (independently solved).

2. **Given** two disconnected subgraphs, **when** `minimizeCrossings`
   runs, **then** the wmedian of nodes in component 1 is not influenced
   by the order of nodes in component 2.

3. **Given** a fully connected graph (all nodes reachable from each
   other), **when** `minimizeCrossings` runs, **then** the result is
   identical to pre-decomposition behavior (single WCC, no-op branch).

4. **Given** a graph where all nodes are isolated (no edges at all),
   **when** `minimizeCrossings` runs, **then** each node is its own
   component and the function completes without error.

5. All existing tests continue to pass.

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build`
before finishing. All must pass.

## Commit message

```
fix(dot): M-6 WCC decomposition in minimizeCrossings
```
