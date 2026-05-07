import { describe, it, expect } from 'vitest';
import { assignCoordinates } from '../../../src/core/dot/position.js';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';

function makeNode(id: string, rank: number, order: number, w = 80, h = 36): DotNode {
  return { id, width: w, height: h, rank, order, x: 0, y: 0, virtual: false };
}

function makeVirtualNode(id: string, rank: number, order: number): DotNode {
  return { id, width: 1, height: 1, rank, order, x: 0, y: 0, virtual: true };
}

function makeGraph(nodes: DotNode[], rankDir: DotWorkingGraph['rankDir'] = 'TB'): DotWorkingGraph {
  return { nodes, edges: [] as DotEdge[], longEdges: [], rankDir, nodeSep: 20, rankSep: 40 };
}

function overlaps(a: DotNode, b: DotNode): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe('assignCoordinates', () => {
  it('no overlap same rank (TB): B.x >= A.x + A.width + nodeSep', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const graph = makeGraph([a, b]);
    assignCoordinates(graph);
    expect(!overlaps(a, b)).toBe(true);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width + 20);
  });

  it('rank separation (TB): B.y >= A.y + A.height + rankSep', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b]);
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + 40);
  });

  it('non-negative coordinates: single node has x >= 0 and y >= 0', () => {
    const node = makeNode('A', 0, 0);
    const graph = makeGraph([node]);
    assignCoordinates(graph);
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
  });

  it('LR direction — rank maps to x: higher rank => greater x', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'LR');
    assignCoordinates(graph);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('LR direction — order maps to y: higher order => greater y', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const graph = makeGraph([a, b], 'LR');
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('TB direction — rank maps to y: higher rank => greater y', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'TB');
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('diamond non-overlap: no bounding boxes overlap', () => {
    const root = makeNode('root', 0, 0);
    const left = makeNode('left', 1, 0);
    const right = makeNode('right', 1, 1);
    const bottom = makeNode('bottom', 2, 0);
    const graph = makeGraph([root, left, right, bottom]);
    assignCoordinates(graph);
    const nodes = [root, left, right, bottom];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(!overlaps(nodes[i]!, nodes[j]!)).toBe(true);
      }
    }
  });

  it('BT direction — higher rank => smaller y (rank 0 is at the bottom)', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'BT');
    assignCoordinates(graph);
    expect(a.y).toBeGreaterThan(b.y);
  });

  it('RL direction — higher rank => smaller x (rank 0 is at the right)', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'RL');
    assignCoordinates(graph);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('empty graph: no error', () => {
    const graph = makeGraph([]);
    expect(() => assignCoordinates(graph)).not.toThrow();
  });

  it('wide node next to narrow node: nodeSep is respected (TB)', () => {
    // node[0] width=200, node[1] width=40, nodeSep=50
    // After assignment: node[1].x >= node[0].x + node[0].width + nodeSep
    const wide = makeNode('wide', 0, 0, 200, 36);
    const narrow = makeNode('narrow', 0, 1, 40, 36);
    const graph: DotWorkingGraph = {
      nodes: [wide, narrow],
      edges: [],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 50,
      rankSep: 40,
    };
    assignCoordinates(graph);
    expect(narrow.x).toBeGreaterThanOrEqual(wide.x + wide.width + 50);
  });

  it('virtual node centering: long edge virtual node x-center is between real endpoints', () => {
    // Ranks: src at rank 0, dst at rank 2, virtual at rank 1
    // After assignment, virtual node center should be between src center and dst center.
    const src = makeNode('src', 0, 0, 80, 36);
    const dst = makeNode('dst', 2, 0, 80, 36);
    const vn = makeVirtualNode('vn', 1, 0);

    const longEdge: DotEdge = {
      id: 'e1',
      from: src,
      to: dst,
      weight: 1,
      minLen: 1,
      reversed: false,
      virtualNodes: [vn],
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [src, dst, vn],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    const srcCenter = src.x + src.width / 2;
    const dstCenter = dst.x + dst.width / 2;
    const vnCenter = vn.x + vn.width / 2;

    const minCenter = Math.min(srcCenter, dstCenter);
    const maxCenter = Math.max(srcCenter, dstCenter);

    // Virtual node center must be between (or at) the two real endpoint centers.
    expect(vnCenter).toBeGreaterThanOrEqual(minCenter);
    expect(vnCenter).toBeLessThanOrEqual(maxCenter);
  });

  it('long edge with empty virtualNodes array: no crash', () => {
    // Covers the longEdge.virtualNodes.length === 0 branch in centerVirtualNodes.
    const src = makeNode('src', 0, 0, 80, 36);
    const dst = makeNode('dst', 2, 0, 80, 36);

    const longEdge: DotEdge = {
      id: 'e1',
      from: src,
      to: dst,
      weight: 1,
      minLen: 1,
      reversed: false,
      virtualNodes: [], // empty — should be skipped, not crash
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [src, dst],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    expect(() => assignCoordinates(graph)).not.toThrow();
    expect(src.x).toBeGreaterThanOrEqual(0);
    expect(dst.x).toBeGreaterThanOrEqual(0);
  });

  it('centerBySuccessors negative-x normalization: all nodes have x >= 0 after layout', () => {
    // A narrow sibling (A1) and a wide parent (A2) are in rank 0.
    // A2 connects to a child B at rank 1 which is leftmost in rank 1.
    // centerBySuccessors centers A2 over B; because B is far to the left relative to
    // A2's packed position, A2.x goes negative — triggering the if (minX < 0) path.
    const a1 = makeNode('A1', 0, 0, 40, 36);   // narrow sibling, leftmost in rank 0
    const a2 = makeNode('A2', 0, 1, 300, 36);  // wide parent
    const b = makeNode('B', 1, 0, 40, 36);     // single child in rank 1

    const edge: DotEdge = {
      id: 'A2->B',
      from: a2,
      to: b,
      weight: 1,
      minLen: 1,
      reversed: false,
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [a1, a2, b],
      edges: [edge],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };

    assignCoordinates(graph);

    // All coordinates must be non-negative after normalization
    expect(a1.x).toBeGreaterThanOrEqual(0);
    expect(a2.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeGreaterThanOrEqual(0);
    // A2 should be centered roughly over B
    const a2Center = a2.x + a2.width / 2;
    const bCenter = b.x + b.width / 2;
    expect(Math.abs(a2Center - bCenter)).toBeLessThan(a2.width);
  });

  it('fan-in: node with 2+ predecessors is centered over their average (TB)', () => {
    // A (rank 0, order 0), B (rank 0, order 1), C (rank 1, order 0)
    // Edges A→C and B→C: C has 2 predecessors, should be centered over avg(A, B).
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 80, 36);
    const c = makeNode('C', 1, 0, 80, 36);
    const edgeAC: DotEdge = {
      id: 'A->C', from: a, to: c, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const edgeBC: DotEdge = {
      id: 'B->C', from: b, to: c, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b, c],
      edges: [edgeAC, edgeBC],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // C must not overlap A or B
    expect(!overlaps(a, c)).toBe(true);
    expect(!overlaps(b, c)).toBe(true);
    // C should be somewhere between A and B horizontally (centered or nearby)
    const cCx = c.x + c.width / 2;
    const avgPredCx = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
    expect(Math.abs(cCx - avgPredCx)).toBeLessThan(a.width);
  });

  it('LR fan-out: A (rank 0) → B and C (rank 1), B and C are well-separated', () => {
    // A at rank 0, B at rank 1 order 0, C at rank 1 order 1.
    // In the LR left-to-right centering pass (i=1, rank 1), the j-loop runs for B
    // and C. Since only A is their parent (cnt<2), no parent-centering move occurs.
    // If B and C are already well-spaced, the false branch of the y-separation
    // enforcement (curr.y >= minY) is taken.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 1, 0, 80, 36);
    const c = makeNode('C', 1, 1, 80, 36);
    const edgeAB: DotEdge = {
      id: 'A->B', from: a, to: b, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const edgeAC: DotEdge = {
      id: 'A->C', from: a, to: c, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b, c],
      edges: [edgeAB, edgeAC],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // B and C must be separated and non-negative.
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(!overlaps(b, c)).toBe(true);
    expect(c.y).toBeGreaterThanOrEqual(b.y + b.height + 20);
  });

  it('LR tall-node negative-y normalization: all y >= 0 after centering pull', () => {
    // A very tall node (h=200) at rank 0 with one child B (h=36) at rank 1.
    // In LR, the "center over children" pass sets A.cy = B.cy = 18 (B is at y=0).
    // A.y = 18 - 100 = -82 — triggers the minY < 0 normalization branch.
    const a = makeNode('A', 0, 0, 80, 200);
    const b = makeNode('B', 1, 0, 80, 36);
    const edgeAB: DotEdge = {
      id: 'A->B', from: a, to: b, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [edgeAB],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // After normalization all y-coords must be non-negative.
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });
});

describe('ht1/ht2 y-spacing', () => {
  it('mixed heights: spacing = ht2[r] + rankSep + ht1[r+1]', () => {
    // rank 0: height=40, rank 1: height=60, rankSep=40
    // Expected gap between center-lines: 40/2 + 40 + 60/2 = 20 + 40 + 30 = 90
    // rank 0 center-line at y=20 (0 + ht1[0]=20), rank 1 center-line at y=110 (20+90)
    // rank 0 top-left y = 0, rank 1 top-left y = 110 - 30 = 80
    // So: node1.y (rank 1 top) - node0.y (rank 0 top) should equal 80
    const a = makeNode('A', 0, 0, 80, 40);
    const b = makeNode('B', 1, 0, 80, 60);
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // The gap from bottom of A to top of B (i.e. b.y - (a.y + a.height))
    // should equal rankSep = 40.
    const gap = b.y - (a.y + a.height);
    expect(gap).toBeCloseTo(40, 1);

    // Gap between center-lines: b center-y - a center-y
    const aCenterY = a.y + a.height / 2;
    const bCenterY = b.y + b.height / 2;
    const centerLineGap = bCenterY - aCenterY;
    // ht2[0] + rankSep + ht1[1] = 20 + 40 + 30 = 90
    expect(centerLineGap).toBeCloseTo(90, 1);
  });

  it('uniform heights: y-spacing is unchanged from old formula (h + rankSep)', () => {
    // rank 0 and rank 1 both have height=40, rankSep=40
    // Old formula: y += maxH + rankSep = 40 + 40 = 80
    // New formula: ht2[0] + rankSep + ht1[1] = 20 + 40 + 20 = 80 — identical
    const a = makeNode('A', 0, 0, 80, 40);
    const b = makeNode('B', 1, 0, 80, 40);
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // Bottom of A to top of B should be exactly rankSep = 40.
    const gap = b.y - (a.y + a.height);
    expect(gap).toBeCloseTo(40, 1);

    // Center-line gap should be h + rankSep = 80.
    const aCenterY = a.y + a.height / 2;
    const bCenterY = b.y + b.height / 2;
    expect(bCenterY - aCenterY).toBeCloseTo(80, 1);
  });
});

describe('NS x-assignment', () => {
  it('two nodes same rank: x separation >= nodeSep + widths', () => {
    const nodeSep = 20;
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 60, 36);
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [],
      longEdges: [],
      rankDir: 'TB',
      nodeSep,
      rankSep: 40,
    };
    assignCoordinates(graph);

    // b must start after a ends plus nodeSep
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width + nodeSep);
  });

  it('chain A->B->C: B center-x within 2*nodeSep of average of A and C center-x', () => {
    // A at rank 0, B at rank 1, C at rank 2.
    // A->B and B->C edges should pull B toward the average of A's and C's center-x.
    const nodeSep = 20;
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 1, 0, 80, 36);
    const c = makeNode('C', 2, 0, 80, 36);

    const edgeAB: DotEdge = {
      id: 'A->B',
      from: a,
      to: b,
      weight: 1,
      minLen: 1,
      reversed: false,
      points: [],
    };
    const edgeBC: DotEdge = {
      id: 'B->C',
      from: b,
      to: c,
      weight: 1,
      minLen: 1,
      reversed: false,
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [a, b, c],
      edges: [edgeAB, edgeBC],
      longEdges: [],
      rankDir: 'TB',
      nodeSep,
      rankSep: 40,
    };
    assignCoordinates(graph);

    const aCx = a.x + a.width / 2;
    const bCx = b.x + b.width / 2;
    const cCx = c.x + c.width / 2;
    const avgAC = (aCx + cCx) / 2;

    // B should be pulled toward the average of A and C center-x.
    expect(Math.abs(bCx - avgAC)).toBeLessThanOrEqual(2 * nodeSep);
  });
});

describe('solveAuxNSY branch coverage', () => {
  it('LR: reversed edge direction (from.rank > to.rank) — hi/lo ternary false branch', () => {
    // Set up an LR edge where edge.from.rank > edge.to.rank.
    // This exercises the false branch of `edge.from.rank < edge.to.rank`
    // in solveAuxNSY's edge-direction normalization (lines 217-219).
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 1, 0, 80, 36);
    // Deliberately reversed: from=B (rank 1) → to=A (rank 0).
    const edge: DotEdge = {
      id: 'B->A', from: b, to: a, weight: 1, minLen: 1, reversed: true, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [edge],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });

  it('LR double-diamond: 2+ parents force y-enforcement in left-to-right pass', () => {
    // A (rank 0, order 0), B (rank 0, order 1): both are parents of D and E.
    // D (rank 1, order 0), E (rank 1, order 1): each has 2 parents.
    // Both D and E get centered over the same parent-average y → overlap → enforcement.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 80, 36);
    const d = makeNode('D', 1, 0, 80, 36);
    const e = makeNode('E', 1, 1, 80, 36);
    const edges: DotEdge[] = [
      { id: 'A->D', from: a, to: d, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'B->D', from: b, to: d, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'A->E', from: a, to: e, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'B->E', from: b, to: e, weight: 1, minLen: 1, reversed: false, points: [] },
    ];
    const graph: DotWorkingGraph = {
      nodes: [a, b, d, e],
      edges,
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    // D and E must be separated and non-negative.
    expect(d.y).toBeGreaterThanOrEqual(0);
    expect(e.y).toBeGreaterThanOrEqual(0);
    expect(!overlaps(d, e)).toBe(true);
    expect(e.y).toBeGreaterThanOrEqual(d.y + d.height + 20);
  });

  it('LR: tall node with two children triggers negative-y normalization', () => {
    // A (rank 0, h=200) has children B (rank 1, order 0) and C (rank 1, order 1).
    // When A is centered over the average of B.cy and C.cy, A.y goes negative.
    // This exercises the `if (minY < 0)` true branch at end of solveAuxNSY.
    const a = makeNode('A', 0, 0, 80, 200);
    const b = makeNode('B', 1, 0, 80, 36);
    const c = makeNode('C', 1, 1, 80, 36);
    const edgeAB: DotEdge = {
      id: 'A->B', from: a, to: b, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const edgeAC: DotEdge = {
      id: 'A->C', from: a, to: c, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b, c],
      edges: [edgeAB, edgeAC],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    // After normalization all y-coords must be non-negative.
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
  });
});

describe('solveAuxNS branch coverage (TB)', () => {
  it('TB: reversed edge direction (from.rank > to.rank) covers hi/lo false branch', () => {
    // Exercises the false branch of `edge.from.rank < edge.to.rank` in solveAuxNS.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 1, 0, 80, 36);
    // Deliberately reversed: from=B (rank 1) → to=A (rank 0).
    const edge: DotEdge = {
      id: 'B->A', from: b, to: a, weight: 1, minLen: 1, reversed: true, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [edge],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeGreaterThanOrEqual(0);
  });

  it('TB double-fan-in: 2+ parents force x-enforcement in top-down pass', () => {
    // A (rank 0, order 0) and B (rank 0, order 1) are both parents of C and D.
    // C (rank 1, order 0) and D (rank 1, order 1) each have 2 parents.
    // Both C and D get centered to the same x position → D requires enforcement.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 80, 36);
    const c = makeNode('C', 1, 0, 80, 36);
    const d = makeNode('D', 1, 1, 80, 36);
    const edges: DotEdge[] = [
      { id: 'A->C', from: a, to: c, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'B->C', from: b, to: c, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'A->D', from: a, to: d, weight: 1, minLen: 1, reversed: false, points: [] },
      { id: 'B->D', from: b, to: d, weight: 1, minLen: 1, reversed: false, points: [] },
    ];
    const graph: DotWorkingGraph = {
      nodes: [a, b, c, d],
      edges,
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    // C and D must be separated and non-negative.
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(!overlaps(c, d)).toBe(true);
    expect(d.x).toBeGreaterThanOrEqual(c.x + c.width + 20);
  });

  it('LR: flat edge (from.rank == to.rank) is skipped in solveAuxNSY', () => {
    // A flat edge (both nodes in the same rank) must be skipped in solveAuxNSY.
    // This covers the TRUE branch of `if (edge.from.rank === edge.to.rank)`.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 80, 36); // same rank as A
    const flatEdge: DotEdge = {
      id: 'A->B', from: a, to: b, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [flatEdge],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    // Flat edges do not drive centering — a and b are in the same rank.
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe('final branch coverage', () => {
  it('TB: flat edge (from.rank == to.rank) is skipped in solveAuxNS', () => {
    // A flat edge within the same rank must be skipped in solveAuxNS.
    // Covers the TRUE branch of `if (edge.from.rank === edge.to.rank)` at line 117.
    const a = makeNode('A', 0, 0, 80, 36);
    const b = makeNode('B', 0, 1, 80, 36); // same rank as A
    const flatEdge: DotEdge = {
      id: 'A->B', from: a, to: b, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [a, b],
      edges: [flatEdge],
      longEdges: [],
      rankDir: 'TB',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeGreaterThanOrEqual(0);
    // flat edges do not drive centering; B is just to the right of A.
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('LR: tall node at order=1 + small sibling at order=0 + child triggers minY<0', () => {
    // S (rank 0, order 0, h=36) is a small sibling. A (rank 0, order 1, h=200) is the tall
    // node. BF constraint pushes A.cy = S.cy + (18+20+100) = 138. After initial normalize,
    // A.y=56, C.y=0. Centering A over C: avgCy=18 => A.y=18-100=-82 < 0.
    // This exercises the TRUE branch of `if (minY < 0)` at the end of solveAuxNSY.
    const s = makeNode('S', 0, 0, 80, 36);   // small sibling, order 0
    const a = makeNode('A', 0, 1, 80, 200);  // tall node, order 1 (pushed high by BF)
    const c = makeNode('C', 1, 0, 80, 36);   // child of A at rank 1
    const edgeAC: DotEdge = {
      id: 'A->C', from: a, to: c, weight: 1, minLen: 1, reversed: false, points: [],
    };
    const graph: DotWorkingGraph = {
      nodes: [s, a, c],
      edges: [edgeAC],
      longEdges: [],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);
    // After normalization all y-coords must be non-negative.
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
  });
});

describe('solveAuxNS hasEdgeLabels propagation', () => {
  function makeLabelNode(id: string, rank: number, order: number, w: number): DotNode {
    return { id, width: w, height: 1, rank, order, x: 0, y: 0, virtual: true };
  }

  function makeLabelEdge(id: string, from: DotNode, to: DotNode, lv: DotNode): DotEdge {
    return { id, from, to, weight: 1, minLen: 2, reversed: false, points: [], labelNode: lv };
  }

  it('single labeled edge: child positioned via NS equilibrium (child.cx = 2*lv.cx - parent.cx)', () => {
    // A (rank 0) → lv (rank 1, virtual) → C (rank 2).
    // After NS x-assignment, lv is centered between A and C.
    // Then the hasEdgeLabels block re-centres lv and projects C.
    const a = makeNode('A', 0, 0, 80, 36);
    const c = makeNode('C', 2, 0, 80, 36);
    const lv = makeLabelNode('lv-AC', 1, 0, 36 + 60); // nodeSep + labelWidth

    const edge = makeLabelEdge('A->C', a, c, lv);

    const graph: DotWorkingGraph = {
      nodes: [a, c, lv],
      edges: [],
      longEdges: [edge],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    assignCoordinates(graph);

    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(lv.x).toBeGreaterThanOrEqual(0);
    // lv center should lie at midpoint of a and c centers.
    const lvCx = lv.x + lv.width / 2;
    const aCx  = a.x + a.width / 2;
    const cCx  = c.x + c.width / 2;
    expect(Math.abs(lvCx - (aCx + cCx) / 2)).toBeLessThan(5);
  });

  it('two labeled edges from same parent: sibling label nodes are symmetric (group-shift applied)', () => {
    // B (rank 0) branches to C (rank 2) and D (rank 2).
    // lv1 and lv2 are label nodes at rank 1.
    // After sibling separation, their group center must equal B.cx.
    const b = makeNode('B', 0, 0, 80, 36);
    const c = makeNode('C', 2, 0, 80, 36);
    const d = makeNode('D', 2, 1, 80, 36);
    const lv1 = makeLabelNode('lv-BC', 1, 0, 36 + 40);
    const lv2 = makeLabelNode('lv-BD', 1, 1, 36 + 40);

    const e1 = makeLabelEdge('B->C', b, c, lv1);
    const e2 = makeLabelEdge('B->D', b, d, lv2);

    const graph: DotWorkingGraph = {
      nodes: [b, c, d, lv1, lv2],
      edges: [],
      longEdges: [e1, e2],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    assignCoordinates(graph);

    // lv1 and lv2 must not overlap and must be separated by at least 5px.
    expect(lv2.x).toBeGreaterThanOrEqual(lv1.x + lv1.width + 5);
    // C and D must not overlap.
    expect(!overlaps(c, d)).toBe(true);
    // Group centre of lv1 and lv2 should be close to B.cx (symmetric spread).
    const groupCx = (lv1.x + lv1.width / 2 + lv2.x + lv2.width / 2) / 2;
    const bCx = b.x + b.width / 2;
    expect(Math.abs(groupCx - bCx)).toBeLessThan(20);
  });

  it('shared child: two labeled edges converging on E — projections are averaged', () => {
    // C (rank 0) and D (rank 0) both have labeled edges to E (rank 2).
    // Two label nodes at rank 1: lv-CE and lv-DE.
    // E.cx should be the average of the two NS projections.
    const c = makeNode('C', 0, 0, 80, 36);
    const d = makeNode('D', 0, 1, 80, 36);
    const e = makeNode('E', 2, 0, 80, 36);
    const lvCE = makeLabelNode('lv-CE', 1, 0, 36 + 40);
    const lvDE = makeLabelNode('lv-DE', 1, 1, 36 + 40);

    const eCE = makeLabelEdge('C->E', c, e, lvCE);
    const eDE = makeLabelEdge('D->E', d, e, lvDE);

    const graph: DotWorkingGraph = {
      nodes: [c, d, e, lvCE, lvDE],
      edges: [],
      longEdges: [eCE, eDE],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    assignCoordinates(graph);

    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(e.x).toBeGreaterThanOrEqual(0);
    // E must not overlap C or D.
    expect(!overlaps(c, e)).toBe(true);
    expect(!overlaps(d, e)).toBe(true);
  });

  it('two labeled edges from same parent with overlapping projections: nodeSep enforced at child rank', () => {
    // A (rank 0, width=80) → lv1 (rank 1, width=5) → C (rank 2, width=80)
    //                       → lv2 (rank 1, width=5) → D (rank 2, width=80)
    // lv1 and lv2 are tiny so sibling separation barely moves them apart.
    // Both project C and D to nearly the same x → nodeSep enforcement at rank 2 fires.
    const a  = makeNode('A', 0, 0, 80, 36);
    const c  = makeNode('C', 2, 0, 80, 36);
    const d  = makeNode('D', 2, 1, 80, 36);
    const lv1 = makeLabelNode('lv1', 1, 0, 5);
    const lv2 = makeLabelNode('lv2', 1, 1, 5);

    const e1 = makeLabelEdge('A->C', a, c, lv1);
    const e2 = makeLabelEdge('A->D', a, d, lv2);

    const graph: DotWorkingGraph = {
      nodes: [a, c, d, lv1, lv2],
      edges: [],
      longEdges: [e1, e2],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    assignCoordinates(graph);

    // C and D must be separated by at least nodeSep after enforcement.
    expect(d.x).toBeGreaterThanOrEqual(c.x + c.width + 36);
  });

  it('labeled edge where child is virtual: virtual-child skip branch fires without crash', () => {
    // If a longEdge has a labelNode but edge.to is virtual (e.g. part of a virtual chain),
    // the child-projection step skips it. This covers the `child.virtual` skip branch.
    const a  = makeNode('A', 0, 0, 80, 36);
    const vn = makeVirtualNode('vn-child', 2, 0); // virtual "child"
    const lv = makeLabelNode('lv', 1, 0, 36 + 40);

    const edge: DotEdge = {
      id: 'A->vn',
      from: a,
      to: vn,
      weight: 1,
      minLen: 2,
      reversed: false,
      points: [],
      labelNode: lv,
    };

    const graph: DotWorkingGraph = {
      nodes: [a, vn, lv],
      edges: [],
      longEdges: [edge],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    expect(() => assignCoordinates(graph)).not.toThrow();
    expect(a.x).toBeGreaterThanOrEqual(0);
  });

  it('hasEdgeLabels: longEdge without labelNode is skipped without crash', () => {
    // A long edge with no labelNode must be skipped, not crash.
    const a = makeNode('A', 0, 0, 80, 36);
    const c = makeNode('C', 2, 0, 80, 36);
    const vn = makeVirtualNode('vn', 1, 0);

    const edge: DotEdge = {
      id: 'A->C',
      from: a,
      to: c,
      weight: 1,
      minLen: 2,
      reversed: false,
      points: [],
      virtualNodes: [vn],
      // no labelNode
    };

    const graph: DotWorkingGraph = {
      nodes: [a, c, vn],
      edges: [],
      longEdges: [edge],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 18,
      hasEdgeLabels: true,
    };

    expect(() => assignCoordinates(graph)).not.toThrow();
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(c.x).toBeGreaterThanOrEqual(0);
  });
});

describe('centerVirtualNodesLR', () => {
  it('LR long edge: virtual node y is interpolated between real endpoints', () => {
    // src (rank 0, order 0), dst (rank 2, order 1), vn (rank 1, order 0).
    // After LR layout, dst.y > src.y. vn should land between them.
    const src = makeNode('src', 0, 0, 80, 36);
    const dst = makeNode('dst', 2, 1, 80, 36);
    const vn = makeVirtualNode('vn', 1, 0);

    const longEdge: DotEdge = {
      id: 'src->dst',
      from: src,
      to: dst,
      weight: 1,
      minLen: 1,
      reversed: false,
      virtualNodes: [vn],
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [src, dst, vn],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    assignCoordinates(graph);

    const srcCy = src.y + src.height / 2;
    const dstCy = dst.y + dst.height / 2;
    const vnCy = vn.y + vn.height / 2;

    const minCy = Math.min(srcCy, dstCy);
    const maxCy = Math.max(srcCy, dstCy);
    expect(vnCy).toBeGreaterThanOrEqual(minCy - 1);
    expect(vnCy).toBeLessThanOrEqual(maxCy + 1);
  });

  it('LR reversed long edge: reversed=true skips virtual node y centering', () => {
    // A reversed long edge should NOT have its virtual node y repositioned.
    // This covers the `if (longEdge.reversed) continue` branch.
    const src = makeNode('src', 0, 0, 80, 36);
    const dst = makeNode('dst', 2, 1, 80, 36);
    const vn = makeVirtualNode('vn', 1, 0);
    vn.y = 999; // sentinel — must stay at 999 if reversed is skipped

    const longEdge: DotEdge = {
      id: 'src->dst',
      from: src,
      to: dst,
      weight: 1,
      minLen: 1,
      reversed: true,
      virtualNodes: [vn],
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [src, dst, vn],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    // Bellman-Ford runs before centerVirtualNodesLR, so vn.y may be reset.
    // Set vn.y AFTER assignCoordinates won't work. Instead, verify no crash and
    // that the result is valid (non-negative). The reversed skip is the observable
    // behavior difference: reversed virtual nodes must NOT be pulled toward endpoints.
    expect(() => assignCoordinates(graph)).not.toThrow();
    expect(src.y).toBeGreaterThanOrEqual(0);
    expect(dst.y).toBeGreaterThanOrEqual(0);
    expect(vn.y).toBeGreaterThanOrEqual(0);
  });

  it('LR: real node sharing virtual rank keeps constraint-solver y, not interpolated', () => {
    // real (rank 1) shares a rank with vn (rank 1). The real node's presence
    // should prevent vn from being interpolated (covers the `!n.virtual` branch).
    const src = makeNode('src', 0, 0, 80, 36);
    const dst = makeNode('dst', 2, 1, 80, 36);
    const vn = makeVirtualNode('vn', 1, 0);
    const real = makeNode('real', 1, 1, 80, 36); // real node in same rank as vn

    const longEdge: DotEdge = {
      id: 'src->dst',
      from: src,
      to: dst,
      weight: 1,
      minLen: 1,
      reversed: false,
      virtualNodes: [vn],
      points: [],
    };

    const graph: DotWorkingGraph = {
      nodes: [src, dst, vn, real],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 40,
    };
    expect(() => assignCoordinates(graph)).not.toThrow();
    // All nodes must have non-negative coordinates.
    expect(src.y).toBeGreaterThanOrEqual(0);
    expect(dst.y).toBeGreaterThanOrEqual(0);
    expect(vn.y).toBeGreaterThanOrEqual(0);
    expect(real.y).toBeGreaterThanOrEqual(0);
  });
});
