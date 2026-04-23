import { describe, it, expect } from 'vitest';
import { layout } from '../../../src/core/dot/index.js';
import type { DotInputGraph } from '../../../src/core/dot/types.js';

describe('layout()', () => {
  it('empty graph returns zero dimensions and empty arrays', () => {
    const result = layout({ nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
  });

  it('single node is placed at non-negative coordinates', () => {
    const result = layout({
      nodes: [{ id: 'A', width: 80, height: 36 }],
      edges: [],
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(result.nodes[0]!.y).toBeGreaterThanOrEqual(0);
    expect(result.edges).toHaveLength(0);
  });

  it('linear chain A→B→C returns 3 nodes, 2 edges with >= 2 points each', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
    };

    const result = layout(input);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('two-node graph has positive width and height', () => {
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: 'e1', from: 'A', to: 'B' }],
    });

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('LR direction: nodes increase in x along the chain', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
      ],
      rankDir: 'LR',
    };

    const result = layout(input);

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    const a = byId.get('A')!;
    const b = byId.get('B')!;
    const c = byId.get('C')!;

    expect(b.x).toBeGreaterThan(a.x);
    expect(c.x).toBeGreaterThan(b.x);
  });

  it('edge id is preserved in the result', () => {
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
      ],
      edges: [{ id: 'myEdge', from: 'A', to: 'B' }],
    });

    expect(result.edges.some((e) => e.id === 'myEdge')).toBe(true);
  });

  it('long edge (rank span > 1) appears in result with >= 2 points', () => {
    // A → C with no B in between forces C to rank 1 and A to rank 0.
    // A → B → C makes B rank 1, C rank 2. A → C then spans 2 ranks.
    const result = layout({
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'B', to: 'C' },
        { id: 'e3', from: 'A', to: 'C' }, // spans 2 ranks
      ],
    });

    expect(result.edges).toHaveLength(3);
    const longEdge = result.edges.find((e) => e.id === 'e3')!;
    expect(longEdge).toBeDefined();
    expect(longEdge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('diamond layout has non-overlapping node bounding boxes', () => {
    const input: DotInputGraph = {
      nodes: [
        { id: 'A', width: 80, height: 36 },
        { id: 'B', width: 80, height: 36 },
        { id: 'C', width: 80, height: 36 },
        { id: 'D', width: 80, height: 36 },
      ],
      edges: [
        { id: 'e1', from: 'A', to: 'B' },
        { id: 'e2', from: 'A', to: 'C' },
        { id: 'e3', from: 'B', to: 'D' },
        { id: 'e4', from: 'C', to: 'D' },
      ],
    };

    const result = layout(input);

    expect(result.nodes).toHaveLength(4);

    for (let i = 0; i < result.nodes.length; i++) {
      for (let j = i + 1; j < result.nodes.length; j++) {
        const a = result.nodes[i]!;
        const b = result.nodes[j]!;
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(
          overlapX && overlapY,
          `nodes ${a.id} and ${b.id} overlap`,
        ).toBe(false);
      }
    }
  });
});
