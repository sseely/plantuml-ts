import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/twopi/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('twopi layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed with x >= 0, y >= 0, and non-zero width/height', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 40 }],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.width).toBeGreaterThan(0);
    expect(node.height).toBeGreaterThan(0);
  });

  it('linear chain A→B→C→D has increasing ring distances from A', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
        { id: 'D', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
      ],
    };
    const result = layout(input, { root: 'A' });

    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
    const a = nodeMap.get('A')!;
    const b = nodeMap.get('B')!;
    const c = nodeMap.get('C')!;
    const d = nodeMap.get('D')!;

    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y);

    const distAB = dist(a, b);
    const distAC = dist(a, c);
    const distAD = dist(a, d);

    expect(distAB).toBeLessThan(distAC);
    expect(distAC).toBeLessThan(distAD);
  });

  it('star graph: center is root (highest degree), all leaves at same radius ± 1px', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'center', width: 40, height: 40 },
        { id: 'L1', width: 40, height: 40 },
        { id: 'L2', width: 40, height: 40 },
        { id: 'L3', width: 40, height: 40 },
        { id: 'L4', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'center', to: 'L1' },
        { id: 'e2', from: 'center', to: 'L2' },
        { id: 'e3', from: 'center', to: 'L3' },
        { id: 'e4', from: 'center', to: 'L4' },
      ],
    };
    const result = layout(input);

    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
    const center = nodeMap.get('center')!;

    const radii = ['L1', 'L2', 'L3', 'L4'].map((id) => {
      const leaf = nodeMap.get(id)!;
      return Math.hypot(leaf.x - center.x, leaf.y - center.y);
    });

    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(maxR - minR).toBeLessThanOrEqual(1);
  });

  it('no two node bounding boxes overlap in a 6-node star graph', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'center', width: 40, height: 40 },
        { id: 'L1', width: 40, height: 40 },
        { id: 'L2', width: 40, height: 40 },
        { id: 'L3', width: 40, height: 40 },
        { id: 'L4', width: 40, height: 40 },
        { id: 'L5', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'center', to: 'L1' },
        { id: 'e2', from: 'center', to: 'L2' },
        { id: 'e3', from: 'center', to: 'L3' },
        { id: 'e4', from: 'center', to: 'L4' },
        { id: 'e5', from: 'center', to: 'L5' },
      ],
    };
    const result = layout(input);
    const nodes = result.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const aLeft = a.x - a.width / 2;
        const aRight = a.x + a.width / 2;
        const aTop = a.y - a.height / 2;
        const aBottom = a.y + a.height / 2;
        const bLeft = b.x - b.width / 2;
        const bRight = b.x + b.width / 2;
        const bTop = b.y - b.height / 2;
        const bBottom = b.y + b.height / 2;
        const overlapX = aLeft < bRight && aRight > bLeft;
        const overlapY = aTop < bBottom && aBottom > bTop;
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  it('disconnected graph: both components present, no overlaps', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
        { id: 'D', width: 40, height: 40 },
        { id: 'E', width: 40, height: 40 },
        { id: 'F', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'A' },
        { id: 'e4', from: 'D', to: 'E' },
        { id: 'e5', from: 'E', to: 'F' },
        { id: 'e6', from: 'F', to: 'D' },
      ],
    };
    const result = layout(input);

    expect(result.nodes).toHaveLength(6);
    const ids = new Set(result.nodes.map((n) => n.id));
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(ids.has(id), `node ${id} must be present`).toBe(true);
    }

    const nodes = result.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const aLeft = a.x - a.width / 2;
        const aRight = a.x + a.width / 2;
        const aTop = a.y - a.height / 2;
        const aBottom = a.y + a.height / 2;
        const bLeft = b.x - b.width / 2;
        const bRight = b.x + b.width / 2;
        const bTop = b.y - b.height / 2;
        const bBottom = b.y + b.height / 2;
        const overlapX = aLeft < bRight && aRight > bLeft;
        const overlapY = aTop < bBottom && aBottom > bTop;
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  it('determinism: same input produces identical output', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
        { id: 'C', width: 100, height: 50 },
        { id: 'D', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
        { id: 'e3', from: 'B', to: 'D' },
      ],
    };
    const r1 = layout(input);
    const r2 = layout(input);
    expect(r1).toEqual(r2);
  });

  it('each edge has exactly 2 points matching source and destination node centers', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'C', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
      ],
    };
    const result = layout(input, { root: 'A' });

    expect(result.edges).toHaveLength(2);

    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));

    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);

      const srcEdge = input.edges.find((e) => e.id === edge.id)!;
      const srcNode = nodeMap.get(srcEdge.from)!;
      const dstNode = nodeMap.get(srcEdge.to)!;

      expect(edge.points[0]!.x).toBeCloseTo(srcNode.x, 5);
      expect(edge.points[0]!.y).toBeCloseTo(srcNode.y, 5);
      expect(edge.points[1]!.x).toBeCloseTo(dstNode.x, 5);
      expect(edge.points[1]!.y).toBeCloseTo(dstNode.y, 5);
    }
  });

  it('edges referencing unknown node ids are silently skipped', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'MISSING' },
        { id: 'e3', from: 'ALSO_MISSING', to: 'B' },
        { id: 'e4', from: 'X', to: 'Y' },
      ],
    };
    const result = layout(input);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.id).toBe('e1');
  });
});
