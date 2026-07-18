/**
 * Unit tests for class-layout-helpers.ts#splitEdgeLabelLines/edgeLabelAttrs
 * -- G2 item 43 (multi-line edge labels): a relationship label containing
 * `\n`/`\l`/`\r` escape sequences (upstream line-break markers) must split
 * into one line per segment, with the LAST `\l`/`\r` occurrence setting the
 * WHOLE block's alignment (default CENTER when neither appears) --
 * `Display#getWithNewlines`, `klimt/creole/Display.java:259-343`.
 */
import { describe, it, expect } from 'vitest';
import { splitEdgeLabelLines, edgeLabelAttrs } from '../../../src/diagrams/class/class-layout-helpers.js';
import type { Relationship } from '../../../src/diagrams/class/ast.js';

describe('splitEdgeLabelLines (G2 item 43)', () => {
  it('returns a single line with center alignment when no escape is present', () => {
    expect(splitEdgeLabelLines('demo')).toEqual({ lines: ['demo'], align: 'center' });
  });

  // Jar-verified against `sicile-99-pefa679`'s own 3-line `\n` label
  // (`cl1 -- cl2 : this is\non several\nlines`).
  it('splits on \\n with no alignment change (default CENTER)', () => {
    expect(splitEdgeLabelLines('this is\\non several\\nlines')).toEqual({
      lines: ['this is', 'on several', 'lines'],
      align: 'center',
    });
  });

  it('splits on \\l and sets alignment to left', () => {
    expect(splitEdgeLabelLines('this is\\lon several\\llines')).toEqual({
      lines: ['this is', 'on several', 'lines'],
      align: 'left',
    });
  });

  it('splits on \\r and sets alignment to right', () => {
    expect(splitEdgeLabelLines('this is\\ron several\\rlines')).toEqual({
      lines: ['this is', 'on several', 'lines'],
      align: 'right',
    });
  });

  it('the LAST \\l/\\r occurrence wins, matching jar\'s overwritten field', () => {
    expect(splitEdgeLabelLines('a\\rb\\lc')).toEqual({ lines: ['a', 'b', 'c'], align: 'left' });
  });

  it('\\t becomes a literal tab within the current line', () => {
    expect(splitEdgeLabelLines('a\\tb')).toEqual({ lines: ['a\tb'], align: 'center' });
  });

  it('\\\\ becomes a literal backslash', () => {
    expect(splitEdgeLabelLines('a\\\\b')).toEqual({ lines: ['a\\b'], align: 'center' });
  });

  it('an unrecognized \\x pair is kept as-is (both characters)', () => {
    expect(splitEdgeLabelLines('a\\zb')).toEqual({ lines: ['a\\zb'], align: 'center' });
  });

  it('a trailing lone backslash is kept as-is', () => {
    expect(splitEdgeLabelLines('abc\\')).toEqual({ lines: ['abc\\'], align: 'center' });
  });
});

const measurer = {
  measure: (s: string) => ({ width: s.length * 7, height: 14 }),
  getDescent: () => 3,
};
const font = { family: 'sans', size: 14 };

function rel(label: string): Relationship {
  return { from: 'A', to: 'B', type: 'association', label };
}

describe('edgeLabelAttrs — multi-line label sizing (G2 item 43)', () => {
  it('measures a single-line label unchanged (pre-existing behavior)', () => {
    const attrs = edgeLabelAttrs(rel('demo'), font, measurer);
    expect(attrs.label).toBe('demo');
    expect(attrs.labelWidth).toBe(28); // 'demo'.length * 7
    expect(attrs.labelHeight).toBe(14);
  });

  it('reserves the WIDEST line\'s width and the stacked height for a multi-line label', () => {
    // Lines: 'this is' (7), 'on several' (10), 'lines' (5) -- widths *7.
    const attrs = edgeLabelAttrs(rel('this is\\non several\\nlines'), font, measurer);
    expect(attrs.label).toBe('this is\\non several\\nlines');
    expect(attrs.labelWidth).toBe(70); // 'on several'.length(10) * 7
    expect(attrs.labelHeight).toBe(42); // 14 (one line's height) * 3 lines
  });
});

describe('edgeLabelAttrs — magic-arrow label sizing (G2 item 44)', () => {
  it('reserves ARROW_GLYPH_SIZE plus the stripped text width for "foo >"', () => {
    const attrs = edgeLabelAttrs(rel('foo >'), font, measurer);
    // 'foo'.length(3) * 7 = 21; ARROW_GLYPH_SIZE = trunc(13*0.8) = 10.
    expect(attrs.labelWidth).toBe(31);
    expect(attrs.labelHeight).toBe(14); // max(10, 14)
  });

  it('reserves ONLY ARROW_GLYPH_SIZE for a bare ">" (no remaining text)', () => {
    const attrs = edgeLabelAttrs(rel('>'), font, measurer);
    expect(attrs.labelWidth).toBe(10);
    expect(attrs.labelHeight).toBe(10);
  });

  it('a stereotype guillemet label is measured via the plain (non-arrow) path', () => {
    const attrs = edgeLabelAttrs(rel('<<alias>>'), font, measurer);
    expect(attrs.labelWidth).toBe(63); // '<<alias>>'.length(9) * 7
  });
});
