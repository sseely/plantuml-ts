import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';

// flatMatrix[rank].get(fromId)?.has(toId) === true means fromId must appear left of toId.
type FlatMatrix = Map<number, Map<string, Set<string>>>;

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
// Each neighbor entry carries a weight (ordinary×ordinary=1, one virtual=2, both virtual=4).
// portOffset shifts the effective position of the neighbor by its port offset.
function wmedian(neighbors: Array<{ node: DotNode; weight: number; portOffset: number }>): number {
  if (neighbors.length === 0) return -1;
  // Sort by effective position (order + portOffset); accumulate weighted positions list
  const sorted = [...neighbors].sort(
    (a, b) => (a.node.order + a.portOffset) - (b.node.order + b.portOffset),
  );
  // Build expanded position array where each entry appears weight times
  const pos: number[] = [];
  for (const { node, weight, portOffset } of sorted) {
    for (let w = 0; w < weight; w++) {
      pos.push(node.order + portOffset);
    }
  }
  const m = Math.floor(pos.length / 2);
  if (pos.length % 2 === 1) return pos[m]!;
  if (pos.length === 2) return (pos[0]! + pos[1]!) / 2;
  const left = pos[m - 1]! - pos[0]!;
  const right = pos[pos.length - 1]! - pos[m]!;
  return (pos[m - 1]! * right + pos[m]! * left) / (left + right);
}

function edgeWeight(from: DotNode, to: DotNode): number {
  if (from.virtual && to.virtual) return 4;
  if (from.virtual || to.virtual) return 2;
  return 1;
}

function sortLayerByMedian(
  layer: DotNode[],
  neighborMap: Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>>,
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
): Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>> {
  const map = new Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>>();
  for (const node of layer) map.set(node.id, []);
  if (direction === 'pred') {
    // Down-sweep: each node in layer gets its predecessors (one rank above)
    for (const edge of edges) {
      const entry = map.get(edge.to.id);
      if (entry !== undefined && edge.from.rank === edge.to.rank - 1) {
        entry.push({
          node: edge.from,
          weight: edgeWeight(edge.from, edge.to),
          portOffset: edge.tailportY ?? 0,
        });
      }
    }
  } else {
    // Up-sweep: each node in layer gets its successors (one rank below)
    for (const edge of edges) {
      const entry = map.get(edge.from.id);
      if (entry !== undefined && edge.to.rank === edge.from.rank + 1) {
        entry.push({
          node: edge.to,
          weight: edgeWeight(edge.from, edge.to),
          portOffset: 0,
        });
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

// flat_breakcycles (mincross.c:1105-1131)
// DFS cycle detection on flat edges within each rank.
// Returns a FlatMatrix: flatMatrix[rank].get(fromId)?.has(toId) == true means fromId must be left of toId.
function flat_breakcycles(
  layers: Map<number, DotNode[]>,
  flatAdj: Map<number, Map<string, string[]>>,
): FlatMatrix {
  const flatMatrix: FlatMatrix = new Map();

  for (const [rank, layer] of layers) {
    const adj = flatAdj.get(rank);
    if (adj === undefined || adj.size === 0) continue;

    const nodeSet = new Set(layer.map((n) => n.id));
    const visited = new Set<string>();
    const onStack = new Set<string>();
    // After cycle breaking, store directed edges as constraints
    const constraints = new Map<string, Set<string>>();
    for (const id of nodeSet) constraints.set(id, new Set());

    // Working copy of adjacency that we can mutate (reverse back-edges)
    const workAdj = new Map<string, string[]>();
    for (const [from, tos] of adj) {
      workAdj.set(from, [...tos]);
    }

    function dfsBreak(nodeId: string): void {
      visited.add(nodeId);
      onStack.add(nodeId);
      const neighbors = workAdj.get(nodeId) ?? [];
      for (let i = 0; i < neighbors.length; i++) {
        const toId = neighbors[i]!;
        if (!nodeSet.has(toId)) continue;
        if (onStack.has(toId)) {
          // Back-edge — reverse it: remove from→to, add to→from in workAdj
          neighbors.splice(i, 1);
          i--;
          const toNeighbors = workAdj.get(toId);
          if (toNeighbors !== undefined) {
            toNeighbors.push(nodeId);
          } else {
            workAdj.set(toId, [nodeId]);
          }
        } else if (!visited.has(toId)) {
          dfsBreak(toId);
        }
      }
      onStack.delete(nodeId);
    }

    for (const node of layer) {
      if (!visited.has(node.id)) {
        dfsBreak(node.id);
      }
    }

    // Populate constraints from the (possibly cycle-broken) workAdj
    for (const [fromId, tos] of workAdj) {
      if (!nodeSet.has(fromId)) continue;
      for (const toId of tos) {
        if (!nodeSet.has(toId)) continue;
        constraints.get(fromId)?.add(toId);
      }
    }

    flatMatrix.set(rank, constraints);
  }

  return flatMatrix;
}

// flat_reorder (mincross.c:1339-1408)
// Topological post-order sort of nodes within a rank using flat edge constraints.
function flat_reorder(
  layers: Map<number, DotNode[]>,
  flatMatrix: FlatMatrix,
): void {
  for (const [rank, layer] of layers) {
    const maybeConstraints = flatMatrix.get(rank);
    if (maybeConstraints === undefined || maybeConstraints.size === 0) continue;
    // Capture as an explicit non-optional alias so the nested DFS closure
    // is not affected by TypeScript's control-flow widening.
    const rankConstraints: Map<string, Set<string>> = maybeConstraints;

    const nodeIds = layer.map((n) => n.id);
    const nodeSet = new Set(nodeIds);

    // Topological sort via DFS post-order
    const visited = new Set<string>();
    const postOrder: string[] = [];

    function dfsOrder(nodeId: string): void {
      visited.add(nodeId);
      const succs = rankConstraints.get(nodeId);
      if (succs !== undefined) {
        for (const toId of succs) {
          if (nodeSet.has(toId) && !visited.has(toId)) {
            dfsOrder(toId);
          }
        }
      }
      postOrder.push(nodeId);
    }

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        dfsOrder(nodeId);
      }
    }

    // Reverse post-order gives topological order (roots first)
    postOrder.reverse();

    // Build id→node map
    const nodeById = new Map<string, DotNode>();
    for (const node of layer) nodeById.set(node.id, node);

    // Rearrange layer in topological order; nodes not in postOrder stay appended
    const seen = new Set<string>();
    const newOrder: DotNode[] = [];
    for (const id of postOrder) {
      const node = nodeById.get(id);
      if (node !== undefined) {
        newOrder.push(node);
        seen.add(id);
      }
    }
    for (const node of layer) {
      if (!seen.has(node.id)) newOrder.push(node);
    }

    // Update layer in-place and reassign order values
    for (let i = 0; i < layer.length; i++) {
      layer[i] = newOrder[i]!;
      layer[i]!.order = i;
    }
  }
}

// Swap adjacent pairs in each layer when the swap reduces global crossings.
// Returns true if any swap improved the count.
// flatMatrix: when provided, skips any swap that would violate a flat ordering constraint.
function transpose(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  flatMatrix?: FlatMatrix,
): boolean {
  let improved = false;
  for (const [rank, layer] of layers) {
    const rankConstraints = flatMatrix?.get(rank);
    for (let i = 0; i < layer.length - 1; i++) {
      const nodeA = layer[i]!;
      const nodeB = layer[i + 1]!;
      // The swap would put nodeB at position i (before nodeA).
      // Skip if A must appear left of B — swapping would violate that constraint.
      if (rankConstraints?.get(nodeA.id)?.has(nodeB.id)) {
        continue;
      }
      const before = countCrossings(edges);
      layer[i] = nodeB;
      layer[i + 1] = nodeA;
      layer[i]!.order = i;
      layer[i + 1]!.order = i + 1;
      if (countCrossings(edges) < before) {
        improved = true;
      } else {
        layer[i] = nodeA;
        layer[i + 1] = nodeB;
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

// Build per-rank flat-edge adjacency from edges where from.rank === to.rank.
function buildFlatAdj(edges: DotEdge[]): Map<number, Map<string, string[]>> {
  const flatAdj = new Map<number, Map<string, string[]>>();
  for (const edge of edges) {
    if (edge.from.rank !== edge.to.rank) continue;
    if (edge.from.id === edge.to.id) continue; // self-loops carry no ordering information
    const rank = edge.from.rank;
    let rankMap = flatAdj.get(rank);
    if (rankMap === undefined) {
      rankMap = new Map();
      flatAdj.set(rank, rankMap);
    }
    const list = rankMap.get(edge.from.id);
    if (list !== undefined) {
      list.push(edge.to.id);
    } else {
      rankMap.set(edge.from.id, [edge.to.id]);
    }
  }
  return flatAdj;
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

  // Build flat-edge adjacency and compute constraints (with cycle breaking).
  const flatAdj = buildFlatAdj(edges);
  const flatMatrix = flat_breakcycles(layers, flatAdj);

  // Apply flat-edge topological ordering as initial within-rank order.
  flat_reorder(layers, flatMatrix);

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

    // Re-impose flat-edge constraints that the median sweep may have disturbed.
    // Graphviz calls flat_reorder after each sweep pass (mincross.c do_mincross loop).
    flat_reorder(layers, flatMatrix);

    // Adjacent-swap pass to escape barycenter local minima
    let round = 0;
    while (round < MAX_TRANSPOSE_ROUNDS && transpose(layers, edges, flatMatrix)) {
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
