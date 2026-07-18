/**
 * Tests for the OpenIconic `<&glyph>` inline-atom geometry engine
 * (src/core/openiconic-glyphs.ts) and its span recognizer
 * (src/core/creole-atoms-openicon.ts) / measurement wiring
 * (src/core/creole-atoms.ts#measureInlineAtom).
 *
 * G2 N41. Every `buildOpenIconicPathD` expectation below is copied VERBATIM
 * from a real jar-cached fixture's own `<path d>` output (`plans/g2-class-
 * svg/ledger.md` N41's byte-verification table) -- not synthesized.
 */
import { describe, it, expect } from 'vitest';
import {
  buildOpenIconicPathD,
  isKnownOpenIconicGlyph,
  openIconicDims,
  openIconicFactor,
  openIconicOriginY,
} from '../../src/core/openiconic-glyphs.js';
import { scanLineForAtoms, matchAtomAt, measureInlineAtom } from '../../src/core/creole-atoms.js';

describe('isKnownOpenIconicGlyph', () => {
  it('recognizes all 6 corpus-reach glyph names', () => {
    for (const name of ['x', 'key', 'ban', 'caret-right', 'link-intact', 'thumb-up']) {
      expect(isKnownOpenIconicGlyph(name)).toBe(true);
    }
  });

  it('rejects an unrecognized name', () => {
    expect(isKnownOpenIconicGlyph('pencil')).toBe(false);
    expect(isKnownOpenIconicGlyph('')).toBe(false);
  });
});

describe('openIconicFactor', () => {
  it('is scale * fontSize / 12 (AtomOpenIconic ctor)', () => {
    expect(openIconicFactor(1, 12)).toBe(1);
    expect(openIconicFactor(1, 24)).toBe(2);
    expect(openIconicFactor(2.25, 14)).toBeCloseTo(2.625, 10);
  });
});

describe('openIconicDims', () => {
  it('adds the flat 2px (1px each side) margin to width only', () => {
    expect(openIconicDims(1)).toEqual({ width: 10, height: 8 });
    expect(openIconicDims(2)).toEqual({ width: 18, height: 16 });
  });
});

describe('buildOpenIconicPathD -- byte-exact against jar-cached fixtures', () => {
  it('x glyph (bidusa-22-jutu505, factor=14/12=1.16667)', () => {
    const factor = openIconicFactor(1, 14);
    const y = openIconicOriginY(53.8889, 14, factor);
    const d = buildOpenIconicPathD('x', factor, 14, y);
    expect(d).toBe(
      'M15.645,44.1667 L14,45.8117 L14.84,46.6517 L16.9167,48.7633 L14.84,50.84 L14,51.645 L15.645,53.325 ' +
        'L16.485,52.485 L18.5967,50.3733 L20.6733,52.485 L21.4783,53.325 L23.1583,51.645 L22.3183,50.84 ' +
        'L20.2067,48.7633 L22.3183,46.6517 L23.1583,45.8117 L21.4783,44.1667 L20.6733,45.0067 L18.5967,47.0833 ' +
        'L16.485,45.0067 L15.645,44.1667',
    );
  });

  it('key glyph, two subpaths (gekope-01-ricu859, factor=1)', () => {
    const factor = openIconicFactor(1, 12);
    const y = openIconicOriginY(45.8889, 14, factor);
    const d = buildOpenIconicPathD('key', factor, 14, y);
    expect(d).toBe(
      'M19.5,38 C18.12,38 17,39.12 17,40.5 C17,40.66 17,40.82 17.03,40.97 L14,44 L14,46 L17,46 L17,44 L19,44 ' +
        'L19,43 L19.03,42.97 C19.18,43 19.34,43 19.5,43 C20.88,43 22,41.88 22,40.5 C22,39.12 20.88,38 19.5,38 ' +
        'M20,39 C20.55,39 21,39.45 21,40 C21,40.55 20.55,41 20,41 C19.45,41 19,40.55 19,40 C19,39.45 19.45,39 20,39',
    );
  });

  it('caret-right glyph, source transform="translate(2)" (gekope-01-ricu859, factor=1)', () => {
    const factor = openIconicFactor(1, 12);
    const y = openIconicOriginY(201.8889, 14, factor);
    const d = buildOpenIconicPathD('caret-right', factor, 14, y);
    expect(d).toBe('M16,194 L16,202 L20,198 L16,194');
  });

  it('ban glyph, three subpaths, S-command mirroring (rideze-59-lizu265, factor=2)', () => {
    const factor = openIconicFactor(1, 24);
    const y = openIconicOriginY(61.8889, 14, factor);
    const d = buildOpenIconicPathD('ban', factor, 28, y);
    expect(d).toBe(
      'M36,43 C31.6,43 28,46.6 28,51 C28,55.4 31.6,59 36,59 C40.4,59 44,55.4 44,51 C44,46.6 40.4,43 36,43 ' +
        'M36,45 C37.32,45 38.52,45.42 39.5,46.12 L31.12,54.5 C30.42,53.52 30,52.32 30,51 C30,47.68 32.68,45 36,45 ' +
        'M40.88,47.5 C41.58,48.48 42,49.68 42,51 C42,54.32 39.32,57 36,57 C34.68,57 33.48,56.58 32.5,55.88 L40.88,47.5',
    );
  });

  it('link-intact glyph, arc + null-mirror S fallback (gekope-01-ricu859, factor=1)', () => {
    const factor = openIconicFactor(1, 12);
    const y = openIconicOriginY(59.8889, 14, factor);
    const d = buildOpenIconicPathD('link-intact', factor, 14, y);
    expect(d).toBe(
      'M19.88,52.03 C19.7,52.04 19.52,52.06 19.35,52.12 C19.08,52.22 18.82,52.37 18.6,52.59 A0.5,0.5 0 1 0 ' +
        '19.29,53.28 C19.4,53.17 19.53,53.11 19.67,53.06 C20.02,52.94 20.45,52.99 20.73,53.28 C21.12,53.67 ' +
        '21.12,54.32 20.73,54.72 L19.23,56.22 C18.79,56.66 18.43,56.7 18.17,56.69 C17.91,56.68 17.76,56.56 ' +
        '17.76,56.56 A0.5,0.5 0 1 0 17.26,57.44 C17.6,57.66 17.6,57.66 18.1,57.69 C18.6,57.72 19.3,57.53 ' +
        '19.91,56.91 L21.41,55.41 C22.19,54.63 22.19,53.37 21.41,52.6 C21.13,52.32 20.8,52.15 20.44,52.07 ' +
        'C20.26,52.03 20.06,52.03 19.88,52.04 M17.88,54.34 C17.38,54.32 16.69,54.49 16.1,55.09 L14.6,56.59 ' +
        'C13.82,57.37 13.82,58.63 14.6,59.4 C15.16,59.96 15.96,60.12 16.66,59.87 C16.93,59.77 17.19,59.62 ' +
        '17.41,59.4 A0.5,0.5 0 1 0 16.72,58.71 C16.61,58.82 16.48,58.88 16.34,58.93 C15.99,59.05 15.56,59 ' +
        '15.28,58.71 C14.89,58.32 14.89,57.67 15.28,57.27 L16.78,55.77 C17.18,55.37 17.53,55.32 17.81,55.33 ' +
        'C18.09,55.34 18.28,55.42 18.28,55.42 A0.5,0.5 0 1 0 18.72,54.54 C18.38,54.34 18.38,54.34 17.88,54.32',
    );
  });

  it('thumb-up glyph, two subpaths (rideze-59-lizu265, factor=14/12)', () => {
    const factor = openIconicFactor(1, 14);
    const y = openIconicOriginY(61.8889, 14, factor);
    const d = buildOpenIconicPathD('thumb-up', factor, 118.3625, y);
    expect(d).toBe(
      'M123.5775,52.1667 C123.3558,52.19 123.1458,52.3417 123.0292,52.5633 C122.8775,52.8667 121.7575,55.1183 ' +
        '121.5358,55.34 C121.3142,55.5617 121.0225,55.6667 120.6958,55.6667 L120.6958,60.3333 L124.7792,60.3333 ' +
        'C125.0242,60.3333 125.2342,60.1817 125.3275,59.9717 C125.3275,59.9717 126.5292,56.5767 126.5292,56.25 ' +
        'C126.5292,55.9233 126.2725,55.6667 125.9458,55.6667 L124.1958,55.6667 C123.8692,55.6667 123.6125,55.375 ' +
        '123.6125,55.0833 C123.6125,54.7917 124.0675,53.24 124.1608,52.9367 C124.2542,52.6333 124.1025,52.3067 ' +
        '123.7992,52.2017 C123.7175,52.1783 123.6592,52.155 123.5775,52.1667 M118.3625,55.6667 L118.3625,60.3333 ' +
        'L119.5292,60.3333 L119.5292,55.6667 L118.3625,55.6667',
    );
  });

  it('returns undefined for an unrecognized glyph name', () => {
    expect(buildOpenIconicPathD('pencil', 1, 0, 0)).toBeUndefined();
  });
});

describe('scanLineForAtoms / matchAtomAt -- <&glyph> recognition', () => {
  it('recognizes a bare <&name> atom', () => {
    const scan = scanLineForAtoms('<&x> someField');
    expect(scan.atoms).toEqual([{ kind: 'openiconic', name: 'x', scale: 1 }]);
    expect(scan.textWithoutAtoms).toBe(' someField');
  });

  it('recognizes {scale=N,color=X} options', () => {
    const scan = scanLineForAtoms('<&x{scale=2.25,color=#FF0000}>');
    expect(scan.atoms).toEqual([{ kind: 'openiconic', name: 'x', scale: 2.25, forcedColor: '#FF0000' }]);
  });

  it('recognizes the *N scale shorthand', () => {
    const scan = scanLineForAtoms('<&x*2.25,color=green>');
    expect(scan.atoms).toEqual([{ kind: 'openiconic', name: 'x', scale: 2.25, forcedColor: 'green' }]);
  });

  it('recognizes the #RRGGBB forced-color prefix (wins over an in-block color=)', () => {
    const scan = scanLineForAtoms('<#00FF00&key{color=red}>');
    // `forcedColor` stores the prefix WITHOUT its leading '#' -- matches
    // `buildSpriteSpan`'s identical `forcedPrefix.slice(1)` convention;
    // `resolveColorToSvgHex` (class-member-creole.ts) accepts bare hex too.
    expect(scan.atoms).toEqual([{ kind: 'openiconic', name: 'key', scale: 1, forcedColor: '00FF00' }]);
  });

  it('an unrecognized glyph name contributes nothing (no atom, no fallback text)', () => {
    const scan = scanLineForAtoms('<&pencil> rest');
    expect(scan.atoms).toEqual([]);
    expect(scan.textWithoutAtoms).toBe(' rest');
  });

  it('matchAtomAt recognizes an openiconic atom at a fixed position', () => {
    const m = matchAtomAt('x<&thumb-up>y', 1);
    expect(m).not.toBeNull();
    expect(m?.atom).toEqual({ kind: 'openiconic', name: 'thumb-up', scale: 1 });
    expect(m?.length).toBe(11);
  });

  it('matchAtomAt returns null when no atom starts exactly at pos', () => {
    expect(matchAtomAt('x<&thumb-up>y', 0)).toBeNull();
  });

  it('scanLineForAtoms recognizes multiple glyph atoms on one line', () => {
    const scan = scanLineForAtoms('<&key> and <&ban>');
    expect(scan.atoms).toEqual([
      { kind: 'openiconic', name: 'key', scale: 1 },
      { kind: 'openiconic', name: 'ban', scale: 1 },
    ]);
  });
});

describe('measureInlineAtom -- openiconic branch (D9)', () => {
  it('scales dims by scale*ambientFontSize/12', () => {
    const dims = measureInlineAtom({ kind: 'openiconic', name: 'x', scale: 1 }, undefined, 24);
    expect(dims).toEqual({ width: 18, height: 16 });
  });

  it('defaults ambientFontSize to 12 (factor === scale) when no ambient context is supplied', () => {
    const dims = measureInlineAtom({ kind: 'openiconic', name: 'x', scale: 1 });
    expect(dims).toEqual({ width: 10, height: 8 });
  });
});
