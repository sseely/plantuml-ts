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
});
