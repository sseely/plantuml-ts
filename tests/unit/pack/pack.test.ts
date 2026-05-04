import { describe, it, expect } from 'vitest';
import type { DotWorkingGraph, DotNode, DotEdge } from '../../../src/core/dot/types.js';
import { packSubgraphs } from '../../../src/core/pack/pack.js';
import { findConnectedComponents } from '../../../src/core/pack/ccomps.js';

function makeNode(id: string, x = 0, y = 0, w = 100, h = 100): DotNode {
  return { id, width: w, height: h, rank: 0, order: 0, x, y, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[] = []): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

describe('packSubgraphs', () => {
  it('single component returns xOffset=0, yOffset=0', () => {
    const n1 = makeNode('A', 0, 0);
    const n2 = makeNode('B', 0, 110);
    const g = makeGraph([n1, n2]);
    const result = packSubgraphs([g], 10);
    expect(result).toHaveLength(1);
    const r0 = result[0]!;
    expect(r0.xOffset).toBe(0);
    expect(r0.yOffset).toBe(0);
  });

  it('two 100x100 components packed width <= 220', () => {
    const n1 = makeNode('A', 0, 0, 100, 100);
    const g1 = makeGraph([n1]);
    const n2 = makeNode('B', 0, 0, 100, 100);
    const g2 = makeGraph([n2]);
    const result = packSubgraphs([g1, g2], 10);
    expect(result).toHaveLength(2);
    const packedPositions = result.map((r) => {
      const node = r.nodes[0]!;
      const nodeX = node.x + r.xOffset;
      return nodeX + 100;
    });
    const maxRight = Math.max(...packedPositions);
    expect(maxRight).toBeLessThanOrEqual(220);
  });

  it('two components of different heights do not overlap', () => {
    const n1 = makeNode('A', 0, 0, 100, 100);
    const g1 = makeGraph([n1]);
    const n2 = makeNode('B', 0, 0, 100, 50);
    const g2 = makeGraph([n2]);
    const result = packSubgraphs([g1, g2], 5);
    expect(result).toHaveLength(2);

    const r0 = result[0]!;
    const r1 = result[1]!;
    const boxes = [
      { x1: r0.xOffset, y1: r0.yOffset, x2: r0.xOffset + 100, y2: r0.yOffset + 100 },
      { x1: r1.xOffset, y1: r1.yOffset, x2: r1.xOffset + 100, y2: r1.yOffset + 50 },
    ];

    const overlaps = (
      a: { x1: number; y1: number; x2: number; y2: number },
      b: { x1: number; y1: number; x2: number; y2: number },
    ): boolean => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

    expect(overlaps(boxes[0]!, boxes[1]!)).toBe(false);
  });

  it('empty input returns empty array', () => {
    const result = packSubgraphs([], 10);
    expect(result).toHaveLength(0);
  });

  it('nodes in each result carry original node ids', () => {
    const n1 = makeNode('X', 10, 20, 80, 60);
    const g1 = makeGraph([n1]);
    const result = packSubgraphs([g1], 10);
    const r0 = result[0]!;
    expect(r0.nodes).toHaveLength(1);
    expect(r0.nodes[0]!.id).toBe('X');
  });

  it('node positions in result match source graph (before offset applied)', () => {
    const n1 = makeNode('P', 15, 25, 80, 60);
    const g1 = makeGraph([n1]);
    const result = packSubgraphs([g1], 10);
    const r0 = result[0]!;
    expect(r0.nodes[0]!.x).toBe(15);
    expect(r0.nodes[0]!.y).toBe(25);
  });

  it('multiple components each get their own entry with correct node lists', () => {
    const nodes1 = [makeNode('A1', 0, 0), makeNode('A2', 110, 0)];
    const nodes2 = [makeNode('B1', 0, 0), makeNode('B2', 0, 110)];
    const g1 = makeGraph(nodes1);
    const g2 = makeGraph(nodes2);
    const result = packSubgraphs([g1, g2], 10);
    const r0 = result[0]!;
    const r1 = result[1]!;
    const ids1 = new Set(r0.nodes.map((n) => n.id));
    const ids2 = new Set(r1.nodes.map((n) => n.id));
    expect(ids1).toEqual(new Set(['A1', 'A2']));
    expect(ids2).toEqual(new Set(['B1', 'B2']));
  });

  it('tall components (H > W) pack without overlap — exercises H>W spiral branch', () => {
    const n1 = makeNode('A', 0, 0, 50, 200);
    const g1 = makeGraph([n1]);
    const n2 = makeNode('B', 0, 0, 50, 200);
    const g2 = makeGraph([n2]);
    const result = packSubgraphs([g1, g2], 5);
    expect(result).toHaveLength(2);

    const r0 = result[0]!;
    const r1 = result[1]!;
    const hw = 25;
    const hh = 100;
    const boxes = [
      { x1: r0.xOffset - hw, y1: r0.yOffset - hh, x2: r0.xOffset + hw, y2: r0.yOffset + hh },
      { x1: r1.xOffset - hw, y1: r1.yOffset - hh, x2: r1.xOffset + hw, y2: r1.yOffset + hh },
    ];

    const overlaps = (
      a: { x1: number; y1: number; x2: number; y2: number },
      b: { x1: number; y1: number; x2: number; y2: number },
    ): boolean => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

    expect(overlaps(boxes[0]!, boxes[1]!)).toBe(false);
  });

  it('component with zero nodes produces empty nodes list', () => {
    const emptyGraph = makeGraph([]);
    const nodeGraph = makeGraph([makeNode('A', 0, 0, 80, 60)]);
    const result = packSubgraphs([emptyGraph, nodeGraph], 10);
    expect(result).toHaveLength(2);
    expect(result[0]!.nodes).toHaveLength(0);
    expect(result[1]!.nodes).toHaveLength(1);
  });

  it('three components pack without mutual overlap', () => {
    const g1 = makeGraph([makeNode('A', 0, 0, 80, 80)]);
    const g2 = makeGraph([makeNode('B', 0, 0, 80, 80)]);
    const g3 = makeGraph([makeNode('C', 0, 0, 80, 80)]);
    const result = packSubgraphs([g1, g2, g3], 8);
    expect(result).toHaveLength(3);

    const boxes = result.map((r) => ({
      x1: r.xOffset - 40,
      y1: r.yOffset - 40,
      x2: r.xOffset + 40,
      y2: r.yOffset + 40,
    }));

    const overlaps = (
      a: { x1: number; y1: number; x2: number; y2: number },
      b: { x1: number; y1: number; x2: number; y2: number },
    ): boolean => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });
});

describe('findConnectedComponents', () => {
  it('single node, no edges — one component', () => {
    const n = makeNode('A');
    const g = makeGraph([n]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(1);
    const c0 = comps[0]!;
    expect(c0.nodes).toHaveLength(1);
    expect(c0.nodes[0]!.id).toBe('A');
  });

  it('two disconnected nodes — two components', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const g = makeGraph([a, b]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(2);
  });

  it('two connected nodes — one component', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e = makeEdge('e1', a, b);
    const g = makeGraph([a, b], [e]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.nodes).toHaveLength(2);
  });

  it('chain A-B-C — one component of three', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const g = makeGraph([a, b, c], [e1, e2]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.nodes).toHaveLength(3);
  });

  it('two disconnected pairs — two components', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', c, d);
    const g = makeGraph([a, b, c, d], [e1, e2]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(2);
    const ids = comps.map((comp) => new Set(comp.nodes.map((n) => n.id)));
    const expectedPairs = [new Set(['A', 'B']), new Set(['C', 'D'])];
    for (const expected of expectedPairs) {
      expect(ids.some((s) => [...expected].every((id) => s.has(id)))).toBe(true);
    }
  });

  it('empty graph — empty result', () => {
    const g = makeGraph([]);
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(0);
  });

  it('longEdges are also considered for connectivity', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const longEdge: DotEdge = {
      id: 'long1',
      from: a,
      to: b,
      weight: 1,
      minLen: 2,
      reversed: false,
      points: [],
    };
    const g: DotWorkingGraph = {
      nodes: [a, b],
      edges: [],
      longEdges: [longEdge],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 36,
    };
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(1);
  });

  it('edges and longEdges both partition into components correctly', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const longEdge: DotEdge = {
      id: 'long1',
      from: a,
      to: c,
      weight: 1,
      minLen: 2,
      reversed: false,
      points: [],
    };
    const g: DotWorkingGraph = {
      nodes: [a, b, c],
      edges: [e1],
      longEdges: [longEdge],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 36,
    };
    const comps = findConnectedComponents(g);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.nodes).toHaveLength(3);
    expect(comps[0]!.edges).toHaveLength(1);
    expect(comps[0]!.longEdges).toHaveLength(1);
  });
});
