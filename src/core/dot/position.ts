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

// Virtual cluster border nodes (virtual === true && clusterId set) contribute
// zero effective width/height to spacing calculations so they don't push real
// nodes apart. Real nodes are unaffected.
function effectiveWidth(node: DotNode): number {
  if (node.virtual && node.clusterId !== undefined) return 0;
  return node.width;
}

function effectiveHeight(node: DotNode): number {
  if (node.virtual && node.clusterId !== undefined) return 0;
  return node.height;
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
      const minLen = effectiveWidth(u) / 2 + nodeSep + effectiveWidth(v) / 2;
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

// C: set_xcoords() position.c:340-530 — NS on auxiliary constraint graph.
// Bellman-Ford for separation + directional centering passes (successor-pull then
// predecessor-pull). This matches C's slack-node NS attraction pattern:
// - Bottom-up pass: center each node over the average center-x of its successors.
// - Top-down pass: center nodes with ≥2 predecessors over their predecessors.
// Re-enforce separation constraints after each pass.
function solveAuxNS(
  nodes: DotNode[],
  constraints: AuxEdge[],
  realEdges: DotEdge[],
  graph: DotWorkingGraph,
): void {
  // Step 1: Satisfy separation constraints (Bellman-Ford — guarantees no overlaps).
  solveAuxRanks(nodes, constraints);

  const byRank = groupByRank(nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Build successor and predecessor maps (cross-rank only, real nodes).
  // Normalize edge direction by rank: hi is the lower-rank endpoint (parent).
  const succMap = new Map<DotNode, DotNode[]>();
  const predMap = new Map<DotNode, DotNode[]>();
  for (const node of nodes) { succMap.set(node, []); predMap.set(node, []); }
  for (const edge of realEdges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.rank === edge.to.rank) continue; // skip flat edges
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    succMap.get(hi)!.push(lo);
    predMap.get(lo)!.push(hi);
  }
  // After class2, graph.edges has only segment edges (virtual endpoints), so real
  // nodes get empty centering maps. Include original long edges (real endpoints) to
  // give real nodes centering attraction. (C: make_edge_pairs position.c:326-352)
  for (const edge of graph.longEdges) {
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    succMap.get(hi)?.push(lo);
    predMap.get(lo)?.push(hi);
  }
  // Step 2: Iterative directional centering passes.
  // Alternates bottom-up (center over successors) and top-down (center over
  // predecessors) to avoid bidirectional mutual-pull oscillation.
  for (let pass = 0; pass < 4; pass++) {
    // Bottom-up: center each node over the average center-x of its successors.
    for (let i = ranks.length - 2; i >= 0; i--) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.x - b.x);
      for (const node of layer) {
        // succMap is initialized for all nodes — always defined.
        const succs = succMap.get(node)!;
        if (succs.length === 0) continue;
        const avgCx = succs.reduce((sum, s) => sum + s.x + s.width / 2, 0) / succs.length;
        node.x = avgCx - node.width / 2;
      }
      // Re-enforce separation within this rank after repositioning.
      // Use rank-appropriate nodeSep: odd/virtual-only ranks use 5 (same as
      // make_LR_constraints) so label nodes can stay tightly packed.
      layer.sort((a, b) => a.x - b.x);
      const isVirtualLayer = graph.hasEdgeLabels && layer.every((n) => n.virtual);
      const rankSepX = isVirtualLayer ? 5 : graph.nodeSep;
      for (let j = 1; j < layer.length; j++) {
        const prev = layer[j - 1]!;
        const curr = layer[j]!;
        const minX = prev.x + prev.width + rankSepX;
        if (curr.x < minX) curr.x = minX;
      }
    }

    // Top-down: center nodes with ≥2 predecessors over their predecessors.
    for (let i = 1; i < ranks.length; i++) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.x - b.x);
      for (const node of layer) {
        // predMap is initialized for all nodes — always defined.
        const preds = predMap.get(node)!;
        if (preds.length < 2) continue;
        const avgCx = preds.reduce((sum, p) => sum + p.x + p.width / 2, 0) / preds.length;
        node.x = avgCx - node.width / 2;
      }
      layer.sort((a, b) => a.x - b.x);
      const isVirtualLayer = graph.hasEdgeLabels && layer.every((n) => n.virtual);
      const rankSepX = isVirtualLayer ? 5 : graph.nodeSep;
      for (let j = 1; j < layer.length; j++) {
        const prev = layer[j - 1]!;
        const curr = layer[j]!;
        const minX = prev.x + prev.width + rankSepX;
        if (curr.x < minX) curr.x = minX;
      }
    }
  }

  // Center label virtual nodes toward the midpoint of their real edge endpoints.
  // The Bellman-Ford step above places them by same-rank separation from cx=0,
  // with no cross-rank attraction. After the directional passes have settled
  // real nodes (A, B, C …) into good positions, pull each label node to the
  // midpoint of its from/to center-x. Then re-enforce within-rank separation
  // so sibling label nodes (two labels sharing the same rank) don't overlap.
  for (const edge of graph.longEdges) {
    if (!edge.labelNode) continue;
    const lv = edge.labelNode;
    const fromCx = edge.from.x + edge.from.width / 2;
    const toCx   = edge.to.x   + edge.to.width   / 2;
    lv.x = (fromCx + toCx) / 2 - lv.width / 2;
  }
  for (const nodesInRank of byRank.values()) {
    if (!nodesInRank.every((n) => n.virtual) || nodesInRank.length < 2) continue;
    const sorted = nodesInRank.slice().sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const minX = prev.x + prev.width + 5;
      if (curr.x < minX) curr.x = minX;
    }
  }

  // Normalize minimum x to >= 0 across all nodes.
  const minX = Math.min(...nodes.map((n) => n.x));
  if (minX < 0) for (const n of nodes) n.x -= minX;
}

// C: set_xcoords() position.c:340-530 — NS on auxiliary constraint graph (y-axis variant).
// Same structure as solveAuxNS but operates on the y-axis for LR layout.
function solveAuxNSY(
  nodes: DotNode[],
  yConstraints: AuxEdge[],
  realEdges: DotEdge[],
  graph: DotWorkingGraph,
): void {
  // Step 1: Satisfy separation constraints (Bellman-Ford).
  const centerY = new Map<DotNode, number>();
  for (const n of nodes) centerY.set(n, 0);
  const N = nodes.length;
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
  for (const n of nodes) {
    n.y = centerY.get(n)! - n.height / 2;
  }
  {
    const minY = Math.min(...nodes.map((n) => n.y));
    if (minY < 0) for (const n of nodes) n.y -= minY;
  }

  const byRank = groupByRank(nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Build child/parent maps for y-axis centering.
  const childMap = new Map<DotNode, DotNode[]>();
  const parentMap = new Map<DotNode, DotNode[]>();
  for (const node of nodes) { childMap.set(node, []); parentMap.set(node, []); }
  for (const edge of realEdges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.rank === edge.to.rank) continue;
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    childMap.get(hi)!.push(lo);
    parentMap.get(lo)!.push(hi);
  }
  for (const longEdge of graph.longEdges) {
    childMap.get(longEdge.from)!.push(longEdge.to);
    parentMap.get(longEdge.to)!.push(longEdge.from);
  }

  // Step 2: Iterative directional centering on y-axis.
  for (let pass = 0; pass < 4; pass++) {
    // Right-to-left (equivalent of bottom-up for LR): center over children.
    for (let i = ranks.length - 2; i >= 0; i--) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.y - b.y);
      for (const node of layer) {
        // childMap is initialized for all nodes — always defined.
        const children = childMap.get(node)!;
        if (children.length === 0) continue;
        const avgCy = children.reduce((sum, c) => sum + c.y + c.height / 2, 0) / children.length;
        node.y = avgCy - node.height / 2;
      }
      layer.sort((a, b) => a.y - b.y);
      for (let j = 1; j < layer.length; j++) {
        const prev = layer[j - 1]!;
        const curr = layer[j]!;
        const minY = prev.y + prev.height + graph.nodeSep;
        if (curr.y < minY) curr.y = minY;
      }
    }

    // Left-to-right: center nodes with ≥2 parents over their parents.
    for (let i = 1; i < ranks.length; i++) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.y - b.y);
      for (const node of layer) {
        // parentMap is initialized for all nodes — always defined.
        const parents = parentMap.get(node)!;
        if (parents.length < 2) continue;
        const avgCy = parents.reduce((sum, p) => sum + p.y + p.height / 2, 0) / parents.length;
        node.y = avgCy - node.height / 2;
      }
      layer.sort((a, b) => a.y - b.y);
      for (let j = 1; j < layer.length; j++) {
        const prev = layer[j - 1]!;
        const curr = layer[j]!;
        const minY = prev.y + prev.height + graph.nodeSep;
        if (curr.y < minY) curr.y = minY;
      }
    }
  }

  // Normalize minimum y to >= 0.
  const minY = Math.min(...nodes.map((n) => n.y));
  if (minY < 0) for (const n of nodes) n.y -= minY;
}

/**
 * Center virtual nodes of long edges horizontally between their real endpoints.
 * Each virtual node is placed at a fraction of the way between srcX and dstX.
 * Label nodes that are alone in their rank are also centered (lone-label case).
 * Label nodes sharing a rank with sibling labels keep the constraint-solver
 * position to avoid overwriting the separation constraints between siblings.
 */
function centerVirtualNodes(
  longEdges: DotEdge[],
  byRank: Map<number, DotNode[]>,
): void {
  for (const longEdge of longEdges) {
    if (!longEdge.virtualNodes || longEdge.virtualNodes.length === 0) continue;
    // Back edges (reversed=true) route around the node column — their virtual
    // nodes are correctly positioned by the constraint solver to the side of the
    // column. Interpolating toward the reversed endpoints would move them back
    // into the column, overlapping real nodes and corrupting corridor routing.
    if (longEdge.reversed) continue;
    const srcX = longEdge.from.x + longEdge.from.width / 2;
    const dstX = longEdge.to.x + longEdge.to.width / 2;
    const count = longEdge.virtualNodes.length;
    for (let i = 0; i < count; i++) {
      const vn = longEdge.virtualNodes[i]!;
      if (vn === longEdge.labelNode) {
        // Center lone label nodes (only node in their rank) so the label waypoint
        // lies on the straight-line path between real endpoints. Label nodes with
        // rank siblings keep the constraint-solver position — overriding it would
        // violate the separation constraints between siblings.
        const rankPeers = byRank.get(vn.rank) ?? [];
        if (rankPeers.length !== 1) continue;
        const centerX = srcX + (dstX - srcX) * (i + 1) / (count + 1);
        vn.x = centerX - vn.width / 2;
        continue;
      }
      const centerX = srcX + (dstX - srcX) * (i + 1) / (count + 1);
      vn.x = centerX - vn.width / 2;
    }
  }
}

function assignTB(graph: DotWorkingGraph): void {
  const byRank = groupByRank(graph.nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // C: set_ycoords() position.c:170-205 — ht1/ht2 per-rank half-height model.
  // ht1[r] = max upper half-height = max(n.height / 2) for real nodes in rank r
  // ht2[r] = max lower half-height = max(n.height / 2) (same for symmetric nodes)
  // spacing between rank center-lines: ht2[r] + rankSep + ht1[r+1]
  const rankY = new Map<number, number>();
  let y = 0; // tracks center-line of current rank
  for (let i = 0; i < ranks.length; i++) {
    const r = ranks[i]!;
    const nodesInRank = byRank.get(r)!;
    const ht1r = Math.max(...nodesInRank.map((n) => n.height / 2));
    const ht2r = Math.max(...nodesInRank.map((n) => n.height / 2));
    rankY.set(r, y - ht1r); // top-left y = center-line - upper half
    if (i < ranks.length - 1) {
      const nextRank = byRank.get(ranks[i + 1]!)!;
      const ht1next = Math.max(...nextRank.map((n) => n.height / 2));
      y += ht2r + graph.rankSep + ht1next;
    }
  }
  for (const node of graph.nodes) {
    node.y = rankY.get(node.rank)!;
  }

  // Normalize so minimum y >= 0.
  const minY = Math.min(...graph.nodes.map((n) => n.y));
  if (minY !== 0) for (const n of graph.nodes) n.y -= minY;

  // Build auxiliary constraint edges and solve x coordinates with NS centering.
  const constraints = make_LR_constraints(graph, byRank);
  solveAuxNS(graph.nodes, constraints, graph.edges, graph);

  // Center virtual nodes of long edges between real source/destination.
  centerVirtualNodes(graph.longEdges, byRank);
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
      const minLen = effectiveHeight(u) / 2 + nodeSep + effectiveHeight(v) / 2;
      yConstraints.push({ from: u, to: v, minLen });
    }
  }

  // Solve y coordinates using NS centering (Bellman-Ford separation + iterative centering).
  solveAuxNSY(graph.nodes, yConstraints, graph.edges, graph);
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
