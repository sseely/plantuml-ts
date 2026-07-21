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

  // I9 (path/@d spline family, plans/g1-description-svg/ledger.md):
  // `description` (component/usecase) draws its own arrowheads client-side
  // (SvekEdge/extremity/*.ts) and the Svek-DOT emitter reflects that
  // faithfully — every emitted edge line carries `arrowtail=none,
  // arrowhead=none` (svek-dot-emit.ts), confirmed universal across the whole
  // cached-fixture corpus (zero counterexamples, 1196 `.dot` files spanning
  // component/usecase/class/object/state). Without telling graphviz-ts the
  // same thing on this seam via `manualArrowheads`, it silently defaults to
  // `arrowhead=normal` and reserves an arrow-length gap when clipping the
  // spline to the target node's boundary — shortening the routed edge by
  // roughly one arrow-length versus both real graphviz and the jar's own
  // layout. Pinned here as: with `manualArrowheads: true`, the routed
  // spline's endpoint must land within 1px of the target node's boundary
  // (real graphviz's own small clip epsilon — verified against `dot -Txdot`
  // directly on this exact geometry for component/katane-80-xeka153's cached
  // svek-1.dot); without it (the `class`/`state`/`dot`/`json` default —
  // those renderers draw their arrowhead via an SVG `marker-end` sitting at
  // the raw endpoint, and rely on graphviz's reservation to leave room for
  // it), the pre-existing ~10-11px-short behavior must be preserved exactly,
  // or every marker-based renderer's already-jar-independent, already-tested
  // output would silently shift.
  it('routes to within 1px of the boundary when manualArrowheads is set', () => {
    const r = layoutGraph({ ...g, manualArrowheads: true });
    const b = r.nodes.find((n) => n.id === 'b')!;
    const last = r.edges[0]!.points.at(-1)!;
    expect(b.y - last.y).toBeLessThan(1);
  });

  it('preserves the arrow-length gap by default (manualArrowheads absent)', () => {
    const r = layoutGraph(g);
    const b = r.nodes.find((n) => n.id === 'b')!;
    const last = r.edges[0]!.points.at(-1)!;
    expect(b.y - last.y).toBeGreaterThan(5);
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

// G5 C2: graphviz-ts 0.1.26072115 landed `clusters` in getLayout()'s
// snapshot (docs/graphviz-issues/06-cluster-bbox-not-in-getlayout.md,
// RESOLVED note). layoutGraph() must thread the real cluster bbox back to
// the caller, keyed by OUR OWN DotInputCluster.id (not graphviz-ts's
// internal `cluster0`/`cluster1` name) — the seam consumers (state
// composite pipeline, mechanism 16) never see graphviz-ts's naming scheme.
describe('layoutGraph — cluster geometry (G5 C2, mechanism 16)', () => {
  it('omits the clusters field when the input graph has no clusters', () => {
    const g: DotInputGraph = {
      nodes: [box('a'), box('b')],
      edges: [{ id: 'e0', from: 'a', to: 'b' }],
    };
    const r = layoutGraph(g);
    expect(r.clusters).toBeUndefined();
  });

  it('exposes a real bbox for one cluster, keyed by the input cluster id', () => {
    const g: DotInputGraph = {
      nodes: [box('a'), box('b')],
      edges: [{ id: 'e0', from: 'a', to: 'b' }],
      clusters: [{ id: 'grp1', nodeIds: ['a'] }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    expect(r.clusters).toHaveLength(1);
    const c = r.clusters![0]!;
    expect(c.id).toBe('grp1');
    expect(c.width).toBeGreaterThan(0);
    expect(c.height).toBeGreaterThan(0);
    // Cluster margins wrap node 'a' -- its bbox must strictly contain
    // (not merely touch) that node's own laid-out box.
    const a = r.nodes.find((n) => n.id === 'a')!;
    expect(c.x).toBeLessThan(a.x);
    expect(c.y).toBeLessThan(a.y);
    expect(c.x + c.width).toBeGreaterThan(a.x + a.width);
    expect(c.y + c.height).toBeGreaterThan(a.y + a.height);
  });

  it('exposes one entry per nested cluster, outer containing inner', () => {
    const g: DotInputGraph = {
      nodes: [box('a'), box('b'), box('c')],
      edges: [
        { id: 'e0', from: 'a', to: 'b' },
        { id: 'e1', from: 'b', to: 'c' },
      ],
      clusters: [
        { id: 'outer', nodeIds: [] },
        { id: 'inner', nodeIds: ['a', 'b'], parentId: 'outer' },
      ],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    expect(r.clusters).toHaveLength(2);
    const outer = r.clusters!.find((c) => c.id === 'outer')!;
    const inner = r.clusters!.find((c) => c.id === 'inner')!;
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(outer.x).toBeLessThanOrEqual(inner.x);
    expect(outer.y).toBeLessThanOrEqual(inner.y);
    expect(outer.x + outer.width).toBeGreaterThanOrEqual(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height);
  });

  it('rides the same origin-shift translation as nodes/edges, pinned exact', () => {
    // graphviz's own cluster margin (8pt each side, its documented default)
    // means the cluster box legitimately extends BEYOND the topmost/leftmost
    // member node -- shiftToOrigin() deliberately derives its translation
    // from nodes/edges alone (so pre-existing node/edge output stays
    // byte-identical for every caller that ignores `clusters`) and applies
    // that SAME translation to cluster boxes, which can therefore land at a
    // small negative x/y. Pinned to the exact deterministic values (not a
    // >=0 assumption, which does not hold for this real geometry) so a
    // future regression in either the shift-sharing wiring OR the
    // snapshot-to-id remapping fails loudly.
    const g: DotInputGraph = {
      nodes: [box('a'), box('b')],
      edges: [{ id: 'e0', from: 'a', to: 'b' }],
      clusters: [{ id: 'grp1', nodeIds: ['a', 'b'] }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const a = r.nodes.find((n) => n.id === 'a')!;
    const b = r.nodes.find((n) => n.id === 'b')!;
    expect(a).toEqual({ id: 'a', x: 0, y: 0, width: 72, height: 36 });
    expect(b).toEqual({ id: 'b', x: 0, y: 72, width: 72, height: 36 });
    const c = r.clusters![0]!;
    expect(c.x).toBeCloseTo(-8, 5);
    expect(c.y).toBeCloseTo(-8, 5);
    expect(c.width).toBeCloseTo(88, 5);
    expect(c.height).toBeCloseTo(124, 5);
  });
});

// G5 C3, mechanism 16 shape half: `titleTableWidth`/`titleTableHeight` feed
// graphviz-ts's `setHtmlAttr` (docs/graphviz-issues/07's RESOLVED note) via
// `addClusters`, so a cluster's own graphviz-reported bbox reflects jar's
// real HTML `<TABLE FIXEDSIZE="TRUE" ...>` title reservation instead of the
// prior plain-text `label` attr. Jar-calibrated numbers per the mission's own
// derivation (`graph-layout.types.ts`'s `titleTableHeight` doc comment): a
// FIXEDSIZE table HEIGHT=3 reserves exactly `nodeTop - clusterTop = 19` above
// the first content rank -- the CONTENT-WIDTH-INDEPENDENT single-line-title
// header gap G5 C3 confirmed on 132/134 real corpus cluster samples.
describe('layoutGraph — cluster title-table label (G5 C3, mechanism 16 shape half)', () => {
  it('reserves exactly HEIGHT+16 above the first content rank', () => {
    const g: DotInputGraph = {
      nodes: [box('a')],
      edges: [],
      clusters: [{ id: 'grp1', nodeIds: ['a'], titleTableWidth: 10, titleTableHeight: 3 }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const a = r.nodes.find((n) => n.id === 'a')!;
    const c = r.clusters!.find((cl) => cl.id === 'grp1')!;
    expect(a.y - c.y).toBeCloseTo(19, 5);
  });

  it('does not affect cluster width when content is already wider than the title', () => {
    const g: DotInputGraph = {
      nodes: [box('a')],
      edges: [],
      clusters: [{ id: 'grp1', nodeIds: ['a'], titleTableWidth: 5, titleTableHeight: 3 }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const c = r.clusters!.find((cl) => cl.id === 'grp1')!;
    // Same as the no-label default-margin case (72 + 8*2) -- the narrow
    // title does not force any extra width.
    expect(c.width).toBeCloseTo(88, 5);
  });

  it('forces cluster width wider when the title table is wider than content+margin', () => {
    const g: DotInputGraph = {
      nodes: [box('a')],
      edges: [],
      clusters: [{ id: 'grp1', nodeIds: ['a'], titleTableWidth: 200, titleTableHeight: 3 }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const c = r.clusters!.find((cl) => cl.id === 'grp1')!;
    expect(c.width).toBeGreaterThan(200);
  });

  it('a cluster with no titleTableWidth/Height falls back to the plain label attr (unchanged)', () => {
    const g: DotInputGraph = {
      nodes: [box('a')],
      edges: [],
      clusters: [{ id: 'grp1', nodeIds: ['a'], label: 'plain text title' }],
      rankDir: 'TB',
    };
    const r = layoutGraph(g);
    const a = r.nodes.find((n) => n.id === 'a')!;
    const c = r.clusters!.find((cl) => cl.id === 'grp1')!;
    // Plain-text label reservation is whatever graphviz's default label
    // sizing computes for that string -- distinctly NOT the jar-calibrated
    // 19px gap (regression guard: a future change must not silently start
    // treating every cluster as title-table-eligible).
    expect(a.y - c.y).not.toBeCloseTo(19, 5);
  });
});
