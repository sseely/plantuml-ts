import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { routeEdges, buildObstaclePolygons } from '../../../src/core/dot/splines.js';

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

  it('reversed long edge reverses the point sequence', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const vn = { ...makeNode('__vn', 1, 0, 40, 76), virtual: true };
    const b = makeNode('B', 2, 0, 0, 152);
    const longEdge = makeEdge('e-long', b, a);
    longEdge.reversed = true;
    longEdge.virtualNodes = [vn];

    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
    expect(longEdge.reversed).toBe(true);
    // After reversal the first point should be near a's entry (top of a, y=0)
    expect(longEdge.points[0]!.y).toBeCloseTo(a.y, 0);
  });

  it('two parallel edges between same pair produce 3-point paths fanned apart', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    routeEdges(graph);

    // each parallel edge gets 3 points (start, mid, end)
    expect(e1.points).toHaveLength(3);
    expect(e2.points).toHaveLength(3);
    // midpoints must differ — they are fanned to opposite sides
    expect(e1.points[1]!.x).not.toBeCloseTo(e2.points[1]!.x, 5);
  });

  it('parallel edges with zero distance use len=1 fallback without throwing', () => {
    // Both nodes at same coordinates — dx=dy=0, triggers the || 1 guard
    const a = makeNode('A', 0, 0, 50, 50);
    const b = makeNode('B', 1, 0, 50, 50);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    routeEdges(graph);

    expect(e1.points).toHaveLength(3);
    expect(e2.points).toHaveLength(3);
  });
});

describe('buildObstaclePolygons', () => {
  it('returns empty array for empty node list', () => {
    expect(buildObstaclePolygons([])).toEqual([]);
  });

  it('returns polygon matching node bbox for a single real node', () => {
    const node = makeNode('A', 0, 0, 10, 20, 80, 36);
    expect(buildObstaclePolygons([node])).toEqual([
      { x: 10, y: 20, width: 80, height: 36 },
    ]);
  });

  it('returns two polygons for two non-overlapping real nodes', () => {
    const a = makeNode('A', 0, 0, 0, 0, 80, 36);
    const b = makeNode('B', 1, 0, 200, 100, 60, 40);
    const result = buildObstaclePolygons([a, b]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 0, y: 0, width: 80, height: 36 });
    expect(result[1]).toEqual({ x: 200, y: 100, width: 60, height: 40 });
  });

  it('skips virtual nodes (width=0, height=0)', () => {
    const vn = makeNode('__vn', 1, 0, 40, 76, 0, 0);
    expect(buildObstaclePolygons([vn])).toEqual([]);
  });

  it('skips virtual nodes but includes real nodes in mixed list', () => {
    const real = makeNode('A', 0, 0, 10, 20, 80, 36);
    const vn = makeNode('__vn', 1, 0, 40, 76, 0, 0);
    const result = buildObstaclePolygons([real, vn]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 10, y: 20, width: 80, height: 36 });
  });

  it('preserves node position fields exactly (no centering)', () => {
    const node = makeNode('N', 0, 0, 7, 13, 100, 50);
    const [poly] = buildObstaclePolygons([node]);
    expect(poly!.x).toBe(7);
    expect(poly!.y).toBe(13);
    expect(poly!.width).toBe(100);
    expect(poly!.height).toBe(50);
  });
});
