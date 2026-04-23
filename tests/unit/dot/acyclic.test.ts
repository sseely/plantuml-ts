import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { removeAcyclic } from '../../../src/core/dot/acyclic.js';

function makeNode(id: string): DotNode {
  return { id, width: 80, height: 36, rank: -1, order: -1, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

function isDAG(graph: DotWorkingGraph): boolean {
  const state = new Map<string, number>();
  function dfs(nodeId: string): boolean {
    state.set(nodeId, 1);
    for (const e of graph.edges) {
      if (e.from.id === nodeId) {
        const s = state.get(e.to.id) ?? 0;
        if (s === 1) return false;
        if (s === 0 && !dfs(e.to.id)) return false;
      }
    }
    state.set(nodeId, 2);
    return true;
  }
  for (const n of graph.nodes) {
    if ((state.get(n.id) ?? 0) === 0) {
      if (!dfs(n.id)) return false;
    }
  }
  return true;
}

describe('removeAcyclic', () => {
  it('given a graph with no cycles, all edges remain reversed=false', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    removeAcyclic(graph);

    expect(e1.reversed).toBe(false);
    expect(e2.reversed).toBe(false);
  });

  it('given cycle A→B→C→A, exactly 1 edge is reversed and the graph becomes a DAG', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const e3 = makeEdge('e3', c, a);
    const graph = makeGraph([a, b, c], [e1, e2, e3]);

    removeAcyclic(graph);

    const reversedCount = graph.edges.filter(e => e.reversed).length;
    expect(reversedCount).toBe(1);
    expect(isDAG(graph)).toBe(true);
  });

  it('given self-loop A→A, that edge is marked reversed=true', () => {
    const a = makeNode('A');
    const loop = makeEdge('loop', a, a);
    const graph = makeGraph([a], [loop]);

    removeAcyclic(graph);

    expect(loop.reversed).toBe(true);
  });

  it('given two separate cycles A→B→A and C→D→C, at least 1 edge is reversed per cycle', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const d = makeNode('D');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    const e3 = makeEdge('e3', c, d);
    const e4 = makeEdge('e4', d, c);
    const graph = makeGraph([a, b, c, d], [e1, e2, e3, e4]);

    removeAcyclic(graph);

    const abCycleReversed = [e1, e2].some(e => e.reversed);
    const cdCycleReversed = [e3, e4].some(e => e.reversed);
    expect(abCycleReversed).toBe(true);
    expect(cdCycleReversed).toBe(true);
    expect(isDAG(graph)).toBe(true);
  });

  it('given a reversed back edge, edge.reversed is true and from/to are swapped', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    const graph = makeGraph([a, b], [e1, e2]);

    removeAcyclic(graph);

    const reversedEdge = graph.edges.find(e => e.reversed);
    expect(reversedEdge).toBeDefined();
    if (reversedEdge !== undefined) {
      expect(reversedEdge.reversed).toBe(true);
      const originalFrom = reversedEdge.id === 'e1' ? 'A' : 'B';
      const originalTo = reversedEdge.id === 'e1' ? 'B' : 'A';
      expect(reversedEdge.from.id).toBe(originalTo);
      expect(reversedEdge.to.id).toBe(originalFrom);
    }
  });
});
