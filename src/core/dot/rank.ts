import type { DotWorkingGraph, DotNode, DotEdge } from './types.js';

function topologicalOrder(nodes: DotNode[], edges: DotEdge[]): DotNode[] {
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    inDegree.set(edge.to.id, (inDegree.get(edge.to.id) ?? 0) + 1);
  }

  const queue: DotNode[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node);
    }
  }

  const order: DotNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const edge of edges) {
      if (edge.from.id === node.id) {
        const deg = (inDegree.get(edge.to.id) ?? 0) - 1;
        inDegree.set(edge.to.id, deg);
        if (deg === 0) {
          const toNode = nodes.find(n => n.id === edge.to.id);
          if (toNode !== undefined) {
            queue.push(toNode);
          }
        }
      }
    }
  }
  return order;
}

export function assignRanks(graph: DotWorkingGraph): void {
  if (graph.nodes.length === 0) {
    return;
  }

  const topoOrder = topologicalOrder(graph.nodes, graph.edges);

  for (const node of topoOrder) {
    node.rank = 0;
  }

  for (const node of topoOrder) {
    for (const edge of graph.edges) {
      if (edge.from.id === node.id) {
        const candidate = node.rank + edge.minLen;
        if (candidate > edge.to.rank) {
          edge.to.rank = candidate;
        }
      }
    }
  }

  // Backward normalization pass (reverse topological order).
  // The forward pass gives each node the MINIMUM rank that satisfies all
  // incoming-edge constraints, so nodes with no predecessors always land at
  // rank 0 even when all their successors are deep in the graph.  Moving such
  // a node down to rank (min-successor - minLen) reduces total edge span
  // without violating any constraint, producing shorter, less crossing-prone
  // edges — the same effect graphviz's network-simplex achieves.
  const reverseTopoOrder = [...topoOrder].reverse();
  for (const node of reverseTopoOrder) {
    const outgoing = graph.edges.filter(e => e.from.id === node.id);
    if (outgoing.length === 0) continue; // sink — nothing to tighten

    // Furthest down we can move without overshooting a successor.
    const maxFeasible = Math.min(...outgoing.map(e => e.to.rank - e.minLen));

    // Closest to the top we must stay (predecessor constraints).
    const incoming = graph.edges.filter(e => e.to.id === node.id);
    const minFeasible = incoming.length === 0
      ? 0
      : Math.max(...incoming.map(e => e.from.rank + e.minLen));

    if (maxFeasible > node.rank && maxFeasible >= minFeasible) {
      node.rank = maxFeasible;
    }
  }

  const edgesToAdd: DotEdge[] = [];
  const edgesToRemove = new Set<string>();

  for (const edge of graph.edges) {
    const span = edge.to.rank - edge.from.rank;
    if (span > edge.minLen) {
      const virtualNodes: DotNode[] = [];
      const intermediateCount = span - 1;

      for (let i = 1; i <= intermediateCount; i++) {
        const vn: DotNode = {
          id: `__vn_${edge.id}_${i}`,
          width: 0,
          height: 0,
          rank: edge.from.rank + i,
          order: -1,
          x: 0,
          y: 0,
          virtual: true,
        };
        virtualNodes.push(vn);
        graph.nodes.push(vn);
      }

      edge.virtualNodes = virtualNodes;
      edgesToRemove.add(edge.id);

      const chain: DotNode[] = [edge.from, ...virtualNodes, edge.to];
      for (let i = 0; i < chain.length - 1; i++) {
        const segFrom = chain[i]!;
        const segTo = chain[i + 1]!;
        edgesToAdd.push({
          id: `__ve_${edge.id}_${i}`,
          from: segFrom,
          to: segTo,
          weight: edge.weight,
          minLen: 1,
          reversed: false,
          points: [],
        });
      }
    }
  }

  graph.longEdges = graph.edges.filter(e => edgesToRemove.has(e.id));
  graph.edges = graph.edges.filter(e => !edgesToRemove.has(e.id));
  for (const e of edgesToAdd) {
    graph.edges.push(e);
  }
}
