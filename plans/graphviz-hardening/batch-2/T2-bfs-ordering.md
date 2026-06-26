# T2 — M-5: BFS-seeded passes 0 and 1 in `minimizeCrossings`

## Context

This is a TypeScript port of PlantUML's graphviz dot layout engine.
The project is GPL-3.0, uses vitest for tests, and has strict 90/90/90
coverage thresholds. All layout code lives in `src/core/dot/`.

Key rule: **do not refactor while porting**. Port the C algorithm
faithfully. Names like `mincross_step`, `bfsOrderPass` are appropriate.

Quality gate (run before committing):
```sh
npm test && npm run typecheck && npm run lint && npm run build
```

## Prerequisite

Batch 1 (T1) must be complete. In particular, `sortLayerByMedian` now
accepts a `flatMatrix` parameter (4th arg, optional). The BFS passes
must also call `flat_reorder` after each pass.

## Task

Add BFS-seeded passes 0 and 1 to `minimizeCrossings` in
`src/core/dot/mincross.ts`.

**C reference:** `mincross.c:1762–1830` — `do_mincross()`:
```c
mincross_step(g, 0, &graphx, rank);   // pass 0: BFS from sources top-down
mincross_step(g, 1, &graphx, rank);   // pass 1: BFS from sinks bottom-up
// ... snapshot best ...
for (iter = 0; ...) { mincross_step(g, iter, ...); ... }
```

### New helper: `bfsOrderPass`

Add this private function to `mincross.ts`:

```typescript
// mincross.c:do_mincross passes 0 and 1 — BFS-derived initial ordering.
// direction='down': BFS from source nodes, assign orders top-down.
// direction='up':   BFS from sink nodes, assign orders bottom-up.
function bfsOrderPass(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  ranks: number[],
  direction: 'down' | 'up',
): void {
  const orderedRanks = direction === 'down' ? ranks : [...ranks].reverse();
  for (let ri = 1; ri < orderedRanks.length; ri++) {
    const rank = orderedRanks[ri]!;
    const prevRank = orderedRanks[ri - 1]!;
    const layer = layers.get(rank)!;
    if (layer === undefined || layer.length === 0) continue;
    const prevLayer = layers.get(prevRank)!;
    if (prevLayer === undefined || prevLayer.length === 0) continue;

    // For each node in layer, compute average order of neighbors in prevLayer
    const avgPos = new Map<string, number>();
    for (const node of layer) {
      const neighbors: number[] = [];
      for (const edge of edges) {
        if (direction === 'down' && edge.to === node && edge.from.rank === prevRank) {
          neighbors.push(edge.from.order);
        } else if (direction === 'up' && edge.from === node && edge.to.rank === prevRank) {
          neighbors.push(edge.to.order);
        }
      }
      avgPos.set(node.id, neighbors.length > 0
        ? neighbors.reduce((s, v) => s + v, 0) / neighbors.length
        : node.order);
    }

    layer.sort((a, b) => {
      const pa = avgPos.get(a.id) ?? a.order;
      const pb = avgPos.get(b.id) ?? b.order;
      if (pa !== pb) return pa - pb;
      return a.order - b.order; // stable: preserve existing order on tie
    });
    for (let i = 0; i < layer.length; i++) {
      layer[i]!.order = i;
    }
  }
}
```

### Changes to `minimizeCrossings`

The current loop starts at `mincross.ts:375`:
```typescript
let bestCrossings = countCrossings(edges);
let bestSnapshot = snapshotOrders(nodes);
let trying = 0;

for (let iter = 0; iter < MAX_ITER; iter++) {
```

Replace with:

```typescript
// Pass 0: BFS from sources (mincross.c:do_mincross pass 0)
bfsOrderPass(layers, edges, ranks, 'down');
flat_reorder(layers, flatMatrix);

// Pass 1: BFS from sinks (mincross.c:do_mincross pass 1)
bfsOrderPass(layers, edges, ranks, 'up');
flat_reorder(layers, flatMatrix);

// Snapshot best ordering from the BFS seeding before the iterative loop
let bestCrossings = countCrossings(edges);
let bestSnapshot = snapshotOrders(nodes);
let trying = 0;

for (let iter = 0; iter < MAX_ITER; iter++) {
```

The `ranks` variable is already in scope (line 356 of the current file):
`const ranks = [...layers.keys()].sort((a, b) => a - b);`

## Write-set

- `src/core/dot/mincross.ts`
- `tests/unit/dot/mincross.test.ts`

## Read-set

- `src/core/dot/mincross.ts` — full file (read it all before editing)
- `src/core/dot/types.ts` — `DotNode`, `DotEdge`, `DotWorkingGraph`
- `tests/unit/dot/mincross.test.ts` — existing tests
- `planning/graphviz-audit.md` — Gap M-5 section
- `~/git/graphviz/lib/dotgen/mincross.c:1762–1830` — C reference

## Architecture decisions

- See `plans/graphviz-hardening/decisions.md`
- Tie-breaking in `bfsOrderPass`: preserve existing order (stable sort)
- `bfsOrderPass` is a private function — do not export it
- Do not change `buildNeighborMap`, `wmedian`, or `edgeWeight`

## Acceptance criteria

1. **Given** a linear chain A→B→C→D (4 nodes across 4 ranks), **when**
   `minimizeCrossings` runs, **then** pass 0 assigns each layer an order
   derived from BFS depth from the source (A at rank 0), not insertion order.

2. **Given** the same chain, **when** `minimizeCrossings` runs, **then**
   pass 1 assigns orders derived from BFS depth from the sink (D at rank 3).

3. **Given** `bestCrossings` is snapshotted after passes 0+1, **when** the
   iterative loop finds only a worse solution, **then** `restoreOrders`
   returns to the BFS-seeded snapshot.

4. **Given** a graph with zero edges (all isolated nodes), **when**
   `bfsOrderPass` runs, **then** layer orders are unchanged (no crash,
   no mutation to non-pass nodes).

5. All existing tests continue to pass.

## Quality bar

Run `npm test && npm run typecheck && npm run lint && npm run build`
before finishing. All must pass.

## Commit message

```
fix(dot): M-5 BFS-seeded initial ordering in mincross
```
