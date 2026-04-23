import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/fdp/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

const STABLE: NonNullable<Parameters<typeof layout>[1]> = {
  K: 80,
  maxIter: 600,
  seed: 42,
};

describe('fdp layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative x and y with positive width and height', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 40 }],
      edges: [],
    }, STABLE);
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0]!;
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.width).toBeGreaterThan(0);
    expect(node.height).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('6-node graph: no two bounding boxes overlap', () => {
    const input: DotInputGraph = {
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
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
        { id: 'e4', from: 'D', to: 'E' },
        { id: 'e5', from: 'E', to: 'F' },
        { id: 'e6', from: 'F', to: 'A' },
      ],
    };
    const result = layout(input, { K: 100, maxIter: 800, seed: 42 });
    const nodes = result.nodes;
    expect(nodes).toHaveLength(6);

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
    const r1 = layout(input, STABLE);
    const r2 = layout(input, STABLE);
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different layouts for K4', () => {
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
    const r1 = layout(k4, { K: 80, maxIter: 600, seed: 42 });
    const r2 = layout(k4, { K: 80, maxIter: 600, seed: 99 });

    const positionsEqual = r1.nodes.every((n1) => {
      const n2 = r2.nodes.find((n) => n.id === n1.id)!;
      return Math.abs(n1.x - n2.x) < 0.001 && Math.abs(n1.y - n2.y) < 0.001;
    });
    expect(positionsEqual).toBe(false);
  });

  it('path graph A→B→C→D: adjacent nodes are closer than non-adjacent (seed 42)', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'C', width: 60, height: 40 },
        { id: 'D', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
      ],
    };
    const result = layout(input, STABLE);
    const nm = new Map(result.nodes.map((n) => [n.id, n]));
    const A = nm.get('A')!;
    const B = nm.get('B')!;
    const D = nm.get('D')!;

    const distAB = Math.hypot(A.x - B.x, A.y - B.y);
    const distAD = Math.hypot(A.x - D.x, A.y - D.y);

    expect(distAB).toBeLessThan(distAD);
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

  it('edges referencing unknown node ids are skipped', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'GHOST' },
        { id: 'e3', from: 'MISSING', to: 'B' },
      ],
    };
    const result = layout(input, STABLE);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.id).toBe('e1');
  });

  it('isolated nodes are placed to the right of the connected cluster', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 60, height: 40 },
        { id: 'B', width: 60, height: 40 },
        { id: 'ISO1', width: 60, height: 40 },
        { id: 'ISO2', width: 60, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
      ],
    };
    const result = layout(input, STABLE);
    expect(result.nodes).toHaveLength(4);

    const nm = new Map(result.nodes.map((n) => [n.id, n]));
    const A = nm.get('A')!;
    const B = nm.get('B')!;
    const iso1 = nm.get('ISO1')!;
    const iso2 = nm.get('ISO2')!;

    // All positions non-negative
    for (const nd of result.nodes) {
      expect(nd.x).toBeGreaterThanOrEqual(0);
      expect(nd.y).toBeGreaterThanOrEqual(0);
    }

    // Isolated nodes should be to the right of both connected nodes
    const clusterMaxRight = Math.max(A.x + A.width / 2, B.x + B.width / 2);
    expect(iso1.x - iso1.width / 2).toBeGreaterThan(clusterMaxRight);
    expect(iso2.x - iso2.width / 2).toBeGreaterThan(clusterMaxRight);
  });
});
