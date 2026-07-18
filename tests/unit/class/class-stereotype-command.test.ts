/**
 * G2 N24: the standalone `<Name> <<stereotype>>` post-hoc statement
 * (upstream `CommandStereotype`) -- full parser integration tests, mirrors
 * `class-url-command.test.ts`'s established pattern for the sibling `url
 * of X is [[...]]` statement.
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

describe('standalone `<Name> <<stereotype>>` post-hoc statement', () => {
  it('sets the stereotype of an already-declared classifier', () => {
    const ast = parse('enum MonEnum\nMonEnum <<Test>>');
    expect(ast.classifiers[0]).toMatchObject({ id: 'MonEnum', stereotype: 'Test' });
  });

  it('targeting a nonexistent classifier is a silent no-op, not a throw', () => {
    expect(() => parse('Nonexistent <<Test>>')).not.toThrow();
    const ast = parse('Nonexistent <<Test>>');
    expect(ast.classifiers).toEqual([]);
  });

  it('overwrites an earlier inline stereotype (last-writer-wins)', () => {
    const ast = parse('class Foo <<First>>\nFoo <<Second>>');
    expect(ast.classifiers[0]!.stereotype).toBe('Second');
  });

  it('does not match a normal declaration line (requires an existing classifier)', () => {
    const ast = parse('class Foo <<Test>>');
    expect(ast.classifiers[0]).toMatchObject({ id: 'Foo', stereotype: 'Test' });
    expect(ast.classifiers).toHaveLength(1);
  });
});
