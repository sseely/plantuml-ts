/**
 * Unit tests for the class diagram layout engine.
 *
 * Uses real ELK (no mocks) — same convention as elk-adapter tests.
 * All tests are async; ELK initialises WASM/worker on first call.
 */

import { describe, it, expect } from 'vitest';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';
import type { RelationshipType } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 6: empty AST
// ---------------------------------------------------------------------------

describe('layoutClass — empty AST', () => {
  it('resolves without error', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result).toBeDefined();
  });

  it('returns empty classifiers array', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.classifiers).toEqual([]);
  });

  it('returns empty edges array', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.edges).toEqual([]);
  });

  it('returns empty namespaces array', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.namespaces).toEqual([]);
  });

  it('totalWidth is 0', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.totalWidth).toBe(0);
  });

  it('totalHeight is 0', async () => {
    const result = await layoutClass(makeAST(), defaultTheme, measurer);
    expect(result.totalHeight).toBe(0);
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

  it('all ClassifierGeo entries have positive width', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers).toHaveLength(3);
    for (const geo of result.classifiers) {
      expect(geo.width).toBeGreaterThan(0);
    }
  });

  it('all ClassifierGeo entries have positive height', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    for (const geo of result.classifiers) {
      expect(geo.height).toBeGreaterThan(0);
    }
  });

  it('returns 2 EdgeGeo entries', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(2);
  });

  it('totalWidth is positive', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight is positive', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
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

  it('bounding boxes do not intersect', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
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

  it('height is greater than 5 × memberRowHeight', async () => {
    const memberRowHeight = defaultTheme.fontSize * 1.4;
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers).toHaveLength(1);
    expect(result.classifiers[0]!.height).toBeGreaterThan(5 * memberRowHeight);
  });

  it('rows array has 6 entries (1 header + 5 members)', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
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

  it('returns 1 NamespaceGeo', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.namespaces).toHaveLength(1);
  });

  it('NamespaceGeo has positive dimensions', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    const ns = result.namespaces[0]!;
    expect(ns.width).toBeGreaterThan(0);
    expect(ns.height).toBeGreaterThan(0);
  });

  it('NamespaceGeo label matches display name', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.namespaces[0]!.label).toBe('MyNamespace');
  });

  it('both ClassifierGeo positions are inside NamespaceGeo bounds', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
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

  it('targetDecor is "triangle"', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.targetDecor).toBe('triangle');
  });

  it('sourceDecor is "none"', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('none');
  });

  it('dashed is false', async () => {
    const result = await layoutClass(ast, defaultTheme, measurer);
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

  it('implementation: targetDecor=triangle, dashed=true', async () => {
    const result = await layoutClass(makeRelAST('implementation'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('triangle');
    expect(result.edges[0]!.dashed).toBe(true);
  });

  it('composition: sourceDecor=filledDiamond, dashed=false', async () => {
    const result = await layoutClass(makeRelAST('composition'), defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('filledDiamond');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('aggregation: sourceDecor=diamond, dashed=false', async () => {
    const result = await layoutClass(makeRelAST('aggregation'), defaultTheme, measurer);
    expect(result.edges[0]!.sourceDecor).toBe('diamond');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('dependency: targetDecor=open, dashed=true', async () => {
    const result = await layoutClass(makeRelAST('dependency'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('open');
    expect(result.edges[0]!.dashed).toBe(true);
  });

  it('association: targetDecor=open, dashed=false', async () => {
    const result = await layoutClass(makeRelAST('association'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('open');
    expect(result.edges[0]!.dashed).toBe(false);
  });

  it('usage: targetDecor=none, sourceDecor=none, dashed=true', async () => {
    const result = await layoutClass(makeRelAST('usage'), defaultTheme, measurer);
    expect(result.edges[0]!.targetDecor).toBe('none');
    expect(result.edges[0]!.sourceDecor).toBe('none');
    expect(result.edges[0]!.dashed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Classifier kind display prefix tests
// ---------------------------------------------------------------------------

describe('layoutClass — classifier kind prefixes in header row', () => {
  it('interface classifier has «interface» prefix in row text', async () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'IRepo',
          display: 'Repo',
          kind: 'interface',
          typeParams: [],
          members: [],
        },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toContain('«interface»');
  });

  it('enum classifier has «enum» prefix in row text', async () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Color',
          display: 'Color',
          kind: 'enum',
          typeParams: [],
          members: [],
        },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toContain('«enum»');
  });

  it('abstract classifier has {abstract} prefix in row text', async () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'AbstractBase',
          display: 'Base',
          kind: 'abstract',
          typeParams: [],
          members: [],
        },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toContain('{abstract}');
  });

  it('annotation classifier has @ prefix in row text', async () => {
    const ast = makeAST({
      classifiers: [
        {
          id: 'Override',
          display: 'Override',
          kind: 'annotation',
          typeParams: [],
          members: [],
        },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.rows[0]!.text).toContain('@Override');
  });
});

// ---------------------------------------------------------------------------
// Divider and row structure
// ---------------------------------------------------------------------------

describe('layoutClass — dividerYs structure', () => {
  it('a classifier with members has at least one divider', async () => {
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
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.dividerYs.length).toBeGreaterThanOrEqual(1);
  });

  it('header divider y is greater than 0', async () => {
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
    const result = await layoutClass(ast, defaultTheme, measurer);
    const dividerYs = result.classifiers[0]!.dividerYs;
    expect(dividerYs.length).toBeGreaterThanOrEqual(1);
    expect(dividerYs[0]!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Method member formatting (formatMemberText — params branch)
// ---------------------------------------------------------------------------

describe('layoutClass — method member formatting', () => {
  it('method member row text contains "()" marker', async () => {
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
    const result = await layoutClass(ast, defaultTheme, measurer);
    const memberRow = result.classifiers[0]!.rows[1]!;
    expect(memberRow.text).toContain('()');
  });

  it('member without type renders with empty type suffix', async () => {
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
            },
          ],
        },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    const memberRow = result.classifiers[0]!.rows[1]!;
    // Format is "visibility + name: type" — type is empty string when undefined
    expect(memberRow.text).toContain('-value:');
  });
});

// ---------------------------------------------------------------------------
// Edge label passthrough
// ---------------------------------------------------------------------------

describe('layoutClass — edge with label', () => {
  it('EdgeGeo.label.text matches the relationship label', async () => {
    const ast: ClassDiagramAST = makeAST({
      classifiers: [
        { id: 'X', display: 'X', kind: 'class', typeParams: [], members: [] },
        { id: 'Y', display: 'Y', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [{ from: 'X', to: 'Y', type: 'association', label: 'uses' }],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.edges).toHaveLength(1);
    // ELK may or may not position the label — we only verify text is set
    expect(result.edges[0]!.label?.text).toBe('uses');
  });
});

// ---------------------------------------------------------------------------
// Node minimum width
// ---------------------------------------------------------------------------

describe('layoutClass — minimum node width', () => {
  it('node width is at least 100px even for a single-character class', async () => {
    const ast = makeAST({
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      ],
    });
    const result = await layoutClass(ast, defaultTheme, measurer);
    expect(result.classifiers[0]!.width).toBeGreaterThanOrEqual(100);
  });
});
