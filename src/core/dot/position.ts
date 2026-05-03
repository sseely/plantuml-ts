import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';

interface AuxEdge {
  from: DotNode;
  to: DotNode;
  minLen: number;
}

function groupByRank(nodes: DotNode[]): Map<number, DotNode[]> {
  const byRank = new Map<number, DotNode[]>();
  for (const node of nodes) {
    const group = byRank.get(node.rank);
    if (group !== undefined) {
      group.push(node);
    } else {
      byRank.set(node.rank, [node]);
    }
  }
  return byRank;
}

/**
 * Build auxiliary constraint edges for x-coordinate assignment (TB direction).
 * For each rank, for each adjacent pair (u, v) sorted by order:
 *   minLen = u.width/2 + graph.nodeSep + v.width/2
 * This mirrors position.c make_LR_constraints() which uses rw(u)+lw(v)+nodeSep.
 */
function make_LR_constraints(
  graph: DotWorkingGraph,
  byRank: Map<number, DotNode[]>,
): AuxEdge[] {
  const constraints: AuxEdge[] = [];
  for (const nodesInRank of byRank.values()) {
    const sorted = nodesInRank.slice().sort((a, b) => a.order - b.order);
    // When edge labels are present, ranks interleave real nodes (even) and
    // virtual/label nodes (odd). Odd ranks use a tighter 5px gap —
    // the label node width already reserves the label's horizontal space.
    const isVirtualRank = graph.hasEdgeLabels && sorted.every((n) => n.virtual);
    const nodeSep = isVirtualRank ? 5 : graph.nodeSep;
    for (let i = 0; i + 1 < sorted.length; i++) {
      const u = sorted[i]!;
      const v = sorted[i + 1]!;
      const minLen = u.width / 2 + nodeSep + v.width / 2;
      constraints.push({ from: u, to: v, minLen });
    }
  }
  return constraints;
}

/**
 * Solve x-coordinates from constraint edges using longest-path (DAG relaxation).
 * The constraints form a DAG (left-to-right ordering within each rank).
 * We work in terms of center x coordinates then convert to left-edge at the end.
 *
 * The minLen for each edge is: u.width/2 + nodeSep + v.width/2
 * So: center(v) >= center(u) + minLen guarantees left-edge spacing.
 *
 * We use Bellman-Ford style relaxation (up to N passes) to handle any topology.
 */
function solveAuxRanks(
  nodes: DotNode[],
  constraints: AuxEdge[],
): void {
  // Work in terms of center x coordinates during solving.
  // Initialize all centers to 0.
  const center = new Map<DotNode, number>();
  for (const n of nodes) center.set(n, 0);

  // Relax up to nodes.length times (Bellman-Ford guarantee).
  const N = nodes.length;
  for (let pass = 0; pass < N; pass++) {
    let changed = false;
    for (const { from, to, minLen } of constraints) {
      const cu = center.get(from)!;
      const cv = center.get(to)!;
      // center(to) >= center(from) + minLen
      const required = cu + minLen;
      if (cv < required) {
        center.set(to, required);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Convert center coordinates to left-edge x.
  for (const n of nodes) {
    n.x = center.get(n)! - n.width / 2;
  }
}

/**
 * After left-to-right constraint packing, walk ranks bottom-up and center each
 * node over the average center-x of its direct successors (the rank below).
 * This ensures a parent with two children is horizontally centered between them.
 */
function centerBySuccessors(
  graph: DotWorkingGraph,
  byRank: Map<number, DotNode[]>,
  ranks: number[],
): void {
  // Build successor map. After acyclic processing, all edges satisfy
  // from.rank < to.rank, so edge.from is always the upper node.
  const succMap = new Map<DotNode, DotNode[]>();
  for (const node of graph.nodes) succMap.set(node, []);
  for (const edge of graph.edges) {
    succMap.get(edge.from)!.push(edge.to);
  }

  // Bottom-up: center nodes over their successors.
  for (let i = ranks.length - 2; i >= 0; i--) {
    const nodesInRank = byRank.get(ranks[i]!)!.slice();
    nodesInRank.sort((a, b) => a.x - b.x);

    for (const node of nodesInRank) {
      const succs = succMap.get(node)!;
      if (succs.length === 0) continue;
      const avgCenter =
        succs.reduce((sum, s) => sum + s.x + s.width / 2, 0) / succs.length;
      node.x = avgCenter - node.width / 2;
    }

    // Resolve left-to-right overlaps after repositioning.
    nodesInRank.sort((a, b) => a.x - b.x);
    for (let j = 1; j < nodesInRank.length; j++) {
      const prev = nodesInRank[j - 1]!;
      const curr = nodesInRank[j]!;
      const minX = prev.x + prev.width + graph.nodeSep;
      if (curr.x < minX) curr.x = minX;
    }
  }

  // Normalize so that minimum x is 0.
  const minX = Math.min(...graph.nodes.map((n) => n.x));
  if (minX < 0) {
    for (const node of graph.nodes) node.x -= minX;
  }
}

/**
 * Graphviz equivalent: make_edge_pairs() creates a slack node for every real
 * edge connecting it to both endpoints with equal minLen, then network simplex
 * pulls multi-predecessor nodes toward the average of their predecessors.
 *
 * Our Bellman-Ford only enforces left-to-right separation; this top-down pass
 * approximates the slack-node attraction by repositioning any node that has
 * 2+ real predecessors over the average of their center-x values.
 * Single-predecessor nodes are already correctly placed by solveAuxRanks.
 */
function centerByPredecessors(
  graph: DotWorkingGraph,
  byRank: Map<number, DotNode[]>,
  ranks: number[],
): void {
  const predMap = new Map<DotNode, DotNode[]>();
  for (const node of graph.nodes) predMap.set(node, []);
  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    predMap.get(edge.to)!.push(edge.from);
  }
  for (const longEdge of graph.longEdges) {
    predMap.get(longEdge.to)!.push(longEdge.from);
  }

  for (let i = 1; i < ranks.length; i++) {
    const nodesInRank = byRank.get(ranks[i]!)!.slice();
    nodesInRank.sort((a, b) => a.x - b.x);

    for (const node of nodesInRank) {
      const preds = predMap.get(node)!;
      if (preds.length < 2) continue;
      const avgCenter =
        preds.reduce((sum, p) => sum + p.x + p.width / 2, 0) / preds.length;
      node.x = avgCenter - node.width / 2;
    }

    nodesInRank.sort((a, b) => a.x - b.x);
    for (let j = 1; j < nodesInRank.length; j++) {
      const prev = nodesInRank[j - 1]!;
      const curr = nodesInRank[j]!;
      const minX = prev.x + prev.width + graph.nodeSep;
      if (curr.x < minX) curr.x = minX;
    }
  }

  const minX = Math.min(...graph.nodes.map((n) => n.x));
  if (minX < 0) {
    for (const node of graph.nodes) node.x -= minX;
  }
}

/**
 * LR counterpart of centerByPredecessors: top-down pass along the y-axis.
 * Centers nodes with 2+ real predecessors over the average center-y of those
 * predecessors. Resolves top-to-bottom overlaps within each rank afterward.
 */
function centerByParentsY(
  graph: DotWorkingGraph,
  byRank: Map<number, DotNode[]>,
  ranks: number[],
): void {
  const predMap = new Map<DotNode, DotNode[]>();
  for (const node of graph.nodes) predMap.set(node, []);
  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    predMap.get(edge.to)!.push(edge.from);
  }
  for (const longEdge of graph.longEdges) {
    predMap.get(longEdge.to)!.push(longEdge.from);
  }

  for (let i = 1; i < ranks.length; i++) {
    const nodesInRank = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.y - b.y);

    for (const node of nodesInRank) {
      const preds = predMap.get(node)!;
      if (preds.length < 2) continue;
      const avgCenter =
        preds.reduce((sum, p) => sum + p.y + p.height / 2, 0) / preds.length;
      node.y = avgCenter - node.height / 2;
    }

    nodesInRank.sort((a, b) => a.y - b.y);
    for (let j = 1; j < nodesInRank.length; j++) {
      const prev = nodesInRank[j - 1]!;
      const curr = nodesInRank[j]!;
      const minY = prev.y + prev.height + graph.nodeSep;
      if (curr.y < minY) curr.y = minY;
    }
  }

  const minY = Math.min(...graph.nodes.map((n) => n.y));
  if (minY < 0) {
    for (const node of graph.nodes) node.y -= minY;
  }
}

/**
 * Center virtual nodes of long edges horizontally between their real endpoints.
 * Each virtual node is placed at a fraction of the way between srcX and dstX.
 */
function centerVirtualNodes(longEdges: DotEdge[]): void {
  for (const longEdge of longEdges) {
    if (!longEdge.virtualNodes || longEdge.virtualNodes.length === 0) continue;
    const srcX = longEdge.from.x + longEdge.from.width / 2;
    const dstX = longEdge.to.x + longEdge.to.width / 2;
    const count = longEdge.virtualNodes.length;
    for (let i = 0; i < count; i++) {
      const vn = longEdge.virtualNodes[i]!;
      // Label virtual nodes have their x already set by the constraint solver
      // (their width reserves space for the label text). Skip interpolation so
      // we don't overwrite the solver result. (Graphviz class2.c behavior.)
      if (vn === longEdge.labelNode) continue;
      const centerX = srcX + (dstX - srcX) * (i + 1) / (count + 1);
      vn.x = centerX - vn.width / 2;
    }
  }
}

/**
 * After the initial y packing (longest-path relaxation), walk ranks right-to-left
 * (highest rank → lowest) and center each parent node's y over the average
 * center-y of its direct children. Then resolve top-to-bottom overlaps within
 * each rank. This is the LR-axis equivalent of centerBySuccessors for TB layout.
 *
 * Without this, all nodes start at y=0 and are only pushed down by minimum
 * separation — parents end up at the top of their subtrees instead of centered.
 */
function centerByChildrenY(
  graph: DotWorkingGraph,
  byRank: Map<number, DotNode[]>,
  ranks: number[],
): void {
  // Build child map using real-to-real connections only.
  // graph.edges contains segment edges (real→vn, vn→vn, vn→real); virtual
  // nodes start at y=0/height=0 and corrupt average center-y. Skip any edge
  // touching a virtual node and instead use graph.longEdges (original
  // real→real connections) for long-edge spans.
  const childMap = new Map<DotNode, DotNode[]>();
  for (const node of graph.nodes) childMap.set(node, []);
  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    childMap.get(edge.from)!.push(edge.to);
  }
  for (const longEdge of graph.longEdges) {
    childMap.get(longEdge.from)!.push(longEdge.to);
  }

  // Right-to-left pass: center each parent over its children's average center-y.
  // ranks is sorted ascending (leftmost = smallest rank number), so iterate backwards.
  for (let i = ranks.length - 2; i >= 0; i--) {
    const nodesInRank = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.y - b.y);

    for (const node of nodesInRank) {
      const children = childMap.get(node)!;
      if (children.length === 0) continue;
      const avgCenterY =
        children.reduce((sum, c) => sum + c.y + c.height / 2, 0) / children.length;
      node.y = avgCenterY - node.height / 2;
    }

    // Resolve top-to-bottom overlaps after repositioning (forward pass).
    nodesInRank.sort((a, b) => a.y - b.y);
    for (let j = 1; j < nodesInRank.length; j++) {
      const prev = nodesInRank[j - 1]!;
      const curr = nodesInRank[j]!;
      const minY = prev.y + prev.height + graph.nodeSep;
      if (curr.y < minY) curr.y = minY;
    }
  }

  // Normalize so minimum y >= 0.
  const minY = Math.min(...graph.nodes.map((n) => n.y));
  if (minY < 0) {
    for (const node of graph.nodes) node.y -= minY;
  }
}


function assignTB(graph: DotWorkingGraph): void {
  const byRank = groupByRank(graph.nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Assign y coordinates from rank (unchanged).
  const rankY = new Map<number, number>();
  let y = 0;
  for (let i = 0; i < ranks.length; i++) {
    const r = ranks[i]!;
    rankY.set(r, y);
    const nodesInRank = byRank.get(r)!;
    const maxH = Math.max(...nodesInRank.map((n) => n.height));
    if (i < ranks.length - 1) {
      y += maxH + graph.rankSep;
    }
  }
  for (const node of graph.nodes) {
    node.y = rankY.get(node.rank)!;
  }

  // Build auxiliary constraint edges and solve x coordinates.
  const constraints = make_LR_constraints(graph, byRank);
  solveAuxRanks(graph.nodes, constraints);

  // Normalize so minimum x >= 0 before centering pass.
  const minXBefore = Math.min(...graph.nodes.map((n) => n.x));
  if (minXBefore < 0) {
    for (const node of graph.nodes) node.x -= minXBefore;
  }

  // Center parents over their children (bottom-up pass).
  // This also re-normalizes minimum x to >= 0.
  centerBySuccessors(graph, byRank, ranks);

  // Center nodes with 2+ predecessors over the average of those predecessors
  // (top-down pass). Approximates Graphviz's slack-node/network-simplex pull.
  centerByPredecessors(graph, byRank, ranks);

  // Center virtual nodes of long edges between real source/destination.
  centerVirtualNodes(graph.longEdges);
}

function assignLR(graph: DotWorkingGraph): void {
  const byRank = groupByRank(graph.nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Assign x coordinates from rank (unchanged).
  const rankX = new Map<number, number>();
  let x = 0;
  for (let i = 0; i < ranks.length; i++) {
    const r = ranks[i]!;
    rankX.set(r, x);
    const nodesInRank = byRank.get(r)!;
    const maxW = Math.max(...nodesInRank.map((n) => n.width));
    if (i < ranks.length - 1) {
      x += maxW + graph.rankSep;
    }
  }
  for (const node of graph.nodes) {
    node.x = rankX.get(node.rank)!;
  }

  // Build constraint edges for y-coordinate assignment (same-rank ordering).
  // For LR, the "order" axis is y, and node heights play the same role as
  // widths do in the TB x-axis case.
  const yConstraints: AuxEdge[] = [];
  for (const nodesInRank of byRank.values()) {
    const sorted = nodesInRank.slice().sort((a, b) => a.order - b.order);
    // Same interleaved-rank logic as TB make_LR_constraints (P-3).
    const isVirtualRank = graph.hasEdgeLabels && sorted.every((n) => n.virtual);
    const nodeSep = isVirtualRank ? 5 : graph.nodeSep;
    for (let i = 0; i + 1 < sorted.length; i++) {
      const u = sorted[i]!;
      const v = sorted[i + 1]!;
      const minLen = u.height / 2 + nodeSep + v.height / 2;
      yConstraints.push({ from: u, to: v, minLen });
    }
  }

  // Solve y coordinates using longest-path relaxation (center-based).
  const centerY = new Map<DotNode, number>();
  for (const n of graph.nodes) centerY.set(n, 0);
  const N = graph.nodes.length;
  for (let pass = 0; pass < N; pass++) {
    let changed = false;
    for (const { from, to, minLen } of yConstraints) {
      const cu = centerY.get(from)!;
      const cv = centerY.get(to)!;
      const required = cu + minLen;
      if (cv < required) {
        centerY.set(to, required);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const n of graph.nodes) {
    n.y = centerY.get(n)! - n.height / 2;
  }

  // Normalize so minimum y >= 0.
  const minY = Math.min(...graph.nodes.map((n) => n.y));
  if (minY < 0) {
    for (const node of graph.nodes) node.y -= minY;
  }

  // Center parents over their children (right-to-left pass).
  centerByChildrenY(graph, byRank, ranks);

  // Center nodes with 2+ predecessors over the average of those predecessors
  // (left-to-right pass on the y-axis). LR counterpart of centerByPredecessors.
  centerByParentsY(graph, byRank, ranks);
}

function flipX(nodes: DotNode[]): void {
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  for (const node of nodes) {
    node.x = maxX - node.x - node.width;
  }
}

function flipY(nodes: DotNode[]): void {
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  for (const node of nodes) {
    node.y = maxY - node.y - node.height;
  }
}

export function assignCoordinates(graph: DotWorkingGraph): void {
  const { nodes, rankDir } = graph;

  if (nodes.length === 0) return;

  if (rankDir === 'TB' || rankDir === 'BT') {
    assignTB(graph);
    if (rankDir === 'BT') flipY(nodes);
  } else {
    assignLR(graph);
    if (rankDir === 'RL') flipX(nodes);
  }
}
