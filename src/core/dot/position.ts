import type { DotNode, DotWorkingGraph } from './types.js';

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
 * After left-to-right packing, walk ranks bottom-up and center each node
 * over the average center-x of its direct successors (the rank below).
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

function assignTB(graph: DotWorkingGraph): void {
  const byRank = groupByRank(graph.nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

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

  for (const [r, nodesInRank] of byRank) {
    nodesInRank.sort((a, b) => a.order - b.order);
    let x = 0;
    for (const node of nodesInRank) {
      node.x = x;
      x += node.width + graph.nodeSep;
    }
    void r;
  }

  centerBySuccessors(graph, byRank, ranks);
}

function assignLR(graph: DotWorkingGraph): void {
  const byRank = groupByRank(graph.nodes);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

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

  for (const [r, nodesInRank] of byRank) {
    nodesInRank.sort((a, b) => a.order - b.order);
    let y = 0;
    for (const node of nodesInRank) {
      node.y = y;
      y += node.height + graph.nodeSep;
    }
    void r;
  }
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
