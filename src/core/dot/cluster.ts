import type { DotWorkingGraph } from './types.js';

export interface ClusterBounds {
  minRank: number;
  maxRank: number;
}

// T10 will add clusterId to DotNode in types.ts. Until then, access it via
// this local augmentation so cluster.ts compiles without touching types.ts.
interface NodeWithClusterId {
  clusterId?: string;
  rank: number;
}

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
    const n = node as unknown as NodeWithClusterId;
    const cid = n.clusterId;
    if (cid === undefined) continue;

    const existing = bounds.get(cid);
    if (existing === undefined) {
      bounds.set(cid, { minRank: n.rank, maxRank: n.rank });
    } else {
      if (n.rank < existing.minRank) existing.minRank = n.rank;
      if (n.rank > existing.maxRank) existing.maxRank = n.rank;
    }
  }

  return bounds;
}
