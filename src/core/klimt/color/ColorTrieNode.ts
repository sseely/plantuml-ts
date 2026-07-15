/**
 * ColorTrieNode — the named-color -> RGB table upstream registers into a
 * letter-indexed trie.
 *
 * Upstream: klimt/color/ColorTrieNode.java (`register(name, XColor)` calls
 * in a static initializer, 154 entries: 147 standard CSS/SVG/HTML named
 * colors PLUS 7 non-CSS Archimate-only names — `BUSINESS`, `APPLICATION`,
 * `MOTIVATION`, `STRATEGY`, `TECHNOLOGY`, `PHYSICAL`, `IMPLEMENTATION` --
 * ported here VERBATIM (every name, every hex value, exact upstream order)
 * per this port's don't-refactor-while-porting discipline (project
 * CLAUDE.md). Every value below was cross-checked against the Java source
 * line-for-line; none differ from the CSS3/X11 named-color list except the
 * 7 Archimate entries, which have no CSS equivalent at all.
 *
 * Upstream's trie only descends on ASCII letters --
 * `child(char k, ...)`: `idx = ((k | 0x20) - 'a')`, returning `null`
 * immediately when `idx` falls outside `[0, 25]` -- so a name containing
 * any non-letter character can never match a registered entry. A
 * lowercase-keyed `Map` produces an IDENTICAL observable result for every
 * registered name (none contain non-letter characters) while being a much
 * simpler TypeScript translation than re-implementing the 26-way trie
 * structure; the trie itself is upstream's own performance choice, not
 * behavior this port needs to reproduce bit-for-bit (see `getColor`'s own
 * doc comment).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/color/ColorTrieNode.java
 */

/** Stand-in for `net.sourceforge.plantuml.klimt.awt.XColor`'s 3 opaque channels. */
export interface RgbTriple {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const REGISTRY = new Map<string, RgbTriple>();
const ORIGINAL_NAMES: string[] = [];

function register(name: string, rgb: number): void {
  ORIGINAL_NAMES.push(name);
  REGISTRY.set(name.toLowerCase(), {
    r: (rgb >> 16) & 0xff,
    g: (rgb >> 8) & 0xff,
    b: rgb & 0xff,
  });
}

// Taken from http://perl.wikipedia.com/wiki/Named_colors ?
// http://www.w3schools.com/HTML/html_colornames.asp
// (upstream's own citation comment, ColorTrieNode.java:53-54)
register('AliceBlue', 0xf0f8ff);
register('AntiqueWhite', 0xfaebd7);
register('Aqua', 0x00ffff);
register('Aquamarine', 0x7fffd4);
register('Azure', 0xf0ffff);
register('Beige', 0xf5f5dc);
register('Bisque', 0xffe4c4);
register('Black', 0x000000);
register('BlanchedAlmond', 0xffebcd);
register('Blue', 0x0000ff);
register('BlueViolet', 0x8a2be2);
register('Brown', 0xa52a2a);
register('BurlyWood', 0xdeb887);
register('CadetBlue', 0x5f9ea0);
register('Chartreuse', 0x7fff00);
register('Chocolate', 0xd2691e);
register('Coral', 0xff7f50);
register('CornflowerBlue', 0x6495ed);
register('Cornsilk', 0xfff8dc);
register('Crimson', 0xdc143c);
register('Cyan', 0x00ffff);
register('DarkBlue', 0x00008b);
register('DarkCyan', 0x008b8b);
register('DarkGoldenRod', 0xb8860b);
register('DarkGray', 0xa9a9a9);
register('DarkGrey', 0xa9a9a9);
register('DarkGreen', 0x006400);
register('DarkKhaki', 0xbdb76b);
register('DarkMagenta', 0x8b008b);
register('DarkOliveGreen', 0x556b2f);
register('Darkorange', 0xff8c00);
register('DarkOrchid', 0x9932cc);
register('DarkRed', 0x8b0000);
register('DarkSalmon', 0xe9967a);
register('DarkSeaGreen', 0x8fbc8f);
register('DarkSlateBlue', 0x483d8b);
register('DarkSlateGray', 0x2f4f4f);
register('DarkSlateGrey', 0x2f4f4f);
register('DarkTurquoise', 0x00ced1);
register('DarkViolet', 0x9400d3);
register('DeepPink', 0xff1493);
register('DeepSkyBlue', 0x00bfff);
register('DimGray', 0x696969);
register('DimGrey', 0x696969);
register('DodgerBlue', 0x1e90ff);
register('FireBrick', 0xb22222);
register('FloralWhite', 0xfffaf0);
register('ForestGreen', 0x228b22);
register('Fuchsia', 0xff00ff);
register('Gainsboro', 0xdcdcdc);
register('GhostWhite', 0xf8f8ff);
register('Gold', 0xffd700);
register('GoldenRod', 0xdaa520);
register('Gray', 0x808080);
register('Grey', 0x808080);
register('Green', 0x008000);
register('GreenYellow', 0xadff2f);
register('HoneyDew', 0xf0fff0);
register('HotPink', 0xff69b4);
register('IndianRed', 0xcd5c5c);
register('Indigo', 0x4b0082);
register('Ivory', 0xfffff0);
register('Khaki', 0xf0e68c);
register('Lavender', 0xe6e6fa);
register('LavenderBlush', 0xfff0f5);
register('LawnGreen', 0x7cfc00);
register('LemonChiffon', 0xfffacd);
register('LightBlue', 0xadd8e6);
register('LightCoral', 0xf08080);
register('LightCyan', 0xe0ffff);
register('LightGoldenRodYellow', 0xfafad2);
register('LightGray', 0xd3d3d3);
register('LightGrey', 0xd3d3d3);
register('LightGreen', 0x90ee90);
register('LightPink', 0xffb6c1);
register('LightSalmon', 0xffa07a);
register('LightSeaGreen', 0x20b2aa);
register('LightSkyBlue', 0x87cefa);
register('LightSlateGray', 0x778899);
register('LightSlateGrey', 0x778899);
register('LightSteelBlue', 0xb0c4de);
register('LightYellow', 0xffffe0);
register('Lime', 0x00ff00);
register('LimeGreen', 0x32cd32);
register('Linen', 0xfaf0e6);
register('Magenta', 0xff00ff);
register('Maroon', 0x800000);
register('MediumAquaMarine', 0x66cdaa);
register('MediumBlue', 0x0000cd);
register('MediumOrchid', 0xba55d3);
register('MediumPurple', 0x9370d8);
register('MediumSeaGreen', 0x3cb371);
register('MediumSlateBlue', 0x7b68ee);
register('MediumSpringGreen', 0x00fa9a);
register('MediumTurquoise', 0x48d1cc);
register('MediumVioletRed', 0xc71585);
register('MidnightBlue', 0x191970);
register('MintCream', 0xf5fffa);
register('MistyRose', 0xffe4e1);
register('Moccasin', 0xffe4b5);
register('NavajoWhite', 0xffdead);
register('Navy', 0x000080);
register('OldLace', 0xfdf5e6);
register('Olive', 0x808000);
register('OliveDrab', 0x6b8e23);
register('Orange', 0xffa500);
register('OrangeRed', 0xff4500);
register('Orchid', 0xda70d6);
register('PaleGoldenRod', 0xeee8aa);
register('PaleGreen', 0x98fb98);
register('PaleTurquoise', 0xafeeee);
register('PaleVioletRed', 0xd87093);
register('PapayaWhip', 0xffefd5);
register('PeachPuff', 0xffdab9);
register('Peru', 0xcd853f);
register('Pink', 0xffc0cb);
register('Plum', 0xdda0dd);
register('PowderBlue', 0xb0e0e6);
register('Purple', 0x800080);
register('Red', 0xff0000);
register('RosyBrown', 0xbc8f8f);
register('RoyalBlue', 0x4169e1);
register('SaddleBrown', 0x8b4513);
register('Salmon', 0xfa8072);
register('SandyBrown', 0xf4a460);
register('SeaGreen', 0x2e8b57);
register('SeaShell', 0xfff5ee);
register('Sienna', 0xa0522d);
register('Silver', 0xc0c0c0);
register('SkyBlue', 0x87ceeb);
register('SlateBlue', 0x6a5acd);
register('SlateGray', 0x708090);
register('SlateGrey', 0x708090);
register('Snow', 0xfffafa);
register('SpringGreen', 0x00ff7f);
register('SteelBlue', 0x4682b4);
register('Tan', 0xd2b48c);
register('Teal', 0x008080);
register('Thistle', 0xd8bfd8);
register('Tomato', 0xff6347);
register('Turquoise', 0x40e0d0);
register('Violet', 0xee82ee);
register('Wheat', 0xf5deb3);
register('White', 0xffffff);
register('WhiteSmoke', 0xf5f5f5);
register('Yellow', 0xffff00);
register('YellowGreen', 0x9acd32);
// Archimate (non-CSS names -- no equivalent in the standard color-keyword
// list; upstream's own '// Archimate' section header, ColorTrieNode.java:202).
register('BUSINESS', 0xffffcc);
register('APPLICATION', 0xc2f0ff);
register('MOTIVATION', 0xccccff);
register('STRATEGY', 0xf8e7c0);
register('TECHNOLOGY', 0xc9ffc9);
register('PHYSICAL', 0x97ff97);
register('IMPLEMENTATION', 0xffe0e0);

/**
 * `ColorTrieNode.INSTANCE.getColor(name)`: case-insensitive named-color
 * lookup. Returns `undefined` (upstream: `null`) for any name not in the
 * table, INCLUDING any name containing a non-letter character (matching
 * the trie's own `idx < 0 || idx >= 26` early-`null` per the module doc
 * comment above) and the empty string.
 */
export function getColor(name: string): RgbTriple | undefined {
  if (name.length === 0 || !/^[A-Za-z]+$/.test(name)) return undefined;
  return REGISTRY.get(name.toLowerCase());
}

/** `ColorTrieNode.NAMES`: every registered name, upstream's own casing,
 * registration order (upstream: a `TreeSet`, alphabetical -- this port
 * has no consumer that depends on sort order, so registration order is
 * kept instead of adding a sort with nothing to verify it against). */
export const NAMES: readonly string[] = Object.freeze(ORIGINAL_NAMES.slice());
