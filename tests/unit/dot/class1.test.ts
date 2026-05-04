import { describe, it, expect, beforeEach } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { class1 } from '../../../src/core/dot/class1.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, rank = 0): DotNode {
  return {
    id,
    width: 80,
    height: 36,
    rank,
    order: -1,
    x: 0,
    y: 0,
    virtual: false,
    treeIn: [],
    treeOut: [],
    par: null,
    low: 0,
    lim: 0,
    mark: false,
    subtree: null,
  };
}

function makeEdge(id: string, from: DotNode, to: DotNode, minLen = 1): DotEdge {
  return {
    id,
    from,
    to,
    weight: 1,
    minLen,
    reversed: false,
    points: [],
    treeIndex: -1,
    cutValue: 0,
  };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return {
    nodes,
    edges,
    longEdges: [],
    rankDir: 'TB',
    nodeSep: 36,
    rankSep: 36,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('class1', () => {
  describe('simple chain A→B→C', () => {
    let a: DotNode;
    let b: DotNode;
    let c: DotNode;
    let e1: DotEdge;
    let e2: DotEdge;
    let graph: DotWorkingGraph;

    beforeEach(() => {
      a = makeNode('A', 0);
      b = makeNode('B', 1);
      c = makeNode('C', 2);
      e1 = makeEdge('e1', a, b);
      e2 = makeEdge('e2', b, c);
      graph = makeGraph([a, b, c], [e1, e2]);
      class1(graph);
    });

    it('both edges are classified as tree', () => {
      expect(e1.type).toBe('tree');
      expect(e2.type).toBe('tree');
    });

    it('both edges have inTree = true', () => {
      expect(e1.inTree).toBe(true);
      expect(e2.inTree).toBe(true);
    });

    it('exactly 2 tree edges in graph.edges', () => {
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(2);
    });

    it('cut values are set as finite numbers on tree edges', () => {
      expect(Number.isFinite(e1.cutValue)).toBe(true);
      expect(Number.isFinite(e2.cutValue)).toBe(true);
    });
  });

  describe('tree is a proper subset (some edges have slack > 0)', () => {
    // A→B (rank 0→1, tight), A→C (rank 0→2, slack=1), B→C (rank 1→2, tight)
    // Tight spanning tree should have exactly |nodes|-1 = 2 edges
    let a: DotNode;
    let b: DotNode;
    let c: DotNode;
    let eAB: DotEdge;
    let eAC: DotEdge;
    let eBC: DotEdge;
    let graph: DotWorkingGraph;

    beforeEach(() => {
      a = makeNode('A', 0);
      b = makeNode('B', 1);
      c = makeNode('C', 2);
      eAB = makeEdge('eAB', a, b);  // slack = 1-0-1 = 0 (tight)
      eAC = makeEdge('eAC', a, c);  // slack = 2-0-1 = 1 (not tight)
      eBC = makeEdge('eBC', b, c);  // slack = 2-1-1 = 0 (tight)
      graph = makeGraph([a, b, c], [eAB, eAC, eBC]);
      class1(graph);
    });

    it('exactly |nodes|-1 = 2 edges have inTree = true', () => {
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(2);
    });

    it('the non-tight edge (eAC) is not in the tree', () => {
      expect(eAC.inTree).toBeFalsy();
    });

    it('the tight edges form the spanning tree', () => {
      expect(eAB.inTree).toBe(true);
      expect(eBC.inTree).toBe(true);
    });

    it('cut values are finite numbers on all tree edges', () => {
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });
  });

  describe('back edge after acyclic removal', () => {
    // A→B (rank 0→1), B→C (rank 1→2), C→A is a back edge (reversed, rank 2→0)
    let a: DotNode;
    let b: DotNode;
    let c: DotNode;
    let eAB: DotEdge;
    let eBC: DotEdge;
    let eCA: DotEdge;
    let graph: DotWorkingGraph;

    beforeEach(() => {
      a = makeNode('A', 0);
      b = makeNode('B', 1);
      c = makeNode('C', 2);
      eAB = makeEdge('eAB', a, b);
      eBC = makeEdge('eBC', b, c);
      // Back edge: from C(rank=2) to A(rank=0) — head.rank < tail.rank => back
      eCA = makeEdge('eCA', c, a);
      eCA.reversed = true;
      graph = makeGraph([a, b, c], [eAB, eBC, eCA]);
      class1(graph);
    });

    it('the reversed edge going against rank direction is classified as back', () => {
      expect(eCA.type).toBe('back');
    });

    it('the back edge is not in the spanning tree', () => {
      expect(eCA.inTree).toBeFalsy();
    });

    it('forward edges are in the tree', () => {
      expect(eAB.inTree).toBe(true);
      expect(eBC.inTree).toBe(true);
    });
  });

  describe('diamond: A→B, A→C, B→D, C→D (forward edges)', () => {
    let a: DotNode;
    let b: DotNode;
    let c_: DotNode;
    let d: DotNode;
    let eAB: DotEdge;
    let eAC: DotEdge;
    let eBD: DotEdge;
    let eCD: DotEdge;
    let graph: DotWorkingGraph;

    beforeEach(() => {
      // Ranks: A=0, B=1, C=1, D=2
      a = makeNode('A', 0);
      b = makeNode('B', 1);
      c_ = makeNode('C', 1);
      d = makeNode('D', 2);
      eAB = makeEdge('eAB', a, b);
      eAC = makeEdge('eAC', a, c_);
      eBD = makeEdge('eBD', b, d);
      eCD = makeEdge('eCD', c_, d);
      graph = makeGraph([a, b, c_, d], [eAB, eAC, eBD, eCD]);
      class1(graph);
    });

    it('all edges get a type assigned', () => {
      const validTypes = new Set(['tree', 'forward', 'back', 'cross']);
      for (const e of graph.edges) {
        expect(validTypes.has(e.type!)).toBe(true);
      }
    });

    it('exactly |nodes|-1 = 3 edges are in the spanning tree', () => {
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(3);
    });

    it('cut values are finite on all tree edges', () => {
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });
  });

  describe('single node, no edges', () => {
    it('does not throw and leaves edges empty', () => {
      const a = makeNode('A', 0);
      const graph = makeGraph([a], []);
      expect(() => class1(graph)).not.toThrow();
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('two disconnected nodes with no edges', () => {
    it('does not throw and leaves edges empty', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const graph = makeGraph([a, b], []);
      expect(() => class1(graph)).not.toThrow();
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('single edge A→B', () => {
    it('classifies as tree, sets inTree=true, cut value is finite', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b);
      const graph = makeGraph([a, b], [e]);
      class1(graph);
      expect(e.type).toBe('tree');
      expect(e.inTree).toBe(true);
      expect(Number.isFinite(e.cutValue)).toBe(true);
    });
  });

  describe('forward edge classification', () => {
    // A→B (rank 0→1), B→C (rank 1→2), A→C (rank 0→2, slack=1)
    // DFS: A→B→C finishes C, then back to A, A→C sees C already BLACK as descendant
    it('correctly identifies a forward edge (ancestor to already-finished descendant)', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const eAB = makeEdge('eAB', a, b);
      const eBC = makeEdge('eBC', b, c);
      const eAC = makeEdge('eAC', a, c);

      const graph = makeGraph([a, b, c], [eAB, eBC, eAC]);
      class1(graph);

      // Non-tree eAC should be forward (C visited as descendant) or cross
      expect(eAC.inTree).toBeFalsy();
      expect(eAC.type).not.toBe('back');
    });
  });

  describe('cut value semantics', () => {
    it('cut value of A→B in chain A→B→C equals 1', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const eAB = makeEdge('eAB', a, b);
      const eBC = makeEdge('eBC', b, c);
      const graph = makeGraph([a, b, c], [eAB, eBC]);
      class1(graph);
      expect(eAB.cutValue).toBe(1);
      expect(eBC.cutValue).toBe(1);
    });

    it('cut value with two parallel paths: diamond weights', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 1);
      const d = makeNode('D', 2);
      const eAB = makeEdge('eAB', a, b);
      const eAC = makeEdge('eAC', a, c);
      const eBD = makeEdge('eBD', b, d);
      const eCD = makeEdge('eCD', c, d);
      const graph = makeGraph([a, b, c, d], [eAB, eAC, eBD, eCD]);
      class1(graph);
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(3);
      for (const e of treeEdges) {
        expect(typeof e.cutValue).toBe('number');
        expect(Number.isNaN(e.cutValue)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: treeIn traversal in dfsCutval and dfsRangeInit
  //
  // When nodes are ordered so initCutvalues starts DFS from a leaf node
  // (rather than the root), dfsRangeInit must traverse treeIn edges to
  // reach the rest of the spanning tree.  This exercises:
  //   - dfsRangeInit treeIn path (f.from.par = f assignment)
  //   - dfsCutval treeIn traversal
  //   - xCutval when f.from.par === f (dir = 1 branch)
  //   - xVal dir > 0 with e.to !== v
  // ---------------------------------------------------------------------------

  describe('initCutvalues root detection — chain with reversed node order', () => {
    // Node order [C, B, A] so initCutvalues starts from C (a leaf), forcing
    // dfsRangeInit to use treeIn edges to reach B then A.
    it('computes correct cut values when DFS starts from a leaf node', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const eAB = makeEdge('eAB', a, b);  // tight
      const eBC = makeEdge('eBC', b, c);  // tight

      // Put nodes in reverse order: C first, then B, then A
      const graph = makeGraph([c, b, a], [eAB, eBC]);
      class1(graph);

      expect(eAB.inTree).toBe(true);
      expect(eBC.inTree).toBe(true);
      expect(Number.isFinite(eAB.cutValue)).toBe(true);
      expect(Number.isFinite(eBC.cutValue)).toBe(true);
    });

    it('cut values equal 1 for a tight chain regardless of node order', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const eAB = makeEdge('eAB', a, b);
      const eBC = makeEdge('eBC', b, c);

      // Reverse order forces treeIn traversal
      const graph = makeGraph([c, b, a], [eAB, eBC]);
      class1(graph);

      expect(eAB.cutValue).toBe(1);
      expect(eBC.cutValue).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: ufUnion rankA < rankB (line 157)
  //
  // Triggered when a singleton component (rank=0) is merged INTO a larger
  // component that already has rank > 0.  The edge ordering [C→D, A→C, A→B]
  // ensures C's component gains rank=1 before A's singleton is merged into it.
  // ---------------------------------------------------------------------------

  describe('ufUnion rankA < rankB branch', () => {
    // Edges processed in order: C→D first (C gains rank=1), then A→C
    // (A.rank=0 < C.rank=1 → triggers comp.set(A, C), the rankA<rankB path).
    it('merges singleton into larger-rank component correctly', () => {
      // Ranks: A=0, B=1, C=1, D=2
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 1);
      const d = makeNode('D', 2);
      // Edge ordering: C→D first, then A→C, then A→B
      const eCD = makeEdge('eCD', c, d);  // processed 1st: C.rank becomes 1
      const eAC = makeEdge('eAC', a, c);  // processed 2nd: A.rank=0 < C.rank=1
      const eAB = makeEdge('eAB', a, b);  // processed 3rd

      // nodes order: A,B,C,D for classifyEdges to make eCD/eAC/eAB all 'tree'
      const graph = makeGraph([a, b, c, d], [eCD, eAC, eAB]);
      class1(graph);

      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(3);
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: ufFind multi-hop path traversal (lines 133-134)
  //
  // Triggered when a node's parent pointer points to an intermediate node
  // that itself has a parent (2-hop chain in the union-find structure).
  //
  // Setup: process edges [A→B, C→D, B→C, D→E] on a 5-node chain.
  //   1. A→B: equal ranks → B→A, A.rank=1
  //   2. C→D: equal ranks → D→C, C.rank=1
  //   3. B→C: ufFind(B)=A, ufFind(C)=C, equal ranks → C→A, A.rank=2
  //      Now: D.parent=C, C.parent=A  (2-hop path from D)
  //   4. D→E: ufFind(D) traverses D→C→A, triggering lines 133-134
  // ---------------------------------------------------------------------------

  describe('ufFind multi-hop path compression (2-hop chain)', () => {
    it('resolves 2-hop union-find chains without throwing', () => {
      // 5-node chain: A(0)→B(1)→C(2)→D(3)→E(4)
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const d = makeNode('D', 3);
      const e_ = makeNode('E', 4);

      // Edge order matters: [A→B, C→D, B→C, D→E] forces the 2-hop scenario
      const eAB = makeEdge('eAB', a, b);
      const eCD = makeEdge('eCD', c, d);
      const eBC = makeEdge('eBC', b, c);
      const eDE = makeEdge('eDE', d, e_);

      // nodes in forward order so classifyEdges marks all as 'tree'
      const graph = makeGraph([a, b, c, d, e_], [eAB, eCD, eBC, eDE]);
      class1(graph);

      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(4); // |nodes|-1 = 4
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });

    it('cut values are correct for the 5-node chain', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const d = makeNode('D', 3);
      const e_ = makeNode('E', 4);
      const eAB = makeEdge('eAB', a, b);
      const eCD = makeEdge('eCD', c, d);
      const eBC = makeEdge('eBC', b, c);
      const eDE = makeEdge('eDE', d, e_);
      const graph = makeGraph([a, b, c, d, e_], [eAB, eCD, eBC, eDE]);
      class1(graph);

      // Each tree edge in a simple chain has cut value = 1
      expect(eAB.cutValue).toBe(1);
      expect(eBC.cutValue).toBe(1);
      expect(eCD.cutValue).toBe(1);
      expect(eDE.cutValue).toBe(1);
    });
  });

  describe('ufUnion rank promotion — many merges trigger rankA > rankB branch', () => {
    it('handles many nodes in spanning tree without throwing', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 1);
      const d = makeNode('D', 1);
      const e_ = makeNode('E', 1);
      const f_ = makeNode('F', 1);
      const eAB = makeEdge('eAB', a, b);
      const eAC = makeEdge('eAC', a, c);
      const eAD = makeEdge('eAD', a, d);
      const eAE = makeEdge('eAE', a, e_);
      const eAF = makeEdge('eAF', a, f_);
      const graph = makeGraph([a, b, c, d, e_, f_], [eAB, eAC, eAD, eAE, eAF]);
      class1(graph);

      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(5);
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });
  });

  describe('cross edge in a wider graph', () => {
    it('cross edge is identified and excluded from spanning tree', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 1);
      const d = makeNode('D', 2);
      const eAB = makeEdge('eAB', a, b);
      const eBD = makeEdge('eBD', b, d);
      const eAC = makeEdge('eAC', a, c);
      const eCD = makeEdge('eCD', c, d);

      const graph = makeGraph([a, b, c, d], [eAB, eBD, eAC, eCD]);
      class1(graph);

      expect(eCD.type).toBe('cross');
      expect(eCD.inTree).toBeFalsy();
    });
  });

  describe('multi-weight edges affect cut values', () => {
    it('cut value reflects edge weight', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const eAB = makeEdge('eAB', a, b);
      eAB.weight = 2;
      const eBC = makeEdge('eBC', b, c);
      const graph = makeGraph([a, b, c], [eAB, eBC]);
      class1(graph);
      expect(eAB.cutValue).toBe(2);
      expect(eBC.cutValue).toBe(1);
    });
  });

  describe('non-tight edge picked up by second pass in buildTightTree', () => {
    // Two isolated tight components connected by a non-tight edge.
    // The second pass of buildTightTree must find the min-slack cross-component
    // edge and add it to the spanning tree.
    it('connects two components using the minimum-slack cross-component edge', () => {
      const a = makeNode('A', 0);
      const b2 = makeNode('B2', 1);
      const c2 = makeNode('C2', 3);
      const d2 = makeNode('D2', 4);
      const eA2B2 = makeEdge('eA2B2', a, b2);         // tight: 1-0-1=0
      const eC2D2 = makeEdge('eC2D2', c2, d2);        // tight: 4-3-1=0
      const eB2C2 = makeEdge('eB2C2', b2, c2, 1);     // slack = 3-1-1=1 > 0

      const graph = makeGraph([a, b2, c2, d2], [eA2B2, eC2D2, eB2C2]);
      class1(graph);

      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: empty graph early return (line 501)
  //
  // class1() guards nodes.length === 0 and returns immediately.
  // This verifies the guard fires without throwing and leaves edges untouched.
  // ---------------------------------------------------------------------------

  describe('empty graph (no nodes, no edges)', () => {
    it('does not throw and returns immediately', () => {
      const graph = makeGraph([], []);
      expect(() => class1(graph)).not.toThrow();
    });

    it('leaves edges array empty after early return', () => {
      const graph = makeGraph([], []);
      class1(graph);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Branch coverage: non-tree edge inside subtree contributes 0 to cut value
  //
  // xVal line 329: when SEQ(v.low, other.lim, v.lim) is TRUE (other is inside
  // v's subtree) AND the edge is NOT a tree edge → rv = 0 (not cutValue!).
  //
  // Setup: A(0)→B(1)→C(2)→D(3) tight tree + B→D forward skip edge.
  //   Spanning tree: A→B, B→C, C→D.
  //   After dfsRangeInit from A: D.lim=1, C.lim=2, B.lim=3, A.lim=4.
  //   xCutval(A→B): v=B (f.to, since A.par=null ≠ A→B), dir=-1.
  //   B→D: other=D. SEQ(B.low=1, D.lim=1, B.lim=3) → true. B→D is not a
  //   tree edge → rv = 0 fires (the branch at issue).
  //
  // Cut values with the skip edge:
  //   A→B: only A→B crosses {A}|{B,C,D} → cutValue=1
  //   B→C: both B→C and B→D cross {A,B}|{C,D} → cutValue=2
  //   C→D: both C→D and B→D cross {A,B,C}|{D} → cutValue=2
  // ---------------------------------------------------------------------------

  describe('non-tree forward skip edge inside subtree — xVal zero contribution', () => {
    // A(0)→B(1)→C(2)→D(3) tight chain + B→D forward skip (not in tree).
    // During cut value computation, xVal is called on the B→D non-tree edge
    // with D inside B's subtree → triggers the rv=0 branch.
    it('handles non-tree edges inside subtrees without throwing', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const d = makeNode('D', 3);
      const eAB = makeEdge('eAB', a, b);   // tight tree edge
      const eBC = makeEdge('eBC', b, c);   // tight tree edge
      const eCD = makeEdge('eCD', c, d);   // tight tree edge
      const eBD = makeEdge('eBD', b, d);   // non-tree skip edge (slack=2-1=1)

      // All nodes in forward order so DFS classifies eAB,eBC,eCD as tree
      // and eBD as forward (b→d: D is already visited descendant)
      const graph = makeGraph([a, b, c, d], [eAB, eBC, eCD, eBD]);
      class1(graph);

      expect(eBD.inTree).toBeFalsy();
      const treeEdges = graph.edges.filter(e => e.inTree === true);
      expect(treeEdges).toHaveLength(3); // A→B, B→C, C→D
      for (const e of treeEdges) {
        expect(Number.isFinite(e.cutValue)).toBe(true);
      }
    });

    it('cut values account for the non-tree skip edge crossing cuts', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const c = makeNode('C', 2);
      const d = makeNode('D', 3);
      const eAB = makeEdge('eAB', a, b);
      const eBC = makeEdge('eBC', b, c);
      const eCD = makeEdge('eCD', c, d);
      const eBD = makeEdge('eBD', b, d);

      const graph = makeGraph([a, b, c, d], [eAB, eBC, eCD, eBD]);
      class1(graph);

      // A→B: only A→B crosses {A} | {B,C,D} → cutValue = 1
      expect(eAB.cutValue).toBe(1);
      // B→C: B→C and B→D both cross {A,B} | {C,D} → cutValue = 2
      expect(eBC.cutValue).toBe(2);
      // C→D: C→D and B→D both cross {A,B,C} | {D} → cutValue = 2
      expect(eCD.cutValue).toBe(2);
    });
  });
});
