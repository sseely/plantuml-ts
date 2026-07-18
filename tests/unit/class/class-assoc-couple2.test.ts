import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST, Relationship } from '../../../src/diagrams/class/ast.js';

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

function findRel(ast: ClassDiagramAST, fromId: string, toId: string): Relationship {
  const rel = ast.relationships.find((r) => r.from === fromId && r.to === toId);
  expect(rel).toBeDefined();
  return rel!;
}

function circleIds(ast: ClassDiagramAST): string[] {
  return ast.classifiers.filter((c) => c.kind === 'assoc-circle').map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Group 11 — association-class couple gaps
// (Association#createNew / insertPointBetween / AbstractClassOrObjectDiagram,
// see class-assoc-couple.ts's file doc for the exact upstream mechanism.)
// ---------------------------------------------------------------------------

describe('association-class couple: subsumed-edge length transfer', () => {
  it('a single-dash (length 1) subsumed self-couple transfers minlen 0 onto ' +
    'BOTH entity<->circle edges, and flips the circle->class edge to ' +
    'minlen 0 stays default 1 (jixamu-89-ribo225)', () => {
    // Station "0..*" - "0..*" Station : single dash -> length 1.
    // StationCrossing . (Station, Station): self-couple (A===B).
    const ast = parse(`
      class Station
      class StationCrossing
      Station "0..*" - "0..*" Station
      StationCrossing . (Station, Station)
    `);
    const station = ast.classifiers.find((c) => c.display === 'Station')!;
    const crossing = ast.classifiers.find((c) => c.display === 'StationCrossing')!;
    const [circleId] = circleIds(ast);
    expect(circleId).toBeDefined();

    const aEdge = findRel(ast, station.id, circleId!);
    const bEdge = findRel(ast, circleId!, station.id);
    expect(aEdge.length).toBe(1); // transferred from the single-dash subsumed edge
    expect(bEdge.length).toBe(1);
    expect(aEdge.fromMultiplicity).toBe('0..*');
    expect(bEdge.toMultiplicity).toBe('0..*');

    // Trailing form `StationCrossing . (Station, Station)` -> C -> circle.
    const cEdge = findRel(ast, crossing.id, circleId!);
    expect(cEdge.length).toBe(1); // entityLength(1) + self(true) -> no flip
  });

  it('a double-dash (length 2) subsumed distinct-pair couple transfers ' +
    'minlen 1 onto entity<->circle edges and keeps the class edge at ' +
    'minlen 0 (tunelu-64-xica833)', () => {
    const ast = parse(`
      class A
      class B
      class AssociationClass
      A -- B
      (A, B) . AssociationClass
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const ac = ast.classifiers.find((c) => c.display === 'AssociationClass')!;
    const [circleId] = circleIds(ast);

    expect(findRel(ast, a.id, circleId!).length).toBe(2);
    expect(findRel(ast, circleId!, b.id).length).toBe(2);
    // Leading form `(A,B) . AssociationClass` -> circle -> C.
    expect(findRel(ast, circleId!, ac.id).length).toBe(1);
  });

  it('a single-dash (length 1) subsumed distinct-pair couple flips the ' +
    'class edge up to minlen 1 (vonago-16-zime449)', () => {
    const ast = parse(`
      class A
      class B
      class AssociationClass
      A - B
      (A, B) .. AssociationClass
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const ac = ast.classifiers.find((c) => c.display === 'AssociationClass')!;
    const [circleId] = circleIds(ast);

    expect(findRel(ast, a.id, circleId!).length).toBe(1);
    expect(findRel(ast, circleId!, b.id).length).toBe(1);
    expect(findRel(ast, circleId!, ac.id).length).toBe(2); // flipped: len1 + distinct
  });

  it('with NO prior explicit association, the entity<->circle edges default ' +
    'to length 2 and the class edge stays at the base length 1 for a ' +
    'distinct pair', () => {
    const ast = parse(`
      class A
      class B
      class C
      (A, B) . C
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const c = ast.classifiers.find((c) => c.display === 'C')!;
    const [circleId] = circleIds(ast);
    expect(findRel(ast, a.id, circleId!).length).toBe(2);
    expect(findRel(ast, circleId!, b.id).length).toBe(2);
    expect(findRel(ast, circleId!, c.id).length).toBe(1);
  });

  it('an existing link on a PORT endpoint (Class::member) still subsumes by ' +
    'entity id, transferring its length (pajoka-72-reju527)', () => {
    const ast = parse(`
      class Foo
      class Bar
      class Qux
      Foo::method --> Bar
      (Foo, Bar) --> Qux
    `);
    const foo = ast.classifiers.find((c) => c.display === 'Foo')!;
    const bar = ast.classifiers.find((c) => c.display === 'Bar')!;
    const qux = ast.classifiers.find((c) => c.display === 'Qux')!;
    const [circleId] = circleIds(ast);

    // "-->" has 2 body chars ([-.=]) -> length 2, subsumed onto both edges.
    expect(findRel(ast, foo.id, circleId!).length).toBe(2);
    expect(findRel(ast, circleId!, bar.id).length).toBe(2);
    // distinct pair, entityLength=2 -> no flip -> class edge stays 1.
    expect(findRel(ast, circleId!, qux.id).length).toBe(1);
    // The port-based association line itself is gone (subsumed), but its
    // port carries onto the surviving Foo->circle edge — a `Class::member`
    // port permanently shields the classifier upstream (Entity
    // #addPortShortName), independent of the link's later fate.
    expect(findRel(ast, foo.id, circleId!).fromPort).toBe('method');
  });

  it('subsumes the MOST RECENTLY declared relationship between the pair, ' +
    'leaving an earlier one intact (begico-70-guva302)', () => {
    const ast = parse(`
      class research
      class experiments
      class correlations
      research *-- experiments
      research "method" *-- correlations
      research .. correlations : Baird
      (research, experiments) . (research, correlations)
    `);
    const research = ast.classifiers.find((c) => c.display === 'research')!;
    const experiments = ast.classifiers.find((c) => c.display === 'experiments')!;
    const correlations = ast.classifiers.find((c) => c.display === 'correlations')!;
    const circles = circleIds(ast);
    expect(circles).toHaveLength(2);

    // The EARLIER composition (research *-- correlations) survives untouched
    // as its own direct edge — only the LATER ".." association got subsumed.
    const direct = ast.relationships.find(
      (r) =>
        (r.from === research.id && r.to === correlations.id) ||
        (r.from === correlations.id && r.to === research.id),
    );
    expect(direct).toBeDefined();
    expect(direct!.type).toBe('composition');

    // The subsumed dotted association's label transfers onto research's
    // circle edge for the (research,correlations) couple, full, unconditional.
    const circleToCorrelations = circles.find((cid) =>
      ast.relationships.some((r) => r.from === cid && r.to === correlations.id),
    )!;
    const researchToThatCircle = findRel(ast, research.id, circleToCorrelations);
    expect(researchToThatCircle.label).toBe('Baird');
    // The circle->correlations edge itself carries no label (LinkArg.noDisplay).
    expect(findRel(ast, circleToCorrelations, correlations.id).label).toBeUndefined();

    // (research, experiments)'s composition IS the existing link and gets
    // subsumed (no separate direct research<->experiments edge remains).
    expect(
      ast.relationships.some(
        (r) =>
          (r.from === research.id && r.to === experiments.id) ||
          (r.from === experiments.id && r.to === research.id),
      ),
    ).toBe(false);
  });
});

describe('association-class couple: note-on-link split', () => {
  it('note on link: text — full label on the A->circle edge only when the ' +
    'class edge length stays 1 (tunelu-64-xica833)', () => {
    const ast = parse(`
      class A
      class B
      class AssociationClass
      A -- B
      note on link: hello world
      (A, B) . AssociationClass
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const [circleId] = circleIds(ast);
    expect(findRel(ast, a.id, circleId!).label).toBe('hello world');
    expect(findRel(ast, circleId!, b.id).label).toBeUndefined();
  });

  it('note on link: text — SPLIT across both entity<->circle edges when the ' +
    'class edge length flips to 2 (vonago-16-zime449)', () => {
    const ast = parse(`
      class A
      class B
      class AssociationClass
      A - B
      note on link: hello world
      (A, B) .. AssociationClass
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const [circleId] = circleIds(ast);
    expect(findRel(ast, a.id, circleId!).label).toBe('hello world');
    expect(findRel(ast, circleId!, b.id).label).toBe('hello world');
  });

  it('note on link with no prior relationship is a silent no-op', () => {
    const ast = parse(`
      note on link: orphan note
      class A
    `);
    expect(ast.relationships).toHaveLength(0);
  });
});

describe('association-class couple: render-layer decor/dashing (G2 N8)', () => {
  it('the class-link edge (leading form) carries the couple arrow\'s OWN ' +
    'decor and dashing, NOT the hardcoded association default ' +
    '(bosiki-11-xaza958, trailing "R1 .. (A,B)")', () => {
    const ast = parse(`
      class R1
      class A
      class B
      A--B
      R1 .. (A,B)
    `);
    const r1 = ast.classifiers.find((c) => c.display === 'R1')!;
    const [circleId] = circleIds(ast);
    // Trailing form "C .. (A,B)" -> C -> circle.
    const classEdge = findRel(ast, r1.id, circleId!);
    expect(classEdge.sourceDecor).toBe('none');
    expect(classEdge.targetDecor).toBe('none');
    expect(classEdge.dashed).toBe(true); // ".." has no arrowhead but IS dashed
  });

  it('entity<->circle edges stay undecorated/solid when the subsumed ' +
    'association was a plain "--" (bosiki-11-xaza958)', () => {
    const ast = parse(`
      class R1
      class A
      class B
      A--B
      R1 .. (A,B)
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const [circleId] = circleIds(ast);
    const aEdge = findRel(ast, a.id, circleId!);
    const bEdge = findRel(ast, circleId!, b.id);
    expect(aEdge.sourceDecor).toBe('none');
    expect(aEdge.targetDecor).toBe('none');
    expect(aEdge.dashed).toBe(false);
    expect(bEdge.sourceDecor).toBe('none');
    expect(bEdge.targetDecor).toBe('none');
    expect(bEdge.dashed).toBe(false);
  });

  it('a REPEAT coupling on an already-coupled pair marks the sibling-circle ' +
    'connector invis, and its OWN class-link edge still carries its OWN ' +
    'arrow\'s decor/dashing (getufo-87-xeca508, "(A,B) .. R2")', () => {
    const ast = parse(`
      class R1
      class R2
      class A
      class B
      A--B
      R1 .. (A,B)
      (A,B) .. R2
    `);
    const r2 = ast.classifiers.find((c) => c.display === 'R2')!;
    const circles = circleIds(ast);
    expect(circles).toHaveLength(2);
    const newCircle = circles[1]!;
    // Leading form "(A,B) .. R2" -> circle -> R2 (mode 1, ALSO forced by
    // forceCircleToClass for a repeat coupling).
    const classEdge = findRel(ast, newCircle, r2.id);
    expect(classEdge.sourceDecor).toBe('none');
    expect(classEdge.targetDecor).toBe('none');
    expect(classEdge.dashed).toBe(true);

    const invisEdge = ast.relationships.find(
      (r) => r.invis === true && r.from === circles[0] && r.to === newCircle,
    );
    expect(invisEdge).toBeDefined();
  });

  it('an arrowhead on the couple line carries onto the class-link edge ' +
    '(not just dashing) — "R1 --> (A,B)"', () => {
    const ast = parse(`
      class R1
      class A
      class B
      A--B
      R1 --> (A,B)
    `);
    const r1 = ast.classifiers.find((c) => c.display === 'R1')!;
    const [circleId] = circleIds(ast);
    const classEdge = findRel(ast, r1.id, circleId!);
    expect(classEdge.targetDecor).toBe('open'); // '>' head lands on the circle end
    expect(classEdge.sourceDecor).toBe('none');
    expect(classEdge.dashed).toBe(false); // solid body, no '.' char
  });
});

describe('association-class couple: (A,B) referencing a note id', () => {
  it('a freestanding note used as the trailing couple target reuses the ' +
    'existing note id instead of creating a phantom classifier ' +
    '(temise-16-neco018)', () => {
    const ast = parse(`
      class Reporter
      class Queue
      Reporter "1" -- "1" Queue
      note as N1
      Initialisiert freie Worker
      end note
      N1 .. (Reporter, Queue)
    `);
    // No phantom "N1" classifier was created.
    expect(ast.classifiers.some((c) => c.display === 'N1' || c.id === 'N1')).toBe(false);
    expect(ast.classifiers.filter((c) => c.kind !== 'assoc-circle')).toHaveLength(2);
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]!.id).toBe('N1');

    const reporter = ast.classifiers.find((c) => c.display === 'Reporter')!;
    const queue = ast.classifiers.find((c) => c.display === 'Queue')!;
    const [circleId] = circleIds(ast);

    // "--" -> length 2, transferred onto both entity<->circle edges.
    expect(findRel(ast, reporter.id, circleId!).length).toBe(2);
    expect(findRel(ast, circleId!, queue.id).length).toBe(2);
    // Trailing form `N1 .. (Reporter, Queue)` -> N1 -> circle (mode 2).
    const noteEdge = findRel(ast, 'N1', circleId!);
    expect(noteEdge.length).toBe(1); // entityLength=2, distinct pair -> no flip
  });
});


// ---------------------------------------------------------------------------
// G2 N19 — couple synthetic-entity naming (jar "apointN") + creationIndex/
// phantom-slot numbering. See class-assoc-couple.ts's own doc comments for
// the jar citations (`AbstractClassOrObjectDiagram.Association`'s ctor +
// `createNew`) and `plans/g2-class-svg/ledger.md` N19 for the corpus
// validation (buvake-41-vulu531, jaloja-18-tisu915).
// ---------------------------------------------------------------------------

describe('association-class couple: G2 N19 synthetic-id naming (single coupling)', () => {
  it('names the circle "apointN" and dense-numbers name/uid/edge phantom ' +
    'slots when NO explicit A-B association is subsumed (buvake-41-vulu531)', () => {
    const ast = parse(`
      class A
      class B
      (A,B) .. C
    `);
    const a = ast.classifiers.find((c) => c.display === 'A')!;
    const b = ast.classifiers.find((c) => c.display === 'B')!;
    const c = ast.classifiers.find((c) => c.display === 'C')!;
    const circle = ast.classifiers.find((c) => c.kind === 'assoc-circle')!;

    expect(a.creationIndex).toBe(1);
    expect(b.creationIndex).toBe(2);
    expect(c.creationIndex).toBe(3);

    // Association ctor: name-slot burn (4) then the circle's own (never
    // rendered) uid burn (5).
    expect(circle.syntheticIdName).toBe('apoint4');
    expect(circle.creationIndex).toBe(5);
    expect(circle.phantomSlot).toBe(true);
    expect(circle.noUidSlot).toBe(true);
    expect(circle.subsumedLinkCreationIndex).toBeUndefined();

    const aEdge = findRel(ast, a.id, circle.id);
    const bEdge = findRel(ast, circle.id, b.id);
    const classEdge = findRel(ast, circle.id, c.id);
    // createNew's own synthetic default `existingLink` (no prior A-B
    // association to subsume) burns ONE more phantom slot (6) before
    // entity1ToPoint (7).
    expect(aEdge.phantomSlot).toBe(true);
    expect(aEdge.creationIndex).toBe(7);
    expect(bEdge.creationIndex).toBe(8);
    expect(classEdge.creationIndex).toBe(9);
  });

  it('carries the SUBSUMED explicit association\'s own creationIndex as a ' +
    'standalone phantom rank, and does NOT burn the createNew default-link ' +
    'phantom (jaloja-18-tisu915)', () => {
    const ast = parse(`
      class Student
      Student -- Course
      (Student, Course) . Enrollment
    `);
    const student = ast.classifiers.find((c) => c.display === 'Student')!;
    const course = ast.classifiers.find((c) => c.display === 'Course')!;
    const enrollment = ast.classifiers.find((c) => c.display === 'Enrollment')!;
    const circle = ast.classifiers.find((c) => c.kind === 'assoc-circle')!;

    expect(student.creationIndex).toBe(1);
    expect(course.creationIndex).toBe(2);
    // The (removed) explicit `Student -- Course` association burned rank 3
    // before Enrollment (auto-created by the couple's OWN `ensure(c)`,
    // resolved BEFORE the circle) took rank 4.
    expect(enrollment.creationIndex).toBe(4);

    expect(circle.syntheticIdName).toBe('apoint5');
    expect(circle.creationIndex).toBe(6);
    expect(circle.subsumedLinkCreationIndex).toBe(3);

    const aEdge = findRel(ast, student.id, circle.id);
    const bEdge = findRel(ast, circle.id, course.id);
    const classEdge = findRel(ast, circle.id, enrollment.id);
    // No default-link phantom this time (an explicit association WAS
    // subsumed) -- entity1ToPoint burns the VERY NEXT rank after the
    // circle's own uid slot.
    expect(aEdge.phantomSlot).toBeUndefined();
    expect(aEdge.creationIndex).toBe(7);
    expect(bEdge.creationIndex).toBe(8);
    expect(classEdge.creationIndex).toBe(9);
  });

  it('G2 N20: stamps BOTH circles of a repeat-coupled (A,B) pair -- the ' +
    'SECOND (retrofitted) circle now gets its own name/uid/edge burns, ' +
    'matching `Association#createSecondAssociation`/`createInSecond`\'s ' +
    'real jar burn order (R1/R2 both TRAILING -- the conditional ' +
    '`getInv()` inversion never fires, since the PRIOR circle\'s own ' +
    'class edge already points C->circle)', () => {
    const ast = parse(`
      class R1
      class R2
      class A
      class B
      R1 .. (A,B)
      R2 .. (A,B)
    `);
    const circles = ast.classifiers.filter((c) => c.kind === 'assoc-circle');
    expect(circles).toHaveLength(2);
    // The FIRST coupling is not itself a repeat (isRepeatCouple only applies
    // to the SECOND circle created on an already-coupled pair) -- it gets
    // stamped like any other single coupling. R1=1,R2=2,A=3,B=4.
    expect(circles[0]!.syntheticIdName).toBe('apoint5');
    expect(circles[0]!.creationIndex).toBe(6);
    // aEdge/bEdge: phantom(7), aEdge(8), bEdge(9); classEdge (R1->circle,
    // C->circle default for trailing form) burns 10.
    const aEdge1 = findRel(ast, ast.classifiers.find((c) => c.display === 'A')!.id, circles[0]!.id);
    const bEdge1 = findRel(ast, circles[0]!.id, ast.classifiers.find((c) => c.display === 'B')!.id);
    const classEdge1 = findRel(ast, ast.classifiers.find((c) => c.display === 'R1')!.id, circles[0]!.id);
    expect(aEdge1.creationIndex).toBe(8);
    expect(bEdge1.creationIndex).toBe(9);
    expect(classEdge1.creationIndex).toBe(10);
    expect(circles[0]!.invertedClassEdgeOldCreationIndex).toBeUndefined();

    // The SECOND (repeat) circle now DOES get stamped -- G2 N20's landed
    // mechanism (`createInSecond`'s own ctor+phantom+aEdge+bEdge burns,
    // identical shape to a non-repeat coupling).
    expect(circles[1]!.syntheticIdName).toBe('apoint11');
    expect(circles[1]!.creationIndex).toBe(12);
    expect(circles[1]!.phantomSlot).toBe(true);
    expect(circles[1]!.noUidSlot).toBe(true);
    const aEdge2 = findRel(ast, ast.classifiers.find((c) => c.display === 'A')!.id, circles[1]!.id);
    const bEdge2 = findRel(ast, circles[1]!.id, ast.classifiers.find((c) => c.display === 'B')!.id);
    // phantom(13), aEdge(14), bEdge(15) -- createInSecond's OWN default-link
    // phantom is ALWAYS burned (existingLink is always null by this point).
    expect(aEdge2.phantomSlot).toBe(true);
    expect(aEdge2.creationIndex).toBe(14);
    expect(bEdge2.creationIndex).toBe(15);
    // No conditional getInv() burn here (R1's class edge already points
    // C->circle, not circle->C) -- classEdge burns the VERY NEXT rank (16),
    // then the invisible sibling link burns LAST (17).
    const classEdge2 = findRel(ast, circles[1]!.id, ast.classifiers.find((c) => c.display === 'R2')!.id);
    expect(classEdge2.creationIndex).toBe(16);
    expect(circles[1]!.repeatCoupleInvisLinkCreationIndex).toBe(17);
  });

  it('G2 N20: the CONDITIONAL getInv() inversion fires when the PRIOR ' +
    'circle\'s class edge already points circle->C (a LEADING first ' +
    'coupling, bunuce-10-vere519\'s shape) -- splices the class edge to a ' +
    'NEW draw-order position, flips its direction, re-stamps its ' +
    'creationIndex, and orphans the old value as a phantom rank', () => {
    const ast = parse(`
      class R1
      class R2
      A-B
      (A,B) .. R1
      R2 .. (A,B)
    `);
    const r1 = ast.classifiers.find((c) => c.display === 'R1')!;
    const r2 = ast.classifiers.find((c) => c.display === 'R2')!;
    const circles = ast.classifiers.filter((c) => c.kind === 'assoc-circle');
    expect(circles).toHaveLength(2);

    // R1=1, R2=2, A=3, B=4 (auto-created), the A-B relationship=5.
    expect(circles[0]!.creationIndex).toBe(7);
    expect(circles[0]!.syntheticIdName).toBe('apoint6');
    expect(circles[0]!.subsumedLinkCreationIndex).toBe(5);

    // The first coupling was LEADING ("(A,B) .. R1") -> its OWN class edge
    // originally pointed circle->R1 -- the exact precondition for the
    // SECOND coupling's conditional inversion to fire.
    const classEdge1 = findRel(ast, r1.id, circles[0]!.id);
    expect(classEdge1.creationIndex).toBe(16); // re-stamped, not the original 10
    expect(circles[0]!.invertedClassEdgeOldCreationIndex).toBe(10);

    expect(circles[1]!.creationIndex).toBe(12);
    expect(circles[1]!.syntheticIdName).toBe('apoint11');
    const aEdge2 = findRel(ast, ast.classifiers.find((c) => c.display === 'A')!.id, circles[1]!.id);
    const bEdge2 = findRel(ast, circles[1]!.id, ast.classifiers.find((c) => c.display === 'B')!.id);
    expect(aEdge2.creationIndex).toBe(14);
    expect(bEdge2.creationIndex).toBe(15);
    const classEdge2 = findRel(ast, circles[1]!.id, r2.id);
    expect(classEdge2.creationIndex).toBe(17);
    expect(circles[1]!.repeatCoupleInvisLinkCreationIndex).toBe(18);

    // Draw-order: the inverted classEdge1 is SPLICED to right after
    // aEdge2/bEdge2 (jar's real removeLink+addLink reordering) -- NOT its
    // original position right after aEdge1/bEdge1.
    const order = ast.relationships
      .filter((r) => r.invis !== true)
      .map((r) => `${r.from}->${r.to}`);
    expect(order.indexOf(`${r1.id}->${circles[0]!.id}`))
      .toBeGreaterThan(order.indexOf(`${circles[1]!.id}->${bEdge2.to}`));
  });
});
