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
// headerRows — name/stereo row CENTERING + baseline-Y + textLength (G3/O0
// fix). Jar-verified against dot-cache/object's niloru-34-nuve651
// ("Foo", no stereo), majake-62-pero492's foo3 (<<azerty>> + field), and
// bepafe-03-teda035's map CapitalCity (no stereo) -- see
// class-object-map-sizing.ts#headerRows's own doc comment for the full
// PlacementStrategyY1Y2 citation. Pre-O0, every header row drew flush-left
// (indent 0) with no textLength/lengthAdjust at all.
// ---------------------------------------------------------------------------

describe('headerRows — object, no stereotype (niloru-34-nuve651: "Foo")', () => {
  it('centers the name row within the final box width and sets textLength', () => {
    const ast = makeAST([objectClassifier('Foo', 'Foo')]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    // box width 38.15 (OBJECT_EMPTY_FIELDS(10) vs title.width(28.15)+2*5)
    expect(c.width).toBeCloseTo(38.15, 5);
    expect(c.rows).toHaveLength(1);
    const nameRow = c.rows[0]!;
    expect(nameRow.text).toBe('Foo');
    expect(nameRow.width).toBeCloseTo(24.15, 5);
    // (38.15 - 24.15) / 2 = 7 -- jar's text x=14 minus rect x=7
    expect(nameRow.indent).toBeCloseTo(7, 5);
    // OBJECT_NAME_PADDING(2) + baselineOffset(14) -- jar's text y=19.8889
    // minus rect y=7
    expect(nameRow.y).toBeCloseTo(12.8889, 3);
  });
});

describe('headerRows — object with stereotype (majake-62-pero492: foo3 <<azerty>>)', () => {
  it('centers BOTH the stereo row and the name row, each with its own textLength', () => {
    const ast = makeAST([
      objectClassifier('foo3', 'foo3', {
        members: [{ visibility: '+', name: 'dummy', isStatic: false, isAbstract: false }],
        stereotype: 'azerty',
      }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(57.85, 3);
    const stereoRow = c.rows[0]!;
    const nameRow = c.rows[1]!;
    expect(stereoRow.text).toBe('«azerty»');
    expect(stereoRow.fontSize).toBe(12);
    expect(stereoRow.width).toBeCloseTo(45.975, 3);
    // (57.85 - 45.975) / 2 = 5.9375 -- jar's text x=12.9375 minus rect x=7
    expect(stereoRow.indent).toBeCloseTo(5.9375, 3);
    // baselineOffset(12pt) -- jar's text y=116.3333 minus rect y=107
    expect(stereoRow.y).toBeCloseTo(9.3333, 3);
    expect(nameRow.width).toBeCloseTo(27.2125, 3);
    // (57.85 - 27.2125) / 2 = 15.31875 -- jar's text x=22.3188 minus rect x=7
    expect(nameRow.indent).toBeCloseTo(15.31875, 3);
    // stereoHeight(12) + OBJECT_NAME_PADDING(2) + baselineOffset(14) --
    // jar's text y=131.8889 minus rect y=107
    expect(nameRow.y).toBeCloseTo(24.8889, 3);
  });
});

describe('headerRows — map, no stereotype (bepafe-03-teda035: CapitalCity)', () => {
  it('centers the name row within the map\'s final (data-row-dominated) width', () => {
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
    const nameRow = c.rows[0]!;
    expect(nameRow.text).toBe('CapitalCity');
    expect(nameRow.width).toBeCloseTo(67.8125, 3);
    // (151.425 - 67.8125) / 2 = 41.80625 -- jar's text x=48.8063 minus rect x=7
    expect(nameRow.indent).toBeCloseTo(41.80625, 3);
    // MAP_NAME_MARGIN(2) + baselineOffset(14) -- jar's text y=55.8889 minus
    // rect y=43
    expect(nameRow.y).toBeCloseTo(12.8889, 3);
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
