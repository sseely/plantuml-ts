/**
 * Nested-generic declaration parsing (mission A2, class-dot-sync Group 3):
 * upstream's classifier id never includes `<`/`>` (`NameAndCodeParser.CODE`
 * excludes them) — a classifier's own `<...>` generic clause, and a
 * discarded trailing generic on an `extends`/`implements` parent reference,
 * are matched by a SEPARATE bounded-recursion (4-level) regex
 * (`GenericRegexProducer`). plantuml-ts's original single-level
 * `/^(\w+)<([^>]+)>$/` failed on any nested `<...>` inside the generic body
 * (`Foo<List <? extends GENERIC>>`) and on dotted self-qualified ids
 * (`issues.MySupplier<T>`, `\w+` excludes `.`), falling back to the whole
 * raw string as `id` — a garbled id distinct from the real classifier,
 * producing an orphan node in the DOT graph (bavoxa-34-keje375,
 * cuxebo-14-babu885). A generic suffix on an EXTENDS/IMPLEMENTS target
 * (`extends BaseChat<A>`) wasn't recognized by the inheritance-clause regex
 * at all, so the whole clause failed to match and the entire remainder
 * (including ` extends BaseChat<A>`) leaked into the child's own id
 * (xemife-30-cada335).
 *
 * @see ~/git/plantuml/.../classdiagram/command/GenericRegexProducer.java
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:89-91
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClassMultilines.java:119-124
 */
import { describe, it, expect } from 'vitest';
import { parseClassifierDecl } from '../../../src/diagrams/class/class-declaration-parser.js';

describe('nested-generic classifier declarations', () => {
  it('bavoxa-34-keje375: nested <...> inside the generic body does not leak into id', () => {
    const decl = parseClassifierDecl('class Foo<List <? extends GENERIC>> <<Dummy>>');
    expect(decl?.id).toBe('Foo');
    expect(decl?.display).toBe('Foo');
    expect(decl?.typeParams).toEqual(['List <? extends GENERIC>']);
    expect(decl?.stereotype).toBe('Dummy');
  });

  it('cuxebo-14-babu885: dotted self-qualified id keeps its generic separate', () => {
    const decl = parseClassifierDecl('interface issues.MySupplier<T>');
    expect(decl?.id).toBe('issues.MySupplier');
    expect(decl?.display).toBe('issues.MySupplier');
    expect(decl?.typeParams).toEqual(['T']);
  });

  it('two-level nested generic (depth < 4 bound) parses as one type param', () => {
    const decl = parseClassifierDecl('class Foo<Bar<Baz>>');
    expect(decl?.id).toBe('Foo');
    expect(decl?.typeParams).toEqual(['Bar<Baz>']);
  });

  it('top-level comma split still separates non-nested params', () => {
    const decl = parseClassifierDecl('interface IFoo<T, U>');
    expect(decl?.typeParams).toEqual(['T', 'U']);
  });

  it('nested generic with a top-level comma only splits the outer level', () => {
    const decl = parseClassifierDecl('class Pair<Map<K, V>, W>');
    expect(decl?.id).toBe('Pair');
    expect(decl?.typeParams).toEqual(['Map<K, V>', 'W']);
  });

  it("xemife-30-cada335: extends target's own generic is discarded, not part of the id", () => {
    const decl = parseClassifierDecl('class CoupleChat extends BaseChat<A>');
    expect(decl?.id).toBe('CoupleChat');
    expect(decl?.display).toBe('CoupleChat');
    expect(decl?.extendsIds).toEqual(['BaseChat']);
  });

  it("a classifier's own generic and its extends clause coexist", () => {
    const decl = parseClassifierDecl('class BaseChat<A> extends BaseEntity');
    expect(decl?.id).toBe('BaseChat');
    expect(decl?.typeParams).toEqual(['A']);
    expect(decl?.extendsIds).toEqual(['BaseEntity']);
  });
});
