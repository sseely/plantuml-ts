import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/neato/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('neato layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative x and y with positive width and height', () => {
    const result = layout(
      { nodes: [{ id: 'A', width: 80, height: 40 }], edges: [] },
      { K: 60, maxIter: 200, seed: 42 },
    );
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.width).toBeGreaterThan(0);
    expect(node.height).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('two connected nodes are approximately K pixels apart (±50%)', () => {
    const K = 60;
    const result = layout(
      {
        nodes: [
          { id: 'A', width: 60, height: 40 },
          { id: 'B', width: 60, height: 40 },
        ],
        edges: [{ id: 'e1', from: 'A', to: 'B' }],
      },
      { K, maxIter: 200, seed: 42 },
    );
    const [a, b] = [result.nodes[0]!, result.nodes[1]!];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    expect(dist).toBeGreaterThan(K * 0.5);
    expect(dist).toBeLessThan(K * 1.5);
  });

  it('5-node path graph: no two bounding boxes overlap', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'C', width: 60, height: 40 },
        { id: 'D', width: 60, height: 40 },
        { id: 'E', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
        { id: 'e4', from: 'D', to: 'E' },
      ],
    };
    const result = layout(input, { K: 80, maxIter: 200, seed: 42 });
    const nodes = result.nodes;
    expect(nodes).toHaveLength(5);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const overlapX =
          a.x - a.width / 2 < b.x + b.width / 2 &&
          a.x + a.width / 2 > b.x - b.width / 2;
        const overlapY =
          a.y - a.height / 2 < b.y + b.height / 2 &&
          a.y + a.height / 2 > b.y - b.height / 2;
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  it('determinism: same input and config produce identical output', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 60, height: 60 },
        { id: 'C', width: 100, height: 50 },
        { id: 'D', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
      ],
    };
    const cfg = { K: 60, maxIter: 200, seed: 42 };
    const r1 = layout(input, cfg);
    const r2 = layout(input, cfg);
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different positions for a 4-node complete graph', () => {
    const k4: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'C', width: 60, height: 40 },
        { id: 'D', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
        { id: 'e3', from: 'A', to: 'D' },
        { id: 'e4', from: 'B', to: 'C' },
        { id: 'e5', from: 'B', to: 'D' },
        { id: 'e6', from: 'C', to: 'D' },
      ],
    };
    const r1 = layout(k4, { K: 60, maxIter: 200, seed: 42 });
    const r2 = layout(k4, { K: 60, maxIter: 200, seed: 99 });

    const positionsEqual = r1.nodes.every((n1) => {
      const n2 = r2.nodes.find((n) => n.id === n1.id)!;
      return Math.abs(n1.x - n2.x) < 0.001 && Math.abs(n1.y - n2.y) < 0.001;
    });
    expect(positionsEqual).toBe(false);
  });

  it('star graph: leaves are roughly equidistant from center (variance < 20% of mean)', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'C', width: 60, height: 40 },
        { id: 'L1', width: 60, height: 40 },
        { id: 'L2', width: 60, height: 40 },
        { id: 'L3', width: 60, height: 40 },
        { id: 'L4', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'C', to: 'L1' },
        { id: 'e2', from: 'C', to: 'L2' },
        { id: 'e3', from: 'C', to: 'L3' },
        { id: 'e4', from: 'C', to: 'L4' },
      ],
    };
    const result = layout(input, { K: 60, maxIter: 200, seed: 42 });
    const nm = new Map(result.nodes.map((n) => [n.id, n]));
    const center = nm.get('C')!;
    const leafIds = ['L1', 'L2', 'L3', 'L4'];
    const leafDists = leafIds.map((id) => {
      const leaf = nm.get(id)!;
      return Math.hypot(leaf.x - center.x, leaf.y - center.y);
    });
    const mean = leafDists.reduce((a, b) => a + b, 0) / leafDists.length;
    const variance =
      leafDists.reduce((acc, d) => acc + (d - mean) ** 2, 0) / leafDists.length;
    expect(Math.sqrt(variance)).toBeLessThan(mean * 0.2);
  });

  it('all edges have exactly 2 points', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'X', width: 60, height: 40 },
        { id: 'Y', width: 60, height: 40 },
        { id: 'Z', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'X', to: 'Y' },
        { id: 'e2', from: 'Y', to: 'Z' },
      ],
    };
    const result = layout(input, { K: 60, maxIter: 200, seed: 42 });
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
    }
  });
});
