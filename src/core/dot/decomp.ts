/**
 * decomp.ts — Connected-component decomposition for the dot layout engine.
 *
 * Port of graphviz/lib/dotgen/decomp.c.
 *
 * Purpose: identify all connected components of a graph and return each as an
 * independent DotWorkingGraph view.  The returned sub-graphs share the same
 * DotNode/DotEdge object references as the original graph — rank assignments
 * written through the sub-graph are immediately visible on the original.
 *
 * The C implementation uses a global Cmark counter + ND_mark per node to track
 * visited status across calls.  Here we use a per-call Set<DotNode> which is
 * equivalent and avoids global mutable state.
 */

import type { DotWorkingGraph, DotNode, DotEdge } from './types.js';

// ---------------------------------------------------------------------------
// search_component — iterative DFS from seed node n
// Adds all reachable nodes (in both edge directions) to the visited set and
// to the component node list.
//
// C equivalent: search_component() in decomp.c — iterates flat_in, flat_out,
// in, out edge lists.  We have only one edge list (graph.edges) and traverse
// both .from and .to endpoints, which gives the same undirected reachability.
// ---------------------------------------------------------------------------

function searchComponent(
  graph: DotWorkingGraph,
  seed: DotNode,
  visited: Set<DotNode>,
): DotNode[] {
  const component: DotNode[] = [];
  const stack: DotNode[] = [seed];
  visited.add(seed);

  while (stack.length > 0) {
    const n = stack.pop()!;
    component.push(n);

    // Traverse all edges incident to n (in both directions).
    // C uses flat_in, flat_out, in, out — all edge lists.  Our graph has a
    // single edges array so we check both endpoints.
    for (const e of graph.edges) {
      let other: DotNode | undefined;
      if (e.from === n) {
        other = e.to;
      } else if (e.to === n) {
        other = e.from;
      }
      if (other !== undefined && !visited.has(other)) {
        visited.add(other);
        stack.push(other);
      }
    }
  }

  return component;
}

// ---------------------------------------------------------------------------
// edgeInduce — collect edges whose both endpoints are in nodeSet
// C equivalent: edgeInduce() in decomp.c
// ---------------------------------------------------------------------------

function edgeInduce(
  graph: DotWorkingGraph,
  nodeSet: Set<DotNode>,
): DotEdge[] {
  return graph.edges.filter(e => nodeSet.has(e.from) && nodeSet.has(e.to));
}

// ---------------------------------------------------------------------------
// decompose — public entry point
//
// C signature: void decompose(graph_t *g, int pass)
// We drop the `pass` parameter: pass > 0 handles cluster rank-leader
// substitution which is not implemented in this codebase.  The pass=0 path
// is the standard decomposition.
//
// Returns one DotWorkingGraph per connected component.  Each sub-graph:
//   - nodes: subset of original nodes (same object references)
//   - edges: subset of original edges with both endpoints in this component
//   - longEdges: [] (populated later during rank assignment)
//   - rankDir, nodeSep, rankSep: copied from the original graph
// ---------------------------------------------------------------------------

export function decompose(graph: DotWorkingGraph): DotWorkingGraph[] {
  if (graph.nodes.length === 0) return [];

  const visited = new Set<DotNode>();
  const components: DotWorkingGraph[] = [];

  // C: for (n = agfstnode(g); n; n = agnxtnode(g, n))
  // Seed iteration uses only real (non-virtual) nodes, matching the C code
  // comment: "searches temporary edges and ignores non-root nodes."
  // Virtual nodes are discovered through edge traversal and included in the
  // component, but they are never used as seeds.
  for (const n of graph.nodes) {
    if (n.virtual) continue;  // not a seed — will be reached via edges
    if (visited.has(n)) continue;

    const compNodes = searchComponent(graph, n, visited);
    const compNodeSet = new Set(compNodes);
    const compEdges = edgeInduce(graph, compNodeSet);

    components.push({
      nodes: compNodes,
      edges: compEdges,
      longEdges: [],
      rankDir: graph.rankDir,
      nodeSep: graph.nodeSep,
      rankSep: graph.rankSep,
    });
  }

  return components;
}
