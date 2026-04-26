import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/osage/index.js';
import { layout as dotLayout } from '../../../src/core/dot/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('osage layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node produces non-negative x and y with positive dimensions', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 40 }],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0]!.y).toBeGreaterThanOrEqual(0);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('two disconnected components: triangle A-B-C and singleton D all appear without bounding box overlap', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 80, height: 40 },
        { id: 'C', width: 80, height: 40 },
        { id: 'D', width: 80, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'A', to: 'C' },
      ],
    };

    const result = layout(input);
    expect(result.nodes).toHaveLength(4);

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.has('A')).toBe(true);
    expect(byId.has('B')).toBe(true);
    expect(byId.has('C')).toBe(true);
    expect(byId.has('D')).toBe(true);

    const triangleBounds = {
      minX: Math.min(...['A', 'B', 'C'].map((id) => byId.get(id)!.x)),
      maxX: Math.max(...['A', 'B', 'C'].map((id) => byId.get(id)!.x + byId.get(id)!.width)),
      minY: Math.min(...['A', 'B', 'C'].map((id) => byId.get(id)!.y)),
      maxY: Math.max(...['A', 'B', 'C'].map((id) => byId.get(id)!.y + byId.get(id)!.height)),
    };
    const dNode = byId.get('D')!;

    const overlapX = triangleBounds.minX < dNode.x + dNode.width && triangleBounds.maxX > dNode.x;
    const overlapY = triangleBounds.minY < dNode.y + dNode.height && triangleBounds.maxY > dNode.y;
    expect(overlapX && overlapY, 'triangle bounding box must not overlap singleton D').toBe(false);
  });

  it('three disconnected 3-node path components: all 9 nodes have non-overlapping bounding boxes', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A1', width: 80, height: 40 },
        { id: 'A2', width: 80, height: 40 },
        { id: 'A3', width: 80, height: 40 },
        { id: 'B1', width: 80, height: 40 },
        { id: 'B2', width: 80, height: 40 },
        { id: 'B3', width: 80, height: 40 },
        { id: 'C1', width: 80, height: 40 },
        { id: 'C2', width: 80, height: 40 },
        { id: 'C3', width: 80, height: 40 },
      ],
      edges: [
        { id: 'eA1', from: 'A1', to: 'A2' },
        { id: 'eA2', from: 'A2', to: 'A3' },
        { id: 'eB1', from: 'B1', to: 'B2' },
        { id: 'eB2', from: 'B2', to: 'B3' },
        { id: 'eC1', from: 'C1', to: 'C2' },
        { id: 'eC2', from: 'C2', to: 'C3' },
      ],
    };

    const result = layout(input);
    expect(result.nodes).toHaveLength(9);

    const nodes = result.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY, `nodes ${a.id} and ${b.id} must not overlap`).toBe(false);
      }
    }
  });

  it('intra-component edges have at least 2 points', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 80, height: 40 },
        { id: 'C', width: 80, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
    };

    const result = layout(input);
    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('cross-component edge has exactly 2 points', () => {
    // A and B are each in separate components (via X and Y respectively).
    // The cross edge A→B spans components and must get 2 straight-line waypoints.
    const inputWithCross: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'X', width: 80, height: 40 },
        { id: 'B', width: 80, height: 40 },
        { id: 'Y', width: 80, height: 40 },
      ],
      edges: [
        { id: 'intra1', from: 'A', to: 'X' },
        { id: 'intra2', from: 'B', to: 'Y' },
        { id: 'cross', from: 'A', to: 'B' },
      ],
    };

    const result = layout(inputWithCross);
    const crossEdge = result.edges.find((e) => e.id === 'cross');
    expect(crossEdge).toBeDefined();
    expect(crossEdge!.points).toHaveLength(2);
  });

  it('same input produces identical output on repeated calls', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 80, height: 40 },
        { id: 'C', width: 80, height: 40 },
        { id: 'D', width: 80, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'C', to: 'D' },
      ],
    };

    const r1 = layout(input);
    const r2 = layout(input);
    expect(r1).toEqual(r2);
  });

  it('single-component graph has same node and edge count as dot layout', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 40 },
        { id: 'B', width: 80, height: 40 },
        { id: 'C', width: 80, height: 40 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
    };

    const osageResult = layout(input);
    const directResult = dotLayout(input);

    expect(osageResult.nodes).toHaveLength(directResult.nodes.length);
    expect(osageResult.edges).toHaveLength(directResult.edges.length);
  });

  it('layout with explicit rankDir, nodeSep, rankSep passes them through to subgraphs', () => {
    // Exercises the ternary spread branches: input.rankDir !== undefined ? {...} : {}
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 30,
    }, { sep: 50 });

    expect(result.nodes).toHaveLength(2);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('edge referencing unknown node is skipped when building edge groups', () => {
    // Exercises the !parent.has(edge.from) || !parent.has(edge.to) continue branch
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 36 }],
      edges: [{ id: 'e1', from: 'A', to: 'UNKNOWN' }],
    });

    expect(result.nodes).toHaveLength(1);
    // The unknown-endpoint edge is skipped but graph is still laid out
    expect(result.width).toBeGreaterThan(0);
  });
});
