/**
 * Iteration 3 (class-dot-sync): notes declared inside a `package {}` /
 * namespace block must land in that package's DOT cluster, same as any
 * classifier. Upstream has no separate mechanism for this — notes and
 * classifiers are both leaves created under `getCurrentGroup()` in the same
 * Quark tree (CucaDiagram.java:175-184 getCurrentGroup, :218-242
 * reallyCreateLeaf). Our port projects that onto `ClassNote.namespace` +
 * `Namespace.classifiers`, the same fields/collection `ensureClassifier` uses
 * for classifiers — `buildDotClusters` (class-dot-graph.ts) reads
 * `Namespace.classifiers` as the sole source of cluster membership, so a note
 * whose id isn't pushed there emits top-level regardless of source nesting.
 *
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:218-242 reallyCreateLeaf
 * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:197
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:329
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
function captureDotGraph(source: string): { ast: ReturnType<typeof parseClass>; graph: DotInputGraph } {
  const ast = parse(source);
  let g: DotInputGraph | undefined;
  setLayoutInputObserver((x) => { g = x; });
  try {
    layoutClass(ast, defaultTheme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  return { ast, graph: g! };
}

/** Find the cluster whose label matches `label`. */
function clusterByLabel(graph: DotInputGraph, label: string) {
  return graph.clusters?.find((c) => c.label === label);
}

describe('note-in-package cluster membership', () => {
  it('(a) freestanding `note as N` inside a package carries the namespace and lands in its cluster', () => {
    const { ast, graph } = captureDotGraph(
      ['package p {', '  class A', '  note as N', '  hi', '  end note', '}'].join('\n'),
    );
    const note = ast.notes.find((n) => n.id === 'N');
    expect(note).toMatchObject({ id: 'N', namespace: 'p' });

    const cluster = clusterByLabel(graph, 'p');
    expect(cluster).toBeDefined();
    expect(cluster!.nodeIds).toContain('N');
    // Classifier ids inside a package are namespace-qualified (`p.A`); the
    // note's DOT node id stays bare (`N`) — see class-dot-graph.ts.
    expect(cluster!.nodeIds).toContain('p.A');
  });

  it('(b) a note outside any package stays top-level (unchanged)', () => {
    const { ast, graph } = captureDotGraph(
      ['class A', 'note as N', 'hi', 'end note'].join('\n'),
    );
    const note = ast.notes.find((n) => n.id === 'N');
    expect(note?.namespace).toBeUndefined();
    // No cluster references N — the note node has no package membership.
    for (const cluster of graph.clusters ?? []) {
      expect(cluster.nodeIds).not.toContain('N');
    }
  });

  it('(c) a note in a nested inner package lands in the INNER cluster, not the outer one', () => {
    const { ast, graph } = captureDotGraph(
      [
        'package outer {',
        '  package inner {',
        '    class A',
        '    note as N',
        '    hi',
        '    end note',
        '  }',
        '}',
      ].join('\n'),
    );
    const note = ast.notes.find((n) => n.id === 'N');
    expect(note?.namespace).toBe('outer.inner');

    const innerCluster = clusterByLabel(graph, 'inner');
    const outerCluster = clusterByLabel(graph, 'outer');
    expect(innerCluster).toBeDefined();
    expect(outerCluster).toBeDefined();
    expect(innerCluster!.nodeIds).toContain('N');
    expect(outerCluster!.nodeIds).not.toContain('N');
  });

  it('(d) an attached `note left of A: x` inside a package lands in the SAME cluster as A', () => {
    const { ast, graph } = captureDotGraph(
      ['package p {', '  class A', '  note left of A: x', '}'].join('\n'),
    );
    const note = ast.notes[0];
    expect(note).toMatchObject({ target: 'A', position: 'left', text: 'x', namespace: 'p' });

    const cluster = clusterByLabel(graph, 'p');
    expect(cluster).toBeDefined();
    expect(cluster!.nodeIds).toContain('p.A');
    expect(cluster!.nodeIds).toContain(note!.id);
  });

  it('(d-multi) a multi-line attached note inside a package also joins the package cluster', () => {
    const { ast, graph } = captureDotGraph(
      ['package p {', '  class A', '  note left of A', '  hi', '  end note', '}'].join('\n'),
    );
    const note = ast.notes[0];
    expect(note).toMatchObject({ target: 'A', position: 'left', namespace: 'p' });

    const cluster = clusterByLabel(graph, 'p');
    expect(cluster!.nodeIds).toContain(note!.id);
  });
});
