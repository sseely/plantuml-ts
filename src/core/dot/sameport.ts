import type { DotWorkingGraph, DotEdge, DotNode } from './types.js';

/**
 * Local extension of DotEdge with sameport fan-out metadata.
 *
 * portOffset  — signed lateral pixel shift for this edge on the shared node
 *   boundary, perpendicular to the average approach direction.
 * tailAnchorX — x offset from edge.from's centre to the fan-out anchor on
 *   its boundary (written by tail-group processing, read by tailStartPoint).
 * tailAnchorY — y offset from edge.from's centre.
 * headAnchorX — x offset from edge.to's centre to the fan-out anchor on
 *   its boundary (written by head-group processing, read by headEndPoint).
 * headAnchorY — y offset from edge.to's centre.
 */
export interface DotEdgeWithPort extends DotEdge {
  portOffset?: number;
  tailAnchorX?: number;
  tailAnchorY?: number;
  headAnchorX?: number;
  headAnchorY?: number;
}

type Point = { x: number; y: number };

const PORT_FANOUT_STEP = 8;

function nodeCenter(n: DotNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

/**
 * Computes the intersection of the ray from the node centre toward `target`
 * with the axis-aligned ellipse inscribed in the node bounding box.
 *
 * This mirrors graphviz shape_clip() for elliptical nodes, matching the model
 * used by splines.ts ellipseEdgePoint.
 *
 * Returns a point ON the node boundary, expressed as an offset from the node
 * centre (matching how sameport.c returns x1,y1 relative to ND_coord(u)).
 */
function ellipseBoundaryOffset(node: DotNode, target: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rx = node.width / 2;
  const ry = node.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const denom = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) || 1;
  return {
    x: Math.round(dx / denom),
    y: Math.round(dy / denom),
  };
}

/**
 * Half-width of node u. C: ND_lw(u)
 * In our model nodes are axis-aligned rectangles; lw = width / 2.
 */
function node_lw(u: DotNode): number {
  return u.width / 2;
}

/**
 * Half-width of node u. C: ND_rw(u)
 */
function node_rw(u: DotNode): number {
  return u.width / 2;
}

/**
 * Full height of node u. C: ND_ht(u)
 */
function node_ht(u: DotNode): number {
  return u.height;
}

/**
 * For a group of edges that all connect to node `u` (either as head or tail),
 * computes the average approach direction from the OTHER endpoints toward `u`,
 * finds where that average ray intersects `u`'s boundary, then assigns
 * symmetric fan-out offsets perpendicular to the approach direction.
 *
 * C reference: sameport() in sameport.c:93-189
 *   - average direction via unit vectors (avoids 2π wrap-around issue)
 *   - boundary intersection via shape_clip (ellipse model here)
 *   - fan-out offset: not in original C (which collapses to one port point)
 *     — added here so splines.ts spreads the edges instead of stacking them
 */
function applyFanout(u: DotNode, edges: DotEdgeWithPort[], side: 'head' | 'tail'): void {
  const uc = nodeCenter(u);

  // Compute average direction unit vector from the other endpoint toward u.
  // C sameport.c:110-124: direction is (v - u) / |v - u|, summed, normalised.
  let ax = 0;
  let ay = 0;
  for (const e of edges) {
    const other = e.from === u ? e.to : e.from;
    const oc = nodeCenter(other);
    const dx = oc.x - uc.x;
    const dy = oc.y - uc.y;
    const r = Math.sqrt(dx * dx + dy * dy) || 1;
    ax += dx / r;
    ay += dy / r;
  }
  const ar = Math.sqrt(ax * ax + ay * ay) || 1;
  ax /= ar;
  ay /= ar;

  // Boundary offset — shared port point on u's boundary along the average
  // direction. C sameport.c:126-146: uses shape_clip on a straight-line
  // Bézier; we use the ellipse model directly.
  // C: r = fmax(ND_lw + ND_rw, ND_ht + GD_ranksep) to get a point far away.
  const farDist = Math.max(node_lw(u) + node_rw(u), node_ht(u) + 36) + 1;
  const farTarget: Point = {
    x: uc.x + ax * farDist,
    y: uc.y + ay * farDist,
  };
  const boundOffset = ellipseBoundaryOffset(u, farTarget);

  // Perpendicular unit vector to the average approach direction (for spreading).
  // Rotate (ax, ay) by 90°: (-ay, ax).
  const px = -ay;
  const py = ax;

  // Sort edges so the anchor assignment order matches the spatial order of their
  // other endpoints projected onto the perpendicular direction. This prevents
  // crossings: the edge aimed at the topmost / leftmost target departs from the
  // topmost / leftmost anchor position.
  const sorted = edges.slice().sort((a, b) => {
    const aOther = nodeCenter(a.from === u ? a.to : a.from);
    const bOther = nodeCenter(b.from === u ? b.to : b.from);
    return (aOther.x * px + aOther.y * py) - (bOther.x * px + bOther.y * py);
  });

  // Assign symmetric fan-out offsets: edges spread evenly around the shared
  // port, spaced PORT_FANOUT_STEP pixels apart.
  // With N edges: offsets are -(N-1)/2, -(N-3)/2, ..., (N-1)/2 × step.
  const n = sorted.length;
  for (let i = 0; i < n; i++) {
    const scalar = (i - (n - 1) / 2) * PORT_FANOUT_STEP;
    const e = sorted[i]!;
    e.portOffset = scalar;
    if (side === 'tail') {
      e.tailAnchorX = boundOffset.x + px * scalar;
      e.tailAnchorY = boundOffset.y + py * scalar;
    } else {
      e.headAnchorX = boundOffset.x + px * scalar;
      e.headAnchorY = boundOffset.y + py * scalar;
    }
  }
}

/**
 * Groups edges that share a real (non-virtual) endpoint node and applies
 * sameport fan-out offsets so shared-port edges spread across the node
 * boundary rather than stacking at the same point.
 *
 * C reference: dot_sameports() in sameport.c:41-78.
 *
 * Differences from C:
 * - C groups edges by explicit samehead/sametail string attributes; we group
 *   all real edges that share the same node as head, or the same node as
 *   tail.
 * - C collapses a group to one shared port; we spread them with fan-out
 *   offsets so splines.ts can route them to distinct boundary positions.
 * - Self-loops and edges with virtual endpoints are skipped, matching C's
 *   "Don't support same* for loops" guard (sameport.c:56).
 */
export function sameport(graph: DotWorkingGraph): void {
  // Only process short edges (graph.edges). Long edges in graph.longEdges are
  // routed through virtual node corridors — their boundary spread comes
  // naturally from the corridor fanOffset rather than explicit port anchors.
  // Including longEdges here was incorrect and applied tail anchors computed
  // from the wrong node context (the real endpoint, not the first virtual).
  const realEdges = graph.edges.filter(
    (e) => !e.from.virtual && !e.to.virtual && e.from !== e.to,
  ) as DotEdgeWithPort[];

  // Build per-node head-port groups (node u is the head/to of the edge).
  const headGroups = new Map<DotNode, DotEdgeWithPort[]>();
  for (const e of realEdges) {
    const group = headGroups.get(e.to);
    if (group !== undefined) {
      group.push(e);
    } else {
      headGroups.set(e.to, [e]);
    }
  }

  // Build per-node tail-port groups (node u is the tail/from of the edge).
  const tailGroups = new Map<DotNode, DotEdgeWithPort[]>();
  for (const e of realEdges) {
    const group = tailGroups.get(e.from);
    if (group !== undefined) {
      group.push(e);
    } else {
      tailGroups.set(e.from, [e]);
    }
  }

  // Apply fan-out for groups with more than one edge. C: sameport.c:64-73 —
  // sameport() is called only when LIST_SIZE > 1.
  for (const [node, edges] of headGroups) {
    if (edges.length > 1) {
      applyFanout(node, edges, 'head');
    }
  }
  for (const [node, edges] of tailGroups) {
    if (edges.length > 1) {
      applyFanout(node, edges, 'tail');
    }
  }
}
