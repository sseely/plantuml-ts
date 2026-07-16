/**
 * EntityImageClassHeader kind-badge geometry + glyph data (G2/N3).
 *
 * Upstream draws the header's "kind badge" as a `CircledCharacter`
 * (`klimt/shape/CircledCharacter.java`): a filled `<ellipse>` plus the
 * badge LETTER rendered as a real vector glyph outline (an AWT
 * `Font.createGlyphVector` -> `PathIterator` walk, baked into a fixed
 * `<path d="...">` at SVG-emission time) -- never `<text>`. This port
 * previously drew a `<circle r="10">` + `<text>` placeholder; this module
 * replaces both with upstream-faithful shapes.
 *
 * Geometry (`EntityImageClassHeader.java` ctor + `HeaderLayout.java#
 * getDimension`/`#drawU`, all jar-verified against 3+ cached fixtures --
 * `plans/g2-class-svg/ledger.md` N3):
 *   - `circledCharacter = TextBlockUtils.withMargin(getCircledCharacter(...),
 *     4, 0, 5, 5)` -- a `CircledCharacter` of radius
 *     `getCircledCharacterRadius()` (default 11, matches every sampled
 *     fixture's `rx="11" ry="11"`), wrapped with left margin 4, top/bottom
 *     margin 5 each (right margin 0).
 *   - `name = TextBlockUtils.withMargin(name, 3, 3, 0, 0)` -- the header
 *     name text, margin 3 each side (no visibility-modifier prefix case).
 *   - `HeaderLayout#getDimension`: `width = circleDim.width +
 *     max(stereoDim.width, nameDim.width)` (no stereotype here: stereoDim
 *     is 0); `height = max(circleDim.height, nameDim.height + 10)` (no
 *     stereotype/generic terms).
 *   - `HeaderLayout#drawU` with `suppWith == 0` (box width == exact content
 *     sum, the common case with no stereotype padding): badge drawn at
 *     local `(0, (height - circleDim.height) / 2)`; the CIRCLED CHARACTER
 *     itself (inside its own margined block) is inset by its own left/top
 *     margin (4, 5), so its absolute center relative to the classifier's
 *     own local origin is `(4 + radius, headerHeight/2 - circleDim.height/2
 *     + 5 + radius)` -- verified to reduce to `(15, headerHeight/2)` when
 *     `circleDim.height == headerHeight` (the common "badge is the taller
 *     term" case every sampled fixture hits): `cx = boxLocalX + 15`,
 *     `cy = boxLocalY + headerHeight/2`.
 */
import type { ClassifierKind } from './ast.js';

/** `SkinParam#getCircledCharacterRadius()` default. */
export const BADGE_RADIUS = 11;
/** `TextBlockUtils.withMargin(circledCharacter, 4, 0, 5, 5)` left margin.
 *  Exported (G2 N4): `class-layout-helpers.ts`'s header-indent formula needs
 *  this same left margin to place the badge box within the (possibly
 *  member-content-widened) header row -- see that file's `measureGeneric
 *  Classifier` doc comment. */
export const BADGE_LEFT_MARGIN = 4;
/** Same call's top/bottom margin (5 each, symmetric). */
const BADGE_TOP_BOTTOM_MARGIN = 5;
/** `TextBlockUtils.withMargin(name, 3, 3, 0, 0)` -- left+right margin, summed. */
export const NAME_MARGIN_TOTAL = 6;
/** Same call's LEFT margin alone (half of {@link NAME_MARGIN_TOTAL}) -- the
 *  header name text's own left inset from the end of the badge box, needed
 *  standalone (not just doubled into the width total) for the header text's
 *  X position (G2 N4). */
export const NAME_LEFT_MARGIN = 3;

/** `circleDim.width` (`HeaderLayout#getDimension`): diameter + left margin. */
export const BADGE_BOX_WIDTH = BADGE_RADIUS * 2 + BADGE_LEFT_MARGIN;
/** `circleDim.height`: diameter + top+bottom margin. */
export const BADGE_BOX_HEIGHT = BADGE_RADIUS * 2 + BADGE_TOP_BOTTOM_MARGIN * 2;
// G2 N4: the fixed `BADGE_CENTER_X_OFFSET = BADGE_LEFT_MARGIN + BADGE_RADIUS`
// constant this module used to export was removed -- `renderer.ts#renderBadge`
// now derives the badge's real x-position from the header row's own `indent`
// (which bakes in the header-centering term this fixed constant never
// accounted for), reducing to the SAME value in the common, header-dominated
// case. See that function's own doc comment.


// ---------------------------------------------------------------------------
// object/map/json never draw the kind badge -- upstream EntityImageObject,
// EntityImageMap, and EntityImageJson have no circled-character affordance
// at all (the header is just an optional stereotype line above the name).
// ---------------------------------------------------------------------------

export function hasBadge(kind: ClassifierKind): boolean {
  return kind !== 'object' && kind !== 'map' && kind !== 'json';
}

/**
 * `EntityImageClassHeader.java#getCircledCharacter`'s `spotStyleSignature`
 * -> `~/git/plantuml/src/main/resources/skin/plantuml.skin`'s `spot { ... }`
 * block, the default (light-theme) `BackGroundColor` for each
 * `spot<Kind>` style class -- jar-verified against 146+ `class`-badge
 * occurrences (`fill="#ADD1B2"`) across the corpus, none of which matched
 * this function's PREVIOUS constants (G2 N4). `object`/`map`/`json` never
 * reach this function ({@link hasBadge} gates them out first). `ClassifierKind`
 * has several OTHER badge-bearing members this iteration did not survey
 * against the jar (`entity`/`circle`/`descriptive`/`usecase`/`state`/
 * association-diamond kinds, `ast.ts`) -- the `default` case preserves
 * their PRE-EXISTING (unverified, possibly also wrong) fallback rather than
 * silently reassigning them `spotClass`'s color without jar evidence;
 * narrower scope than auditing the whole enum this iteration.
 */
export function badgeFill(kind: ClassifierKind): string {
  switch (kind) {
    case 'class':      return '#ADD1B2'; // spotClass
    case 'abstract':   return '#A9DCDF'; // spotAbstractClass
    case 'interface':  return '#B4A7E5'; // spotInterface
    case 'enum':       return '#EB937F'; // spotEnum
    case 'annotation': return '#E3664A'; // spotAnnotation
    default:           return '#ADD1B2'; // spotClass -- default/unsurveyed kinds
  }
}

/**
 * Glyph outline `d` data for each badge letter (C/I/A/E/@), captured
 * verbatim from the jar's own SVG output (`getCircledChar` ->
 * `CircledCharacter`'s AWT glyph-outline path) at the reference badge
 * center `(22, 23)` -- normalized from 3 independent single-classifier
 * fixtures (`josazo-53-bode013` for C/E/@/A in one shot, `tipude-10-tizi427`
 * for I), all `-DPLANTUML_DETERMINISTIC_TEXT=true`. Cross-verified: the SAME
 * letter's `d` at a DIFFERENT badge center is this exact string with every
 * coordinate translated by `(cx - 22, cy - 23)` -- confirmed on 144
 * additional `C`-badge occurrences across the corpus (`plans/g2-class-svg/
 * ledger.md` N3), so translating this fixed reference reproduces every
 * badge letter's glyph byte-for-byte regardless of the classifier's actual
 * position.
 */
const BADGE_GLYPH_D: Record<'C' | 'I' | 'A' | 'E' | '@', string> = {
  C:
    'M24.4731,29.1431 Q23.8921,29.4419 23.2529,29.5913 Q22.6138,29.7407 21.9082,29.7407 ' +
    'Q19.4014,29.7407 18.0815,28.0889 Q16.7617,26.437 16.7617,23.3159 Q16.7617,20.1865 18.0815,18.5347 ' +
    'Q19.4014,16.8828 21.9082,16.8828 Q22.6138,16.8828 23.2612,17.0322 Q23.9087,17.1816 24.4731,17.4805 ' +
    'L24.4731,20.2031 Q23.8423,19.6221 23.2488,19.3523 Q22.6553,19.0825 22.0244,19.0825 ' +
    'Q20.6797,19.0825 19.9949,20.1492 Q19.3101,21.2158 19.3101,23.3159 Q19.3101,25.4077 19.9949,26.4744 ' +
    'Q20.6797,27.541 22.0244,27.541 Q22.6553,27.541 23.2488,27.2712 Q23.8423,27.0015 24.4731,26.4204 Z',
  I:
    'M18.4277,19.2651 L18.4277,17.1069 L25.8071,17.1069 L25.8071,19.2651 L23.3418,19.2651 ' +
    'L23.3418,27.3418 L25.8071,27.3418 L25.8071,29.5 L18.4277,29.5 L18.4277,27.3418 L20.8931,27.3418 ' +
    'L20.8931,19.2651 Z',
  A:
    'M21.8633,18.3481 L20.7095,23.4199 L23.0254,23.4199 Z M20.3691,16.1069 L23.3657,16.1069 ' +
    'L26.7109,28.5 L24.2622,28.5 L23.4985,25.437 L20.2197,25.437 L19.4727,28.5 L17.0239,28.5 Z',
  E:
    'M25.6143,29.5 L17.8945,29.5 L17.8945,17.1069 L25.6143,17.1069 L25.6143,19.2651 L20.3433,19.2651 ' +
    'L20.3433,21.938 L25.1162,21.938 L25.1162,24.0962 L20.3433,24.0962 L20.3433,27.3418 L25.6143,27.3418 Z',
  '@':
    'M24.5767,23.2261 Q24.5767,22.2881 24.1533,21.7568 Q23.73,21.2256 22.9912,21.2256 ' +
    'Q22.2524,21.2256 21.8333,21.7568 Q21.4141,22.2881 21.4141,23.2261 Q21.4141,24.1724 21.8333,24.7036 ' +
    'Q22.2524,25.2349 22.9912,25.2349 Q23.73,25.2349 24.1533,24.7036 Q24.5767,24.1724 24.5767,23.2261 Z ' +
    'M26.1206,26.6294 L24.4937,26.6294 L24.4937,25.9487 Q24.1782,26.3887 23.7507,26.592 ' +
    'Q23.3232,26.7954 22.7256,26.7954 Q21.3643,26.7954 20.53,25.8159 Q19.6958,24.8364 19.6958,23.2261 ' +
    'Q19.6958,21.624 20.5259,20.6487 Q21.356,19.6733 22.7256,19.6733 Q23.3149,19.6733 23.7632,19.8767 ' +
    'Q24.2114,20.0801 24.4937,20.4702 L24.4937,20.1299 Q24.4937,19.001 23.8752,18.3867 ' +
    'Q23.2568,17.7725 22.1113,17.7725 Q20.3848,17.7725 19.2932,19.2915 Q18.2017,20.8105 18.2017,23.2427 ' +
    'Q18.2017,25.791 19.4634,27.2976 Q20.7251,28.8042 22.8252,28.8042 Q23.4893,28.8042 24.1118,28.6091 ' +
    'Q24.7344,28.4141 25.3071,28.0239 L26.0708,29.4849 Q25.3984,29.9414 24.6057,30.1697 ' +
    'Q23.813,30.3979 22.9082,30.3979 Q20.0029,30.3979 18.2764,28.4639 Q16.5498,26.5298 16.5498,23.2427 ' +
    'Q16.5498,20.0303 18.1021,18.1003 Q19.6543,16.1704 22.2109,16.1704 Q24.0205,16.1704 25.0706,17.262 ' +
    'Q26.1206,18.3535 26.1206,20.2378 Z',
};

/** `getCircledChar(LeafType)`: which glyph letter a classifier kind draws. */
export function badgeLetter(kind: ClassifierKind): 'C' | 'I' | 'A' | 'E' | '@' {
  switch (kind) {
    case 'interface':  return 'I';
    case 'abstract':   return 'A';
    case 'enum':       return 'E';
    case 'annotation': return '@';
    default:           return 'C';
  }
}

/** Reference badge center every {@link BADGE_GLYPH_D} entry is captured at. */
const REFERENCE_CX = 22;
const REFERENCE_CY = 23;

/** Numeric-token regex (lizard-safe: built from a string, matches the
 *  `svg.ts`/`paint.ts` convention for `<`/`>`-adjacent regex literals). */
const NUMBER_RE = new RegExp('-?\\d+(?:\\.\\d+)?', 'g');

/**
 * Translate {@link BADGE_GLYPH_D}'s reference-position path data to an
 * arbitrary badge center by shifting every numeric token by `(dx, dy)`
 * alternately (x, y, x, y, ...) -- every command in the captured letter set
 * (`M`/`L`/`Q`/`Z`) emits coordinate pairs in that order, verified against
 * all 5 letters above.
 */
export function badgeGlyphPath(kind: ClassifierKind, cx: number, cy: number): string {
  const letter = badgeLetter(kind);
  const dx = cx - REFERENCE_CX;
  const dy = cy - REFERENCE_CY;
  let axis = 0;
  return BADGE_GLYPH_D[letter].replace(NUMBER_RE, (tok) => {
    const shifted = Number(tok) + (axis === 0 ? dx : dy);
    axis = 1 - axis;
    return String(shifted);
  });
}
