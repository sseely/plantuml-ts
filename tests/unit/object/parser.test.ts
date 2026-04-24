import { describe, it, expect } from 'vitest';
import { parseObject } from '../../../src/diagrams/object/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function src(lines: string[]): UmlSource {
  return { lines, type: 'object' };
}

// ---------------------------------------------------------------------------
// 1. Basic object declaration — no body
// ---------------------------------------------------------------------------

describe('parseObject — bare object declaration', () => {
  it('creates a classifier with kind object', () => {
    const ast = parseObject(src(['object Foo']));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.kind).toBe('object');
    expect(ast.classifiers[0]!.id).toBe('Foo');
    expect(ast.classifiers[0]!.display).toBe('Foo');
    expect(ast.classifiers[0]!.members).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Quoted display name with alias
// ---------------------------------------------------------------------------

describe('parseObject — quoted display and alias', () => {
  it('sets display and id separately', () => {
    const ast = parseObject(src(['"User : Alice" as alice']));
    // Line doesn't start with "object" so it should be ignored
    expect(ast.classifiers).toHaveLength(0);
  });

  it('parses object with quoted display and alias', () => {
    const ast = parseObject(src(['object "User : Alice" as alice']));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.id).toBe('alice');
    expect(ast.classifiers[0]!.display).toBe('User : Alice');
  });
});

// ---------------------------------------------------------------------------
// 3. Multi-line body with field = value
// ---------------------------------------------------------------------------

describe('parseObject — multi-line body', () => {
  it('parses field = value members', () => {
    const ast = parseObject(src([
      'object Alice {',
      '  firstName = Alice',
      '  age = 30',
      '}',
    ]));
    expect(ast.classifiers).toHaveLength(1);
    const c = ast.classifiers[0]!;
    expect(c.members).toHaveLength(2);
    expect(c.members[0]!.name).toBe('firstName');
    expect(c.members[0]!.type).toBe('Alice');
    expect(c.members[0]!.visibility).toBe('+');
    expect(c.members[0]!.isStatic).toBe(false);
    expect(c.members[0]!.isAbstract).toBe(false);
    expect(c.members[1]!.name).toBe('age');
    expect(c.members[1]!.type).toBe('30');
  });

  it('parses bare field name with no value', () => {
    const ast = parseObject(src([
      'object Thing {',
      '  name',
      '}',
    ]));
    const c = ast.classifiers[0]!;
    expect(c.members).toHaveLength(1);
    expect(c.members[0]!.name).toBe('name');
    expect(c.members[0]!.type).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Inline single-line body
// ---------------------------------------------------------------------------

describe('parseObject — inline body', () => {
  it('parses fields from { } on the same line', () => {
    const ast = parseObject(src(['object Foo { x = 1; y = 2 }']));
    const c = ast.classifiers[0]!;
    expect(c.members).toHaveLength(2);
    expect(c.members[0]!.name).toBe('x');
    expect(c.members[0]!.type).toBe('1');
    expect(c.members[1]!.name).toBe('y');
    expect(c.members[1]!.type).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// 5. Relationship parsing
// ---------------------------------------------------------------------------

describe('parseObject — relationships', () => {
  it('parses --> association between two objects', () => {
    const ast = parseObject(src([
      'object Alice',
      'object Bob',
      'Alice --> Bob : knows',
    ]));
    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    expect(rel.from).toBe('Alice');
    expect(rel.to).toBe('Bob');
    expect(rel.type).toBe('association');
    expect(rel.label).toBe('knows');
  });

  it('auto-creates classifiers referenced only in relationships', () => {
    const ast = parseObject(src(['Alice --> Bob']));
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['Alice', 'Bob']);
  });

  it('parses composition *-- relationship', () => {
    const ast = parseObject(src(['Whole *-- Part']));
    expect(ast.relationships[0]!.type).toBe('composition');
    expect(ast.relationships[0]!.from).toBe('Whole');
    expect(ast.relationships[0]!.to).toBe('Part');
  });

  it('parses dependency ..> relationship', () => {
    const ast = parseObject(src(['A ..> B']));
    expect(ast.relationships[0]!.type).toBe('dependency');
  });

  it('parses multiplicity labels', () => {
    const ast = parseObject(src(['Alice "1" --> "*" Bob']));
    const rel = ast.relationships[0]!;
    expect(rel.fromMultiplicity).toBe('1');
    expect(rel.toMultiplicity).toBe('*');
  });

  it('parses relationship with quoted identifier (stripQuotes true branch)', () => {
    const ast = parseObject(src(['"Foo" --> Bar']));
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.from).toBe('Foo');
    expect(ast.relationships[0]!.to).toBe('Bar');
  });

  it('parses <|-- extension (swapDirection true)', () => {
    const ast = parseObject(src(['Child <|-- Parent']));
    expect(ast.relationships).toHaveLength(1);
    expect(ast.relationships[0]!.type).toBe('extension');
    expect(ast.relationships[0]!.from).toBe('Parent');
    expect(ast.relationships[0]!.to).toBe('Child');
  });
});

// ---------------------------------------------------------------------------
// 5b. Edge cases in the main parse loop
// ---------------------------------------------------------------------------

describe('parseObject — parse loop edge cases', () => {
  it('skips empty lines in the middle of input', () => {
    const ast = parseObject(src(['object Foo', '', 'object Bar']));
    expect(ast.classifiers).toHaveLength(2);
  });

  it('ignores a standalone closing brace outside a body', () => {
    const ast = parseObject(src(['object Foo', '}']));
    expect(ast.classifiers).toHaveLength(1);
  });

  it('ignores object declaration whose id resolves to empty (e.g. only stereotype+color+empty body)', () => {
    // After stripping stereotype, color, and empty body, rest="" so id="" → decl is null
    const ast = parseObject(src(['object << entity >> #pink {}', 'object Valid']));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.id).toBe('Valid');
  });
});

// ---------------------------------------------------------------------------
// 6. Stereotype and color
// ---------------------------------------------------------------------------

describe('parseObject — stereotype and color', () => {
  it('parses stereotype on object declaration', () => {
    const ast = parseObject(src(['object Foo << entity >>']));
    expect(ast.classifiers[0]!.stereotype).toBe('entity');
  });

  it('parses color on object declaration', () => {
    const ast = parseObject(src(['object Foo #pink']));
    expect(ast.classifiers[0]!.color).toBe('#pink');
  });
});

// ---------------------------------------------------------------------------
// 7. Comments and skinparam are ignored
// ---------------------------------------------------------------------------

describe('parseObject — ignored lines', () => {
  it('skips comment lines', () => {
    const ast = parseObject(src(["' this is a comment", 'object Foo']));
    expect(ast.classifiers).toHaveLength(1);
  });

  it('skips skinparam lines', () => {
    const ast = parseObject(src(['skinparam backgroundColor white', 'object Bar']));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.id).toBe('Bar');
  });
});

// ---------------------------------------------------------------------------
// 7b. Unquoted alias (object Foo as f)
// ---------------------------------------------------------------------------

describe('parseObject — unquoted alias', () => {
  it('parses object Name as alias without quotes', () => {
    const ast = parseObject(src(['object MyObject as obj']));
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.id).toBe('obj');
    expect(ast.classifiers[0]!.display).toBe('MyObject');
  });
});

// ---------------------------------------------------------------------------
// 7c. Invalid field lines are ignored
// ---------------------------------------------------------------------------

describe('parseObject — invalid field lines in body', () => {
  it('ignores lines that do not match field = value or bare name', () => {
    const ast = parseObject(src([
      'object Foo {',
      '  valid = yes',
      '  foo bar',
      '}',
    ]));
    // Only 'valid = yes' parses; 'foo bar' has a space and no = so parseField returns null
    expect(ast.classifiers[0]!.members).toHaveLength(1);
    expect(ast.classifiers[0]!.members[0]!.name).toBe('valid');
  });
});

// ---------------------------------------------------------------------------
// 8. Empty diagram
// ---------------------------------------------------------------------------

describe('parseObject — empty input', () => {
  it('returns empty AST for empty input', () => {
    const ast = parseObject(src([]));
    expect(ast.classifiers).toHaveLength(0);
    expect(ast.relationships).toHaveLength(0);
    expect(ast.namespaces).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Multiple objects and canonical example
// ---------------------------------------------------------------------------

describe('parseObject — canonical example', () => {
  it('parses all three objects and two relationships', () => {
    const ast = parseObject(src([
      'object "User : Alice" as alice {',
      '  firstName = Alice',
      '  lastName = Wonderland',
      '  age = 30',
      '}',
      'object "User : Bob" as bob {',
      '  firstName = Bob',
      '  lastName = Hope',
      '  age = 45',
      '}',
      'object Address {',
      '  street = 123 Main St',
      '  city = Springfield',
      '}',
      'alice --> bob : knows',
      'alice --> Address : livesAt',
    ]));

    expect(ast.classifiers).toHaveLength(3);
    expect(ast.classifiers.find((c) => c.id === 'alice')!.display).toBe('User : Alice');
    expect(ast.classifiers.find((c) => c.id === 'alice')!.members).toHaveLength(3);
    expect(ast.classifiers.find((c) => c.id === 'Address')!.members).toHaveLength(2);
    expect(ast.relationships).toHaveLength(2);
  });
});
