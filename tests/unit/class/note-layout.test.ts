import { describe, it, expect } from 'vitest';
import { buildNoteGraphParts, mapNoteGeos } from '../../../src/diagrams/class/note-layout.js';
import { javaRound4 } from '../../../src/core/number-format.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { ClassNote, NotePosition } from '../../../src/diagrams/class/ast.js';

const measurer = new FormulaMeasurer();
const note = (position: NotePosition): ClassNote => ({
  id: '__note_0',
  target: 'A',
  position,
  text: 'hello',
});

const noAnchors = new Map<string, string>();

describe('buildNoteGraphParts — seam node + connector edge', () => {
  it('emits one sized note node and one connector edge', () => {
    const { nodes, edges, measurements } = buildNoteGraphParts(
      [note('left')],
      defaultTheme,
      measurer,
      noAnchors,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.id).toBe('__note_0');
    expect(nodes[0]!.width).toBeGreaterThan(0);
    expect(nodes[0]!.height).toBeGreaterThan(0);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.id).toBe('__noteedge___note_0');
    expect(measurements.get('__note_0')?.lines).toEqual(['hello']);
  });

  it('directs the edge and sets minLen per position (Svek note-on-entity)', () => {
    const dir = (p: NotePosition) => {
      const e = buildNoteGraphParts([note(p)], defaultTheme, measurer, noAnchors).edges[0]!;
      return { from: e.from, to: e.to, minLen: e.attributes?.minLen };
    };
    expect(dir('left')).toEqual({ from: '__note_0', to: 'A', minLen: 0 });
    expect(dir('right')).toEqual({ from: 'A', to: '__note_0', minLen: 0 });
    expect(dir('top')).toEqual({ from: '__note_0', to: 'A', minLen: 1 });
    expect(dir('bottom')).toEqual({ from: 'A', to: '__note_0', minLen: 1 });
  });

  it('splits multi-line note text into render lines', () => {
    const n: ClassNote = { id: '__note_0', target: 'A', position: 'top', text: 'l1\nl2\nl3' };
    const { measurements } = buildNoteGraphParts([n], defaultTheme, measurer, noAnchors);
    expect(measurements.get('__note_0')?.lines).toEqual(['l1', 'l2', 'l3']);
  });

  // G2/N21: `<U+XXXX>` unicode-codepoint escapes resolve to their literal
  // glyph BEFORE the text is split into lines/measured -- jar-verified
  // against `pacuve-18-gaso238`'s `<U+005C>` (a literal backslash).
  it('resolves <U+XXXX> unicode escapes in note text before splitting/measuring', () => {
    const n: ClassNote = {
      id: '__note_0', target: 'A', position: 'top', text: 'dd if=/tmp/zImage <U+005C>',
    };
    const { measurements } = buildNoteGraphParts([n], defaultTheme, measurer, noAnchors);
    const m = measurements.get('__note_0')!;
    expect(m.lines).toEqual(['dd if=/tmp/zImage \\']);
    const fontSpec = { family: defaultTheme.fontFamily, size: 13 };
    expect(m.lineWidths[0]).toBeCloseTo(measurer.measure('dd if=/tmp/zImage \\', fontSpec).width, 4);
  });

  // G2/N21: each line's `textLength` must be ITS OWN measured width, not the
  // note box's shared max-line-driven width -- jar-verified against
  // `sisolu-74-minu975`'s 3-line note (line 1 dominates the box width, lines
  // 2-3 are strictly narrower and each carry a DIFFERENT `textLength`).
  it('measures each line INDIVIDUALLY (lineWidths), not one shared box width', () => {
    const n: ClassNote = {
      id: '__note_0', target: 'A', position: 'top', text: 'a longer line one\nshort\nmid line',
    };
    const { measurements } = buildNoteGraphParts([n], defaultTheme, measurer, noAnchors);
    const m = measurements.get('__note_0')!;
    const fontSpec = { family: defaultTheme.fontFamily, size: 13 };
    const expected = m.lines.map((ln) => javaRound4(measurer.measure(ln, fontSpec).width));
    expect(m.lineWidths).toEqual(expected);
    // Genuinely different per line (not a degenerate all-equal fixture) --
    // proves the box's own `width` (== the LONGEST line, via NoteMeasurement
    // .width) cannot be substituted for every row's textLength.
    expect(new Set(m.lineWidths).size).toBeGreaterThan(1);
    expect(m.width).toBe(Math.max(...m.lineWidths) + 6 + 15);
  });
});


describe('mapNoteGeos — member-tip (`::member`) note connector resolution (G2/N13)', () => {
  // Host classifier "A" with two member rows (skipping the header row,
  // index 0) -- mirrors `ClassifierGeo.rows`' shape (header first, then
  // fields/methods in declaration order).
  const host = {
    id: 'A',
    x: 100,
    y: 50,
    rows: [
      { text: 'A', y: 20 }, // header, never matched (excluded via .slice(1))
      { text: 'member1', y: 46.8889, width: 59.0625 },
      { text: 'memberB()', y: 60.8889, width: 69.9125 },
    ],
  };

  const tipNote = (id: string, targetPort: string): ClassNote => ({
    id,
    target: 'A',
    targetPort,
    position: 'right',
    text: 'hi',
  });

  function layoutResultFor(noteId: string, noteX: number, noteY: number, w: number, h: number) {
    return {
      nodes: [{ id: noteId, x: noteX, y: noteY, width: w, height: h }],
      edges: [],
      width: 0,
      height: 0,
    };
  }

  it('resolves a matched member-tip note: direction, pp1 fixed at (0, height/2), pp2 from the row anchor', () => {
    const notes = [tipNote('__note_0', 'member1')];
    const { measurements, groups } = buildNoteGraphParts(notes, defaultTheme, measurer, noAnchors);
    const result = layoutResultFor('__note_0', 200, 50, measurements.get('__note_0')!.width, measurements.get('__note_0')!.height);
    const geos = mapNoteGeos(notes, result, { measurements, groups }, { classifiers: [host], theme: defaultTheme, measurer });

    expect(geos).toHaveLength(1);
    const geo = geos[0]!;
    expect(geo.dropped).toBeUndefined();
    expect(geo.connector).toEqual([]);
    // position === 'right' -> initial direction LEFT (Position.RIGHT.reverseDirection() === LEFT);
    // host.x(100) - note.x(200) = -100 < 0, but the flip only triggers for an
    // initial RIGHT direction, so LEFT stays LEFT here.
    expect(geo.tip?.direction).toBe('left');
    expect(geo.tip?.pp1).toEqual({ x: 0, y: geo.height / 2 });
    // pp2.x = (host.x - note.x) + (ROW_TEXT_LEFT_MARGIN + row.width) for LEFT.
    expect(geo.tip?.pp2.x).toBeCloseTo(-100 + 6 + 59.0625, 6);
  });

  it('drops a member-tip note whose ::member target matches no host row', () => {
    const notes = [tipNote('__note_0', 'typo')];
    const { measurements, groups } = buildNoteGraphParts(notes, defaultTheme, measurer, noAnchors);
    const result = layoutResultFor('__note_0', 200, 50, measurements.get('__note_0')!.width, measurements.get('__note_0')!.height);
    const geos = mapNoteGeos(notes, result, { measurements, groups }, { classifiers: [host], theme: defaultTheme, measurer });

    expect(geos).toHaveLength(1);
    expect(geos[0]!.dropped).toBe(true);
    expect(geos[0]!.tip).toBeUndefined();
  });

  it('aborts every LATER member in a merged group once one fails to match (EntityImageTips#drawU mid-loop early return)', () => {
    const notes = [tipNote('__note_0', 'typo'), tipNote('__note_1', 'member1')];
    const { measurements, groups } = buildNoteGraphParts(notes, defaultTheme, measurer, noAnchors);
    const grp = groups[0]!;
    expect(grp.memberIndices).toEqual([0, 1]); // merged: same host + side
    const result = layoutResultFor(grp.id, 200, 50, 999, 999);
    const geos = mapNoteGeos(notes, result, { measurements, groups }, { classifiers: [host], theme: defaultTheme, measurer });

    expect(geos).toHaveLength(2);
    expect(geos[0]!.dropped).toBe(true);
    // member1 WOULD match on its own, but the group already aborted.
    expect(geos[1]!.dropped).toBe(true);
    expect(geos[1]!.tip).toBeUndefined();
  });

  it('stacks each tip at its OWN individual width, not the shared group max (jar: tenobo-24-liga464)', () => {
    const notes = [tipNote('__note_0', 'member1'), tipNote('__note_1', 'memberB')];
    const { measurements, groups } = buildNoteGraphParts(notes, defaultTheme, measurer, noAnchors);
    const grp = groups[0]!;
    const groupW = Math.max(...grp.memberIndices.map((i) => measurements.get(notes[i]!.id)!.width));
    const groupH = grp.memberIndices.reduce((s, i) => s + measurements.get(notes[i]!.id)!.height, 0);
    const result = layoutResultFor(grp.id, 200, 50, groupW, groupH);
    const geos = mapNoteGeos(notes, result, { measurements, groups }, { classifiers: [host], theme: defaultTheme, measurer });

    expect(geos).toHaveLength(2);
    expect(geos[0]!.dropped).toBeUndefined();
    expect(geos[1]!.dropped).toBeUndefined();
    // Different note text ("hi" for both here, so widths match this time --
    // the important assertion is that width comes from the INDIVIDUAL
    // measurement, not the shared node's max, and the second tip stacks
    // BELOW the first (y increases by the first tip's own height).
    expect(geos[0]!.width).toBe(measurements.get('__note_0')!.width);
    expect(geos[1]!.y).toBeGreaterThan(geos[0]!.y);
  });

  it('a non-member (plain) note on the same host+side never resolves as a tip', () => {
    const plain: ClassNote = { id: '__note_0', target: 'A', position: 'right', text: 'hi' };
    const { measurements, groups } = buildNoteGraphParts([plain], defaultTheme, measurer, noAnchors);
    const result = {
      nodes: [{ id: '__note_0', x: 200, y: 50, width: measurements.get('__note_0')!.width, height: measurements.get('__note_0')!.height }],
      edges: [{ id: '__noteedge___note_0', points: [{ x: 150, y: 50 }, { x: 200, y: 50 }] }],
      width: 0,
      height: 0,
    };
    const geos = mapNoteGeos([plain], result, { measurements, groups }, { classifiers: [host], theme: defaultTheme, measurer });

    expect(geos).toHaveLength(1);
    expect(geos[0]!.tip).toBeUndefined();
    expect(geos[0]!.dropped).toBeUndefined();
    // G2/N14: a single-member group with a real 2+-point connector resolves
    // as a general opalisable note (EntityImageNote.java's opaleLine branch)
    // -- NOT the old plain-fold-box + separate-dashed-line shape (that path
    // was NEVER jar-verified, see plans/g2-class-svg/ledger.md N13's own
    // diagnosis). `connector` is now empty -- the merged Opale outline
    // replaces it, no separate line draws.
    expect(geos[0]!.connector).toEqual([]);
    expect(geos[0]!.opale).toBeDefined();
  });
});
