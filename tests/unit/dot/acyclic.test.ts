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

  it('given two separate cycles A→B→A and C→D→C, both edges are kept and the graph is a DAG', () => {
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

    // No edges are removed — the back-edge is kept in place (reversed).
    // The graph has exactly 4 edges (2 per cycle pair).
    expect(graph.edges.length).toBe(4);
    expect(isDAG(graph)).toBe(true);

    // Each 2-node cycle pair produces exactly 1 reversed edge.
    const abReversed = graph.edges.filter(
      e => e.reversed && (
        (e.from.id === 'A' && e.to.id === 'B') ||
        (e.from.id === 'B' && e.to.id === 'A')
      ),
    );
    expect(abReversed.length).toBe(1);
    const cdReversed = graph.edges.filter(
      e => e.reversed && (
        (e.from.id === 'C' && e.to.id === 'D') ||
        (e.from.id === 'D' && e.to.id === 'C')
      ),
    );
    expect(cdReversed.length).toBe(1);
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

  it('given A→B and B→A (bidirectional pair), both edges are kept — one reversed, one not', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    // e1: A→B, e2: B→A — after acyclic removal e2 is reversed to A→B
    // and kept (no merge); both edges survive.
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    const graph = makeGraph([a, b], [e1, e2]);

    removeAcyclic(graph);

    // Both edges are preserved — the back-edge is not discarded.
    expect(graph.edges.length).toBe(2);
    expect(isDAG(graph)).toBe(true);

    // Exactly one edge carries reversed=true.
    const reversedCount = graph.edges.filter(e => e.reversed).length;
    expect(reversedCount).toBe(1);

    // The non-reversed edge is e1 (A→B untouched); the reversed edge
    // is e2 which was flipped from B→A to A→B.
    expect(e1.reversed).toBe(false);
    expect(e2.reversed).toBe(true);
    expect(e2.from.id).toBe('A');
    expect(e2.to.id).toBe('B');
  });

  it('given A→B and B→A (bidirectional pair), each edge retains its own weight', () => {
    const a = makeNode('A');
    const b = makeNode('B');
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, a);
    e1.weight = 2;
    e2.weight = 3;
    const graph = makeGraph([a, b], [e1, e2]);

    removeAcyclic(graph);

    // No weight accumulation — each edge retains its original weight.
    expect(e1.weight).toBe(2);
    expect(e2.weight).toBe(3);

    // The reversed edge (e2) is the back-edge, now pointing A→B.
    expect(e2.reversed).toBe(true);
    expect(e2.from.id).toBe('A');
    expect(e2.to.id).toBe('B');
  });
});
