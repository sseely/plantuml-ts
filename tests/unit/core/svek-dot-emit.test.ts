import { describe, it, expect } from 'vitest';
import { toSvekDot } from '../../../src/core/svek-dot-emit.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

describe('toSvekDot — Svek-shaped DOT emission', () => {
  it('emits the digraph unix header and the standard graph attrs', () => {
    const dot = toSvekDot({ nodes: [{ id: 'a', width: 72, height: 36 }], edges: [] });
    expect(dot.startsWith('digraph unix {\n')).toBe(true);
    expect(dot).toContain('nodesep=0.486111;'); // 35px min ÷ 72
    expect(dot).toContain('ranksep=0.833333;'); // 60px min ÷ 72
    expect(dot).toContain('remincross=true;');
    expect(dot).toContain('searchsize=500;');
    expect(dot.trimEnd().endsWith('}')).toBe(true);
  });

  it('emits rankdir=LR only for LR graphs', () => {
    const lr = toSvekDot({ nodes: [], edges: [], rankDir: 'LR' });
    expect(lr).toContain('rankdir=LR;');
    const tb = toSvekDot({ nodes: [], edges: [], rankDir: 'TB' });
    expect(tb).not.toContain('rankdir');
  });

  it('emits rect nodes with empty label, inch sizes, and a color tag', () => {
    const dot = toSvekDot({ nodes: [{ id: 'a', width: 144, height: 72 }], edges: [] });
    expect(dot).toMatch(
      /sh\d{4} \[shape=rect,label="",width=2\.000000,height=1\.000000,color="#[0-9a-f]{6}"\];/,
    );
  });

  it('maps node shapes (rounded → rect+style=rounded; circle/diamond passthrough)', () => {
    const dot = toSvekDot({
      nodes: [
        { id: 'r', width: 10, height: 10, shape: 'rounded' },
        { id: 'c', width: 10, height: 10, shape: 'circle' },
        { id: 'd', width: 10, height: 10, shape: 'diamond' },
      ],
      edges: [],
    });
    expect(dot).toContain('shape=rect,style=rounded');
    expect(dot).toContain('shape=circle');
    expect(dot).toContain('shape=diamond');
  });

  it('emits edges with arrowtail/head=none and minlen', () => {
    const dot = toSvekDot({
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 10, height: 10 },
      ],
      edges: [{ id: 'e0', from: 'a', to: 'b', attributes: { minLen: 2 } }],
    });
    expect(dot).toMatch(/sh\d{4}->sh\d{4}\[arrowtail=none,arrowhead=none,minlen=2,color="#[0-9a-f]{6}"\];/);
  });

  it('emits HTML-TABLE edge labels and style=invis', () => {
    const dot = toSvekDot({
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 10, height: 10 },
      ],
      edges: [
        { id: 'e0', from: 'a', to: 'b', attributes: { label: 'x', labelWidth: 30, labelHeight: 17 } },
        { id: 'e1', from: 'a', to: 'b', attributes: { invis: true } },
      ],
    });
    expect(dot).toContain('label=<<TABLE BGCOLOR="#');
    expect(dot).toContain('FIXEDSIZE="TRUE" WIDTH="30" HEIGHT="17">');
    expect(dot).toContain('style=invis');
  });

  it('emits a cluster subgraph with title table and member nodes inside', () => {
    const g: DotInputGraph = {
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 10, height: 10 },
        { id: 'c', width: 10, height: 10 },
      ],
      edges: [],
      clusters: [{ id: 'cluster6', label: 'P', labelWidth: 55, labelHeight: 11, nodeIds: ['a', 'b'] }],
    };
    const dot = toSvekDot(g);
    expect(dot).toMatch(/subgraph cluster6 \{style=solid;color="#[0-9a-f]{6}";labeljust="c";label=<<TABLE/);
    // Members a,b live inside the cluster block; c stays at top level.
    const clusterBody = dot.slice(dot.indexOf('subgraph cluster6'), dot.indexOf('\n}\n}'));
    expect(clusterBody).toContain('width=0.138889'); // 10/72 — a member node line
  });

  it('emits rank constraint subgraphs', () => {
    const dot = toSvekDot({
      nodes: [
        { id: 'a', width: 10, height: 10, attributes: { rank: 'same' } },
        { id: 'b', width: 10, height: 10, attributes: { rank: 'same' } },
      ],
      edges: [],
    });
    expect(dot).toMatch(/\{rank=same; sh\d{4}; sh\d{4}\}/);
  });

  it('emits a plaintext-shielded node as a shape=plaintext HTML TABLE with a PORT="h" cell', () => {
    const dot = toSvekDot({
      nodes: [{ id: 'a', width: 40, height: 20, shape: 'plaintext' }],
      edges: [],
    });
    expect(dot).toContain('shape=plaintext,label=<<TABLE');
    expect(dot).toContain('CELLBORDER="0"');
    expect(dot).toMatch(/BGCOLOR="#[0-9a-f]{6}" FIXEDSIZE="TRUE" WIDTH="40" HEIGHT="20" PORT="h"/);
    expect(dot).not.toMatch(/\bwidth=[\d.]+,height=[\d.]+/); // no bare width=/height= attrs
  });

  it('routes edges to a plaintext node through its ":h" port (Bibliotekon.getNodeUid)', () => {
    const dot = toSvekDot({
      nodes: [
        { id: 'a', width: 10, height: 10 },
        { id: 'b', width: 20, height: 20, shape: 'plaintext' },
      ],
      edges: [{ id: 'e0', from: 'a', to: 'b', attributes: { minLen: 1 } }],
    });
    expect(dot).toMatch(/sh\d{4}->sh\d{4}:h\[arrowtail=none,arrowhead=none,minlen=1,/);
  });
});

// ===========================================================================
// ── PORT CLUSTERS — ClusterDotString port branch: rank groups INSIDE the
//    cluster ({rank=sink;shX;}), port nodes + bare constraint chains in the
//    outer cluster, clusterNee wrapping the title placeholder
// ===========================================================================

describe('toSvekDot — port cluster emission', () => {
  const portGraph = (): DotInputGraph => ({
    nodes: [
      {
        id: 'p1', width: 12, height: 12,
        shape: 'rect', isPort: true,
        attributes: { rank: 'sink' },
      },
      {
        id: 'anchor', width: 0.72, height: 0.72,
        shape: 'rect', titleLabelWidth: 70, titleLabelHeight: 16,
      },
    ],
    edges: [],
    clusters: [{
      id: 'cluster0',
      nodeIds: ['p1', 'anchor'],
      labelWidth: 70, labelHeight: 16,
      portRanks: [{ rank: 'sink', nodeIds: ['p1'] }],
      portAnchorId: 'anchor',
    }],
  });

  it('emits the rank group inside the cluster braces, svek format', () => {
    const dot = toSvekDot(portGraph());
    expect(dot).toMatch(/subgraph cluster0 \{style=solid;color="#[0-9a-f]+";labeljust="c";\{rank=sink;sh\d+;\}/);
  });

  it('wraps the placeholder in clusterNee and omits the cluster label attr', () => {
    const dot = toSvekDot(portGraph());
    expect(dot).toContain('subgraph cluster0ee {label="";');
    expect(dot).not.toMatch(/subgraph cluster0 \{[^\n]*label=</);
  });

  it('emits bare (bracket-less) port->anchor constraint chain', () => {
    const dot = toSvekDot(portGraph());
    expect(dot).toMatch(/sh\d+ \[arrowhead=none\];/);
    expect(dot).toMatch(/sh\d+->sh\d+;\n/);
  });

  it('does not duplicate port ranks at top level', () => {
    const dot = toSvekDot(portGraph());
    expect(dot).not.toMatch(/\{rank=sink; /);
  });
});

// ClusterDotString.java:148-149: `if (thereALinkFromOrToGroup2)
// sb.append(getSpecialPointId(group) + " [shape=point,width=.01,label=\"\"];")`
// runs UNCONDITIONALLY of hasPort() -- when a port cluster's anchor id is
// ALSO the target of a real edge (a note or link attached to the group
// itself, not one of its members), the oracle emits BOTH declarations for
// the same id: `shape=point` first, then the ee-placeholder's
// `shape=rect,...,label=<TABLE>` -- verified against gurive-62-ricu497 /
// repite-70-vabe533 oracle dumps. The comparator's `parseNodes` dedupes by
// first-seen id (tests/oracle/svek-dot.ts), so the FIRST line (`point`) is
// what the shape multiset actually asserts.
describe('toSvekDot — port cluster anchor also targeted by an outer edge', () => {
  const portGraphWithGroupEdge = (): DotInputGraph => ({
    nodes: [
      {
        id: 'p1', width: 12, height: 12,
        shape: 'rect', isPort: true,
        attributes: { rank: 'sink' },
      },
      {
        id: 'anchor', width: 0.72, height: 0.72,
        shape: 'rect', titleLabelWidth: 70, titleLabelHeight: 16,
        groupAnchorAlsoPoint: true,
      },
      { id: 'note', width: 100, height: 20 },
    ],
    edges: [{ id: 'e1', from: 'anchor', to: 'note' }],
    clusters: [{
      id: 'cluster0',
      nodeIds: ['p1', 'anchor'],
      labelWidth: 70, labelHeight: 16,
      portRanks: [{ rank: 'sink', nodeIds: ['p1'] }],
      portAnchorId: 'anchor',
    }],
  });

  it('emits the point pre-declaration before the ee-placeholder rect/table line', () => {
    const dot = toSvekDot(portGraphWithGroupEdge());
    const anchorSh = /(sh\d+) \[shape=rect,width=\.01,height=\.01,label=<<TABLE/.exec(dot)![1]!;
    const pointRe = new RegExp(`${anchorSh} \\[shape=point,width=\\.01,label=""\\];`);
    expect(dot).toMatch(pointRe);
    const pointIdx = dot.search(pointRe);
    const rectIdx = dot.indexOf(`${anchorSh} [shape=rect,width=.01,height=.01,label=<<TABLE`);
    expect(pointIdx).toBeGreaterThanOrEqual(0);
    expect(pointIdx).toBeLessThan(rectIdx);
  });

  it('does NOT emit the point pre-declaration when the anchor is not targeted by an outer edge', () => {
    const graph = portGraphWithGroupEdge();
    graph.edges = [];
    graph.nodes = graph.nodes.filter((n) => n.id !== 'note');
    const anchor = graph.nodes.find((n) => n.id === 'anchor')!;
    delete anchor.groupAnchorAlsoPoint;
    const dot = toSvekDot(graph);
    expect(dot).not.toMatch(/shape=point,width=\.01,label=""/);
  });
});
