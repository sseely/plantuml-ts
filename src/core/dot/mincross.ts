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

function barycenter(node: DotNode, neighbors: DotNode[]): number {
  if (neighbors.length === 0) return node.order;
  let sum = 0;
  for (const n of neighbors) sum += n.order;
  return sum / neighbors.length;
}

function sortLayerByBarycenter(
  layer: DotNode[],
  neighborMap: Map<string, DotNode[]>,
): void {
  layer.sort((a, b) => {
    const neighborsA = neighborMap.get(a.id) ?? [];
    const neighborsB = neighborMap.get(b.id) ?? [];
    const ba = barycenter(a, neighborsA);
    const bb = barycenter(b, neighborsB);
    if (ba !== bb) return ba - bb;
    return a.order - b.order;
  });
  for (let i = 0; i < layer.length; i++) {
    layer[i]!.order = i;
  }
}

function buildNeighborMap(
  layer: DotNode[],
  edges: DotEdge[],
  rank: number,
  direction: 'pred' | 'succ',
): Map<string, DotNode[]> {
  const map = new Map<string, DotNode[]>();
  for (const node of layer) map.set(node.id, []);
  for (const edge of edges) {
    if (direction === 'pred') {
      if (edge.from.rank === rank && edge.to.rank === rank + 1) {
        map.get(edge.to.id)?.push(edge.from);
      }
    } else {
      if (edge.from.rank === rank - 1 && edge.to.rank === rank) {
        map.get(edge.from.id)?.push(edge.to);
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

  const MAX_ITER = 24;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    for (let r = minRank + 1; r <= maxRank; r++) {
      const layer = layers.get(r);
      if (layer === undefined || layer.length === 0) continue;
      sortLayerByBarycenter(layer, buildNeighborMap(layer, edges, r - 1, 'pred'));
    }

    for (let r = maxRank - 1; r >= minRank; r--) {
      const layer = layers.get(r);
      if (layer === undefined || layer.length === 0) continue;
      sortLayerByBarycenter(layer, buildNeighborMap(layer, edges, r, 'succ'));
    }

    const current = countCrossings(edges);
    if (current < bestCrossings) {
      bestCrossings = current;
      bestSnapshot = snapshotOrders(nodes);
    }

    if (bestCrossings === 0) break;
  }

  restoreOrders(nodes, bestSnapshot);
}
