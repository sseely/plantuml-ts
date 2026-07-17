/**
 * Unit tests for the class diagram layout engine.
 *
 * layoutClass is synchronous — no async setup required.
 */

import { describe, it, expect } from 'vitest';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';
import type { RelationshipType } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

const measurer = new FormulaMeasurer();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return true when two axis-aligned rectangles overlap. */
function overlaps(
  aX: number, aY: number, aW: number, aH: number,
  bX: number, bY: number, bW: number, bH: number,
): boolean {
  return (
    aX < bX + bW &&
    aX + aW > bX &&
    aY < bY + bH &&
    aY + aH > bY
  );
}

/** Build a minimal ClassDiagramAST with no relationships or namespaces. */
function makeAST(overrides?: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 6: empty AST
// ---------------------------------------------------------------------------

describe('layoutClass — empty AST', () => {
  it('resolves without error', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result).toBeDefined();
  });

  it('returns empty classifiers array', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.classifiers).toEqual([]);
  });

  it('returns empty edges array', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.edges).toEqual([]);
  });

  it('returns empty namespaces array', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.namespaces).toEqual([]);
  });

  it('totalWidth is 0', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.totalWidth).toBe(0);
  });

  it('totalHeight is 0', () => {
    const result = layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Graph-attribute parity (ADR-6): oracle svek emits nodesep=0.486111in (35px)
// and ranksep=0.833333in (60px). The class layout must feed those exact values
// so the emitted DOT's nodesep/ranksep match — this alone lifts ~471 fixtures
// past the nodesepOk gate.
// ---------------------------------------------------------------------------

describe('layoutClass — graph-attr parity (ADR-6)', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'extension' }],
  });

  it('feeds nodeSep=35 and rankSep=60 into the DOT input graph', () => {
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    expect(captured).toBeDefined();
    // 35/72 = 0.486111in, 60/72 = 0.833333in — the oracle svek defaults.
    expect(captured!.nodeSep).toBe(35);
    expect(captured!.rankSep).toBe(60);
  });
});

describe('layoutClass — edge label attributes (labelOk)', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
    ],
    relationships: [
      { from: 'A', to: 'B', type: 'association', label: 'uses', fromMultiplicity: '1', toMultiplicity: '0..*' },
    ],
  });

  it('emits label + tail/head label sizes from label and multiplicities', () => {
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    const attrs = captured!.edges[0]!.attributes!;
    expect(attrs.label).toBe('uses');
    expect(attrs.labelWidth).toBeGreaterThan(0);
    expect(attrs.tailLabelWidth).toBeGreaterThan(0); // fromMultiplicity '1'
    expect(attrs.headLabelWidth).toBeGreaterThan(0); // toMultiplicity '0..*'
  });
});

describe('layoutClass — qualifier/port nodes render as plaintext (shapeOk)', () => {
  function captureNodes(ast: ClassDiagramAST) {
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    return captured!.nodes;
  }

  it('a qualified-association target is a plaintext shield (not a port)', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'A', to: 'B', type: 'association', toQualifier: 'Q' }],
    });
    const b = captureNodes(ast).find((n) => n.id === 'B');
    expect(b?.shape).toBe('plaintext');
    expect(b?.isPort).toBeUndefined();
  });

  it('a ::member port target is a plaintext port node', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'A', to: 'B', type: 'association', toPort: 'm' }],
    });
    const b = captureNodes(ast).find((n) => n.id === 'B');
    expect(b?.shape).toBe('plaintext');
    expect(b?.isPort).toBe(true);
  });

  it('a plain classifier stays rect (shape unset)', () => {
    // second classifier keeps the diagram off the T5 degenerate path
    // (isDegeneratedWithFewEntities(1) skips DOT for a lone leaf)
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'Other', display: 'Other', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [],
    });
    expect(captureNodes(ast).find((n) => n.id === 'A')?.shape).toBeUndefined();
  });

  it('an association classifier (<> name) renders as a diamond', () => {
    // second classifier keeps the diagram off the T5 degenerate path
    const ast = makeAST({
      classifiers: [
        { id: 'd', display: 'd', kind: 'association', typeParams: [], members: [] },
        { id: 'Other', display: 'Other', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [],
    });
    expect(captureNodes(ast).find((n) => n.id === 'd')?.shape).toBe('diamond');
  });
});

describe('layoutClass — package used as a relationship endpoint (zaent anchor)', () => {
  // package P { class C } ; P --> X  →  no P node; a point anchor in P's cluster;
  // the edge routes P→anchor.
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      { id: 'P', display: 'P', kind: 'class', typeParams: [], members: [] },
      { id: 'C', display: 'C', kind: 'class', typeParams: [], members: [], namespace: 'P' },
      { id: 'X', display: 'X', kind: 'class', typeParams: [], members: [] },
    ],
    namespaces: [{ id: 'P', display: 'P', classifiers: ['C'] }],
    relationships: [{ from: 'P', to: 'X', type: 'association' }],
  });

  function capture() {
    let g: DotInputGraph | undefined;
    setLayoutInputObserver((x) => { g = x; });
    try { layoutClass(ast, defaultTheme, measurer); } finally { setLayoutInputObserver(undefined); }
    return g!;
  }

  it('suppresses the package node and adds a point anchor routed by the edge', () => {
    const g = capture();
    expect(g.nodes.find((n) => n.id === 'P')).toBeUndefined();
    const anchor = g.nodes.find((n) => n.shape === 'point');
    expect(anchor).toBeDefined();
    // the P--X edge now starts at the anchor, not P
    const edge = g.edges.find((e) => e.to === 'X');
    expect(edge?.from).toBe(anchor!.id);
    // the anchor is a member of P's cluster
    expect(g.clusters?.[0]?.nodeIds).toContain(anchor!.id);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 1: 3 classes with 2 relationships — all geo positive
// ---------------------------------------------------------------------------

describe('layoutClass — 3 classes with 2 relationships', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      {
        id: 'Animal',
        display: 'Animal',
        kind: 'class',
        typeParams: [],
        members: [
          { visibility: '+', name: 'name', type: 'String', isStatic: false, isAbstract: false },
        ],
      },
      {
        id: 'Dog',
        display: 'Dog',
        kind: 'class',
        typeParams: [],
        members: [],
      },
      {
        id: 'Cat',
        display: 'Cat',
        kind: 'class',
        typeParams: [],
        members: [],
      },
    ],
    relationships: [
      { from: 'Dog', to: 'Animal', type: 'extension' },
      { from: 'Cat', to: 'Animal', type: 'extension' },
    ],
  });

  it('all ClassifierGeo entries have positive width', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers).toHaveLength(3);
    for (const geo of result.classifiers) {
      expect(geo.width).toBeGreaterThan(0);
    }
  });

  it('all ClassifierGeo entries have positive height', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    for (const geo of result.classifiers) {
      expect(geo.height).toBeGreaterThan(0);
    }
  });

  it('returns 2 EdgeGeo entries', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(2);
  });

  it('totalWidth is positive', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight is positive', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 2: two unrelated classes do not overlap
// ---------------------------------------------------------------------------

describe('layoutClass — two unrelated classes do not overlap', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      {
        id: 'Foo',
        display: 'Foo',
        kind: 'class',
        typeParams: [],
        members: [],
      },
      {
        id: 'Bar',
        display: 'Bar',
        kind: 'class',
        typeParams: [],
        members: [],
      },
    ],
  });

  it('bounding boxes do not intersect', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers).toHaveLength(2);
    const a = result.classifiers[0]!;
    const b = result.classifiers[1]!;
    expect(overlaps(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 3: class with 5 members — height > 5 × memberRowHeight
// ---------------------------------------------------------------------------

describe('layoutClass — class with 5 members', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      {
        id: 'Rich',
        display: 'Rich',
        kind: 'class',
        typeParams: [],
        members: [
          { visibility: '+', name: 'a', type: 'int', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'b', type: 'int', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'c', type: 'int', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'd', type: 'int', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'e', type: 'int', isStatic: false, isAbstract: false },
        ],
      },
    ],
  });

  it('height is greater than 5 × memberRowHeight', () => {
    const memberRowHeight = defaultTheme.fontSize * 1.4;
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers).toHaveLength(1);
    expect(result.classifiers[0]!.height).toBeGreaterThan(5 * memberRowHeight);
  });

  it('rows array has 6 entries (1 header + 5 members)', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 4: namespace containing 2 classes — NamespaceGeo encompasses children
// ---------------------------------------------------------------------------

describe('layoutClass — namespace containing 2 classes', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      {
        id: 'Alpha',
        display: 'Alpha',
        kind: 'class',
        typeParams: [],
        members: [],
        namespace: 'NS',
      },
      {
        id: 'Beta',
        display: 'Beta',
        kind: 'class',
        typeParams: [],
        members: [],
        namespace: 'NS',
      },
    ],
    namespaces: [
      { id: 'NS', display: 'MyNamespace', classifiers: ['Alpha', 'Beta'] },
    ],
  });

  it('returns 1 NamespaceGeo', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.namespaces).toHaveLength(1);
  });

  it('NamespaceGeo has positive dimensions', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    const ns = result.namespaces[0]!;
    expect(ns.width).toBeGreaterThan(0);
    expect(ns.height).toBeGreaterThan(0);
  });

  it('NamespaceGeo label matches display name', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.namespaces[0]!.label).toBe('MyNamespace');
  });

  it('both ClassifierGeo positions are inside NamespaceGeo bounds', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    const ns = result.namespaces[0]!;
    expect(result.classifiers).toHaveLength(2);

    for (const cls of result.classifiers) {
      // Absolute positions — classifier must fit within namespace box
      expect(cls.x).toBeGreaterThanOrEqual(ns.x);
      expect(cls.y).toBeGreaterThanOrEqual(ns.y);
      expect(cls.x + cls.width).toBeLessThanOrEqual(ns.x + ns.width + 1); // 1px tolerance
      expect(cls.y + cls.height).toBeLessThanOrEqual(ns.y + ns.height + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// B1: package/namespace clusters — DotInputGraph.clusters (clusterOk parity)
// ---------------------------------------------------------------------------

describe('layoutClass — DotInputGraph.clusters (B1)', () => {
  it('emits no clusters field when the AST has no namespaces', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'Solo', display: 'Solo', kind: 'class', typeParams: [], members: [] },
        // second classifier keeps the diagram off the T5 degenerate path
        { id: 'Duo', display: 'Duo', kind: 'class', typeParams: [], members: [] },
      ],
    });
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    expect(captured!.clusters).toBeUndefined();
  });

  it('emits one DotInputCluster per namespace, with the namespace member ids', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'Alpha', display: 'Alpha', kind: 'class', typeParams: [], members: [], namespace: 'NS' },
        { id: 'Beta', display: 'Beta', kind: 'class', typeParams: [], members: [], namespace: 'NS' },
        { id: 'Gamma', display: 'Gamma', kind: 'class', typeParams: [], members: [] },
      ],
      namespaces: [
        { id: 'NS', display: 'MyNamespace', classifiers: ['Alpha', 'Beta'] },
      ],
    });
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    expect(captured!.clusters).toHaveLength(1);
    const cluster = captured!.clusters![0]!;
    expect(cluster.nodeIds).toEqual(['Alpha', 'Beta']);
    expect(cluster.label).toBe('MyNamespace');
  });

  it('assigns each cluster id matching /^cluster[0-9]+$/ (the oracle comparator parseClusters regex — not ns.id verbatim)', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'Alpha', display: 'Alpha', kind: 'class', typeParams: [], members: [], namespace: 'p1' },
        { id: 'Beta', display: 'Beta', kind: 'class', typeParams: [], members: [], namespace: 'p2' },
      ],
      namespaces: [
        { id: 'p1', display: 'p1', classifiers: ['Alpha'] },
        { id: 'p2', display: 'p2', classifiers: ['Beta'] },
      ],
    });
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    expect(captured!.clusters).toHaveLength(2);
    for (const cluster of captured!.clusters!) {
      expect(cluster.id).toMatch(/^cluster\d+$/);
    }
    // ids must be distinct (one per namespace) — no accidental collision.
    const ids = captured!.clusters!.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('does not add or remove structural nodes when clusters are populated', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'Alpha', display: 'Alpha', kind: 'class', typeParams: [], members: [], namespace: 'NS' },
        { id: 'Beta', display: 'Beta', kind: 'class', typeParams: [], members: [] },
      ],
      namespaces: [
        { id: 'NS', display: 'NS', classifiers: ['Alpha'] },
      ],
    });
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, defaultTheme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }
    // Same node set as the classifier list — clusters group existing nodes,
    // they never introduce anchor/placeholder nodes for class diagrams.
    expect(captured!.nodes.map((n) => n.id).sort()).toEqual(['Alpha', 'Beta']);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 5: extension edge decoration
// ---------------------------------------------------------------------------

describe('layoutClass — Foo <|-- Bar (extension relationship)', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      { id: 'Foo', display: 'Foo', kind: 'class', typeParams: [], members: [] },
      { id: 'Bar', display: 'Bar', kind: 'class', typeParams: [], members: [] },
    ],
    relationships: [{ from: 'Bar', to: 'Foo', type: 'extension' }],
  });

  it('targetDecor is "triangle"', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.targetDecor).toBe('triangle');
  });

  it('sourceDecor is "none"', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('none');
  });

  it('dashed is false', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges[0]!.dashed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge decoration — all relationship types
// ---------------------------------------------------------------------------

describe('layoutClass — edge decoration per relationship type', () => {
  function makeRelAST(type: RelationshipType): ClassDiagramAST {
    return makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'A', to: 'B', type }],
    });
  }

  it('implementation: targetDecor=triangle, dashed=true', () => {
    const result = layoutClass(makeRelAST('implementation'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('triangle');
    expect(result.edges[0]!.dashed).toBe(true);
  });

  it('composition: sourceDecor=filledDiamond, dashed=false', () => {
    const result = layoutClass(makeRelAST('composition'), defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('filledDiamond');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('aggregation: sourceDecor=diamond, dashed=false', () => {
    const result = layoutClass(makeRelAST('aggregation'), defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('diamond');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('dependency: targetDecor=open, dashed=true', () => {
    const result = layoutClass(makeRelAST('dependency'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('open');
    expect(result.edges[0]!.dashed).toBe(true);
  });

  it('association: targetDecor=open, dashed=false', () => {
    const result = layoutClass(makeRelAST('association'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('open');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('usage: targetDecor=none, sourceDecor=none, dashed=true', () => {
    const result = layoutClass(makeRelAST('usage'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('none');
    expect(result.edges[0]!.sourceDecor).toBe('none');
    expect(result.edges[0]!.dashed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// G2 N8: per-relationship `dashed` override + `invis` edge suppression
// ---------------------------------------------------------------------------

describe('layoutClass — Relationship.dashed override (G2 N8)', () => {
  it('an explicit `dashed: true` override wins over the type-derived ' +
    '(association -> dashed=false) default', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'A', to: 'B', type: 'association', dashed: true }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges[0]!.dashed).toBe(true);
  });

  it('an explicit `dashed: false` override wins over the type-derived ' +
    '(usage -> dashed=true) default', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'A', to: 'B', type: 'usage', dashed: false }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges[0]!.dashed).toBe(false);
  });
});

describe('layoutClass — invis relationship suppression (G2 N8)', () => {
  it('an `invis: true` relationship produces NO EdgeGeo at all (jar never ' +
    'draws it, SvekEdge#drawU/#solveLine both early-return)', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
        { id: 'C', display: 'C', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [
        { from: 'A', to: 'B', type: 'association' },
        { from: 'B', to: 'C', type: 'association', invis: true },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.from).toBe('A');
    expect(result.edges[0]!.to).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Classifier kind — geo.kind and header italic
// ---------------------------------------------------------------------------

describe('layoutClass — classifier kind field and header italic', () => {
  it('interface classifier has kind="interface" on ClassifierGeo', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'IRepo', display: 'Repo', kind: 'interface', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.kind).toBe('interface');
  });

  it('interface header row text is just the display name (no «interface» prefix)', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'IRepo', display: 'Repo', kind: 'interface', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toBe('Repo');
  });

  it('interface header row has italic=true', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'IRepo', display: 'Repo', kind: 'interface', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.italic).toBe(true);
  });

  it('abstract classifier has kind="abstract" on ClassifierGeo', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'AbstractBase', display: 'Base', kind: 'abstract', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.kind).toBe('abstract');
  });

  it('abstract header row has italic=true', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'AbstractBase', display: 'Base', kind: 'abstract', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.italic).toBe(true);
  });

  it('class header row does not have italic set', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Foo', display: 'Foo', kind: 'class', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.italic).toBeFalsy();
  });

  it('enum classifier has kind="enum" on ClassifierGeo', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Color', display: 'Color', kind: 'enum', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.kind).toBe('enum');
  });

  it('annotation classifier has @ prefix in row text', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Override', display: 'Override', kind: 'annotation', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toContain('@Override');
  });
});

// ---------------------------------------------------------------------------
// Member rows — visibilityIcon
// ---------------------------------------------------------------------------

describe('layoutClass — member row visibilityIcon', () => {
  it('member rows carry visibilityIcon matching the member visibility (explicit char)', () => {
    // G2 N4: jar draws NO visibility icon for a member with no explicit
    // leading visibility character (`jobuco-44-zife032`'s bare "Bar" field)
    // -- `visibilityExplicit: true` is what `buildSectionRows` now gates
    // icon-reservation on, mirroring `class-object-map-sizing.ts`'s
    // existing object-leaf gate (`plans/g2-class-svg/ledger.md` N4).
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'pub', type: 'int', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '-', name: 'priv', type: 'int', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '#', name: 'prot', type: 'int', isStatic: false, isAbstract: false, visibilityExplicit: true },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[1]!.visibilityIcon).toBe('+');
    expect(result.classifiers[0]!.rows[2]!.visibilityIcon).toBe('-');
    expect(result.classifiers[0]!.rows[3]!.visibilityIcon).toBe('#');
  });

  it('member row has NO visibilityIcon when the source carried no explicit char', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'implicit', type: 'int', isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[1]!.visibilityIcon).toBeUndefined();
  });

  it('header row does not have a visibilityIcon', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'C', display: 'C', kind: 'class', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.visibilityIcon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Icon-zone reservation is per-SECTION, not per-ROW (G2 N14)
// ---------------------------------------------------------------------------

describe('layoutClass — member row icon-zone reservation is per-SECTION (G2 N14)', () => {
  // upstream: MethodsOrFieldsArea#hasSmallIcon (cucadiagram/
  // MethodsOrFieldsArea.java:125-138) scans the WHOLE compartment (fields OR
  // methods) for any member with an explicit visibility char -- the icon
  // column (getCircledCharacterRadius()+3 = 14, PlacementStrategyVisibility's
  // fixed `col2`) is then reserved for EVERY row in that section uniformly,
  // not just the rows that individually carry an icon. `getUBlock(null, url)`
  // (a modifier-less row) still occupies the reserved column, just draws
  // nothing in it. Jar-verified against `canuti-20-jotu614` (every row
  // explicit, width = maxRowWidth + 14 + 12 exactly) and `ducoka-05-
  // cuce457`'s "Test Two" (zero rows explicit, width = maxRowWidth + 12, NO
  // icon reserve at all -- the previous code added an unconditional +18
  // regardless of any row's visibilityExplicit, an 18px-too-wide bug).

  it('a section with NO explicit-visibility rows reserves NO icon column (width)', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          hideCircle: true,
          members: [
            { visibility: '+', name: 'symmetric', isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const fontSpec = { family: defaultTheme.fontFamily, size: defaultTheme.fontSize };
    const textWidth = measurer.measure('symmetric', fontSpec).width;
    // memberAreaWidth = textWidth + 0 (no icon reserve) + 12 (6px margin each side)
    expect(result.classifiers[0]!.width).toBeCloseTo(textWidth + 12, 4);
  });

  it('a section with ONE explicit-visibility row reserves the icon column for EVERY row in it (width)', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          hideCircle: true,
          members: [
            { visibility: '+', name: 'longestone', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '+', name: 'plain', isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const fontSpec = { family: defaultTheme.fontFamily, size: defaultTheme.fontSize };
    const textWidth = measurer.measure('longestone', fontSpec).width;
    // memberAreaWidth = maxRowTextWidth + 14 (icon reserve, once) + 12 (margin)
    expect(result.classifiers[0]!.width).toBeCloseTo(textWidth + 14 + 12, 4);
  });

  it('a non-explicit row in a mixed section still gets the widened (icon-reserving) indent', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          hideCircle: true,
          members: [
            { visibility: '+', name: 'marked', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '+', name: 'unmarked', isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const rows = result.classifiers[0]!.rows;
    // rows[0] is the header; rows[1]/rows[2] are the two field members.
    expect(rows[1]!.indent).toBe(20); // marked: ROW_TEXT_LEFT_MARGIN(6) + ROW_ICON_ZONE_WIDTH(14)
    expect(rows[2]!.indent).toBe(20); // unmarked, but SAME section -- same reserved indent
    expect(rows[2]!.visibilityIcon).toBeUndefined(); // no glyph drawn for the unmarked row
  });

  it('fields and methods compartments are independent (icon in fields does not widen methods)', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'C',
          display: 'C',
          kind: 'class',
          typeParams: [],
          hideCircle: true,
          members: [
            { visibility: '+', name: 'x', isStatic: false, isAbstract: false, visibilityExplicit: true },
            { visibility: '+', name: 'runlonger', params: [], isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const rows = result.classifiers[0]!.rows;
    // rows[0]=header, rows[1]=field 'x' (its own section has an icon -> wide
    // indent), rows[2]=method 'runlonger()' (its own section has NO icon).
    expect(rows[1]!.indent).toBe(20);
    expect(rows[2]!.indent).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Divider and row structure
// ---------------------------------------------------------------------------

describe('layoutClass — dividerYs structure', () => {
  it('a classifier with members has at least one divider', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'MyClass',
          display: 'MyClass',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'x', type: 'int', isStatic: false, isAbstract: false },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs.length).toBeGreaterThanOrEqual(1);
  });

  it('header divider y is greater than 0', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'MyClass',
          display: 'MyClass',
          kind: 'class',
          typeParams: [],
          members: [],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const dividerYs = result.classifiers[0]!.dividerYs;
    expect(dividerYs.length).toBeGreaterThanOrEqual(1);
    expect(dividerYs[0]!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Method member formatting (formatMemberText — params branch)
// ---------------------------------------------------------------------------

describe('layoutClass — method member formatting', () => {
  it('method member row text contains "()" marker', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Service',
          display: 'Service',
          kind: 'class',
          typeParams: [],
          members: [
            {
              visibility: '+',
              name: 'execute',
              type: 'void',
              params: [],
              isStatic: false,
              isAbstract: false,
            },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const memberRow = result.classifiers[0]!.rows[1]!;
    expect(memberRow.text).toContain('()');
  });

  it('member without type renders with NO type suffix at all (G2 N4)', () => {
    // jar-verified (`jobuco-44-zife032`'s bare "Bar" field): a member with
    // no `: Type` in the source renders with no trailing colon either --
    // was unconditional `: ${type ?? ''}` (always at least a bare colon),
    // corrected to omit the suffix entirely when `type` is `undefined`.
    const ast = makeAST({
      classifiers: [
        {
          id: 'Plain',
          display: 'Plain',
          kind: 'class',
          typeParams: [],
          members: [
            {
              visibility: '-',
              name: 'value',
              // type intentionally omitted
              isStatic: false,
              isAbstract: false,
              visibilityExplicit: true, // G2 N4: required for visibilityIcon to be set
            },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const memberRow = result.classifiers[0]!.rows[1]!;
    // Visibility symbol no longer in text — stored as visibilityIcon instead
    expect(memberRow.text).toBe('value');
    expect(memberRow.visibilityIcon).toBe('-');
  });

  it('G2 N12: rawDisplay member renders verbatim, bucketed as a field', () => {
    // Java-style "Type name" syntax (class-member-parser.ts's raw-display
    // fallback) -- jar-verified (`cuxuni-25-doxi736`): "+String a1" renders
    // as the literal text "String a1" and sits in the FIELDS compartment
    // (no parens -- BodierLikeClassOrObject#isMethod is false).
    const ast = makeAST({
      classifiers: [
        {
          id: 'Dummy',
          display: 'Dummy',
          kind: 'class',
          typeParams: [],
          members: [
            {
              visibility: '+',
              name: 'String a1',
              rawDisplay: 'String a1',
              isStatic: false,
              isAbstract: false,
              visibilityExplicit: true,
            },
            {
              visibility: '+',
              name: 'greet',
              params: [],
              isStatic: false,
              isAbstract: false,
              visibilityExplicit: true,
            },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const rowTexts = result.classifiers[0]!.rows.map((r) => r.text);
    expect(rowTexts).toContain('String a1');
    // Exactly one divider precedes the method row when the field precedes
    // it in draw order -- confirms the raw-display member landed in the
    // FIELDS section, not METHODS (a "Type name" with no parens is a field).
    const fieldRowIndex = rowTexts.indexOf('String a1');
    const methodRowIndex = rowTexts.indexOf('greet()');
    expect(fieldRowIndex).toBeGreaterThan(-1);
    expect(methodRowIndex).toBeGreaterThan(fieldRowIndex);
  });

  it('method with params renders all parameter names in row text', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Svc',
          display: 'Svc',
          kind: 'class',
          typeParams: [],
          members: [
            {
              visibility: '+',
              name: 'move',
              type: 'void',
              params: ['dx: double', 'dy: double'],
              isStatic: false,
              isAbstract: false,
            },
          ],
        },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    const memberRow = result.classifiers[0]!.rows[1]!;
    expect(memberRow.text).toContain('move(dx: double, dy: double)');
  });
});

// ---------------------------------------------------------------------------
// Edge label passthrough
// ---------------------------------------------------------------------------

describe('layoutClass — edge with label', () => {
  it('EdgeGeo.label.text matches the relationship label', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'X', display: 'X', kind: 'class', typeParams: [], members: [] },
        { id: 'Y', display: 'Y', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'X', to: 'Y', type: 'association', label: 'uses' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(1);
    // verify text is set
    expect(result.edges[0]!.label?.text).toBe('uses');
  });
});

// ---------------------------------------------------------------------------
// Node minimum width
// ---------------------------------------------------------------------------

describe('layoutClass — minimum node width', () => {
  // G2 N3: `EntityImageClass.calculateDimensionSlow` has NO 100px floor
  // upstream (`PName.MinimumWidth`/`getParamSameClassWidth()` both default
  // 0) -- the pre-fix flat `Math.max(100, ...)` clamp was a made-up
  // divergence, not a ported behavior; width is now the badge+name box
  // formula (`class-badge.ts`'s doc comment), which for a single letter
  // with a badge is well under 100px.
  it('a single-character class is NOT floored to 100px (matches upstream: no MinimumWidth default)', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      ],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.width).toBeLessThan(100);
    expect(result.classifiers[0]!.width).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Layout direction — parent ranks above child for extension/implementation
// ---------------------------------------------------------------------------

describe('layoutClass — extension layout direction', () => {
  const ast: ClassDiagramAST = makeAST({
    classifiers: [
      { id: 'Animal', display: 'Animal', kind: 'class', typeParams: [], members: [] },
      { id: 'Dog',    display: 'Dog',    kind: 'class', typeParams: [], members: [] },
    ],
    relationships: [{ from: 'Dog', to: 'Animal', type: 'extension' }],
  });

  it('parent (Animal) has a smaller y than child (Dog)', () => {
    const result = layoutClass(ast, defaultTheme, measurer);
    const animal = result.classifiers.find((c) => c.id === 'Animal')!;
    const dog    = result.classifiers.find((c) => c.id === 'Dog')!;
    expect(animal.y).toBeLessThan(dog.y);
  });
});

// ---------------------------------------------------------------------------
// Hide/show directives — layout effects
// ---------------------------------------------------------------------------

describe('layoutClass — hide/show directives', () => {
  it('hide members: dividerYs is empty when all members are hidden', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'x', type: 'int', isStatic: false, isAbstract: false, hidden: true },
          ],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'members' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs).toHaveLength(0);
  });

  it('hide members: classifier box height is smaller than with visible members', () => {
    const memberSpec = {
      visibility: '+' as const,
      name: 'x',
      type: 'int',
      isStatic: false,
      isAbstract: false,
    };
    const astWithMembers = makeAST({
      classifiers: [{ id: 'Foo', display: 'Foo', kind: 'class', typeParams: [], members: [memberSpec] }],
      directives: [],
    });
    const astHideMembers = makeAST({
      classifiers: [{ id: 'Foo', display: 'Foo', kind: 'class', typeParams: [], members: [{ ...memberSpec, hidden: true }] }],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'members' }],
    });
    const heightWith = layoutClass(astWithMembers, defaultTheme, measurer).classifiers[0]!.height;
    const heightHidden = layoutClass(astHideMembers, defaultTheme, measurer).classifiers[0]!.height;
    expect(heightHidden).toBeLessThan(heightWith);
  });

  it('hide empty members: dividerYs is empty when classifier has no members', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Empty', display: 'Empty', kind: 'class', typeParams: [], members: [] },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty members' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs).toHaveLength(0);
  });

  it('hide empty members: dividerYs has ONE divider when the classifier has fields but no methods', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [{ visibility: '+', name: 'x', type: 'int', isStatic: false, isAbstract: false }],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty members' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    // G2 N10 (corrects an unverified N3-era claim): `hide empty members`
    // expands to a PER-COMPARTMENT hide (CommandHideShowByGender.java:
    // 267-279's `emptyMembers` special case) -- `x` (no params) is a field,
    // so the fields compartment stays fully drawn (its own divider), while
    // the EMPTY methods compartment is suppressed entirely (no divider, no
    // height). Jar-verified: `mezucu-18-lozi106` (`hide empty members` +
    // `class A { b }`) draws exactly ONE `<line>` divider.
    expect(result.classifiers[0]!.dividerYs).toHaveLength(1);
  });

  it('hide empty members: dividerYs has ONE divider when the classifier has methods but no fields', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [{ visibility: '+', name: 'run', params: [], isStatic: false, isAbstract: false }],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty members' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    // Symmetric case: fields empty (suppressed), methods non-empty (kept).
    expect(result.classifiers[0]!.dividerYs).toHaveLength(1);
  });

  it('hide empty fields: suppresses only the fields compartment, methods unaffected', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [{ visibility: '+', name: 'run', params: [], isStatic: false, isAbstract: false }],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty fields' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs).toHaveLength(1);
  });

  it('hide empty methods: suppresses only the methods compartment, fields unaffected', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [{ visibility: '+', name: 'x', type: 'int', isStatic: false, isAbstract: false }],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty methods' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs).toHaveLength(1);
  });

  it('hide empty fields: does NOT suppress an already-populated fields compartment', () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Foo',
          display: 'Foo',
          kind: 'class',
          typeParams: [],
          members: [
            { visibility: '+', name: 'x', type: 'int', isStatic: false, isAbstract: false },
            { visibility: '+', name: 'run', params: [], isStatic: false, isAbstract: false },
          ],
        },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'empty fields' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    // Neither compartment is empty — both stay, both dividers drawn.
    expect(result.classifiers[0]!.dividerYs).toHaveLength(2);
  });

  it('no directives: dividerYs has two entries for an empty class (empty fields + empty methods compartments)', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Empty', display: 'Empty', kind: 'class', typeParams: [], members: [] },
      ],
      directives: [],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    // G2 N3: upstream always draws BOTH compartments (fields, methods) by
    // default, even when both are empty -- see the divider comment above.
    expect(result.classifiers[0]!.dividerYs).toHaveLength(2);
  });

  it('hide circle: hideCircle is propagated to ClassifierGeo', () => {
    const ast = makeAST({
      classifiers: [
        { id: 'Foo', display: 'Foo', kind: 'class', typeParams: [], members: [], hideCircle: true },
      ],
      directives: [{ kind: 'hideshow', action: 'hide', target: 'circle' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.hideCircle).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notes-on-entity: laid out as a node + connector
// ---------------------------------------------------------------------------

describe('layoutClass — note on entity', () => {
  it('produces a NoteGeo with text lines, resolved via the general opalisable mechanism (G2/N14)', () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      ],
      notes: [{ id: '__note_0', target: 'A', position: 'right', text: 'hi\nthere' }],
    });
    const result = layoutClass(ast, defaultTheme, measurer);
    expect(result.notes).toHaveLength(1);
    const note = result.notes[0]!;
    expect(note.id).toBe('__note_0');
    expect(note.lines).toEqual(['hi', 'there']);
    expect(note.width).toBeGreaterThan(0);
    expect(note.height).toBeGreaterThan(0);
    // G2/N14: a single connection to a non-note entity resolves via the
    // general opalisable mechanism (EntityImageNote.java's opaleLine
    // branch) -- merged into `opale`, not a separate `connector` line (see
    // plans/g2-class-svg/ledger.md N13/N14).
    expect(note.opale).toBeDefined();
    expect(note.connector).toEqual([]);
  });
});
