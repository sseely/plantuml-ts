/**
 * `map Name { ... }` declaration + body, ported into the class engine
 * (class-map-commands.ts) — upstream `CommandCreateMap` + `BodierMap`.
 *
 * `map` is always multi-line (no single-line map command upstream) and its
 * body rows (`key => value` / `key *-> dest`) are collected into
 * `Classifier.rows`, not `members` — a map row is a `MapRow`, not a
 * `Member`. A `key *-> dest` row also produces a `Relationship` from the map
 * to `dest` (`fromPort` = key, `length` = arrow-body-char-count - 1),
 * mirroring `LinkType(LinkDecor.ARROW, LinkDecor.NONE)`, which is exactly
 * the LinkType a plain `entity1 -> entity2` relationship line produces.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateMap.java
 * @see ~/git/plantuml/.../cucadiagram/BodierMap.java
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST, Classifier } from '../../../src/diagrams/class/ast.js';

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
// Basic `key => value` row
// ---------------------------------------------------------------------------

describe('map body — "key => value" row', () => {
  it('parses one row from "k => v"', () => {
    const c = findClassifier('map m {\nk => v\n}', 'm');
    expect(c.kind).toBe('map');
    expect(c.rows).toEqual([{ key: 'k', value: 'v' }]);
  });
});

// ---------------------------------------------------------------------------
// Header: display/code split, stereotype, color
// ---------------------------------------------------------------------------

describe('map header — display, stereotype, color', () => {
  it('captures quoted-display-as-code, <<stereotype>>, and a #color', () => {
    const ast = parse('map "Display" as M1 <<s>> #pink {\nk => v\n}');
    const c = ast.classifiers.find((cl) => cl.id === 'M1');
    expect(c).toBeDefined();
    expect(c!.display).toBe('Display');
    expect(c!.stereotype).toBe('s');
    expect(c!.color).toBe('#pink');
    expect(c!.kind).toBe('map');
    expect(c!.rows).toEqual([{ key: 'k', value: 'v' }]);
  });
});

// ---------------------------------------------------------------------------
// Blank lines dropped
// ---------------------------------------------------------------------------

describe('map body — blank lines', () => {
  it('drops blank lines inside the body (row count unaffected)', () => {
    const c = findClassifier('map m {\nk1 => v1\n\nk2 => v2\n}', 'm');
    expect(c.rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Linked entry: "key *-> dest" (dest already declared)
// ---------------------------------------------------------------------------

describe('map body — "key *-> dest" linked row', () => {
  it('adds a row with linkedCode + a relationship (fromPort, length 1) when dest exists', () => {
    const ast = parse('object POL\nmap m {\nWarsaw *-> POL\n}');
    const m = ast.classifiers.find((c) => c.id === 'm');
    expect(m).toBeDefined();
    expect(m!.kind).toBe('map');
    expect(m!.rows).toEqual([{ key: 'Warsaw', value: '', linkedCode: 'POL' }]);

    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'm',
      to: 'POL',
      type: 'association',
      sourceDecor: 'none',
      targetDecor: 'open',
      fromPort: 'Warsaw',
      length: 1,
    });
  });

  it('a longer arrow body ("*-->") drives length 2', () => {
    const ast = parse('object POL\nmap m {\nWarsaw *--> POL\n}');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({ length: 2 });
  });

  it('keeps the row but adds no relationship when dest does not exist', () => {
    const ast = parse('map m {\nWarsaw *-> Nowhere\n}');
    const m = ast.classifiers.find((c) => c.id === 'm');
    expect(m).toBeDefined();
    expect(m!.rows).toEqual([{ key: 'Warsaw', value: '' }]);
    expect(ast.relationships).toHaveLength(0);
    // No phantom classifier is created for the unresolved dest either.
    expect(ast.classifiers.find((c) => c.id === 'Nowhere')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unparseable body line (neither "=>" nor "*->")
// ---------------------------------------------------------------------------

describe('map body — unparseable line', () => {
  it('drops a line with neither "=>" nor a linked-entry arrow', () => {
    const c = findClassifier('map m {\njust text\n}', 'm');
    expect(c.rows ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Duplicate map name ("Map already exists")
// ---------------------------------------------------------------------------

describe('map declaration — duplicate handling', () => {
  it('a second "map m" after the first is a no-op; the second body is consumed, not leaked', () => {
    const ast = parse('map m {\nk1 => v1\n}\nmap m {\nk2 => v2\n}');
    const maps = ast.classifiers.filter((c) => c.id === 'm');
    expect(maps).toHaveLength(1);
    // First declaration's rows win — the second body never touches "m".
    expect(maps[0]!.rows).toEqual([{ key: 'k1', value: 'v1' }]);
    // The second body's line did not leak out as a bogus top-level command
    // (e.g. spawn a stray "k2" classifier or relationship).
    expect(ast.classifiers.find((c) => c.id === 'k2')).toBeUndefined();
    expect(ast.relationships).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Relationship name-start guard: "map" as a class name, not a keyword
// ---------------------------------------------------------------------------

describe('map keyword — relationship endpoint named "map"', () => {
  it('parses "map <|-- Foo" as a class relationship, not a map declaration', () => {
    const ast = parse('map <|-- Foo');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'Foo',
      to: 'map',
      type: 'extension',
    });
    // Auto-created relationship endpoints default to kind "class", never "map".
    const mapEndpoint = ast.classifiers.find((c) => c.id === 'map');
    expect(mapEndpoint?.kind).toBe('class');
  });
});
