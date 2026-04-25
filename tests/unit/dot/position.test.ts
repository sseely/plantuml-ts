import { describe, it, expect } from 'vitest';
import { assignCoordinates } from '../../../src/core/dot/position.js';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';

function makeNode(id: string, rank: number, order: number, w = 80, h = 36): DotNode {
  return { id, width: w, height: h, rank, order, x: 0, y: 0, virtual: false };
}

function makeGraph(nodes: DotNode[], rankDir: DotWorkingGraph['rankDir'] = 'TB'): DotWorkingGraph {
  return { nodes, edges: [] as DotEdge[], longEdges: [], rankDir, nodeSep: 20, rankSep: 40 };
}

function overlaps(a: DotNode, b: DotNode): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe('assignCoordinates', () => {
  it('no overlap same rank (TB): B.x >= A.x + A.width + nodeSep', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const graph = makeGraph([a, b]);
    assignCoordinates(graph);
    expect(!overlaps(a, b)).toBe(true);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width + 20);
  });

  it('rank separation (TB): B.y >= A.y + A.height + rankSep', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b]);
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + 40);
  });

  it('non-negative coordinates: single node has x >= 0 and y >= 0', () => {
    const node = makeNode('A', 0, 0);
    const graph = makeGraph([node]);
    assignCoordinates(graph);
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
  });

  it('LR direction — rank maps to x: higher rank => greater x', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'LR');
    assignCoordinates(graph);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('LR direction — order maps to y: higher order => greater y', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const graph = makeGraph([a, b], 'LR');
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('TB direction — rank maps to y: higher rank => greater y', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'TB');
    assignCoordinates(graph);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('diamond non-overlap: no bounding boxes overlap', () => {
    const root = makeNode('root', 0, 0);
    const left = makeNode('left', 1, 0);
    const right = makeNode('right', 1, 1);
    const bottom = makeNode('bottom', 2, 0);
    const graph = makeGraph([root, left, right, bottom]);
    assignCoordinates(graph);
    const nodes = [root, left, right, bottom];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(!overlaps(nodes[i]!, nodes[j]!)).toBe(true);
      }
    }
  });

  it('BT direction — higher rank => smaller y (rank 0 is at the bottom)', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'BT');
    assignCoordinates(graph);
    expect(a.y).toBeGreaterThan(b.y);
  });

  it('RL direction — higher rank => smaller x (rank 0 is at the right)', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0);
    const graph = makeGraph([a, b], 'RL');
    assignCoordinates(graph);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('empty graph: no error', () => {
    const graph = makeGraph([]);
    expect(() => assignCoordinates(graph)).not.toThrow();
  });
});
