import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { agflatten, unflatten } from '../../../src/core/dot/fastgr.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, rank: number): DotNode {
  return { id, width: 80, height: 36, rank, order: 0, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(nodes: DotNode[], edges: DotEdge[]): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir: 'TB', nodeSep: 36, rankSep: 36 };
}

// ---------------------------------------------------------------------------
// agflatten — flat (same-rank) edges populate flatIn / flatOut
// ---------------------------------------------------------------------------

describe('agflatten', () => {
  it('populates flatOut and flatIn for a single flat edge', () => {
    // Both nodes on rank 0 — edge is flat.
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const e = makeEdge('e1', a, b);
    const g = makeGraph([a, b], [e]);

    agflatten(g);

    expect(a.flatOut).toEqual([e]);
    expect(b.flatIn).toEqual([e]);
  });

  it('does not populate flatOut/flatIn for a cross-rank edge', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1);
    const e = makeEdge('e1', a, b);
    const g = makeGraph([a, b], [e]);

    agflatten(g);

    // Cross-rank edge — flat arrays must remain undefined or empty.
    expect(a.flatOut ?? []).toHaveLength(0);
    expect(b.flatIn ?? []).toHaveLength(0);
  });

  it('handles a graph with N nodes and E edges: each node flatOut contains exactly its outgoing flat edges', () => {
    // Rank 0: A, B, C
    // Rank 1: D
    // Flat edges: A→B, B→C
    // Cross-rank edge: A→D
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 0);
    const d = makeNode('D', 1);
    const eAB = makeEdge('eAB', a, b);
    const eBC = makeEdge('eBC', b, c);
    const eAD = makeEdge('eAD', a, d);
    const g = makeGraph([a, b, c, d], [eAB, eBC, eAD]);

    agflatten(g);

    // A has one flat outgoing edge (A→B), not the cross-rank A→D.
    expect(a.flatOut).toEqual([eAB]);
    expect(a.flatIn ?? []).toHaveLength(0);

    // B has one flat outgoing edge (B→C) and one flat incoming (A→B).
    expect(b.flatOut).toEqual([eBC]);
    expect(b.flatIn).toEqual([eAB]);

    // C has no flat outgoing, one flat incoming (B→C).
    expect(c.flatOut ?? []).toHaveLength(0);
    expect(c.flatIn).toEqual([eBC]);

    // D: cross-rank edge does not affect flat arrays.
    expect(d.flatIn ?? []).toHaveLength(0);
    expect(d.flatOut ?? []).toHaveLength(0);
  });

  it('self-loop edge appears in both flatIn and flatOut of the same node', () => {
    const a = makeNode('A', 0);
    const selfLoop = makeEdge('loop', a, a);
    const g = makeGraph([a], [selfLoop]);

    agflatten(g);

    expect(a.flatOut).toEqual([selfLoop]);
    expect(a.flatIn).toEqual([selfLoop]);
  });

  it('multiple flat edges on the same node accumulate in order', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 0);
    const eAB = makeEdge('eAB', a, b);
    const eAC = makeEdge('eAC', a, c);
    const g = makeGraph([a, b, c], [eAB, eAC]);

    agflatten(g);

    expect(a.flatOut).toEqual([eAB, eAC]);
    expect(b.flatIn).toEqual([eAB]);
    expect(c.flatIn).toEqual([eAC]);
  });

  it('re-running agflatten after unflatten re-populates fresh arrays', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const e = makeEdge('e1', a, b);
    const g = makeGraph([a, b], [e]);

    agflatten(g);
    unflatten(g);
    agflatten(g);

    expect(a.flatOut).toEqual([e]);
    expect(b.flatIn).toEqual([e]);
  });

  it('graph with no flat edges leaves all nodes without flatIn/flatOut', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1);
    const c = makeNode('C', 2);
    const e1 = makeEdge('e1', a, b);
    const e2 = makeEdge('e2', b, c);
    const g = makeGraph([a, b, c], [e1, e2]);

    agflatten(g);

    for (const n of [a, b, c]) {
      expect(n.flatIn ?? []).toHaveLength(0);
      expect(n.flatOut ?? []).toHaveLength(0);
    }
  });

  it('longEdges flat edges are included when both endpoints share a rank', () => {
    // Virtual long-edge segments can be flat if two virtual nodes share a rank.
    const v0 = { ...makeNode('v0', 2), virtual: true };
    const v1 = { ...makeNode('v1', 2), virtual: true };
    const longFlat = makeEdge('lf', v0, v1);
    const g: DotWorkingGraph = {
      nodes: [v0, v1],
      edges: [],
      longEdges: [longFlat],
      rankDir: 'TB',
      nodeSep: 36,
      rankSep: 36,
    };

    agflatten(g);

    expect(v0.flatOut).toEqual([longFlat]);
    expect(v1.flatIn).toEqual([longFlat]);
  });
});

// ---------------------------------------------------------------------------
// unflatten — clears flatIn / flatOut on all nodes
// ---------------------------------------------------------------------------

describe('unflatten', () => {
  it('clears flatIn and flatOut after agflatten', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const e = makeEdge('e1', a, b);
    const g = makeGraph([a, b], [e]);

    agflatten(g);
    unflatten(g);

    expect(a.flatOut).toBeUndefined();
    expect(b.flatIn).toBeUndefined();
    expect(a.flatIn).toBeUndefined();
    expect(b.flatOut).toBeUndefined();
  });

  it('is a no-op on a graph that was never flattened', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1);
    const g = makeGraph([a, b], [makeEdge('e1', a, b)]);

    // Should not throw even though flatIn/flatOut are undefined.
    expect(() => unflatten(g)).not.toThrow();
    expect(a.flatIn).toBeUndefined();
    expect(a.flatOut).toBeUndefined();
  });

  it('clears flat arrays on every node, including those with no flat edges', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 1);
    const e1 = makeEdge('e1', a, b);  // flat
    const e2 = makeEdge('e2', b, c);  // cross-rank
    const g = makeGraph([a, b, c], [e1, e2]);

    agflatten(g);
    unflatten(g);

    for (const n of [a, b, c]) {
      expect(n.flatIn).toBeUndefined();
      expect(n.flatOut).toBeUndefined();
    }
  });
});
