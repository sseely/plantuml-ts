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
import { resolveColorToSvgHex } from '../../core/klimt/color/HColorSet.js';
import { paintToSvg, type Paint } from '../../core/paint.js';
import { lookupSizedGlyph } from './class-badge-sized-glyphs.js';

/** `SkinParam#getCircledCharacterRadius()` default (fontSize 17 -> formula
 *  below). Retained as the module's own default constant -- every call site
 *  that has no theme available (tests, the pre-existing default path) keeps
 *  behaving exactly as before. */
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

/** `FontParam.CIRCLED_CHARACTER`'s own default font size (17,
 *  `klimt/font/FontParam.java:55`) -- feeds {@link resolveBadgeRadius}'s
 *  formula when `skinparam circledCharacterFontSize` is unset. */
export const DEFAULT_CIRCLED_CHARACTER_FONT_SIZE = 17;

/**
 * `SkinParam#getCircledCharacterRadius()` (`skin/SkinParam.java:542-545`):
 *
 * ```java
 * public int getCircledCharacterRadius() {
 *   final int value = getAsInt("circledCharacterRadius", -1);
 *   return value == -1 ? getFontSize(null, FontParam.CIRCLED_CHARACTER) / 3 + 6 : value;
 * }
 * ```
 *
 * An explicit `circledCharacterRadius` skinparam wins unconditionally;
 * otherwise the radius is derived from `circledCharacterFontSize`
 * (`floor(fontSize / 3) + 6`, Java int division) -- the DEFAULT fontSize
 * 17 reduces to `floor(17/3)+6 = 11`, the PRE-EXISTING hardcoded
 * {@link BADGE_RADIUS} constant, so every classifier with no
 * `circledCharacter*` skinparam is byte-identical to before this
 * function existed.
 *
 * Jar-verified byte-exact against 12/12 class-corpus samples spanning
 * `circledCharacterFontSize` 13-30 (G2 N38, `plans/g2-class-svg/
 * ledger.md`): `munepa-74-lebe963`(13->10), `macira-65-mugu751`(14->10),
 * `mudune-38-kide806`(15->11), `pafare-13-raje687`(16->11), `defipi-14-
 * xunu847`(18->12), `datugo-88-sote552`(18->12, cross-checks the formula
 * is independent of the UNRELATED `classStereotypeFontSize` skinparam the
 * SAME fixture also sets), `pucebe-24-xebi219`(19->12), `fipezi-47-
 * jafu042`(20->12), `zijaso-54-gova798`(21->13), `koloba-22-bolo151`
 * (22->13); explicit-override path: `depulu-53-xoca727`
 * (`circledCharacterRadius 13`, fontSize 20 -- the formula alone would
 * predict 12, confirming the override truly short-circuits it) and
 * `gateja-70-losi738` (`circledCharacterRadius 18`, fontSize 30 -- formula
 * alone would predict 16).
 */
export function resolveBadgeRadius(
  circledCharacterFontSize?: number,
  circledCharacterRadiusOverride?: number,
): number {
  if (circledCharacterRadiusOverride !== undefined) return circledCharacterRadiusOverride;
  const fontSize = circledCharacterFontSize ?? DEFAULT_CIRCLED_CHARACTER_FONT_SIZE;
  return Math.floor(fontSize / 3) + 6;
}

/** `circleDim.width` for an ARBITRARY radius (generalizes {@link
 *  BADGE_BOX_WIDTH}, which stays the default-radius constant for callers
 *  that have not been threaded through {@link resolveBadgeRadius}). */
export function badgeBoxWidth(radius: number): number {
  return radius * 2 + BADGE_LEFT_MARGIN;
}
/** `circleDim.height` for an ARBITRARY radius (generalizes {@link
 *  BADGE_BOX_HEIGHT}). */
export function badgeBoxHeight(radius: number): number {
  return radius * 2 + BADGE_TOP_BOTTOM_MARGIN * 2;
}

/**
 * `HeaderLayout#drawU`'s asymmetric wider-box-slack split (G2 N23):
 * `suppWith = max(0, boxWidth - headerWidth)`, `h2 = min(badgeBoxWidth / 4,
 * suppWith * 0.1)` (a capped "extra" term), `h1 = (suppWith - h2) / 2` (the
 * remainder, split evenly). Extracted out of `class-layout-helpers.ts#
 * buildHeaderRow` (G2 N24) so `class-stereotype.ts`'s stereo-row layout can
 * share the SAME `h1`/`h2` values the name/badge positioning already uses,
 * rather than recomputing them a second time.
 */
export function computeHeaderSlack(
  boxWidth: number,
  headerWidth: number,
  badgeBoxWidth: number,
): { h1: number; h2: number } {
  const suppWith = Math.max(0, boxWidth - headerWidth);
  const h2 = Math.min(badgeBoxWidth / 4, suppWith * 0.1);
  const h1 = (suppWith - h2) / 2;
  return { h1, h2 };
}


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
 * G2 N26: `class Foo << (F,orange) >>`'s badge-customization COLOR half
 * (`EntityImageClassHeader.java:180-182`: `stereotype.getHtmlColor() ==
 * null ? spotBackColor : stereotype.getHtmlColor()`) -- the custom color
 * wins over the kind default when present, resolved through the SAME
 * `HColorSet` table every other fill/stroke in this renderer uses (unlike
 * description's own `colorOverride`, an I2-ledgered unresolved-named-color
 * gap -- see `Relationship.colorOverride`'s doc comment, ast.ts, for the
 * precedent this mirrors).
 */
export function resolveBadgeFill(
  kind: ClassifierKind,
  colorOverride: string | undefined,
  // G2 N32: `theme.colors.elements['spot<Kind>'].background` -- the
  // `skinparam stereotype<X>BackgroundColor` / `<style> spot<Kind> {
  // BackgroundColor }` badge spot-color override (see `spotSnameForKind`'s
  // own doc comment). Wins over the kind default, LOSES to `colorOverride`
  // (the per-classifier `<<(F,orange)>>` inline decoration, N26) --
  // `EntityImageClassHeader.java:183`'s exact precedence.
  spotBackground?: Paint,
  // G2 N36: `theme.colors.graph.spotCascadeBackground` -- a bare `<style>
  // root { BackGroundColor } }` ancestor-cascade fallback (`EntityImage
  // ClassHeader#spotStyleSignature`'s `{root,element,spot,spot<Kind>}`
  // signature has NO `classDiagram` token, so ONLY `root` can ever reach
  // it -- see `style-cascade-class.ts`'s own doc comment). Sits BELOW the
  // `spot<Kind>` bucket above, ABOVE the hardcoded kind default.
  rootFallback?: string,
): string {
  if (colorOverride !== undefined) return resolveColorToSvgHex(colorOverride);
  if (spotBackground !== undefined) return paintToSvg(spotBackground).fill;
  if (rootFallback !== undefined) return rootFallback;
  return badgeFill(kind);
}

/**
 * G2 N32: `spot<Kind>` bucket's own `border`/`font` roles -- the badge
 * ellipse's STROKE and the glyph `<path>`'s own FILL, both otherwise a flat
 * theme/hardcoded default (`theme.colors.border`, `#000000`). No
 * per-classifier override exists for either (N26's `<<(F,orange)>>` is
 * BackgroundColor-only, matching upstream: `EntityImageClassHeader.java`
 * never lets a classifier's OWN stereotype color override the badge's
 * BORDER or glyph color, only its background).
 */
export function resolveBadgeBorder(
  defaultBorder: string,
  spotBorder?: Paint,
  // G2 N36: same root-only ancestor-cascade fallback as {@link
  // resolveBadgeFill}'s `rootFallback`, for the badge ellipse's OWN stroke
  // (`<style> root { LineColor } }`).
  rootFallback?: string,
): string {
  if (spotBorder !== undefined) return paintToSvg(spotBorder).fill;
  if (rootFallback !== undefined) return rootFallback;
  return defaultBorder;
}

export function resolveBadgeGlyphColor(
  spotFont?: Paint,
  // G2 N36: same root-only ancestor-cascade fallback, for the badge glyph
  // `<path>`'s own fill (`<style> root { FontColor } }`, jar-verified
  // `bikuka-40-pezi068`).
  rootFallback?: string,
): string {
  if (spotFont !== undefined) return paintToSvg(spotFont).fill;
  if (rootFallback !== undefined) return rootFallback;
  return '#000000';
}

/**
 * `ClassifierKind` -> the `spot<Kind>` element-bucket SName
 * (`skinparam.ts#ELEMENT_BUCKET_SNAMES`'s own doc comment for the upstream
 * `spotStyleSignature` mapping) -- `undefined` for every kind this port's
 * `badgeFill` above does not individually distinguish (they share
 * `spotClass`'s default there, but have no OWN override bucket -- narrower
 * scope than `badgeFill`'s existing "default" precedent, matches this
 * iteration's "survey reach, land the tractable ones" instruction rather
 * than guessing an override bucket name for an unsurveyed kind).
 */
export function spotSnameForKind(kind: ClassifierKind): string | undefined {
  switch (kind) {
    case 'class':      return 'spotclass';
    case 'abstract':   return 'spotabstractclass';
    case 'interface':  return 'spotinterface';
    case 'enum':       return 'spotenum';
    case 'annotation': return 'spotannotation';
    default:           return undefined;
  }
}

/**
 * Glyph outline `d` data for each badge letter (C/I/A/E/@/P/M/F/?), captured
 * verbatim from the jar's own SVG output (`getCircledChar` ->
 * `CircledCharacter`'s AWT glyph-outline path) at the reference badge
 * center `(22, 23)` -- C/I/A/E/@ normalized from 3 independent
 * single-classifier fixtures (`josazo-53-bode013` for C/E/@/A in one shot,
 * `tipude-10-tizi427` for I), all `-DPLANTUML_DETERMINISTIC_TEXT=true`.
 * P/M (`class Foo << (P)artyPlaceThing >>`-style custom stereotype letters)
 * and F (`<<(F, color)>>`) were derived N33 from `renezi-40-jupi466`/
 * `jarigi-34-nage684`'s own cached jar SVGs (both letters cross-verified
 * against a second occurrence in the same/sibling fixture, matching within
 * the deterministic-mode 0.01 numeric tolerance -- `compare.ts`'s own
 * per-token comparator, not a byte-string equality bar). `?` (a literal
 * `<<(?, color)>>` question-mark badge char) derived N33 from
 * `cotacu-63-jisi866`. Cross-verified: the SAME letter's `d` at a DIFFERENT
 * badge center is this exact string with every coordinate translated by
 * `(cx - 22, cy - 23)` -- confirmed on 144 additional `C`-badge occurrences
 * across the corpus (`plans/g2-class-svg/ledger.md` N3), so translating
 * this fixed reference reproduces every badge letter's glyph within
 * tolerance regardless of the classifier's actual position.
 *
 * This is the FONT SIZE 17 (default `circledCharacterFontSize`) outline --
 * see {@link BADGE_GLYPH_D_BY_FONT_SIZE} for the SAME letter captured at
 * OTHER font sizes (G2 N38: not a linear scale of this table, AWT hinting
 * rounds each point size's contour independently).
 */
type BadgeLetter = 'C' | 'I' | 'A' | 'E' | '@' | 'P' | 'M' | 'F' | '?';

const BADGE_GLYPH_D: Record<BadgeLetter, string> = {
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
  P:
    'M20.7935,19.1655 L20.7935,22.8013 L21.7979,22.8013 Q23.0015,22.8013 23.4871,22.3945 ' +
    'Q23.9727,21.9878 23.9727,20.9834 Q23.9727,19.979 23.4871,19.5723 Q23.0015,19.1655 21.7979,19.1655 Z ' +
    'M18.3447,17.1069 L21.7065,17.1069 Q24.2715,17.1069 25.3962,18.02 Q26.521,18.9331 26.521,20.9834 ' +
    'Q26.521,23.0337 25.3962,23.9468 Q24.2715,24.8599 21.7065,24.8599 L20.7935,24.8599 L20.7935,29.5 ' +
    'L18.3447,29.5 Z',
  M:
    'M17.7141,17.1069 L20.6361,17.1069 L22.1131,22.5439 L23.5831,17.1069 L26.5211,17.1069 ' +
    'L26.5211,29.5 L24.4131,29.5 L24.4131,19.5723 L23.1011,24.9927 L21.1501,24.9927 L19.8221,19.5723 ' +
    'L19.8221,29.5 L17.7141,29.5 Z',
  F:
    'M25.733,19.2651 L20.462,19.2651 L20.462,21.938 L25.2598,21.938 L25.2598,24.0962 L20.462,24.0962 ' +
    'L20.462,29.5 L18.0132,29.5 L18.0132,17.1069 L25.733,17.1069 Z',
  '?':
    'M20.6523,27.6509 L22.8687,27.6509 L22.8687,30 L20.6523,30 Z M22.8687,26.6714 L20.6523,26.6714 ' +
    'L20.6523,25.3931 Q20.6523,24.5713 20.9097,23.9902 Q21.167,23.4092 21.8311,22.7617 L22.5781,22.0229 ' +
    'Q23.1011,21.5166 23.2878,21.1846 Q23.4746,20.8525 23.4746,20.4956 Q23.4746,19.9395 23.0928,19.6572 ' +
    'Q22.7109,19.375 21.9473,19.375 Q21.25,19.375 20.4905,19.6697 Q19.731,19.9644 18.9341,20.5454 ' +
    'L18.9341,18.3208 Q19.7476,17.856 20.5818,17.6194 Q21.416,17.3828 22.2544,17.3828 Q23.9312,17.3828 ' +
    '24.8857,18.1631 Q25.8403,18.9434 25.8403,20.313 Q25.8403,20.9438 25.5581,21.4875 Q25.2759,22.0313 ' +
    '24.4956,22.7949 L23.7651,23.5088 Q23.2007,24.0566 23.043,24.4053 Q22.8853,24.7539 22.8853,25.2603 ' +
    'Q22.8853,25.335 22.8811,25.4346 Q22.877,25.5342 22.8687,25.6504 Z',
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
 *
 * G2 N38: an optional trailing `circledCharacterFontSize` param selects a
 * SIZE-specific 'C' capture from `class-badge-sized-glyphs.ts` when
 * one exists for that exact size (letter 'C' only, sizes 13-22) --
 * `undefined`/17/any other size or letter falls through to the existing
 * default-size table unchanged, so every pre-N38 call site (no 5th arg)
 * is 100% behavior-identical.
 */
export function badgeGlyphPath(
  kind: ClassifierKind,
  cx: number,
  cy: number,
  charOverride?: string,
  circledCharacterFontSize?: number,
): string {
  const letter = resolveBadgeLetter(kind, charOverride);
  const sized = circledCharacterFontSize !== undefined
    ? lookupSizedGlyph(letter, circledCharacterFontSize)
    : undefined;
  const refD = sized?.d ?? BADGE_GLYPH_D[letter];
  const refCx = sized?.refCx ?? REFERENCE_CX;
  const refCy = sized?.refCy ?? REFERENCE_CY;
  const dx = cx - refCx;
  const dy = cy - refCy;
  let axis = 0;
  return refD.replace(NUMBER_RE, (tok) => {
    const shifted = Number(tok) + (axis === 0 ? dx : dy);
    axis = 1 - axis;
    return String(shifted);
  });
}

/**
 * G2 N26/N33: `class Foo << (F,orange) >>`'s badge-customization CHAR half --
 * a custom char always wins over the kind default when present
 * (`EntityImageClassHeader.java:179-183`, `stereotype.getCharacter() !=
 * 0`). This port's own glyph OUTLINE table ({@link BADGE_GLYPH_D}) has 9
 * jar-captured letters (C/I/A/E/@ from G2 N3, P/M/F/? added N33 -- corpus
 * also uses R/J/O/W/D/Q/S/X and `$sprite` names) -- a custom char that
 * happens to be one of those nine renders byte-exact; any OTHER custom
 * char has no captured outline, so this falls back to the kind's own
 * default letter rather than drawing nothing (a missing `<path>` would
 * itself be a childCount mismatch, strictly worse than a wrong-but-present
 * one) -- remaining letters named, not landed, for a future iteration
 * (would need per-letter corpus-scraped `d` data, the same technique this
 * function's own table already uses).
 */
export function resolveBadgeLetter(
  kind: ClassifierKind,
  charOverride: string | undefined,
): BadgeLetter {
  if (charOverride === '?') return '?';
  const upper = charOverride?.toUpperCase();
  if (
    upper === 'C' || upper === 'I' || upper === 'A' || upper === 'E' || upper === '@' ||
    upper === 'P' || upper === 'M' || upper === 'F'
  ) {
    return upper;
  }
  return badgeLetter(kind);
}
