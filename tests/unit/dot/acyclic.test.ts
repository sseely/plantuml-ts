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

    // After merge: for A↔B, the back-edge merges into the forward edge,
    // leaving a single A→B edge. Similarly for C↔D. The graph is a DAG.
    expect(isDAG(graph)).toBe(true);

    // Each 2-node cycle should collapse to exactly one edge.
    const abEdges = graph.edges.filter(
      e => (e.from.id === 'A' && e.to.id === 'B') || (e.from.id === 'B' && e.to.id === 'A'),
    );
    expect(abEdges.length).toBe(1);
    const cdEdges = graph.edges.filter(
      e => (e.from.id === 'C' && e.to.id === 'D') || (e.from.id === 'D' && e.to.id === 'C'),
    );
    expect(cdEdges.length).toBe(1);
  });

  it('given a 3-cycle back edge with no existing opposing edge, reversed=true and from/to are swapped', () => {
    // Use A→B→C→A: when C→A is reversed to A→C, no A→C pre-exists,
    // so the edge is kept with reversed=true (virtual_edge path, no merge).
    const a = makeNode('A');
    const b = makeNode('B');
    const c = makeNode('C');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const e3 = makeEdge('e3', c, a);
    const graph = makeGraph([a, b, c], [e1, e2, e3]);

    removeAcyclic(graph);

    const reversedEdge = graph.edges.find(e => e.reversed);
    expect(reversedEdge).toBeDefined();
    if (reversedEdge !== undefined) {
      expect(reversedEdge.reversed).toBe(true);
      // The reversed edge must now point in the forward (DAG) direction.
      // Its original from/to are swapped: new from = original to.
      // We verify by checking it doesn't point back toward a visited ancestor.
      expect(isDAG(graph)).toBe(true);
    }
  });

  it('given A→B and B→A (multi-edge cycle), no duplicate edges after removal', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    // e1: A→B, e2: B→A — when e2 is reversed to A→B it duplicates e1
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    const graph = makeGraph([a, b], [e1, e2]);

    removeAcyclic(graph);

    // After acyclic removal the graph must be a DAG with no duplicates.
    expect(isDAG(graph)).toBe(true);

    // Count edges in each direction — no pair should appear more than once.
    const edgeKeys = graph.edges.map(e => `${e.from.id}->${e.to.id}`);
    const unique = new Set(edgeKeys);
    expect(edgeKeys.length).toBe(unique.size);
  });

  it('given A→B and B→A (multi-edge cycle), merged edge accumulates weight', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    e1.weight = 2;
    e2.weight = 3;
    const graph = makeGraph([a, b], [e1, e2]);

    removeAcyclic(graph);

    // The surviving A→B edge should carry the combined weight.
    const ab = graph.edges.find(e => e.from.id === 'A' && e.to.id === 'B');
    expect(ab).toBeDefined();
    if (ab !== undefined) {
      expect(ab.weight).toBe(5);
    }
    // No B→A edge should remain.
    const ba = graph.edges.find(e => e.from.id === 'B' && e.to.id === 'A');
    expect(ba).toBeUndefined();
  });
});
