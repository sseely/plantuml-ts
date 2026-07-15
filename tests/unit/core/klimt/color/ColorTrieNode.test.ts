import { describe, expect, it } from 'vitest';
import { getColor, NAMES } from '../../../../../src/core/klimt/color/ColorTrieNode.js';

describe('ColorTrieNode', () => {
  it('registers exactly 154 names (147 CSS/SVG + 7 Archimate)', () => {
    expect(NAMES.length).toBe(154);
  });

  it('resolves standard CSS/SVG named colors to their exact upstream hex (jar-verified)', () => {
    // component/bisedo-29-kone620: fill="#F0F8FF" for `#aliceblue`.
    expect(getColor('aliceblue')).toEqual({ r: 0xf0, g: 0xf8, b: 0xff });
    // component/bisedo-29-kone620, raxata-43-buni314: fill="#0000FF" for `blue`.
    expect(getColor('blue')).toEqual({ r: 0x00, g: 0x00, b: 0xff });
    // component/raxata-43-buni314: stop-color="#FFFF00" for `yellow`.
    expect(getColor('yellow')).toEqual({ r: 0xff, g: 0xff, b: 0x00 });
    // component/raxata-43-buni314: stop-color="#FF0000" for `red`.
    expect(getColor('red')).toEqual({ r: 0xff, g: 0x00, b: 0x00 });
    // component/cukafa-49-fona812: stroke:#FFA500 for `orange`.
    expect(getColor('orange')).toEqual({ r: 0xff, g: 0xa5, b: 0x00 });
    // component/cukafa-49-fona812: fill="#FFD700" for `gold`.
    expect(getColor('gold')).toEqual({ r: 0xff, g: 0xd7, b: 0x00 });
    // component/bokumi-45-pupo531: fill="#808080" for `grey` (British spelling alias).
    expect(getColor('grey')).toEqual({ r: 0x80, g: 0x80, b: 0x80 });
    // component/betidu-24-xuku720: fill="#00FFFF" for `Aqua`.
    expect(getColor('Aqua')).toEqual({ r: 0x00, g: 0xff, b: 0xff });
  });

  it('is case-insensitive', () => {
    expect(getColor('ALICEBLUE')).toEqual(getColor('AliceBlue'));
    expect(getColor('aLiCeBlUe')).toEqual(getColor('AliceBlue'));
  });

  it('resolves the 7 non-CSS Archimate names (no CSS/X11 equivalent)', () => {
    expect(getColor('business')).toEqual({ r: 0xff, g: 0xff, b: 0xcc });
    expect(getColor('application')).toEqual({ r: 0xc2, g: 0xf0, b: 0xff });
    expect(getColor('motivation')).toEqual({ r: 0xcc, g: 0xcc, b: 0xff });
    expect(getColor('strategy')).toEqual({ r: 0xf8, g: 0xe7, b: 0xc0 });
    expect(getColor('technology')).toEqual({ r: 0xc9, g: 0xff, b: 0xc9 });
    expect(getColor('physical')).toEqual({ r: 0x97, g: 0xff, b: 0x97 });
    expect(getColor('implementation')).toEqual({ r: 0xff, g: 0xe0, b: 0xe0 });
  });

  it('returns undefined for an unregistered name', () => {
    expect(getColor('notacolor')).toBeUndefined();
  });

  it('returns undefined for a name containing a non-letter character', () => {
    // Upstream's trie only descends on ASCII letters -- any other char
    // returns null immediately, matching a plain hex digit sequence too.
    expect(getColor('red1')).toBeUndefined();
    expect(getColor('123456')).toBeUndefined();
    expect(getColor('#red')).toBeUndefined();
  });

  it('returns undefined for the empty string', () => {
    expect(getColor('')).toBeUndefined();
  });

  it('two distinct names may alias the same RGB triple (aqua/cyan, fuchsia/magenta)', () => {
    expect(getColor('aqua')).toEqual(getColor('cyan'));
    expect(getColor('fuchsia')).toEqual(getColor('magenta'));
  });
});
