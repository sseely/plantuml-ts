/**
 * Unit tests for class-magic-arrow.ts — G2 item 44 (magic-arrow edge-label
 * glyph): a relationship label ending in `" >"`/`" <"` (or the bare
 * `>`/`<`/`"< "`/`"> "` forms) strips the arrow character and draws a small
 * inline triangle glyph (`StringWithArrow.java`, `TextBlockArrow2`).
 */
import { describe, it, expect } from 'vitest';
import {
  ARROW_GLYPH_SIZE,
  parseMagicArrowLabel,
  magicArrowAngle,
  magicArrowGlyphPoints,
} from '../../../src/diagrams/class/class-magic-arrow.js';

describe('parseMagicArrowLabel (G2 item 44)', () => {
  it('returns undefined for a plain label with no arrow token', () => {
    expect(parseMagicArrowLabel('demo')).toBeUndefined();
  });

  it('a bare "<" strips to no text, direction backward', () => {
    expect(parseMagicArrowLabel('<')).toEqual({ text: undefined, direction: 'backward' });
  });

  it('a bare ">" strips to no text, direction forward', () => {
    expect(parseMagicArrowLabel('>')).toEqual({ text: undefined, direction: 'forward' });
  });

  it('"< to center" strips the leading "< " token, direction backward', () => {
    expect(parseMagicArrowLabel('< to center')).toEqual({ text: 'to center', direction: 'backward' });
  });

  it('"> to center" strips the leading "> " token, direction forward', () => {
    expect(parseMagicArrowLabel('> to center')).toEqual({ text: 'to center', direction: 'forward' });
  });

  it('"foo >" strips the trailing " >" token, direction forward', () => {
    expect(parseMagicArrowLabel('foo >')).toEqual({ text: 'foo', direction: 'forward' });
  });

  it('"foo <" strips the trailing " <" token, direction backward', () => {
    expect(parseMagicArrowLabel('foo <')).toEqual({ text: 'foo', direction: 'backward' });
  });

  it('a stereotype guillemet ("<<alias>>") is NOT a magic-arrow token', () => {
    expect(parseMagicArrowLabel('<<alias>>')).toBeUndefined();
  });

  it('an inner "<" with no leading/trailing space is not a magic-arrow token', () => {
    expect(parseMagicArrowLabel('a<b')).toBeUndefined();
  });
});

describe('magicArrowAngle (G2 item 44)', () => {
  // Jar-verified against `lojepe-37-liri985`'s straight horizontal edge
  // (start (48.73,31) -> end (105.67,31), atan2(dx,dy) = atan2(+,0) = PI/2).
  it('computes atan2(dx, dy) over the edge\'s own start/end points (forward)', () => {
    const points = [{ x: 48.73, y: 31 }, { x: 105.67, y: 31 }];
    expect(magicArrowAngle(points, 'forward')).toBeCloseTo(Math.PI / 2, 10);
  });

  it('adds PI for the backward direction', () => {
    const points = [{ x: 48.73, y: 31 }, { x: 105.67, y: 31 }];
    expect(magicArrowAngle(points, 'backward')).toBeCloseTo(Math.PI / 2 + Math.PI, 10);
  });

  it('uses only the first and last point of a multi-point spline', () => {
    const points = [{ x: 0, y: 0 }, { x: 999, y: 999 }, { x: 10, y: 0 }];
    expect(magicArrowAngle(points, 'forward')).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe('magicArrowGlyphPoints (G2 item 44)', () => {
  // Jar-verified byte-exact SHAPE against `lojepe-37-liri985`'s golden
  // `<polygon points="75.68,20.5,66.6349,17.5611,66.6349,23.4389,...">`:
  // relative deltas from the tip to each back corner are (-9.0451,-2.9389)
  // and (-9.0451,2.9389) -- reproduced here from the local (0,0)-origin box.
  it('produces the exact jar-verified triangle shape for a PI/2 (rightward) angle', () => {
    const [tip, a, b] = magicArrowGlyphPoints(0, 0, Math.PI / 2);
    expect(tip).toBeDefined();
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.x - tip!.x).toBeCloseTo(-9.0451, 3);
    expect(a!.y - tip!.y).toBeCloseTo(-2.9389, 3);
    expect(b!.x - tip!.x).toBeCloseTo(-9.0451, 3);
    expect(b!.y - tip!.y).toBeCloseTo(2.9389, 3);
  });

  it('the tip sits at (originX + ARROW_GLYPH_SIZE, originY + 6.5) for a PI/2 angle', () => {
    // cx = originX + half, tip.x = cx + half*sin(PI/2) = cx + half = originX + 2*half.
    const [tip] = magicArrowGlyphPoints(10, 20, Math.PI / 2);
    expect(tip!.x).toBeCloseTo(10 + ARROW_GLYPH_SIZE, 6);
    expect(tip!.y).toBeCloseTo(20 + 6.5, 6);
  });

  it('rotating by PI mirrors the tip to the opposite side', () => {
    const [tipRight] = magicArrowGlyphPoints(0, 0, Math.PI / 2);
    const [tipLeft] = magicArrowGlyphPoints(0, 0, Math.PI / 2 + Math.PI);
    // sin(angle+PI) = -sin(angle) -- the tip's x-offset flips sign.
    expect(tipLeft!.x - ARROW_GLYPH_SIZE / 2).toBeCloseTo(-(tipRight!.x - ARROW_GLYPH_SIZE / 2), 6);
  });
});
