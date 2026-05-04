import { describe, it, expect } from 'vitest';
import { xlabelPositions } from '../../../src/core/label/xlabels.js';
import type { DotWorkingGraph, DotNode, DotEdge } from '../../../src/core/dot/types.js';

function makeNode(id: string, x: number, y: number, width: number, height: number): DotNode {
  return { id, width, height, rank: 0, order: 0, x, y, virtual: false };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

describe('xlabelPositions', () => {
  it('given a graph with no xlabel data, returns an empty array', () => {
    const graph = makeGraph([makeNode('a', 50, 50, 80, 36)], []);
    const result = xlabelPositions(graph);
    expect(result).toEqual([]);
  });

  it('given a node with xlabel, returns a position for that label', () => {
    const node = makeNode('a', 100, 100, 80, 36);
    const nodeWithLabel = { ...node, xlabel: 'note' } as unknown as DotNode;
    const graph = makeGraph([nodeWithLabel], []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r).toBeDefined();
    if (r === undefined) return;
    expect(r.nodeId).toBe('a');
    expect(typeof r.x).toBe('number');
    expect(typeof r.y).toBe('number');
    expect(isNaN(r.x)).toBe(false);
    expect(isNaN(r.y)).toBe(false);
  });

  it('given a node with xlabel, the returned position does not overlap the node bounding box', () => {
    const nodeX = 100;
    const nodeY = 100;
    const nodeW = 80;
    const nodeH = 36;
    const labelW = 40;
    const labelH = 18;
    const node = makeNode('a', nodeX, nodeY, nodeW, nodeH);
    const nodeWithLabel = { ...node, xlabel: 'note', xlabelWidth: labelW, xlabelHeight: labelH } as unknown as DotNode;
    const graph = makeGraph([nodeWithLabel], []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(1);
    const r = result[0];
    expect(r).toBeDefined();
    if (r === undefined) return;

    const lx = r.x;
    const ly = r.y;
    const overlaps =
      lx < nodeX + nodeW &&
      lx + labelW > nodeX &&
      ly < nodeY + nodeH &&
      ly + labelH > nodeY;
    expect(overlaps).toBe(false);
  });

  it('given two nodes with xlabels near each other, their label positions do not overlap', () => {
    const labelW = 40;
    const labelH = 18;
    const nodeA = { ...makeNode('a', 0, 0, 80, 36), xlabel: 'labelA', xlabelWidth: labelW, xlabelHeight: labelH } as unknown as DotNode;
    const nodeB = { ...makeNode('b', 120, 0, 80, 36), xlabel: 'labelB', xlabelWidth: labelW, xlabelHeight: labelH } as unknown as DotNode;
    const graph = makeGraph([nodeA, nodeB], []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(2);

    const r0 = result[0];
    const r1 = result[1];
    expect(r0).toBeDefined();
    expect(r1).toBeDefined();
    if (r0 === undefined || r1 === undefined) return;

    const labelsOverlap =
      r0.x < r1.x + labelW &&
      r0.x + labelW > r1.x &&
      r0.y < r1.y + labelH &&
      r0.y + labelH > r1.y;
    expect(labelsOverlap).toBe(false);
  });

  it('given multiple nodes with xlabels spread across a large area, all get positions', () => {
    const labelW = 30;
    const labelH = 15;
    const nodes: DotNode[] = [];
    for (let i = 0; i < 6; i++) {
      nodes.push({
        ...makeNode(`n${i}`, i * 120, 0, 80, 36),
        xlabel: `lbl${i}`,
        xlabelWidth: labelW,
        xlabelHeight: labelH,
      });
    }
    const graph = makeGraph(nodes, []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(6);
    for (const r of result) {
      expect(typeof r.x).toBe('number');
      expect(isNaN(r.x)).toBe(false);
    }
  });

  it('given densely packed nodes with xlabels that cause overlaps, positions are still returned', () => {
    const labelW = 80;
    const labelH = 36;
    const nodes: DotNode[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        nodes.push({
          ...makeNode(`n${row}_${col}`, col * 30, row * 30, 20, 15),
          xlabel: `lbl${row}${col}`,
          xlabelWidth: labelW,
          xlabelHeight: labelH,
        });
      }
    }
    const graph = makeGraph(nodes, []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(9);
    for (const r of result) {
      expect(typeof r.x).toBe('number');
      expect(typeof r.y).toBe('number');
    }
  });

  it('given nodes with xlabels and default dimensions, returns positions without NaN', () => {
    const nodes = [
      { ...makeNode('a', 0, 0, 50, 25), xlabel: 'A' },
      { ...makeNode('b', 200, 0, 50, 25), xlabel: 'B' },
      { ...makeNode('c', 100, 200, 50, 25), xlabel: 'C' },
    ];
    const graph = makeGraph(nodes, []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(3);
    for (const r of result) {
      expect(isNaN(r.x)).toBe(false);
      expect(isNaN(r.y)).toBe(false);
    }
  });

  it('given adjacent overlapping nodes that force sliding sweep, positions are returned', () => {
    const labelW = 60;
    const labelH = 30;
    const nodes: DotNode[] = [];
    for (let i = 0; i < 4; i++) {
      nodes.push({
        ...makeNode(`n${i}`, i * 10, 0, 80, 40),
        xlabel: `lbl${i}`,
        xlabelWidth: labelW,
        xlabelHeight: labelH,
      });
    }
    const graph = makeGraph(nodes, []);
    const result = xlabelPositions(graph);
    expect(result).toHaveLength(4);
    for (const r of result) {
      expect(typeof r.x).toBe('number');
      expect(typeof r.y).toBe('number');
    }
  });
});
