/**
 * `object Foo { ... }` multi-line body, and the `X : field` post-hoc member
 * form (CommandAddMethod), ported into the class engine.
 *
 * CommandCreateEntityObjectMultilines reuses an already-existing entity
 * (no "Object already exists" no-op, unlike the single-line `object`
 * declaration) and applies stereotype/color to it unconditionally. Body
 * lines are object field lines (`name = value` / bare `name`), not class
 * member lines — routed by the target classifier's `kind`.
 *
 * The `X : field` form (rule 6-pre, CommandAddMethod) creates a MISSING
 * target as a plain `class` (LeafType.CLASS, not OBJECT) and parses the
 * field with the ordinary class member parser; only an ALREADY-existing
 * `object`-kind target routes through the object field parser.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java
 * @see ~/git/plantuml/.../classdiagram/command/CommandAddMethod.java
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
// Multi-line body — basic field parsing
// ---------------------------------------------------------------------------

describe('object multi-line body — field parsing', () => {
  it('parses "name = value" into a member with type = the raw value', () => {
    const c = findClassifier('object user1 {\nname = "x"\n}', 'user1');
    expect(c.kind).toBe('object');
    expect(c.members).toEqual([
      { visibility: '+', name: 'name', type: '"x"', isStatic: false, isAbstract: false },
    ]);
  });

  it('drops a blank line inside the body (member count unchanged)', () => {
    const c = findClassifier('object user1 {\nname = "x"\n\nage = 30\n}', 'user1');
    expect(c.members).toHaveLength(2);
  });

  it('parses a bare field name with no type', () => {
    const c = findClassifier('object user1 {\nflag\n}', 'user1');
    expect(c.members).toEqual([
      { visibility: '+', name: 'flag', isStatic: false, isAbstract: false },
    ]);
  });

  it('captures all header parts on the multiline form: quoted display, alias, stereotype, color', () => {
    const ast = parse('object "Pretty" as u2 <<s>> #pink {\nx = 1\n}');
    const c = ast.classifiers.find((cl) => cl.id === 'u2');
    expect(c).toBeDefined();
    expect(c!.display).toBe('Pretty');
    expect(c!.stereotype).toBe('s');
    expect(c!.color).toBe('#pink');
    expect(c!.kind).toBe('object');
    expect(c!.members).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-line body — entity reuse (no duplicate error, unlike single-line)
// ---------------------------------------------------------------------------

describe('object multi-line body — entity reuse', () => {
  it('reuses an entity created earlier as a class, keeping its kind', () => {
    const ast = parse('class A\nobject A {\nx = 1\n}');
    const objs = ast.classifiers.filter((c) => c.id === 'A');
    expect(objs).toHaveLength(1);
    expect(objs[0]!.kind).toBe('class');
    // Upstream's Bodier stores "x = 1" as a raw display field regardless of
    // LeafType (Member.field never rejects a line). Our class engine's
    // eager parseMemberLine has no raw-display-string member shape (only
    // structured name/[type]) and drops anything it can't parse into that
    // shape -- a pre-existing gap this task does not extend the AST to
    // close. Routing this body line by the REUSED entity's kind ('class',
    // not 'object') reproduces that existing drop behavior faithfully.
    expect(objs[0]!.members).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// `X : field` post-hoc member form (CommandAddMethod)
// ---------------------------------------------------------------------------

describe('object "X : field" post-hoc member form', () => {
  it('appends a member to an existing object leaf via object field semantics', () => {
    const c = findClassifier('object user1\nuser1 : age = 30', 'user1');
    expect(c.kind).toBe('object');
    expect(c.members).toEqual([
      { visibility: '+', name: 'age', type: '30', isStatic: false, isAbstract: false },
    ]);
  });

  it('creates a missing target as a class (not object) via class member parsing', () => {
    const c = findClassifier('user1 : age = 30', 'user1');
    expect(c.kind).toBe('class');
    // parseMemberLine's attribute form has no "=" support — "age = 30" fails
    // to match either the method or attribute regex and is dropped.
    expect(c.members).toEqual([]);
  });
});
