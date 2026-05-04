import type { DotWorkingGraph, DotNode } from '../dot/types.js';

export function findConnectedComponents(g: DotWorkingGraph): DotWorkingGraph[] {
  if (g.nodes.length === 0) return [];

  const adjacency = new Map<string, Set<string>>();
  for (const n of g.nodes) {
    adjacency.set(n.id, new Set());
  }

  const allEdges = [...g.edges, ...g.longEdges];
  for (const e of allEdges) {
    adjacency.get(e.from.id)?.add(e.to.id);
    adjacency.get(e.to.id)?.add(e.from.id);
  }

  const nodeById = new Map<string, DotNode>();
  for (const n of g.nodes) {
    nodeById.set(n.id, n);
  }

  const visited = new Set<string>();
  const components: DotWorkingGraph[] = [];

  for (const startNode of g.nodes) {
    if (visited.has(startNode.id)) continue;

    const compNodes: DotNode[] = [];
    const stack: string[] = [startNode.id];
    visited.add(startNode.id);

    while (stack.length > 0) {
      const id = stack.pop()!;
      const n = nodeById.get(id)!;
      compNodes.push(n);

      const neighbors = adjacency.get(id) ?? new Set<string>();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
    }

    const compNodeIds = new Set(compNodes.map((n) => n.id));
    const compEdges = g.edges.filter(
      (e) => compNodeIds.has(e.from.id) && compNodeIds.has(e.to.id),
    );
    const compLongEdges = g.longEdges.filter(
      (e) => compNodeIds.has(e.from.id) && compNodeIds.has(e.to.id),
    );

    components.push({
      nodes: compNodes,
      edges: compEdges,
      longEdges: compLongEdges,
      rankDir: g.rankDir,
      nodeSep: g.nodeSep,
      rankSep: g.rankSep,
    });
  }

  return components;
}
