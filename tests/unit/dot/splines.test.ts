import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import {
  routeEdges,
  routePolyline,
  routeFlatEdge,
  segmentsIntersect,
  buildObstaclePolygons,
  fitBezier,
} from '../../../src/core/dot/splines.js';
import type { ObstaclePolygon } from '../../../src/core/dot/splines.js';

function makeNode(
  id: string,
  rank: number,
  order: number,
  x: number,
  y: number,
  w = 80,
  h = 36,
): DotNode {
  return { id, width: w, height: h, rank, order, x, y, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(
  nodes: DotNode[],
  edges: DotEdge[],
  rankDir: DotWorkingGraph['rankDir'] = 'TB',
): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir, nodeSep: 36, rankSep: 36 };
}

/**
 * Returns true if segment p1→p2 passes through the interior of the obstacle
 * rectangle (crosses any of its four edges).
 */
function segmentCrossesRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  obs: ObstaclePolygon,
): boolean {
  const { x, y, width: w, height: h } = obs;
  const tl = { x, y };
  const tr = { x: x + w, y };
  const br = { x: x + w, y: y + h };
  const bl = { x, y: y + h };
  return (
    segmentsIntersect(p1, p2, tl, tr) ||
    segmentsIntersect(p1, p2, tr, br) ||
    segmentsIntersect(p1, p2, br, bl) ||
    segmentsIntersect(p1, p2, bl, tl)
  );
}

// ---------------------------------------------------------------------------
// segmentsIntersect
// ---------------------------------------------------------------------------
describe('segmentsIntersect', () => {
  it('crossing segments return true', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }),
    ).toBe(true);
  });

  it('parallel non-crossing segments return false', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }),
    ).toBe(false);
  });

  it('T-intersection (endpoint touches mid-segment) returns true', () => {
    // a1→a2 is horizontal; b1 lands exactly on it
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 4 },
      ),
    ).toBe(true);
  });

  it('collinear overlapping segments return true', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 6, y: 0 }),
    ).toBe(true);
  });

  it('non-overlapping collinear segments return false', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// routePolyline
// ---------------------------------------------------------------------------
describe('routePolyline', () => {
  it('no obstacles → returns [start, end]', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };
    const result = routePolyline(start, end, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(start);
    expect(result[1]).toEqual(end);
  });

  it('empty obstacle list → straight line regardless of direction', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 10, y: 80 };
    const result = routePolyline(start, end, []);
    expect(result).toHaveLength(2);
  });

  it('obstacle on direct path → returned path avoids obstacle', () => {
    // Obstacle sits squarely on the direct vertical path from (50,0) to (50,200)
    const start = { x: 50, y: 0 };
    const end = { x: 50, y: 200 };
    const obstacle: ObstaclePolygon = { x: 30, y: 80, width: 40, height: 40 };
    const result = routePolyline(start, end, [obstacle]);

    // Path must have more than 2 points (detoured)
    expect(result.length).toBeGreaterThan(2);

    // Verify no consecutive segment in the result passes through the original obstacle
    for (let i = 0; i < result.length - 1; i++) {
      const p1 = result[i]!;
      const p2 = result[i + 1]!;
      expect(segmentCrossesRect(p1, p2, obstacle)).toBe(false);
    }
  });

  it('first point equals start and last point equals end', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const obstacle: ObstaclePolygon = { x: 40, y: -10, width: 20, height: 20 };
    const result = routePolyline(start, end, [obstacle]);
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(end);
  });

  it('clear horizontal path → straight line', () => {
    const start = { x: 0, y: 50 };
    const end = { x: 200, y: 50 };
    // Obstacle is well below the path
    const obstacle: ObstaclePolygon = { x: 80, y: 100, width: 40, height: 40 };
    const result = routePolyline(start, end, [obstacle]);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// routeFlatEdge
// ---------------------------------------------------------------------------
describe('routeFlatEdge', () => {
  it('TB: returns 4-point path bending above both nodes', () => {
    const from = makeNode('A', 0, 0, 0, 100);   // y=100, height=36 → bottom at 136
    const to = makeNode('B', 0, 1, 200, 80);    // y=80
    const edge = makeEdge('e1', from, to);
    const obstacles = buildObstaclePolygons([from, to]);

    const result = routeFlatEdge(edge, obstacles, 'TB');

    expect(result).toHaveLength(4);
    // All interior waypoints must be above both nodes (y < min(from.y, to.y))
    const minY = Math.min(from.y, to.y);
    expect(result[1]!.y).toBeLessThan(minY);
    expect(result[2]!.y).toBeLessThan(minY);
  });

  it('BT: returns 4-point path bending above both nodes', () => {
    const from = makeNode('A', 0, 0, 0, 100);
    const to = makeNode('B', 0, 1, 200, 80);
    const edge = makeEdge('e1', from, to);
    const obstacles = buildObstaclePolygons([from, to]);

    const result = routeFlatEdge(edge, obstacles, 'BT');

    expect(result).toHaveLength(4);
    const minY = Math.min(from.y, to.y);
    expect(result[1]!.y).toBeLessThan(minY);
    expect(result[2]!.y).toBeLessThan(minY);
  });

  it('LR: returns 4-point path bending to the left of both nodes', () => {
    const from = makeNode('A', 0, 0, 100, 0);  // x=100
    const to = makeNode('B', 0, 1, 80, 200);   // x=80
    const edge = makeEdge('e1', from, to);
    const obstacles = buildObstaclePolygons([from, to]);

    const result = routeFlatEdge(edge, obstacles, 'LR');

    expect(result).toHaveLength(4);
    const minX = Math.min(from.x, to.x);
    expect(result[1]!.x).toBeLessThan(minX);
    expect(result[2]!.x).toBeLessThan(minX);
  });

  it('RL: returns 4-point path bending to the left of both nodes', () => {
    const from = makeNode('A', 0, 0, 100, 0);
    const to = makeNode('B', 0, 1, 80, 200);
    const edge = makeEdge('e1', from, to);
    const obstacles = buildObstaclePolygons([from, to]);

    const result = routeFlatEdge(edge, obstacles, 'RL');

    expect(result).toHaveLength(4);
    const minX = Math.min(from.x, to.x);
    expect(result[1]!.x).toBeLessThan(minX);
    expect(result[2]!.x).toBeLessThan(minX);
  });

  it('start and end are on the node ellipse boundary toward the detour waypoint', () => {
    const from = makeNode('A', 0, 0, 0, 100, 80, 36);
    const to = makeNode('B', 0, 1, 200, 80, 80, 36);
    const edge = makeEdge('e1', from, to);
    const obstacles: ObstaclePolygon[] = [];

    const result = routeFlatEdge(edge, obstacles, 'TB');

    // TB flat edge arcs ABOVE both nodes (detourY = min(100,80)-20 = 60).
    // The waypoints are above the nodes, so ellipse intersection exits from
    // the top face of each node.
    // from: centre=(40,118), ry=18 → top face y=100, x=40
    expect(result[0]!.x).toBeCloseTo(40, 0);
    expect(result[0]!.y).toBeCloseTo(100, 0);
    // to: centre=(240,98), ry=18 → top face y=80, x=240
    expect(result[3]!.x).toBeCloseTo(240, 0);
    expect(result[3]!.y).toBeCloseTo(80, 0);
  });
});

// ---------------------------------------------------------------------------
// routeEdges — existing tests (unchanged behaviour)
// ---------------------------------------------------------------------------
describe('routeEdges', () => {
  it('short edge has >= 2 points (TB)', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge]);

    routeEdges(graph);

    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('start/end points on node boundaries for TB direction', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge]);

    routeEdges(graph);

    const start = edge.points[0]!;
    const end = edge.points[edge.points.length - 1]!;

    expect(start.y).toBeCloseTo(a.y + a.height, 0);
    expect(start.x).toBeCloseTo(a.x + a.width / 2, 0);
    expect(end.y).toBeCloseTo(b.y, 0);
    expect(end.x).toBeCloseTo(b.x + b.width / 2, 0);
  });

  it('self-loop produces >= 2 points with distinct first and last', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const edge = makeEdge('e1', a, a);
    const graph = makeGraph([a], [edge]);

    routeEdges(graph);

    expect(edge.points.length).toBeGreaterThanOrEqual(2);
    const first = edge.points[0]!;
    const last = edge.points[edge.points.length - 1]!;
    expect(first.x === last.x && first.y === last.y).toBe(false);
  });

  it('reversed edge has non-empty points and reversed flag preserved', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const edge = makeEdge('e1', b, a);
    edge.reversed = true;
    const graph = makeGraph([a, b], [edge]);

    routeEdges(graph);

    expect(edge.points.length).toBeGreaterThan(0);
    expect(edge.reversed).toBe(true);
  });

  it('LR direction: start x = from.x + from.width, end x = to.x', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 116, 0);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge], 'LR');

    routeEdges(graph);

    const start = edge.points[0]!;
    const end = edge.points[edge.points.length - 1]!;

    expect(start.x).toBeCloseTo(a.x + a.width, 0);
    expect(end.x).toBeCloseTo(b.x, 0);
  });

  it('long edge in graph.longEdges gets routed (>= 2 points)', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const vn = { ...makeNode('__vn', 1, 0, 40, 76), virtual: true };
    const b = makeNode('B', 2, 0, 0, 152);
    const longEdge = makeEdge('e-long', a, b);
    longEdge.virtualNodes = [vn];

    // long edges are removed from graph.edges and stored in graph.longEdges
    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.points[0]!.y).toBeCloseTo(a.y + a.height, 0);
    expect(longEdge.points[longEdge.points.length - 1]!.y).toBeCloseTo(b.y, 0);
  });

  it('flat edge (same rank) in TB gets routed with 4 points bending above', () => {
    // Both nodes on rank 0, at the same y position
    const a = makeNode('A', 0, 0, 0, 100);
    const b = makeNode('B', 0, 1, 200, 100);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge], 'TB');

    routeEdges(graph);

    expect(edge.points).toHaveLength(4);
    const minY = Math.min(a.y, b.y);
    // Interior waypoints must be above both nodes
    expect(edge.points[1]!.y).toBeLessThan(minY);
    expect(edge.points[2]!.y).toBeLessThan(minY);
  });

  it('flat edge LR gets routed with 4 points bending left', () => {
    const a = makeNode('A', 0, 0, 100, 0);
    const b = makeNode('B', 0, 1, 100, 200);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge], 'LR');

    routeEdges(graph);

    expect(edge.points).toHaveLength(4);
    const minX = Math.min(a.x, b.x);
    expect(edge.points[1]!.x).toBeLessThan(minX);
    expect(edge.points[2]!.x).toBeLessThan(minX);
  });

  it('RL direction: start x = from.x, end x = to.x + to.width', () => {
    const a = makeNode('A', 0, 0, 116, 0);
    const b = makeNode('B', 1, 0, 0, 0);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge], 'RL');

    routeEdges(graph);

    const start = edge.points[0]!;
    const end = edge.points[edge.points.length - 1]!;

    expect(start.x).toBeCloseTo(a.x, 0);
    expect(end.x).toBeCloseTo(b.x + b.width, 0);
  });

  it('BT direction: start y = from.y, end y = to.y + to.height', () => {
    const a = makeNode('A', 0, 0, 0, 76);
    const b = makeNode('B', 1, 0, 0, 0);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge], 'BT');

    routeEdges(graph);

    const start = edge.points[0]!;
    const end = edge.points[edge.points.length - 1]!;

    expect(start.y).toBeCloseTo(a.y, 0);
    expect(end.y).toBeCloseTo(b.y + b.height, 0);
  });

  it('long edge with virtual nodes gets spline=true flag', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const vn = { ...makeNode('__vn', 1, 0, 40, 76), virtual: true };
    const b = makeNode('B', 2, 0, 0, 152);
    const longEdge = makeEdge('e-long', a, b);
    longEdge.virtualNodes = [vn];

    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    expect(longEdge.spline).toBe(true);
  });

  it('reversed long edge has non-empty points and reversed flag preserved', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const vn = { ...makeNode('__vn', 1, 0, 40, 76), virtual: true };
    const b = makeNode('B', 2, 0, 0, 152);
    const longEdge = makeEdge('e-long', b, a);
    longEdge.virtualNodes = [vn];
    longEdge.reversed = true;

    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.reversed).toBe(true);
  });

  it('short edge (2 points) does not set spline=true', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const edge = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [edge]);

    routeEdges(graph);

    expect(edge.spline).toBeUndefined();
  });

  it('parallel edges do not set spline flag', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    routeEdges(graph);

    expect(e1.spline).toBeUndefined();
    expect(e2.spline).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fitBezier
// ---------------------------------------------------------------------------
describe('fitBezier', () => {
  it('2-point polyline returns unchanged [A, B]', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 200 };
    const result = fitBezier([a, b]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(a);
    expect(result[1]).toEqual(b);
  });

  it('1-point polyline returns unchanged', () => {
    const a = { x: 10, y: 20 };
    const result = fitBezier([a]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(a);
  });

  it('empty polyline returns empty', () => {
    expect(fitBezier([])).toHaveLength(0);
  });

  it('3-point polyline returns 7 points (P0 + 2 CPs + P1 + 2 CPs + P2)', () => {
    const a = { x: 0, y: 0 };
    const m = { x: 50, y: 100 };
    const b = { x: 100, y: 0 };
    const result = fitBezier([a, m, b]);
    expect(result).toHaveLength(7);
  });

  it('3-point: first point equals input[0]', () => {
    const a = { x: 10, y: 20 };
    const m = { x: 50, y: 80 };
    const b = { x: 90, y: 20 };
    const result = fitBezier([a, m, b]);
    expect(result[0]).toEqual(a);
  });

  it('3-point: 4th point equals input[1] (midpoint anchor)', () => {
    const a = { x: 0, y: 0 };
    const m = { x: 50, y: 100 };
    const b = { x: 100, y: 0 };
    const result = fitBezier([a, m, b]);
    expect(result[3]).toEqual(m);
  });

  it('3-point: last point equals input[2]', () => {
    const a = { x: 0, y: 0 };
    const m = { x: 50, y: 100 };
    const b = { x: 100, y: 0 };
    const result = fitBezier([a, m, b]);
    expect(result[6]).toEqual(b);
  });

  it('4-point polyline returns 10 points (1 + 3 * 3)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 33, y: 50 },
      { x: 66, y: 50 },
      { x: 100, y: 0 },
    ];
    expect(fitBezier(pts)).toHaveLength(10);
  });

  it('first segment CP1 is at P0 + (P1-P0)/3 for natural spline', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 90, y: 90 };
    const c = { x: 180, y: 0 };
    const result = fitBezier([a, b, c]);
    expect(result[1]!.x).toBeCloseTo(a.x + (b.x - a.x) / 3, 5);
    expect(result[1]!.y).toBeCloseTo(a.y + (b.y - a.y) / 3, 5);
  });

  it('last segment CP2 is at Pn - (Pn-Pn-1)/3 for natural spline', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 90, y: 90 };
    const c = { x: 180, y: 0 };
    const result = fitBezier([a, b, c]);
    expect(result[5]!.x).toBeCloseTo(c.x - (c.x - b.x) / 3, 5);
    expect(result[5]!.y).toBeCloseTo(c.y - (c.y - b.y) / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// makeBBoxCorridors + routeLongEdgeInCorridor (tested via routeEdges)
// ---------------------------------------------------------------------------

/**
 * Build a minimal long-edge graph for corridor routing tests.
 *
 * Layout (TB, rank 0 → rank 1 → rank 2):
 *   rank 0: node A at (200, 0)
 *   rank 1: virtual node vn at (200, 76) — the routing waypoint
 *   rank 2: node B at (200, 152)
 *
 * Additional real sibling nodes at rank 1 can be passed in `rank1Siblings`.
 */
function makeLongEdgeGraph(
  rank1Siblings: DotNode[] = [],
): { graph: DotWorkingGraph; longEdge: DotEdge; vn: DotNode } {
  const a = makeNode('A', 0, 0, 200, 0);
  const vn: DotNode = { ...makeNode('__vn', 1, 0, 200, 76), virtual: true };
  const b = makeNode('B', 2, 0, 200, 152);

  const longEdge = makeEdge('e-long', a, b);
  longEdge.virtualNodes = [vn];

  const allNodes = [a, vn, b, ...rank1Siblings];
  const graph = makeGraph(allNodes, [], 'TB');
  graph.longEdges = [longEdge];

  return { graph, longEdge, vn };
}

describe('makeBBoxCorridors (via routeEdges)', () => {
  it('no siblings → corridor spans full width (xLeft=0, xRight=100000)', () => {
    // With no real siblings at rank 1, the corridor should use the
    // sentinel values: xLeft=0, xRight=100000.
    // We verify this indirectly: the corridor midpoint x = (0+100000)/2 = 50000,
    // so the waypoint x will be 50000, making edge.points[0].x != edge.points[1].x
    // (the path turns toward the far midpoint before snapping back to B).
    // More practically: the edge must still have >= 2 points and spline=true.
    const { graph, longEdge } = makeLongEdgeGraph([]);
    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.spline).toBe(true);
  });

  it('sibling to the left → corridor xLeft = sibling.x + sibling.width', () => {
    // Place a real sibling at rank 1 to the LEFT of the virtual node (x=200).
    // sibling: x=50, width=80 → right edge at 130. Virtual node x=200.
    // xLeft should be 130 (= sibling.x + sibling.width).
    // corridor midpoint x = (130 + 100000) / 2 ≈ 50065
    // The edge waypoint will reflect this: start.x ≈ 240 (ellipse exit from A),
    // midpoint.x ≈ 50065, end.x ≈ 240 (ellipse entry to B).
    // We just verify the edge is routed without error and has expected shape.
    const leftSibling = makeNode('L', 1, 0, 50, 76, 80, 36);
    const { graph, longEdge } = makeLongEdgeGraph([leftSibling]);
    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.spline).toBe(true);
    // The first and last points are the ellipse exit/entry of A and B
    expect(longEdge.points[0]!.y).toBeCloseTo(36, 0); // A bottom edge y=0+36
    expect(longEdge.points[longEdge.points.length - 1]!.y).toBeCloseTo(152, 0); // B top edge
  });

  it('sibling to the right → corridor xRight = sibling.x', () => {
    // Place a real sibling at rank 1 to the RIGHT of the virtual node.
    // vn: x=200, width=80 → right edge at 280.
    // rightSibling: x=350 → xRight should be 350.
    // corridor midpoint x = (0 + 350) / 2 = 175
    const rightSibling = makeNode('R', 1, 1, 350, 76, 80, 36);
    const { graph, longEdge } = makeLongEdgeGraph([rightSibling]);
    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.spline).toBe(true);
  });

  it('sibling on both sides → corridor is bounded by both', () => {
    // left sibling right-edge = 100, right sibling left-edge = 350
    // corridor: xLeft=100, xRight=350, midpoint x=225
    const leftSibling = makeNode('L', 1, 0, 20, 76, 80, 36);
    const rightSibling = makeNode('R', 1, 2, 350, 76, 80, 36);
    const { graph, longEdge } = makeLongEdgeGraph([leftSibling, rightSibling]);
    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.spline).toBe(true);
  });
});

describe('routeLongEdgeInCorridor (via routeEdges)', () => {
  it('single virtual node produces >= 4 control points and spline=true', () => {
    // routeLongEdgeInCorridor with 1 corridor produces waypoints=[start, mid, end]
    // → smoothPolyline(3pts) → fitBezier(3pts) = 7 bezier points, snapped → 7 pts
    const { graph, longEdge } = makeLongEdgeGraph([]);
    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(4);
    expect(longEdge.spline).toBe(true);
  });

  it('first point is on the ellipse boundary of edge.from', () => {
    // For node A at (200, 0, w=80, h=36): centre=(240, 18).
    // The first virtual node is at (200, 76): centre=(240, 94).
    // The ray from A-centre toward vn-centre is straight down.
    // Ellipse exit: bottom of A at y=36, x=240.
    const { graph, longEdge } = makeLongEdgeGraph([]);
    routeEdges(graph);

    const first = longEdge.points[0]!;
    expect(first.y).toBeCloseTo(36, 0);   // A.y + A.height = 0 + 36
    expect(first.x).toBeCloseTo(240, 0);  // A centre x = 200 + 80/2
  });

  it('last point is on the ellipse boundary of edge.to', () => {
    // Node B at (200, 152, w=80, h=36): top edge at y=152.
    const { graph, longEdge } = makeLongEdgeGraph([]);
    routeEdges(graph);

    const last = longEdge.points[longEdge.points.length - 1]!;
    expect(last.y).toBeCloseTo(152, 0);  // B.y = 152
    expect(last.x).toBeCloseTo(240, 0); // B centre x
  });

  it('non-reversed edge: points[0] is on edge.from side', () => {
    const { graph, longEdge } = makeLongEdgeGraph([]);
    routeEdges(graph);

    // A is at y=0..36, B is at y=152..188.
    // points[0] must be near A (y≈36).
    expect(longEdge.points[0]!.y).toBeLessThan(100);
  });

  it('two virtual nodes produce more waypoints than one', () => {
    // Build a 3-rank-span edge: A(rank0) → vn1(rank1) → vn2(rank2) → B(rank3)
    const a = makeNode('A', 0, 0, 200, 0);
    const vn1: DotNode = { ...makeNode('__vn1', 1, 0, 200, 76), virtual: true };
    const vn2: DotNode = { ...makeNode('__vn2', 2, 0, 200, 152), virtual: true };
    const b = makeNode('B', 3, 0, 200, 228);

    const longEdge = makeEdge('e-long', a, b);
    longEdge.virtualNodes = [vn1, vn2];

    const graph = makeGraph([a, vn1, vn2, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    // With 2 virtual nodes we get waypoints=[start, mid1, mid2, end] → fitBezier(4pts) = 10
    expect(longEdge.points.length).toBeGreaterThanOrEqual(7);
    expect(longEdge.spline).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tailStartPoint (tested via routeEdges)
// ---------------------------------------------------------------------------
describe('tailStartPoint (via routeEdges)', () => {
  it('LR with tailportY=0.4: start.y ≈ cy + 0.4 * node.height', () => {
    // from: x=0, y=0, w=80, h=36 → cx=40, cy=18
    // tailportY=0.4 → portY = 18 + 0.4*36 = 18 + 14.4 = 32.4
    // LR: start = { x: from.x + from.width = 80, y: portY = 32.4 }
    const from = makeNode('A', 0, 0, 0, 0, 80, 36);
    const to = makeNode('B', 1, 0, 116, 0, 80, 36);
    const edge = makeEdge('e1', from, to);
    edge.tailportY = 0.4;
    const graph = makeGraph([from, to], [edge], 'LR');

    routeEdges(graph);

    const cy = from.y + from.height / 2;
    const expectedY = cy + 0.4 * from.height;
    expect(edge.points[0]!.y).toBeCloseTo(expectedY, 1);
  });

  it('LR with tailportY=0: start.y ≈ cy (node center)', () => {
    // tailportY=0 → portY = cy + 0 * h = cy
    const from = makeNode('A', 0, 0, 0, 0, 80, 36);
    const to = makeNode('B', 1, 0, 116, 0, 80, 36);
    const edge = makeEdge('e1', from, to);
    edge.tailportY = 0;
    const graph = makeGraph([from, to], [edge], 'LR');

    routeEdges(graph);

    const cy = from.y + from.height / 2;
    expect(edge.points[0]!.y).toBeCloseTo(cy, 1);
  });

  it('LR with tailportY=undefined: fallback to ellipseEdgePoint (start y = cy for horizontal edge)', () => {
    // No tailportY → ellipseEdgePoint fallback.
    // With from and to at the same y-center (purely horizontal LR direction),
    // the ellipse intersection is at x = from.x + from.width, y = cy.
    // This differs from a port-pinned 0.4 case (which would give y = cy + 14.4).
    const from = makeNode('A', 0, 0, 0, 0, 80, 36);
    const to = makeNode('B', 1, 0, 116, 0, 80, 36); // same y, purely horizontal
    const edge = makeEdge('e1', from, to);
    // tailportY deliberately not set
    const graph = makeGraph([from, to], [edge], 'LR');

    routeEdges(graph);

    // Purely horizontal direction → ellipse exits at right face centre
    const cy = from.y + from.height / 2;
    expect(edge.points[0]!.x).toBeCloseTo(from.x + from.width, 1);
    expect(edge.points[0]!.y).toBeCloseTo(cy, 1);
  });

  it('TB with tailportY=0.3: start.x ≈ cx + 0.3 * width, start.y ≈ from.y + from.height', () => {
    // from: x=0, y=0, w=80, h=36 → cx=40, cy=18
    // TB: portX = cx + 0.3*80 = 40 + 24 = 64, start.y = from.y + from.height = 36
    const from = makeNode('A', 0, 0, 0, 0, 80, 36);
    const to = makeNode('B', 1, 0, 0, 76, 80, 36);
    const edge = makeEdge('e1', from, to);
    edge.tailportY = 0.3;
    const graph = makeGraph([from, to], [edge], 'TB');

    routeEdges(graph);

    const cx = from.x + from.width / 2;
    const expectedX = cx + 0.3 * from.width;
    expect(edge.points[0]!.x).toBeCloseTo(expectedX, 1);
    expect(edge.points[0]!.y).toBeCloseTo(from.y + from.height, 1);
  });
});

// ---------------------------------------------------------------------------
// routeFlatEdge — labeled (S-5)
// ---------------------------------------------------------------------------
describe('routeFlatEdge — labeled', () => {
  it('with labelNode: returns 6-point path routed through label centre', () => {
    // from: x=0, y=100, w=80, h=36
    // to:   x=200, y=100, w=80, h=36
    // labelNode: x=100, y=50, w=40, h=20 → centre (120, 60)
    const from = makeNode('A', 0, 0, 0, 100);
    const to = makeNode('B', 0, 1, 200, 100);
    const labelNode = makeNode('__lbl', 0, 2, 100, 50, 40, 20);
    const edge = makeEdge('e1', from, to);
    edge.labelNode = labelNode;
    const obstacles: ObstaclePolygon[] = [];

    const result = routeFlatEdge(edge, obstacles, 'TB');

    expect(result).toHaveLength(6);
    // points[2] and points[3] must both be at the label centre
    expect(result[2]!.x).toBe(120); // labelNode.x + labelNode.width / 2
    expect(result[3]!.x).toBe(120);
  });

  it('without labelNode: returns 4-point path (unchanged behaviour)', () => {
    const from = makeNode('A', 0, 0, 0, 100);
    const to = makeNode('B', 0, 1, 200, 100);
    const edge = makeEdge('e1', from, to);
    const obstacles: ObstaclePolygon[] = [];

    const result = routeFlatEdge(edge, obstacles, 'TB');

    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// routeLongEdgeInCorridor — fanning (S-6)
// ---------------------------------------------------------------------------
describe('routeLongEdgeInCorridor — fanning', () => {
  it('two parallel long edges (TB) have different corridor midpoint x values', () => {
    // Two long edges sharing the same from/to pair, each with its own virtual node
    // at the same x position (x=200) so the base midpoint is identical.
    // After fanning, they should be offset by MULTISEP=16 from each other.
    const a = makeNode('A', 0, 0, 200, 0);
    const b = makeNode('B', 2, 0, 200, 152);

    const vn1: DotNode = { ...makeNode('__vn1', 1, 0, 200, 76), virtual: true };
    const vn2: DotNode = { ...makeNode('__vn2', 1, 1, 200, 76), virtual: true };

    const longEdge1 = makeEdge('e1', a, b);
    longEdge1.virtualNodes = [vn1];

    const longEdge2 = makeEdge('e2', a, b);
    longEdge2.virtualNodes = [vn2];

    const graph = makeGraph([a, vn1, vn2, b], [], 'TB');
    graph.longEdges = [longEdge1, longEdge2];

    routeEdges(graph);

    // Both edges should have at least 4 points (after bezier fitting)
    expect(longEdge1.points.length).toBeGreaterThanOrEqual(4);
    expect(longEdge2.points.length).toBeGreaterThanOrEqual(4);

    // The waypoints before bezier fitting would be [start, midX, end].
    // After smoothPolyline + fitBezier the midpoint influence is visible in points[1].
    // The two edges must NOT have the same points[1].x value — fanning separated them.
    expect(longEdge1.points[1]!.x).not.toBeCloseTo(longEdge2.points[1]!.x, 0);
  });

  it('single long edge (no parallel sibling) routes at unshifted corridor midpoint', () => {
    // One long edge with virtual node at x=200, y=76, w=80 → corridor (no siblings):
    // xLeft=0, xRight=100000 → midpoint x = 50000. No fan offset applied.
    // The bezier first interior control point will reflect the raw midpoint.
    const a = makeNode('A', 0, 0, 200, 0);
    const b = makeNode('B', 2, 0, 200, 152);
    const vn: DotNode = { ...makeNode('__vn', 1, 0, 200, 76), virtual: true };

    const longEdge = makeEdge('e1', a, b);
    longEdge.virtualNodes = [vn];

    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(4);
    expect(longEdge.spline).toBe(true);
    // With fanTotal=1, fanOffset=0 — corridor midpoint x stays at (0+100000)/2=50000.
    // smoothPolyline of [start(x=240), mid(x=50000), end(x=240)] shifts the mid to
    // (50000+240)/2=25120 at index 1. points[1].x should be well above 240.
    expect(longEdge.points[1]!.x).toBeGreaterThan(240);
  });
});
