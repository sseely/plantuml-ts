import { describe, it, expect } from 'vitest';
import { renderNote } from '../../../src/diagrams/class/renderer-note.js';
import type { NoteGeo } from '../../../src/diagrams/class/note-layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FontStyle } from '../../../src/core/klimt/shape/UText.js';
import type { MemberRenderAtom } from '../../../src/diagrams/class/class-member-creole.js';

const baseNote: NoteGeo = {
  id: '__note_0',
  x: 0,
  y: 0,
  width: 40,
  height: 23,
  lines: ['l1', 'l2'],
  lineWidths: [10, 8],
  connector: [],
};

// G2 N39: `<style> note { FontSize N }` / `skinparam noteFontSize N` --
// jar-verified `xokipa-29-rafu481`. `theme.colors.elements['note'].fontSize`
// is ALREADY populated by the pre-existing generic bucket mechanism
// (`ELEMENT_BUCKET_SNAMES`, G2 N34); this only wires the consuming side.
describe('renderNote — theme-overridden note fontSize (G2 N39)', () => {
  it('draws every text row at the theme-overridden fontSize, not the hardcoded default 13', () => {
    const theme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, elements: { note: { fontSize: 10 } } },
    };
    const svg = renderNote(baseNote, theme);
    expect(svg).toContain('font-size="10"');
    expect(svg).not.toContain('font-size="13"');
  });

  it('falls back to the hardcoded default 13 when no note fontSize override is set', () => {
    const svg = renderNote(baseNote, defaultTheme);
    expect(svg).toContain('font-size="13"');
  });

  it('spaces stacked lines by the OVERRIDDEN fontSize, not the hardcoded default', () => {
    const theme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, elements: { note: { fontSize: 10 } } },
    };
    const svg = renderNote(baseNote, theme);
    const ys = [...svg.matchAll(/<text x="[^"]*" y="([^"]*)"/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(2);
    // baselineOffset = 10 - 10/4.5; row i's y = note.y + marginY + i*fontSize + baselineOffset.
    const baselineOffset = 10 - 10 / 4.5;
    expect(ys[1]! - ys[0]!).toBeCloseTo(10, 4);
    expect(ys[0]).toBeCloseTo(5 + baselineOffset, 4);
  });
});

// G2 N55: `note.lineAtoms` present -> per-RUN creole atom rendering, one
// `<text>` per styled run, x-advancing by each atom's OWN measured width --
// the note-local mirror of `renderer-classifier-box.test.ts`'s member-row
// atom coverage (G2 N22). `baseNote` above (no `lineAtoms`) proves the
// FALLBACK path stays byte-identical to pre-cutover behavior; this block
// proves the NEW per-atom path.
describe('renderNote — per-run creole atom rendering (G2 N55)', () => {
  const plainFont = { family: 'sans-serif', size: 13, color: null, styles: new Set<FontStyle>() };
  const boldFont = { family: 'sans-serif', size: 13, color: null, styles: new Set([FontStyle.BOLD]) };

  const boldNote: NoteGeo = {
    id: '__note_0',
    x: 0,
    y: 0,
    width: 80,
    height: 23,
    lines: ['Yet another'],
    lineWidths: [70],
    lineAtoms: [
      [
        { kind: 'text', text: 'Yet ', font: plainFont, width: 20 } satisfies MemberRenderAtom,
        { kind: 'text', text: 'another', font: boldFont, width: 50 } satisfies MemberRenderAtom,
      ],
    ],
    connector: [],
  };

  it('draws one <text> per atom run, x-advancing by the PRIOR atom\'s own width (jar: tenobo-24-liga464)', () => {
    const svg = renderNote(boldNote, defaultTheme);
    const texts = [...svg.matchAll(/<text x="([^"]*)"[^>]*>([^<]*)<\/text>/g)];
    expect(texts).toHaveLength(2);
    expect(texts[0]![2]).toBe('Yet ');
    expect(texts[1]![2]).toBe('another');
    expect(Number(texts[0]![1])).toBe(0 + 6); // note.x + NOTE_MARGIN_X1
    expect(Number(texts[1]![1])).toBe(0 + 6 + 20); // prior atom's own width
  });

  it('the BOLD run carries font-weight="700", the plain run does not', () => {
    const svg = renderNote(boldNote, defaultTheme);
    const texts = [...svg.matchAll(/<text[^>]*>[^<]*<\/text>/g)].map((m) => m[0]);
    expect(texts[0]).not.toContain('font-weight');
    expect(texts[1]).toContain('font-weight="700"');
  });

  it('an atom\'s OWN resolved color overrides the hardcoded #000000 default', () => {
    const coloredNote: NoteGeo = {
      ...boldNote,
      lineAtoms: [[{ kind: 'text', text: 'warning', font: { ...plainFont, color: '#FF0000' }, width: 40 }]],
    };
    const svg = renderNote(coloredNote, defaultTheme);
    expect(svg).toContain('fill="#FF0000"');
  });

  it('a hand-built NoteGeo with NO lineAtoms falls back to the pre-cutover single-<text>-per-line path unchanged', () => {
    const svg = renderNote(baseNote, defaultTheme);
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
    expect(texts.map((m) => m[1])).toEqual(['l1', 'l2']);
  });
});

// G2 N67 item 49: `<style> note { FontColor N } }` cascade -- the note-body
// FontColor fallback tier `renderNoteLineAtoms`/`renderNoteText` previously
// never consulted (hardcoded `fill="#000000"` unconditionally, per that
// function's own now-superseded doc comment). `theme.colors.graph
// .noteCascadeFontColor` (`style-cascade-class.ts`, `NOTE_SNAMES`) sits
// BELOW an atom's own explicit `<color>` run (unchanged precedence, G2 N55)
// but ABOVE the hardcoded black default -- jar-verified `nufini-44-jofo787`
// (`<style> note { Fontcolor red } }`, every note text run `fill="#FF0000"`).
describe('renderNote — note FontColor cascade (G2 N67 item 49)', () => {
  it('the per-atom creole path (lineAtoms) uses the cascade when the atom has no OWN color (nufini-44-jofo787 shape)', () => {
    const themed = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, noteCascadeFontColor: '#FF0000' } },
    };
    const plainFont = { family: 'sans-serif', size: 13, color: null, styles: new Set<FontStyle>() };
    const note: NoteGeo = {
      ...baseNote,
      lines: ['red note'],
      lineWidths: [40],
      lineAtoms: [[{ kind: 'text', text: 'red note', font: plainFont, width: 40 } satisfies MemberRenderAtom]],
    };
    const svg = renderNote(note, themed);
    expect(svg).toContain('fill="#FF0000"');
  });

  it("an atom's OWN explicit color still wins over the cascade", () => {
    const themed = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, noteCascadeFontColor: '#FF0000' } },
    };
    const plainFont = { family: 'sans-serif', size: 13, color: '#0000FF', styles: new Set<FontStyle>() };
    const note: NoteGeo = {
      ...baseNote,
      lines: ['blue run'],
      lineWidths: [40],
      lineAtoms: [[{ kind: 'text', text: 'blue run', font: plainFont, width: 40 } satisfies MemberRenderAtom]],
    };
    const svg = renderNote(note, themed);
    expect(svg).toContain('fill="#0000FF"');
    expect(svg).not.toContain('fill="#FF0000"');
  });

  it('the pre-cutover fallback path (no lineAtoms) ALSO uses the cascade', () => {
    const themed = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, noteCascadeFontColor: '#FF0000' } },
    };
    const svg = renderNote(baseNote, themed);
    const texts = [...svg.matchAll(/<text[^>]*fill="([^"]*)"[^>]*>/g)];
    expect(texts.map((m) => m[1])).toEqual(['#FF0000', '#FF0000']);
  });

  it('falls back to the hardcoded #000000 default when no cascade is set (unset-is-noop regression guard)', () => {
    const svg = renderNote(baseNote, defaultTheme);
    const texts = [...svg.matchAll(/<text[^>]*fill="([^"]*)"[^>]*>/g)];
    expect(texts.map((m) => m[1])).toEqual(['#000000', '#000000']);
  });
});


// G2 N56: per-atom baseline within a mixed-size line -- jar-verified against
// `fogexa-30-zupo141`'s real golden SVG: "In java," @ y=26.1111 (13pt),
// "every" @ y=25 (18pt, `<size:18>`), " "/"class" @ y=26.1111 (13pt) again --
// all FOUR atoms sit on the SAME physical line, but the 18pt run's baseline
// sits 1.1111 HIGHER (its own larger descent pulls it up relative to the
// smaller runs, since every atom's measured-rect BOTTOM -- not baseline --
// aligns to the line's shared `lineTop + lineHeight`). See `note-layout.ts
// #noteLineHeight`'s own doc comment for the full derivation.
describe('renderNote — per-atom baseline on a mixed-font-size line (G2 N56)', () => {
  const plain13 = { family: 'sans-serif', size: 13, color: null, styles: new Set<FontStyle>() };
  const big18 = { family: 'sans-serif', size: 18, color: null, styles: new Set<FontStyle>() };

  const mixedNote: NoteGeo = {
    id: '__note_0',
    x: 6,
    y: 6,
    width: 132.9125,
    height: 54,
    lines: ['In java, every class'],
    lineWidths: [80.85],
    lineAtoms: [
      [
        { kind: 'text', text: 'In java, ', font: plain13, width: 38.2688 } satisfies MemberRenderAtom,
        { kind: 'text', text: 'every', font: big18, width: 43.9875 } satisfies MemberRenderAtom,
        { kind: 'text', text: ' ', font: plain13, width: 3.575 } satisfies MemberRenderAtom,
        { kind: 'text', text: 'class', font: plain13, width: 29.6563 } satisfies MemberRenderAtom,
      ],
    ],
    lineHeights: [18],
    connector: [],
  };

  it('the 18pt run\'s baseline sits ABOVE the 13pt runs\' baseline on the SAME line', () => {
    const svg = renderNote(mixedNote, defaultTheme);
    const ys = [...svg.matchAll(/<text x="[^"]*" y="([^"]*)"/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(4);
    // note.y(6) + NOTE_MARGIN_Y(5) + lineHeight(18) - descent(13pt: 13/4.5).
    const y13 = 6 + 5 + 18 - 13 / 4.5;
    // Same lineTop/lineHeight, this atom's OWN (larger) descent: 18/4.5.
    const y18 = 6 + 5 + 18 - 18 / 4.5;
    expect(ys[0]).toBeCloseTo(y13, 4); // "In java, "
    expect(ys[1]).toBeCloseTo(y18, 4); // "every"
    expect(ys[2]).toBeCloseTo(y13, 4); // " "
    expect(ys[3]).toBeCloseTo(y13, 4); // "class"
    expect(y13 - y18).toBeCloseTo(1.1111, 4); // jar: 26.1111 - 25 == 1.1111
  });
});
