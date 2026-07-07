import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type {
  Classifier,
  Member,
  Relationship,
} from '../../../src/diagrams/class/ast.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

function firstClassifier(source: string): Classifier {
  const ast = parse(source);
  const c = ast.classifiers[0];
  if (c === undefined) throw new Error('Expected at least one classifier');
  return c;
}

function firstRelationship(source: string): Relationship {
  const ast = parse(source);
  const r = ast.relationships[0];
  if (r === undefined) throw new Error('Expected at least one relationship');
  return r;
}

// ---------------------------------------------------------------------------
// Classifier declarations
// ---------------------------------------------------------------------------

describe('classifier declarations', () => {
  it('parses a simple class', () => {
    const c = firstClassifier('class Foo');
    expect(c.id).toBe('Foo');
    expect(c.display).toBe('Foo');
    expect(c.kind).toBe('class');
    expect(c.typeParams).toEqual([]);
    expect(c.members).toEqual([]);
  });

  it('parses abstract class with kind "abstract"', () => {
    const c = firstClassifier('abstract class Base');
    expect(c.kind).toBe('abstract');
    expect(c.id).toBe('Base');
  });

  it('parses interface with kind "interface"', () => {
    const c = firstClassifier('interface IFoo');
    expect(c.kind).toBe('interface');
  });

  it('parses enum with kind "enum"', () => {
    const c = firstClassifier('enum Color');
    expect(c.kind).toBe('enum');
  });

  it('parses annotation with kind "annotation"', () => {
    const c = firstClassifier('annotation MyAnnotation');
    expect(c.kind).toBe('annotation');
  });

  it('parses generic type params — interface IFoo<T, U>', () => {
    const c = firstClassifier('interface IFoo<T, U>');
    expect(c.kind).toBe('interface');
    expect(c.typeParams).toEqual(['T', 'U']);
  });

  it('parses generic type params — class Container<T>', () => {
    const c = firstClassifier('class Container<T>');
    expect(c.typeParams).toEqual(['T']);
    expect(c.id).toBe('Container');
    expect(c.display).toBe('Container');
  });

  it('parses stereotype — class Foo << Stereotype >>', () => {
    const c = firstClassifier('class Foo << Stereotype >>');
    expect(c.stereotype).toBe('Stereotype');
    expect(c.id).toBe('Foo');
  });

  it('parses color — class Foo #pink', () => {
    const c = firstClassifier('class Foo #pink');
    expect(c.color).toBe('#pink');
    expect(c.id).toBe('Foo');
  });

  it('parses quoted display name with alias — class "My Class" as MC', () => {
    const c = firstClassifier('class "My Class" as MC');
    expect(c.display).toBe('My Class');
    expect(c.id).toBe('MC');
  });

  it('multiple classifiers are all captured', () => {
    const ast = parse('class A\nclass B\ninterface C');
    expect(ast.classifiers).toHaveLength(3);
    expect(ast.classifiers[0]?.id).toBe('A');
    expect(ast.classifiers[1]?.id).toBe('B');
    expect(ast.classifiers[2]?.id).toBe('C');
  });
});

// ---------------------------------------------------------------------------
// Class body members
// ---------------------------------------------------------------------------

describe('class body members', () => {
  it('parses a method with return type from inline body', () => {
    const c = firstClassifier('class Foo { +bar(): String }');
    expect(c.members).toHaveLength(1);
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('+');
    expect(m.name).toBe('bar');
    expect(m.type).toBe('String');
    expect(m.params).toEqual([]);
    expect(m.isStatic).toBe(false);
    expect(m.isAbstract).toBe(false);
  });

  it('parses a private attribute', () => {
    const c = firstClassifier('class Foo {\n  -name: String\n}');
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('-');
    expect(m.name).toBe('name');
    expect(m.type).toBe('String');
    expect(m.params).toBeUndefined();
  });

  it('parses protected attribute', () => {
    const c = firstClassifier('class Foo {\n  #count: int\n}');
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('#');
    expect(m.name).toBe('count');
  });

  it('parses package-private (~) attribute', () => {
    const c = firstClassifier('class Foo {\n  ~value: int\n}');
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('~');
  });

  it('parses method with parameters', () => {
    const c = firstClassifier(
      'class Foo {\n  +doIt(x: int, y: String): void\n}',
    );
    const m = c.members[0] as Member;
    expect(m.name).toBe('doIt');
    expect(m.params).toEqual(['x: int', 'y: String']);
    expect(m.type).toBe('void');
  });

  it('parses {static} modifier', () => {
    const c = firstClassifier('class Foo {\n  {static} +count: int\n}');
    const m = c.members[0] as Member;
    expect(m.isStatic).toBe(true);
    expect(m.name).toBe('count');
  });

  it('parses {abstract} modifier', () => {
    const c = firstClassifier(
      'abstract class Base {\n  {abstract} +draw(): void\n}',
    );
    const m = c.members[0] as Member;
    expect(m.isAbstract).toBe(true);
    expect(m.name).toBe('draw');
    expect(m.params).toEqual([]);
  });

  it('member without explicit visibility defaults to "+"', () => {
    const c = firstClassifier('class Foo {\n  name: String\n}');
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('+');
  });

  it('collects multiple members in order', () => {
    const c = firstClassifier(
      'class Foo {\n  -id: int\n  +getName(): String\n}',
    );
    expect(c.members).toHaveLength(2);
    expect(c.members[0]?.name).toBe('id');
    expect(c.members[1]?.name).toBe('getName');
  });
});

// ---------------------------------------------------------------------------
// Standalone member syntax: ClassName : +member
// ---------------------------------------------------------------------------

describe('standalone member syntax', () => {
  it('adds a member to an existing classifier', () => {
    const ast = parse('class Foo\nFoo : +field: int');
    const c = ast.classifiers[0] as Classifier;
    expect(c.members).toHaveLength(1);
    const m = c.members[0] as Member;
    expect(m.visibility).toBe('+');
    expect(m.name).toBe('field');
    expect(m.type).toBe('int');
  });

  it('creates the classifier if it does not exist yet', () => {
    const ast = parse('Bar : -secret: String');
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]?.id).toBe('Bar');
    expect(ast.classifiers[0]?.members).toHaveLength(1);
  });

  it('adds a method via standalone syntax', () => {
    const ast = parse('class Foo\nFoo : +run(): void');
    const m = ast.classifiers[0]?.members[0] as Member;
    expect(m.name).toBe('run');
    expect(m.params).toEqual([]);
    expect(m.type).toBe('void');
  });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

describe('relationships — plain association', () => {
  it('A -- B → type=association, from=A, to=B (bare solid connector)', () => {
    const r = firstRelationship('A -- B');
    expect(r.type).toBe('association');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('self-loop A -- A parses one association', () => {
    const ast = parse('A -- A');
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.from).toBe('A');
    expect(ast.relationships[0]!.to).toBe('A');
  });

  it('does not shadow longer --x tokens (--> stays association, --|> extension)', () => {
    expect(firstRelationship('A --> B').type).toBe('association');
    expect(firstRelationship('A --|> B').type).toBe('extension');
  });
});

describe('association-class couple — (A,B) .. C', () => {
  it('synthesises a circle connector with A→circle→B and circle→C edges', () => {
    const ast = parse('class A\nclass B\n(A,B) .. C');
    const circle = ast.classifiers.find((c) => c.kind === 'assoc-circle');
    expect(circle).toBeDefined();
    // A, B, C dedup with declarations / auto-create; only one circle added.
    expect(ast.classifiers.filter((c) => c.kind === 'assoc-circle')).toHaveLength(1);
    // Three edges: A→circle (len 2), circle→B (len 2), circle→C (len 1 → minlen 0).
    const edges = ast.relationships;
    expect(edges).toHaveLength(3);
    expect(edges.find((e) => e.from === 'A' && e.to === circle!.id)?.length).toBe(2);
    expect(edges.find((e) => e.from === circle!.id && e.to === 'B')?.length).toBe(2);
    expect(edges.find((e) => e.from === circle!.id && e.to === 'C')?.length).toBe(1);
  });

  it('handles the trailing form C .. (A,B)', () => {
    const ast = parse('class A\nclass B\nC .. (A,B)');
    expect(ast.classifiers.filter((c) => c.kind === 'assoc-circle')).toHaveLength(1);
    expect(ast.relationships).toHaveLength(3);
  });

  it('subsumes an explicit A--B association and moves its multiplicities', () => {
    const ast = parse('class A\nclass B\nA "0..*" -- "1" B\n(A,B) . C');
    const circle = ast.classifiers.find((c) => c.kind === 'assoc-circle')!;
    // The explicit A--B edge is gone; only the 3 couple edges remain.
    expect(ast.relationships).toHaveLength(3);
    expect(
      ast.relationships.some((r) => r.from === 'A' && r.to === 'B'),
    ).toBe(false);
    // Multiplicities move to the tail (A→circle) and head (circle→B) edges.
    expect(ast.relationships.find((r) => r.from === 'A' && r.to === circle.id)?.fromMultiplicity)
      .toBe('0..*');
    expect(ast.relationships.find((r) => r.from === circle.id && r.to === 'B')?.toMultiplicity)
      .toBe('1');
  });

  it('a self-couple (A,A) places the class-link one rank down (length 2)', () => {
    const ast = parse('class A\nA -- A\n(A,A) . C');
    const circle = ast.classifiers.find((c) => c.kind === 'assoc-circle')!;
    expect(ast.relationships.find((r) => r.from === circle.id && r.to === 'C')?.length).toBe(2);
  });

  it('double couple (A,B) . (C,D) makes two circles joined by a visible edge', () => {
    const ast = parse('class A\nclass B\nclass C\n(A,B) . (A,C)');
    const circles = ast.classifiers.filter((c) => c.kind === 'assoc-circle');
    expect(circles).toHaveLength(2);
    // no invisible edge here (different pairs); one visible circle→circle edge
    expect(ast.relationships.filter((r) => r.invis === true)).toHaveLength(0);
    const ids = new Set(circles.map((c) => c.id));
    const link = ast.relationships.find((r) => ids.has(r.from) && ids.has(r.to));
    expect(link?.length).toBe(1); // minlen 0
  });

  it('two couples on the same (A,B) get one circle each + an invis link', () => {
    const ast = parse('class R1\nclass R2\nA--B\nR1 .. (A,B)\n(A,B) .. R2');
    const circles = ast.classifiers.filter((c) => c.kind === 'assoc-circle');
    expect(circles).toHaveLength(2);
    // exactly one invisible constraint edge, between the two circles
    const invis = ast.relationships.filter((r) => r.invis === true);
    expect(invis).toHaveLength(1);
    const ids = new Set(circles.map((c) => c.id));
    expect(ids.has(invis[0]!.from) && ids.has(invis[0]!.to)).toBe(true);
  });
});

describe('association diamond — <> name', () => {
  it('<> name declares an association-kind classifier (rendered as a diamond)', () => {
    const ast = parse('<> diamond');
    const c = ast.classifiers.find((cl) => cl.id === 'diamond');
    expect(c?.kind).toBe('association');
  });

  it('a relationship endpoint keeps the association kind (not overwritten to class)', () => {
    // `<> d` first, then `A . d` auto-refs d — d must stay association.
    const ast = parse('<> d\nclass A\nA . d');
    expect(ast.classifiers.find((cl) => cl.id === 'd')?.kind).toBe('association');
  });
});

describe('relationships — arrow length (drives dot minlen)', () => {
  // length = count of body chars (`-`/`.`/`=`); dot minlen = length - 1.
  it('single-dash arrows have length 1 (minlen 0)', () => {
    expect(firstRelationship('A -> B').length).toBe(1);
    expect(firstRelationship('A - B').length).toBe(1);
  });

  it('double-dash arrows have length 2 (minlen 1)', () => {
    expect(firstRelationship('A --> B').length).toBe(2);
    expect(firstRelationship('A ..> B').length).toBe(2);
    expect(firstRelationship('A *-- B').length).toBe(2);
  });

  it('longer arrows have proportional length', () => {
    expect(firstRelationship('A ---> B').length).toBe(3);
    expect(firstRelationship('A ----> B').length).toBe(4);
  });

  it('horizontal (left/right) links parse with length 1 (minlen 0)', () => {
    expect(firstRelationship('A -left- B').length).toBe(1);
    expect(firstRelationship('A -right- B').length).toBe(1);
    expect(firstRelationship('A -l- B').length).toBe(1);
    // Orientation does not change the relationship type.
    expect(firstRelationship('A *-left- B').type).toBe('composition');
    expect(firstRelationship('A -left- B').type).toBe('association');
  });

  it('vertical (up/down) links keep body-count length', () => {
    expect(firstRelationship('A -up- B').length).toBe(2);
    expect(firstRelationship('A -down- B').length).toBe(2);
    expect(firstRelationship('A -down-- B').length).toBe(3);
  });

  it('the o aggregation head is not mistaken for an orientation word', () => {
    expect(firstRelationship('A o-- B').type).toBe('aggregation');
    expect(firstRelationship('A --o B').type).toBe('aggregation');
  });
});

describe('relationships — extension', () => {
  it('A <|-- B → type=extension, from=B, to=A', () => {
    const r = firstRelationship('A <|-- B');
    expect(r.type).toBe('extension');
    expect(r.from).toBe('B');
    expect(r.to).toBe('A');
  });

  it('right-hand form A --|> B → type=extension, from=A, to=B', () => {
    const r = firstRelationship('A --|> B');
    expect(r.type).toBe('extension');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('relationships — implementation', () => {
  it('A <|.. B → type=implementation, from=B, to=A', () => {
    const r = firstRelationship('A <|.. B');
    expect(r.type).toBe('implementation');
    expect(r.from).toBe('B');
    expect(r.to).toBe('A');
  });
});

describe('relationships — composition', () => {
  it('A *-- B → type=composition, from=A, to=B', () => {
    const r = firstRelationship('A *-- B');
    expect(r.type).toBe('composition');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('multiplicity on right side: A *-- "1..n" B', () => {
    const r = firstRelationship('A *-- "1..n" B');
    expect(r.type).toBe('composition');
    expect(r.toMultiplicity).toBe('1..n');
  });

  it('multiplicity on both sides: A "1" *-- "0..n" B', () => {
    const r = firstRelationship('A "1" *-- "0..n" B');
    expect(r.fromMultiplicity).toBe('1');
    expect(r.toMultiplicity).toBe('0..n');
  });
});

describe('relationships — aggregation', () => {
  it('A o-- B → type=aggregation, from=A, to=B', () => {
    const r = firstRelationship('A o-- B');
    expect(r.type).toBe('aggregation');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('relationships — dependency', () => {
  it('A ..> B → type=dependency, from=A, to=B', () => {
    const r = firstRelationship('A ..> B');
    expect(r.type).toBe('dependency');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('relationships — association', () => {
  it('A --> B → type=association, from=A, to=B', () => {
    const r = firstRelationship('A --> B');
    expect(r.type).toBe('association');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('relationships — usage', () => {
  it('A .. B → type=usage, from=A, to=B', () => {
    const r = firstRelationship('A .. B');
    expect(r.type).toBe('usage');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('relationships — label', () => {
  it('label is captured after colon', () => {
    const r = firstRelationship('A --> B : uses');
    expect(r.label).toBe('uses');
  });

  it('no label → label is absent', () => {
    const r = firstRelationship('A --> B');
    expect(r.label).toBeUndefined();
  });
});

describe('relationships — auto-creating classifiers', () => {
  it('both sides of a relationship are registered as classifiers', () => {
    const ast = parse('Foo --> Bar');
    const ids = ast.classifiers.map((c) => c.id);
    expect(ids).toContain('Foo');
    expect(ids).toContain('Bar');
  });
});

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

describe('namespaces', () => {
  it('dotted namespace block creates a nested Namespace chain', () => {
    // A dotted name splits on the separator into nested namespaces, mirroring
    // upstream's Quark hierarchy: `com.example` → `com` > `com.example`.
    const ast = parse('namespace com.example {\n  class Foo\n}');
    expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['com', 'com.example']);
    const inner = ast.namespaces.find((n) => n.id === 'com.example');
    expect(inner?.parentId).toBe('com');
  });

  it('classifiers inside namespace get a fully-qualified id + namespace', () => {
    // Qualified identity: `class Foo` inside `com.example` → id
    // `com.example.Foo`, display `Foo`, namespace `com.example`.
    const ast = parse('namespace com.example {\n  class Foo\n}');
    const c = ast.classifiers.find((cl) => cl.id === 'com.example.Foo');
    expect(c?.display).toBe('Foo');
    expect(c?.namespace).toBe('com.example');
  });

  it('namespace classifiers list contains the qualified classifier id', () => {
    const ast = parse('namespace com.example {\n  class Foo\n  class Bar\n}');
    const ns = ast.namespaces.find((n) => n.id === 'com.example');
    expect(ns?.classifiers).toContain('com.example.Foo');
    expect(ns?.classifiers).toContain('com.example.Bar');
  });

  it('non-dotted namespace stays flat (single top-level entry)', () => {
    const ast = parse('namespace ns {\n  class Foo\n}');
    expect(ast.namespaces).toHaveLength(1);
    expect(ast.namespaces[0]?.id).toBe('ns');
    expect(ast.namespaces[0]?.parentId).toBeUndefined();
  });

  it('dotted class name at root creates implicit nested namespaces', () => {
    // `java.lang.Object` with no enclosing block → namespaces java > java.lang
    // holding leaf `Object` (default separator `.`).
    const ast = parse('class java.lang.Object');
    expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['java', 'java.lang']);
    const inner = ast.namespaces.find((n) => n.id === 'java.lang');
    expect(inner?.parentId).toBe('java');
    expect(inner?.classifiers).toContain('java.lang.Object');
    const leaf = ast.classifiers.find((c) => c.id === 'java.lang.Object');
    expect(leaf?.display).toBe('Object');
  });

  it('set namespaceSeparator changes the split separator', () => {
    const ast = parse('set namespaceSeparator ::\nclass X::Y::c1');
    expect(ast.namespaces.map((n) => n.id).sort()).toEqual(['X', 'X::Y']);
    expect(ast.classifiers.find((c) => c.id === 'X::Y::c1')?.display).toBe('c1');
  });

  it('set separator none disables namespace splitting', () => {
    const ast = parse('set separator none\nclass a.b.c');
    expect(ast.namespaces).toHaveLength(0);
    expect(ast.classifiers.find((c) => c.id === 'a.b.c')).toBeDefined();
  });

  it('useIntermediatePackages false collapses to a single namespace', () => {
    const ast = parse('!pragma useIntermediatePackages false\nclass A.B.C.Z {\n}');
    // No intermediate A / A.B / A.B.C — one namespace of the whole qualifier.
    expect(ast.namespaces.map((n) => n.id)).toEqual(['A.B.C']);
    expect(ast.namespaces[0]?.parentId).toBeUndefined();
    expect(ast.namespaces[0]?.classifiers).toContain('A.B.C.Z');
  });

  // Namespace-aware reference resolution (verified against the class DOT oracle).
  it('dotted name inside a block nests relative to it (pukuzu)', () => {
    const ast = parse('namespace issues {\n  f1.function.Fox <|-- Rabbit\n}');
    const ids = ast.namespaces.map((n) => n.id).sort();
    expect(ids).toEqual(['issues', 'issues.f1', 'issues.f1.function']);
    // Fox nests under issues; Rabbit is a direct local member of issues.
    expect(ast.classifiers.find((c) => c.id === 'issues.f1.function.Fox')).toBeDefined();
    expect(ast.classifiers.find((c) => c.id === 'issues.Rabbit')).toBeDefined();
    // Both endpoints resolve to their qualified ids (arrow orders from/to).
    const rel = ast.relationships[0];
    expect([rel?.from, rel?.to].sort()).toEqual(
      ['issues.Rabbit', 'issues.f1.function.Fox'].sort(),
    );
  });

  it('dotted ref is absolute when first segment is an existing ns (bivevo)', () => {
    const ast = parse(
      'namespace classic.collections {\n  class ArrayList\n}\n' +
        'namespace net.sourceforge.plantuml {\n' +
        '  classic.collections.ArrayList <|-- ArrayList\n}',
    );
    // `classic.collections.ArrayList` resolves ABSOLUTE (a `classic` ns exists),
    // not re-nested under net.sourceforge.plantuml; the two ArrayLists are
    // distinct nodes.
    expect(ast.classifiers.find((c) => c.id === 'classic.collections.ArrayList')).toBeDefined();
    expect(ast.classifiers.find((c) => c.id === 'net.sourceforge.plantuml.ArrayList')).toBeDefined();
  });

  it('dotted ref is relative when first segment is unknown (paziji)', () => {
    const ast = parse(
      'namespace net.sourceforge.plantuml {\n' +
        '  classic.collections.ArrayList <|-- net.sourceforge.plantuml.ArrayList\n}',
    );
    // No `classic` ns → relative → nested under net.sourceforge.plantuml.
    expect(
      ast.classifiers.find(
        (c) => c.id === 'net.sourceforge.plantuml.classic.collections.ArrayList',
      ),
    ).toBeDefined();
    // Self-prefixed ref → the leaf in the current namespace (absolute-to-self).
    expect(ast.classifiers.find((c) => c.id === 'net.sourceforge.plantuml.ArrayList')).toBeDefined();
  });

  it('same short name in two namespaces are distinct nodes (lozijo)', () => {
    const ast = parse(
      'namespace issues {\n  f1.function.Fox <|-- Rabbit\n}\n' +
        'namespace f1.function {\n  class Fox\n}',
    );
    expect(ast.classifiers.find((c) => c.id === 'issues.f1.function.Fox')).toBeDefined();
    expect(ast.classifiers.find((c) => c.id === 'f1.function.Fox')).toBeDefined();
  });

  it('members of a quoted package name with spaces stay in the package', () => {
    // The qualified id "Voici mon package.foo" contains spaces; it must not be
    // rejected as decoration — foo belongs to the package cluster.
    const ast = parse('package "Voici mon package" {\n  class foo\n}');
    const ns = ast.namespaces.find((n) => n.id === 'Voici mon package');
    expect(ns?.classifiers).toContain('Voici mon package.foo');
    expect(ast.classifiers.find((c) => c.id === 'Voici mon package.foo')?.display).toBe('foo');
  });

  it('classifiers outside namespace have no namespace property', () => {
    const ast = parse('class Outer\nnamespace ns {\n  class Inner\n}');
    const outer = ast.classifiers.find((c) => c.id === 'Outer');
    expect(outer?.namespace).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Ignored lines
// ---------------------------------------------------------------------------

describe('ignored lines', () => {
  it('skinparam lines are ignored', () => {
    const ast = parse('skinparam classBackgroundColor white\nclass Foo');
    expect(ast.classifiers).toHaveLength(1);
  });

  it('hide empty members is parsed as a directive (not silently dropped)', () => {
    const ast = parse('hide empty members\nclass Foo');
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.directives).toHaveLength(1);
    expect(ast.directives[0]?.action).toBe('hide');
    expect(ast.directives[0]?.target).toBe('empty members');
  });

  it("comment lines starting with ' are ignored", () => {
    const ast = parse("' this is a comment\nclass Foo");
    expect(ast.classifiers).toHaveLength(1);
  });

  it('blank lines are ignored', () => {
    const ast = parse('class Foo\n\n\nclass Bar');
    expect(ast.classifiers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Additional relationship arrow forms
// ---------------------------------------------------------------------------

describe('relationships — reverse composition/aggregation', () => {
  it('A --* B → type=composition, from=A, to=B (right-pointing *)', () => {
    const r = firstRelationship('A --* B');
    expect(r.type).toBe('composition');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('A --o B → type=aggregation, from=A, to=B (right-pointing o)', () => {
    const r = firstRelationship('A --o B');
    expect(r.type).toBe('aggregation');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('A ..|> B → type=implementation, from=A, to=B (right-pointing ..)', () => {
    const r = firstRelationship('A ..|> B');
    expect(r.type).toBe('implementation');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Unquoted alias form
// ---------------------------------------------------------------------------

describe('classifier — unquoted alias', () => {
  it('class Foo as Bar → id=Bar, display=Foo', () => {
    const c = firstClassifier('class Foo as Bar');
    expect(c.id).toBe('Bar');
    expect(c.display).toBe('Foo');
  });

  it('interface IBase as IB → id=IB, display=IBase', () => {
    const c = firstClassifier('interface IBase as IB');
    expect(c.id).toBe('IB');
    expect(c.display).toBe('IBase');
  });
});

// ---------------------------------------------------------------------------
// Empty inline body
// ---------------------------------------------------------------------------

describe('classifier — empty inline body', () => {
  it('class Foo {} → no members, body not opened', () => {
    const c = firstClassifier('class Foo {}');
    expect(c.id).toBe('Foo');
    expect(c.members).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Default AST shape
// ---------------------------------------------------------------------------

describe('default AST shape', () => {
  it('empty input returns empty AST', () => {
    const ast = parse('');
    expect(ast.classifiers).toEqual([]);
    expect(ast.relationships).toEqual([]);
    expect(ast.namespaces).toEqual([]);
    expect(ast.directives).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Hide/show directives — parsing
// ---------------------------------------------------------------------------

describe('hide/show directives — parsing', () => {
  it('hide empty members stores directive', () => {
    const ast = parse('hide empty members\nclass Foo');
    expect(ast.directives).toHaveLength(1);
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'hide',
      target: 'empty members',
    });
  });

  it('hide members stores directive', () => {
    const ast = parse('hide members\nclass Foo');
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'hide',
      target: 'members',
    });
  });

  it('hide circle stores directive', () => {
    const ast = parse('hide circle\nclass Foo');
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'hide',
      target: 'circle',
    });
  });

  it('hide empty fields stores directive', () => {
    const ast = parse('hide empty fields\nclass Foo');
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'hide',
      target: 'empty fields',
    });
  });

  it('hide empty methods stores directive', () => {
    const ast = parse('hide empty methods\nclass Foo');
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'hide',
      target: 'empty methods',
    });
  });

  it('show empty members stores show directive', () => {
    const ast = parse('show empty members\nclass Foo');
    expect(ast.directives[0]).toEqual({
      kind: 'hideshow',
      action: 'show',
      target: 'empty members',
    });
  });

  it('multiple directives are all stored in order', () => {
    const ast = parse('hide members\nhide circle\nclass Foo');
    expect(ast.directives).toHaveLength(2);
    expect(ast.directives[0]?.target).toBe('members');
    expect(ast.directives[1]?.target).toBe('circle');
  });

  it('unrecognised hide target is silently ignored', () => {
    const ast = parse('hide something_unknown\nclass Foo');
    expect(ast.directives).toHaveLength(0);
    expect(ast.classifiers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Hide/show directives — post-processing applied to AST
// ---------------------------------------------------------------------------

describe('hide/show directives — effect on AST', () => {
  it('hide members marks all members hidden on a class with members', () => {
    const ast = parse(
      'hide members\nclass Foo {\n  +name: String\n  +run(): void\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    expect(c.members).toHaveLength(2);
    expect(c.members[0]?.hidden).toBe(true);
    expect(c.members[1]?.hidden).toBe(true);
  });

  it('hide members leaves the classifier present in the AST', () => {
    const ast = parse('hide members\nclass Foo {\n  +name: String\n}');
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]?.id).toBe('Foo');
  });

  it('hide circle sets hideCircle on all classifiers', () => {
    const ast = parse('hide circle\nclass Foo\ninterface Bar');
    expect(ast.classifiers[0]?.hideCircle).toBe(true);
    expect(ast.classifiers[1]?.hideCircle).toBe(true);
  });

  it('hide empty members does not mark members hidden when class has members', () => {
    const ast = parse(
      'hide empty members\nclass Foo {\n  +name: String\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    expect(c.members[0]?.hidden).toBeUndefined();
  });

  it('show after hide — last directive wins for the same target', () => {
    const ast = parse(
      'hide members\nshow members\nclass Foo {\n  +name: String\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    // show wins — members should not be hidden
    expect(c.members[0]?.hidden).toBeUndefined();
  });

  it('hide after show — last directive wins for the same target', () => {
    const ast = parse(
      'show members\nhide members\nclass Foo {\n  +name: String\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    expect(c.members[0]?.hidden).toBe(true);
  });

  it('no hide/show directives → members have no hidden flag', () => {
    const ast = parse('class Foo {\n  +name: String\n}');
    const c = ast.classifiers[0] as Classifier;
    expect(c.members[0]?.hidden).toBeUndefined();
    expect(c.hideCircle).toBeUndefined();
  });

  it('no hide/show directives → directives array is empty', () => {
    const ast = parse('class Foo');
    expect(ast.directives).toEqual([]);
  });

  it('hide circle does not affect member hidden flags', () => {
    const ast = parse(
      'hide circle\nclass Foo {\n  +name: String\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    expect(c.hideCircle).toBe(true);
    expect(c.members[0]?.hidden).toBeUndefined();
  });

  it('hide empty fields marks attributes hidden when class has no attributes', () => {
    const ast = parse(
      'hide empty fields\nclass Foo {\n  +run(): void\n}',
    );
    // Foo has only a method, no attributes — but hide empty fields does not affect
    // methods; the class has no fields to hide so nothing gets marked hidden
    const c = ast.classifiers[0] as Classifier;
    expect(c.members[0]?.hidden).toBeUndefined();
  });

  it('hide empty methods marks methods hidden when class has no methods', () => {
    const ast = parse(
      'hide empty methods\nclass Foo {\n  +name: String\n}',
    );
    // Foo has only an attribute, no methods — but hide empty methods does not
    // affect attributes; the class has no methods to hide
    const c = ast.classifiers[0] as Classifier;
    expect(c.members[0]?.hidden).toBeUndefined();
  });

  it('hide members combined with hide circle — both applied independently', () => {
    const ast = parse(
      'hide members\nhide circle\nclass Foo {\n  +name: String\n}',
    );
    const c = ast.classifiers[0] as Classifier;
    expect(c.hideCircle).toBe(true);
    expect(c.members[0]?.hidden).toBe(true);
  });
});

describe('notes on entity', () => {
  it('single-line: note left of Alice : hello', () => {
    const ast = parse('class Alice\nnote left of Alice : hello');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Alice', position: 'left', text: 'hello' });
    expect(ast.notes[0]!.id).toMatch(/^__note_/);
    // Host classifier still parsed; note is not a classifier.
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Alice']);
  });

  it('each position parses (right/top/bottom)', () => {
    const ast = parse(
      'class A\nnote right of A : r\nnote top of A : t\nnote bottom of A : b',
    );
    expect(ast.notes.map((n) => n.position)).toEqual(['right', 'top', 'bottom']);
  });

  it('multi-line: note … end note captures the body with newlines', () => {
    const ast = parse('class A\nnote top of A\nline1\nline2\nend note');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]!.text).toBe('line1\nline2');
    expect(ast.notes[0]!.position).toBe('top');
  });

  it('coexists with classifiers and relationships (does not eat the edge)', () => {
    const ast = parse(
      'class User\nnote right of User\nbody\nend note\nclass Role\nUser -- Role',
    );
    expect(ast.classifiers.map((c) => c.id)).toEqual(['User', 'Role']);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.notes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T5a — Class::member port syntax (Category 1)
// ---------------------------------------------------------------------------

describe('relationships — Class::member port syntax', () => {
  it('ClassB::b <-- pack.ClassA::a connects the two CLASSIFIERS, not phantom ids', () => {
    const ast = parse('ClassB::b <-- pack.ClassA::a');
    expect(ast.relationships).toHaveLength(1);
    const r = ast.relationships[0]!;
    expect(r.from).toBe('pack.ClassA');
    expect(r.to).toBe('ClassB');
    expect(r.fromPort).toBe('a');
    expect(r.toPort).toBe('b');
    expect(ast.classifiers.map((c) => c.id)).toEqual(['pack.ClassA', 'ClassB']);
  });

  it('does not create a member from the port suffix (regression: rule 7 no longer swallows "::")', () => {
    const ast = parse('ClassB::b <-- pack.ClassA::a');
    const classB = ast.classifiers.find((c) => c.id === 'ClassB');
    expect(classB?.members).toEqual([]);
  });

  it('dotted-namespace endpoint without a port still parses (pack.ClassC::c <-- ClassB::b)', () => {
    const r = firstRelationship('pack.ClassC::c <-- ClassB::b');
    expect(r.from).toBe('ClassB');
    expect(r.to).toBe('pack.ClassC');
    expect(r.fromPort).toBe('b');
    expect(r.toPort).toBe('c');
  });

  it('port-free endpoints have fromPort/toPort undefined', () => {
    const r = firstRelationship('A --> B');
    expect(r.fromPort).toBeUndefined();
    expect(r.toPort).toBeUndefined();
  });

  it('full fixture (cidepu-54-bemo048): 3 relationships, 3 classifiers', () => {
    const ast = parse(
      'class pack.ClassA {\na\n}\nClassB::b <-- pack.ClassA::a\npack.ClassC::c <-- ClassB::b\npack.ClassC::c <-- pack.ClassA::a',
    );
    expect(ast.classifiers.map((c) => c.id)).toEqual([
      'pack.ClassA',
      'ClassB',
      'pack.ClassC',
    ]);
    expect(ast.relationships).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// T5a — Freestanding notes (Category 3)
// ---------------------------------------------------------------------------

describe('notes — freestanding (note as ALIAS ... end note)', () => {
  it('creates a note with id=alias, target and position undefined', () => {
    const ast = parse('note as N3\nsome text\nend note');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ id: 'N3', text: 'some text' });
    expect(ast.notes[0]!.target).toBeUndefined();
    expect(ast.notes[0]!.position).toBeUndefined();
  });

  it('multi-line body is joined with newlines', () => {
    const ast = parse('note as N4\nline one\nline two\nend note');
    expect(ast.notes[0]!.text).toBe('line one\nline two');
  });

  it('a later relationship line referencing the alias does not create a phantom classifier', () => {
    const ast = parse(
      'class DrawableAdapter\nnote as N4\nbody\nend note\nN4 .> DrawableAdapter',
    );
    expect(ast.classifiers.map((c) => c.id)).toEqual(['DrawableAdapter']);
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]).toMatchObject({
      from: 'N4',
      to: 'DrawableAdapter',
      type: 'dependency',
    });
  });

  it('a note body line that looks like a classifier decl is not re-parsed (no phantom classifier)', () => {
    const ast = parse(
      'note as N1\nThe session package is the primary\nseparation layer between the user\ninterface and the simulator.\nend note',
    );
    expect(ast.classifiers).toEqual([]);
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]!.text).toBe(
      'The session package is the primary\nseparation layer between the user\ninterface and the simulator.',
    );
  });
});

// ---------------------------------------------------------------------------
// T5a — Bracket-qualifier relationship syntax (Category 4)
// ---------------------------------------------------------------------------

describe('relationships — bracket qualifier syntax', () => {
  it('class1 [Qualifier] <-- class2 attaches the qualifier to class1 (the to)', () => {
    const ast = parse('class class1\nclass class2\nclass1 [Qualifier] <-- class2');
    expect(ast.relationships).toHaveLength(1);
    const r = ast.relationships[0]!;
    expect(r.from).toBe('class2');
    expect(r.to).toBe('class1');
    // `<--` swaps: class1 is the `to`, so the qualifier is on the to side.
    expect(r.toQualifier).toBe('Qualifier');
    expect(r.fromQualifier).toBeUndefined();
  });

  it('qualifier-free relationships have both qualifier sides undefined', () => {
    const r = firstRelationship('A --> B');
    expect(r.fromQualifier).toBeUndefined();
    expect(r.toQualifier).toBeUndefined();
  });

  it('qualifier on the right endpoint attaches to the to (A --> [Right] B)', () => {
    const r = firstRelationship('A --> [Right] B');
    expect(r.toQualifier).toBe('Right');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// T5a — Additional arrow-body variants (bare left-pointing + dotted lengths)
// ---------------------------------------------------------------------------

describe('relationships — additional arrow-body variants', () => {
  it('A <-- B → type=association, from=B, to=A (bare left-pointing arrow)', () => {
    const r = firstRelationship('A <-- B');
    expect(r.type).toBe('association');
    expect(r.from).toBe('B');
    expect(r.to).toBe('A');
  });

  it('A <.. B → type=dependency, from=B, to=A (bare left-pointing dotted arrow)', () => {
    const r = firstRelationship('A <.. B');
    expect(r.type).toBe('dependency');
    expect(r.from).toBe('B');
    expect(r.to).toBe('A');
  });

  it('A -> B → type=association, from=A, to=B (single-dash body)', () => {
    const r = firstRelationship('A -> B');
    expect(r.type).toBe('association');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('A .> B → type=dependency, from=A, to=B (single-dot body)', () => {
    const r = firstRelationship('A .> B');
    expect(r.type).toBe('dependency');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('A ...> B → type=dependency, from=A, to=B (triple-dot body)', () => {
    const r = firstRelationship('A ...> B');
    expect(r.type).toBe('dependency');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// Leading-dot (root-namespace) relationship endpoints — mission A3 Batch 1b
// ---------------------------------------------------------------------------

describe('leading-dot root-namespace relationship endpoints', () => {
  it('resolves `.BaseClass` in a namespace to the root classifier, not dropping the edge', () => {
    const ast = parse(`class BaseClass
namespace ns {
  class Person
  .BaseClass <|-- Person
}`);
    // The edge must exist (previously dropped because the endpoint regex rejected
    // a leading dot) and connect the root BaseClass to ns.Person.
    const edge = ast.relationships.find(
      (r) => r.type === 'extension' && r.to === 'BaseClass',
    );
    expect(edge).toBeDefined();
    expect(edge!.from).toBe('ns.Person');
    expect(edge!.to).toBe('BaseClass');
  });

  it('keeps internal-dot (fully-qualified) endpoints working', () => {
    const r = firstRelationship('a.b.C <|-- a.b.D');
    expect(r.type).toBe('extension');
    expect(r.from).toBe('a.b.D');
    expect(r.to).toBe('a.b.C');
  });
});

// ---------------------------------------------------------------------------
// Decoration + arrowhead arrows and keyword-named-class relationships (A3 T2.2)
// ---------------------------------------------------------------------------

describe('decoration-plus-arrowhead arrows', () => {
  it('A o--> B → aggregation, from=A, to=B', () => {
    const r = firstRelationship('A o--> B');
    expect(r.type).toBe('aggregation');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });

  it('A *--> B → composition, from=A, to=B', () => {
    const r = firstRelationship('A *--> B');
    expect(r.type).toBe('composition');
    expect(r.from).toBe('A');
    expect(r.to).toBe('B');
  });
});

describe('class named after a keyword used in a relationship', () => {
  it('parses `CLASS *-- f1` as a relationship, not a declaration named `*-- f1`', () => {
    const ast = parse(`class CLASS {
foo
}
CLASS *-- f1
CLASS o--> f3
CLASS <|-- f4`);
    // 4 classifiers: CLASS, f1, f3, f4 — NOT a classifier named "*-- f1"
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual([
      'CLASS',
      'f1',
      'f3',
      'f4',
    ]);
    // 3 relationships, all anchored on CLASS
    expect(ast.relationships).toHaveLength(3);
    const types = ast.relationships.map((r) => r.type).sort();
    expect(types).toEqual(['aggregation', 'composition', 'extension']);
  });
});
