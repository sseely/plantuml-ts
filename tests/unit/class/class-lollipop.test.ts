import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';
import { applyLollipop } from '../../../src/diagrams/class/class-lollipop.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

// ---------------------------------------------------------------------------
// CommandLinkLollipop: `Name ()-- Existing` / `Existing --() Name`
// ---------------------------------------------------------------------------

describe('interface lollipop shorthand (CommandLinkLollipop)', () => {
  it('creates a new lollipop leaf + link (LOL_THEN_ENT: "Name ()- Existing")', () => {
    // In "ENT1 ()- ENT2" the glyph sits directly after ENT1: ENT1's text
    // becomes the DISPLAY of the brand-new lollipop leaf, and ENT2 is looked
    // up as the already-declared entity (CommandLinkLollipop.executeArg,
    // LOL_THEN_ENT branch: cl2 = quark(ent2), cl1 = new leaf displayed ent1).
    const ast = parse(`
      class Bar
      Foo ()- Bar
    `);

    // Bar stays the pre-declared plain class; Foo is a NEW lollipop leaf.
    expect(ast.classifiers).toHaveLength(2);
    const bar = ast.classifiers.find((c) => c.kind === 'class')!;
    expect(bar.display).toBe('Bar');
    const foo = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(foo).toBeDefined();
    expect(foo.display).toBe('Foo');
    expect(foo.lollipopKind).toBe('full'); // "()" — mixed glyphs → full circle

    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    // cl1 (ENT1-side, "Foo") is always `from`, cl2 (ENT2-side, "Bar") `to` —
    // regardless of which side is the lollipop.
    expect(rel.from).toBe(foo.id);
    expect(rel.to).toBe(bar.id);
    expect(rel.sourceDecor).toBe('none');
    expect(rel.targetDecor).toBe('none');
    expect(rel.length).toBe(1); // single dash, no prior horizontal lollipop
  });

  it('creates a new lollipop leaf + link (ENT_THEN_LOL: "Existing --() Name")', () => {
    const ast = parse(`
      class Bar
      Bar --() Foo
    `);

    expect(ast.classifiers).toHaveLength(2);
    const bar = ast.classifiers.find((c) => c.kind === 'class')!;
    const foo = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(foo.display).toBe('Foo');

    expect(ast.relationships).toHaveLength(1);
    const rel = ast.relationships[0]!;
    // ENT1 = Bar (existing, ENT_THEN_LOL), ENT2 = Foo (lollipop) — still
    // cl1 -> cl2, i.e. Bar -> Foo.
    expect(rel.from).toBe(bar.id);
    expect(rel.to).toBe(foo.id);
    expect(rel.length).toBe(2); // double-char body via "--"... see below
  });

  it('the existing entity may be on either side (LOL_THEN_ENT with the ' +
    'lollipop written first)', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy
    `);

    expect(ast.classifiers).toHaveLength(2);
    const dummy = ast.classifiers.find((c) => c.kind === 'class')!;
    const toto1 = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(toto1.display).toBe('toto1');

    const rel = ast.relationships[0]!;
    // "toto1 ()-- dummy": ENT1 = toto1 (the new lollipop, LOL_THEN_ENT),
    // ENT2 = dummy (existing) -> from=toto1, to=dummy.
    expect(rel.from).toBe(toto1.id);
    expect(rel.to).toBe(dummy.id);
    expect(rel.length).toBe(2); // "--" = 2 body chars -> minlen 1
  });

  it('half circle: doubled paren glyph on the LOL_THEN_ENT side ("))") -> ' +
    'lollipopKind half', () => {
    // LOL_THEN_ENT's parens group is always `[()]\)` (glyph + literal ')') —
    // "()" (full) or "))" (half); "((" is not a valid LOL_THEN_ENT glyph.
    const ast = parse(`
      class dummy
      toto1 ))-- dummy
    `);
    const toto1 = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(toto1.lollipopKind).toBe('half');
  });

  it('half circle on the ENT_THEN_LOL side ("((")', () => {
    // ENT_THEN_LOL's parens group is always `\([()]` (literal '(' + glyph) —
    // "((" (half) or "()" (full); "))" is not a valid ENT_THEN_LOL glyph.
    const ast = parse(`
      class dummy
      dummy --(( toto1
    `);
    const toto1 = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(toto1.lollipopKind).toBe('half');
  });

  it('quoted and stereotyped endpoint names are accepted', () => {
    // LOL_THEN_ENT: ENT1 ("Iface<<remote>>") is the new lollipop's display
    // (stereotype ignored, matching upstream's executeArg — never read); ENT2
    // ("My Class", quoted, no alias so its id is the stripped quoted text
    // itself) is looked up as the pre-declared existing entity.
    const ast = parse(`
      class "My Class"
      Iface<<remote>> ()-- "My Class"
    `);
    expect(ast.classifiers).toHaveLength(2);
    const mc = ast.classifiers.find((c) => c.kind === 'class')!;
    expect(mc.display).toBe('My Class');
    const lol = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(lol.display).toBe('Iface');
    const rel = ast.relationships[0]!;
    expect(rel.to).toBe(mc.id);
    expect(rel.from).toBe(lol.id);
  });

  it('quoted labels near either endpoint become from/to multiplicity', () => {
    const ast = parse(`
      class dummy
      toto1 "1" ()-- "*" dummy
    `);
    const rel = ast.relationships[0]!;
    expect(rel.fromMultiplicity).toBe('1');
    expect(rel.toMultiplicity).toBe('*');
  });

  it('a trailing ": label" becomes the relationship label', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy : implements
    `);
    const rel = ast.relationships[0]!;
    expect(rel.label).toBe('implements');
  });

  it('leniently auto-creates the "existing" side when not pre-declared ' +
    '(this parser has no error-reporting channel)', () => {
    const ast = parse(`toto1 ()-- dummy`);
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.classifiers.some((c) => c.display === 'dummy')).toBe(true);
  });

  it('DOT node shape matches the oracle: shape=circle (via KIND_SHAPE), not ' +
    'the shape=plaintext used by the standalone `() name` declaration', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy
    `);
    const toto1 = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(toto1.kind).toBe('lollipop');
    // (KIND_SHAPE['lollipop'] === 'circle' is asserted directly against the
    // oracle in tests/oracle/class-dot-parity.test.ts's target fixtures.)
  });

  it('bumps a third horizontal (length-1) lollipop on the same entity down a ' +
    'rank (getNbOfHozizontalLollipop bump)', () => {
    const ast = parse(`
      class dummy
      tutu1 ()- dummy
      tutu2 ()- dummy
      tutu3 ()- dummy
    `);
    const rels = ast.relationships;
    expect(rels).toHaveLength(3);
    expect(rels[0]!.length).toBe(1);
    expect(rels[1]!.length).toBe(1);
    expect(rels[2]!.length).toBe(2); // 3rd horizontal lollipop bumped
  });

  it('does not bump length-2 ("--") lollipops regardless of how many attach ' +
    'to the same entity', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy
      toto2 ()-- dummy
      toto3 ()-- dummy
    `);
    for (const rel of ast.relationships) expect(rel.length).toBe(2);
  });

  it('a dotted body ("()..") produces a dashed (usage-typed) link', () => {
    const ast = parse(`
      class dummy
      toto1 ()..dummy
    `);
    const rel = ast.relationships[0]!;
    expect(rel.type).toBe('usage');
    expect(rel.sourceDecor).toBe('none');
    expect(rel.targetDecor).toBe('none');
  });

  it('an undotted body produces a solid (association-typed) link', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy
    `);
    const rel = ast.relationships[0]!;
    expect(rel.type).toBe('association');
  });

  it('an @weight header sets Relationship.weight', () => {
    const ast = parse(`
      class dummy
      @2.5 toto1 ()-- dummy
    `);
    const rel = ast.relationships[0]!;
    expect(rel.weight).toBe(2.5);
  });

  it('does not confuse the standalone `() "name"` declaration ' +
    '(CommandCreateElementParenthesis) with the lollipop-link shorthand', () => {
    const ast = parse(`() "Iface" as IF`);
    expect(ast.classifiers).toHaveLength(1);
    expect(ast.classifiers[0]!.kind).toBe('circle');
    expect(ast.relationships).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// G2 N19 — lollipop synthetic-entity naming (jar "<existing>lolN") +
// creationIndex/phantom-slot numbering. See `createLollipopLeaf`'s own doc
// comment for the jar citation (`CommandLinkLollipop#executeArg`'s `suffix`)
// and `plans/g2-class-svg/ledger.md` N19 for the corpus validation
// (bososa-44-fipu544, gidabo-27-juza410).
// ---------------------------------------------------------------------------

describe('interface lollipop shorthand: G2 N19 synthetic-id naming', () => {
  it('names each new lollipop "<existingRawName>lolN", N a dense run of the ' +
    'shared jar creation counter (bososa-44-fipu544: three LOL_THEN_ENT ' +
    'lollipops on the SAME existing entity)', () => {
    const ast = parse(`
      class dummy
      toto1 ()-- dummy
      toto2 ()-- dummy
      toto3 ()-- dummy
    `);
    const dummy = ast.classifiers.find((c) => c.kind === 'class')!;
    expect(dummy.creationIndex).toBe(1);
    const lollipops = ast.classifiers.filter((c) => c.kind === 'lollipop');
    expect(lollipops.map((c) => c.syntheticIdName)).toEqual([
      'dummylol2', 'dummylol5', 'dummylol8',
    ]);
    expect(lollipops.map((c) => c.creationIndex)).toEqual([3, 6, 9]);
    for (const lol of lollipops) expect(lol.phantomSlot).toBe(true);

    const rels = ast.relationships;
    expect(rels.map((r) => r.creationIndex)).toEqual([4, 7, 10]);
  });

  it('uses the RAW (unresolved) existing-side text for the synthetic name ' +
    'prefix, quotes stripped, even when written ENT_THEN_LOL', () => {
    const ast = parse(`
      class "My Class"
      "My Class" --() Iface
    `);
    const lol = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(lol.syntheticIdName).toBe('My Classlol2');
  });

  it('leaves creationIndex/syntheticIdName entirely unstamped when called ' +
    'directly without a counter (hand-built `ClassDiagramAST` fixtures -- ' +
    'the "absent when built by hand" posture every other creationIndex ' +
    'field in this file establishes)', () => {
    const ast: ClassDiagramAST = { classifiers: [], relationships: [], namespaces: [], notes: [], directives: [] };
    const dummy: ClassDiagramAST['classifiers'][number] = {
      id: 'dummy', display: 'dummy', kind: 'class', typeParams: [], members: [],
    };
    ast.classifiers.push(dummy);
    const applied = applyLollipop(ast, () => dummy, null, 'toto1 ()-- dummy');
    expect(applied).toBe(true);
    const lol = ast.classifiers.find((c) => c.kind === 'lollipop')!;
    expect(lol.syntheticIdName).toBeUndefined();
    expect(lol.creationIndex).toBeUndefined();
    expect(lol.phantomSlot).toBeUndefined();
    expect(ast.relationships[0]!.creationIndex).toBeUndefined();
  });
});
