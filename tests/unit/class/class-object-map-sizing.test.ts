/**
 * Sizing/DOT/render tests for `kind:'object'` and `kind:'map'` classifiers
 * (object-dot-sync mission, T4 — class-object-map-sizing.ts).
 *
 * Dimension assertions use WidthTableMeasurer (= DeterministicMeasurer),
 * matching the oracle svek DOT dumps under test-results/dot-cache/object/,
 * which are captured with `-DPLANTUML_DETERMINISTIC_TEXT=true`
 * (scripts/dot-sync-report.ts). Fixtures cross-checked (see
 * class-object-map-sizing.ts's module doc for the worked numbers):
 *   - beleso-08-ruca459  — 2 plain objects, no stereo/fields
 *   - figeze-77-fozi735  — object with 2 fields, no stereo
 *   - majake-62-pero492  — object with/without 1 stereotype + 1 field
 *   - bepafe-03-teda035  — map, 3 plain rows, no stereo
 */

import { describe, it, expect } from 'vitest';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { ClassDiagramAST, Classifier } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

const measurer = new WidthTableMeasurer();
const theme = defaultTheme; // fontFamily 'sans-serif', fontSize 14 — matches the oracle capture

function makeAST(classifiers: Classifier[], relationships: ClassDiagramAST['relationships'] = []): ClassDiagramAST {
  return { classifiers, relationships, namespaces: [], directives: [], notes: [] };
}

function objectClassifier(id: string, display: string, overrides?: Partial<Classifier>): Classifier {
  return { id, display, kind: 'object', typeParams: [], members: [], ...overrides };
}

// ---------------------------------------------------------------------------
// object — beleso-08-ruca459: plain, no stereotype, no fields
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — plain object, no stereo/fields (beleso-08-ruca459)', () => {
  it('sizes "bamboo" to the oracle dims (0.896875in x 0.472222in @ 72dpi)', () => {
    const ast = makeAST([objectClassifier('bamboo', 'bamboo')]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(64.575, 5);
    expect(c.height).toBeCloseTo(34, 5);
  });

  it('sizes "Kannada : bambu" to the oracle dims (1.621181in x 0.472222in)', () => {
    const ast = makeAST([objectClassifier('k', 'Kannada : bambu')]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(116.725, 3);
    expect(c.height).toBeCloseTo(34, 5);
  });
});

// ---------------------------------------------------------------------------
// object — figeze-77-fozi735: 2 fields, no stereotype
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — object with fields, no stereo (figeze-77-fozi735)', () => {
  it('sizes "user" { name = "Dummy"; id = 123 } to the oracle dims (1.575174in x 0.75in)', () => {
    const ast = makeAST([
      objectClassifier('user', 'user', {
        members: [
          { visibility: '+', name: 'name', type: '"Dummy"', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'id', type: '123', isStatic: false, isAbstract: false },
        ],
      }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(113.4125, 3);
    expect(c.height).toBeCloseTo(54, 5);
    // header + 2 field rows, "name = value" text (no visibility icon)
    expect(c.rows).toHaveLength(3);
    expect(c.rows[1]!.text).toBe('name = "Dummy"');
    expect(c.rows[2]!.text).toBe('id = 123');
    expect(c.rows[1]!.visibilityIcon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// object — majake-62-pero492: stereotype height, field-dominant width
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — stereotype + field (majake-62-pero492)', () => {
  const dummyMember: Classifier['members'] = [
    { visibility: '+', name: 'dummy', isStatic: false, isAbstract: false },
  ];

  it('foo1 (no stereo, 1 field "dummy") sizes to 0.803472in x 0.555556in', () => {
    const ast = makeAST([objectClassifier('foo1', 'foo1', { members: dummyMember })]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(57.85, 3);
    expect(c.height).toBeCloseTo(40, 5);
  });

  it('foo3 (stereo <<azerty>>, 1 field "dummy") sizes to 0.803472in x 0.722222in — ' +
     'same width as foo1 (field dominates), +12px height for the stereo line', () => {
    const ast = makeAST([
      objectClassifier('foo3', 'foo3', { members: dummyMember, stereotype: 'azerty' }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(57.85, 3);
    expect(c.height).toBeCloseTo(52, 5);
    // stereo row (italic, guillemet-wrapped) precedes the name row
    expect(c.rows[0]!.text).toBe('«azerty»');
    expect(c.rows[0]!.italic).toBe(true);
    expect(c.rows[1]!.text).toBe('foo3');
  });
});

// ---------------------------------------------------------------------------
// map — bepafe-03-teda035: 3 plain rows, no stereotype
// ---------------------------------------------------------------------------

describe('measureMapClassifier — 3-row map, no stereotype (bepafe-03-teda035)', () => {
  it('sizes CapitalCity{UK=>London,USA=>Washington,Germany=>Berlin} to 151.425in x 72 (72dpi)', () => {
    const ast = makeAST([
      {
        id: 'CapitalCity',
        display: 'CapitalCity',
        kind: 'map',
        typeParams: [],
        members: [],
        rows: [
          { key: 'UK', value: 'London' },
          { key: 'USA', value: 'Washington' },
          { key: 'Germany', value: 'Berlin' },
        ],
      },
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(151.425, 3);
    expect(c.height).toBeCloseTo(72, 5);
  });

  it('an empty map body sizes to the header alone (no substituted fallback height)', () => {
    const ast = makeAST([
      { id: 'Empty', display: 'Empty', kind: 'map', typeParams: [], members: [] },
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    // titleHeight only: measure("Empty",14).width + 4 padding, height = 14+4=18
    expect(c.height).toBeCloseTo(18, 5);
  });
});

// ---------------------------------------------------------------------------
// map — DOT emission: shape=plaintext, no isPort even with a row-link edge
// ---------------------------------------------------------------------------

describe('map DOT emission', () => {
  it('emits shape=plaintext and no isPort for a map node with a linked row', () => {
    const ast = makeAST(
      [
        objectClassifier('London', 'London'),
        {
          id: 'CapitalCity',
          display: 'CapitalCity',
          kind: 'map',
          typeParams: [],
          members: [],
          rows: [{ key: 'UK', value: '', linkedCode: 'London' }],
        },
      ],
      [
        {
          from: 'CapitalCity',
          to: 'London',
          type: 'association',
          sourceDecor: 'none',
          targetDecor: 'open',
          fromPort: 'UK',
          length: 1,
        },
      ],
    );

    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try {
      layoutClass(ast, theme, measurer);
    } finally {
      setLayoutInputObserver(undefined);
    }

    const mapNode = captured!.nodes.find((n) => n.id === 'CapitalCity');
    expect(mapNode?.shape).toBe('plaintext');
    expect(mapNode?.isPort).toBeUndefined();
  });
});
