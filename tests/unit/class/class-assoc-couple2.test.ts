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
