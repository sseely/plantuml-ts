import { describe, it, expect } from 'vitest';
import {
  findFreestandingNoteRelationshipIndices,
  findFreestandingNoteConnectors,
} from '../../../src/diagrams/class/note-freestanding.js';
import type { ClassNote, Classifier, Relationship } from '../../../src/diagrams/class/ast.js';
import type { EdgeGeo } from '../../../src/diagrams/class/layout.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNote(id: string, overrides?: Partial<ClassNote>): ClassNote {
  return { id, text: 'x', ...overrides };
}

function makeRelationship(from: string, to: string, overrides?: Partial<Relationship>): Relationship {
  return { from, to, type: 'association', ...overrides };
}

function makeEdgeGeo(id: string, from: string, to: string): EdgeGeo {
  return { id, from, to, points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false };
}

function makeClassifier(id: string, kind: Classifier['kind'] = 'class'): Classifier {
  return { id, display: id, kind, typeParams: [], members: [] };
}

const NO_CLASSIFIERS: Classifier[] = [];

// ---------------------------------------------------------------------------
// findFreestandingNoteRelationshipIndices (PRE-layout, class-dot-graph.ts's
// noArrow gate)
// ---------------------------------------------------------------------------

describe('findFreestandingNoteRelationshipIndices', () => {
  it('returns the index of a relationship connecting a freestanding note to a real entity', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', 'Bar')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS)).toEqual(new Set([0]));
  });

  it('matches when the note is the TO endpoint instead of FROM', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('Bar', 'N1')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS)).toEqual(new Set([0]));
  });

  it('excludes an ATTACHED note (target set -- not freestanding)', () => {
    const notes = [makeNote('N1', { target: 'Bar', position: 'right' })];
    const rels = [makeRelationship('N1', 'Bar')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes a note with TWO connections (isOpalisable requires exactly one)', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', 'Bar'), makeRelationship('N1', 'Baz')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes a note-to-note relationship', () => {
    const notes = [makeNote('N1'), makeNote('N2')];
    const rels = [makeRelationship('N1', 'N2')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes an invisible relationship', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', 'Bar', { invis: true })];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS).size).toBe(0);
  });

  it('preserves the relationship\'s own index among several unrelated ones', () => {
    const notes = [makeNote('N1')];
    const rels = [
      makeRelationship('Foo', 'Goo'),
      makeRelationship('N1', 'Bar'),
      makeRelationship('Baz', 'Qux'),
    ];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS)).toEqual(new Set([1]));
  });

  it('returns an empty set when there are no freestanding notes at all', () => {
    expect(
      findFreestandingNoteRelationshipIndices([], [makeRelationship('Foo', 'Bar')], NO_CLASSIFIERS).size,
    ).toBe(0);
  });

  it('two DIFFERENT freestanding notes each with their own single connection are both eligible', () => {
    const notes = [makeNote('N1'), makeNote('N2')];
    const rels = [makeRelationship('N1', 'Bar'), makeRelationship('N2', 'Baz')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, NO_CLASSIFIERS)).toEqual(new Set([0, 1]));
  });

  // G2/N16 scope guard (diagnosed via temise-16-neco018's 3->234 regression):
  // a synthetic assoc-circle/lollipop entity is never a valid Kind-B target.
  it('excludes a relationship whose other endpoint is an assoc-circle synthetic entity ((A,B) couple point)', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', '__assoc0')];
    const classifiers = [makeClassifier('__assoc0', 'assoc-circle')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, classifiers).size).toBe(0);
  });

  it('excludes a relationship whose other endpoint is a lollipop synthetic entity', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', '__lol0')];
    const classifiers = [makeClassifier('__lol0', 'lollipop')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, classifiers).size).toBe(0);
  });

  it('still matches an ordinary classifier alongside unrelated synthetic entities', () => {
    const notes = [makeNote('N1')];
    const rels = [makeRelationship('N1', 'Bar')];
    const classifiers = [makeClassifier('Bar'), makeClassifier('__assoc0', 'assoc-circle')];
    expect(findFreestandingNoteRelationshipIndices(notes, rels, classifiers)).toEqual(new Set([0]));
  });
});

// ---------------------------------------------------------------------------
// findFreestandingNoteConnectors (POST-layout, layout.ts's connector-point
// + edge-suppression source)
// ---------------------------------------------------------------------------

describe('findFreestandingNoteConnectors', () => {
  it('maps the freestanding note id to its ONE connecting EdgeGeo', () => {
    const notes = [makeNote('N1')];
    const edges = [makeEdgeGeo('edge-0', 'N1', 'Bar')];
    const result = findFreestandingNoteConnectors(notes, edges, NO_CLASSIFIERS);
    expect(result.get('N1')).toBe(edges[0]);
    expect(result.size).toBe(1);
  });

  it('excludes a note with two connecting edges', () => {
    const notes = [makeNote('N1')];
    const edges = [makeEdgeGeo('edge-0', 'N1', 'Bar'), makeEdgeGeo('edge-1', 'N1', 'Baz')];
    expect(findFreestandingNoteConnectors(notes, edges, NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes an edge unrelated to any note', () => {
    const notes = [makeNote('N1')];
    const edges = [makeEdgeGeo('edge-0', 'Foo', 'Goo')];
    expect(findFreestandingNoteConnectors(notes, edges, NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes an ATTACHED note (its connector comes from note-layout.ts, not this module)', () => {
    const notes = [makeNote('N1', { target: 'Bar', position: 'right' })];
    const edges = [makeEdgeGeo('edge-0', 'N1', 'Bar')];
    expect(findFreestandingNoteConnectors(notes, edges, NO_CLASSIFIERS).size).toBe(0);
  });

  it('returns an empty map for an empty edge list', () => {
    expect(findFreestandingNoteConnectors([makeNote('N1')], [], NO_CLASSIFIERS).size).toBe(0);
  });

  it('excludes an edge whose other endpoint is an assoc-circle synthetic entity (N1 .. (A,B))', () => {
    const notes = [makeNote('N1')];
    const edges = [makeEdgeGeo('edge-0', 'N1', '__assoc0')];
    const classifiers = [makeClassifier('__assoc0', 'assoc-circle')];
    expect(findFreestandingNoteConnectors(notes, edges, classifiers).size).toBe(0);
  });
});
