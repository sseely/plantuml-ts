/**
 * `<path id="..." codeLine="...">` on class-diagram edges (G2 N9).
 *
 * Upstream: `Link#idCommentForSvg()` (Link.java:106-114) — a three-way
 * branch on `LinkType#looksLikeRevertedForSvg()`/`#looksLikeNoDecorAtAllSvg()`
 * (LinkType.java:55-68) over the decoration pair adjacent to `getEntity1()`/
 * `getEntity2()` (Java's cl1/cl2). `CommandLinkClass.getLinkType()` builds
 * `new LinkType(decors2, decors1)` — decor1 (LinkType field) is the decor
 * near ENT2 (the SECOND-written operand), decor2 the decor near ENT1 (the
 * FIRST-written one) — and `Link#getInv()` (the `-left-`/`-up-` direction
 * word) is the ONLY thing that swaps cl1/cl2 themselves. This is a
 * DIFFERENT swap than `Relationship.from`/`.to`/`.sourceDecor`/
 * `.targetDecor` (arrowhead-driven, for DOT layout direction) — see
 * `ast.ts#Relationship.idEntity1`'s doc comment and `class-arrow-grammar.ts
 * #ArrowInfo.upOrLeft`'s.
 *
 * Cases below are jar-verified against `test-results/dot-cache/class/`
 * fixtures (cited per case) — see `plans/g2-class-svg/ledger.md` N9 for the
 * full arrow-direction matrix + evidence.
 */
import { describe, it, expect } from 'vitest';
import { renderFixture } from '../../helpers/render.js';
import { parseRelationshipLine, idLeaf } from '../../../src/diagrams/class/class-relationship-parser.js';
import { resolveArrow, parseArrowDecorsRaw } from '../../../src/diagrams/class/class-arrow-grammar.js';

/** Extract the FIRST `<path id="..." ...>` block's `id`/`codeLine` pair,
 *  or `undefined` if no such attribute is present (the arrowhead
 *  `<polygon>`/`<path fill="#000000">` glyph paths never carry either). */
function firstLinkIdAndCodeLine(svg: string): { id: string; codeLine?: string } | undefined {
  const m = /<path[^>]*\sid="([^"]*)"[^>]*?(?:\scodeLine="([0-9]*)")?\/>/.exec(svg);
  if (m === null) return undefined;
  return m[2] !== undefined ? { id: m[1]!, codeLine: m[2] } : { id: m[1]! };
}

function allLinkIds(svg: string): string[] {
  return [...svg.matchAll(/<path[^>]*\sid="([^"]*)"/g)].map((m) => m[1]!);
}

describe('class edge <path id> — the decor/direction matrix (G2 N9)', () => {
  // baneru-00-kuro607: `class1 [Qualifier] <-- class2` -> jar
  // id="class1-backto-class2" codeLine="5". The naive "decor1==NONE &&
  // decor2!=NONE -> backto" reading over sourceDecor/targetDecor is
  // CONTRADICTED here (those are DOT-swapped); the fix reads
  // idEntity1Decor/idEntity2Decor instead.
  it('arrowhead only at the FIRST-written entity -> backto', () => {
    const svg = renderFixture('@startuml\nclass class1\nclass class2\nclass1 <-- class2\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('class1-backto-class2');
  });

  // bicabi-42-coto932: `MainWindow <|-- Gtk::Window` -> jar
  // id="MainWindow-backto-Gtk" (extension triangle, same backto rule; the
  // `::Window` port suffix is stripped, matching `Entity.getName()`).
  it('extension triangle only at the FIRST-written entity -> backto', () => {
    const svg = renderFixture('@startuml\nclass MainWindow\nclass Gtk\nMainWindow <|-- Gtk::Window\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('MainWindow-backto-Gtk');
  });

  // bajotu-30-soku184: `p1 --> cl2` -> jar id="p1-to-cl2" (decor only at
  // the SECOND-written entity -> default "to" form).
  it('arrowhead only at the SECOND-written entity -> to', () => {
    const svg = renderFixture('@startuml\nclass p1\nclass cl2\np1 --> cl2\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('p1-to-cl2');
  });

  // bujedi-30-cize673: `A -- B` -> jar id="A-B" (no decor at either end).
  it('no decor at either end -> bare id, no "to"/"backto"', () => {
    const svg = renderFixture('@startuml\nclass A\nclass B\nA -- B\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('A-B');
  });

  // bujedi-30-cize673: `A *--> C` -> jar id="A-C" (COMPOSITION diamond at
  // A + arrowhead at C -- BOTH ends decorated -> bare id, same branch as
  // "no decor at all").
  it('decor at BOTH ends -> bare id (double-decorated collapses to bare)', () => {
    const svg = renderFixture('@startuml\nclass A\nclass C\nA *--> C\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('A-C');
  });

  // coxose-20-nifu136: `HashMap +-l-> V4` -> jar id="V4-HashMap" (PLUS at
  // HashMap's end + ARROW at V4's end -- upstream's LinkDecor.PLUS is a
  // real non-NONE decor even though this port's rendered-marker mapping
  // (`headToDecor`) collapses PLUS to no visible marker; the `-l-`
  // direction word ALSO swaps cl1/cl2, so the parent/child order flips too).
  it('PLUS decor counts as decorated for id purposes, not "none"', () => {
    const svg = renderFixture('@startuml\nclass HashMap\nclass V4\nHashMap +-l-> V4\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('V4-HashMap');
  });

  // fexedu-26-dira713 / fijali-69-pina030: inline `extends`/`implements`
  // (CommandCreateClassMultilines, NOT the arrow-token grammar at all) --
  // Java always constructs cl1=parent, cl2=child, decor (triangle) at the
  // PARENT's end only -- ALWAYS "parent-backto-child", and jar-verified to
  // carry NO `codeLine` attribute at all (0/5 sampled corpus edges).
  it('inline "extends" -> parent-backto-child, no codeLine', () => {
    const svg = renderFixture('@startuml\nclass GenericServlet extends Servlet\n@enduml');
    const found = firstLinkIdAndCodeLine(svg);
    expect(found?.id).toBe('Servlet-backto-GenericServlet');
    expect(found?.codeLine).toBeUndefined();
  });

  it('inline "implements" -> interface-backto-class, no codeLine', () => {
    const svg = renderFixture('@startuml\ninterface I1\nclass c1 implements I1\n@enduml');
    const found = firstLinkIdAndCodeLine(svg);
    expect(found?.id).toBe('I1-backto-c1');
    expect(found?.codeLine).toBeUndefined();
  });

  // pexivi-54-ceri875: `set namespaceseparator none` + `class X.Y.Z` --
  // the dots are LITERAL name characters, not a namespace separator; jar
  // id keeps them verbatim ("X.Y.Z-to-A.B.C", not "Z-to-C").
  it('literal dots in a classifier name survive under namespaceseparator none', () => {
    const svg = renderFixture(
      '@startuml\nset namespaceseparator none\nclass X.Y.Z\nclass A.B.C\nX.Y.Z --> A.B.C\n@enduml',
    );
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('X.Y.Z-to-A.B.C');
  });

  // dudimi-83-mimo845 (default separator): `.BaseClass` -- the CLASS_ID
  // root-namespace marker is stripped (jar id "BaseClass-backto-Person",
  // no leading dot) once namespaces are active.
  it('root-namespace marker "." is stripped when nsSep is active', () => {
    const svg = renderFixture('@startuml\nclass BaseClass\nclass Person\n.BaseClass <|-- Person\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('BaseClass-backto-Person');
  });

  // momoba-92-bole393 (namespaceSeparator none): the SAME leading dot is
  // now just an ordinary character -- jar id keeps it (".BaseClass-...").
  it('leading "." is kept verbatim under namespaceseparator none', () => {
    // `.BaseClass` auto-creates (no prior `class BaseClass` declaration
    // needed) -- matches momoba-92-bole393's own structure exactly.
    const svg = renderFixture(
      '@startuml\nset namespaceSeparator none\nclass Person\n.BaseClass <|-- Person\n@enduml',
    );
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('.BaseClass-backto-Person');
  });

  // Link.java:106-114's `uniq` de-dup (SvekEdge#uniq, SvekEdge.java:1093):
  // two structurally-identical relationships collide on the SAME base id
  // and get `-1`/`-2` suffixes, diagram-wide.
  it('a diagram-wide id collision gets a "-1" suffix', () => {
    const svg = renderFixture('@startuml\nclass A\nclass B\nA --> B\nA --> B\n@enduml');
    expect(allLinkIds(svg)).toEqual(['A-to-B', 'A-to-B-1']);
  });

  // nagega-30-poso418: a classifier name containing `<`/`&`/`"` must be
  // escaped in the `id` ATTRIBUTE VALUE (raw XML-unsafe chars are invalid
  // there) -- but jar's own serializer does NOT escape `>` (only `&`/`<`/
  // the attribute quote char are strictly required by the XML spec).
  it('escapes XML-unsafe id characters, matching jar\'s own (no ">") set', () => {
    // Referenced by its quoted display text directly (no `as` alias) so
    // `idEntity1` carries the literal `<` through unaliased.
    const svg = renderFixture('@startuml\nclass "A<B"\nclass C\n"A<B" --> C\n@enduml');
    expect(firstLinkIdAndCodeLine(svg)?.id).toBe('A&lt;B-to-C');
  });

  // baneru-00-kuro607's own structure: a BLANK LINE between the last
  // classifier declaration and the relationship line must not shift the
  // 0-indexed `codeLine` -- proves the parse-time line-position plumbing
  // (`PreprocessorResult.linePositions` -> `UmlSource.linePositions` ->
  // `ParseState.currentLine`) survives `flatten()`'s blank-line drop.
  it('codeLine survives a blank line between declarations and the relationship', () => {
    const svg = renderFixture(
      '@startuml\n!pragma svek_trace on\nclass class1\nclass class2\n\nclass1 <-- class2\n@enduml',
    );
    // 0-indexed: @startuml=0, pragma=1, class1=2, class2=3, (blank)=4, rel=5.
    expect(firstLinkIdAndCodeLine(svg)).toEqual({ id: 'class1-backto-class2', codeLine: '5' });
  });
});

describe('class-arrow-grammar — id/decor matrix building blocks (G2 N9)', () => {
  it('ArrowInfo.upOrLeft is true only for an explicit -left-/-up- direction word', () => {
    expect(resolveArrow('-->')?.upOrLeft).toBe(false);
    expect(resolveArrow('<--')?.upOrLeft).toBe(false);
    expect(resolveArrow('+-l->')?.upOrLeft).toBe(true);
    expect(resolveArrow('-u->')?.upOrLeft).toBe(true);
  });

  it('parseArrowDecorsRaw keys decor1/decor2 to TEXTUAL (left/right) order, unlike parseArrowDecors', () => {
    // '<--': decor at the LEFT (first-written) operand only.
    expect(parseArrowDecorsRaw('<--')).toEqual({ decor1: 'open', decor2: 'none' });
    // '+-l->': PLUS (left) counts as decorated. G2 N28 widened
    // `headToDecor` to resolve PLUS to its own real `LinkDecor` ('plus',
    // no longer the `idDecorForHead` 'open' placeholder D6 previously
    // needed for it) -- decor1 is now the REAL PLUS decor; ARROW (right)
    // is unaffected, still a real 'open'.
    expect(parseArrowDecorsRaw('+-l->')).toEqual({ decor1: 'plus', decor2: 'open' });
  });
});

describe('idLeaf — nsSep-aware leaf extraction for the SVG id (G2 N9)', () => {
  it('splits on the active separator and takes the last segment', () => {
    expect(idLeaf('app.drawables.DrawableAdapter', '.')).toBe('DrawableAdapter');
  });

  it('strips the CLASS_ID root-namespace "." marker when nsSep is active', () => {
    expect(idLeaf('.BaseClass', '.')).toBe('BaseClass');
  });

  it('keeps a literal "." verbatim when namespaces are disabled (nsSep null)', () => {
    expect(idLeaf('X.Y.Z', null)).toBe('X.Y.Z');
    expect(idLeaf('.BaseClass', null)).toBe('.BaseClass');
  });
});

describe('parseRelationshipLine — idEntity1/idEntity2/decor fields (G2 N9)', () => {
  it('sets idEntity1/idEntity2 to Java cl1/cl2 order, unswapped by decor direction', () => {
    const rel = parseRelationshipLine('class1 <-- class2');
    expect(rel).toMatchObject({
      idEntity1: 'class1', idEntity2: 'class2',
      idEntity1Decor: 'open', idEntity2Decor: 'none',
      // DOT-layout from/to IS decor-swapped (arrowhead points at class1) --
      // the two field pairs deliberately disagree.
      from: 'class2', to: 'class1',
    });
  });

  it('leaves idEntity1/idEntity2 undefined for relationships with no explicit endpoint', () => {
    // A COUPLE endpoint ('(A,B)') never reaches this branch of the grammar.
    const rel = parseRelationshipLine('(A,B) .. C');
    expect(rel).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// G2 N19: couple/lollipop synthetic-entity naming feeds `<path id>` through
// this SAME `linkIdForSvg` fallback chain (`syntheticNames.get(geo.from) ??
// leafPortion(geo.from)`) -- end-to-end verification through the full
// parse -> layout -> render pipeline (`renderFixture`), matching the exact
// corpus fixtures `plans/g2-class-svg/ledger.md` N19 jar-verified.
// ---------------------------------------------------------------------------

describe('class edge <path id> — couple/lollipop synthetic naming (G2 N19)', () => {
  // buvake-41-vulu531: `(A,B) .. C` (no subsumed explicit A-B association)
  // -> jar ids "A-apoint4"/"apoint4-B"/"apoint4-C".
  it('names an assoc-circle "apointN" in the edge id, not the raw AST id', () => {
    const svg = renderFixture('@startuml\nclass A\nclass B\n(A,B) .. C\n@enduml');
    expect(allLinkIds(svg)).toEqual(['A-apoint4', 'apoint4-B', 'apoint4-C']);
  });

  // jaloja-18-tisu915 (trimmed to the couple-relevant lines): a SUBSUMED
  // explicit association -> jar ids "Student-apoint5"/"apoint5-Course"/
  // "apoint5-Enrollment".
  it('names an assoc-circle "apointN" when an explicit association was ' +
    'subsumed (a DIFFERENT N than the no-subsumption case, same fixture ' +
    'shape)', () => {
    const svg = renderFixture(
      '@startuml\nclass Student\nStudent -- Course\n' +
      '(Student, Course) . Enrollment\n@enduml',
    );
    expect(allLinkIds(svg)).toEqual([
      'Student-apoint5', 'apoint5-Course', 'apoint5-Enrollment',
    ]);
  });

  // bososa-44-fipu544: three LOL_THEN_ENT lollipops on the same existing
  // entity -> jar ids "dummylol2-dummy"/"dummylol5-dummy"/"dummylol8-dummy".
  it('names a lollipop "<existing>lolN" in the edge id, not the raw AST id', () => {
    const svg = renderFixture(
      '@startuml\nclass dummy\ntoto1 ()-- dummy\ntoto2 ()-- dummy\n' +
      'toto3 ()-- dummy\n@enduml',
    );
    expect(allLinkIds(svg)).toEqual([
      'dummylol2-dummy', 'dummylol5-dummy', 'dummylol8-dummy',
    ]);
  });
});

// ---------------------------------------------------------------------------
// G2 N20: repeat coupling (`Association#createSecondAssociation`/
// `createInSecond`) -- the SECOND circle on an already-coupled (A,B) pair
// now also gets real apoint-N naming + a correctly re-ordered/re-numbered
// PRIOR-circle class edge when the conditional `getInv()` inversion fires.
// Jar-verified against `bosiki-11-xaza958` (BOTH couplings trailing -- no
// inversion) and `bunuce-10-vere519` (LEADING first coupling -- inversion
// fires, reordering the prior circle's class edge).
// ---------------------------------------------------------------------------

describe('class edge <path id> — repeat coupling (G2 N20)', () => {
  it('bosiki-11-xaza958: two TRAILING couplings on the same (A,B) pair -- ' +
    'no inversion, both circles named/numbered/ordered exactly as jar', () => {
    const svg = renderFixture(
      '@startuml\nclass R1\nclass R2\nA--B\nR1 .. (A,B)\nR2 .. (A,B)\n@enduml',
    );
    expect(allLinkIds(svg)).toEqual([
      'A-apoint6', 'apoint6-B', 'R1-apoint6', 'A-apoint11', 'apoint11-B', 'apoint11-R2',
    ]);
  });

  it('bunuce-10-vere519: a LEADING first coupling -- the conditional ' +
    'getInv() inversion fires, moving the prior circle\'s class edge to ' +
    'draw AFTER the second circle\'s own entity edges', () => {
    const svg = renderFixture(
      '@startuml\nclass R1\nclass R2\nA-B\n(A,B) .. R1\nR2 .. (A,B)\n@enduml',
    );
    expect(allLinkIds(svg)).toEqual([
      'A-apoint6', 'apoint6-B', 'A-apoint11', 'apoint11-B', 'R1-apoint6', 'apoint11-R2',
    ]);
  });
});
