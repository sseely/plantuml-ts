/**
 * Namespace-separator / qualified-name handling (mission A2, iteration 18,
 * Group 7 — fokudo-49-xiki231, lobofa-60-vexe031, nadono-22-gidu983,
 * ledepo-11-muto607, vuresa-33-kumu160). Four distinct sub-mechanisms:
 *
 *  1. `INHERITANCE_CODE` (class-declaration-parser.ts) only recognized `.`/
 *     `::` as parent-code separators, so `extends` under a custom separator
 *     (`set namespaceSeparator \\`) never matched EXTENDS_RE — the whole
 *     ` extends ...` text landed inside the declaration's own id. Fixed by
 *     widening the separator grammar to mirror upstream's generic
 *     `CommandLinkClass.getSeparator()` (any non-identifier char, or a
 *     literal `::`/double-backslash), independent of the configured separator.
 *     @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:87-95
 *
 *  2. `splitEndpointPort` (class-relationship-parser.ts) unconditionally
 *     split a relationship endpoint on `::`, so `Name1::ClassA *- Name2::
 *     ClassB` under `set namespaceSeparator ::` was mis-read as
 *     entity=Name1/port=ClassA instead of a namespace-qualified classifier.
 *     Fixed by two guards mirroring upstream CucaDiagram's
 *     getPortId/removePortId + CommandLinkClass's outer firstWithName check:
 *     (a) a configured `::` separator disables the split entirely; (b) a
 *     `::`-containing endpoint that already matches a declared classifier's
 *     leaf name (e.g. `class Role::BadPix` under the DEFAULT `.` separator,
 *     where `::` is just ordinary name characters) resolves to that
 *     classifier whole, not a port split.
 *     @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:298-316
 *     @see ~/git/plantuml/.../classdiagram/command/CommandLinkClass.java:306-317
 *
 *  3. The standalone-member rule (`ClassName : member`, class-commands.ts)
 *     only accepted a bare word id and was dispatched AFTER relationship
 *     lines, so a dotted target (`My.Namespace.Person : guid OID`) both
 *     failed to match its own id pattern AND got mis-parsed as a phantom
 *     relationship (a bare `.` is a syntactically valid bodyless REL_ARROW).
 *     Fixed by widening the id pattern to dotted chains and moving the rule
 *     before relationship dispatch, mirroring ClassDiagramFactory's true
 *     registration order (CommandAddMethod before CommandLinkClass).
 *
 *  4. The same rule's `reuseExistingChild` defaulted to false (scope-local),
 *     so a classifier declared inside a package/namespace and later given
 *     members via this rule at ROOT scope (after the package closes) spawned
 *     a duplicate root classifier instead of reusing the namespaced one.
 *     Fixed by passing reuseExistingChild=true, mirroring CommandAddMethod's
 *     quarkInContext(true, idShort).
 *     @see ~/git/plantuml/.../classdiagram/command/CommandAddMethod.java:88
 *
 * nadono-22-gidu983's residual (a `together { }` block loses namespace
 * scope for a later sibling classifier) is a DIFFERENT, unrelated mechanism
 * (no `together` command exists in class-commands.ts at all) — not covered
 * here; see the iteration-18 report.
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

describe('extends clause under a custom (multi-char) separator (fokudo-49-xiki231)', () => {
  it('splits App\\\\Http\\\\Controllers\\\\Controller into a nested namespace, not the id', () => {
    const ast = parse(String.raw`
      set namespaceSeparator \\
      class CustomController extends App\\Http\\Controllers\\Controller {
        some info
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['App\\\\Http\\\\Controllers\\\\Controller', 'CustomController']);
    const child = ast.classifiers.find((c) => c.id === 'CustomController')!;
    expect(child.namespace).toBeUndefined();
    const parent = ast.classifiers.find((c) => c.id !== 'CustomController')!;
    expect(parent.namespace).toBe('App\\\\Http\\\\Controllers');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'CustomController',
      to: 'App\\\\Http\\\\Controllers\\\\Controller',
      type: 'extension',
    });
  });
});

describe('relationship endpoints when the separator IS `::` (lobofa-60-vexe031)', () => {
  it('resolves Name1::ClassA as a whole namespaced id, not entity::port', () => {
    const ast = parse(`
      set namespaceSeparator ::
      class Name1::ClassA {
        +void foo();
      }
      class Name2::ClassB {
        +void bar();
      }
      Name1::ClassA *- Name2::ClassB
    `);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['Name1::ClassA', 'Name2::ClassB']);
    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    expect(rel.from).toBe('Name1::ClassA');
    expect(rel.to).toBe('Name2::ClassB');
    expect(rel.fromPort).toBeUndefined();
    expect(rel.toPort).toBeUndefined();
  });
});

describe('a literal `::` in a name under the DEFAULT separator (nadono-22-gidu983)', () => {
  it('resolves Role::BadPix as itself once declared, not a port split', () => {
    const ast = parse(`
      namespace Observation {
        class BadPix {
        }
        class Role::BadPix {
        }
        BadPix *-- Role::BadPix
      }
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['Observation.BadPix', 'Observation.Role::BadPix']);
    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    expect(rel.from).toBe('Observation.BadPix');
    expect(rel.to).toBe('Observation.Role::BadPix');
    expect(rel.toPort).toBeUndefined();
  });
});

describe('dotted package NAME + cross-scope member reuse (ledepo-11-muto607)', () => {
  it('nests one namespace level per dotted segment of a package name', () => {
    const ast = parse(`
      package a.b.c {
        class Leaf
      }
    `);
    const nsIds = ast.namespaces.map((n) => n.id).sort();
    expect(nsIds).toEqual(['a', 'a.b', 'a.b.c']);
    expect(ast.classifiers[0]!.id).toBe('a.b.c.Leaf');
  });

  it('reuses a package-scoped classifier for a later root-scope member line', () => {
    const ast = parse(`
      package ns {
        Sequence "1" *-- "1" Descriptor
      }
      Sequence : addToSequence(String name)
    `);
    const ids = ast.classifiers.map((c) => c.id).sort();
    expect(ids).toEqual(['ns.Descriptor', 'ns.Sequence']);
    const seq = ast.classifiers.find((c) => c.id === 'ns.Sequence')!;
    expect(seq.members).toHaveLength(1);
  });
});

describe('standalone member with a dotted target, ordered before relationships (vuresa-33-kumu160)', () => {
  it('adds a member instead of mis-parsing a phantom relationship', () => {
    const ast = parse(`
      class My.Namespace.Person
      My.Namespace.Person : OID: guid
      My.Namespace.Person : getOID()
    `);
    expect(ast.classifiers).toHaveLength(1);
    const person = ast.classifiers[0]!;
    expect(person.id).toBe('My.Namespace.Person');
    expect(person.members).toHaveLength(2);
    expect(ast.relationships).toHaveLength(0);
  });

  it('still parses a genuine relationship line with dotted endpoints', () => {
    const ast = parse(`
      class My.Namespace.Person
      class Customer.Implementation.Namespace.Person
      My.Namespace.Person <|- Customer.Implementation.Namespace.Person
    `);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'Customer.Implementation.Namespace.Person',
      to: 'My.Namespace.Person',
      type: 'extension',
    });
  });
});
