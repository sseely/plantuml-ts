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
  it('namespace block creates a Namespace entry', () => {
    const ast = parse('namespace com.example {\n  class Foo\n}');
    expect(ast.namespaces).toHaveLength(1);
    expect(ast.namespaces[0]?.id).toBe('com.example');
  });

  it('classifiers inside namespace have namespace property set', () => {
    const ast = parse('namespace com.example {\n  class Foo\n}');
    const c = ast.classifiers.find((cl) => cl.id === 'Foo');
    expect(c?.namespace).toBe('com.example');
  });

  it('namespace classifiers list contains the classifier id', () => {
    const ast = parse('namespace com.example {\n  class Foo\n  class Bar\n}');
    const ns = ast.namespaces[0];
    expect(ns?.classifiers).toContain('Foo');
    expect(ns?.classifiers).toContain('Bar');
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
