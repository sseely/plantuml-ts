/**
 * `=`-body arrows — upstream `CommandLinkClass`'s ARROW_BODY1/2 are
 * `([-=.]+)` / `([-=.]*)` (CommandLinkClass.java:133,138): `=` is a valid
 * body char (bold line style), same length/type semantics as `-`. Pinned by
 * Phase L iteration 3 of mission object-dot-sync (fixtures lafemo-98-ruri220,
 * sivapa-41-sebu112, satuco-50-vusa163: map-row port links `Foo::abc =>
 * Bar::def` dropped the whole relationship line).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:133-138
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

describe('=-body arrows (CommandLinkClass ARROW_BODY [-=.])', () => {
  it('parses A => B as an association of length 1 (minlen 0)', () => {
    const ast = parse('class A\nclass B\nA => B');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.type).toBe('association');
    expect(ast.relationships[0]!.length).toBe(1);
  });

  it('parses A ==> B with length 2', () => {
    const ast = parse('class A\nclass B\nA ==> B');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.length).toBe(2);
  });

  it('parses map-row port links (lafemo-98-ruri220 shape)', () => {
    const ast = parse(
      'map Foo {\nabc => 123\n}\nmap Bar {\ndef => 456\n}\nFoo::abc => Bar::def',
    );
    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    expect(rel.from).toBe('Foo');
    expect(rel.to).toBe('Bar');
    expect(rel.fromPort).toBe('abc');
    expect(rel.toPort).toBe('def');
    expect(rel.length).toBe(1);
  });

  it('parses <|== (bold extension) with extension type', () => {
    const ast = parse('class A\nclass B\nA <|== B');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.type).toBe('extension');
  });

  it('a map body row `abc => 123` inside braces stays a row, not a relationship', () => {
    const ast = parse('map Foo {\nabc => 123\n}');
    expect(ast.relationships).toHaveLength(0);
    const foo = ast.classifiers.find((c) => c.id === 'Foo')!;
    expect(foo.rows).toEqual([{ key: 'abc', value: '123' }]);
  });
});
