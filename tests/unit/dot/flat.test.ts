import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge } from '../../../src/core/dot/types.js';
import {
  buildFlatAdj,
  flat_breakcycles,
  flat_reorder,
} from '../../../src/core/dot/flat.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, rank: number, order = -1): DotNode {
  return { id, width: 80, height: 36, rank, order, x: 0, y: 0, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

// ---------------------------------------------------------------------------
// buildFlatAdj
// ---------------------------------------------------------------------------

describe('buildFlatAdj', () => {
  it('ignores cross-rank edges', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 1); // different rank
    const edges = [makeEdge('ab', a, b)];

    const result = buildFlatAdj(edges);

    expect(result.size).toBe(0);
  });

  it('ignores self-loop edges', () => {
    const a = makeNode('A', 0);
    const edges = [makeEdge('aa', a, a)];

    const result = buildFlatAdj(edges);

    expect(result.size).toBe(0);
  });

  it('records a single flat edge A→B', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const edges = [makeEdge('ab', a, b)];

    const result = buildFlatAdj(edges);

    expect(result.size).toBe(1);
    const rankMap = result.get(0);
    expect(rankMap).toBeDefined();
    expect(rankMap!.get('A')).toEqual(['B']);
  });

  it('appends to existing list when source has multiple flat edges', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 0);
    const edges = [makeEdge('ab', a, b), makeEdge('ac', a, c)];

    const result = buildFlatAdj(edges);

    const rankMap = result.get(0);
    expect(rankMap!.get('A')).toEqual(['B', 'C']);
  });

  it('builds separate rank maps for edges on different ranks', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 1);
    const d = makeNode('D', 1);
    const edges = [makeEdge('ab', a, b), makeEdge('cd', c, d)];

    const result = buildFlatAdj(edges);

    expect(result.size).toBe(2);
    expect(result.get(0)!.get('A')).toEqual(['B']);
    expect(result.get(1)!.get('C')).toEqual(['D']);
  });

  it('handles empty edge list', () => {
    const result = buildFlatAdj([]);
    expect(result.size).toBe(0);
  });

  it('handles mix of flat and cross-rank edges', () => {
    const a = makeNode('A', 0);
    const b = makeNode('B', 0);
    const c = makeNode('C', 1); // cross-rank
    const edges = [makeEdge('ab', a, b), makeEdge('ac', a, c)];

    const result = buildFlatAdj(edges);

    expect(result.size).toBe(1);
    // Only the flat edge should be recorded
    expect(result.get(0)!.get('A')).toEqual(['B']);
  });
});

// ---------------------------------------------------------------------------
// flat_breakcycles
// ---------------------------------------------------------------------------

describe('flat_breakcycles', () => {
  it('returns empty FlatMatrix when no flat adjacency exists', () => {
    const a = makeNode('A', 0, 0);
    const layers = new Map([[0, [a]]]);
    const flatAdj = new Map<number, Map<string, string[]>>();

    const result = flat_breakcycles(layers, flatAdj);

    expect(result.size).toBe(0);
  });

  it('returns empty FlatMatrix when flatAdj exists but rank has no entry', () => {
    const a = makeNode('A', 0, 0);
    const layers = new Map([[0, [a]]]);
    // flatAdj has rank 1 entry, but the layer is at rank 0
    const flatAdj = new Map([[1, new Map([['X', ['Y']]])]]);

    const result = flat_breakcycles(layers, flatAdj);

    expect(result.size).toBe(0);
  });

  it('preserves direction of a simple A→B edge', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    const flatAdj = new Map([[0, new Map([['A', ['B']]])]]);

    const result = flat_breakcycles(layers, flatAdj);

    const rankConstraints = result.get(0)!;
    expect(rankConstraints.get('A')?.has('B')).toBe(true);
    expect(rankConstraints.get('B')?.has('A')).toBe(false);
  });

  it('breaks a two-node cycle A→B→A by reversing the back-edge', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    // A→B and B→A forms a cycle
    const flatAdj = new Map([[0, new Map([['A', ['B']], ['B', ['A']]])]]);

    const result = flat_breakcycles(layers, flatAdj);

    // Must not hang and must produce a valid DAG constraint
    expect(result.size).toBeGreaterThan(0);
    const rankConstraints = result.get(0)!;
    // One direction must be preserved and the other reversed; net result:
    // both cannot point at each other (that would be a cycle)
    const aToB = rankConstraints.get('A')?.has('B') ?? false;
    const bToA = rankConstraints.get('B')?.has('A') ?? false;
    // Exactly one direction should survive (the other was reversed back-edge)
    expect(aToB && bToA).toBe(false);
    expect(aToB || bToA).toBe(true);
  });

  it('breaks a three-node cycle A→B→C→A without hanging', () => {
    const a = makeNode('FA', 0, 0);
    const b = makeNode('FB', 0, 1);
    const c = makeNode('FC', 0, 2);
    const layers = new Map([[0, [a, b, c]]]);
    const flatAdj = new Map([
      [0, new Map([['FA', ['FB']], ['FB', ['FC']], ['FC', ['FA']]])],
    ]);

    const result = flat_breakcycles(layers, flatAdj);

    // All nodes must get constraint entries (no hang, all visited)
    const rankConstraints = result.get(0)!;
    expect(rankConstraints).toBeDefined();
    // The cycle must have been broken — no cycle in the resulting constraints
    // (simple transitivity check: FA→FB→FC should not also have FC→FA)
    const faFb = rankConstraints.get('FA')?.has('FB') ?? false;
    const fbFc = rankConstraints.get('FB')?.has('FC') ?? false;
    const fcFa = rankConstraints.get('FC')?.has('FA') ?? false;
    // At least one of the original edges must have been reversed
    expect(faFb && fbFc && fcFa).toBe(false);
  });

  it('handles a node that is not in any flat adj list (isolated in flat graph)', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const c = makeNode('C', 0, 2); // no flat edges involving C
    const layers = new Map([[0, [a, b, c]]]);
    const flatAdj = new Map([[0, new Map([['A', ['B']]])]]);

    const result = flat_breakcycles(layers, flatAdj);

    const rankConstraints = result.get(0)!;
    // A→B must be present; C has no constraints but must not cause an error
    expect(rankConstraints.get('A')?.has('B')).toBe(true);
  });

  it('skips edges to nodes not in the current rank layer', () => {
    // flatAdj has an edge A→X where X is not in the rank-0 layer
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    const flatAdj = new Map([[0, new Map([['A', ['X']]])]]);// X not in layer

    const result = flat_breakcycles(layers, flatAdj);

    // X is not in nodeSet so the edge is ignored in constraints
    const rankConstraints = result.get(0);
    // A has no valid flat edges to nodes in the layer
    if (rankConstraints) {
      expect(rankConstraints.get('A')?.has('X')).toBeFalsy();
    }
  });

  it('handles fromId not in nodeSet (flatAdj entry for foreign node)', () => {
    const a = makeNode('A', 0, 0);
    const layers = new Map([[0, [a]]]);
    // 'Z' is not in the layer
    const flatAdj = new Map([[0, new Map([['Z', ['A']]])]]);

    // Should not throw; Z is skipped in constraint population
    const result = flat_breakcycles(layers, flatAdj);

    const rankConstraints = result.get(0);
    if (rankConstraints) {
      // 'Z' is not in nodeSet so its edges are ignored
      expect(rankConstraints.get('Z')).toBeUndefined();
    }
  });

  it('handles multiple ranks independently', () => {
    const a0 = makeNode('A', 0, 0);
    const b0 = makeNode('B', 0, 1);
    const a1 = makeNode('C', 1, 0);
    const b1 = makeNode('D', 1, 1);
    const layers = new Map([[0, [a0, b0]], [1, [a1, b1]]]);
    const flatAdj = new Map([
      [0, new Map([['A', ['B']]])],
      [1, new Map([['C', ['D']]])],
    ]);

    const result = flat_breakcycles(layers, flatAdj);

    expect(result.get(0)!.get('A')?.has('B')).toBe(true);
    expect(result.get(1)!.get('C')?.has('D')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// flat_reorder
// ---------------------------------------------------------------------------

describe('flat_reorder', () => {
  it('is a no-op for ranks with no flat constraints', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    const flatMatrix = new Map<number, Map<string, Set<string>>>();

    flat_reorder(layers, flatMatrix);

    // Orders unchanged
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
  });

  it('is a no-op when rank constraint map is empty', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    // Rank 0 exists in flatMatrix but has no entries
    const flatMatrix = new Map([[0, new Map<string, Set<string>>()]]);

    flat_reorder(layers, flatMatrix);

    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
  });

  it('reorders two nodes so constrained predecessor comes first', () => {
    // B→A constraint means B should come before A (B is predecessor)
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const layers = new Map([[0, [a, b]]]);
    // B must appear before A (B→A flat constraint)
    const flatMatrix = new Map([
      [0, new Map([['B', new Set(['A'])], ['A', new Set<string>()]])],
    ]);

    flat_reorder(layers, flatMatrix);

    // B must have a lower order than A
    expect(b.order).toBeLessThan(a.order);
  });

  it('reorders a chain A→B→C into topological order', () => {
    // Initial order: C=0, B=1, A=2 (reversed from desired)
    const a = makeNode('A', 0, 2);
    const b = makeNode('B', 0, 1);
    const c = makeNode('C', 0, 0);
    const layers = new Map([[0, [c, b, a]]]);
    // A→B→C chain: A before B before C
    const flatMatrix = new Map([
      [0, new Map([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set<string>()],
      ])],
    ]);

    flat_reorder(layers, flatMatrix);

    expect(a.order).toBeLessThan(b.order);
    expect(b.order).toBeLessThan(c.order);
  });

  it('assigns distinct sequential order values 0..n-1', () => {
    const a = makeNode('A', 0, 5);
    const b = makeNode('B', 0, 3);
    const c = makeNode('C', 0, 1);
    const layers = new Map([[0, [a, b, c]]]);
    const flatMatrix = new Map([
      [0, new Map([
        ['A', new Set(['B'])],
        ['B', new Set(['C'])],
        ['C', new Set<string>()],
      ])],
    ]);

    flat_reorder(layers, flatMatrix);

    const orders = [a.order, b.order, c.order].sort((x, y) => x - y);
    expect(orders).toEqual([0, 1, 2]);
  });

  it('appends unconstrained nodes after constrained ones', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 0, 1);
    const z = makeNode('Z', 0, 2); // no flat edges involving Z
    const layers = new Map([[0, [a, b, z]]]);
    // A→B constraint; Z is unconstrained
    const flatMatrix = new Map([
      [0, new Map([
        ['A', new Set(['B'])],
        ['B', new Set<string>()],
      ])],
    ]);

    flat_reorder(layers, flatMatrix);

    // A before B, Z gets whatever slot is left
    expect(a.order).toBeLessThan(b.order);
    // All three must have valid, distinct orders
    expect(new Set([a.order, b.order, z.order]).size).toBe(3);
    expect([a.order, b.order, z.order].every((o) => o >= 0)).toBe(true);
  });

  it('processes multiple ranks independently', () => {
    const a = makeNode('A', 0, 1);
    const b = makeNode('B', 0, 0);
    const c = makeNode('C', 1, 1);
    const d = makeNode('D', 1, 0);
    const layers = new Map([[0, [b, a]], [1, [d, c]]]);
    // B→A at rank 0, D→C at rank 1
    const flatMatrix = new Map([
      [0, new Map([['B', new Set(['A'])], ['A', new Set<string>()]])],
      [1, new Map([['D', new Set(['C'])], ['C', new Set<string>()]])],
    ]);

    flat_reorder(layers, flatMatrix);

    expect(b.order).toBeLessThan(a.order);
    expect(d.order).toBeLessThan(c.order);
  });

  it('handles a single-node layer without error', () => {
    const a = makeNode('A', 0, 0);
    const layers = new Map([[0, [a]]]);
    const flatMatrix = new Map([
      [0, new Map([['A', new Set<string>()]])],
    ]);

    expect(() => flat_reorder(layers, flatMatrix)).not.toThrow();
    expect(a.order).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: buildFlatAdj → flat_breakcycles → flat_reorder
// ---------------------------------------------------------------------------

describe('flat pipeline integration', () => {
  it('end-to-end: flat edges A→B on same rank produce correct ordering', () => {
    const a = makeNode('A', 0, 1); // initially out of order
    const b = makeNode('B', 0, 0);
    const layers = new Map([[0, [b, a]]]);
    const edges: DotEdge[] = [makeEdge('ab', a, b)]; // A must be before B

    const flatAdj = buildFlatAdj(edges);
    const flatMatrix = flat_breakcycles(layers, flatAdj);
    flat_reorder(layers, flatMatrix);

    expect(a.order).toBeLessThan(b.order);
  });

  it('end-to-end: cycle A→B→C→A is broken and all nodes get valid orders', () => {
    const a = makeNode('FA', 0, 0);
    const b = makeNode('FB', 0, 1);
    const c = makeNode('FC', 0, 2);
    const layers = new Map([[0, [a, b, c]]]);
    const edges: DotEdge[] = [
      makeEdge('ab', a, b),
      makeEdge('bc', b, c),
      makeEdge('ca', c, a), // creates the cycle
    ];

    const flatAdj = buildFlatAdj(edges);
    const flatMatrix = flat_breakcycles(layers, flatAdj);
    flat_reorder(layers, flatMatrix);

    const orders = [a.order, b.order, c.order];
    expect(orders.every((o) => o >= 0)).toBe(true);
    expect(new Set(orders).size).toBe(3);
  });

  it('end-to-end: cross-rank edges are fully ignored by flat pipeline', () => {
    const a = makeNode('A', 0, 0);
    const b = makeNode('B', 1, 0); // different rank
    const layers = new Map([[0, [a]], [1, [b]]]);
    const edges: DotEdge[] = [makeEdge('ab', a, b)];

    const flatAdj = buildFlatAdj(edges);
    const flatMatrix = flat_breakcycles(layers, flatAdj);

    // No flat constraints built — matrix should be empty
    expect(flatMatrix.size).toBe(0);

    // flat_reorder is a no-op
    flat_reorder(layers, flatMatrix);

    expect(a.order).toBe(0);
    expect(b.order).toBe(0);
  });
});
