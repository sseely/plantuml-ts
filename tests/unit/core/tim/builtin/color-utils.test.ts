/**
 * Direct tests of `color-utils.ts`'s exported pure functions -- the seven
 * color builtin classes (`color-functions.test.ts`) only exercise a few
 * representative colors each; this file drives the hex-parsing,
 * `rgbToHsl`/`hslToRgb`, and HSLuv branch space more thoroughly.
 */
import { describe, expect, it } from 'vitest';
import {
  colorToString,
  darken,
  grayScale,
  hslToRgb,
  isDark,
  lighten,
  parseColorString,
  requireColor,
  reverseHsluv,
  reverseRgb,
  rgbToHsl,
  NoSuchColorError,
} from '../../../../../src/core/tim/builtin/color-utils.js';

describe('parseColorString', () => {
  it('parses each valid hex length (1/3/6/8 digits), with or without "#"', () => {
    expect(parseColorString('#F')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseColorString('#ABC')).toEqual({ r: 170, g: 187, b: 204, a: 255 });
    expect(parseColorString('FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(parseColorString('#00FF0080')).toEqual({ r: 0, g: 255, b: 0, a: 128 });
  });

  it('rejects malformed hex of each length', () => {
    expect(parseColorString('#G')).toBeUndefined();
    expect(parseColorString('#GGG')).toBeUndefined();
    expect(parseColorString('#GGGGGG')).toBeUndefined();
    expect(parseColorString('#GGGGGGGG')).toBeUndefined();
  });

  it('resolves a named color case-insensitively', () => {
    expect(parseColorString('RED')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(parseColorString('red')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('is undefined for an unresolvable string', () => {
    expect(parseColorString('notacolor')).toBeUndefined();
  });

  it('resolves the full ~150-name ColorTrieNode table, not a compact subset (G1c)', () => {
    // Pre-G1c this file carried its own ~40-name disclosed-divergence
    // table; `aliceblue`/`gold`/the Archimate names were unresolvable.
    expect(parseColorString('aliceblue')).toEqual({ r: 0xf0, g: 0xf8, b: 0xff, a: 255 });
    expect(parseColorString('gold')).toEqual({ r: 0xff, g: 0xd7, b: 0x00, a: 255 });
    expect(parseColorString('business')).toEqual({ r: 0xff, g: 0xff, b: 0xcc, a: 255 });
  });
});

describe('requireColor', () => {
  it('throws NoSuchColorError for an unresolvable string', () => {
    expect(() => requireColor('notacolor')).toThrow(NoSuchColorError);
  });
});

describe('colorToString', () => {
  it('formats an opaque color as uppercase #RRGGBB', () => {
    expect(colorToString({ r: 1, g: 2, b: 3, a: 255 })).toBe('#010203');
  });
  it('formats a transparent color as lowercase #AARRGGBB', () => {
    expect(colorToString({ r: 1, g: 2, b: 3, a: 128 })).toBe('#80010203');
  });
});

describe('rgbToHsl', () => {
  it('an achromatic gray has hue 0 and saturation 0', () => {
    const [h, s] = rgbToHsl({ r: 128, g: 128, b: 128, a: 255 });
    expect(h).toBe(0);
    expect(s).toBe(0);
  });
  it('max===g yields a hue in the green sector', () => {
    const [h] = rgbToHsl({ r: 0, g: 255, b: 0, a: 255 });
    expect(h).toBe(120);
  });
  it('max===b yields a hue in the blue sector', () => {
    const [h] = rgbToHsl({ r: 0, g: 0, b: 255, a: 255 });
    expect(h).toBe(240);
  });
  it('uses the low-luminance saturation formula when l <= 0.5', () => {
    const [, s, l] = rgbToHsl({ r: 0x80, g: 0x40, b: 0x20, a: 255 });
    expect(l).toBeLessThanOrEqual(50);
    expect(s).toBeCloseTo(60, 0);
  });
  it('uses the high-luminance saturation formula when l > 0.5', () => {
    const [, s, l] = rgbToHsl({ r: 0xff, g: 0xcc, b: 0xcc, a: 255 });
    expect(l).toBeGreaterThan(50);
    expect(s).toBe(100);
  });
});

describe('hslToRgb', () => {
  it('clamps out-of-range saturation/luminance', () => {
    expect(colorToString(hslToRgb([0, -10, -10]))).toBe('#000000');
    expect(colorToString(hslToRgb([0, 200, 200]))).toBe('#FFFFFF');
  });
  it('wraps a negative or >360 hue', () => {
    expect(colorToString(hslToRgb([-30, 100, 50]))).toBe('#FF0080');
  });
  it('produces magenta at h=300', () => {
    expect(colorToString(hslToRgb([300, 100, 50]))).toBe('#FF00FF');
  });
});

describe('darken / lighten', () => {
  it('are no-ops on black (zero luminance has nothing to scale)', () => {
    const black = { r: 0, g: 0, b: 0, a: 255 };
    expect(colorToString(darken(black, 50))).toBe('#000000');
    expect(colorToString(lighten(black, 50))).toBe('#000000');
  });
});

describe('grayScale / isDark', () => {
  it('white is grayscale 255, black is 0', () => {
    expect(grayScale({ r: 255, g: 255, b: 255, a: 255 })).toBe(255);
    expect(grayScale({ r: 0, g: 0, b: 0, a: 255 })).toBe(0);
  });
  it('the isDark boundary is grayscale 128 (128 is light, 127 is dark)', () => {
    expect(isDark({ r: 127, g: 127, b: 127, a: 255 })).toBe(true);
    expect(isDark({ r: 128, g: 128, b: 128, a: 255 })).toBe(false);
  });
});

describe('reverseRgb', () => {
  it('complements every channel, preserves alpha', () => {
    expect(reverseRgb({ r: 0x12, g: 0x34, b: 0x56, a: 200 })).toEqual({ r: 0xed, g: 0xcb, b: 0xa9, a: 200 });
  });
});

describe('reverseHsluv', () => {
  it('matches the ported algorithm at the lightness extremes and mid-gray (golden values)', () => {
    expect(colorToString(reverseHsluv({ r: 0, g: 0, b: 0, a: 255 }))).toBe('#777777');
    expect(colorToString(reverseHsluv({ r: 255, g: 255, b: 255, a: 255 }))).toBe('#767676');
    expect(colorToString(reverseHsluv({ r: 128, g: 128, b: 128, a: 255 }))).toBe('#262626');
  });
  it('matches the ported algorithm for a saturated hue (golden value)', () => {
    expect(colorToString(reverseHsluv({ r: 0, g: 255, b: 0, a: 255 }))).toBe('#007000');
  });
});
