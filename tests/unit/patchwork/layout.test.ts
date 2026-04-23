import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/patchwork/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('patchwork layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node produces one tile with non-negative x and y', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 40 }],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0]!.y).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0]!.width).toBeGreaterThan(0);
    expect(result.nodes[0]!.height).toBeGreaterThan(0);
  });

  it('no two tiles overlap in a 5-node graph', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
        { id: 'C', width: 100, height: 50 },
        { id: 'D', width: 40, height: 80 },
        { id: 'E', width: 70, height: 30 },
      ],
      edges: [],
    };
    const result = layout(input);
    const nodes = result.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY, `tiles ${a.id} and ${b.id} must not overlap`).toBe(false);
      }
    }
  });

  it('output tile areas are proportional to input areas within 5%', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 100, height: 100 },
        { id: 'B', width: 50, height: 50 },
        { id: 'C', width: 80, height: 40 },
        { id: 'D', width: 60, height: 60 },
      ],
      edges: [],
    };
    const result = layout(input, { gap: 0 });

    const inputAreaMap = new Map(input.nodes.map((n) => [n.id, n.width * n.height]));
    const totalInput = input.nodes.reduce((s, n) => s + n.width * n.height, 0);

    const totalOutput = result.nodes.reduce((s, n) => s + n.width * n.height, 0);

    for (const node of result.nodes) {
      const inputFraction = inputAreaMap.get(node.id)! / totalInput;
      const outputFraction = (node.width * node.height) / totalOutput;
      expect(Math.abs(outputFraction - inputFraction)).toBeLessThan(0.05);
    }
  });

  it('all output tile widths and heights are positive', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
        { id: 'C', width: 100, height: 50 },
      ],
      edges: [],
    };
    const result = layout(input);
    for (const node of result.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('edges have exactly 2 points matching tile centers', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
    };
    const result = layout(input, { gap: 0 });
    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0]!;
    expect(edge.points).toHaveLength(2);

    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
    const srcNode = nodeMap.get('A')!;
    const dstNode = nodeMap.get('B')!;
    const srcCenter = { x: srcNode.x + srcNode.width / 2, y: srcNode.y + srcNode.height / 2 };
    const dstCenter = { x: dstNode.x + dstNode.width / 2, y: dstNode.y + dstNode.height / 2 };

    expect(edge.points[0]!.x).toBeCloseTo(srcCenter.x, 5);
    expect(edge.points[0]!.y).toBeCloseTo(srcCenter.y, 5);
    expect(edge.points[1]!.x).toBeCloseTo(dstCenter.x, 5);
    expect(edge.points[1]!.y).toBeCloseTo(dstCenter.y, 5);
  });

  it('gap: 0 produces tiles with no gap between them', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 100, height: 100 },
        { id: 'B', width: 100, height: 100 },
      ],
      edges: [],
    };
    const result = layout(input, { gap: 0 });
    const nodes = result.nodes;
    expect(nodes).toHaveLength(2);
    const a = nodes[0]!;
    const b = nodes[1]!;
    const sharedEdge =
      Math.abs(a.x + a.width - b.x) < 1e-9 ||
      Math.abs(b.x + b.width - a.x) < 1e-9 ||
      Math.abs(a.y + a.height - b.y) < 1e-9 ||
      Math.abs(b.y + b.height - a.y) < 1e-9;
    expect(sharedEdge).toBe(true);
  });

  it('edges referencing unknown node ids are silently skipped', () => {
    const input: DotInputGraph = {
      nodes: [{ id: 'A', width: 80, height: 40 }],
      edges: [
        { id: 'e1', from: 'A', to: 'MISSING' },
        { id: 'e2', from: 'ALSO_MISSING', to: 'A' },
        { id: 'e3', from: 'X', to: 'Y' },
      ],
    };
    const result = layout(input);
    expect(result.edges).toHaveLength(0);
  });

  it('calling layout() twice with the same input returns identical results', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
        { id: 'C', width: 100, height: 50 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
    };
    const r1 = layout(input);
    const r2 = layout(input);
    expect(r1).toEqual(r2);
  });
});
