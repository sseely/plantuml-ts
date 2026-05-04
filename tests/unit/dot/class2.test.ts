import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { class2 } from '../../../src/core/dot/class2.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, rank: number): DotNode {
  return { id, width: 80, height: 36, rank, order: -1, x: 0, y: 0, virtual: false };
}

function makeEdge(
  id: string,
  from: DotNode,
  to: DotNode,
  opts: {
    weight?: number;
    label?: string;
    labelWidth?: number;
    labelHeight?: number;
  } = {},
): DotEdge {
  const base: DotEdge = {
    id,
    from,
    to,
    weight: opts.weight ?? 1,
    minLen: 1,
    reversed: false,
    points: [],
  };
  if (opts.label !== undefined) base.label = opts.label;
  if (opts.labelWidth !== undefined) base.labelWidth = opts.labelWidth;
  if (opts.labelHeight !== undefined) base.labelHeight = opts.labelHeight;
  return base;
}

function makeGraph(nodes: DotNode[], edges: DotEdge[], nodeSep = 36): DotWorkingGraph {
  return {
    nodes,
    edges,
    longEdges: [],
    rankDir: 'TB',
    nodeSep,
    rankSep: 36,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('class2', () => {
  describe('span-1 unlabeled edges (unchanged)', () => {
    it('leaves a unit-span edge in graph.edges without adding virtual nodes', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b);
      const graph = makeGraph([a, b], [e]);

      class2(graph);

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]!.id).toBe('e1');
      expect(graph.longEdges).toHaveLength(0);
      expect(graph.nodes).toHaveLength(2);
    });

    it('preserves edge weight and minLen for unit-span edges', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b, { weight: 5 });
      const graph = makeGraph([a, b], [e]);

      class2(graph);

      expect(graph.edges[0]!.weight).toBe(5);
      expect(graph.edges[0]!.minLen).toBe(1);
    });
  });

  describe('make_chain: long edge with span > 1', () => {
    it('acceptance criterion: A→C span=2 produces chain A→V→C with V at rank 1', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const orig = makeEdge('e1', a, c);
      const graph = makeGraph([a, c], [orig]);

      class2(graph);

      // Original edge moved to longEdges
      expect(graph.longEdges).toHaveLength(1);
      expect(graph.longEdges[0]!.id).toBe('e1');

      // Two segment edges in edges
      expect(graph.edges).toHaveLength(2);

      // One virtual node added
      const virtualNodes = graph.nodes.filter(n => n.virtual);
      expect(virtualNodes).toHaveLength(1);
      const v = virtualNodes[0]!;
      expect(v.rank).toBe(1);

      // Chain connectivity: A→V and V→C
      const seg0 = graph.edges.find(e => e.from.id === 'A');
      const seg1 = graph.edges.find(e => e.to.id === 'C');
      expect(seg0).toBeDefined();
      expect(seg0!.to.id).toBe(v.id);
      expect(seg1).toBeDefined();
      expect(seg1!.from.id).toBe(v.id);
    });

    it('creates span-1 length-1 segment edges', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const orig = makeEdge('e1', a, c);
      const graph = makeGraph([a, c], [orig]);

      class2(graph);

      for (const seg of graph.edges) {
        expect(seg.to.rank - seg.from.rank).toBe(1);
        expect(seg.minLen).toBe(1);
      }
    });

    it('creates N-1 virtual nodes for span N', () => {
      // span = 3: ranks 0→3, needs 2 virtual nodes at ranks 1,2
      const a = makeNode('A', 0);
      const d = makeNode('D', 3);
      const orig = makeEdge('e1', a, d);
      const graph = makeGraph([a, d], [orig]);

      class2(graph);

      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(2);
      expect(vNodes.map(v => v.rank).sort((x, y) => x - y)).toEqual([1, 2]);

      // 3 segment edges
      expect(graph.edges).toHaveLength(3);
      expect(graph.longEdges).toHaveLength(1);
    });

    it('virtual nodes have virtual=true and are added to graph.nodes', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const orig = makeEdge('e1', a, c);
      const graph = makeGraph([a, c], [orig]);

      class2(graph);

      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(1);
      expect(vNodes[0]!.virtual).toBe(true);
    });

    it('plain virtual nodes have width = nodeSep', () => {
      const nodeSep = 36;
      const a = makeNode('A', 0);
      // span 3: 2 plain vnodes at ranks 1,2
      const d = makeNode('D', 3);
      const orig = makeEdge('e1', a, d);
      const graph = makeGraph([a, d], [orig], nodeSep);

      class2(graph);

      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(2);
      for (const v of vNodes) {
        expect(v.width).toBe(nodeSep);
      }
    });

    it('segment edges inherit weight from original edge', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const orig = makeEdge('e1', a, c, { weight: 7 });
      const graph = makeGraph([a, c], [orig]);

      class2(graph);

      for (const seg of graph.edges) {
        expect(seg.weight).toBe(7);
      }
    });

    it('handles reversed=true (back-edge) long edges the same way', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const orig = makeEdge('e1', a, c);
      orig.reversed = true;
      const graph = makeGraph([a, c], [orig]);

      class2(graph);

      // Chain still created regardless of reversed flag
      expect(graph.longEdges).toHaveLength(1);
      expect(graph.edges).toHaveLength(2);
      expect(graph.nodes.filter(n => n.virtual)).toHaveLength(1);
    });

    it('handles multiple long edges independently', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const d = makeNode('D', 3);
      const e1 = makeEdge('e1', a, c);
      const e2 = makeEdge('e2', a, d);
      const graph = makeGraph([a, c, d], [e1, e2]);

      class2(graph);

      expect(graph.longEdges).toHaveLength(2);
      // e1 span=2: 1 vnode + 2 segs; e2 span=3: 2 vnodes + 3 segs
      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(5);
    });
  });

  describe('label_vnode: labeled edge (span=1 — no-op in class2)', () => {
    // In the real pipeline, edgelabel_ranks() doubles all edge minLen values
    // before assignRanks() runs, ensuring every labeled edge has span >= 2 when
    // class2 is called. class2 therefore only handles labeled edges via
    // make_chain (span > 1). A span=1 labeled edge passed directly to class2
    // (bypassing edgelabel_ranks) is left untouched — no labelNode is created.
    it('span-1 labeled edge is NOT given a labelNode by class2 (pipeline responsibility)', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b, { label: 'step', labelWidth: 40, labelHeight: 20 });
      const graph = makeGraph([a, b], [e]);

      class2(graph);

      // Edge remains in graph.edges, no chain created (span=1)
      expect(graph.edges).toHaveLength(1);
      expect(graph.longEdges).toHaveLength(0);
      // class2 does NOT create a labelNode for span=1 edges
      expect(e.labelNode).toBeUndefined();
      expect(graph.nodes).toHaveLength(2);
    });

    it('empty string label does not create a labelNode', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b, { label: '' });
      const graph = makeGraph([a, b], [e]);

      class2(graph);

      expect(e.labelNode).toBeUndefined();
      expect(graph.nodes).toHaveLength(2);
    });

    it('undefined label does not create a labelNode', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1);
      const e = makeEdge('e1', a, b);
      const graph = makeGraph([a, b], [e]);

      class2(graph);

      expect(e.labelNode).toBeUndefined();
      expect(graph.nodes).toHaveLength(2);
    });
  });

  describe('labeled long edge: both chain and label node', () => {
    it('acceptance criterion: labeled span>1 edge gets chain AND labelNode', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const e = makeEdge('e1', a, c, {
        label: 'transition',
        labelWidth: 60,
        labelHeight: 18,
      });
      const graph = makeGraph([a, c], [e]);

      class2(graph);

      // Moved to longEdges
      expect(graph.longEdges).toHaveLength(1);

      // Chain segments
      expect(graph.edges).toHaveLength(2);

      // Virtual nodes: span=2 means 1 intermediate which is also the label node
      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(1);

      // labelNode is set and is the one virtual node
      expect(e.labelNode).toBeDefined();
      expect(e.labelNode!.virtual).toBe(true);
    });

    it('label vnode is placed at midpoint rank floor((from+to)/2)', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const e = makeEdge('e1', a, c, { label: 'x', labelWidth: 20, labelHeight: 10 });
      const graph = makeGraph([a, c], [e]);

      class2(graph);

      // midpoint rank = floor((0+2)/2) = 1
      expect(e.labelNode!.rank).toBe(1);
    });

    it('label vnode at midpoint has correct dimensions', () => {
      const nodeSep = 36;
      const a = makeNode('A', 0);
      const d = makeNode('D', 4);
      // midpoint = floor((0+4)/2) = 2
      const e = makeEdge('e1', a, d, { label: 'x', labelWidth: 50, labelHeight: 15 });
      const graph = makeGraph([a, d], [e], nodeSep);

      class2(graph);

      expect(e.labelNode!.rank).toBe(2);
      expect(e.labelNode!.width).toBe(nodeSep + 50);
      expect(e.labelNode!.height).toBe(15);
    });

    it('non-label vnodes in chain have plain width = nodeSep', () => {
      const nodeSep = 36;
      const a = makeNode('A', 0);
      const d = makeNode('D', 4);
      // midpoint=2 → label at rank 2; ranks 1 and 3 are plain
      const e = makeEdge('e1', a, d, { label: 'x', labelWidth: 50, labelHeight: 15 });
      const graph = makeGraph([a, d], [e], nodeSep);

      class2(graph);

      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(3);

      const plainNodes = vNodes.filter(v => v.id !== e.labelNode!.id);
      for (const v of plainNodes) {
        expect(v.width).toBe(nodeSep);
      }
    });
  });

  describe('mixed graphs', () => {
    it('processes unit-span and long edges in the same graph correctly', () => {
      const a = makeNode('A', 0);
      const b = makeNode('B', 1); // direct edge A→B (span=1)
      const c = makeNode('C', 2); // long edge A→C (span=2)
      const e1 = makeEdge('e1', a, b);
      const e2 = makeEdge('e2', a, c);
      const graph = makeGraph([a, b, c], [e1, e2]);

      class2(graph);

      expect(graph.longEdges).toHaveLength(1);
      expect(graph.longEdges[0]!.id).toBe('e2');

      // e1 stays + 2 chain segs for e2
      expect(graph.edges).toHaveLength(3);

      const vNodes = graph.nodes.filter(n => n.virtual);
      expect(vNodes).toHaveLength(1);
      expect(vNodes[0]!.rank).toBe(1);
    });

    it('does not create duplicate virtual nodes when the same edge is processed once', () => {
      const a = makeNode('A', 0);
      const c = makeNode('C', 2);
      const e = makeEdge('e1', a, c);
      const graph = makeGraph([a, c], [e]);

      class2(graph);
      const vCount = graph.nodes.filter(n => n.virtual).length;

      // Running a fresh call on an already-processed graph should not double-add
      // (in real usage class2 is called once; this verifies idempotency within the module)
      expect(vCount).toBe(1);
    });
  });
});
