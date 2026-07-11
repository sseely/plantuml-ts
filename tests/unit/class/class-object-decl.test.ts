/**
 * `object` declaration command, ported into the class engine
 * (class-object-commands.ts) — upstream `CommandCreateEntityObject`.
 *
 * Calls `parseClass` directly (not the diagram registry): mission
 * object-dot-sync T5 (not this task) rewires registration order so the
 * class engine wins pure-object blocks; until then the separate object
 * plugin still claims them at the registry level.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObject.java
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

function firstClassifier(source: string): Classifier {
  const ast = parse(source);
  const c = ast.classifiers[0];
  if (c === undefined) throw new Error('Expected at least one classifier');
  return c;
}

// ---------------------------------------------------------------------------
// Bare + aliased declarations
// ---------------------------------------------------------------------------

describe('object declaration — bare and aliased forms', () => {
  it('parses "object foo" with id/display both "foo" and kind "object"', () => {
    const c = firstClassifier('object foo');
    expect(c.kind).toBe('object');
    expect(c.id).toBe('foo');
    expect(c.display).toBe('foo');
    expect(c.members).toEqual([]);
  });

  it('parses "object \\"Display\\" as F1 <<stereo>>" (quoted-display-as-code + stereotype)', () => {
    const c = firstClassifier('object "Display" as F1 <<stereo>>');
    expect(c.id).toBe('F1');
    expect(c.display).toBe('Display');
    expect(c.stereotype).toBe('stereo');
    expect(c.kind).toBe('object');
  });

  it('parses "object F1 as \\"Display\\"" (code-as-quoted-display, reversed order)', () => {
    const c = firstClassifier('object F1 as "Display"');
    expect(c.id).toBe('F1');
    expect(c.display).toBe('Display');
    expect(c.kind).toBe('object');
  });

  it('captures a trailing background color', () => {
    const c = firstClassifier('object foo #lightblue');
    expect(c.color).toBe('#lightblue');
    expect(c.id).toBe('foo');
  });
});

// ---------------------------------------------------------------------------
// Duplicate declaration ("Object already exists")
// ---------------------------------------------------------------------------

describe('object declaration — duplicate handling', () => {
  it('a second "object foo" after the first is a no-op (upstream: error)', () => {
    const ast = parse('object foo <<first>>\nobject foo <<second>>');
    const objects = ast.classifiers.filter((c) => c.id === 'foo');
    expect(objects).toHaveLength(1);
    // The FIRST declaration's fields win — the second is fully ignored,
    // unlike a duplicate `class foo` (applyClassifierDecl always re-applies
    // fields on redeclaration).
    expect(objects[0]!.stereotype).toBe('first');
  });
});

// ---------------------------------------------------------------------------
// Relationship name-start guard: "Object" as a class name, not a keyword
// ---------------------------------------------------------------------------

describe('object declaration — relationship endpoint named "Object"', () => {
  it('parses "Object <|-- Foo" as a class relationship, not an object declaration', () => {
    const ast = parse('Object <|-- Foo');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'Foo',
      to: 'Object',
      type: 'extension',
    });
    // Auto-created relationship endpoints default to kind "class", never "object".
    const objectEndpoint = ast.classifiers.find((c) => c.id === 'Object');
    expect(objectEndpoint?.kind).toBe('class');
  });
});

// ---------------------------------------------------------------------------
// Namespace/container placement
// ---------------------------------------------------------------------------

describe('object declaration — inside a package', () => {
  it('lands the object in the enclosing package like a classifier declaration', () => {
    const ast = parse('package P {\nobject foo\n}');
    const c = ast.classifiers.find((cl) => cl.id === 'P.foo');
    expect(c).toBeDefined();
    expect(c!.kind).toBe('object');
    expect(c!.namespace).toBe('P');
    const ns = ast.namespaces.find((n) => n.id === 'P');
    expect(ns?.classifiers).toContain('P.foo');
  });
});
