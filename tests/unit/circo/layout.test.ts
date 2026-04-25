import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/circo/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('circo layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative x and y with non-zero width/height', () => {
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

  it('K4: all 4 nodes have approximately the same distance from their centroid (±1px)', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
        { id: 'D', width: 40, height: 40 },
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
    const result = layout(input);
    expect(result.nodes).toHaveLength(4);

    const cx = result.nodes.reduce((s, n) => s + n.x, 0) / 4;
    const cy = result.nodes.reduce((s, n) => s + n.y, 0) / 4;

    const radii = result.nodes.map((n) => Math.hypot(n.x - cx, n.y - cy));
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(maxR - minR).toBeLessThanOrEqual(1);
  });

  it('5-node cycle A→B→C→D→E→A: no two bounding boxes overlap', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
        { id: 'D', width: 40, height: 40 },
        { id: 'E', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'D' },
        { id: 'e4', from: 'D', to: 'E' },
        { id: 'e5', from: 'E', to: 'A' },
      ],
    };
    const result = layout(input);
    const nodes = result.nodes;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const overlapX = (a.x - a.width / 2) < (b.x + b.width / 2) &&
                         (a.x + a.width / 2) > (b.x - b.width / 2);
        const overlapY = (a.y - a.height / 2) < (b.y + b.height / 2) &&
                         (a.y + a.height / 2) > (b.y - b.height / 2);
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} must not overlap`,
        ).toBe(false);
      }
    }
  });

  it('disconnected graph: triangle A↔B↔C and pair D↔E — all 5 nodes present; A,B,C at same radius from their centroid', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
        { id: 'D', width: 40, height: 40 },
        { id: 'E', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'A' },
        { id: 'e4', from: 'D', to: 'E' },
      ],
    };
    const result = layout(input);
    expect(result.nodes).toHaveLength(5);

    const ids = new Set(result.nodes.map((n) => n.id));
    for (const id of ['A', 'B', 'C', 'D', 'E']) {
      expect(ids.has(id), `node ${id} must be present`).toBe(true);
    }

    const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
    const triNodes = ['A', 'B', 'C'].map((id) => nodeMap.get(id)!);
    const cx = triNodes.reduce((s, n) => s + n.x, 0) / 3;
    const cy = triNodes.reduce((s, n) => s + n.y, 0) / 3;

    const radii = triNodes.map((n) => Math.hypot(n.x - cx, n.y - cy));
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(maxR - minR).toBeLessThanOrEqual(1);
  });

  it('3-node cycle: nodes are roughly 120° apart (±5°)', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 40, height: 40 },
        { id: 'B', width: 40, height: 40 },
        { id: 'C', width: 40, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'C', to: 'A' },
      ],
    };
    const result = layout(input);
    expect(result.nodes).toHaveLength(3);

    const cx = result.nodes.reduce((s, n) => s + n.x, 0) / 3;
    const cy = result.nodes.reduce((s, n) => s + n.y, 0) / 3;

    const unitVectors = result.nodes.map((n) => {
      const dx = n.x - cx;
      const dy = n.y - cy;
      const len = Math.hypot(dx, dy);
      return { x: dx / len, y: dy / len };
    });

    // dot product of unit vectors should be close to cos(120°) = -0.5
    const cos120 = Math.cos((2 * Math.PI) / 3);
    const tolerance = Math.cos(Math.PI / 36); // ~5° tolerance => cos(115°) ≈ -0.42

    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const dot = unitVectors[i]!.x * unitVectors[j]!.x + unitVectors[i]!.y * unitVectors[j]!.y;
        // dot should be near cos120 = -0.5; must be < cos(115°) ≈ -0.42
        expect(dot).toBeLessThan(tolerance);
        expect(dot).toBeGreaterThan(cos120 - 0.05);
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
    const result = layout(input);
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
});
