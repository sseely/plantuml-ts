import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { assignRanks } from '../../../src/core/dot/rank.js';

function makeNode(id: string): DotNode {
  return { id, width: 80, height: 36, rank: -1, order: -1, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode, minLen = 1, weight = 1): DotEdge {
  return { id, from, to, weight, minLen, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

describe('assignRanks', () => {
  it('linear chain A→B→C gets ranks 0, 1, 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
    expect(b.rank).toBe(1);
    expect(c.rank).toBe(2);
  });

  it('two paths to same sink: sink rank exceeds both source ranks', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, c),
      makeEdge('e2', b, c),
    ]);

    assignRanks(graph);

    expect(c.rank).toBeGreaterThan(a.rank);
    expect(c.rank).toBeGreaterThan(b.rank);
  });

  it('edge with minLen=2 produces rank difference >= 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const graph = makeGraph([a, b], [
      makeEdge('e1', a, b, 2),
    ]);

    assignRanks(graph);

    expect(b.rank - a.rank).toBeGreaterThanOrEqual(2);
  });

  it('diamond A→B, A→C, B→D, C→D: rank(D) - rank(A) = 2', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const graph = makeGraph([a, b, c, d], [
      makeEdge('e1', a, b),
      makeEdge('e2', a, c),
      makeEdge('e3', b, d),
      makeEdge('e4', c, d),
    ]);

    assignRanks(graph);

    expect(d.rank - a.rank).toBe(2);
  });

  it('long edge spanning 2 ranks produces 1 virtual node at rank 1', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const longEdge = makeEdge('e_long', a, c);
    const graph = makeGraph([a, b, c], [
      makeEdge('e1', a, b),
      makeEdge('e2', b, c),
      longEdge,
    ]);

    assignRanks(graph);

    expect(a.rank).toBe(0);
    expect(c.rank).toBe(2);
    expect(longEdge.virtualNodes).toBeDefined();
    expect(longEdge.virtualNodes?.length).toBe(1);
    const vn = longEdge.virtualNodes?.[0];
    expect(vn?.rank).toBe(1);
    expect(vn?.virtual).toBe(true);
  });

  it('empty graph returns without error', () => {
    const graph = makeGraph([], []);
    expect(() => assignRanks(graph)).not.toThrow();
  });
});
