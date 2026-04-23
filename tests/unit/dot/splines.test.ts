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
  return { nodes, edges, rankDir, nodeSep: 36, rankSep: 36 };
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
});
