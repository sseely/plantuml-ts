/**
 * class2.ts — virtual node chains for long edges and label nodes
 *
 * Port of graphviz/lib/dotgen/class2.c (AT&T / Eclipse Public License v2.0).
 * Corresponds to the Smetana Java port in
 *   plantuml/.../smetana/gen/lib/dotgen/class2.java
 *
 * Responsibilities:
 *  - make_chain: for each long edge (rank span > 1), insert virtual nodes at
 *    every intermediate rank and replace the original edge with a chain of
 *    unit-length segment edges.  The original edge is moved to longEdges[].
 *  - label_vnode: for a labeled edge, create a virtual label-carrier node.
 *    Its width = nodeSep + (labelWidth ?? 0) and height = (labelHeight ?? 0).
 *  - class2: entry point — processes every edge in graph.edges.
 */

import type { DotNode, DotEdge, DotWorkingGraph } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Counter for generating unique virtual node / edge IDs. */
let _vnodeSeq = 0;

function nextVnodeId(): string {
  return `__vn_c2_${++_vnodeSeq}`;
}

function nextVedgeId(): string {
  return `__ve_c2_${++_vnodeSeq}`;
}

/**
 * plain_vnode — create a plain (non-label) virtual node.
 *
 * C: plain_vnode() → virtual_node() + incr_width()
 * incr_width adds nodeSep/2 to lw and rw, so total width = nodeSep.
 */
function plain_vnode(graph: DotWorkingGraph): DotNode {
  const v: DotNode = {
    id: nextVnodeId(),
    width: graph.nodeSep,
    height: 0,
    rank: -1,
    order: -1,
    x: 0,
    y: 0,
    virtual: true,
  };
  graph.nodes.push(v);
  return v;
}

/**
 * label_vnode — create a virtual node that carries an edge label.
 *
 * C: label_vnode()
 *   ND_lw(v) = GD_nodesep(root)          → left half  = nodeSep
 *   ND_rw(v) = dimen.x (flip=false)      → right half = labelWidth
 *   ND_ht(v) = dimen.y (flip=false)      → height     = labelHeight
 *
 * In our flat model width = lw + rw = nodeSep + labelWidth.
 * The graph is always treated as non-flipped (TB / LR handled by renderer).
 */
function label_vnode(graph: DotWorkingGraph, orig: DotEdge): DotNode {
  const v: DotNode = {
    id: nextVnodeId(),
    width: graph.nodeSep + (orig.labelWidth ?? 0),
    height: orig.labelHeight ?? 0,
    rank: -1,
    order: -1,
    x: 0,
    y: 0,
    virtual: true,
  };
  orig.labelNode = v;
  graph.nodes.push(v);
  return v;
}

/**
 * make_chain — replace a long edge with a chain of virtual nodes + unit edges.
 *
 * C: make_chain(g, from, to, orig)
 *
 * For r = from.rank+1 .. to.rank:
 *   if r < to.rank  → create virtual node (label node if r == label_rank)
 *   if r == to.rank → use the real destination node
 *   create a virtual edge (u → v) with the original edge's weight
 *
 * After this call the original edge is in graph.longEdges, and the new
 * segment edges are in graph.edges.
 *
 * Note: the caller is responsible for removing orig from graph.edges and
 * adding it to graph.longEdges.  make_chain only creates the segments.
 *
 * Sets orig.virtualNodes to the ordered list of intermediate virtual nodes
 * (excluding the real from/to endpoints). This is consumed by position.ts
 * (centerVirtualNodes) and splines.ts (makeBBoxCorridors, routeLongEdgeInCorridor).
 *
 * Returns the array of new segment edges.
 */
function make_chain(
  graph: DotWorkingGraph,
  from: DotNode,
  to: DotNode,
  orig: DotEdge,
): DotEdge[] {
  const hasLabel = orig.label !== undefined && orig.label.length > 0;
  const labelRank = hasLabel
    ? Math.floor((from.rank + to.rank) / 2)
    : -1;

  const segments: DotEdge[] = [];
  const intermediates: DotNode[] = [];
  let u: DotNode = from;

  for (let r = from.rank + 1; r <= to.rank; r++) {
    let v: DotNode;
    if (r < to.rank) {
      if (r === labelRank) {
        // label_vnode already pushes to graph.nodes and sets orig.labelNode
        v = label_vnode(graph, orig);
      } else {
        // plain_vnode already pushes to graph.nodes
        v = plain_vnode(graph);
      }
      v.rank = r;
      intermediates.push(v);
    } else {
      v = to;
    }

    const seg: DotEdge = {
      id: nextVedgeId(),
      from: u,
      to: v,
      weight: orig.weight,
      minLen: 1,
      reversed: false,
      points: [],
    };
    segments.push(seg);
    u = v;
  }

  // Populate virtualNodes so that splines.ts and position.ts can route
  // through the intermediate virtual nodes after coordinates are assigned.
  orig.virtualNodes = intermediates;

  return segments;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * class2 — classify edges and create virtual chains.
 *
 * Post-conditions:
 *  - All edges with (to.rank - from.rank) > 1 are moved to graph.longEdges.
 *  - Those long edges are replaced in graph.edges by unit-length chain segs
 *    through virtual nodes added to graph.nodes.
 *  - For any edge (including span-1) with a non-empty label, edge.labelNode
 *    is set to a new virtual node in graph.nodes.
 *  - For long edges, edge.virtualNodes is set to the ordered list of
 *    intermediate virtual nodes for use by position.ts and splines.ts.
 */
export function class2(graph: DotWorkingGraph): void {
  const toRemove = new Set<string>();
  const toAdd: DotEdge[] = [];

  for (const edge of graph.edges) {
    const span = edge.to.rank - edge.from.rank;

    if (span > 1) {
      // Long edge: create chain, move original to longEdges
      const segments = make_chain(graph, edge.from, edge.to, edge);
      toRemove.add(edge.id);
      graph.longEdges.push(edge);
      for (const seg of segments) {
        toAdd.push(seg);
      }
    }
  }

  // Apply removals and additions
  if (toRemove.size > 0) {
    graph.edges = graph.edges.filter(e => !toRemove.has(e.id));
    for (const seg of toAdd) {
      graph.edges.push(seg);
    }
  }
}
