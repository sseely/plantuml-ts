/**
 * Namespace/package block-open regex coverage (mission A2, Fix 1):
 *  - same-line empty body `namespace X {}` / `package X {}` — must register
 *    (and immediately collapse) the empty namespace/package, matching the
 *    oracle DOT for gatula-10-bifu561 (three flat `shape=rect` leaves, no
 *    cluster subgraph — verified via `dot-sync-report.ts --slug
 *    gatula-10-bifu561 class`).
 *  - an optional `[[url {tooltip}]]` segment between the name and a trailing
 *    `#color`/`{` (vacole-77-vivo236) — the tooltip's own `{`/`}` must not be
 *    mistaken for the block's opening/closing brace.
 *
 * @see ~/git/plantuml/.../command/CommandNamespace.java
 * @see ~/git/plantuml/.../command/CommandNamespaceEmpty.java
 * @see ~/git/plantuml/.../command/CommandPackageEmpty.java
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

describe('empty same-line namespace/package (gatula-10-bifu561)', () => {
  it('collapses an empty package and namespace to flat rect classifiers', () => {
    const ast = parse(`
      package foo {}
      namespace bar {}
      class qux {}
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['bar', 'foo', 'qux']);
    // Neither empty container survives as a namespace/cluster.
    expect(ast.namespaces).toHaveLength(0);
    const foo = ast.classifiers.find((c) => c.id === 'foo')!;
    const bar = ast.classifiers.find((c) => c.id === 'bar')!;
    expect(foo.kind).toBe('descriptive');
    expect(bar.kind).toBe('descriptive');
    const qux = ast.classifiers.find((c) => c.id === 'qux')!;
    expect(qux.kind).toBe('class');
  });

  it('still opens a normal (non-empty) namespace as a cluster', () => {
    const ast = parse(`
      namespace bar {
        class X
      }
    `);
    expect(ast.namespaces.map((n) => n.id)).toEqual(['bar']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['bar.X']);
  });
});

describe('namespace with [[url {tooltip}]] + color (vacole-77-vivo236)', () => {
  it('parses the tooltip segment without corrupting the block body', () => {
    const ast = parse(`
      namespace Dummy [[http://www.google.com {this is a tooltip on Dummy}]] #DDDDDD {
      class foo
      }
    `);
    expect(ast.namespaces.map((n) => n.id)).toEqual(['Dummy']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Dummy.foo']);
  });

  it('still handles a namespace with only a stereotype decoration', () => {
    const ast = parse(`
      namespace Foo <<cloud>> {
      class X
      }
    `);
    expect(ast.namespaces.map((n) => n.id)).toEqual(['Foo']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Foo.X']);
  });
});
