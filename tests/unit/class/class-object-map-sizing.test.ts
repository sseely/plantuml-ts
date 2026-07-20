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
 *   - nukera-08-dige359  — object, 4 explicit-visibility field rows (G3/O1)
 *   - diveje-52-xefe514  — map with 1 linked (`*->`, Point) row + 2 plain
 *     rows (G3/O1)
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

  // G3/O1: data-row baseline+textLength -- jar's `<text y="39.8889" ...
  // textLength="101.4125">name = "Dummy"</text>` / `<text y="53.8889" ...
  // textLength="42.525">id = 123</text>` against rect y=7 --
  // MethodsOrFieldsArea's own per-row "ascent-from-row-top" baseline (same
  // convention as headerRows, G3/O0), NOT the pre-O1 half-height guess --
  // and EACH row's OWN raw textLength, not a shared block width (the two
  // rows have visibly different textLength: 101.4125 vs 42.525).
  it("sets each field row's OWN textLength and an ascent-from-row-top baseline", () => {
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
    const nameRow = c.rows[1]!;
    const idRow = c.rows[2]!;
    expect(nameRow.width).toBeCloseTo(101.4125, 3);
    expect(idRow.width).toBeCloseTo(42.525, 3);
    // title.height(18) + OBJECT_FIELD_MARGIN_Y(4) + baselineOffset(10.8889)
    // -- jar's y=39.8889 minus rect y=7
    expect(nameRow.y).toBeCloseTo(32.8889, 3);
    // title.height(18) + OBJECT_FIELD_MARGIN_Y(4) + fontSize(14) +
    // baselineOffset(10.8889) -- jar's y=53.8889 minus rect y=7
    expect(idRow.y).toBeCloseTo(46.8889, 3);
  });
});

// ---------------------------------------------------------------------------
// object — nukera-08-dige359: 4 visibility-icon rows, IDENTICAL text --
// discriminates the per-row-baseline formula from a shared-height guess
// (icon reserve must not perturb the baseline stride).
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — 4 explicit-visibility field rows (nukera-08-dige359)', () => {
  it("strides each row's baseline by exactly fontSize, independent of the icon reserve", () => {
    const ast = makeAST([
      objectClassifier('p1', '~#1: Person', {
        members: [
          { visibility: '-', name: 'toto', rawDisplay: 'String toto = "hello"', isStatic: false, isAbstract: false, visibilityExplicit: true },
          { visibility: '#', name: 'toto', rawDisplay: 'String toto = "hello"', isStatic: false, isAbstract: false, visibilityExplicit: true },
          { visibility: '~', name: 'toto', rawDisplay: 'String toto = "hello"', isStatic: false, isAbstract: false, visibilityExplicit: true },
          { visibility: '+', name: 'toto', rawDisplay: 'String toto = "hello"', isStatic: false, isAbstract: false, visibilityExplicit: true },
        ],
      }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    // header(1) + 4 field rows
    expect(c.rows).toHaveLength(5);
    const ys = c.rows.slice(1).map((r) => r.y);
    // title.height(18) + OBJECT_FIELD_MARGIN_Y(4) + i*fontSize(14) +
    // baselineOffset(10.8889) -- jar's y=39.8889/53.8889/67.8889/81.8889
    // minus rect y=7
    expect(ys[0]).toBeCloseTo(32.8889, 3);
    expect(ys[1]).toBeCloseTo(46.8889, 3);
    expect(ys[2]).toBeCloseTo(60.8889, 3);
    expect(ys[3]).toBeCloseTo(74.8889, 3);
    // every row shares the SAME textLength (identical post-strip text) --
    // 107.7125, the oracle's own value
    for (const r of c.rows.slice(1)) expect(r.width).toBeCloseTo(107.7125, 3);
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

  // G3/O1: data-row baseline+textLength+indent. jar's `TextBlockMap#drawU`
  // (klimt/geom/HorizontalAlignment#getPosition) CENTERS each key within
  // colA (`style.getHorizontalAlignment()` = CENTER, plantuml.skin's
  // `map { HorizontalAlignment center }`) but draws the value FLUSH-LEFT at
  // `colA + MAP_CELL_MARGIN_X` (the value TextBlock's own left-margined
  // text, `TextBlockMap#getTextBlock`'s `HorizontalAlignment.LEFT`) --
  // jar-verified against bepafe-03-teda035's CapitalCity: "UK" x=30.9875
  // (centered, NOT flush at rect x+5), "London"/"Washington"/"Berlin" all
  // x=79.4875 (flush at colA+5 regardless of each value's own width).
  it("centers each row's key within colA, draws the value flush-left at colA+margin, " +
     'and sets each cell\'s OWN textLength', () => {
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
    // rows[0] = header name; data rows start at index 1: UK key/value,
    // USA key/value, Germany key/value.
    const [ukKey, ukValue, usaKey, usaValue, deKey, deValue] = c.rows.slice(1);

    // colA = 67.4875 (Germany's key cell, the widest) -- (colA - rawWidth)/2
    expect(ukKey!.width).toBeCloseTo(19.5125, 3);
    expect(ukKey!.indent).toBeCloseTo(23.9875, 3); // jar x=30.9875 - rect x=7
    expect(usaKey!.width).toBeCloseTo(28.875, 3);
    expect(usaKey!.indent).toBeCloseTo(19.3063, 3); // jar x=26.3063 - rect x=7
    expect(deKey!.width).toBeCloseTo(57.4875, 3);
    expect(deKey!.indent).toBeCloseTo(5, 3); // jar x=12 - rect x=7 (widest key)

    // every value cell is flush-left at colA(67.4875) + MAP_CELL_MARGIN_X(5)
    // = 72.4875, independent of its OWN width (London/Washington/Berlin all
    // share the same x)
    expect(ukValue!.width).toBeCloseTo(46.725, 3);
    expect(ukValue!.indent).toBeCloseTo(72.4875, 3); // jar x=79.4875 - rect x=7
    expect(usaValue!.width).toBeCloseTo(73.9375, 3);
    expect(usaValue!.indent).toBeCloseTo(72.4875, 3);
    expect(deValue!.width).toBeCloseTo(35.875, 3);
    expect(deValue!.indent).toBeCloseTo(72.4875, 3);

    // baseline: rowTop + MAP_CELL_MARGIN_Y(2) + baselineOffset(10.8889) --
    // key and value share the same row baseline.
    // row0 top = title.height(18); row1 top = 18+18=36; row2 top = 18+18+18=54
    expect(ukKey!.y).toBeCloseTo(30.8889, 3); // jar y=73.8889 - rect y=43
    expect(ukValue!.y).toBeCloseTo(30.8889, 3);
    expect(usaKey!.y).toBeCloseTo(48.8889, 3); // jar y=91.8889 - rect y=43
    expect(deKey!.y).toBeCloseTo(66.8889, 3); // jar y=109.8889 - rect y=43
  });
});

// ---------------------------------------------------------------------------
// map — diveje-52-xefe514: 1 linked (Point) row + 2 plain rows
// ---------------------------------------------------------------------------

describe('measureMapClassifier — linked (Point) row + 2 plain rows (diveje-52-xefe514)', () => {
  it("centers the Point row's key within the FULL box width (not colA), and draws no value", () => {
    const ast = makeAST([
      {
        id: 'CapitalCity',
        display: 'CapitalCity',
        kind: 'map',
        typeParams: [],
        members: [],
        rows: [
          { key: 'UK', value: '', linkedCode: 'London' },
          { key: 'USA', value: 'Washington' },
          { key: 'Germany', value: 'Berlin' },
        ],
      },
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(151.425, 3);
    const [ukKey, ukValue] = c.rows.slice(1);
    // (boxWidth(151.425) - rawWidth(19.5125)) / 2 = 65.95625 -- jar x=72.9563
    // minus rect x=7 -- centered against the FULL box width, NOT colA(67.4875)
    // (TextBlockMap#drawU: `horizontalAlignment.getPosition(keyWidth, trueWidth)`
    // for a Point row, vs `..., widthColA)` for a plain row).
    expect(ukKey!.width).toBeCloseTo(19.5125, 3);
    expect(ukKey!.indent).toBeCloseTo(65.9563, 3);
    expect(ukKey!.y).toBeCloseTo(30.8889, 3); // jar y=37.8889 - rect y=7
    // no value text/textLength for a Point row
    expect(ukValue!.text).toBe('');
    expect(ukValue!.width).toBeUndefined();
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

// G3/O2: multi-stacked stereotypes (`object X <<Bar>> <<Foo>>`) -- upstream
// draws ONE guillemet-wrapped `<text>` PER label, stacked (`Stereotype
// #getLabels()`), the SAME shape `class-stereotype.ts#buildStereoRows`
// already ports for CLASS -- object's own `headerRows` previously only
// ever wrapped+drew the classifier's raw (comma/greedy-regex-collided)
// stereotype BLOB as ONE line. Jar-verified fafozi-27-reja300's node2
// (`object "Object1" as node2 <<Bar>> <<Foo>>`, no fields/braces): TWO
// independent `<text>` rows, each centered against its OWN raw width vs
// boxWidth (NOT a shared block-width centering) -- `«Bar»` narrower
// (32.025) centers 1.0125px right of `«Foo»` (34.05) despite BOTH stacking
// at the SAME box x-origin.
describe('headerRows — object, multi-stacked stereotype (fafozi-27-reja300: node2 <<Bar>> <<Foo>>)', () => {
  it('draws ONE row per label, each independently centered, stacked at fontSize stride', () => {
    const ast = makeAST([
      objectClassifier('node2', 'Object1', { stereotype: 'Bar>> <<Foo' }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(62.2125, 3);
    expect(c.rows).toHaveLength(3);
    const barRow = c.rows[0]!;
    const fooRow = c.rows[1]!;
    const nameRow = c.rows[2]!;
    expect(barRow.text).toBe('«Bar»');
    expect(barRow.fontSize).toBe(12);
    expect(barRow.width).toBeCloseTo(32.025, 3);
    // (62.2125 - 32.025) / 2 = 15.09375 -- jar's text x=132.4237 minus rect x=117.33
    expect(barRow.indent).toBeCloseTo(15.09375, 3);
    // baselineOffset(12pt), row 0 -- jar's text y=19.3333 minus rect y=10
    expect(barRow.y).toBeCloseTo(9.3333, 3);
    expect(fooRow.text).toBe('«Foo»');
    expect(fooRow.width).toBeCloseTo(34.05, 3);
    // (62.2125 - 34.05) / 2 = 14.08125 -- jar's text x=131.4113 minus rect x=117.33
    expect(fooRow.indent).toBeCloseTo(14.08125, 3);
    // fontSize(12) stride + baselineOffset -- jar's text y=31.3333 minus rect y=10
    expect(fooRow.y).toBeCloseTo(21.3333, 3);
    expect(nameRow.width).toBeCloseTo(48.2125, 3);
    // (62.2125 - 48.2125) / 2 = 7 -- jar's text x=124.33 minus rect x=117.33
    expect(nameRow.indent).toBeCloseTo(7, 3);
    // stereoHeight(2*12=24) + OBJECT_NAME_PADDING(2) + baselineOffset(14) --
    // jar's text y=46.8889 minus rect y=10
    expect(nameRow.y).toBeCloseTo(36.8889, 3);
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

// ---------------------------------------------------------------------------
// object — nufoju-44-dabi767: `skinparam tabSize` field-text tab expansion
// (G3/O4)
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — skinparam tabSize field-text expansion (nufoju-44-dabi767)', () => {
  // `\t` here is the literal TWO-character source escape (backslash + 't'),
  // matching `parseObjectField`'s own `rawDisplay` capture verbatim -- NOT
  // a real tab byte. `formatObjectMemberText` unescapes it before layout
  // (jar's `Display.getWithNewlines`'s own `c2 == 't'` branch).
  function tabAst(): ClassDiagramAST {
    return makeAST([
      objectClassifier('foo', 'foo', {
        members: [
          { visibility: '+', name: 'field1', rawDisplay: '\\tfield1', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'field2', rawDisplay: '\\tfield2', isStatic: false, isAbstract: false },
          { visibility: '+', name: 'field3', rawDisplay: '\\tfield3', isStatic: false, isAbstract: false },
          {
            visibility: '+',
            name: 'field5',
            rawDisplay: '\\tfield5\\tfield6',
            isStatic: false,
            isAbstract: false,
          },
        ],
      }),
    ]);
  }

  it('sizes the box to the oracle width (157.5125 x 82), tabSize 20 folding to the ' +
     'default 8-space (width-0) fallback -> fontSize*4 = 56px tab stop', () => {
    const themeWithTabSize = { ...theme, tabSize: 20 };
    const geo = layoutClass(tabAst(), themeWithTabSize, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(157.5125, 3);
    expect(c.height).toBeCloseTo(82, 5);
  });

  it('splits a multi-tab line into independently-positioned runs sharing one row y, ' +
     'and single-tab lines into one run each -- jar-verified x/textLength/childCount', () => {
    const themeWithTabSize = { ...theme, tabSize: 20 };
    const geo = layoutClass(tabAst(), themeWithTabSize, measurer);
    const c = geo.classifiers[0]!;
    // header(1) + field1(1) + field2(1) + field3(1) + field5+field6(2) = 6
    expect(c.rows).toHaveLength(6);
    const [, r1, r2, r3, r5, r6] = c.rows;
    for (const r of [r1!, r2!, r3!, r5!]) {
      expect(r.indent).toBeCloseTo(62, 3); // OBJECT_FIELD_MARGIN_X(6) + tabStop(56)
      expect(r.width).toBeCloseTo(33.5125, 3);
    }
    expect(r1!.text).toBe('field1');
    expect(r5!.text).toBe('field5');
    expect(r6!.text).toBe('field6');
    // field5's own tab stop (56) + field6's own post-field5 tab stop (56
    // more, jar's `ceil(33.5125/56)*56`) = 112 relative -> +6 margin = 118
    expect(r6!.indent).toBeCloseTo(118, 3);
    // field5/field6 share the SAME row y (one source line, two runs)
    expect(r5!.y).toBeCloseTo(r6!.y, 6);
  });

  it('falls back to the upstream default (8) when `skinparam tabSize` is unset -- ' +
     'SAME tab stop (56px), since 8 also folds to the width-0 fallback', () => {
    const geo = layoutClass(tabAst(), theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.width).toBeCloseTo(157.5125, 3);
    expect(c.rows[1]!.indent).toBeCloseTo(62, 3);
  });

  it('leaves a tab-free line completely unaffected (single run, x:0, zero behavior ' +
     'change for the common case)', () => {
    const ast = makeAST([
      objectClassifier('plain', 'plain', {
        members: [{ visibility: '+', name: 'field1', isStatic: false, isAbstract: false }],
      }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows).toHaveLength(2);
    expect(c.rows[1]!.indent).toBeCloseTo(6, 3); // OBJECT_FIELD_MARGIN_X, no tab
  });
});

// ---------------------------------------------------------------------------
// object — jotaga-99-fatu830: `skinparam style strictuml` header underline
// (G3/O4)
// ---------------------------------------------------------------------------

describe('measureObjectClassifier — skinparam style strictuml underline (jotaga-99-fatu830)', () => {
  it('underlines the WHOLE name (single row) when there is no colon', () => {
    const ast = makeAST([objectClassifier('firstObject', 'firstObject')]);
    const geo = layoutClass(ast, { ...theme, strictUml: true }, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]!.text).toBe('firstObject');
    expect(c.rows[0]!.underline).toBe(true);
    expect(c.rows[0]!.width).toBeCloseTo(62.9125, 3);
    // jar-verified: rect x=7 -> text x=14, unaffected by the underline split
    expect(c.rows[0]!.indent).toBeCloseTo(7, 3);
  });

  it('splits `name : type` into an underlined name run + a plain, leading-' +
     'whitespace-stripped type run sharing one row y -- jar-verified against o2', () => {
    const ast = makeAST([objectClassifier('o2', 'instance name : type')]);
    const geo = layoutClass(ast, { ...theme, strictUml: true }, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows).toHaveLength(2);
    const [nameRow, typeRow] = c.rows;
    expect(nameRow!.text).toBe('instance name');
    expect(nameRow!.underline).toBe(true);
    expect(nameRow!.width).toBeCloseTo(87.15, 3);
    expect(typeRow!.text).toBe(': type'); // leading space stripped
    expect(typeRow!.underline).toBeUndefined();
    expect(typeRow!.width).toBeCloseTo(30.275, 3);
    expect(typeRow!.y).toBeCloseTo(nameRow!.y, 6);
    // jar-verified: rect x=118.74 -> name text x=125.74 (indent 7), type
    // text x=212.89 (indent 94.15 = 7 + 87.15, immediately adjacent)
    expect(nameRow!.indent).toBeCloseTo(7, 3);
    expect(typeRow!.indent).toBeCloseTo(94.15, 3);
  });

  it('does NOT underline without `skinparam style strictuml` (zero behavior change)', () => {
    const ast = makeAST([objectClassifier('firstObject', 'firstObject')]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]!.underline).toBeUndefined();
  });

  it('does NOT underline map/json headers even with strictuml (object-kind only)', () => {
    const ast = makeAST([
      { id: 'm', display: 'CapitalCity', kind: 'map', typeParams: [], members: [] },
    ]);
    const geo = layoutClass(ast, { ...theme, strictUml: true }, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows[0]!.underline).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// object — kocupi-02-ripa662: `hide object stereotypes` suppresses the
// stereo row entirely (G3/O4)
// ---------------------------------------------------------------------------

describe('measureObjectClassifier -- hideStereotype (kocupi-02-ripa662)', () => {
  it('draws NO stereo row and collapses the title to the name-only height', () => {
    const ast = makeAST([
      objectClassifier('foo', 'foo', { stereotype: 'Foo', hideStereotype: true }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    // header(name only, no stereo) + empty-fields placeholder -- no
    // divider between them since showFields defaults true with zero
    // members (OBJECT_EMPTY_FIELDS path)
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0]!.text).toBe('foo');
    expect(c.height).toBeCloseTo(18 + 16, 5); // nameHeight(18) + OBJECT_EMPTY_FIELDS.height(16)
  });

  it('draws the stereo row normally when hideStereotype is unset (zero behavior change)', () => {
    const ast = makeAST([objectClassifier('foo', 'foo', { stereotype: 'Foo' })]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.rows).toHaveLength(2);
    expect(c.rows[0]!.text).toBe('«Foo»');
  });
});

// ---------------------------------------------------------------------------
// object — xuvesu-44-laru205: visibility icon fill (stroke-only, never
// filled) for object field rows (G3/O4)
// ---------------------------------------------------------------------------

describe('measureObjectFields -- visibilityIsField always true (xuvesu-44-laru205)', () => {
  it('sets visibilityIsField: true on every icon-bearing object field row', () => {
    const ast = makeAST([
      objectClassifier('Test', 'Test', {
        members: [
          { visibility: '+', name: 'line1', rawDisplay: 'line 1', isStatic: false, isAbstract: false, visibilityExplicit: true },
          { visibility: '-', name: 'line5', rawDisplay: 'line 5', isStatic: false, isAbstract: false, visibilityExplicit: true },
        ],
      }),
    ]);
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    const [publicRow, privateRow] = c.rows.slice(1);
    expect(publicRow!.visibilityIsField).toBe(true);
    expect(privateRow!.visibilityIsField).toBe(true);
  });
});
