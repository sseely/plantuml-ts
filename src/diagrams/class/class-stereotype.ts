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
 * back into its individual per-stereotype labels, trimmed, then strips any
 * `(CHAR[,COLOR])` circled-character decoration prefix ({@link
 * stripCircledCharDecoration}) and drops labels that are empty afterward
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
 */
export function splitStereotypeLabels(stereotype: string): string[] {
  const reconstructed = `<<${stereotype}>>`;
  const labels: string[] = [];
  const re = /<{2,3}(.*?)>{2,3}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reconstructed)) !== null) {
    const stripped = stripCircledCharDecoration(m[1]!.trim());
    if (stripped !== '') labels.push(stripped);
  }
  return labels;
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
  fontSpec: { family: string; size: number };
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
    italic: header.headerItalic,
    width: headerTextWidth,
    badgeIndent,
    fontFamily: fontSpec.family,
    fontSize: fontSpec.size,
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

