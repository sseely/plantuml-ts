import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { concentrate } from '../../../src/core/dot/conc.js';

function makeNode(id: string): DotNode {
  return { id, width: 80, height: 36, rank: -1, order: -1, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

describe('concentrate', () => {
  it('given two parallel edges A→B, replaces them with A→C and C→B where C is virtual', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 1;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    concentrate(graph);

    const virtualNodes = graph.nodes.filter((n) => n.virtual);
    expect(virtualNodes).toHaveLength(1);
    const c = virtualNodes[0]!;

    const directAB = graph.edges.filter((e) => e.from === a && e.to === b);
    expect(directAB).toHaveLength(0);

    const toC = graph.edges.filter((e) => e.from === a && e.to === c);
    const fromC = graph.edges.filter((e) => e.from === c && e.to === b);
    expect(toC).toHaveLength(1);
    expect(fromC).toHaveLength(1);
  });

  it('given three parallel edges A→B, replaces all with one concentration node', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 1;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const e3 = makeEdge('e3', a, b);
    const graph = makeGraph([a, b], [e1, e2, e3]);

    concentrate(graph);

    const virtualNodes = graph.nodes.filter((n) => n.virtual);
    expect(virtualNodes).toHaveLength(1);
    const c = virtualNodes[0]!;

    const directAB = graph.edges.filter((e) => e.from === a && e.to === b);
    expect(directAB).toHaveLength(0);

    const toC = graph.edges.filter((e) => e.from === a && e.to === c);
    const fromC = graph.edges.filter((e) => e.from === c && e.to === b);
    expect(toC).toHaveLength(1);
    expect(fromC).toHaveLength(1);
  });

  it('given no parallel edges, graph is unchanged', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    a.rank = 0;
    b.rank = 1;
    c.rank = 1;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    const nodeCountBefore = graph.nodes.length;
    const edgeCountBefore = graph.edges.length;

    concentrate(graph);

    expect(graph.nodes).toHaveLength(nodeCountBefore);
    expect(graph.edges).toHaveLength(edgeCountBefore);
  });

  it('given a single edge A→B, graph is unchanged', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 1;
    const e1 = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e1]);

    concentrate(graph);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toBe(e1);
  });

  it('given two edges in different from/to pairs, graph is unchanged', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    a.rank = 0;
    b.rank = 1;
    c.rank = 2;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    concentrate(graph);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it('given two reversed parallel edges, replaces them with a concentration node', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 1;
    const e1 = makeEdge('e1', a, b);
    e1.reversed = true;
    const e2 = makeEdge('e2', a, b);
    e2.reversed = true;
    const graph = makeGraph([a, b], [e1, e2]);

    concentrate(graph);

    const virtualNodes = graph.nodes.filter((n) => n.virtual);
    expect(virtualNodes).toHaveLength(1);
  });

  it('concentration node gets a rank between from and to', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 2;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    concentrate(graph);

    const c = graph.nodes.find((n) => n.virtual)!;
    expect(c.rank).toBeGreaterThanOrEqual(a.rank);
    expect(c.rank).toBeLessThanOrEqual(b.rank);
  });

  it('concentrated edge weight equals sum of original edge weights', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 1;
    const e1 = makeEdge('e1', a, b);
    e1.weight = 2;
    const e2 = makeEdge('e2', a, b);
    e2.weight = 3;
    const graph = makeGraph([a, b], [e1, e2]);

    concentrate(graph);

    const c = graph.nodes.find((n) => n.virtual)!;
    const toC = graph.edges.find((e) => e.from === a && e.to === c)!;
    const fromC = graph.edges.find((e) => e.from === c && e.to === b)!;
    expect(toC.weight).toBe(5);
    expect(fromC.weight).toBe(5);
  });

  it('multiple independent parallel pairs each get their own concentration node', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    a.rank = 0;
    b.rank = 1;
    c.rank = 0;
    d.rank = 1;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const e3 = makeEdge('e3', c, d);
    const e4 = makeEdge('e4', c, d);
    const graph = makeGraph([a, b, c, d], [e1, e2, e3, e4]);

    concentrate(graph);

    const virtualNodes = graph.nodes.filter((n) => n.virtual);
    expect(virtualNodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(4);
  });

  it('parallel edges between same-rank nodes produce concentration node with minLen=1 on both sides', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    a.rank = 0;
    b.rank = 0;
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', a, b);
    const graph = makeGraph([a, b], [e1, e2]);

    concentrate(graph);

    const c = graph.nodes.find((n) => n.virtual)!;
    const toC = graph.edges.find((e) => e.from === a && e.to === c)!;
    const fromC = graph.edges.find((e) => e.from === c && e.to === b)!;
    expect(toC.minLen).toBe(1);
    expect(fromC.minLen).toBe(1);
  });
});
