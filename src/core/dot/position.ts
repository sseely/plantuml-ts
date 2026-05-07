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
  // Carry edge weight so the centering averages are weighted — high-weight edges
  // exert proportionally stronger pull. (C: make_edge_pairs position.c:326-352,
  // which creates slack-node aux edges with wt = ED_weight(e).)
  type WN = { node: DotNode; weight: number };
  const succMap = new Map<DotNode, WN[]>();
  const predMap = new Map<DotNode, WN[]>();
  for (const node of nodes) { succMap.set(node, []); predMap.set(node, []); }
  for (const edge of realEdges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.rank === edge.to.rank) continue; // skip flat edges
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    succMap.get(hi)!.push({ node: lo, weight: edge.weight });
    predMap.get(lo)!.push({ node: hi, weight: edge.weight });
  }
  // After class2, graph.edges has only segment edges (virtual endpoints), so real
  // nodes get empty centering maps. Include original long edges (real endpoints) to
  // give real nodes centering attraction. (C: make_edge_pairs position.c:326-352)
  for (const edge of graph.longEdges) {
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    succMap.get(hi)?.push({ node: lo, weight: edge.weight });
    predMap.get(lo)?.push({ node: hi, weight: edge.weight });
  }
  // Step 2: Iterative directional centering passes.
  // Alternates bottom-up (center over successors) and top-down (center over
  // predecessors) to avoid bidirectional mutual-pull oscillation.
  for (let pass = 0; pass < 4; pass++) {
    // Bottom-up: center each node over the weighted average center-x of its successors.
    for (let i = ranks.length - 2; i >= 0; i--) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.x - b.x);
      for (const node of layer) {
        // succMap is initialized for all nodes — always defined.
        const succs = succMap.get(node)!;
        if (succs.length === 0) continue;
        const totalW = succs.reduce((s, e) => s + e.weight, 0);
        const avgCx = succs.reduce((s, e) => s + (e.node.x + e.node.width / 2) * e.weight, 0) / totalW;
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

    // Top-down: center nodes over their predecessors.
    // The ≥2 guard is kept for nodes that share a rank with siblings:
    // collapsing all siblings toward a common parent breaks their spread.
    // The guard is relaxed for nodes that are alone in their rank (lone
    // tail nodes like E in A→B/C→D→E) because the bottom-up pass never
    // touches a childless node, so without top-down pull it stays at y=0.
    for (let i = 1; i < ranks.length; i++) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.x - b.x);
      for (const node of layer) {
        // predMap is initialized for all nodes — always defined.
        const preds = predMap.get(node)!;
        if (preds.length === 0) continue;
        if (preds.length < 2 && layer.length > 1) continue;
        const totalW = preds.reduce((s, e) => s + e.weight, 0);
        const avgCx = preds.reduce((s, e) => s + (e.node.x + e.node.width / 2) * e.weight, 0) / totalW;
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
  // Sibling label separation — symmetric spread.
  // Graphviz NS places label node centres at the midpoint of their real endpoints
  // (equal attraction from both ends), then spreads siblings apart while preserving
  // the group's centre of mass. One-sided push-right would shift B rightward; the
  // re-centering step keeps B symmetric over C and D.
  for (const nodesInRank of byRank.values()) {
    if (!nodesInRank.every((n) => n.virtual) || nodesInRank.length < 2) continue;
    const sorted = nodesInRank.slice().sort((a, b) => a.x - b.x);
    const initialGroupCx = sorted.reduce((s, n) => s + n.x + n.width / 2, 0) / sorted.length;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const minX = prev.x + prev.width + 5;
      if (curr.x < minX) curr.x = minX;
    }
    // Re-centre the group symmetrically around its original centre of mass.
    const finalGroupCx = sorted.reduce((s, n) => s + n.x + n.width / 2, 0) / sorted.length;
    const groupShift = initialGroupCx - finalGroupCx;
    if (Math.abs(groupShift) > 0.5) for (const n of sorted) n.x += groupShift;
  }

  // Propagate label-node positions to child real nodes — top-down, level by level.
  //
  // Graphviz NS solves this implicitly: each label node has lw/rw constraints
  // that enter the constraint graph, and NS propagates them in one global solve.
  // We replicate the effect explicitly:
  //   1. Process edges grouped by parent rank, ascending (top-down).
  //   2. At each level, re-centre label nodes from current parent/child x.
  //   3. Apply symmetric sibling separation at the label rank.
  //   4. Project each child: child.cx = 2*lv.cx - parent.cx (NS equilibrium).
  //      Average when a child receives multiple projections (shared child).
  //   5. Re-enforce nodeSep at the child rank.
  // No bottom-up pass — that would undo step 4 by pulling parents back toward
  // old (pre-label) child positions.
  if (graph.hasEdgeLabels) {
    // Group labeled long-edges by the rank of their "parent" (the real node
    // at the higher end, i.e. the lower rank number in TB layout).
    const edgesByParentRank = new Map<number, DotEdge[]>();
    for (const edge of graph.longEdges) {
      if (!edge.labelNode) continue;
      const parent = edge.to.rank > edge.from.rank ? edge.from : edge.to;
      if (!edgesByParentRank.has(parent.rank)) edgesByParentRank.set(parent.rank, []);
      edgesByParentRank.get(parent.rank)!.push(edge);
    }

    const sortedParentRanks = [...edgesByParentRank.keys()].sort((a, b) => a - b);

    for (const parentRank of sortedParentRanks) {
      const edgesAtLevel = edgesByParentRank.get(parentRank)!;

      // Step A: re-centre label nodes from current (possibly updated) parent x.
      for (const edge of edgesAtLevel) {
        const lv = edge.labelNode!;
        const fromCx = edge.from.x + edge.from.width / 2;
        const toCx   = edge.to.x   + edge.to.width   / 2;
        lv.x = (fromCx + toCx) / 2 - lv.width / 2;
      }

      // Step B: symmetric sibling separation at each label rank touched by this level.
      const labelRanks = new Set(edgesAtLevel.map((e) => e.labelNode!.rank));
      for (const lr of labelRanks) {
        const nodesInRank = byRank.get(lr);
        if (!nodesInRank || nodesInRank.length < 2) continue;
        const sorted = nodesInRank.slice().sort((a, b) => a.x - b.x);
        const initCx = sorted.reduce((s, n) => s + n.x + n.width / 2, 0) / sorted.length;
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1]!;
          const curr = sorted[i]!;
          if (curr.x < prev.x + prev.width + 5) curr.x = prev.x + prev.width + 5;
        }
        const finalCx = sorted.reduce((s, n) => s + n.x + n.width / 2, 0) / sorted.length;
        const groupShift = initCx - finalCx;
        if (Math.abs(groupShift) > 0.5) for (const n of sorted) n.x += groupShift;
      }

      // Step C: project child positions. child.cx = 2*lv.cx - parent.cx.
      // Collect all projections for each child (a child may have multiple labeled
      // parents at this level) and average them.
      const childProjections = new Map<DotNode, number[]>();
      for (const edge of edgesAtLevel) {
        const lv     = edge.labelNode!;
        const parent = edge.to.rank > edge.from.rank ? edge.from : edge.to;
        const child  = edge.to.rank > edge.from.rank ? edge.to   : edge.from;
        if (child.virtual || parent.virtual) continue;
        const lvCx      = lv.x + lv.width / 2;
        const parentCx  = parent.x + parent.width / 2;
        const projected = 2 * lvCx - parentCx;
        if (!childProjections.has(child)) childProjections.set(child, []);
        childProjections.get(child)!.push(projected);
      }

      const adjustedChildRanks = new Set<number>();
      for (const [child, projections] of childProjections) {
        const avgCx = projections.reduce((s, p) => s + p, 0) / projections.length;
        child.x = avgCx - child.width / 2;
        adjustedChildRanks.add(child.rank);
      }

      // Step D: re-enforce nodeSep at repositioned child ranks.
      for (const rank of adjustedChildRanks) {
        const layer = byRank.get(rank);
        if (!layer) continue;
        const sorted = layer.slice().sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1]!;
          const curr = sorted[i]!;
          if (curr.x < prev.x + prev.width + graph.nodeSep) {
            curr.x = prev.x + prev.width + graph.nodeSep;
          }
        }
      }
    }
  }

  // Normalize minimum x to 0 across all nodes (shift left or right as needed).
  const minX = Math.min(...nodes.map((n) => n.x));
  if (minX !== 0) for (const n of nodes) n.x -= minX;
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

  // Build child/parent maps for y-axis centering (weighted by edge weight).
  type WNY = { node: DotNode; weight: number };
  const childMap = new Map<DotNode, WNY[]>();
  const parentMap = new Map<DotNode, WNY[]>();
  for (const node of nodes) { childMap.set(node, []); parentMap.set(node, []); }
  for (const edge of realEdges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.rank === edge.to.rank) continue;
    const hi = edge.from.rank < edge.to.rank ? edge.from : edge.to;
    const lo = edge.from.rank < edge.to.rank ? edge.to   : edge.from;
    childMap.get(hi)!.push({ node: lo, weight: edge.weight });
    parentMap.get(lo)!.push({ node: hi, weight: edge.weight });
  }
  for (const longEdge of graph.longEdges) {
    childMap.get(longEdge.from)!.push({ node: longEdge.to, weight: longEdge.weight });
    parentMap.get(longEdge.to)!.push({ node: longEdge.from, weight: longEdge.weight });
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
        const totalW = children.reduce((s, e) => s + e.weight, 0);
        const avgCy = children.reduce((s, e) => s + (e.node.y + e.node.height / 2) * e.weight, 0) / totalW;
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

    // Left-to-right: center nodes with ≥2 parents over their parents (weighted).
    for (let i = 1; i < ranks.length; i++) {
      // byRank is built from nodes, ranks comes from byRank.keys() — always defined.
      const layer = byRank.get(ranks[i]!)!.slice().sort((a, b) => a.y - b.y);
      for (const node of layer) {
        // parentMap is initialized for all nodes — always defined.
        const parents = parentMap.get(node)!;
        if (parents.length === 0) continue;
        if (parents.length < 2 && layer.length > 1) continue;
        const totalW = parents.reduce((s, e) => s + e.weight, 0);
        const avgCy = parents.reduce((s, e) => s + (e.node.y + e.node.height / 2) * e.weight, 0) / totalW;
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
      // If real nodes share this virtual node's rank, the constraint solver
      // placed it with proper lateral separation — don't override that.
      // C position.c: virtual nodes participate in the NS constraint graph
      // as full members; their x comes from the solver, not interpolation.
      const rankPeers = byRank.get(vn.rank) ?? [];
      if (rankPeers.some((n) => !n.virtual)) continue;
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
