import type { DotWorkingGraph, DotEdge, DotNode } from './types.js';
import type { DotEdgeWithPort } from './sameport.js';

type Point = { x: number; y: number };

// D-1: local type — do NOT export
type BoxCorridor = { rank: number; xLeft: number; xRight: number; yTop: number; yBottom: number };

function center(node: DotNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/**
 * Returns the point where the ray from `node`'s centre toward `toward`
 * intersects the ellipse inscribed in the node bounding box.
 *
 * Using the ellipse boundary for all node shapes means edges naturally
 * spread across a node face when multiple edges leave in different
 * directions, matching Graphviz's clip_and_install behaviour.
 */
function ellipseEdgePoint(node: DotNode, toward: Point): Point {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rx = node.width / 2;
  const ry = node.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const denom = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) || 1;
  return { x: cx + dx / denom, y: cy + dy / denom };
}

function smoothPolyline(waypoints: Point[]): Point[] {
  if (waypoints.length <= 2) return waypoints;

  const result: Point[] = [waypoints[0]!];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    result.push({ x: midX, y: midY });
  }
  result.push(waypoints[waypoints.length - 1]!);
  return result;
}

/**
 * fitBezier — convert an N-point polyline to cubic Bezier control points
 * using Catmull-Rom to cubic Bezier conversion.
 *
 * Output format (SVG C-command ready):
 *   [P0, CP1, CP2, P1, CP1, CP2, P2, ...]
 * For 2-point input [A, B]: returns [A, B] unchanged.
 * For N≥3 points: returns 1 + 3*(N-1) points.
 */
export function fitBezier(polyline: Point[]): Point[] {
  if (polyline.length < 2) return polyline.slice();
  if (polyline.length === 2) return [polyline[0]!, polyline[1]!];

  const n = polyline.length;
  const tangents: Point[] = new Array(n) as Point[];

  for (let i = 1; i < n - 1; i++) {
    const prev = polyline[i - 1]!;
    const next = polyline[i + 1]!;
    tangents[i] = {
      x: (next.x - prev.x) / 6,
      y: (next.y - prev.y) / 6,
    };
  }
  tangents[0] = tangents[1]!;
  tangents[n - 1] = tangents[n - 2]!;

  const result: Point[] = [polyline[0]!];
  for (let i = 0; i < n - 1; i++) {
    const p0 = polyline[i]!;
    const p1 = polyline[i + 1]!;
    const t0 = tangents[i]!;
    const t1 = tangents[i + 1]!;

    let cp1: Point;
    let cp2: Point;

    if (i === 0) {
      cp1 = { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
      cp2 = { x: p1.x - t1.x, y: p1.y - t1.y };
    } else if (i === n - 2) {
      cp1 = { x: p0.x + t0.x, y: p0.y + t0.y };
      cp2 = { x: p1.x - (p1.x - p0.x) / 3, y: p1.y - (p1.y - p0.y) / 3 };
    } else {
      cp1 = { x: p0.x + t0.x, y: p0.y + t0.y };
      cp2 = { x: p1.x - t1.x, y: p1.y - t1.y };
    }

    result.push(cp1, cp2, p1);
  }

  return result;
}


function routeSelfLoop(edge: DotEdge): void {
  const node = edge.from;
  // Exit the node at mid-right, loop out to the right, and re-enter at the top.
  // The four points are M start C cp1 cp2 end (cubic bezier).
  const start: Point = { x: node.x + node.width, y: node.y + node.height / 2 };
  const cp1: Point = { x: node.x + node.width + 30, y: node.y + node.height / 2 };
  const cp2: Point = { x: node.x + node.width + 30, y: node.y - 10 };
  const end: Point = { x: node.x + node.width / 2, y: node.y };
  edge.points = [start, cp1, cp2, end];
  edge.spline = true;
}

const PARALLEL_OFFSET = 40;
const MULTISEP = 16;

// C: beginpath() splines.c:392 — start.p = node_center + port.p
function tailStartPoint(edge: DotEdge, rankDir: DotWorkingGraph['rankDir']): Point {
  const node = edge.from;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  if (edge.tailportY !== undefined) {
    const portY = cy + edge.tailportY * node.height;
    if (rankDir === 'LR') return { x: node.x + node.width, y: portY };
    if (rankDir === 'RL') return { x: node.x, y: portY };
    // TB / BT: tailportY acts as horizontal ratio for exit column
    const portX = cx + edge.tailportY * node.width;
    if (rankDir === 'BT') return { x: portX, y: node.y };
    return { x: portX, y: node.y + node.height }; // TB default
  }

  // Sameport tail anchor: use pre-computed boundary offset when available.
  // Guard: only active when sameport() has run and set portAnchorX/portAnchorY.
  const ep = edge as DotEdgeWithPort;
  if (ep.portAnchorX !== undefined && ep.portAnchorY !== undefined) {
    return { x: cx + ep.portAnchorX, y: cy + ep.portAnchorY };
  }

  return ellipseEdgePoint(node, center(edge.to));
}

/**
 * Returns the anchor point on `edge.to`'s boundary where the edge arrives.
 *
 * When sameport() has set portAnchorX/portAnchorY on the edge (indicating
 * that this edge belongs to a shared-port fan-out group), those pre-computed
 * boundary offsets are used directly so the edge arrives at a spread position
 * rather than collapsing to the same point as its siblings.
 *
 * Guard: when portAnchorX/portAnchorY are absent (sameport not called, or no
 * shared port), this is identical to the plain ellipseEdgePoint call.
 */
function headEndPoint(edge: DotEdge): Point {
  const node = edge.to;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const ep = edge as DotEdgeWithPort;
  if (ep.portAnchorX !== undefined && ep.portAnchorY !== undefined) {
    return { x: cx + ep.portAnchorX, y: cy + ep.portAnchorY };
  }
  return ellipseEdgePoint(node, center(edge.from));
}

function routeShortEdge(
  edge: DotEdge,
  rankDir: DotWorkingGraph['rankDir'],
  obstacles: ObstaclePolygon[],
): void {
  const start = tailStartPoint(edge, rankDir);
  const end = headEndPoint(edge);
  const polyline = routePolyline(start, end, obstacles);
  const bezier = fitBezier(polyline);
  // Snap first/last control points back to the computed boundary points so
  // bezier fitting drift doesn't pull the line away from the node edge.
  bezier[0] = start;
  bezier[bezier.length - 1] = end;
  edge.points = bezier;
}

function routeParallelEdge(
  edge: DotEdge,
  _rankDir: DotWorkingGraph['rankDir'],
  idx: number,
  total: number,
): void {
  const start = ellipseEdgePoint(edge.from, center(edge.to));
  const end = ellipseEdgePoint(edge.to, center(edge.from));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector (rotate 90°)
  const perpX = -dy / len;
  const perpY = dx / len;
  // Symmetric offsets: edges spread evenly around the straight-line midpoint
  const offset = (idx - (total - 1) / 2) * PARALLEL_OFFSET;
  const midX = (start.x + end.x) / 2 + perpX * offset;
  const midY = (start.y + end.y) / 2 + perpY * offset;
  edge.points = [start, { x: midX, y: midY }, end];
}

/**
 * Computes per-virtual-node horizontal corridors for a long edge.
 *
 * C reference: maximal_bbox() dotsplines.c:2168–2225
 *
 * For each virtual node in the edge's virtual chain, finds the closest
 * real sibling nodes to its left and right at the same rank. The corridor
 * x-bounds are the gap between those siblings. Virtual nodes that belong
 * to this edge's own chain are excluded from the sibling search.
 */
function makeBBoxCorridors(edge: DotEdge, graph: DotWorkingGraph): BoxCorridor[] {
  const virtualNodes = edge.virtualNodes!;
  const ownVirtualSet = new Set(virtualNodes);

  return virtualNodes.map((vn) => {
    const vnRank = vn.rank;
    // Sibling nodes: real nodes at the same rank, not part of this edge's chain
    const siblings = graph.nodes.filter(
      (n) => n.rank === vnRank && !n.virtual && !ownVirtualSet.has(n),
    );

    const vnRight = vn.x + vn.width;

    // Leftmost boundary: rightmost sibling that ends to the left of vn.
    // Fall back to vn's own left edge when no left sibling is present, so
    // the corridor midpoint stays near vn's centre (not at x=0).
    let xLeft: number | null = null;
    for (const sib of siblings) {
      const sibRight = sib.x + sib.width;
      if (sibRight <= vn.x && (xLeft === null || sibRight > xLeft)) {
        xLeft = sibRight;
      }
    }
    if (xLeft === null) xLeft = vn.x;

    // Right boundary: leftmost sibling that starts to the right of vn.
    // Fall back to vn's own right edge when no right sibling is present,
    // so the corridor midpoint stays near vn's centre (not at x=100000).
    let xRight: number | null = null;
    for (const sib of siblings) {
      if (sib.x >= vnRight && (xRight === null || sib.x < xRight)) {
        xRight = sib.x;
      }
    }
    if (xRight === null) xRight = vnRight;

    return {
      rank: vnRank,
      xLeft,
      xRight,
      yTop: vn.y,
      yBottom: vn.y + vn.height,
    };
  });
}

/**
 * Routes a long edge through computed per-rank corridor midpoints.
 *
 * C reference: make_regular_edge() dotsplines.c:1783–1845 + midpoint walk
 *
 * Instead of routing through the raw virtual node centres (which can
 * visually pass through unrelated nodes), each corridor provides the
 * horizontal gap available at that rank. The waypoint is placed at the
 * horizontal midpoint of that gap, which guarantees the path stays in
 * the open space between real nodes.
 *
 * fanIdx / fanTotal: when multiple long edges share the same from→to pair,
 * each is offset by MULTISEP to prevent them from collapsing onto the same
 * corridor midpoint (C: dotsplines.c:1885-1907).
 */
function routeLongEdgeInCorridor(
  edge: DotEdge,
  corridors: BoxCorridor[],
  rankDir: DotWorkingGraph['rankDir'],
  fanIdx = 0,
  fanTotal = 1,
): void {
  const virtualNodes = edge.virtualNodes!;
  const lastVirtual = virtualNodes[virtualNodes.length - 1]!;
  const start = tailStartPoint(edge, rankDir);
  const end = ellipseEdgePoint(edge.to, center(lastVirtual));

  // C: dotsplines.c:1885-1907 — Multisep offset for parallel long edges
  const fanOffset = fanTotal > 1 ? (fanIdx - (fanTotal - 1) / 2) * MULTISEP : 0;
  const waypoints: Point[] = [start];
  for (const c of corridors) {
    const mx = (c.xLeft + c.xRight) / 2 + (rankDir === 'TB' || rankDir === 'BT' ? fanOffset : 0);
    const my = (c.yTop + c.yBottom) / 2 + (rankDir === 'LR' || rankDir === 'RL' ? fanOffset : 0);
    waypoints.push({ x: mx, y: my });
  }
  waypoints.push(end);

  const smoothed = smoothPolyline(waypoints);
  const bezier = fitBezier(smoothed);
  bezier[0] = start;
  bezier[bezier.length - 1] = end;
  edge.points = bezier;
  edge.spline = waypoints.length >= 3;
}

// ---------------------------------------------------------------------------
// Obstacle-aware free-space routing
// ---------------------------------------------------------------------------

export type ObstaclePolygon = { x: number; y: number; width: number; height: number };

export function buildObstaclePolygons(nodes: DotNode[]): ObstaclePolygon[] {
  // Only real nodes are obstacles; virtual nodes are routing waypoints and
  // their reserved-width boxes must not block edge paths (S-2 fix).
  return nodes
    .filter((n) => !n.virtual)
    .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));
}

/** 2-D cross product of vectors o→a and o→b. */
function cross2d(
  ox: number,
  oy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

/** True if point p lies on segment a→b (collinear case). */
function onSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return (
    Math.min(ax, bx) <= px &&
    px <= Math.max(ax, bx) &&
    Math.min(ay, by) <= py &&
    py <= Math.max(ay, by)
  );
}

/**
 * Returns true if segment a1→a2 crosses segment b1→b2.
 * Uses the cross-product (orientation) approach.
 */
export function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const d1 = cross2d(b1.x, b1.y, b2.x, b2.y, a1.x, a1.y);
  const d2 = cross2d(b1.x, b1.y, b2.x, b2.y, a2.x, a2.y);
  const d3 = cross2d(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y);
  const d4 = cross2d(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear cases
  if (d1 === 0 && onSegment(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y)) return true;
  if (d2 === 0 && onSegment(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return true;
  if (d3 === 0 && onSegment(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y)) return true;
  if (d4 === 0 && onSegment(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y)) return true;

  return false;
}

const CLEARANCE = 4;

/**
 * Returns true if segment p1→p2 does not intersect the rectangle defined by
 * (rx, ry, rw, rh) — tested without any additional inflation.
 * Used internally by the visibility-graph to check against original obstacle bounds.
 */
function segmentClearsRect(
  p1: Point,
  p2: Point,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const tl: Point = { x: rx, y: ry };
  const tr: Point = { x: rx + rw, y: ry };
  const br: Point = { x: rx + rw, y: ry + rh };
  const bl: Point = { x: rx, y: ry + rh };

  if (
    segmentsIntersect(p1, p2, tl, tr) ||
    segmentsIntersect(p1, p2, tr, br) ||
    segmentsIntersect(p1, p2, br, bl) ||
    segmentsIntersect(p1, p2, bl, tl)
  ) {
    return false;
  }

  // Midpoint-in-box: segment fully inside (endpoints outside but midpoint inside)
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  if (midX > rx && midX < rx + rw && midY > ry && midY < ry + rh) {
    return false;
  }

  return true;
}

/**
 * Returns true if segment p1→p2 does not pass through any obstacle
 * (obstacles are tested with CLEARANCE inflation on all sides).
 */
export function segmentClearsObstacles(
  p1: Point,
  p2: Point,
  obstacles: ObstaclePolygon[],
): boolean {
  for (const obs of obstacles) {
    const ix = obs.x - CLEARANCE;
    const iy = obs.y - CLEARANCE;
    const iw = obs.width + CLEARANCE * 2;
    const ih = obs.height + CLEARANCE * 2;
    if (!segmentClearsRect(p1, p2, ix, iy, iw, ih)) return false;
  }
  return true;
}

/**
 * Returns true if segment p1→p2 does not pass through any obstacle
 * when tested against original (non-inflated) bounding boxes.
 * Used in the visibility-graph Dijkstra phase so that corner vertices
 * (which lie on the inflated boundary) are reachable from outside.
 */
function segmentClearsObstaclesRaw(
  p1: Point,
  p2: Point,
  obstacles: ObstaclePolygon[],
): boolean {
  for (const obs of obstacles) {
    if (!segmentClearsRect(p1, p2, obs.x, obs.y, obs.width, obs.height)) return false;
  }
  return true;
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Routes a polyline from `start` to `end` avoiding `obstacles`.
 *
 * Uses a visibility-graph / Dijkstra approach:
 * - If the straight segment clears all obstacles (with CLEARANCE inflation),
 *   return [start, end].
 * - Otherwise build corner vertices from obstacle bounding boxes inflated
 *   by CLEARANCE=4, then find the shortest clear path via Dijkstra.
 *   The Dijkstra visibility check uses original (non-inflated) bounding boxes
 *   so that inflated corners are reachable as waypoints.
 */
export function routePolyline(
  start: Point,
  end: Point,
  obstacles: ObstaclePolygon[],
): Point[] {
  // Fast path: straight line is clear
  if (segmentClearsObstacles(start, end, obstacles)) {
    return [start, end];
  }

  // Build visibility-graph vertices: start + end + all inflated bbox corners
  const vertices: Point[] = [start, end];
  for (const obs of obstacles) {
    const ix = obs.x - CLEARANCE;
    const iy = obs.y - CLEARANCE;
    const iw = obs.width + CLEARANCE * 2;
    const ih = obs.height + CLEARANCE * 2;
    vertices.push(
      { x: ix, y: iy },
      { x: ix + iw, y: iy },
      { x: ix + iw, y: iy + ih },
      { x: ix, y: iy + ih },
    );
  }

  const n = vertices.length;
  const INF = Infinity;

  // Dijkstra with a simple array-based priority queue (n is small in practice)
  const distArr = new Array<number>(n).fill(INF);
  const prev = new Array<number>(n).fill(-1);
  const visited = new Array<boolean>(n).fill(false);
  distArr[0] = 0; // start is index 0

  for (let iter = 0; iter < n; iter++) {
    // Pick unvisited vertex with smallest tentative distance
    let u = -1;
    let bestDist = INF;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && distArr[i]! < bestDist) {
        bestDist = distArr[i]!;
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = true;

    if (u === 1) break; // reached end (index 1)

    const pu = vertices[u]!;
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const pv = vertices[v]!;
      // Use raw (non-inflated) obstacle bounds for visibility: the corner
      // vertices lie on the inflated boundary, so re-inflating would make
      // them unreachable from the outside.
      if (!segmentClearsObstaclesRaw(pu, pv, obstacles)) continue;
      const newDist = distArr[u]! + dist(pu, pv);
      if (newDist < distArr[v]!) {
        distArr[v] = newDist;
        prev[v] = u;
      }
    }
  }

  // Reconstruct path from end (index 1) back to start (index 0)
  if (distArr[1] === INF) {
    // No clear path found — fall back to straight line
    return [start, end];
  }

  const path: Point[] = [];
  let cur = 1;
  while (cur !== -1) {
    path.unshift(vertices[cur]!);
    cur = prev[cur]!;
  }
  return path;
}

/**
 * Routes a flat (same-rank) edge by bending it around both nodes.
 *
 * Porting `make_flat_edge` strategy 3 from dotsplines.c: adds two waypoints
 * that detour around both nodes so the edge doesn't cut through them.
 * - TB/BT: waypoints above both nodes
 * - LR/RL: waypoints to the left of both nodes
 *
 * When the edge has a labelNode (S-5), routes through the label centre,
 * matching make_flat_labeled_edge() dotsplines.c:1314-1416.
 */
export function routeFlatEdge(
  edge: DotEdge,
  obstacles: ObstaclePolygon[],
  rankDir: DotWorkingGraph['rankDir'],
): Point[] {
  const from = edge.from;
  const to = edge.to;

  let wp1: Point;
  let wp2: Point;

  if (rankDir === 'TB' || rankDir === 'BT') {
    const detourY = Math.min(from.y, to.y) - 20;
    wp1 = { x: from.x + from.width / 2, y: detourY };
    wp2 = { x: to.x + to.width / 2, y: detourY };
  } else {
    // LR or RL
    const detourX = Math.min(from.x, to.x) - 20;
    wp1 = { x: detourX, y: from.y + from.height / 2 };
    wp2 = { x: detourX, y: to.y + to.height / 2 };
  }

  const start = ellipseEdgePoint(from, wp1);
  const end = ellipseEdgePoint(to, wp2);

  // S-5: route through label node when present
  // C: make_flat_labeled_edge() dotsplines.c:1314-1416
  if (edge.labelNode) {
    const ln = edge.labelNode;
    const lx = ln.x + ln.width / 2;
    const ly = ln.y + ln.height / 2;
    return [start, wp1, { x: lx, y: ly }, { x: lx, y: ly }, wp2, end];
  }

  // The waypoints already detour around the nodes; no further obstacle
  // avoidance is needed for the individual segments.
  void obstacles; // accepted but not used per spec
  return [start, wp1, wp2, end];
}

export function routeEdges(graph: DotWorkingGraph): void {
  const { rankDir } = graph;

  // Build obstacle polygons once for the entire routing pass.
  const obstacles = buildObstaclePolygons(graph.nodes);

  // Count parallel short edges that share the same (from.id → to.id) pair after
  // acyclic reversal so they can be fanned out rather than overlapping.
  const parallelCount = new Map<string, number>();
  const parallelIdx = new Map<DotEdge, number>();
  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;
    if (edge.from.id === edge.to.id) continue;
    if (edge.from.rank === edge.to.rank) continue; // flat edges handled separately
    const key = `${edge.from.id}→${edge.to.id}`;
    const idx = parallelCount.get(key) ?? 0;
    parallelIdx.set(edge, idx);
    parallelCount.set(key, idx + 1);
  }

  for (const edge of graph.edges) {
    if (edge.from.virtual || edge.to.virtual) continue;

    if (edge.from.id === edge.to.id) {
      routeSelfLoop(edge);
    } else if (edge.from.rank === edge.to.rank) {
      // Flat (same-rank) edge: detour around both nodes, rendered as cubic bezier.
      edge.points = routeFlatEdge(edge, obstacles, rankDir);
      edge.spline = true;
    } else {
      const key = `${edge.from.id}→${edge.to.id}`;
      const total = parallelCount.get(key) ?? 1;
      if (total > 1) {
        routeParallelEdge(edge, rankDir, parallelIdx.get(edge) ?? 0, total);
      } else {
        routeShortEdge(edge, rankDir, obstacles);
      }
    }

    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }

  // Long edges were removed from graph.edges and stored in graph.longEdges.
  // Route them through their virtual node positions now that coordinates are set.
  // Count parallel long edges (same from→to) for fanning (S-6).
  const longParallelCount = new Map<string, number>();
  const longParallelIdx   = new Map<DotEdge, number>();
  for (const edge of graph.longEdges) {
    const key = `${edge.from.id}→${edge.to.id}`;
    const idx = longParallelCount.get(key) ?? 0;
    longParallelIdx.set(edge, idx);
    longParallelCount.set(key, idx + 1);
  }

  for (const edge of graph.longEdges) {
    const key = `${edge.from.id}→${edge.to.id}`;
    const fanTotal = longParallelCount.get(key) ?? 1;
    const fanIdx   = longParallelIdx.get(edge) ?? 0;
    const corridors = makeBBoxCorridors(edge, graph);
    routeLongEdgeInCorridor(edge, corridors, rankDir, fanIdx, fanTotal);
    if (edge.reversed) {
      edge.points = edge.points.slice().reverse();
    }
  }
}
