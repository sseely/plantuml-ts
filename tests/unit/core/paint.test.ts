import { describe, it, expect } from 'vitest';
import {
  parseColor,
  paintToSvg,
  isTransparentColor,
  type Gradient,
  type Paint,
} from '../../../src/core/paint.js';

describe('parseColor', () => {
  it('parses a hex gradient with a backslash policy (AC1)', () => {
    expect(parseColor('#c3d8f4\\#6192d1')).toEqual({
      color1: '#c3d8f4',
      color2: '#6192d1',
      policy: '\\',
    });
  });

  it('returns a bare hex color unchanged (AC3)', () => {
    expect(parseColor('#FFFFFF')).toBe('#FFFFFF');
  });

  it('splits on each separator character', () => {
    expect(parseColor('#111111-#222222')).toEqual({
      color1: '#111111',
      color2: '#222222',
      policy: '-',
    });
    expect(parseColor('#111111|#222222')).toEqual({
      color1: '#111111',
      color2: '#222222',
      policy: '|',
    });
    expect(parseColor('#111111/#222222')).toEqual({
      color1: '#111111',
      color2: '#222222',
      policy: '/',
    });
  });

  it('splits a named-color gradient', () => {
    expect(parseColor('red-blue')).toEqual({
      color1: 'red',
      color2: 'blue',
      policy: '-',
    });
  });

  it('splits a named-color gradient whose FIRST color carries a leading # (G1 I5h)', () => {
    // component/balomu-94-kegi822, titona-45-jile471: `#red|green` -- the
    // description-diagram inline color-override grammar always prefixes the
    // whole compound token with one `#`, even when the first color is a
    // NAMED color, not hex. Upstream's `HColorSet#parseSimpleColor` strips
    // a leading `#` unconditionally, per segment, before trying hex-then-
    // name (java:122-124) -- so `#red` resolves to the named color "red",
    // not a failed hex parse.
    expect(parseColor('#red|green')).toEqual({
      color1: '#red',
      color2: 'green',
      policy: '|',
    });
  });

  it('splits a hex/named gradient with the leading # on the first segment only (G1 I5h)', () => {
    // component/raxata-43-buni314: `#yellow\\FFFFFF` -- named-then-hex, both
    // reachable through the same per-segment #-strip as the reverse order.
    expect(parseColor('#yellow\\FFFFFF')).toEqual({
      color1: '#yellow',
      color2: 'FFFFFF',
      policy: '\\',
    });
  });

  it('accepts 1-, 3-, 6-, and 8-digit hex halves', () => {
    expect(parseColor('#f-#0a0a0a0a')).toEqual({
      color1: '#f',
      color2: '#0a0a0a0a',
      policy: '-',
    });
    expect(parseColor('#abc|fff')).toEqual({
      color1: '#abc',
      color2: 'fff',
      policy: '|',
    });
  });

  it('returns the value unchanged when a half is not a valid color', () => {
    // The `-` separates `#12` (2 hex digits — invalid length) from `#333333`,
    // so no valid split exists and the whole string is a plain paint.
    expect(parseColor('#12-#333333')).toBe('#12-#333333');
  });

  it('returns the value unchanged when the left half is empty', () => {
    expect(parseColor('-#333333')).toBe('-#333333');
  });

  it('does not split past the first separator', () => {
    // The first `-` (after invalid `#12`) is skipped by the scan; no later
    // separator can yield a valid left half (a valid color cannot contain a
    // separator char), so the whole value stays a plain paint — matching
    // upstream, whose loop reaches no valid split either.
    expect(parseColor('#12-#345678|#9abcde')).toBe('#12-#345678|#9abcde');
  });

  it('returns an empty string unchanged', () => {
    expect(parseColor('')).toBe('');
  });

  it('does not treat an unregistered alphabetic word as a plain color (G1c)', () => {
    // Pre-G1c, `isPlainColor` accepted ANY alphabetic-shaped string as a
    // "color", so `banana-split` would have been mis-split into a bogus
    // gradient. Now that the real ~150-name table exists, neither half
    // resolves, matching upstream's `parseSimpleColor(s) != null` gate.
    expect(parseColor('banana-split')).toBe('banana-split');
  });
});

describe('paintToSvg', () => {
  it('returns a plain fill with no def for a string (AC3)', () => {
    const out = paintToSvg('#FFFFFF');
    expect(out).toEqual({ fill: '#FFFFFF' });
    expect('def' in out).toBe(false);
  });

  it('resolves a named color to its jar-verified canonical hex (G1c, I2)', () => {
    // component/bisedo-29-kone620: fill="#F0F8FF" for `#aliceblue`.
    expect(paintToSvg('aliceblue')).toEqual({ fill: '#F0F8FF' });
    // component/cukafa-49-fona812: fill="#FFD700" for `gold`.
    expect(paintToSvg('gold')).toEqual({ fill: '#FFD700' });
  });

  it('canonicalizes a bare (no leading #) hex fill to the jar’s #-prefixed uppercase form (G1 I10)', () => {
    expect(paintToSvg('0000ff')).toEqual({ fill: '#0000FF' });
  });

  it('leaves an unresolvable plain string unchanged (deferred-resolution design)', () => {
    expect(paintToSvg('url(#g0)')).toEqual({ fill: 'url(#g0)' });
  });

  it('emits a url fill and a linearGradient def for a gradient (AC2), stops canonicalized (G1c)', () => {
    const g: Gradient = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' };
    const out = paintToSvg(g);
    expect(out.fill).toMatch(/^url\(#g[0-9a-z]+\)$/);
    expect(out.def).toContain('x1="0%" y1="100%" x2="100%" y2="0%"');
    expect(out.def).toContain('<stop offset="0%" stop-color="#C3D8F4"/>');
    expect(out.def).toContain('<stop offset="100%" stop-color="#6192D1"/>');
    // Fill id must reference the def id.
    const id = out.fill.slice('url(#'.length, -1);
    expect(out.def).toContain(`id="${id}"`);
  });

  it('resolves named-color gradient stops to their jar hex (G1 I10 gradient-stop finding)', () => {
    // component/raxata-43-buni314: `#yellow\\FFFFFF` -- stop-color="#FFFF00".
    const out = paintToSvg({ color1: 'yellow', color2: '#FFFFFF', policy: '\\' });
    expect(out.def).toContain('stop-color="#FFFF00"');
    expect(out.def).toContain('stop-color="#FFFFFF"');
  });

  it('is deterministic: identical gradients produce the identical id (AC4)', () => {
    const g: Gradient = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' };
    const a = paintToSvg(g);
    const b = paintToSvg({ ...g });
    expect(a.fill).toBe(b.fill);
    expect(a.def).toBe(b.def);
  });

  it('a differently-spelled but equal-color gradient produces the SAME id (resolved-value hash, G1c)', () => {
    const a = paintToSvg({ color1: 'red', color2: '#00FF00', policy: '/' });
    const b = paintToSvg({ color1: '#FF0000', color2: '#00FF00', policy: '/' });
    expect(a.fill).toBe(b.fill);
  });

  it('distinct gradients produce distinct ids', () => {
    const a = paintToSvg({ color1: '#111', color2: '#222', policy: '/' });
    const b = paintToSvg({ color1: '#111', color2: '#333', policy: '/' });
    expect(a.fill).not.toBe(b.fill);
  });

  it('emits the correct vector per policy (AC5)', () => {
    const vec = (policy: Gradient['policy']): string => {
      const def = paintToSvg({ color1: '#111', color2: '#222', policy }).def!;
      return def.slice(def.indexOf('x1='), def.indexOf('>'));
    };
    expect(vec('-')).toBe('x1="50%" y1="0%" x2="50%" y2="100%"');
    expect(vec('|')).toBe('x1="0%" y1="50%" x2="100%" y2="50%"');
    expect(vec('/')).toBe('x1="0%" y1="0%" x2="100%" y2="100%"');
    expect(vec('\\')).toBe('x1="0%" y1="100%" x2="100%" y2="0%"');
  });

  it('falls through to the TL→BR vector for an unknown policy', () => {
    // Force an out-of-type policy to exercise the default branch.
    const g = { color1: '#111', color2: '#222', policy: 'x' } as unknown as Paint;
    expect(paintToSvg(g).def).toContain('x1="0%" y1="0%" x2="100%" y2="100%"');
  });

  it('escapes XML-significant characters in stop colors', () => {
    // Neither half resolves as a color, so both pass through unchanged
    // (deferred-resolution design) and still need XML escaping.
    const g: Gradient = { color1: 'a&b<c', color2: 'd">e', policy: '/' };
    const out = paintToSvg(g);
    expect(out.def).toContain('stop-color="a&amp;b&lt;c"');
    expect(out.def).toContain('stop-color="d&quot;&gt;e"');
  });
});

// G1 I5d -- transparent-color elision: `HColorSimple#isTransparent()` ==
// `color.getAlpha() == 0` (klimt/color/HColorSimple.java:132-135). Every
// jar drawing guard that elides an element for a transparent color keys off
// this exact condition, reached via the two literal shapes the corpus uses.
describe('isTransparentColor', () => {
  it('recognizes the named keyword "transparent"', () => {
    expect(isTransparentColor('transparent')).toBe(true);
  });

  it('is case-insensitive (skinparam values are not case-normalized)', () => {
    expect(isTransparentColor('Transparent')).toBe(true);
    expect(isTransparentColor('TRANSPARENT')).toBe(true);
  });

  it('recognizes the named keyword "background" (G1c, HColorSet.java:82-83)', () => {
    expect(isTransparentColor('background')).toBe(true);
    expect(isTransparentColor('BACKGROUND')).toBe(true);
  });

  it('recognizes an explicit 8-digit hex with a 00 alpha byte', () => {
    expect(isTransparentColor('#00000000')).toBe(true);
    expect(isTransparentColor('#FF000000')).toBe(true);
  });

  it('rejects an opaque or partially-transparent hex', () => {
    expect(isTransparentColor('#FFFFFF')).toBe(false);
    expect(isTransparentColor('#FFFFFFFF')).toBe(false);
    expect(isTransparentColor('#FF0000 01')).toBe(false);
  });

  it('rejects an ordinary named or hex color', () => {
    expect(isTransparentColor('red')).toBe(false);
    expect(isTransparentColor('#181818')).toBe(false);
    expect(isTransparentColor('none')).toBe(false);
  });
});
