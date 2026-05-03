/**
 * fastgr.ts — flat graph helpers
 *
 * Port of the flat-edge bookkeeping from graphviz lib/dotgen/fastgr.c.
 *
 * In the C implementation every node carries two elists (ND_flat_out,
 * ND_flat_in) that hold edges whose both endpoints share the same rank.
 * These are populated lazily via flat_edge() as ranks are assigned, and
 * freed at cleanup.
 *
 * Here we expose two higher-level entry points:
 *
 *   agflatten(graph)  — scan all edges (including longEdges) and populate
 *                       node.flatOut / node.flatIn for every flat edge
 *                       (from.rank === to.rank).
 *
 *   unflatten(graph)  — clear those arrays on every node so that the next
 *                       agflatten call starts from a clean slate.
 *
 * C equivalents
 *   flat_edge()       → the per-edge append done inside agflatten
 *   agflatten_elist() → (implicit) the loop inside agflatten per-edge
 *   unflatten()       → unflatten
 */

import type { DotEdge, DotNode, DotWorkingGraph } from './types.js';

/**
 * agflatten_elist — append a single flat edge to the tail node's flatOut
 * list and the head node's flatIn list.
 *
 * C: flat_edge() in fastgr.c — elist_append(e, ND_flat_out(tail)) +
 *                               elist_append(e, ND_flat_in(head))
 */
function agflatten_elist(e: DotEdge): void {
  const tail: DotNode = e.from;
  const head: DotNode = e.to;

  if (tail.flatOut === undefined) {
    tail.flatOut = [];
  }
  tail.flatOut.push(e);

  if (head.flatIn === undefined) {
    head.flatIn = [];
  }
  head.flatIn.push(e);
}

/**
 * agflatten — populate flatOut / flatIn on every node for all flat edges
 * in the graph.
 *
 * A flat edge is one whose tail and head share the same rank
 * (from.rank === to.rank).  Self-loops (from === to) are flat by definition
 * and therefore appear in both flatOut and flatIn of the same node.
 *
 * Both graph.edges and graph.longEdges are scanned so that virtual
 * same-rank segments (rare but possible) are also captured.
 *
 * C: there is no single agflatten() in graphviz; this is the TypeScript
 * equivalent of the init-time elist population that happens across
 * rank.c, mincross.c, and flat_edge() in fastgr.c.
 */
export function agflatten(graph: DotWorkingGraph): void {
  const allEdges = [...graph.edges, ...graph.longEdges];
  for (const e of allEdges) {
    if (e.from.rank === e.to.rank) {
      agflatten_elist(e);
    }
  }
}

/**
 * unflatten — clear flatOut and flatIn on every node in the graph.
 *
 * After this call all flat arrays are absent; the GC reclaims the
 * backing arrays (no explicit free needed, unlike the C free_list() calls
 * in dot_cleanup_node()).
 *
 * Uses `delete` rather than assignment to `undefined` to satisfy
 * exactOptionalPropertyTypes (TS strict mode).
 *
 * C: dot_cleanup_node() → free_list(ND_flat_out(n)) + free_list(ND_flat_in(n))
 */
export function unflatten(graph: DotWorkingGraph): void {
  for (const n of graph.nodes) {
    delete n.flatOut;
    delete n.flatIn;
  }
}
