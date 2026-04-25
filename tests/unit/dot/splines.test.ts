import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import {
  routeEdges,
  routePolyline,
  routeFlatEdge,
  segmentsIntersect,
  buildObstaclePolygons,
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

  it('start is exit point of from, end is entry point of to', () => {
    const from = makeNode('A', 0, 0, 0, 100, 80, 36);
    const to = makeNode('B', 0, 1, 200, 80, 80, 36);
    const edge = makeEdge('e1', from, to);
    const obstacles: ObstaclePolygon[] = [];

    const result = routeFlatEdge(edge, obstacles, 'TB');

    // TB exit from bottom centre of 'from': y = 100+36 = 136, x = 0+40 = 40
    expect(result[0]!.x).toBeCloseTo(40, 0);
    expect(result[0]!.y).toBeCloseTo(136, 0);
    // TB entry to top centre of 'to': y = 80, x = 200+40 = 240
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
});
