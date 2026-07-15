import { describe, expect, it } from 'vitest';
import {
  parseSimpleColor,
  toSvgHex,
  resolveColorToSvgHex,
} from '../../../../../src/core/klimt/color/HColorSet.js';

describe('parseSimpleColor', () => {
  it('parses the 1/3/6/8-hex-digit forms, with or without a leading #', () => {
    expect(parseSimpleColor('#F')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseSimpleColor('F')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseSimpleColor('#ABC')).toEqual({ r: 170, g: 187, b: 204, a: 255 });
    expect(parseSimpleColor('FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(parseSimpleColor('#00FF0080')).toEqual({ r: 0, g: 255, b: 0, a: 128 });
  });

  it('resolves a named color case-insensitively, with or without a leading #', () => {
    expect(parseSimpleColor('aliceblue')).toEqual({ r: 0xf0, g: 0xf8, b: 0xff, a: 255 });
    expect(parseSimpleColor('#AliceBlue')).toEqual({ r: 0xf0, g: 0xf8, b: 0xff, a: 255 });
    expect(parseSimpleColor('RED')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it('falls through to named lookup when a 3/6-length token is NOT valid hex', () => {
    // "red" is 3 characters but not a valid hex triple ('r' is not a hex
    // nibble) -- upstream's if/else-if chain falls through to the named
    // trie rather than returning null (HColorSet.java:134-143,157).
    expect(parseSimpleColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    // "orange" is 6 characters, not valid hex ('o'/'r'/'n' aren't hex nibbles).
    expect(parseSimpleColor('orange')).toEqual({ r: 255, g: 165, b: 0, a: 255 });
  });

  it('returns undefined for invalid hex and unregistered names', () => {
    expect(parseSimpleColor('#G')).toBeUndefined();
    expect(parseSimpleColor('#GGG')).toBeUndefined();
    expect(parseSimpleColor('#GGGGGG')).toBeUndefined();
    expect(parseSimpleColor('#GGGGGGGG')).toBeUndefined();
    expect(parseSimpleColor('notacolor')).toBeUndefined();
  });

  it('returns undefined for an invalid-length token that is not a registered name', () => {
    expect(parseSimpleColor('#12')).toBeUndefined();
    expect(parseSimpleColor('a&b<c')).toBeUndefined();
  });
});

describe('toSvgHex', () => {
  it('formats a fully-opaque color as uppercase #RRGGBB', () => {
    expect(toSvgHex({ r: 0xf0, g: 0xf8, b: 0xff, a: 255 })).toBe('#F0F8FF');
  });

  it('formats a fully-transparent color as the canonical #00000000, regardless of RGB', () => {
    expect(toSvgHex({ r: 0xff, g: 0, b: 0, a: 0 })).toBe('#00000000');
    expect(toSvgHex({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
  });

  it('formats a partially-transparent color as uppercase #RRGGBBAA (alpha LAST)', () => {
    expect(toSvgHex({ r: 0x11, g: 0x22, b: 0x33, a: 0x80 })).toBe('#11223380');
  });
});

describe('resolveColorToSvgHex', () => {
  it('resolves a named color to its jar-verified canonical hex', () => {
    expect(resolveColorToSvgHex('aliceblue')).toBe('#F0F8FF');
    expect(resolveColorToSvgHex('blue')).toBe('#0000FF');
    expect(resolveColorToSvgHex('yellow')).toBe('#FFFF00');
    expect(resolveColorToSvgHex('gold')).toBe('#FFD700');
    expect(resolveColorToSvgHex('orange')).toBe('#FFA500');
    expect(resolveColorToSvgHex('grey')).toBe('#808080');
    expect(resolveColorToSvgHex('Aqua')).toBe('#00FFFF');
  });

  it('canonicalizes an already-hex value to uppercase, adding a leading # when absent', () => {
    // G1 I10: bare (no leading `#`) 6-hex-digit fills must still resolve to
    // the jar's `#`-prefixed uppercase form, not pass through verbatim.
    expect(resolveColorToSvgHex('0000ff')).toBe('#0000FF');
    expect(resolveColorToSvgHex('#c3d8f4')).toBe('#C3D8F4');
    expect(resolveColorToSvgHex('#FEFECE')).toBe('#FEFECE');
  });

  it('collapses "transparent"/"background" to the canonical #00000000, case-insensitively', () => {
    expect(resolveColorToSvgHex('transparent')).toBe('#00000000');
    expect(resolveColorToSvgHex('TRANSPARENT')).toBe('#00000000');
    expect(resolveColorToSvgHex('background')).toBe('#00000000');
  });

  it('leaves an unresolvable token unchanged (deferred-resolution design, no WHITE fallback)', () => {
    expect(resolveColorToSvgHex('url(#g0)')).toBe('url(#g0)');
    expect(resolveColorToSvgHex('none')).toBe('none');
    expect(resolveColorToSvgHex('a&b<c')).toBe('a&b<c');
  });
});
