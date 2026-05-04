import type { DotWorkingGraph, ClusterBounds } from './types.js';

export type { ClusterBounds };

/**
 * dot_clust — derive cluster rank bounds from nodes that carry a clusterId.
 *
 * Mirrors the intent of dotclusterrank() + dot_clust() in cluster.c:
 * walk all nodes, group by cluster identifier, and compute the min/max
 * rank for each cluster.  The full graphviz implementation also builds
 * virtual border nodes and skeleton edges; those are omitted here because
 * they require the rank and spanning-tree infrastructure that isn't wired
 * up for the PlantUML dot pipeline yet (T10 adds the DotWorkingGraph.clusters
 * field that will drive that wiring).
 */
export function dot_clust(graph: DotWorkingGraph): Map<string, ClusterBounds> {
  const bounds = new Map<string, ClusterBounds>();

  for (const node of graph.nodes) {
    const cid = node.clusterId;
    if (cid === undefined) continue;

    const existing = bounds.get(cid);
    if (existing === undefined) {
      bounds.set(cid, { minRank: node.rank, maxRank: node.rank });
    } else {
      if (node.rank < existing.minRank) existing.minRank = node.rank;
      if (node.rank > existing.maxRank) existing.maxRank = node.rank;
    }
  }

  return bounds;
}
