/**
 * G2 N15: `buildClassUidPlan`'s note handling — a note carrying a real
 * `creationIndex` (see `ast.ts#ClassNote.creationIndex`'s doc comment) is
 * now folded into the SAME dense-renumbering merge as classifiers/
 * namespaces/edges, in real creation-order position, instead of always
 * being fallback-numbered after everything else. A `phantomSlot`-marked
 * note additionally consumes a numbering RANK for its discarded "GMN"
 * counter increment WITHOUT that rank being written to any uid map —
 * dense re-numbering must NOT collapse that gap (unlike a genuinely
 * absent phantom classifier stub, which correctly has no Ranked entry at
 * all — see the module's own doc comment for the distinction).
 */
import { describe, it, expect } from 'vitest';
import { buildClassUidPlan } from '../../../src/diagrams/class/renderer-uid.js';
import type { ClassGeometry, ClassifierGeo, NamespaceGeo } from '../../../src/diagrams/class/layout.js';
import type { NoteGeo } from '../../../src/diagrams/class/note-layout.js';

function classifier(
  id: string,
  creationIndex?: number,
  opts: {
    kind?: ClassifierGeo['kind'];
    phantomSlot?: true;
    noUidSlot?: true;
    subsumedLinkCreationIndex?: number;
  } = {},
): ClassifierGeo {
  return {
    id,
    kind: opts.kind ?? 'class',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    dividerYs: [],
    rows: [],
    ...(creationIndex !== undefined ? { creationIndex } : {}),
    ...(opts.phantomSlot === true ? { phantomSlot: true as const } : {}),
    ...(opts.noUidSlot === true ? { noUidSlot: true as const } : {}),
    ...(opts.subsumedLinkCreationIndex !== undefined
      ? { subsumedLinkCreationIndex: opts.subsumedLinkCreationIndex }
      : {}),
  };
}

function namespace(id: string, creationIndex?: number): NamespaceGeo {
  return { id, x: 0, y: 0, width: 10, height: 10, label: id, wtitle: 5, htitle: 20, baselineOffset: 12.8889, ...(creationIndex !== undefined ? { creationIndex } : {}) };
}

function note(id: string, opts: { creationIndex?: number; phantomSlot?: true } = {}): NoteGeo {
  return { id, x: 0, y: 0, width: 10, height: 10, lines: [], connector: [], ...opts };
}

function geo(overrides: Partial<ClassGeometry>): ClassGeometry {
  return { totalWidth: 0, totalHeight: 0, classifiers: [], edges: [], namespaces: [], notes: [], ...overrides };
}

describe('buildClassUidPlan — note creation-index / phantom-slot handling (G2 N15)', () => {
  it('a non-tip attached note (phantomSlot=true) leaves a real gap in the ' +
     'dense uid sequence — jar-verified fezugi-39-fujo327 (a=ent0001, ' +
     'ent0002 never assigned, note=ent0003)', () => {
    const g = geo({
      classifiers: [classifier('a', 1)],
      notes: [note('n1', { creationIndex: 3, phantomSlot: true })],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('n1')).toBe('ent0003');
  });

  it('a freestanding note (creationIndex set, no phantomSlot) gets the very ' +
     'next dense rank — no gap', () => {
    const g = geo({
      classifiers: [classifier('a', 1)],
      notes: [note('n1', { creationIndex: 2 })],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('n1')).toBe('ent0002');
  });

  it('a note interleaves correctly with a classifier created AFTER it', () => {
    const g = geo({
      classifiers: [classifier('a', 1), classifier('b', 4)],
      notes: [note('n1', { creationIndex: 3, phantomSlot: true })],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('n1')).toBe('ent0003');
    expect(plan.classifierUid.get('b')).toBe('ent0004');
  });

  it('a member-tip note (no creationIndex) falls back, continuing the ' +
     'dense count from the exact pass\'s own last rank (pre-existing N13 ' +
     'behavior, unchanged)', () => {
    const g = geo({
      classifiers: [classifier('a', 1)],
      notes: [note('tip1')],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('tip1')).toBe('ent0002');
  });

  it('a mix of an exact-numbered note and a fallback (tip) note — the ' +
     'exact note takes its real interleaved rank, the tip note continues ' +
     'from the exact pass\'s final rank, in array order', () => {
    const g = geo({
      classifiers: [classifier('a', 1)],
      notes: [note('n1', { creationIndex: 3, phantomSlot: true }), note('tip1')],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('n1')).toBe('ent0003');
    // Exact pass consumed ranks 1 (a) + 2 (phantom) + 3 (n1) = 3 ranks;
    // the fallback continuation starts at 3 + 1 = 4.
    expect(plan.noteUid.get('tip1')).toBe('ent0004');
  });

  it('when the overall geometry is NOT exact (a classifier lacks ' +
     'creationIndex), notes fully fall back regardless of their own ' +
     'creationIndex — mixing a real creationIndex into an array-order ' +
     'fallback count would be meaningless', () => {
    const g = geo({
      classifiers: [classifier('a')], // no creationIndex -> fallback mode
      notes: [note('n1', { creationIndex: 99, phantomSlot: true })],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.noteUid.get('n1')).toBe('ent0002');
  });

  it('a namespace, a note, and an edge interleave by creationIndex ' +
     'together (multi-category exact merge)', () => {
    const g = geo({
      namespaces: [namespace('ns', 1)],
      classifiers: [classifier('a', 2)],
      notes: [note('n1', { creationIndex: 4, phantomSlot: true })],
      edges: [{ id: 'e1', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'a', to: 'ns', creationIndex: 5 }],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.namespaceUid.get('ns')).toBe('ent0001');
    expect(plan.classifierUid.get('a')).toBe('ent0002');
    // rank 3 is the discarded phantom slot (creationIndex 3, never assigned)
    expect(plan.noteUid.get('n1')).toBe('ent0004');
    expect(plan.edgeUid[0]).toBe('lnk5');
  });
});


describe('buildClassUidPlan — couple/lollipop synthetic-entity phantom-slot ' +
  'handling (G2 N19)', () => {
  it('an assoc-circle (phantomSlot + noUidSlot) consumes TWO ranks and ' +
    'writes NO classifierUid entry -- jar-verified buvake-41-vulu531 (A=' +
    'ent0001, B=ent0002, C=ent0003, name-slot+own-uid consume ranks 4-5, ' +
    'aEdge=lnk6)', () => {
    const g = geo({
      classifiers: [
        classifier('a', 1),
        classifier('b', 2),
        classifier('c', 3),
        classifier('circle', 5, { kind: 'assoc-circle', phantomSlot: true, noUidSlot: true }),
      ],
      edges: [
        { id: 'e1', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'a', to: 'circle', creationIndex: 7, phantomSlot: true },
        { id: 'e2', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'circle', to: 'b', creationIndex: 8 },
        { id: 'e3', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'circle', to: 'c', creationIndex: 9 },
      ],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('a')).toBe('ent0001');
    expect(plan.classifierUid.get('b')).toBe('ent0002');
    expect(plan.classifierUid.get('c')).toBe('ent0003');
    // The circle never gets a classifierUid entry at all.
    expect(plan.classifierUid.has('circle')).toBe(false);
    expect(plan.edgeUid).toEqual(['lnk7', 'lnk8', 'lnk9']);
  });

  it('a lollipop (phantomSlot only, no noUidSlot) DOES get a rendered ' +
    'classifierUid entry, one rank after its own preceding name-slot ' +
    'phantom -- jar-verified bososa-44-fipu544', () => {
    const g = geo({
      classifiers: [
        classifier('dummy', 1),
        classifier('lol', 3, { kind: 'lollipop', phantomSlot: true }),
      ],
      edges: [
        { id: 'e1', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'lol', to: 'dummy', creationIndex: 4 },
      ],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('dummy')).toBe('ent0001');
    // rank 2 is the discarded "lolN" name-slot phantom; the lollipop's own
    // (rendered) uid takes rank 3.
    expect(plan.classifierUid.get('lol')).toBe('ent0003');
    expect(plan.edgeUid).toEqual(['lnk4']);
  });

  it('subsumedLinkCreationIndex injects a standalone phantom rank, ' +
    'unrelated to the circle\'s own creationIndex -- jar-verified ' +
    'jaloja-18-tisu915 (the removed explicit Student--Course association\'s ' +
    'own burn keeps Enrollment at ent0004, not a naively-dense ent0003)', () => {
    const g = geo({
      classifiers: [
        classifier('student', 1),
        classifier('course', 2),
        classifier('enrollment', 4),
        classifier('circle', 6, { kind: 'assoc-circle', phantomSlot: true, noUidSlot: true, subsumedLinkCreationIndex: 3 }),
      ],
      edges: [
        { id: 'e1', points: [], targetDecor: 'none', sourceDecor: 'none', dashed: false, from: 'student', to: 'circle', creationIndex: 7 },
      ],
    });
    const plan = buildClassUidPlan(g);
    expect(plan.classifierUid.get('student')).toBe('ent0001');
    expect(plan.classifierUid.get('course')).toBe('ent0002');
    // Without the subsumed-link phantom, enrollment would land on ent0003
    // (the naive dense position) instead of jar's real ent0004.
    expect(plan.classifierUid.get('enrollment')).toBe('ent0004');
    expect(plan.edgeUid).toEqual(['lnk7']);
  });
});
