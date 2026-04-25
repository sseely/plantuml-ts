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
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
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

  it('produces distinct orders when two nodes share the same median', () => {
    const src = makeNode('SRC', 0, 0);
    const b0 = makeNode('B0', 1, 0);
    const b1 = makeNode('B1', 1, 1);
    // Both b0 and b1 have the same single predecessor (src, order 0),
    // so their medians are equal — this exercises the tie-break path.
    const graph = makeGraph(
      [src, b0, b1],
      [makeEdge('e1', src, b0), makeEdge('e2', src, b1)],
    );

    minimizeCrossings(graph);

    expect(b0.order).not.toBe(b1.order);
    expect(b0.order).toBeGreaterThanOrEqual(0);
    expect(b1.order).toBeGreaterThanOrEqual(0);
  });

  it('resolves crossings on K2,2 with reversed input order (tests transpose step)', () => {
    // Two parents at rank 0 ordered [P1, P0], two children at rank 1 with
    // edges P0→C0 and P1→C1. Without transpose, barycenter gives equal medians;
    // transpose is the only way to find the 0-crossing arrangement.
    const p0 = makeNode('P0', 0, 1); // intentionally swapped
    const p1 = makeNode('P1', 0, 0);
    const c0 = makeNode('C0', 1);
    const c1 = makeNode('C1', 1);
    const graph = makeGraph(
      [p0, p1, c0, c1],
      [makeEdge('e1', p0, c0), makeEdge('e2', p1, c1)],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('4-parent fan-in: child with 4 predecessors exercises even-count weighted median path', () => {
    // wmedian with 4 neighbors (even, > 2) hits the weighted-median formula on lines 36-40.
    // With positions [0,1,2,3]: left=1, right=1 → weighted median = (1*1 + 2*1)/2 = 1.5
    // A second child (C2) connects to only P1 so the sort comparator fires and wmedian is
    // invoked for C1's 4 neighbors. A single-element layer never calls the sort callback.
    const p0 = makeNode('P0', 0, 0);
    const p1 = makeNode('P1', 0, 1);
    const p2 = makeNode('P2', 0, 2);
    const p3 = makeNode('P3', 0, 3);
    const c1 = makeNode('C1', 1);
    const c2 = makeNode('C2', 1);
    const graph = makeGraph(
      [p0, p1, p2, p3, c1, c2],
      [
        makeEdge('e0', p0, c1),
        makeEdge('e1', p1, c1),
        makeEdge('e2', p2, c1),
        makeEdge('e3', p3, c1),
        makeEdge('e4', p1, c2), // c2 has 1 predecessor; comparator fires for both c1 and c2
      ],
    );

    minimizeCrossings(graph);

    expect(c1.order).toBeGreaterThanOrEqual(0);
    expect(c2.order).toBeGreaterThanOrEqual(0);
    expect(c1.order).not.toBe(c2.order);
    expect(countCrossings(graph)).toBe(0);
  });

  it('transpose resolves crossing that median sweep alone cannot', () => {
    // Topology: L(0)→A, R(1)→C, A→P, B→P, B→Q, C→Q across 3 ranks.
    // Down-sweep orders rank-1 as [A(0), C(1), B(2)] because B has no rank-0 pred.
    // That leaves C→Q crossing B→P (1 crossing).
    // Median values for C and B are 1 and -1 — the sweep can't swap them.
    // The transpose step swaps C and B to [A, B, C], eliminating the crossing.
    const L = makeNode('L', 0, 0);
    const R = makeNode('R', 0, 1);
    const A = makeNode('A', 1);
    const B = makeNode('B', 1);
    const C = makeNode('C', 1);
    const P = makeNode('P', 2);
    const Q = makeNode('Q', 2);
    const graph = makeGraph(
      [L, R, A, B, C, P, Q],
      [
        makeEdge('lr-a', L, A),
        makeEdge('lr-c', R, C),
        makeEdge('a-p', A, P),
        makeEdge('b-p', B, P),
        makeEdge('b-q', B, Q),
        makeEdge('c-q', C, Q),
      ],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('double-diamond: both children connect to both parents — achieves 0 or 1 crossing', () => {
    // Drawable (rank 0, left) and Shape (rank 0, right)
    // Circle (rank 1) and Rectangle (rank 1) each connect to both.
    // The unavoidable minimum is 1 crossing (two independent edges must cross).
    // The algorithm must not produce 3 or 4 crossings from a bad node order.
    const drawable = makeNode('Drawable', 0, 0);
    const shape = makeNode('Shape', 0, 1);
    const circle = makeNode('Circle', 1);
    const rectangle = makeNode('Rectangle', 1);
    const graph = makeGraph(
      [drawable, shape, circle, rectangle],
      [
        makeEdge('e1', drawable, circle),
        makeEdge('e2', drawable, rectangle),
        makeEdge('e3', shape, circle),
        makeEdge('e4', shape, rectangle),
      ],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBeLessThanOrEqual(1);
  });

  it('empty graph returns without error (early-return branch)', () => {
    const graph = makeGraph([], []);
    minimizeCrossings(graph);
    expect(graph.nodes).toHaveLength(0);
  });
});
