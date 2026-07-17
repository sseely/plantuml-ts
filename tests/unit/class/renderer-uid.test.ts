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

function classifier(id: string, creationIndex?: number): ClassifierGeo {
  return {
    id,
    kind: 'class',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    dividerYs: [],
    rows: [],
    ...(creationIndex !== undefined ? { creationIndex } : {}),
  };
}

function namespace(id: string, creationIndex?: number): NamespaceGeo {
  return { id, x: 0, y: 0, width: 10, height: 10, label: id, ...(creationIndex !== undefined ? { creationIndex } : {}) };
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
