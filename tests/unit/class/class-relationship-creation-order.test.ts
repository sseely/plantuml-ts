/**
 * G2 N59: relationship-endpoint auto-creation order must follow jar's REAL
 * left-to-right SOURCE TEXT order, not `Relationship.from`/`.to` (which is
 * swapped for hierarchical/other arrow types by `ArrowInfo.swapDirection`,
 * `class-arrow-grammar.ts`).
 *
 * Root cause (diagnosed via `bicabi-42-coto932`, a 500+ diffCount fixture
 * whose only structural defect was entity CREATION ORDER, jar-verified
 * against the cached golden's own entity `<!--class ...-->` comment order):
 * `CommandLinkClass.executeArg` (`~/git/plantuml/.../classdiagram/command/
 * CommandLinkClass.java:295-333`) always creates `ent1String`/`ent2String`
 * (the LEFT/RIGHT regex-captured text, unswapped) in that exact order —
 * `link.getInv()`'s direction-word swap runs strictly AFTER both entities
 * already exist, and never affects creation order. `class-commands.ts`'s
 * `REL_DISPATCH_RE` handler previously called `ensureClassifier` in
 * `rel.from`/`rel.to` order, which is WRONG whenever `swapDirection` is
 * true — see `ast.ts#Relationship.swapDirection`'s own doc comment.
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:295-333
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

describe('relationship-endpoint auto-creation order (G2 N59)', () => {
  it('extension (`<|--`) with BOTH endpoints undeclared: the LEFT (child) ' +
     'text creates first, even though it is semantically `to` (swapDirection ' +
     'reorders `from`/`to` but not creation order) — jar-verified ' +
     'bicabi-42-coto932 (`MainWindow <|-- Gtk::Window`: MainWindow ent0001, ' +
     'Gtk ent0002)', () => {
    const ast = parse('MainWindow <|-- Gtk::Window');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['MainWindow', 'Gtk']);
    expect(ast.classifiers[0]).toMatchObject({ id: 'MainWindow', creationIndex: 1 });
    expect(ast.classifiers[1]).toMatchObject({ id: 'Gtk', creationIndex: 2 });
    expect(ast.relationships[0]).toMatchObject({ from: 'Gtk', to: 'MainWindow', type: 'extension' });
  });

  it('implementation (`<|..`) with both endpoints undeclared also creates ' +
     'left-to-right (same swapDirection=true family as extension)', () => {
    const ast = parse('Impl <|.. IFace');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Impl', 'IFace']);
  });

  it('association (`--`, swapDirection=false) already created left-to-right ' +
     'before this fix — unaffected, confirms no regression on the common case', () => {
    const ast = parse('A -- B');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('a PRE-DECLARED endpoint is reused, not recreated, regardless of ' +
     'swapDirection — creation order only matters for the FIRST reference', () => {
    const ast = parse('class MainWindow\nMainWindow <|-- Gtk');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['MainWindow', 'Gtk']);
    expect(ast.classifiers[0]!.creationIndex).toBe(1);
  });

  it('mixed: extension right-endpoint already exists, left does not — left ' +
     'still creates in its own textual position (only one auto-create needed)', () => {
    const ast = parse('class Gtk\nMainWindow <|-- Gtk');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Gtk', 'MainWindow']);
  });
});
