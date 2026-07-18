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
