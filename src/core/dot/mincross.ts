import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';
import type { FlatMatrix } from './flat.js';
import { buildFlatAdj, flat_breakcycles, flat_reorder } from './flat.js';

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

// C: flat_mval() mincross.c:1589-1617
// For a node that has zero cross-rank edges (wmedian returns -1), derive a
// position from its flat (same-rank) neighbors when they exist.
function flatMval(node: DotNode, layer: DotNode[], flatMatrix: FlatMatrix): number {
  const rankConstraints = flatMatrix.get(node.rank);
  if (!rankConstraints) return -1;
  const flatInOrders: number[] = [];
  const flatOutOrders: number[] = [];
  for (const other of layer) {
    if (other.id === node.id) continue;
    if (rankConstraints.get(other.id)?.has(node.id)) flatInOrders.push(other.order);
    if (rankConstraints.get(node.id)?.has(other.id)) flatOutOrders.push(other.order);
  }
  if (flatInOrders.length > 0) return Math.max(...flatInOrders) + 1;
  if (flatOutOrders.length > 0) return Math.min(...flatOutOrders) - 1;
  return -1;
}

// C: virtual_weight() mincross.c:1703-1742 — 3×3 weight table.
// SINGLETON: node with ≤1 cross-rank edge.
function edgeWeight(from: DotNode, to: DotNode, singletonIds: Set<string>): number {
  const fV = from.virtual, tV = to.virtual;
  const fS = !fV && singletonIds.has(from.id);
  const tS = !tV && singletonIds.has(to.id);
  if (fV && tV) return 4;
  if (fV || tV) return 2;
  if (fS && tS) return 1;
  if (fS || tS) return 2;
  return 1;
}

function sortLayerByMedian(
  layer: DotNode[],
  neighborMap: Map<string, Array<{ node: DotNode; weight: number; portOffset: number }>>,
  reverse: boolean,
  flatMatrix?: FlatMatrix,
): void {
  layer.sort((a, b) => {
    // C: reorder() mincross.c:1430-1433 — check left2right flat constraint before median
    const rankConstraints = flatMatrix?.get(a.rank);
    if (rankConstraints?.get(a.id)?.has(b.id)) return -1;
    if (rankConstraints?.get(b.id)?.has(a.id)) return 1;
    let ma = wmedian(neighborMap.get(a.id) ?? []);
    if (ma === -1 && flatMatrix) ma = flatMval(a, layer, flatMatrix);
    let mb = wmedian(neighborMap.get(b.id) ?? []);
    if (mb === -1 && flatMatrix) mb = flatMval(b, layer, flatMatrix);
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
  singletonIds: Set<string>,
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
          weight: edgeWeight(edge.from, edge.to, singletonIds),
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
          weight: edgeWeight(edge.from, edge.to, singletonIds),
          portOffset: 0,
        });
      }
    }
  }
  return map;
}

// C: rcross() mincross.c:1512-1549
// Count crossings between topLayer and bottomLayer using the O(E log E)
// accumulator algorithm. Edges not between these two ranks are ignored.
function countCrossingsForRank(
  topLayer: DotNode[],
  bottomLayer: DotNode[],
  edges: DotEdge[],
  topRank: number,
): number {
  const n = bottomLayer.length + 1;
  const cnt = new Int32Array(n);
  let crossings = 0;
  const bottomOrder = new Map<string, number>();
  for (const node of bottomLayer) bottomOrder.set(node.id, node.order);
  const topSorted = topLayer.slice().sort((a, b) => a.order - b.order);
  for (const top of topSorted) {
    const edgesFromTop = edges.filter(
      (e) => e.from === top && e.to.rank === topRank + 1,
    );
    for (const edge of edgesFromTop) {
      const ord = bottomOrder.get(edge.to.id) ?? 0;
      for (let k = ord + 1; k < n; k++) crossings += cnt[k] ?? 0;
    }
    for (const edge of edgesFromTop) {
      const idx = bottomOrder.get(edge.to.id) ?? 0;
      cnt[idx] = (cnt[idx] ?? 0) + 1;
    }
  }
  return crossings;
}

type CrossingCache = { counts: Map<number, number>; valid: Set<number> };

function buildCrossingCache(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  sortedRanks: number[],
): CrossingCache {
  const counts = new Map<number, number>();
  const valid = new Set<number>();
  for (let i = 0; i + 1 < sortedRanks.length; i++) {
    const r = sortedRanks[i]!;
    counts.set(r, countCrossingsForRank(
      layers.get(r)!,
      layers.get(sortedRanks[i + 1]!)!,
      edges,
      r,
    ));
    valid.add(r);
  }
  return { counts, valid };
}

function totalCrossings(
  cc: CrossingCache,
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  sortedRanks: number[],
): number {
  for (let i = 0; i + 1 < sortedRanks.length; i++) {
    const r = sortedRanks[i]!;
    if (!cc.valid.has(r)) {
      cc.counts.set(r, countCrossingsForRank(
        layers.get(r)!,
        layers.get(sortedRanks[i + 1]!)!,
        edges,
        r,
      ));
      cc.valid.add(r);
    }
  }
  return [...cc.counts.values()].reduce((s, v) => s + v, 0);
}

function invalidateCrossingCache(cc: CrossingCache, rank: number): void {
  cc.valid.delete(rank - 1);
  cc.valid.delete(rank);
}

// Swap adjacent pairs in each layer when the swap reduces global crossings.
// Returns true if any swap improved the count.
// flatMatrix: when provided, skips any swap that would violate a flat ordering constraint.
function transpose(
  layers: Map<number, DotNode[]>,
  edges: DotEdge[],
  flatMatrix: FlatMatrix | undefined,
  cc: CrossingCache,
  sortedRanks: number[],
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
      const before = totalCrossings(cc, layers, edges, sortedRanks);
      layer[i] = nodeB;
      layer[i + 1] = nodeA;
      layer[i]!.order = i;
      layer[i + 1]!.order = i + 1;
      invalidateCrossingCache(cc, rank);
      if (totalCrossings(cc, layers, edges, sortedRanks) < before) {
        improved = true;
      } else {
        layer[i] = nodeA;
        layer[i + 1] = nodeB;
        layer[i]!.order = i;
        layer[i + 1]!.order = i + 1;
        invalidateCrossingCache(cc, rank);
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
    const layer = layers.get(rank);
    if (layer === undefined || layer.length === 0) continue;
    const prevLayer = layers.get(prevRank);
    if (prevLayer === undefined || prevLayer.length === 0) continue;

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
      return a.order - b.order;
    });
    for (let i = 0; i < layer.length; i++) {
      layer[i]!.order = i;
    }
  }
}

// decomp.c — split nodes into weakly connected components.
// Flat edges (same-rank) are ignored; they don't create cross-rank connectivity.
function findWeaklyConnectedComponents(
  nodes: DotNode[],
  edges: DotEdge[],
): DotNode[][] {
  if (nodes.length === 0) return [];

  const adj = new Map<string, DotNode[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (e.from.rank === e.to.rank) continue;
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

// mincross.c:367 — mincross_clust: run crossing minimization on the nodes
// belonging to a single cluster. Mirrors the pattern of calling mincross on
// each cluster's sub-graph after the full-graph pass. Only called when
// graph.clusters has entries — zero impact on graphs without clusters.
function mincross_clust(
  graph: DotWorkingGraph,
  clusterId: string,
): void {
  const clusterNodes = graph.nodes.filter(n => n.clusterId === clusterId);
  if (clusterNodes.length < 2) return;

  const clusterNodeSet = new Set(clusterNodes.map(n => n.id));
  const clusterEdges = graph.edges.filter(
    e => clusterNodeSet.has(e.from.id) && clusterNodeSet.has(e.to.id),
  );

  const clusterLayers = groupByRank(clusterNodes);
  const clusterRanks = [...clusterLayers.keys()].sort((a, b) => a - b);
  if (clusterRanks.length < 2) return;

  const singletonIds = new Set<string>();
  const edgeCount = new Map<string, number>();
  for (const n of clusterNodes) edgeCount.set(n.id, 0);
  for (const e of clusterEdges) {
    if (e.from.rank !== e.to.rank) {
      edgeCount.set(e.from.id, (edgeCount.get(e.from.id) ?? 0) + 1);
      edgeCount.set(e.to.id,   (edgeCount.get(e.to.id)   ?? 0) + 1);
    }
  }
  for (const [id, cnt] of edgeCount) {
    if (cnt <= 1) singletonIds.add(id);
  }

  const minRank = clusterRanks[0]!;
  const maxRank = clusterRanks[clusterRanks.length - 1]!;

  for (let r = minRank + 1; r <= maxRank; r++) {
    const layer = clusterLayers.get(r);
    if (layer === undefined || layer.length === 0) continue;
    const neighborMap = buildNeighborMap(layer, clusterEdges, 'pred', singletonIds);
    layer.sort((a, b) => {
      const ma = wmedian(neighborMap.get(a.id) ?? []);
      const mb = wmedian(neighborMap.get(b.id) ?? []);
      if (ma === -1 && mb === -1) return a.order - b.order;
      if (ma === -1) return 1;
      if (mb === -1) return -1;
      if (ma !== mb) return ma - mb;
      return a.order - b.order;
    });
    // Re-number within cluster layer while preserving rank-global positions.
    // Collect the global order slots this cluster occupies in this rank,
    // sort them, and re-assign in the new cluster-local order.
    const slots = layer.map(n => n.order).sort((a, b) => a - b);
    for (let i = 0; i < layer.length; i++) {
      layer[i]!.order = slots[i]!;
    }
  }
}

const MAX_ITER = 24;
const MIN_QUIT = 8;
const CONVERGENCE = 0.995;
const MAX_TRANSPOSE_ROUNDS = 4;

export function minimizeCrossings(graph: DotWorkingGraph): void {
  const { nodes, edges } = graph;
  if (nodes.length === 0) return;

  // decomp.c — process each weakly connected component independently.
  // Prevents unconnected subgraphs from cross-pollinating wmedian values.
  const components = findWeaklyConnectedComponents(nodes, edges);
  if (components.length > 1) {
    for (const component of components) {
      const compNodeSet = new Set(component.map(n => n.id));
      const compEdges = edges.filter(
        e => compNodeSet.has(e.from.id) && compNodeSet.has(e.to.id),
      );
      minimizeCrossings({ ...graph, nodes: component, edges: compEdges });
    }
    // Reassign global orders: pack components left-to-right per rank.
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

  // C: weight_class <= 1 ↔ node has at most 1 non-flat (cross-rank) edge
  const normalEdgeCount = new Map<string, number>();
  for (const node of nodes) normalEdgeCount.set(node.id, 0);
  for (const edge of edges) {
    if (edge.from.rank !== edge.to.rank) {
      normalEdgeCount.set(edge.from.id, (normalEdgeCount.get(edge.from.id) ?? 0) + 1);
      normalEdgeCount.set(edge.to.id,   (normalEdgeCount.get(edge.to.id)   ?? 0) + 1);
    }
  }
  const singletonIds = new Set<string>(
    [...normalEdgeCount.entries()].filter(([, c]) => c <= 1).map(([id]) => id),
  );

  // Pass 0: BFS from sources (mincross.c:do_mincross pass 0)
  bfsOrderPass(layers, edges, ranks, 'down');
  flat_reorder(layers, flatMatrix);

  // Pass 1: BFS from sinks (mincross.c:do_mincross pass 1)
  bfsOrderPass(layers, edges, ranks, 'up');
  flat_reorder(layers, flatMatrix);

  const sortedRanks = [...layers.keys()].sort((a, b) => a - b);
  const cc = buildCrossingCache(layers, edges, sortedRanks);

  let bestCrossings = totalCrossings(cc, layers, edges, sortedRanks);
  let bestSnapshot = snapshotOrders(nodes);
  let trying = 0;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const reverse = (iter % 4) < 2;

    if (iter % 2 === 0) {
      // Down-sweep: fix each rank using predecessors
      for (let r = minRank + 1; r <= maxRank; r++) {
        const layer = layers.get(r);
        if (layer === undefined || layer.length === 0) continue;
        sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'pred', singletonIds), reverse, flatMatrix);
      }
    } else {
      // Up-sweep: fix each rank using successors
      for (let r = maxRank - 1; r >= minRank; r--) {
        const layer = layers.get(r);
        if (layer === undefined || layer.length === 0) continue;
        sortLayerByMedian(layer, buildNeighborMap(layer, edges, 'succ', singletonIds), reverse, flatMatrix);
      }
    }

    // Re-impose flat-edge constraints that the median sweep may have disturbed.
    // Graphviz calls flat_reorder after each sweep pass (mincross.c do_mincross loop).
    flat_reorder(layers, flatMatrix);

    // Invalidate entire cache after a median sweep (all ranks may have changed)
    cc.valid.clear();

    // Adjacent-swap pass to escape barycenter local minima
    let round = 0;
    while (round < MAX_TRANSPOSE_ROUNDS && transpose(layers, edges, flatMatrix, cc, sortedRanks)) {
      round++;
    }

    const current = totalCrossings(cc, layers, edges, sortedRanks);
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

  // mincross.c:367 — run mincross on contents of each cluster.
  // Only active when clusters are present; zero impact on cluster-free graphs.
  if (graph.clusters && graph.clusters.size > 0) {
    for (const [clusterId] of graph.clusters) {
      mincross_clust(graph, clusterId);
    }
  }
}

// Test-only exports — not part of the public API.
// Named with _testOnly suffix to make their purpose explicit.
export {
  flatMval as flatMval_testOnly,
  countCrossingsForRank as countCrossingsForRank_testOnly,
  buildCrossingCache as buildCrossingCache_testOnly,
  totalCrossings as totalCrossings_testOnly,
  invalidateCrossingCache as invalidateCrossingCache_testOnly,
  edgeWeight as edgeWeight_testOnly,
};
