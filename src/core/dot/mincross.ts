import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';

function groupByRank(nodes: DotNode[]): Map<number, DotNode[]> {
  const layers = new Map<number, DotNode[]>();
  for (const node of nodes) {
    const layer = layers.get(node.rank);
    if (layer !== undefined) {
      layer.push(node);
    } else {
      layers.set(node.rank, [node]);
    }
  }
  return layers;
}

function assignLayerOrders(layer: DotNode[]): void {
  layer.sort((a, b) => {
    if (a.order >= 0 && b.order >= 0) return a.order - b.order;
    if (a.order >= 0) return -1;
    if (b.order >= 0) return 1;
    return 0;
  });
  for (let i = 0; i < layer.length; i++) {
    layer[i]!.order = i;
  }
}

// Weighted median (WMEDIAN) — Gansner, Koutsofios, North, Vo 1993.
// Returns -1 for isolated nodes (no neighbors), meaning "keep current order".
function wmedian(neighbors: DotNode[]): number {
  if (neighbors.length === 0) return -1;
  const pos = neighbors.map((n) => n.order).sort((a, b) => a - b);
  const m = Math.floor(pos.length / 2);
  if (pos.length % 2 === 1) return pos[m]!;
  if (pos.length === 2) return (pos[0]! + pos[1]!) / 2;
  const left = pos[m - 1]! - pos[0]!;
  const right = pos[pos.length - 1]! - pos[m]!;
  return (pos[m - 1]! * right + pos[m]! * left) / (left + right);
}

function sortLayerByMedian(
  layer: DotNode[],
  neighborMap: Map<string, DotNode[]>,
  reverse: boolean,
): void {
  layer.sort((a, b) => {
    const ma = wmedian(neighborMap.get(a.id) ?? []);
    const mb = wmedian(neighborMap.get(b.id) ?? []);
    // -1 means isolated — sink below connected nodes, preserve relative order
    if (ma === -1 && mb === -1) return a.order - b.order;
    if (ma === -1) return 1;
    if (mb === -1) return -1;
    if (ma !== mb) return ma - mb;
    return reverse ? b.order - a.order : a.order - b.order;
  });
  for (let i = 0; i < layer.length; i++) {
    layer[i]!.order = i;
  }
}

function buildNeighborMap(
  layer: DotNode[],
  edges: DotEdge[],
  direction: 'pred' | 'succ',
): Map<string, DotNode[]> {
  const map = new Map<string, DotNode[]>();
  for (const node of layer) map.set(node.id, []);
  if (direction === 'pred') {
    // Down-sweep: each node in layer gets its predecessors (one rank above)
    for (const edge of edges) {
      const entry = map.get(edge.to.id);
      if (entry !== undefined && edge.from.rank === edge.to.rank - 1) {
        entry.push(edge.from);
      }
    }
  } else {
    // Up-sweep: each node in layer gets its successors (one rank below)
    for (const edge of edges) {
      const entry = map.get(edge.from.id);
      if (entry !== undefined && edge.to.rank === edge.from.rank + 1) {
        entry.push(edge.to);
      }
    }
  }
  return map;
}

function countCrossings(edges: DotEdge[]): number {
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i]!;
      const e2 = edges[j]!;
      if (e1.from.rank !== e2.from.rank) continue;
      if (
        (e1.from.order < e2.from.order && e1.to.order > e2.to.order) ||
        (e1.from.order > e2.from.order && e1.to.order < e2.to.order)
      ) {
        crossings++;
      }
    }
  }
  return crossings;
}

// Swap adjacent pairs in each layer when the swap reduces global crossings.
// Returns true if any swap improved the count.
function transpose(layers: Map<number, DotNode[]>, edges: DotEdge[]): boolean {
  let improved = false;
  for (const layer of layers.values()) {
    for (let i = 0; i < layer.length - 1; i++) {
      const before = countCrossings(edges);
      const tmp = layer[i]!;
      layer[i] = layer[i + 1]!;
      layer[i + 1] = tmp;
      layer[i]!.order = i;
      layer[i + 1]!.order = i + 1;
      if (countCrossings(edges) < before) {
        improved = true;
      } else {
        const tmp2 = layer[i]!;
        layer[i] = layer[i + 1]!;
        layer[i + 1] = tmp2;
        layer[i]!.order = i;
        layer[i + 1]!.order = i + 1;
      }
    }
  }
  return improved;
}

function snapshotOrders(nodes: DotNode[]): Map<string, number> {
  const snap = new Map<string, number>();
  for (const n of nodes) snap.set(n.id, n.order);
  return snap;
}

function restoreOrders(nodes: DotNode[], snap: Map<string, number>): void {
  for (const n of nodes) {
    const order = snap.get(n.id);
    if (order !== undefined) n.order = order;
  }
}

const MAX_ITER = 24;
const MIN_QUIT = 8;
const CONVERGENCE = 0.995;
const MAX_TRANSPOSE_ROUNDS = 4;

export function minimizeCrossings(graph: DotWorkingGraph): void {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return;

  const layers = groupByRank(nodes);
  const ranks = [...layers.keys()].sort((a, b) => a - b);
  const minRank = ranks[0]!;
  const maxRank = ranks[ranks.length - 1]!;

  for (const rank of ranks) {
    assignLayerOrders(layers.get(rank)!);
  }

  let bestCrossings = countCrossings(edges);
  let bestSnapshot = snapshotOrders(nodes);
  let trying = 0;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const reverse = (iter % 4) < 2;

    if (iter % 2 === 0) {
      // Down-sweep: fix each rank using predecessors
      for (let r = minRank + 1; r <= maxRank; r++) {
        const layer = layers.get(r);
        if (layer === undefined || layer.length === 0) continue;
        sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'pred'), reverse);
      }
    } else {
      // Up-sweep: fix each rank using successors
      for (let r = maxRank - 1; r >= minRank; r--) {
        const layer = layers.get(r);
        if (layer === undefined || layer.length === 0) continue;
        sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'succ'), reverse);
      }
    }

    // Adjacent-swap pass to escape barycenter local minima
    let round = 0;
    while (round < MAX_TRANSPOSE_ROUNDS && transpose(layers, edges)) {
      round++;
    }

    const current = countCrossings(edges);
    if (current < bestCrossings * CONVERGENCE) {
      trying = 0;
      bestCrossings = current;
      bestSnapshot = snapshotOrders(nodes);
    } else if (++trying >= MIN_QUIT) {
      break;
    }

    if (bestCrossings === 0) break;
  }

  restoreOrders(nodes, bestSnapshot);
}
