import { describe, it, expect } from 'vitest';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

/**
 * Validates the WidthTableMeasurer port against PlantUML's
 * StringBounderFromWidthTable + UnicodeFontWidthSansSerif (ADR-001). Expected
 * values are table[cp]/10 at the 16pt reference (factor = size/16). The table's
 * quirks (space = 0) are reproduced faithfully — the goal is identical
 * measurement to the oracle, not "correct" measurement.
 */
describe('WidthTableMeasurer — faithful port of StringBounderFromWidthTable', () => {
  const m = new WidthTableMeasurer();
  const font = { family: 'sans-serif', size: 16 };

  it('height equals the font size', () => {
    expect(m.measure('anything', font).height).toBe(16);
    expect(m.measure('x', { family: 'sans-serif', size: 42 }).height).toBe(42);
  });

  it.each<[string, number]>([
    ['A', 10.7],
    ['a', 8.9],
    ['i', 3.6],
    ['W', 15.1],
    ['.', 4.4],
    ['M', 13.3],
    ['1', 8.9],
  ])('ASCII %s measures %f px at 16pt', (ch, px) => {
    expect(m.measure(ch, font).width).toBeCloseTo(px, 6);
  });

  it('reproduces the table quirk: space = 0 width', () => {
    expect(m.measure(' ', font).width).toBe(0);
    // "My comp" therefore measures identically to "Mycomp".
    expect(m.measure('My comp', font).width).toBeCloseTo(
      m.measure('Mycomp', font).width,
      6,
    );
  });

  it('sums codepoints: "Ai" = A + i', () => {
    expect(m.measure('Ai', font).width).toBeCloseTo(10.7 + 3.6, 6);
  });

  it('scales linearly with font size (factor = size/16)', () => {
    const at16 = m.measure('AWM', { family: 's', size: 16 }).width;
    const at32 = m.measure('AWM', { family: 's', size: 32 }).width;
    expect(at32).toBeCloseTo(at16 * 2, 6);
  });

  it('is font-agnostic (family ignored, one table)', () => {
    const a = m.measure('Hello', { family: 'Courier', size: 16 }).width;
    const b = m.measure('Hello', { family: 'Times', size: 16 }).width;
    expect(a).toBe(b);
  });

  it('codepoints >= 0xFFFF measure at raw width 16, NOT 16 tenths (jar-verified getCharWidth fallback quirk)', () => {
    // U+10000 (astral) — one codepoint, not two chars. Upstream's
    // getCharWidth fallback returns the raw literal 16 (not 16/10 like the
    // normal UnicodeBlock.getWidth path) — jar-verified via
    // -DPLANTUML_DETERMINISTIC_TEXT=true: U+1F600 at size 14 measures
    // textLength=14 (== 16 * 14/16), not 1.4 (== 1.6 * 14/16).
    expect(m.measure('\u{10000}', font).width).toBeCloseTo(16, 6);
  });

  it('a codepoint in a block beyond the table falls back to raw width 13, NOT 13 tenths (jar-verified)', () => {
    // block index (cp>>8)&0xFF == 255 (>= 255-block table) — raw 13, not
    // 13/10. Jar-verified: U+FF21 at size 14 measures textLength=11.375
    // (== 13 * 14/16), not 1.1375 (== 1.3 * 14/16).
    expect(m.measure('！', font).width).toBeCloseTo(13, 6);
  });
});
