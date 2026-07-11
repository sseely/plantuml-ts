/**
 * Iteration 10 (class-dot-sync, Group 4 — note-on-entity target/anchor
 * family). Three sub-mechanisms verified against the oracle svek DOT:
 *
 * (a) Same-side merge: multiple EXPLICIT `note <pos> of X[::member]`
 *     statements on the SAME side of the SAME host merge into ONE svek node
 *     (kugasi-68-josu446, sanusa-54-keda128, tenobo-24-liga464). A bare
 *     `note <pos>` (no `of` — falls back to lastEntity) never merges, even
 *     onto the same host+side as an explicit note (zepeki-75-pifo352).
 * (b) `Class::member` note targets anchor to the HOST classifier — the
 *     `::member` suffix must not leak into the edge endpoint as a phantom
 *     classifier (jiceke-84-xoze695, cejili-77-gepe377). Member-anchored
 *     notes route as an invisible layout-only edge; plain-classifier notes
 *     get a visible connector (dibinu-95-kavo178).
 * (c) `note top/bottom of <package>` routes to the package's `zaent-*`
 *     point anchor, registered as a cluster member alongside its classifiers
 *     (pecabi-95-demu756, sanixi-31-nofa193) — the same anchor mechanism
 *     `packageEndpointAnchors` already implements for relationship endpoints.
 *
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

const measurer = new FormulaMeasurer();

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

/** Capture the DotInputGraph built for `source` (pre-layout, clusters intact). */
function captureDotGraph(source: string): DotInputGraph {
  const ast = parse(source);
  let g: DotInputGraph | undefined;
  setLayoutInputObserver((x) => { g = x; });
  try {
    layoutClass(ast, defaultTheme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  return g!;
}

describe('(a) same-side note merge', () => {
  it('merges two explicit notes on the same side of the same host into one node', () => {
    const graph = captureDotGraph(
      ['class A', 'note right of A::foo', 'r1', 'end note', 'note right of A::bar', 'r2', 'end note'].join('\n'),
    );
    // A + ONE merged right-side note = 2 nodes, 1 connector edge.
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it('keeps notes on different sides of the same host as separate nodes', () => {
    const graph = captureDotGraph(
      ['class A', 'note right of A::foo', 'r1', 'end note', 'note left of A::bar', 'l1', 'end note'].join('\n'),
    );
    // A + right note + left note = 3 nodes, 2 connector edges.
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it('never merges a bare (implicit-target) note onto an explicit one, even same host+side (zepeki-75-pifo352)', () => {
    const graph = captureDotGraph(
      ['class A', 'note left', 'implicit', 'end note', 'note left of A::foo', 'explicit', 'end note'].join('\n'),
    );
    // A + implicit note + explicit note = 3 nodes (no merge), 2 edges.
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });
});

describe('(b) Class::member note targets', () => {
  it('anchors to the host classifier with no phantom sibling classifier', () => {
    const graph = captureDotGraph(
      ['class A', 'int counter', 'note left of A::counter', 'hi', 'end note'].join('\n'),
    );
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['A']));
    expect(ids.some((id) => id.includes('::'))).toBe(false);
    expect(graph.nodes).toHaveLength(2); // A + the note, nothing else
    const edge = graph.edges[0]!;
    expect([edge.from, edge.to]).toContain('A');
    expect([edge.from, edge.to].some((id) => id.includes('::'))).toBe(false);
  });

  it('routes a member-anchored note as an invisible layout-only edge', () => {
    const graph = captureDotGraph(
      ['class A', 'int counter', 'note left of A::counter', 'hi', 'end note'].join('\n'),
    );
    expect(graph.edges[0]!.attributes?.invis).toBe(true);
  });

  it('routes a plain-classifier note (no ::member) as a visible connector', () => {
    const graph = captureDotGraph(['class A', 'note left of A', 'hi', 'end note'].join('\n'));
    expect(graph.edges[0]!.attributes?.invis).toBeUndefined();
  });
});

describe('(c) note-of-package point anchor', () => {
  it('routes a note-of-package edge to the zaent point anchor inside the package cluster', () => {
    const graph = captureDotGraph(
      ['package p {', '  class cl1', '}', 'note top of p : bar'].join('\n'),
    );
    const cluster = graph.clusters?.find((c) => c.label === 'p');
    expect(cluster).toBeDefined();
    expect(cluster!.nodeIds).toContain('zaent-p');
    expect(cluster!.nodeIds).toContain('p.cl1');
    // The package itself never becomes a plain graph node.
    expect(graph.nodes.map((n) => n.id)).not.toContain('p');

    const edge = graph.edges.find((e) => e.from === 'zaent-p' || e.to === 'zaent-p');
    expect(edge).toBeDefined();
  });
});
