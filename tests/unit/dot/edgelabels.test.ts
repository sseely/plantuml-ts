import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { placeEdgeLabels } from '../../../src/core/dot/edgelabels.js';

function makeNode(
  id: string,
  x: number,
  y: number,
  w = 80,
  h = 36,
): DotNode {
  return { id, width: w, height: h, rank: 0, order: 0, x, y, virtual: false };
}

function makeVirtualNode(id: string, x: number, y: number): DotNode {
  return { id, width: 0, height: 0, rank: 0, order: 0, x, y, virtual: true };
}

function makeEdge(
  id: string,
  from: DotNode,
  to: DotNode,
  points: Array<{ x: number; y: number }>,
  label?: string,
): DotEdge {
  const base: DotEdge = { id, from, to, weight: 1, minLen: 1, reversed: false, points };
  if (label !== undefined) {
    base.label = label;
  }
  return base;
}

function makeGraph(
  nodes: DotNode[],
  edges: DotEdge[],
  longEdges: DotEdge[] = [],
): DotWorkingGraph {
  return { nodes, edges, longEdges, rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

describe('placeEdgeLabels', () => {
  describe('basic placement', () => {
    it('sets labelX and labelY near the midpoint when no node overlap', () => {
      // Two nodes far apart — midpoint is at (40, 150), well away from both nodes
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 150 },
        { x: 40, y: 300 },
      ], 'my label');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      // Midpoint of 3 points: index 1 → (40, 150)
      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(150, 0);
    });

    it('sets labelX and labelY when edge has exactly 1 point', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [{ x: 40, y: 150 }], 'lbl');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(150, 0);
    });

    it('sets labelX and labelY when edge has 2 points (uses average)', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [
        { x: 20, y: 100 },
        { x: 60, y: 200 },
      ], 'lbl');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(150, 0);
    });
  });

  describe('skip conditions', () => {
    it('does not set labelX/labelY when label is undefined', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [{ x: 40, y: 150 }]);
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeUndefined();
      expect(edge.labelY).toBeUndefined();
    });

    it('does not set labelX/labelY when label is empty string', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [{ x: 40, y: 150 }], '');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeUndefined();
      expect(edge.labelY).toBeUndefined();
    });

    it('does not set labelX/labelY when points array is empty', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [], 'label');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeUndefined();
      expect(edge.labelY).toBeUndefined();
    });
  });

  describe('node collision avoidance', () => {
    it('shifts label away when midpoint falls inside a node bounding box', () => {
      // Node C sits exactly where the midpoint would be placed
      // Node C: x=0, y=100, width=80, height=36 → covers x[0,80], y[100,136]
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const c = makeNode('C', 0, 100, 80, 36);
      // Midpoint of these points is (40, 118) — inside node C
      const edge = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 118 },
        { x: 40, y: 264 },
      ], 'shifted');
      const graph = makeGraph([a, b, c], [edge]);

      placeEdgeLabels(graph);

      // The label must have been moved; it should no longer be inside node C
      expect(edge.labelX).toBeDefined();
      expect(edge.labelY).toBeDefined();
      const lx = edge.labelX!;
      const ly = edge.labelY!;
      const insideC =
        lx >= c.x && lx <= c.x + c.width && ly >= c.y && ly <= c.y + c.height;
      expect(insideC).toBe(false);
    });

    it('does not shift label when midpoint is outside all nodes', () => {
      // Midpoint is at (40, 200), well outside both nodes
      const a = makeNode('A', 0, 0);   // covers x[0,80], y[0,36]
      const b = makeNode('B', 0, 364); // covers x[0,80], y[364,400]
      const edge = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 200 },
        { x: 40, y: 364 },
      ], 'no shift');
      const graph = makeGraph([a, b], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(200, 0);
    });

    it('virtual nodes are ignored when checking for overlap', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      // A virtual node placed exactly at the midpoint — should not trigger shift
      const vn = makeVirtualNode('__v', 0, 118);
      vn.width = 80;
      vn.height = 36;
      const edge = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 118 },
        { x: 40, y: 264 },
      ], 'no shift for virtual');
      const graph = makeGraph([a, b, vn], [edge]);

      placeEdgeLabels(graph);

      // Should not have shifted — virtual nodes are excluded
      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(118, 0);
    });

    it('falls back to opposite perpendicular direction when forward shifts are all blocked', () => {
      // Edge travels vertically (downward). Perpendicular: dx=-1, dy=0 (leftward).
      // We place a wide blocking node that covers all 10 leftward shift positions
      // but leaves rightward positions clear.
      //
      // Midpoint: (40, 118).  Forward shifts (leftward): x = 28, 16, 4, -8, ..., -80
      // Block node spans x=[-200, 80], y=[100, 140] — covers all leftward positions.
      // Backward shifts (rightward): x = 52, 64... — clear.
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      // Blocking node: x=-200, y=100, width=280 (spans [-200, 80]), height=40
      const blocker = makeNode('BLOCK', -200, 100, 280, 40);
      const edge = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 118 },
        { x: 40, y: 264 },
      ], 'fallback');
      const graph = makeGraph([a, b, blocker], [edge]);

      placeEdgeLabels(graph);

      // Label must be defined and shifted to the right (positive x direction)
      expect(edge.labelX).toBeDefined();
      expect(edge.labelY).toBeDefined();
      expect(edge.labelX!).toBeGreaterThan(40);
    });

    it('uses (1, 0) fallback direction when edge has a single degenerate point inside a node', () => {
      // A single-point edge whose lone point is inside a node. Because lo == hi == 0,
      // p0 === p1 and the edge vector length is 0 → perpendicularAt() falls back to
      // dx=1, dy=0. The label should shift rightward to escape the node.
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      // Node at (0, 40) covering x[0,80], y[40,80] — point (40, 60) is inside it
      const c = makeNode('C', 0, 40, 80, 40);
      const edge = makeEdge('e1', a, b, [{ x: 40, y: 60 }], 'degenerate');
      const graph = makeGraph([a, b, c], [edge]);

      placeEdgeLabels(graph);

      expect(edge.labelX).toBeDefined();
      expect(edge.labelY).toBeDefined();
      // With dx=1 fallback, the label should shift to the right (x > 40+12=52)
      expect(edge.labelX!).toBeGreaterThan(40);
    });
  });

  describe('longEdges', () => {
    it('places labels on edges in graph.longEdges', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const longEdge = makeEdge('le1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 168 },
        { x: 40, y: 300 },
      ], 'long label');
      const graph = makeGraph([a, b], [], [longEdge]);

      placeEdgeLabels(graph);

      expect(longEdge.labelX).toBeCloseTo(40, 0);
      expect(longEdge.labelY).toBeCloseTo(168, 0);
    });
  });

  describe('label-label overlap resolution', () => {
    it('separates two labels that would overlap at the same position', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 500);
      const c = makeNode('C', 200, 0);
      const d = makeNode('D', 200, 500);

      // Both edges have midpoints at exactly (40, 250), so labels overlap
      const edge1 = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 250 },
        { x: 40, y: 464 },
      ], 'lbl1');
      const edge2 = makeEdge('e2', c, d, [
        { x: 40, y: 36 },
        { x: 40, y: 250 },
        { x: 40, y: 464 },
      ], 'lbl2');

      const graph = makeGraph([a, b, c, d], [edge1, edge2]);

      placeEdgeLabels(graph);

      // Both labels must be defined
      expect(edge1.labelX).toBeDefined();
      expect(edge1.labelY).toBeDefined();
      expect(edge2.labelX).toBeDefined();
      expect(edge2.labelY).toBeDefined();

      // The label bounding boxes must no longer overlap after resolution
      const w1 = 'lbl1'.length * 7;
      const w2 = 'lbl2'.length * 7;
      const h = 14;
      const box1 = {
        x: edge1.labelX! - w1 / 2,
        y: edge1.labelY! - h / 2,
        w: w1,
        h,
      };
      const box2 = {
        x: edge2.labelX! - w2 / 2,
        y: edge2.labelY! - h / 2,
        w: w2,
        h,
      };
      const overlapping =
        box1.x < box2.x + box2.w &&
        box1.x + box1.w > box2.x &&
        box1.y < box2.y + box2.h &&
        box1.y + box1.h > box2.y;

      expect(overlapping).toBe(false);
    });

    it('does not modify labels that do not overlap', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 500);
      const c = makeNode('C', 300, 0);
      const d = makeNode('D', 300, 500);

      // Edge 1 midpoint: (40, 250); edge 2 midpoint: (340, 250)
      // Both labels are "x" — width = 7px, so bboxes are well separated
      const edge1 = makeEdge('e1', a, b, [
        { x: 40, y: 36 },
        { x: 40, y: 250 },
        { x: 40, y: 464 },
      ], 'x');
      const edge2 = makeEdge('e2', c, d, [
        { x: 340, y: 36 },
        { x: 340, y: 250 },
        { x: 340, y: 464 },
      ], 'x');

      const graph = makeGraph([a, b, c, d], [edge1, edge2]);

      placeEdgeLabels(graph);

      // Labels are 300 pixels apart — no shift should occur
      expect(edge1.labelX).toBeCloseTo(40, 0);
      expect(edge1.labelY).toBeCloseTo(250, 0);
      expect(edge2.labelX).toBeCloseTo(340, 0);
      expect(edge2.labelY).toBeCloseTo(250, 0);
    });

    it('handles mixed labeled and unlabeled edges without error', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edgeWithLabel = makeEdge('e1', a, b, [
        { x: 40, y: 150 },
      ], 'has label');
      const edgeNoLabel = makeEdge('e2', a, b, [{ x: 60, y: 150 }]);
      const graph = makeGraph([a, b], [edgeWithLabel, edgeNoLabel]);

      expect(() => placeEdgeLabels(graph)).not.toThrow();
      expect(edgeWithLabel.labelX).toBeDefined();
      expect(edgeNoLabel.labelX).toBeUndefined();
    });

    it('shifts second label left when it starts to the left of the first label', () => {
      // Overlap resolution, horizontal shift, sign=-1 branch:
      // edge1 midpoint at (100, 250), edge2 midpoint at (98, 250).
      // Both labels are "hi" (width = 14px, height = 14px).
      // box1: x = 100 - 7 = 93, box2: x = 98 - 7 = 91 → bb.x (91) < ba.x (93) → sign = -1
      // overlapX (12) <= overlapY (14), so horizontal shift applies with sign=-1
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 500);
      const c = makeNode('C', 80, 0);
      const d = makeNode('D', 80, 500);

      const edge1 = makeEdge('e1', a, b, [
        { x: 100, y: 36 },
        { x: 100, y: 250 },
        { x: 100, y: 464 },
      ], 'hi');
      const edge2 = makeEdge('e2', c, d, [
        { x: 98, y: 36 },
        { x: 98, y: 250 },
        { x: 98, y: 464 },
      ], 'hi');

      const graph = makeGraph([a, b, c, d], [edge1, edge2]);

      placeEdgeLabels(graph);

      // edge2's label should have been shifted left (x decreased)
      expect(edge2.labelX).toBeDefined();
      expect(edge2.labelX!).toBeLessThan(98);
    });

    it('shifts second label right when it starts to the right of the first label', () => {
      // Overlap resolution, horizontal shift, sign=+1 branch:
      // edge1 midpoint at (100, 250), edge2 midpoint at (102, 250).
      // Both labels "hi" (width=14, height=14).
      // box1: x=93, box2: x=95 → bb.x (95) >= ba.x (93) → sign = +1
      // overlapX (12) <= overlapY (14) → horizontal shift with sign=+1
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 500);
      const c = makeNode('C', 80, 0);
      const d = makeNode('D', 80, 500);

      const edge1 = makeEdge('e1', a, b, [
        { x: 100, y: 36 },
        { x: 100, y: 250 },
        { x: 100, y: 464 },
      ], 'hi');
      const edge2 = makeEdge('e2', c, d, [
        { x: 102, y: 36 },
        { x: 102, y: 250 },
        { x: 102, y: 464 },
      ], 'hi');

      const graph = makeGraph([a, b, c, d], [edge1, edge2]);

      placeEdgeLabels(graph);

      // edge2's label should have been shifted right (x increased)
      expect(edge2.labelX).toBeDefined();
      expect(edge2.labelX!).toBeGreaterThan(102);
    });

    it('shifts second label upward when it starts above the first label', () => {
      // Overlap resolution, vertical shift, sign=-1 branch:
      // edge1 midpoint at (100, 250), edge2 midpoint at (100, 248).
      // Both labels "hi" (width=14, height=14).
      // box1: y=243, box2: y=241 → bb.y (241) < ba.y (243) → sign = -1
      // overlapX=14 > overlapY=12 → vertical shift with sign=-1
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 500);
      const c = makeNode('C', 80, 0);
      const d = makeNode('D', 80, 500);

      const edge1 = makeEdge('e1', a, b, [
        { x: 100, y: 36 },
        { x: 100, y: 250 },
        { x: 100, y: 464 },
      ], 'hi');
      const edge2 = makeEdge('e2', c, d, [
        { x: 100, y: 36 },
        { x: 100, y: 248 },
        { x: 100, y: 464 },
      ], 'hi');

      const graph = makeGraph([a, b, c, d], [edge1, edge2]);

      placeEdgeLabels(graph);

      // edge2's label should have been shifted upward (y decreased)
      expect(edge2.labelY).toBeDefined();
      expect(edge2.labelY!).toBeLessThan(248);
    });
  });

  describe('edge cases', () => {
    it('handles a graph with no edges', () => {
      const a = makeNode('A', 0, 0);
      const graph = makeGraph([a], []);

      expect(() => placeEdgeLabels(graph)).not.toThrow();
    });

    it('handles a graph with no nodes', () => {
      const a = makeNode('A', 0, 0);
      const b = makeNode('B', 0, 300);
      const edge = makeEdge('e1', a, b, [{ x: 40, y: 150 }], 'lbl');
      const graph = makeGraph([], [edge]);

      placeEdgeLabels(graph);

      // No nodes to collide with — label stays at midpoint
      expect(edge.labelX).toBeCloseTo(40, 0);
      expect(edge.labelY).toBeCloseTo(150, 0);
    });
  });
});
