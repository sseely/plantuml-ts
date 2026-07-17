/**
 * Classifier header stereotype row(s) — `HeaderLayout#getDimension`/`#drawU`'s
 * `stereoDim`/`xStereo`/`yStereo` terms (G2 N24; the mechanism N21/N22/N23
 * repeatedly named and deferred as an explicit DOT-gate/width-formula risk —
 * N23's own Mechanism 1 work on the SAME `HeaderLayout#drawU` derived the
 * `h1`/`h2` asymmetric-slack split this module reuses, and N23's Mechanism 2
 * fully derived the formula below without landing it).
 *
 * Split into its own module rather than added to class-layout-helpers.ts
 * (already at the repo's 500-line-per-file cap) — mirrors class-badge.ts's
 * own split precedent for a header sub-concern.
 *
 * Only the GENERIC name+members box (`class-layout-helpers.ts#
 * measureGenericClassifier`) uses this module. `object`/`map`/`json` leaves
 * have their own, separate, already-working single-stereotype header
 * (`class-object-map-sizing.ts#headerRows`/`measureStereo`) — untouched,
 * out of this task's scope (zero corpus fixture combines a stacked
 * stereotype with an object/map/json leaf).
 *
 * @see ~/git/plantuml/.../svek/HeaderLayout.java (getDimension/drawU)
 * @see ~/git/plantuml/.../svek/image/EntityImageClassHeader.java:124-132
 *   (stereo TextBlock construction: `withMargin(Display.create(labels)
 *   .create(FontConfiguration(skinParam, FontParam.CLASS_STEREOTYPE,
 *   stereotype)), 1, 0)`)
 * @see ~/git/plantuml/.../stereo/StereotypeDecoration.java:187-196
 *   (`cutLabels` — splits a stacked `<<A>><<B>>` blob back into individual
 *   labels)
 *
 * Jar-verified BYTE-EXACT (position AND size) on 2 independent samples:
 *   - `zejize-00-vivu578` — single stereotype `<<Test>>`.
 *   - `pajuba-83-roji161` — 3 STACKED inline stereotypes (`<<Singleton>>
 *     << Startup >>  << Stateless Session Bean >>`), confirming each label
 *     draws as its OWN centered line within the stereo block's own
 *     (widest-label) width, the whole block then centered against the name
 *     within their shared `widthStereoAndName` column — exactly
 *     `HeaderLayout#drawU`'s nested-centering read.
 */
import type { Classifier, ClassDiagramAST, HideStereotypeDirective } from './ast.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';
import { javaRound4 } from '../../core/number-format.js';
import { BADGE_LEFT_MARGIN, BADGE_RADIUS, NAME_LEFT_MARGIN } from './class-badge.js';

/** `FontParam.CLASS_STEREOTYPE`'s hardcoded size (12, italic) — independent
 *  of `theme.fontSize`/`AttributeFontSize` (a DIFFERENT `FontParam`), matches
 *  `class-object-map-sizing.ts`'s identical `STEREO_FONT_SIZE` constant. */
export const CLASS_STEREOTYPE_FONT_SIZE = 12;

/** `TextBlockUtils.withMargin(stereoBlock, 1, 0)`'s marginX — applied on
 *  BOTH left and right (total width contribution is 2x this). */
const STEREO_MARGIN = 1;

/**
 * G2 N27: `skinparam guillemet <value>` (`Guillemet.fromDescription`) --
 * the wrapper strings a stereotype label draws with. Optional/additive
 * (defaults to `«`/`»`, the same literal default this module previously
 * hardcoded) so every pre-existing call site stays behavior-identical when
 * no override is threaded through. `class-object-map-sizing.ts#
 * wrapGuillemet` (object/map leaves) keeps its own separate, still-unwired
 * copy -- shared with `state-sizing.ts` (a DIFFERENT diagram type), out of
 * this class-only iteration's scope (see that module's own doc comment).
 */
export interface GuillemetPair {
  start: string;
  end: string;
}

const DEFAULT_GUILLEMET: GuillemetPair = { start: '«', end: '»' };

function wrapGuillemet(label: string, guillemet: GuillemetPair = DEFAULT_GUILLEMET): string {
  return `${guillemet.start}${label}${guillemet.end}`;
}

/**
 * `StereotypeDecoration#buildComplex`'s `circleChar`/`circleSprite`
 * sub-pattern: a label chunk starting with `(CHAR[,COLOR])` or
 * `($sprite[,COLOR])` is a CIRCLED-CHARACTER/sprite BADGE override, not
 * displayed text -- upstream strips the `(...)` prefix and keeps only
 * whatever residual text follows (possibly none, e.g. `<<(?, red)>>` has
 * NO visible label at all -- jar-verified `bejeli-39-sina124`'s
 * `ColoredCircle`/`PlainCircle`, both `<<(...)>>`-only, draw ZERO
 * stereotype text rows; `NamedStereotype`/`PlainCircleStereotype`, both
 * `<<(...)[,] Stereotype>>`, draw exactly one row reading `«Stereotype»`
 * regardless of the comma). The custom badge letter/color override itself
 * (`CHAR`/`COLOR` -- `class-badge.ts#badgeFill`/`badgeLetter`'s existing
 * kind-only dispatch) is a SEPARATE, unbuilt mechanism, out of this
 * function's scope -- this only prevents the paren-decoration syntax
 * itself from being drawn as garbage literal text.
 */
function stripCircledCharDecoration(label: string): string {
  const m = /^\(\s*\S\s*(?:,\s*(?:#[0-9a-fA-F]{6}|\w+)\s*)?\)\s*,?\s*(.*)$/.exec(label);
  return m === null ? label : m[1]!.trim();
}

/**
 * `StereotypeDecoration#cutLabels`: splits a `Classifier.stereotype` blob
 * back into its individual per-stereotype label TOKENS, trimmed, then
 * strips any `(CHAR[,COLOR])` circled-character decoration prefix ({@link
 * stripCircledCharDecoration}) and drops tokens that are empty afterward
 * (a pure spot-color/letter override with no visible text). The greedy
 * declaration-parser capture (`class-declaration-parser.ts#
 * extractDecorations`'s own doc comment) absorbs STACKED `<<A>><<B>>`
 * markup into one string spanning the first `<<` to the last `>>` — e.g.
 * `"Singleton >>  << Startup >>  << Stateless Session Bean"` — so
 * reconstructing `<<${stereotype}>>` and re-splitting on each `<<...>>`
 * occurrence recovers jar's own per-label list exactly (mirrors
 * `StereotypeDecoration.java`'s identical two-step: the declaration grammar
 * captures the whole blob once, `cutLabels` re-parses it into labels at
 * render time).
 *
 * G2 N37: a TRIPLE-bracket label (`<<<mystyle>>>`, e.g. `class Foo
 * <<<mystyle>>>`) carries a `visible: false` flag -- jar-verified
 * `dozude-05-jeve029`: `AliceMyStyle <<<mystyle>>>` draws NO `«mystyle»`
 * stereotype text row (unlike the 2-bracket `AliceMyStyleStereo
 * <<mystyle>>`, which does) and its header box height matches the
 * NO-stereotype case exactly, yet the `.mystyle { ... }` `<style>`
 * declaration's BackgroundColor/RoundCorner/FontStyle/FontColor STILL
 * apply to it (cyan fill, `rx="2.5"`, bold red text) -- i.e. the tag is
 * INVISIBLE for display but still ACTIVE for style-cascade matching. Two
 * separate consumers read this token list for their own purpose:
 * {@link splitStereotypeLabels} (visible-only, feeds the RENDERED stacked
 * stereotype row(s)) and {@link splitStereotypeStyleTags} (every token
 * regardless of bracket count, feeds `.tagname` style-cascade matching --
 * `style-map-element.ts#resolveStyleCascade`'s `stereotypeTags` param).
 */
function splitStereotypeTokens(
  stereotype: string,
): Array<{ label: string; visible: boolean }> {
  const reconstructed = `<<${stereotype}>>`;
  const tokens: Array<{ label: string; visible: boolean }> = [];
  const re = /(<{2,3})(.*?)>{2,3}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reconstructed)) !== null) {
    const stripped = stripCircledCharDecoration(m[2]!.trim());
    if (stripped !== '') tokens.push({ label: stripped, visible: m[1]!.length === 2 });
  }
  return tokens;
}

/** Visible-only labels (2-bracket `<<X>>`) -- feeds the RENDERED stacked
 *  stereotype row(s) ({@link buildStereoRows}) and header-height sizing
 *  ({@link stereoBlockDim}). See {@link splitStereotypeTokens}'s own doc
 *  comment for the 3-bracket-invisible derivation. */
export function splitStereotypeLabels(stereotype: string): string[] {
  return splitStereotypeTokens(stereotype)
    .filter((t) => t.visible)
    .map((t) => t.label);
}

/** EVERY label regardless of bracket count (2 OR 3) -- feeds `.tagname`
 *  `<style>` cascade matching, which is INDEPENDENT of display visibility
 *  (see {@link splitStereotypeTokens}'s own doc comment). G2 N37. */
export function splitStereotypeStyleTags(stereotype: string): string[] {
  return splitStereotypeTokens(stereotype).map((t) => t.label);
}

export interface CircledCharDecoration {
  char: string;
  color?: string;
}

/**
 * `StereotypeDecoration#buildComplex`'s CHAR/COLOR capture (java:143-183) --
 * the badge-customization HALF of the `(CHAR[,COLOR])` decoration
 * {@link stripCircledCharDecoration} strips as plain text (G2 N26; that
 * function's own doc comment names this as the "separate, unbuilt
 * mechanism"). Scans every `<<...>>` chunk in declaration order, like
 * {@link splitStereotypeLabels}; unlike that function, a LATER matching
 * chunk OVERWRITES the running result entirely (upstream's own loop
 * reassigns `htmlColor`/`character` unconditionally on each match, java:
 * 174-176 -- not merged/accumulated), so only the LAST `(CHAR[,COLOR])`
 * chunk in a stacked stereotype wins. `color` is `undefined` when the
 * bracket carries no COLOR group (`EntityImageClassHeader.java:180-182`:
 * `stereotype.getHtmlColor() == null ? spotBackColor : ...` -- the caller
 * falls back to the kind's own default spot color in that case, so this
 * function deliberately leaves it unset rather than guessing one). Returns
 * `undefined` when no chunk carries the decoration at all.
 * @see ~/git/plantuml/.../stereo/StereotypeDecoration.java:58-183
 */
const CIRCLE_CHAR_RE = /^\(\s*(\S)\s*(?:,\s*(#[0-9a-fA-F]{6}|\w+)\s*)?\)/;

export function parseCircledCharDecoration(
  stereotype: string | undefined,
): CircledCharDecoration | undefined {
  if (stereotype === undefined) return undefined;
  const reconstructed = `<<${stereotype}>>`;
  const re = /<{2,3}(.*?)>{2,3}/g;
  let result: CircledCharDecoration | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reconstructed)) !== null) {
    const cm = CIRCLE_CHAR_RE.exec(m[1]!.trim());
    if (cm === null) continue;
    const char = cm[1]!;
    const color = cm[2];
    result = color !== undefined ? { char, color } : { char };
  }
  return result;
}

/** Per-label raw (unmargined) text widths, `javaRound4`'d to match jar's
 *  `SvgGraphics#format` rounding (same convention as `measureGenericClassifier
 *  `'s `headerTextWidth`). Empty when the classifier has no stereotype. */
export function measureStereoLabelWidths(
  labels: readonly string[],
  fontFamily: string,
  measurer: StringMeasurer,
  guillemet: GuillemetPair = DEFAULT_GUILLEMET,
): number[] {
  return labels.map((l) =>
    javaRound4(
      measurer.measure(wrapGuillemet(l, guillemet), { family: fontFamily, size: CLASS_STEREOTYPE_FONT_SIZE }).width,
    ),
  );
}

interface Dim { width: number; height: number; }

/** `stereoDim` — the whole (margined) stereotype block's dimension: width =
 *  widest individual label + 2*margin, height = sum of each label's own
 *  line height (this codebase's measurer models line height == font size
 *  exactly — the same `nameDim.height ~= fontSize` convention
 *  `class-layout-helpers.ts#buildHeaderRow`'s own doc comment already
 *  relies on for the no-stereotype case). Zero when there is no stereotype. */
export function stereoBlockDim(labelWidths: readonly number[]): Dim {
  if (labelWidths.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...labelWidths) + STEREO_MARGIN * 2,
    height: labelWidths.length * CLASS_STEREOTYPE_FONT_SIZE,
  };
}

/** Inputs `buildStereoRows` needs to place the stacked stereotype rows +
 *  the name row's own vertical offset — grouped into one object (not
 *  positional params) to stay under the per-function param-count cap. */
export interface StereoRowsInput {
  labels: readonly string[];
  labelWidths: readonly number[];
  fontFamily: string;
  circleWidth: number;
  /** `HeaderLayout#drawU`'s `widthStereoAndName = max(stereoDim.width,
   *  nameDim.width)`. */
  widthStereoAndName: number;
  blockDim: Dim;
  /** The SAME asymmetric wider-box-slack terms `buildHeaderRow` derives
   *  (`class-layout-helpers.ts`, G2 N23) — passed in rather than
   *  recomputed, so the stereo rows and the name row agree on one split. */
  h1: number;
  h2: number;
  headerRowHeight: number;
  nameLineHeight: number;
  stereoBaselineOffset: number;
  /** G2 N27: `skinparam guillemet <value>` override — defaults to `«`/`»`
   *  when omitted (every pre-existing caller). */
  guillemet?: GuillemetPair | undefined;
}

/**
 * Builds the stacked stereotype text rows (empty when there is no
 * stereotype) and the name row's own top-of-line Y offset —
 * `HeaderLayout#drawU`'s `xStereo`/`yStereo` (per label, nested-centered
 * within the stereo block) and `yName`'s stereo-height-dependent term.
 */
export function buildStereoRows(
  input: StereoRowsInput,
): { rows: ClassifierGeo['rows']; nameTop: number } {
  const { labels, labelWidths, fontFamily, circleWidth, widthStereoAndName, blockDim } = input;
  const { h1, h2, headerRowHeight, nameLineHeight, stereoBaselineOffset } = input;
  const guillemet = input.guillemet ?? DEFAULT_GUILLEMET;
  const diffHeight = headerRowHeight - blockDim.height - nameLineHeight;
  if (labels.length === 0) return { rows: [], nameTop: diffHeight / 2 };

  const blockX = circleWidth + (widthStereoAndName - blockDim.width) / 2 + h1 + h2 + STEREO_MARGIN;
  const rawBlockWidth = Math.max(...labelWidths);
  const rows: ClassifierGeo['rows'] = labels.map((label, i) => {
    const rawWidth = labelWidths[i]!;
    const indent = blockX + (rawBlockWidth - rawWidth) / 2;
    const top = diffHeight / 2 + i * CLASS_STEREOTYPE_FONT_SIZE;
    return {
      text: wrapGuillemet(label, guillemet),
      y: top + stereoBaselineOffset,
      indent,
      italic: true,
      width: rawWidth,
      fontFamily,
      fontSize: CLASS_STEREOTYPE_FONT_SIZE,
    };
  });
  return { rows, nameTop: diffHeight / 2 + blockDim.height };
}

// ---------------------------------------------------------------------------
// Header display info + the header (name) row itself -- moved here from
// class-layout-helpers.ts (G2 N24) to keep that file under the repo's
// 500-line-per-file cap; `buildHeaderRow` needs the SAME `h1`/`h2`/`nameTop`
// values `buildStereoRows` above computes, so the two now live together.
// ---------------------------------------------------------------------------

export interface HeaderInfo {
  headerText: string;
  headerItalic: boolean;
}

/** Build the header display string and kind-derived flags for a classifier. */
export function computeHeaderInfo(classifier: Classifier): HeaderInfo {
  // Just the name (kind shown via badge + italic) — annotations get an `@` prefix.
  const headerText =
    classifier.kind === 'annotation'
      ? `@${classifier.display}`
      : classifier.display;
  const headerItalic =
    classifier.kind === 'interface' || classifier.kind === 'abstract';
  return { headerText, headerItalic };
}

/**
 * The header row's badge + text x-positions -- G2 N23, replacing N4's
 * symmetric `centerOffset` guess; G2 N24 generalized it to also cover the
 * `stereoDim` term (a classifier's `<<stereotype>>` row(s)). `HeaderLayout
 * #drawU` (`~/git/plantuml/.../svek/HeaderLayout.java:81-117`) does NOT
 * split the wider-box slack evenly between badge and name: it reserves
 * `h2 = min(circleDim.width / 4, suppWith * 0.1)` of the slack as an
 * asymmetric "extra" term shared by BOTH sides, then splits the REMAINDER
 * `h1 = (suppWith - h2) / 2` evenly -- the badge moves right by `h1` alone,
 * while the name/stereo column moves right by `h1 + h2`. `h1`/`h2` are
 * computed ONCE by the caller (`computeHeaderSlack`, `class-badge.ts`) and
 * shared with `buildStereoRows` above so the stereo rows and the name row
 * agree on one split.
 *
 * `nameTop`/`widthStereoAndName` fold in the stereo term: `nameTop` is
 * `buildStereoRows`'s own returned name-row Y offset (`diffHeight / 2 +
 * stereoDim.height`, reducing to the OLD `(headerRowHeight - fontSpec.size)
 * / 2` exactly when there is no stereotype); `indent` uses
 * `widthStereoAndName = max(stereoDim.width, nameDim.width)` in place of the
 * OLD formula's bare `nameDim.width` (identical when there is no
 * stereotype, since `widthStereoAndName` then reduces to `nameWidth`).
 *
 * Jar-verified BYTE-EXACT (not just direction) on 3 independent
 * stereotype-free fixtures sharing this exact header (`sufide-66-sanu583`/
 * `xajefo-97-julu315`/`cokeje-99-gede231`, `plans/g2-class-svg/ledger.md`
 * N23) and 2 stereotype-bearing fixtures (`zejize-00-vivu578`/
 * `pajuba-83-roji161`, N24 -- see this file's own doc comment).
 */
export function buildHeaderRow(input: {
  header: HeaderInfo;
  circleWidth: number;
  widthStereoAndName: number;
  nameWidth: number;
  h1: number;
  h2: number;
  nameTop: number;
  baselineOffset: number;
  fontSpec: { family: string; size: number; bold?: boolean; italic?: boolean };
  headerTextWidth: number;
}): ClassifierGeo['rows'][number] {
  const { header, circleWidth, widthStereoAndName, nameWidth, h1, h2 } = input;
  const { nameTop, baselineOffset, fontSpec, headerTextWidth } = input;
  const indent = circleWidth + (widthStereoAndName - nameWidth) / 2 + h1 + h2 + NAME_LEFT_MARGIN;
  const badgeIndent = h1 + BADGE_LEFT_MARGIN + BADGE_RADIUS;
  const y = nameTop + baselineOffset;
  return {
    text: header.headerText,
    y,
    indent,
    // G2 N32: kind-derived italic (interface/abstract) UNIONED with
    // `skinparam classFontStyle italic` -- see `theme.ts#classFontItalic`'s
    // doc comment; the two are independent, non-exclusive sources.
    italic: header.headerItalic || fontSpec.italic === true,
    ...(fontSpec.bold === true ? { bold: true as const } : {}),
    width: headerTextWidth,
    badgeIndent,
    fontFamily: fontSpec.family,
    fontSize: fontSpec.size,
  };
}

// ---------------------------------------------------------------------------
// `class Foo<T>`/`class Bar<P, Q>` generic type-parameter TAG box (G2 N32) --
// `HeaderLayout#getDimension`/`#drawU`'s `genericDim`/`xGeneric`/`yGeneric`
// terms, deferred at N12 (explicit DOT-gate risk, since `genericDim.width`
// widens the classifier's own MEASURED box -- jar-verified, see below) and
// re-surveyed here per the header formulas (N23/N24) now being fully
// verified. Drawn OUTSIDE/ABOVE the classifier box (`yGeneric = -delta`) but
// its WIDTH is added directly into `HeaderLayout#getDimension`'s width sum,
// so it DOES change the DOT-emitted node width -- confirmed via 2 byte-exact
// samples: `caboco-62-jula911` (`Foo<Param>`: headerWidth 26+30.15+39.325 =
// 95.475, matches jar's `rect/@width` exactly; `Bar<P, Q>`: 26+27.7875+
// 24.625 = 78.4125, matches exactly) -- landed only after the empirical
// `dot-sync-report.ts class` gate confirmed 708/708 unchanged (see
// `plans/g2-class-svg/ledger.md` N32).
//
// Font: `FontParam.CLASS_STEREOTYPE` (SAME 12pt-italic param the stereotype
// rows above use) -- `EntityImageClassHeader.java:144-148`'s
// `Display.create(FontConfiguration.create(skinParam, FontParam
// .CLASS_STEREOTYPE, stereotype), CENTER, skinParam)`.
//
// Sizing: `genericBlock` is wrapped in `TextBlockUtils.withMargin(_, 1, 1)`
// TWICE -- once around the raw text (BEFORE it becomes the `TextBlockGeneric`
// box, `TextBlockGeneric.java`'s own `calculateDimension` returns exactly
// its wrapped inner block's dimension with no size of its own) and once
// again around the `TextBlockGeneric` wrapper itself. Each `withMargin(_,
// 1,1)` adds 2px total per axis (1px each side) -- so the RECT drawn by
// `TextBlockGeneric` is `rawText + 2` (the FIRST margin only), while
// `genericDim` (what `HeaderLayout` actually sums into its own width/height)
// is `rawText + 4` (both margins) -- jar-verified: `caboco`'s "Param" rect
// `width="37.325"` = rawTextWidth(35.325, matching the rendered `<text
// textLength>`) + 2; `headerWidth` includes `rawTextWidth + 4 = 39.325`.
//
// Position: `HeaderLayout#drawU`'s `xGeneric = width - genericDim.width +
// delta(4)` places the OUTER (second-margin) block's own top-left; the
// RECT then draws 1px further in/down (the outer margin's own left/top
// inset) -- `rectX = boxWidth - genericDim.width + delta + 1`, `rectY =
// -delta + 1`. `width` here is the classifier's FINAL box width (post
// `Math.max(headerWidth, memberAreaWidth)`, matching `HeaderLayout#drawU`'s
// own `width` PARAMETER, the SAME value `computeHeaderSlack` above already
// receives) -- NOT the pre-max `headerWidth` alone (only coincide when the
// header, not member content, is the box's widest term, the common case
// every corpus sample so far happens to hit).
// ---------------------------------------------------------------------------

/** `withMargin(_, 1, 1)` applied twice (raw text, then the TextBlockGeneric
 *  wrapper) -- 2px total per axis, per application; see this section's own
 *  doc comment for the jar derivation. */
const GENERIC_TAG_MARGIN = 4;

/** Pre-measured generic-tag block dimension -- `HeaderLayout`'s own
 *  `genericDim` (both margins folded in), plus the UNMARGINED raw text
 *  width `buildGenericTagGeo` needs for the rendered `<text textLength>`. */
export interface GenericTagDim {
  width: number;
  height: number;
  rawTextWidth: number;
}

/**
 * Measure the `<T>`/`<P, Q>` tag block for a classifier's `typeParams`
 * (`Classifier.typeParams`, `ast.ts` -- always joined `', '`, matching
 * upstream's own captured generic-clause text). Returns `undefined` when
 * there are no type parameters (the overwhelmingly common case -- zero
 * behavior change for every classifier this mission has already verified).
 */
export function measureGenericTagDim(
  typeParams: readonly string[],
  fontFamily: string,
  measurer: StringMeasurer,
): GenericTagDim | undefined {
  if (typeParams.length === 0) return undefined;
  const rawTextWidth = javaRound4(
    measurer.measure(typeParams.join(', '), { family: fontFamily, size: CLASS_STEREOTYPE_FONT_SIZE }).width,
  );
  return {
    width: rawTextWidth + GENERIC_TAG_MARGIN,
    height: CLASS_STEREOTYPE_FONT_SIZE + GENERIC_TAG_MARGIN,
    rawTextWidth,
  };
}

/** Render-ready generic-tag geometry -- every field box-RELATIVE (added to
 *  `geo.x`/`geo.y` at render time), matching `badgeIndent`/`row.indent`'s
 *  existing convention. */
export interface GenericTagGeo {
  text: string;
  rectX: number;
  rectY: number;
  rectWidth: number;
  rectHeight: number;
  textX: number;
  textY: number;
  textWidth: number;
  fontFamily: string;
}

/**
 * Position the tag box against the classifier's FINAL box width -- see this
 * section's own doc comment for why `boxWidth` (not `headerWidth` alone)
 * is the correct term, matching `HeaderLayout#drawU`'s own `width` param.
 * `baselineOffset` is the SAME `CLASS_STEREOTYPE_FONT_SIZE`-scaled ascent
 * value `measureGenericClassifier`'s `stereoBaselineOffset` already computes
 * for the `<<stereotype>>` row(s) above (same font param, reused as-is).
 */
export function buildGenericTagGeo(
  typeParams: readonly string[],
  dim: GenericTagDim,
  boxWidth: number,
  fontFamily: string,
  baselineOffset: number,
): GenericTagGeo {
  const rectX = boxWidth - dim.width + GENERIC_TAG_MARGIN + 1;
  const rectY = -GENERIC_TAG_MARGIN + 1;
  return {
    text: typeParams.join(', '),
    rectX,
    rectY,
    rectWidth: dim.width - 2,
    rectHeight: dim.height - 2,
    textX: rectX + 1,
    textY: rectY + 1 + baselineOffset,
    textWidth: dim.rawTextWidth,
    fontFamily,
  };
}

// ---------------------------------------------------------------------------
// `hide|show [<<pattern>>] stereotype(s)` directive (G2 N24) -- lives here
// (not class-directives.ts, already at the 500-line cap) since it operates
// on the SAME `splitStereotypeLabels` output this file already owns.
// ---------------------------------------------------------------------------

/**
 * `hide|show [<<pattern>>] stereotype(s)` (upstream `CommandHideShowByGender`,
 * `PORTION=stereotype`, G2 N24) — narrower than the full upstream command
 * (which also covers `members`/`circle`/etc, already ported separately by
 * `class-directives.ts#parseHideShowDirective`/`parseHideShowVisibilityDirective`):
 * only the `GENDER` slot's `<<...>>`-stereotype-pattern form (or no gender
 * at all) is matched here; a bare type keyword (`hide class stereotype`) or
 * entity-id gender is a distinct, unported sub-case of the same upstream
 * command. `pattern` is stored WITHOUT its `<<`/`>>` brackets, trimmed —
 * the same shape {@link splitStereotypeLabels} produces for a classifier's
 * own labels, so {@link isStereotypeLabelHidden} can compare them directly.
 */
const STEREOTYPE_HIDESHOW_RE = /^(hide|show)\s+(?:(<<.*>>)\s+)?stereotypes?\s*$/i;

export function parseHideStereotypeDirective(line: string): HideStereotypeDirective | null {
  const m = STEREOTYPE_HIDESHOW_RE.exec(line);
  if (m === null) return null;

  const action: 'hide' | 'show' = /^hide/i.test(m[1]!) ? 'hide' : 'show';
  const bracketed = m[2];
  if (bracketed === undefined) return { kind: 'hidestereotype', action };
  const pattern = bracketed.slice(2, -2).trim();
  return { kind: 'hidestereotype', action, pattern };
}

/**
 * `CucaDiagram#isStereotypeLabelShown`: scans the accumulated
 * `hide|show [<<pattern>>] stereotype(s)` directives IN ORDER, last matching
 * one wins; a directive with no `pattern` matches every label. Default
 * (no directive matches) is VISIBLE — mirrors upstream's `result = true`
 * seed.
 */
export function isStereotypeLabelHidden(
  label: string,
  directives: readonly HideStereotypeDirective[],
): boolean {
  let shown = true;
  for (const d of directives) {
    if (d.pattern === undefined || d.pattern === label) shown = d.action === 'show';
  }
  return !shown;
}

/**
 * Post-parse pass (G2 N24): populates `Classifier.visibleStereotypeLabels`
 * for every classifier carrying a `stereotype`, pre-filtering out any label
 * hidden by a `hide|show [<<pattern>>] stereotype(s)` directive — mirrors
 * `class-directives.ts#applyVisibilityHideShow`'s "mutate the AST once,
 * layout reads the result" shape. Runs unconditionally (even with zero
 * directives) so `measureGenericClassifier` always has a populated,
 * order-preserving label list to read rather than needing its own fallback
 * branch in the common (no-directive) case.
 */
export function applyStereotypeHideShow(ast: ClassDiagramAST): void {
  const directives = ast.hideStereotypeDirectives ?? [];
  for (const classifier of ast.classifiers) {
    if (classifier.stereotype === undefined) continue;
    const labels = splitStereotypeLabels(classifier.stereotype);
    classifier.visibleStereotypeLabels = directives.length === 0
      ? labels
      : labels.filter((l) => !isStereotypeLabelHidden(l, directives));
  }
}

/**
 * `Classifier.visibleStereotypeLabels` when populated (post-hideshow), else
 * an unfiltered split of `classifier.stereotype` -- the SAME fallback
 * `class-layout-helpers.ts#measureGenericClassifier`'s own `stereoLabels`
 * local already computed inline (G2 N24); extracted here (G2 N37) so
 * `class-geo-builders.ts` can copy the identical resolved list onto
 * `ClassifierGeo.stereotypeLabels` for render-time `.tagname` matching
 * without duplicating the expression a third time.
 */
export function resolveVisibleStereotypeLabels(classifier: Classifier): string[] {
  return classifier.visibleStereotypeLabels
    ?? (classifier.stereotype !== undefined ? splitStereotypeLabels(classifier.stereotype) : []);
}

/**
 * EVERY stereotype label (2-or-3-bracket) a classifier carries, for
 * `.tagname` `<style>` cascade matching (G2 N37) -- deliberately NOT
 * `hide|show stereotype`-filtered (that directive only controls DISPLAY,
 * `splitStereotypeTokens`'s own doc comment on why display and
 * style-matching are independent axes; no corpus sample combines
 * `hide stereotype` with a `.tagname` cascade, so this is the most
 * defensible reading of the two features' independence rather than a
 * jar-verified interaction).
 */
export function resolveStyleStereotypeTags(classifier: Classifier): string[] {
  return classifier.stereotype !== undefined ? splitStereotypeStyleTags(classifier.stereotype) : [];
}


