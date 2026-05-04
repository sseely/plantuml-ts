import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';

// T10 adds lhead/ltail to DotEdge and clusterId to DotNode in types.ts.
// Until then, access them via local interface casts.
interface CompoundEdge extends DotEdge {
  lhead?: string;
  ltail?: string;
}

interface NodeWithClusterId extends DotNode {
  clusterId?: string;
}

/**
 * findBorderNode — return the virtual border node for `clusterId` that is
 * closest to the opposite endpoint of the edge.
 *
 * For an lhead cluster (head redirection) we want the entry point — the
 * virtual node with the *lowest* rank, which is the cluster boundary a
 * downward-flowing edge first crosses.
 *
 * For an ltail cluster (tail redirection) we want the exit point — the
 * virtual node with the *highest* rank.
 */
function findBorderNode(
  graph: DotWorkingGraph,
  clusterId: string,
  forHead: boolean,
): DotNode | undefined {
  let best: DotNode | undefined;
  for (const node of graph.nodes) {
    const n = node as unknown as NodeWithClusterId;
    if (!node.virtual || n.clusterId !== clusterId) continue;
    if (best === undefined) {
      best = node;
    } else if (forHead ? node.rank < best.rank : node.rank > best.rank) {
      best = node;
    }
  }
  return best;
}

/**
 * compoundEdges — redirect edge endpoints for compound edges.
 *
 * Mirrors dot_compoundEdges() in compound.c: for each edge that carries an
 * lhead or ltail attribute naming a cluster, replace the edge's head or tail
 * with the virtual border node at the cluster boundary.  If no virtual border
 * node exists for the named cluster, the edge is left unchanged (graceful
 * no-op matching the T10-incomplete state described in the architecture
 * decision D3).
 *
 * The full graphviz compound.c also clips rendered splines to cluster
 * bounding boxes; that post-layout phase is not yet wired because spline
 * coordinates are not available at this pipeline stage.
 */
export function compoundEdges(graph: DotWorkingGraph): void {
  for (const edge of graph.edges) {
    const e = edge as unknown as CompoundEdge;

    if (e.lhead !== undefined && e.lhead !== '') {
      const border = findBorderNode(graph, e.lhead, true);
      if (border !== undefined) {
        e.to = border;
      }
    }

    if (e.ltail !== undefined && e.ltail !== '') {
      const border = findBorderNode(graph, e.ltail, false);
      if (border !== undefined) {
        e.from = border;
      }
    }
  }
}
