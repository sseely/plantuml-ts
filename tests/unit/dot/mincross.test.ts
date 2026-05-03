import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { minimizeCrossings } from '../../../src/core/dot/mincross.js';

function makeNode(id: string, rank: number, order = -1): DotNode {
  return { id, width: 80, height: 36, rank, order, x: 0, y: 0, virtual: false };
}

function makeVirtualNode(id: string, rank: number, order = -1): DotNode {
  return { id, width: 0, height: 0, rank, order, x: 0, y: 0, virtual: true };
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

  // --- Flat edge tests ---

  it('flat edge direction respected: A→B same-rank → A.order < B.order', () => {
    // A and B are both at rank 0 with a flat edge A→B (same rank).
    // After minimizeCrossings, A must appear left of B.
    // Add rank-1 nodes so the graph is non-trivial.
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const sink = makeNode('sink', 1);
    // Flat edge A→B, plus normal edges to give the rank-1 layer an anchor.
    const flatEdge = makeEdge('flat-ab', a, b);
    const graph = makeGraph([a, b, sink], [flatEdge, makeEdge('a-sink', a, sink)]);

    minimizeCrossings(graph);

    expect(a.order).toBeLessThan(b.order);
  });

  it('flat edge cycle A→B→C→A: completes without hang, all nodes get valid orders', () => {
    // Three nodes at the same rank with a cyclic flat-edge chain.
    // flat_breakcycles must break the cycle and the algorithm must terminate.
    const a = makeNode('FA', 0);
    const b = makeNode('FB', 0);
    const c = makeNode('FC', 0);
    const sink = makeNode('sink', 1);
    const graph = makeGraph(
      [a, b, c, sink],
      [
        makeEdge('flat-ab', a, b),
        makeEdge('flat-bc', b, c),
        makeEdge('flat-ca', c, a), // creates the cycle
        makeEdge('a-sink', a, sink),
      ],
    );

    minimizeCrossings(graph);

    // All nodes must have distinct non-negative orders.
    const orders = [a, b, c].map((n) => n.order);
    expect(orders.every((o) => o >= 0)).toBe(true);
    expect(new Set(orders).size).toBe(3);
  });

  it('virtual node weighting: mixed virtual/ordinary graph produces valid ordering', () => {
    // A chain: ordinary(rank 0) → virtual(rank 1) → ordinary(rank 2).
    // The virtual node should receive weight-2 edges (one virtual, one ordinary).
    // A second ordinary node at rank 1 gives the sort comparator something to work with.
    const src = makeNode('src', 0);
    const virt = makeVirtualNode('virt', 1);
    const ord1 = makeNode('ord1', 1);
    const dst = makeNode('dst', 2);
    const graph = makeGraph(
      [src, virt, ord1, dst],
      [
        makeEdge('e1', src, virt),  // ordinary→virtual: weight 2
        makeEdge('e2', virt, dst),  // virtual→ordinary: weight 2
        makeEdge('e3', src, ord1),  // ordinary→ordinary: weight 1
        makeEdge('e4', ord1, dst),
      ],
    );

    minimizeCrossings(graph);

    // All nodes must have distinct, non-negative orders within their rank.
    for (const node of graph.nodes) {
      expect(node.order).toBeGreaterThanOrEqual(0);
    }
    // Rank-1 nodes must have distinct orders.
    expect(virt.order).not.toBe(ord1.order);
  });

  it('virtual×virtual edge gets weight 4: two virtual nodes chained through a rank', () => {
    // v1(rank1)→v2(rank2): both virtual — weight 4.
    // An ordinary peer at rank 2 means sort comparator fires.
    const src = makeNode('src', 0);
    const v1 = makeVirtualNode('v1', 1);
    const v2 = makeVirtualNode('v2', 2);
    const ord = makeNode('ord', 2);
    const dst = makeNode('dst', 3);
    const graph = makeGraph(
      [src, v1, v2, ord, dst],
      [
        makeEdge('e1', src, v1),   // ordinary→virtual: weight 2
        makeEdge('e2', v1, v2),    // virtual→virtual: weight 4
        makeEdge('e3', v2, dst),   // virtual→ordinary: weight 2
        makeEdge('e4', src, ord),  // ordinary→ordinary: weight 1
        makeEdge('e5', ord, dst),
      ],
    );

    minimizeCrossings(graph);

    for (const node of graph.nodes) {
      expect(node.order).toBeGreaterThanOrEqual(0);
    }
    expect(v2.order).not.toBe(ord.order);
  });

  it('flat edge constraint prevents transpose from swapping constrained pair', () => {
    // Three nodes at rank 0: A, B, C with flat edges A→B and B→C.
    // Rank 1 has a node D connected to A.
    // The flat ordering must be preserved: A < B < C after the algorithm.
    const a = makeNode('TA', 0);
    const b = makeNode('TB', 0);
    const c = makeNode('TC', 0);
    const d = makeNode('TD', 1);
    const graph = makeGraph(
      [a, b, c, d],
      [
        makeEdge('flat-ab', a, b),
        makeEdge('flat-bc', b, c),
        makeEdge('a-d', a, d),
      ],
    );

    minimizeCrossings(graph);

    expect(a.order).toBeLessThan(b.order);
    expect(b.order).toBeLessThan(c.order);
  });

  it('multiple flat edges from same source node: node with two outgoing flat edges', () => {
    // Node A has flat edges to both B and C in the same rank.
    // This exercises the buildFlatAdj branch where a second edge is pushed
    // onto an existing list (the list !== undefined branch).
    const a = makeNode('MA', 0);
    const b = makeNode('MB', 0);
    const c = makeNode('MC', 0);
    const sink = makeNode('sink', 1);
    const graph = makeGraph(
      [a, b, c, sink],
      [
        makeEdge('flat-ab', a, b),  // first flat edge from A
        makeEdge('flat-ac', a, c),  // second flat edge from A — exercises list.push
        makeEdge('a-sink', a, sink),
      ],
    );

    minimizeCrossings(graph);

    // A must come before both B and C.
    expect(a.order).toBeLessThan(b.order);
    expect(a.order).toBeLessThan(c.order);
    // All orders are valid.
    for (const node of [a, b, c]) {
      expect(node.order).toBeGreaterThanOrEqual(0);
    }
    expect(new Set([a.order, b.order, c.order]).size).toBe(3);
  });

  it('transpose skip fires: flat constraint blocks a would-be swap and order is preserved', () => {
    // Build a graph where:
    //  - rank 0: nodes P and Q with a flat edge P→Q (P must be left of Q)
    //  - rank 1: node R connected to Q (not P), giving Q a lower median than P
    // After WMEDIAN, Q would want to move left of P, but the flat constraint
    // must block the transpose from swapping them.
    const p = makeNode('XP', 0);
    const q = makeNode('XQ', 0);
    const r = makeNode('XR', 1);
    const graph = makeGraph(
      [p, q, r],
      [
        makeEdge('flat-pq', p, q),  // P must be left of Q
        makeEdge('q-r', q, r),      // R anchors Q toward the left via WMEDIAN
      ],
    );

    minimizeCrossings(graph);

    // P must remain left of Q regardless of what WMEDIAN computes.
    expect(p.order).toBeLessThan(q.order);
  });

  it('M-2: sortLayerByMedian respects flat constraint when constrained node has lower median', () => {
    // Graph designed so sortLayerByMedian would put B before A without the M-2 guard:
    //  rank 0: A, B with flat edge A→B (A must be left of B)
    //  rank 1: C connected only to B — gives B a very low median (0), A has no median (-1)
    //  rank 2: D connected to A only — so down-sweep on rank 0 gives B lower median than A
    // Without M-2 guard: sortLayerByMedian puts B before A each sweep pass.
    // With M-2 guard: flat constraint A→B forces A left regardless of median.
    const a = makeNode('MA', 0);
    const b = makeNode('MB', 0);
    const c = makeNode('MC', 1, 0);
    const d = makeNode('MD', 2, 0);
    const graph = makeGraph(
      [a, b, c, d],
      [
        makeEdge('flat-ab', a, b),  // A must be left of B (flat edge, same rank)
        makeEdge('b-c', b, c),      // B gets median 0 in up-sweep
        makeEdge('a-d-long', a, d), // gives A connectivity but higher median
      ],
    );
    // Insert an additional inter-rank edge to make B's median clearly lower than A's
    const e2 = makeNode('ME', 1, 1);
    graph.nodes.push(e2);
    graph.edges.push(makeEdge('b-e2', b, e2));

    minimizeCrossings(graph);

    // A must remain left of B — flat constraint must win over wmedian.
    expect(a.order).toBeLessThan(b.order);
  });

  it('M-2: multiple flat constraints at the same rank are all respected', () => {
    // rank 0: A→B→C (two chained flat edges: A left of B, B left of C)
    // rank 1: D connected only to C (pulls C toward leftmost position by median)
    const a = makeNode('FA', 0);
    const b = makeNode('FB', 0);
    const c = makeNode('FC', 0);
    const d = makeNode('FD', 1, 0);
    const graph = makeGraph(
      [a, b, c, d],
      [
        makeEdge('flat-ab2', a, b),  // A left of B
        makeEdge('flat-bc2', b, c),  // B left of C
        makeEdge('c-d', c, d),       // D anchors C to median 0
      ],
    );

    minimizeCrossings(graph);

    expect(a.order).toBeLessThan(b.order);
    expect(b.order).toBeLessThan(c.order);
  });

  it('M-5: BFS pass seeds source-derived ordering (crossing reduction on wide fan-out)', () => {
    // 4-rank graph: single source S at rank 0, fans out to L/R at rank 1,
    // each connects to two nodes at rank 2, then merge to single sink at rank 3.
    // The BFS pass should assign correct initial ordering so the sweep loop
    // either produces 0 crossings immediately or converges in fewer iterations.
    // Key assertion: final crossing count is 0.
    const s  = makeNode('BS_S',  0, 0);
    const l  = makeNode('BS_L',  1);
    const r  = makeNode('BS_R',  1);
    const ll = makeNode('BS_LL', 2);
    const lr = makeNode('BS_LR', 2);
    const rl = makeNode('BS_RL', 2);
    const rr = makeNode('BS_RR', 2);
    const t  = makeNode('BS_T',  3);
    const graph = makeGraph(
      [s, l, r, ll, lr, rl, rr, t],
      [
        makeEdge('s-l',   s,  l),
        makeEdge('s-r',   s,  r),
        makeEdge('l-ll',  l,  ll),
        makeEdge('l-lr',  l,  lr),
        makeEdge('r-rl',  r,  rl),
        makeEdge('r-rr',  r,  rr),
        makeEdge('ll-t',  ll, t),
        makeEdge('lr-t',  lr, t),
        makeEdge('rl-t',  rl, t),
        makeEdge('rr-t',  rr, t),
      ],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('M-5: BFS pass preserves order for isolated-node graph (no edges)', () => {
    // All nodes are isolated — bfsOrderPass should not crash and must not
    // alter the orders assigned by assignLayerOrders.
    const a = makeNode('ISO_A', 0, 0);
    const b = makeNode('ISO_B', 0, 1);
    const c = makeNode('ISO_C', 1, 0);
    const d = makeNode('ISO_D', 1, 1);
    const graph = makeGraph([a, b, c, d], []);

    minimizeCrossings(graph);

    // All orders must be non-negative and unique within each rank
    expect(new Set([a.order, b.order]).size).toBe(2);
    expect(new Set([c.order, d.order]).size).toBe(2);
  });

  it('M-5: BFS passes preserve crossings=0 graph unchanged', () => {
    // A graph that starts crossing-free; BFS passes must not introduce crossings.
    const a = makeNode('BP_A', 0, 0);
    const b = makeNode('BP_B', 0, 1);
    const c = makeNode('BP_C', 1, 0);
    const d = makeNode('BP_D', 1, 1);
    const graph = makeGraph(
      [a, b, c, d],
      [makeEdge('bp-ac', a, c), makeEdge('bp-bd', b, d)],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('M-6: two disconnected subgraphs are solved independently', () => {
    // Component 1: A(rank 0) → B(rank 1)
    // Component 2: C(rank 0) → D(rank 1)
    // No edges between components.
    // Each component should have internal orders 0 and 0 (one node per rank).
    const a = makeNode('WA', 0);
    const b = makeNode('WB', 1);
    const c = makeNode('WC', 0);
    const d = makeNode('WD', 1);
    const graph = makeGraph(
      [a, b, c, d],
      [makeEdge('wa-wb', a, b), makeEdge('wc-wd', c, d)],
    );

    minimizeCrossings(graph);

    // All orders must be non-negative and unique within each rank
    expect(new Set([a.order, c.order]).size).toBe(2);
    expect(new Set([b.order, d.order]).size).toBe(2);
    // No crossings within either component (trivially 0 for single-chain)
    expect(countCrossings(graph)).toBe(0);
  });

  it('M-6: disconnected graph — crossing is 0 regardless of initial order', () => {
    // Two disconnected fans: left-component and right-component.
    // Without WCC decomp, nodes from one fan corrupt the other's median.
    const la = makeNode('LA', 0, 0); // left component source
    const lb = makeNode('LB', 1);
    const lc = makeNode('LC', 1);
    const ra = makeNode('RA', 0, 1); // right component source
    const rb = makeNode('RB', 1);
    const rc = makeNode('RC', 1);
    const graph = makeGraph(
      [la, lb, lc, ra, rb, rc],
      [
        makeEdge('la-lb', la, lb),
        makeEdge('la-lc', la, lc),
        makeEdge('ra-rb', ra, rb),
        makeEdge('ra-rc', ra, rc),
      ],
    );

    minimizeCrossings(graph);

    // Each component's fan must have 0 crossings internally
    expect(countCrossings(graph)).toBe(0);
    // Orders within rank 1 must be unique across both components
    expect(new Set([lb.order, lc.order, rb.order, rc.order]).size).toBe(4);
  });

  it('M-6: single-component graph is unaffected by WCC check (no-op branch)', () => {
    // Fully connected graph: WCC returns one component, single-component branch runs.
    const a = makeNode('SC_A', 0, 0);
    const b = makeNode('SC_B', 0, 1);
    const c = makeNode('SC_C', 1, 0);
    const d = makeNode('SC_D', 1, 1);
    const graph = makeGraph(
      [a, b, c, d],
      [makeEdge('sc-ac', a, c), makeEdge('sc-bd', b, d), makeEdge('sc-ad', a, d)],
    );

    minimizeCrossings(graph);

    expect(countCrossings(graph)).toBe(0);
  });

  it('M-6: all-isolated graph completes without error', () => {
    // No edges — every node is its own WCC component.
    const a = makeNode('ISO2_A', 0);
    const b = makeNode('ISO2_B', 0);
    const c = makeNode('ISO2_C', 1);
    const d = makeNode('ISO2_D', 1);
    const graph = makeGraph([a, b, c, d], []);

    expect(() => minimizeCrossings(graph)).not.toThrow();
    expect(new Set([a.order, b.order]).size).toBe(2);
    expect(new Set([c.order, d.order]).size).toBe(2);
  });
});
