import { describe, it, expect } from 'vitest';
import type { DotNode, DotEdge, DotWorkingGraph } from '../../../src/core/dot/types.js';
import { sameport } from '../../../src/core/dot/sameport.js';
import type { DotEdgeWithPort } from '../../../src/core/dot/sameport.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  rank: number,
  x: number,
  y: number,
  w = 80,
  h = 36,
): DotNode {
  return { id, width: w, height: h, rank, order: 0, x, y, virtual: false };
}

function makeEdge(id: string, from: DotNode, to: DotNode): DotEdge {
  return { id, from, to, weight: 1, minLen: 1, reversed: false, points: [] };
}

function makeGraph(
  nodes: DotNode[],
  edges: DotEdge[],
  rankDir: DotWorkingGraph['rankDir'] = 'TB',
): DotWorkingGraph {
  return { nodes, edges, longEdges: [], rankDir, nodeSep: 36, rankSep: 36 };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 2: no shared ports → no modification
// ---------------------------------------------------------------------------

describe('sameport — no shared ports', () => {
  it('does not set portOffset when edges have no shared head or tail node', () => {
    // e1: a→c, e2: b→d — no node appears in both edges, so no shared port.
    const a = makeNode('a', 0, 0, 0);
    const b = makeNode('b', 0, 200, 0);
    const c = makeNode('c', 1, 0, 100);
    const d = makeNode('d', 1, 200, 100);
    const e1 = makeEdge('e1', a, c);
    const e2 = makeEdge('e2', b, d);
    const graph = makeGraph([a, b, c, d], [e1, e2]);

    sameport(graph);

    expect((e1 as DotEdgeWithPort).portOffset).toBeUndefined();
    expect((e2 as DotEdgeWithPort).portOffset).toBeUndefined();
  });

  it('does not set portOffset for a single edge entering a node', () => {
    const a = makeNode('a', 0, 0, 0);
    const b = makeNode('b', 1, 0, 100);
    const e1 = makeEdge('e1', a, b);
    const graph = makeGraph([a, b], [e1]);

    sameport(graph);

    expect((e1 as DotEdgeWithPort).portOffset).toBeUndefined();
  });

  it('does not set portOffset for self-loops', () => {
    const a = makeNode('a', 0, 0, 0);
    const e1 = makeEdge('e1', a, a);
    const graph = makeGraph([a], [e1]);

    sameport(graph);

    expect((e1 as DotEdgeWithPort).portOffset).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 1: shared head port → fan out
// ---------------------------------------------------------------------------

describe('sameport — shared head port (multiple edges entering same node)', () => {
  it('assigns non-zero portOffset to both edges when two edges share the same head node in TB layout', () => {
    // a and b are at rank 0, both pointing down into c at rank 1.
    // They approach c from similar directions (roughly straight down),
    // so they share the same head port cluster on c's top boundary.
    const a = makeNode('a', 0, 20, 0);
    const b = makeNode('b', 0, 60, 0);
    const c = makeNode('c', 1, 40, 100);
    const e1 = makeEdge('e1', a, c);
    const e2 = makeEdge('e2', b, c);
    const graph = makeGraph([a, b, c], [e1, e2]);

    sameport(graph);

    const o1 = (e1 as DotEdgeWithPort).portOffset ?? 0;
    const o2 = (e2 as DotEdgeWithPort).portOffset ?? 0;

    // Both edges must receive a portOffset
    expect(o1).not.toBe(0);
    expect(o2).not.toBe(0);

    // The two offsets must be different (spread apart, not stacked)
    expect(o1).not.toBeCloseTo(o2, 5);
  });

  it('assigns symmetric offsets: one positive, one negative', () => {
    const left = makeNode('left', 0, 0, 0);
    const right = makeNode('right', 0, 200, 0);
    const sink = makeNode('sink', 1, 100, 100);
    const e1 = makeEdge('e1', left, sink);
    const e2 = makeEdge('e2', right, sink);
    const graph = makeGraph([left, right, sink], [e1, e2]);

    sameport(graph);

    const o1 = (e1 as DotEdgeWithPort).portOffset ?? 0;
    const o2 = (e2 as DotEdgeWithPort).portOffset ?? 0;

    // Offsets must be equal in magnitude and opposite in sign
    expect(o1 + o2).toBeCloseTo(0, 5);
    expect(Math.abs(o1)).toBeGreaterThan(0);
  });

  it('fan-out scales with edge count — three edges produce three distinct offsets', () => {
    const a = makeNode('a', 0, 0, 0);
    const b = makeNode('b', 0, 100, 0);
    const c2 = makeNode('c2', 0, 200, 0);
    const sink = makeNode('sink', 1, 100, 100);
    const e1 = makeEdge('e1', a, sink);
    const e2 = makeEdge('e2', b, sink);
    const e3 = makeEdge('e3', c2, sink);
    const graph = makeGraph([a, b, c2, sink], [e1, e2, e3]);

    sameport(graph);

    const o1 = (e1 as DotEdgeWithPort).portOffset ?? 0;
    const o2 = (e2 as DotEdgeWithPort).portOffset ?? 0;
    const o3 = (e3 as DotEdgeWithPort).portOffset ?? 0;
    const offsets = [o1, o2, o3];

    // All three must be distinct
    expect(offsets[0]).not.toBeCloseTo(offsets[1]!, 5);
    expect(offsets[1]).not.toBeCloseTo(offsets[2]!, 5);
    expect(offsets[0]).not.toBeCloseTo(offsets[2]!, 5);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 1: shared tail port (multiple edges leaving same node)
// ---------------------------------------------------------------------------

describe('sameport — shared tail port (multiple edges leaving same node)', () => {
  it('assigns portOffset to edges sharing the same source node in TB layout', () => {
    const src = makeNode('src', 0, 50, 0);
    const a = makeNode('a', 1, 0, 100);
    const b = makeNode('b', 1, 100, 100);
    const e1 = makeEdge('e1', src, a);
    const e2 = makeEdge('e2', src, b);
    const graph = makeGraph([src, a, b], [e1, e2]);

    sameport(graph);

    const o1 = (e1 as DotEdgeWithPort).portOffset ?? 0;
    const o2 = (e2 as DotEdgeWithPort).portOffset ?? 0;

    expect(o1).not.toBeCloseTo(o2, 5);
  });
});

// ---------------------------------------------------------------------------
// portOffset values are within a reasonable range for node dimensions
// ---------------------------------------------------------------------------

describe('sameport — portOffset magnitude', () => {
  it('portOffset stays within half-width of the node for two edges', () => {
    const left = makeNode('left', 0, 0, 0, 80, 36);
    const right = makeNode('right', 0, 200, 0, 80, 36);
    const sink = makeNode('sink', 1, 100, 100, 80, 36);
    const e1 = makeEdge('e1', left, sink);
    const e2 = makeEdge('e2', right, sink);
    const graph = makeGraph([left, right, sink], [e1, e2]);

    sameport(graph);

    const halfW = sink.width / 2;
    const o1 = Math.abs((e1 as DotEdgeWithPort).portOffset ?? 0);
    const o2 = Math.abs((e2 as DotEdgeWithPort).portOffset ?? 0);
    expect(o1).toBeLessThanOrEqual(halfW + 1);
    expect(o2).toBeLessThanOrEqual(halfW + 1);
  });
});

// ---------------------------------------------------------------------------
// Virtual nodes are skipped
// ---------------------------------------------------------------------------

describe('sameport — virtual nodes', () => {
  it('does not group edges whose endpoints are virtual nodes', () => {
    const real = makeNode('real', 1, 100, 100);
    const virt1: DotNode = { ...makeNode('v1', 0, 0, 0), virtual: true };
    const virt2: DotNode = { ...makeNode('v2', 0, 200, 0), virtual: true };
    const e1 = makeEdge('e1', virt1, real);
    const e2 = makeEdge('e2', virt2, real);
    const graph = makeGraph([real, virt1, virt2], [e1, e2]);

    sameport(graph);

    expect((e1 as DotEdgeWithPort).portOffset).toBeUndefined();
    expect((e2 as DotEdgeWithPort).portOffset).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Degenerate input: nodes at identical positions (zero-distance guard)
// Exercises the `|| 1` fallback in hypot-normalisation (sameport.ts:97, :44).
// ---------------------------------------------------------------------------

describe('sameport — degenerate: nodes at identical centre position', () => {
  it('does not throw and assigns portOffset even when source nodes are at same position as sink', () => {
    // Both source nodes are placed at the exact same (x,y) as sink.
    // The direction vectors (other - u) collapse to (0,0), exercising the
    // zero-magnitude fallback path in applyFanout and ellipseBoundaryOffset.
    const sink = makeNode('sink', 1, 100, 100);
    const a = makeNode('a', 0, sink.x, sink.y); // same centre as sink
    const b = makeNode('b', 0, sink.x, sink.y); // same centre as sink
    const e1 = makeEdge('e1', a, sink);
    const e2 = makeEdge('e2', b, sink);
    const graph = makeGraph([sink, a, b], [e1, e2]);

    expect(() => sameport(graph)).not.toThrow();

    // portOffset must be set (grouping still fires) and the two offsets differ.
    const o1 = (e1 as DotEdgeWithPort).portOffset;
    const o2 = (e2 as DotEdgeWithPort).portOffset;
    expect(o1).toBeDefined();
    expect(o2).toBeDefined();
    expect(o1).not.toBeCloseTo(o2!, 5);
  });
});
