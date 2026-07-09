import { describe, it, expect } from 'vitest';
import {
  parseColor,
  paintToSvg,
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
});

describe('paintToSvg', () => {
  it('returns a plain fill with no def for a string (AC3)', () => {
    const out = paintToSvg('#FFFFFF');
    expect(out).toEqual({ fill: '#FFFFFF' });
    expect('def' in out).toBe(false);
  });

  it('emits a url fill and a linearGradient def for a gradient (AC2)', () => {
    const g: Gradient = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' };
    const out = paintToSvg(g);
    expect(out.fill).toMatch(/^url\(#g[0-9a-z]+\)$/);
    expect(out.def).toContain('x1="0%" y1="100%" x2="100%" y2="0%"');
    expect(out.def).toContain('<stop offset="0%" stop-color="#c3d8f4"/>');
    expect(out.def).toContain('<stop offset="100%" stop-color="#6192d1"/>');
    // Fill id must reference the def id.
    const id = out.fill.slice('url(#'.length, -1);
    expect(out.def).toContain(`id="${id}"`);
  });

  it('is deterministic: identical gradients produce the identical id (AC4)', () => {
    const g: Gradient = { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' };
    const a = paintToSvg(g);
    const b = paintToSvg({ ...g });
    expect(a.fill).toBe(b.fill);
    expect(a.def).toBe(b.def);
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
    const g: Gradient = { color1: 'a&b<c', color2: 'd">e', policy: '/' };
    const out = paintToSvg(g);
    expect(out.def).toContain('stop-color="a&amp;b&lt;c"');
    expect(out.def).toContain('stop-color="d&quot;&gt;e"');
  });
});
