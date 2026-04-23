import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { minimizeCrossings } from '../../../src/core/dot/mincross.js';

function makeNode(id: string, rank: number, order = -1): DotNode {
  return { id, width: 80, height: 36, rank, order, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

function countCrossings(graph: DotWorkingGraph): number {
  let crossings = 0;
  const edges = graph.edges;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i]!;
      const e2 = edges[j]!;
      if (e1.from.rank !== e2.from.rank) continue;
      if (
        (e1.from.order < e2.from.order && e1.to.order > e2.to.order) ||
        (e1.from.order > e2.from.order && e1.to.order < e2.to.order)
      ) {
        crossings++;
      }
    }
  }
  return crossings;
}

describe('minimizeCrossings', () => {
  it('eliminates the single crossing between two rank layers', () => {
    const a0 = makeNode('A0', 0, 0);
    const a1 = makeNode('A1', 0, 1);
    const b0 = makeNode('B0', 1);
    const b1 = makeNode('B1', 1);
    const graph = makeGraph(
      [a0, a1, b0, b1],
      [makeEdge('e1', a0, b1), makeEdge('e2', a1, b0)],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('preserves already-optimal order for a crossing-free layout', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const c = makeNode('C', 0, 2);
    const d = makeNode('D', 1, 0);
    const e = makeNode('E', 1, 1);
    const f = makeNode('F', 1, 2);
    const graph = makeGraph(
      [a, b, c, d, e, f],
      [makeEdge('e1', a, d), makeEdge('e2', b, e), makeEdge('e3', c, f)],
    );

    minimizeCrossings(graph);

    const orders = [d, e, f].map((n) => n.order);
    const sorted = [...orders].sort((x, y) => x - y);
    expect(orders).toEqual(sorted);
    expect(new Set(orders).size).toBe(3);
  });

  it('assigns distinct order values to disconnected nodes in the same rank', () => {
    const x = makeNode('X', 0);
    const y = makeNode('Y', 0);
    const z = makeNode('Z', 0);
    const graph = makeGraph([x, y, z], []);

    minimizeCrossings(graph);

    const orders = [x, y, z].map((n) => n.order);
    expect(new Set(orders).size).toBe(3);
    expect(orders.every((o) => o >= 0)).toBe(true);
  });

  it('does not increase crossings when called a second time', () => {
    const a0 = makeNode('A0', 0, 0);
    const a1 = makeNode('A1', 0, 1);
    const b0 = makeNode('B0', 1);
    const b1 = makeNode('B1', 1);
    const graph = makeGraph(
      [a0, a1, b0, b1],
      [makeEdge('e1', a0, b1), makeEdge('e2', a1, b0)],
    );

    minimizeCrossings(graph);
    const first = countCrossings(graph);

    minimizeCrossings(graph);
    const second = countCrossings(graph);

    expect(second).toBeLessThanOrEqual(first);
  });

  it('assigns order >= 0 to every node across multiple ranks', () => {
    const r0a = makeNode('R0A', 0);
    const r0b = makeNode('R0B', 0);
    const r1a = makeNode('R1A', 1);
    const r1b = makeNode('R1B', 1);
    const r2a = makeNode('R2A', 2);
    const graph = makeGraph(
      [r0a, r0b, r1a, r1b, r2a],
      [
        makeEdge('e1', r0a, r1a),
        makeEdge('e2', r0b, r1b),
        makeEdge('e3', r1a, r2a),
      ],
    );

    minimizeCrossings(graph);

    for (const node of graph.nodes) {
      expect(node.order).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces distinct orders when two nodes share the same barycenter', () => {
    const src = makeNode('SRC', 0, 0);
    const b0 = makeNode('B0', 1, 0);
    const b1 = makeNode('B1', 1, 1);
    // Both b0 and b1 have the same single predecessor (src, order 0),
    // so their barycenters are equal — this exercises the tie-break path.
    const graph = makeGraph(
      [src, b0, b1],
      [makeEdge('e1', src, b0), makeEdge('e2', src, b1)],
    );

    minimizeCrossings(graph);

    expect(b0.order).not.toBe(b1.order);
    expect(b0.order).toBeGreaterThanOrEqual(0);
    expect(b1.order).toBeGreaterThanOrEqual(0);
  });
});
