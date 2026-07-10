/**
 * `class X extends Y` / `implements Z` clause parsing (mission A2, Fix 2):
 * parseClassifierDecl had no extends/implements clause, so `extends Servlet`
 * landed inside the captured id (zadova-38-xamu320). Fixed by stripping a
 * trailing extends/implements clause (extractInheritance) before parsing the
 * id, then synthesizing the parent classifier(s) + relationship(s)
 * (resolveInheritance + applyInheritanceClauses).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:103-108
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClassMultilines.java:333-365 (manageExtends)
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

describe('extends clause (zadova-38-xamu320)', () => {
  it('trims the id and creates the parent classifier + extension link', () => {
    const ast = parse(`
      class ReferenceInstructionVisitor extends Instruction$Visitor {

      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['Instruction$Visitor', 'ReferenceInstructionVisitor']);
    const child = ast.classifiers.find((c) => c.id === 'ReferenceInstructionVisitor')!;
    expect(child.kind).toBe('class');
    const parent = ast.classifiers.find((c) => c.id === 'Instruction$Visitor')!;
    expect(parent.kind).toBe('class');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'ReferenceInstructionVisitor',
      to: 'Instruction$Visitor',
      type: 'extension',
    });
  });

  it('does not spawn a duplicate parent when it is already declared', () => {
    const ast = parse(`
      class Base {
      }
      class Derived extends Base {
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['Base', 'Derived']);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({ from: 'Derived', to: 'Base', type: 'extension' });
  });
});

describe('implements clause + multiple comma-separated parents', () => {
  it('creates each parent as an interface with a dashed implementation link', () => {
    const ast = parse(`
      class Foo implements A, B {
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['A', 'B', 'Foo']);
    expect(ast.classifiers.find((c) => c.id === 'A')!.kind).toBe('interface');
    expect(ast.classifiers.find((c) => c.id === 'B')!.kind).toBe('interface');
    const rels = ast.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type }));
    expect(rels.sort((a, b) => a.to.localeCompare(b.to))).toEqual([
      { from: 'Foo', to: 'A', type: 'implementation' },
      { from: 'Foo', to: 'B', type: 'implementation' },
    ]);
  });

  it('combines extends and implements on one declaration', () => {
    const ast = parse(`
      class Foo extends Base implements A {
      }
    `);
    const rels = ast.relationships.map((r) => ({ from: r.from, to: r.to, type: r.type }));
    expect(rels.sort((a, b) => a.to.localeCompare(b.to))).toEqual([
      { from: 'Foo', to: 'A', type: 'implementation' },
      { from: 'Foo', to: 'Base', type: 'extension' },
    ]);
  });

  it('renders interface-extends-interface as a solid extension, not dashed', () => {
    const ast = parse(`
      interface I2
      interface I1 extends I2
    `);
    expect(ast.classifiers.find((c) => c.id === 'I2')!.kind).toBe('interface');
    expect(ast.relationships[0]).toMatchObject({ from: 'I1', to: 'I2', type: 'extension' });
  });
});
