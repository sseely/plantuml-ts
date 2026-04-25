import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { routeEdges } from '../../../src/core/dot/splines.js';

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

  it('reversed long edge: points are reversed', () => {
    const a = makeNode('A', 0, 0, 0, 0);
    const vn = { ...makeNode('__vn', 1, 0, 40, 76), virtual: true };
    const b = makeNode('B', 2, 0, 0, 152);
    const longEdge = makeEdge('e-long', a, b);
    longEdge.virtualNodes = [vn];
    longEdge.reversed = true;

    const graph = makeGraph([a, vn, b], [], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    // Reversed: last point should be near the bottom of node A (exit face)
    const last = longEdge.points[longEdge.points.length - 1]!;
    expect(last.y).toBeCloseTo(a.y + a.height, 0);
  });

  it('RL direction: two edges from same node have different exit y-coordinates (spread)', () => {
    // A→B (top) and A→C (bottom) in RL layout: exits should fan across A's left face
    const a = makeNode('A', 0, 0, 200, 0);
    const b = makeNode('B', 1, 0, 0, 0);
    const c = makeNode('C', 1, 1, 0, 100);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, c);
    const graph = makeGraph([a, b, c], [e1, e2], 'RL');

    routeEdges(graph);

    const startY1 = e1.points[0]!.y;
    const startY2 = e2.points[0]!.y;
    expect(startY1).not.toBeCloseTo(startY2, 0);
    // Edge going to top neighbor (b) should exit above edge going to bottom neighbor (c)
    expect(startY1).toBeLessThan(startY2);
  });

  it('BT direction: two edges to same node have different entry y-positions (spread)', () => {
    // B (left) and C (right) both go to A in BT layout
    const b = makeNode('B', 0, 0, 0, 152);
    const c = makeNode('C', 0, 1, 200, 152);
    const a = makeNode('A', 1, 0, 100, 0);
    const e1 = makeEdge('e1', b, a);
    const e2 = makeEdge('e2', c, a);
    const graph = makeGraph([b, c, a], [e1, e2], 'BT');

    routeEdges(graph);

    const endX1 = e1.points[e1.points.length - 1]!.x;
    const endX2 = e2.points[e2.points.length - 1]!.x;
    // Entry points spread across A's bottom face; left source enters left of right source
    expect(endX1).not.toBeCloseTo(endX2, 0);
    expect(endX1).toBeLessThan(endX2);
  });

  it('long edge participates in spread with short edge from same source', () => {
    // A has two outgoing: short A→B and long A→D (via virtual vn at rank 1)
    // They should get different exit x-coordinates
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const vn = { ...makeNode('__vn', 1, 1, 200, 76), virtual: true };
    const d = makeNode('D', 2, 0, 200, 152);
    const shortEdge = makeEdge('e1', a, b);
    const longEdge = makeEdge('e-long', a, d);
    longEdge.virtualNodes = [vn];

    const graph = makeGraph([a, b, vn, d], [shortEdge], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    const shortStartX = shortEdge.points[0]!.x;
    const longStartX = longEdge.points[0]!.x;
    // Long edge heads right (vn.x=200), short edge heads left (b.x=0): different exits
    expect(shortStartX).not.toBeCloseTo(longStartX, 0);
    expect(shortStartX).toBeLessThan(longStartX);
  });

  it('long edge participates in spread with short edge to same destination', () => {
    // B (short) and C (long, via vn) both enter D — entry points should spread
    const b = makeNode('B', 0, 0, 0, 0);
    const c = makeNode('C', 0, 1, 200, 0);
    const vn = { ...makeNode('__vn', 1, 0, 200, 76), virtual: true };
    const d = makeNode('D', 2, 0, 100, 152);
    const shortEdge = makeEdge('e1', b, d);
    const longEdge = makeEdge('e-long', c, d);
    longEdge.virtualNodes = [vn];

    const graph = makeGraph([b, c, vn, d], [shortEdge], 'TB');
    graph.longEdges = [longEdge];

    routeEdges(graph);

    const shortEndX = shortEdge.points[shortEdge.points.length - 1]!.x;
    const longEndX = longEdge.points[longEdge.points.length - 1]!.x;
    // Short edge comes from left (b.x=0), long edge from right (vn.x=200): different entries
    expect(shortEndX).not.toBeCloseTo(longEndX, 0);
    expect(shortEndX).toBeLessThan(longEndX);
  });

  it('two edges from same node: exit x-coordinates are different (spread)', () => {
    // A → B (left) and A → C (right): exits should fan across A's bottom face
    const a = makeNode('A', 0, 0, 0, 0);
    const b = makeNode('B', 1, 0, 0, 76);
    const c = makeNode('C', 1, 1, 200, 76);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    routeEdges(graph);

    const startX1 = e1.points[0]!.x;
    const startX2 = e2.points[0]!.x;
    expect(startX1).not.toBeCloseTo(startX2, 0);
    // Edge going left (b) should exit left of edge going right (c)
    expect(startX1).toBeLessThan(startX2);
  });

  it('two edges to same node: entry x-coordinates are different (spread)', () => {
    // B and C both go to D: entry points should fan across D's top face
    const b = makeNode('B', 0, 0, 0, 0);
    const c = makeNode('C', 0, 1, 200, 0);
    const d = makeNode('D', 1, 0, 100, 76);
    const e1 = makeEdge('e1', b, d);
    const e2 = makeEdge('e2', c, d);
    const graph = makeGraph([b, c, d], [e1, e2]);

    routeEdges(graph);

    const endX1 = e1.points[e1.points.length - 1]!.x;
    const endX2 = e2.points[e2.points.length - 1]!.x;
    expect(endX1).not.toBeCloseTo(endX2, 0);
    // Edge from left (b) enters left of edge from right (c)
    expect(endX1).toBeLessThan(endX2);
  });
});
