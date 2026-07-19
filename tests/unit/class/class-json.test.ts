/**
 * `json Name { ... }` / `json Name value` declaration + body, ported into
 * the class engine (class-json-commands.ts) — upstream `CommandCreateJson` +
 * `CommandCreateJsonSingleLine` + `BodierJSon`.
 *
 * Sizing assertions use WidthTableMeasurer (= DeterministicMeasurer),
 * matching the oracle svek DOT dumps under test-results/dot-cache/object/,
 * captured with `-DPLANTUML_DETERMINISTIC_TEXT=true`:
 *   - baloca-83-nadu916 — `json "some json" {"a": 1}` under `allowmixing`,
 *     alongside `object "some object"` (2 classifiers total). Oracle:
 *     73.9375 x 36.
 *   - bepafe-03-teda035 — `map CapitalCity {...}` + `json A {...}` (4 keys:
 *     one plain string, one 3-element array, one boolean, one nested
 *     2-key object). Oracle json node: 143.025 x 144.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJson.java
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateJsonSingleLine.java
 * @see ~/git/plantuml/.../cucadiagram/BodierJSon.java
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST, Classifier } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

const measurer = new WidthTableMeasurer();
const theme = defaultTheme; // fontFamily 'sans-serif', fontSize 14 — matches the oracle capture

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

function findClassifier(source: string, id: string): Classifier {
  const ast = parse(source);
  const c = ast.classifiers.find((cl) => cl.id === id);
  if (c === undefined) throw new Error(`Expected classifier "${id}"`);
  return c;
}

// ---------------------------------------------------------------------------
// baloca-83-nadu916: `json "some json" {"a": 1}` + `object "some object"`
// ---------------------------------------------------------------------------

const BALOCA_SOURCE = `
allowmixing
json "some json" {
"a": 1
}
object "some object"
`;

describe('json — baloca-83-nadu916 shape', () => {
  it('parses 2 classifiers: json + object', () => {
    const ast = parse(BALOCA_SOURCE);
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.classifiers.map((c) => c.kind).sort()).toEqual(['json', 'object']);
  });

  it('the json leaf has display "some json" and one top-level entry {a: 1}', () => {
    const c = findClassifier(BALOCA_SOURCE, 'some json');
    expect(c.kind).toBe('json');
    expect(c.display).toBe('some json');
    expect(c.jsonValue).toEqual({
      kind: 'object',
      entries: [{ key: 'a', value: { kind: 'scalar', value: 1 } }],
    });
  });

  it('sizes the json node to the oracle dims (73.9375 x 36)', () => {
    const ast = parse(BALOCA_SOURCE);
    const geo = layoutClass(ast, theme, measurer);
    const jsonGeo = geo.classifiers.find((c) => c.kind === 'json')!;
    expect(jsonGeo.width).toBeCloseTo(73.9375, 3);
    expect(jsonGeo.height).toBeCloseTo(36, 5);
  });
});

// ---------------------------------------------------------------------------
// bepafe-03-teda035: `json A { name, color[], visible, user{} }`
// ---------------------------------------------------------------------------

const BEPAFE_JSON_SOURCE = `
json A {
"name": "component c1",
"color": ["normal", "green", "red"],
"visible": true,
"user" : { "age": 23, "name": "John"}
}
`;

describe('json — bepafe-03-teda035 shape (nested braces on one line)', () => {
  it('parses 4 top-level keys with correct nested/array shapes', () => {
    const c = findClassifier(BEPAFE_JSON_SOURCE, 'A');
    expect(c.kind).toBe('json');
    expect(c.jsonValue).toEqual({
      kind: 'object',
      entries: [
        { key: 'name', value: { kind: 'scalar', value: 'component c1' } },
        {
          key: 'color',
          value: {
            kind: 'array',
            items: [
              { kind: 'scalar', value: 'normal' },
              { kind: 'scalar', value: 'green' },
              { kind: 'scalar', value: 'red' },
            ],
          },
        },
        { key: 'visible', value: { kind: 'scalar', value: true } },
        {
          key: 'user',
          value: {
            kind: 'object',
            entries: [
              { key: 'age', value: { kind: 'scalar', value: 23 } },
              { key: 'name', value: { kind: 'scalar', value: 'John' } },
            ],
          },
        },
      ],
    });
  });

  it('sizes the json node to the oracle dims (143.025 x 144)', () => {
    const ast = parse(BEPAFE_JSON_SOURCE);
    const geo = layoutClass(ast, theme, measurer);
    const jsonGeo = geo.classifiers.find((c) => c.kind === 'json')!;
    expect(jsonGeo.width).toBeCloseTo(143.025, 3);
    expect(jsonGeo.height).toBeCloseTo(144, 5);
  });

  // G3/O0: headerRows centering fix (class-object-map-sizing.ts) applies to
  // json's header identically (shared with object/map) -- jar-verified:
  // "A"'s golden `<text x="275.8313" y="19.8889" textLength="9.3625">A</text>`
  // against rect x=209/y=7.
  it('centers the name row within the final box width and sets textLength', () => {
    const ast = parse(BEPAFE_JSON_SOURCE);
    const geo = layoutClass(ast, theme, measurer);
    const jsonGeo = geo.classifiers.find((c) => c.kind === 'json')!;
    const nameRow = jsonGeo.rows[0]!;
    expect(nameRow.text).toBe('A');
    expect(nameRow.width).toBeCloseTo(9.3625, 3);
    // (143.025 - 9.3625) / 2 = 66.83125 -- jar's text x=275.8313 minus rect x=209
    expect(nameRow.indent).toBeCloseTo(66.83125, 3);
    // JSON_NAME_MARGIN(2) + baselineOffset(14) -- jar's text y=19.8889 minus rect y=7
    expect(nameRow.y).toBeCloseTo(12.8889, 3);
  });
});

// ---------------------------------------------------------------------------
// Header grammar: display/code order, stereotype, color
// ---------------------------------------------------------------------------

describe('json header — display/code order, stereotype, color', () => {
  it('"code as display" quoted-display order', () => {
    const c = findClassifier('json J1 as "Display" {\n"a": 1\n}', 'J1');
    expect(c.display).toBe('Display');
    expect(c.kind).toBe('json');
  });

  it('quoted-display "as" code order', () => {
    const c = findClassifier('json "Display" as J2 {\n"a": 1\n}', 'J2');
    expect(c.display).toBe('Display');
  });

  it('bare code, no display', () => {
    const c = findClassifier('json J3 {\n"a": 1\n}', 'J3');
    expect(c.display).toBe('J3');
  });

  it('captures <<stereotype>> and #color', () => {
    const c = findClassifier('json J4 <<s>> #pink {\n"a": 1\n}', 'J4');
    expect(c.stereotype).toBe('s');
    expect(c.color).toBe('#pink');
  });
});

// ---------------------------------------------------------------------------
// Duplicate name — silent no-op, body still consumed
// ---------------------------------------------------------------------------

describe('json — duplicate multiline name', () => {
  it('leaves the first declaration untouched and consumes the second body', () => {
    const source = `
json J {
"a": 1
}
json J {
"b": 2
}
class Next
`;
    const ast = parse(source);
    // Only ONE json classifier — the duplicate is a silent no-op.
    const jsonClassifiers = ast.classifiers.filter((c) => c.kind === 'json');
    expect(jsonClassifiers).toHaveLength(1);
    expect(jsonClassifiers[0]!.jsonValue).toEqual({
      kind: 'object',
      entries: [{ key: 'a', value: { kind: 'scalar', value: 1 } }],
    });
    // The duplicate's body ("b": 2) must not leak as a stray top-level line —
    // `Next` still parses as its own class right after the consumed body.
    expect(ast.classifiers.some((c) => c.id === 'Next')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid JSON body — leaf kept (entity created before validation), no value
// ---------------------------------------------------------------------------

describe('json — invalid JSON body', () => {
  it('keeps the leaf (kind json) with jsonValue left undefined', () => {
    const c = findClassifier('json Bad {\nnot valid json at all\n}', 'Bad');
    expect(c.kind).toBe('json');
    expect(c.jsonValue).toBeUndefined();
  });

  it('measures the leaf as an empty json object (13px empty-fields fallback)', () => {
    const ast = parse('json Bad {\nnot valid json at all\n}');
    const geo = layoutClass(ast, theme, measurer);
    const jsonGeo = geo.classifiers[0]!;
    // title height + 13 (JSON_EMPTY_HEIGHT_FALLBACK) — no crash, deterministic.
    expect(jsonGeo.height).toBeGreaterThan(13);
  });
});

// ---------------------------------------------------------------------------
// Single-line form
// ---------------------------------------------------------------------------

describe('json — single-line form (CommandCreateJsonSingleLine)', () => {
  it('parses an object value on one line', () => {
    const c = findClassifier('json J {"k": 1}', 'J');
    expect(c.kind).toBe('json');
    expect(c.jsonValue).toEqual({
      kind: 'object',
      entries: [{ key: 'k', value: { kind: 'scalar', value: 1 } }],
    });
  });

  it('parses a bare boolean value', () => {
    const c = findClassifier('json J2 true', 'J2');
    expect(c.jsonValue).toEqual({ kind: 'scalar', value: true });
  });

  it('parses a bare integer value', () => {
    const c = findClassifier('json J3 42', 'J3');
    expect(c.jsonValue).toEqual({ kind: 'scalar', value: 42 });
  });

  it('parses a bare string value', () => {
    const c = findClassifier('json J4 "hello"', 'J4');
    expect(c.jsonValue).toEqual({ kind: 'scalar', value: 'hello' });
  });

  it('parses an array value', () => {
    const c = findClassifier('json J5 [1, 2, 3]', 'J5');
    expect(c.jsonValue).toEqual({
      kind: 'array',
      items: [
        { kind: 'scalar', value: 1 },
        { kind: 'scalar', value: 2 },
        { kind: 'scalar', value: 3 },
      ],
    });
  });

  it('duplicate single-line name is a silent no-op', () => {
    const ast = parse('json J6 1\njson J6 2');
    const jsonClassifiers = ast.classifiers.filter((c) => c.kind === 'json');
    expect(jsonClassifiers).toHaveLength(1);
    expect(jsonClassifiers[0]!.jsonValue).toEqual({ kind: 'scalar', value: 1 });
  });
});
