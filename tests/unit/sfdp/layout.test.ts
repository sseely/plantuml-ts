import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/sfdp/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

const STABLE = { K: 80, maxIter: 100, seed: 42 };

function nodesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const overlapX =
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2;
  const overlapY =
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2;
  return overlapX && overlapY;
}

describe('sfdp layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative x and y with positive width and height', () => {
    const result = layout(
      { nodes: [{ id: 'A', width: 80, height: 40 }], edges: [] },
      STABLE,
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

  it('10-node grid graph: no two bounding boxes overlap', () => {
    // 4x3 grid minus top-right and bottom-right corners: nodes n00..n23
    // Present nodes: (row,col) where row in 0..2, col in 0..3, minus (0,3) and (2,3)
    const nodeIds = [
      'n00', 'n01', 'n02', 'n03',
      'n10', 'n11', 'n12',
      'n20', 'n21', 'n22',
    ];
    const nodes = nodeIds.map((id) => ({ id, width: 60, height: 30 }));

    // Horizontal edges within each row
    const edges = [
      { id: 'e_00_01', from: 'n00', to: 'n01' },
      { id: 'e_01_02', from: 'n01', to: 'n02' },
      { id: 'e_02_03', from: 'n02', to: 'n03' },
      { id: 'e_10_11', from: 'n10', to: 'n11' },
      { id: 'e_11_12', from: 'n11', to: 'n12' },
      { id: 'e_20_21', from: 'n20', to: 'n21' },
      { id: 'e_21_22', from: 'n21', to: 'n22' },
      // Vertical edges between rows
      { id: 'e_00_10', from: 'n00', to: 'n10' },
      { id: 'e_01_11', from: 'n01', to: 'n11' },
      { id: 'e_02_12', from: 'n02', to: 'n12' },
      { id: 'e_10_20', from: 'n10', to: 'n20' },
      { id: 'e_11_21', from: 'n11', to: 'n21' },
      { id: 'e_12_22', from: 'n12', to: 'n22' },
    ];

    const input: DotInputGraph = { nodes, edges };
    const result = layout(input, { K: 80, maxIter: 100, seed: 42 });

    expect(result.nodes).toHaveLength(10);

    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i]!;
        const b = result.nodes[j]!;
        expect(
          nodesOverlap(a, b),
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
    const r1 = layout(input, STABLE);
    const r2 = layout(input, STABLE);
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different layouts for 6-node complete graph', () => {
    const k6: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'C', width: 60, height: 40 },
        { id: 'D', width: 60, height: 40 },
        { id: 'E', width: 60, height: 40 },
        { id: 'F', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
        { id: 'e3', from: 'A', to: 'D' },
        { id: 'e4', from: 'A', to: 'E' },
        { id: 'e5', from: 'A', to: 'F' },
        { id: 'e6', from: 'B', to: 'C' },
        { id: 'e7', from: 'B', to: 'D' },
        { id: 'e8', from: 'B', to: 'E' },
        { id: 'e9', from: 'B', to: 'F' },
        { id: 'e10', from: 'C', to: 'D' },
        { id: 'e11', from: 'C', to: 'E' },
        { id: 'e12', from: 'C', to: 'F' },
        { id: 'e13', from: 'D', to: 'E' },
        { id: 'e14', from: 'D', to: 'F' },
        { id: 'e15', from: 'E', to: 'F' },
      ],
    };
    const r1 = layout(k6, { K: 80, maxIter: 100, seed: 42 });
    const r2 = layout(k6, { K: 80, maxIter: 100, seed: 99 });

    const positionsEqual = r1.nodes.every((n1) => {
      const n2 = r2.nodes.find((n) => n.id === n1.id)!;
      return Math.abs(n1.x - n2.x) < 0.001 && Math.abs(n1.y - n2.y) < 0.001;
    });
    expect(positionsEqual).toBe(false);
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
    const result = layout(input, STABLE);
    for (const edge of result.edges) {
      expect(edge.points).toHaveLength(2);
    }
  });

  it('disconnected graph: two 4-node cycles, all 8 nodes present, no overlaps', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A1', width: 60, height: 40 },
        { id: 'A2', width: 60, height: 40 },
        { id: 'A3', width: 60, height: 40 },
        { id: 'A4', width: 60, height: 40 },
        { id: 'B1', width: 60, height: 40 },
        { id: 'B2', width: 60, height: 40 },
        { id: 'B3', width: 60, height: 40 },
        { id: 'B4', width: 60, height: 40 },
      ],
      edges: [
        { id: 'a1', from: 'A1', to: 'A2' },
        { id: 'a2', from: 'A2', to: 'A3' },
        { id: 'a3', from: 'A3', to: 'A4' },
        { id: 'a4', from: 'A4', to: 'A1' },
        { id: 'b1', from: 'B1', to: 'B2' },
        { id: 'b2', from: 'B2', to: 'B3' },
        { id: 'b3', from: 'B3', to: 'B4' },
        { id: 'b4', from: 'B4', to: 'B1' },
      ],
    };
    const result = layout(input, STABLE);

    expect(result.nodes).toHaveLength(8);

    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i]!;
        const b = result.nodes[j]!;
        expect(
          nodesOverlap(a, b),
          `nodes ${a.id} and ${b.id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  it('large graph (20 nodes, sequential edges) completes without error and returns 20 nodes', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      width: 60,
      height: 40,
    }));
    const edges = Array.from({ length: 19 }, (_, i) => ({
      id: `e${i}`,
      from: `n${i}`,
      to: `n${i + 1}`,
    }));
    const result = layout({ nodes, edges }, { K: 60, maxIter: 100, seed: 42 });
    expect(result.nodes).toHaveLength(20);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('layout without config uses default K, maxIter and seed values', () => {
    // Calling layout with no config exercises the ?? default branches for K, maxIter, seed
    const result = layout({
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
    });

    expect(result.nodes).toHaveLength(2);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('edge referencing unknown node is skipped in output', () => {
    // Exercises the src === undefined || dst === undefined branch
    const result = layout({
      nodes: [{ id: 'A', width: 60, height: 40 }],
      edges: [{ id: 'e1', from: 'A', to: 'UNKNOWN' }],
    }, STABLE);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});
