/**
 * Bare (non-dotted) RELATION-ENDPOINT reference resolution: when the name
 * uniquely matches an entity already declared anywhere in the diagram, the
 * reference reuses that entity instead of spawning a duplicate scoped to the
 * current namespace. Mirrors upstream `CucaDiagram#quarkInContext`'s
 * `reuseExistingChild` branch (x===-1, `countByName(full) === 1`).
 *
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:244-286 (quarkInContext)
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:919-925 (countByName/firstWithName)
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java
 *      (reuseExistingChild=true at endpoint/couple resolution sites)
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:184
 *      (reuseExistingChild=false at declaration sites)
 */
import { describe, it, expect } from 'vitest';

import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('bare relation-endpoint reference reuses a unique existing entity', () => {
  // befasi-62-vimu310 style: `package app { package model { class DripSource } }
  // ... DripSource ..> Oscillator` at root scope reuses app.model.DripSource.
  it('reuses a classifier declared in a package when referenced bare elsewhere', () => {
    const ast = parse(`
      package p {
        class X
      }
      X --> Y
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    // Exactly one X (p.X); no root-level duplicate X was spawned.
    expect(ids).toEqual(['Y', 'p.X']);
    const px = ast.classifiers.find((c) => c.id === 'p.X')!;
    expect(px.namespace).toBe('p');
    const y = ast.classifiers.find((c) => c.id === 'Y')!;
    expect(y.namespace).toBeUndefined();
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({ from: 'p.X', to: 'Y' });
  });

  it('reuses regardless of which side of the arrow the bare name is on', () => {
    const ast = parse(`
      package p {
        class X
      }
      Y --> X
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['Y', 'p.X']);
    expect(ast.relationships[0]).toMatchObject({ from: 'Y', to: 'p.X' });
  });

  it('does not reuse when the same simple name is ambiguous (count != 1)', () => {
    const ast = parse(`
      package p1 {
        class X
      }
      package p2 {
        class X
      }
      Y --> X
    `);
    // Both p1.X and p2.X exist, plus a THIRD, scope-local root "X" for the
    // ambiguous bare reference — count(X) == 2, so no reuse fires.
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['X', 'Y', 'p1.X', 'p2.X']);
    const rootX = ast.classifiers.find((c) => c.id === 'X')!;
    expect(rootX.namespace).toBeUndefined();
    expect(ast.relationships[0]).toMatchObject({ from: 'Y', to: 'X' });
  });

  it('declarations never reuse an existing entity from another namespace', () => {
    // reuseExistingChild=false at declaration sites (CommandCreateClass):
    // `package b { class X }` always creates its OWN b.X, even though at the
    // moment it is declared `countByName('X') === 1` (only a.X exists so far)
    // — declarations skip the reuse check entirely, unlike references.
    const ast = parse(`
      package a {
        class X
      }
      package b {
        class X
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['a.X', 'b.X']);
    expect(ast.classifiers.find((c) => c.id === 'a.X')!.namespace).toBe('a');
    expect(ast.classifiers.find((c) => c.id === 'b.X')!.namespace).toBe('b');
  });

  // cobumi-83-bapu892 style: `package "entities" { class Card ... package
  // entities.mindmap { MindMapCard -> Card } }` reuses entities.Card from the
  // nested entities.mindmap package instead of creating entities.mindmap.Card.
  it('a nested namespace reuses a bare name declared in an enclosing namespace', () => {
    const ast = parse(`
      package a {
        class X
        package a.b {
          X --> Y
        }
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['a.X', 'a.b.Y']);
    expect(ast.classifiers.find((c) => c.id === 'a.X')!.namespace).toBe('a');
    expect(ast.classifiers.find((c) => c.id === 'a.b.Y')!.namespace).toBe('a.b');
    expect(ast.relationships[0]).toMatchObject({ from: 'a.X', to: 'a.b.Y' });
  });

  it('reuses on BOTH endpoints of a single relationship simultaneously', () => {
    const ast = parse(`
      package p {
        class X
      }
      package q {
        class Y
      }
      X --> Y
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['p.X', 'q.Y']);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({ from: 'p.X', to: 'q.Y' });
  });
});
