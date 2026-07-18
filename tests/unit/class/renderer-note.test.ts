import { describe, it, expect } from 'vitest';
import { renderNote } from '../../../src/diagrams/class/renderer-note.js';
import type { NoteGeo } from '../../../src/diagrams/class/note-layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

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
