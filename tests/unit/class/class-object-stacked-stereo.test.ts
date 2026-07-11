/**
 * Stacked stereotypes on object/map declarations — upstream
 * `StereotypePattern.mandatory` is a LAZY `(\<\<.+?\>\>)`, but composed into
 * one anchored full-line command regex, backtracking forces it to swallow
 * `Bar>> <<Foo` as ONE capture (see .agent-notes/class-singles2-mechanisms.md,
 * gabejo-44-juki791 — the class-declaration path already replicates this).
 * The object/map openers used `[^<>]+?`, which cannot span the inner
 * `>> <<`, so `object X <<Bar>> <<Foo>>` failed the whole anchored regex and
 * the declaration was dropped. Pinned by Phase L iteration 6 of mission
 * object-dot-sync (fixture fafozi-27-reja300).
 *
 * @see ~/git/plantuml/.../stereo/StereotypePattern.java
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('stacked stereotypes on object/map declarations', () => {
  it('parses fafozi-27-reja300 shape: class + object each with <<Bar>> <<Foo>>', () => {
    const ast = parse(
      'class "Class1" as node1 <<Bar>> <<Foo>>\nobject "Object1" as node2 <<Bar>> <<Foo>>',
    );
    expect(ast.classifiers.map((c) => ({ id: c.id, kind: c.kind }))).toEqual([
      { id: 'node1', kind: 'class' },
      { id: 'node2', kind: 'object' },
    ]);
    // Same one-blob capture as the class path (composed-greedy upstream behavior).
    expect(ast.classifiers[1]!.stereotype).toBe('Bar>> <<Foo');
  });

  it('single stereotype on object still captures cleanly with trailing color', () => {
    const ast = parse('object F <<s>> #pink');
    expect(ast.classifiers[0]!.stereotype).toBe('s');
    expect(ast.classifiers[0]!.color).toContain('#pink');
  });

  it('stacked stereotypes on a map opener', () => {
    const ast = parse('map M <<A>> <<B>> {\nk => v\n}');
    expect(ast.classifiers[0]!.kind).toBe('map');
    expect(ast.classifiers[0]!.stereotype).toBe('A>> <<B');
    expect(ast.classifiers[0]!.rows).toEqual([{ key: 'k', value: 'v' }]);
  });
});
