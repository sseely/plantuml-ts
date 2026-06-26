import { describe, it, expect } from 'vitest';
import { layoutGraph } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

// Box sizes in px; the adapter divides by 72 (inches) on the way into graphviz
// and getLayout returns points (= the original px), so widths round-trip.
const box = (id: string) => ({ id, width: 72, height: 36 });

describe('layoutGraph — empty graph', () => {
  it('returns an empty result without invoking the engine', () => {
    expect(layoutGraph({ nodes: [], edges: [] })).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    });
  });
});

describe('layoutGraph — node and edge geometry', () => {
  const g: DotInputGraph = {
    nodes: [box('a'), box('b')],
    edges: [{ id: 'e0', from: 'a', to: 'b' }],
    rankDir: 'TB',
  };

  it('lays out every node, round-tripping the measured size', () => {
    const r = layoutGraph(g);
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    for (const n of r.nodes) {
      expect(n.width).toBeCloseTo(72, 5);
      expect(n.height).toBeCloseTo(36, 5);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
    }
    // TB layout: a (source) sits above b (sink).
    const a = r.nodes.find((n) => n.id === 'a')!;
    const b = r.nodes.find((n) => n.id === 'b')!;
    expect(a.y).toBeLessThan(b.y);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it('re-keys the routed edge back to its input id with points', () => {
    const r = layoutGraph(g);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]!.id).toBe('e0');
    expect(r.edges[0]!.points.length).toBeGreaterThan(1);
  });
});

describe('layoutGraph — rank constraints', () => {
  it('places same-rank nodes on the same row', () => {
    const g: DotInputGraph = {
      nodes: [
        { ...box('a'), attributes: { rank: 'same' } },
        { ...box('b'), attributes: { rank: 'same' } },
        box('c'),
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'c' },
        { id: 'e1', from: 'b', to: 'c' },
      ],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const a = r.nodes.find((n) => n.id === 'a')!;
    const b = r.nodes.find((n) => n.id === 'b')!;
    const c = r.nodes.find((n) => n.id === 'c')!;
    expect(a.y).toBeCloseTo(b.y, 1); // same rank → same row
    expect(c.y).toBeGreaterThan(a.y); // c ranks below the a/b row
  });
});

describe('layoutGraph — edge labels', () => {
  it('echoes the caller label box and positions the label', () => {
    const g: DotInputGraph = {
      nodes: [box('a'), box('b')],
      edges: [
        {
          id: 'e0',
          from: 'a',
          to: 'b',
          attributes: { label: 'hi', labelWidth: 20, labelHeight: 12 },
        },
      ],
    };
    const e = layoutGraph(g).edges[0]!;
    expect(e.labelWidth).toBe(20);
    expect(e.labelHeight).toBe(12);
    expect(e.labelX).toBeGreaterThanOrEqual(0);
    expect(e.labelY).toBeGreaterThanOrEqual(0);
  });
});

describe('layoutGraph — defensive and option paths', () => {
  it('skips edges that reference an unknown node', () => {
    const r = layoutGraph({
      nodes: [box('a')],
      edges: [{ id: 'e0', from: 'a', to: 'ghost' }],
    });
    expect(r.edges).toEqual([]);
    expect(r.nodes).toHaveLength(1);
  });

  it('accepts an aspect hint and an explicit engine without error', () => {
    const g: DotInputGraph = {
      nodes: [box('a'), box('b')],
      edges: [{ id: 'e0', from: 'a', to: 'b' }],
      aspect: 1.5,
    };
    const r = layoutGraph(g, { engine: 'dot' });
    expect(r.nodes).toHaveLength(2);
  });
});
