/**
 * Object classifier sizing + the header-row math SHARED by object/map/json
 * (`kind:'object'`) leaves in the class diagram layout engine (./layout.ts).
 * Split into its own module (mirrors class-lollipop.ts / class-magma.ts's
 * precedent for a synthesising helper) to keep class-layout-helpers.ts under
 * the repo's 500-line-per-file cap and every function under the CCN/NLOC
 * caps. `kind:'map'` sizing lives in the sibling ./class-map-sizing.ts (G3/O1
 * split, same 500-line-cap motivation — this file was about to exceed the
 * cap once the O1 data-row fix's doc comments landed).
 *
 * Faithful port of the dimension math:
 *   @see ~/git/plantuml/.../svek/image/EntityImageObject.java
 *   @see ~/git/plantuml/.../cucadiagram/MethodsOrFieldsArea.java (asBlockMemberImpl)
 *   @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java (getBody, OBJECT branch)
 *   @see ~/git/plantuml/.../klimt/font/FontParam.java (OBJECT_STEREOTYPE = size 12, italic)
 *
 * Verified byte-for-byte (WidthTableMeasurer, matching the jar's
 * `-DPLANTUML_DETERMINISTIC_TEXT=true` svek DOT dump) against:
 *   - test-results/dot-cache/object/beleso-08-ruca459 — plain object, no
 *     stereotype/fields (dimTitle only, both nodes).
 *   - test-results/dot-cache/object/figeze-77-fozi735 — object with 2 fields,
 *     no stereotype (field-area width/height formula, per-row baseline+
 *     textLength, G3/O1).
 *   - test-results/dot-cache/object/majake-62-pero492 — object with/without 1
 *     stereotype + 1 field (stereo line HEIGHT only — no fixture in the
 *     corpus has a stereo-dominant WIDTH, so the guillemet-wrapped stereo
 *     WIDTH formula below is a faithful port but numerically unverified).
 *   - oracle/goldens/object/nukera-08-dige359 — object with 4 raw (non-
 *     structured) member lines, each carrying a distinct explicit visibility
 *     char (-#~+) — verifies {@link OBJECT_SMALL_ICON}'s fixed per-block icon
 *     reserve (p1: 133.7125 x 82.0 px exact) AND (G3/O1) that the field-row
 *     baseline stride is exactly fontSize, independent of the icon reserve.
 * See this task's mission-brief return for the worked numbers. `map`'s own
 * verification fixtures (bepafe-03-teda035, diveje-52-xefe514) live in
 * ./class-map-sizing.ts's module doc.
 *
 * `titleDimension`/`measureStereo`/`headerRows`/`baselineOffsetFor` are
 * exported — `map` (./class-map-sizing.ts) and `json`
 * (class-json-sizing.ts) share the SAME header formula as EntityImageObject
 * (name margin 2,2 + optional italic stereotype line, both centered and
 * stacked) and the SAME "ascent-from-row-top" baseline convention for their
 * OWN data rows, so both reuse these helpers rather than duplicating the
 * math a second/third time.
 */

import type { Classifier, Member } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';

// ---------------------------------------------------------------------------
// Shared object/map/json header sizing (name + optional stereotype, stacked)
// ---------------------------------------------------------------------------

/** FontParam.OBJECT_STEREOTYPE's hardcoded size (12, italic) — shared by
 *  EntityImageObject and EntityImageMap; independent of theme.fontSize. */
const STEREO_FONT_SIZE = 12;

/** Guillemet.GUILLEMET (`«`/`»`) — upstream's default wrapping when
 *  no `skinparam guillemet` override is configured. */
function wrapGuillemet(label: string): string {
  return `«${label}»`;
}

export interface Dim {
  width: number;
  height: number;
}

/**
 * `fontSize - measurer.getDescent(fontSpec, text)` — the "ascent-from-
 * line-top" baseline convention every class text row uses
 * (`class-layout-helpers.ts`'s own `baselineOffset`, `headerRows` below,
 * `class-namespace-shape.ts#getTitleBaselineOffset`). Every {@link
 * StringMeasurer} implementation's `getDescent` is content-independent
 * (ignores its `text` argument — `core/measurer.ts`'s own doc comment), so
 * this is safe to compute ONCE per (fontFamily, fontSize) and reuse across
 * every row in a block, rather than re-deriving it per row. Exported for
 * ./class-map-sizing.ts's own data-row baseline (G3/O1).
 */
export function baselineOffsetFor(fontSpec: FontSpec, measurer: StringMeasurer): number {
  return fontSpec.size - measurer.getDescent(fontSpec, '');
}

/** EntityImageObject/Map#getNameAndSteretypeDimension: width = max of the two
 *  (both already margin-padded by the caller), height = sum (stacked). */
export function titleDimension(nameDim: Dim, stereoDim: Dim): Dim {
  return { width: Math.max(nameDim.width, stereoDim.width), height: nameDim.height + stereoDim.height };
}

/** The (un-padded) stereotype line dimension, zero when absent — mirrors
 *  upstream's `stereoDim = new XDimension2D(0, 0)` fallback. No margin is
 *  applied to the stereo TextBlock in either EntityImageObject or
 *  EntityImageMap (unlike the name block, which gets a style/fixed margin). */
export function measureStereo(classifier: Classifier, theme: Theme, measurer: StringMeasurer): Dim {
  if (classifier.stereotype === undefined) return { width: 0, height: 0 };
  return measurer.measure(wrapGuillemet(classifier.stereotype), {
    family: theme.fontFamily,
    size: STEREO_FONT_SIZE,
  });
}

/**
 * Header rows shared by object/map/json: stereo (italic, if present) stacked
 * above the name, BOTH horizontally centered within the classifier's FINAL
 * content width -- `EntityImageObject#getLayout` builds a `ULayoutGroup`
 * (`PlacementStrategyY1Y2`) over `[stereo?, name]` and draws it via
 * `header.drawU(ug, dimTotal.getWidth(), dimTitle.getHeight())`;
 * `PlacementStrategyY1Y2#getPositions` centers EVERY block at
 * `x = (width - blockWidth) / 2` (klimt/geom/PlacementStrategyY1Y2.java) --
 * `width` there is `dimTotal.getWidth()`, the classifier's FULL final box
 * width (post `Math.max(fieldsWidth, title.width + 2*marginCircle)`), NOT
 * `title.width` alone -- so `boxWidth` here must be the caller's already-
 * computed FINAL width, not a value derivable from this function's own
 * inputs (G3/O0, jar-verified against 6 samples spanning all three kinds:
 * `niloru-34-nuve651`/`pagidu-67-doxa131`/`sobosi-40-xuda813`/
 * `vozomu-86-rodo657` (plain object, no stereo), `majake-62-pero492`'s
 * `foo3` + `fafozi-27-reja300`'s `node2` (object with stereotype/stacked
 * stereotypes), `bepafe-03-teda035`'s `CapitalCity` (map) and `A` (json) --
 * every sample's `<text x>` matches `boxWidth`-centered exactly; the
 * PRE-O0 code centered against nothing (`indent: 0`, flush-left) and never
 * set `width` at all (jar always emits `lengthAdjust`/`textLength` on both
 * rows -- `renderRowText`'s own `row.width !== undefined` gate, this
 * function's own prior doc comment already noted the omission was
 * inherited, not deliberate).
 *
 * The name TextBlock is drawn `TextBlockUtils.withMargin(tmp, padding)` --
 * the raw name text is itself CENTERED within that padded block
 * (`HorizontalAlignment.CENTER`), so with a symmetric `namePadding` the
 * block-level centering (against `nameWidth + 2*namePadding`) and the
 * inner-block centering compose to exactly `(boxWidth - nameWidth) / 2` for
 * `indent` -- algebraically identical, verified directly against the raw
 * (unpadded) `nameWidth`/`stereoWidth` this function already measures for
 * `textLength`. The stereo TextBlock carries NO margin (this function's own
 * pre-O0 doc comment, unchanged), so its indent uses the SAME formula
 * against its own raw width with no padding term.
 *
 * Vertical stacking uses the SAME "ascent-from-line-top" `baselineOffset =
 * fontSize - measurer.getDescent(fontSpec, text)` convention every other
 * class text row uses (`class-layout-helpers.ts`'s own `baselineOffset`,
 * `class-namespace-shape.ts#getTitleBaselineOffset`) -- the stereo row (no
 * margin) draws at `y = stereoBaselineOffset` (its own 12pt
 * `STEREO_FONT_SIZE`); the name row draws BELOW it at `y = stereoH +
 * namePadding + nameBaselineOffset` (`namePadding` accounts for the name
 * block's own top margin the stereo row never had) -- jar-verified: EVERY
 * sample's name-row `y` equals `stereoH + namePadding + (fontSize -
 * descent)` exactly, and the stereo row's `y` (when present) equals
 * `STEREO_FONT_SIZE - descent(12pt)` exactly.
 *
 * `namePadding` is caller-supplied (not a shared constant here) because
 * object/map/json each define their OWN "coincidentally-equal-but-
 * independently-named" margin literal (`OBJECT_NAME_PADDING`,
 * `class-map-sizing.ts`'s `MAP_NAME_MARGIN`, `class-json-sizing.ts`'s
 * `JSON_NAME_MARGIN` -- all `2`, per each file's own doc-comment precedent
 * for NOT sharing a single named constant across files for a coincidental
 * numeric match).
 *
 * G3/O1 landed the SAME missing-`width`/wrong-baseline fix for object FIELD
 * rows (`measureObjectFields` below), map DATA rows
 * (`class-map-sizing.ts#buildMapRowGeo`), and json entry rows
 * (`class-json-sizing.ts#buildJsonRows`) — a related but functionally
 * separate mechanism from this function's own header fix (different padding
 * constants, variable per-row heights for map/json, and — map-specific — a
 * CENTER-vs-LEFT alignment split between the key and value columns that
 * this header function's own single-column centering does not need). See
 * those functions' own doc comments for the per-mechanism formulas.
 *
 * Does NOT thread a per-classifier `<style>`/`<<tag>>`-cascade FontSize
 * override (`skinparam object { FontSize }` / `<<tag>> { FontSize }`) --
 * that cascade is entirely unbuilt for object/map/json kinds (unlike the
 * generic class header's `row.fontSize`, N23/N32) and is its own separate,
 * larger, unbuilt feature (jar-verified absent via `tenalu-53-meri239`,
 * which combines this gap with the centering bug and was excluded from
 * this fix's own verification set for exactly that reason).
 */
export function headerRows(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  boxWidth: number,
  namePadding: number,
): ClassifierGeo['rows'] {
  const rows: ClassifierGeo['rows'] = [];
  const nameFontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const stereoFontSpec = { family: theme.fontFamily, size: STEREO_FONT_SIZE };
  let stereoHeight = 0;
  if (classifier.stereotype !== undefined) {
    const stereoText = wrapGuillemet(classifier.stereotype);
    const stereoDim = measurer.measure(stereoText, stereoFontSpec);
    // javaRound4: matches jar's `%.4f`-formatted textLength -- reused for
    // BOTH the drawn width AND the centering indent below, same "round
    // once, reuse" precedent as class-stereotype.ts's own rawTextWidth.
    const stereoWidth = javaRound4(stereoDim.width);
    const stereoBaseline = STEREO_FONT_SIZE - measurer.getDescent(stereoFontSpec, stereoText);
    stereoHeight = stereoDim.height;
    rows.push({
      text: stereoText,
      y: stereoBaseline,
      indent: (boxWidth - stereoWidth) / 2,
      italic: true,
      width: stereoWidth,
      fontSize: STEREO_FONT_SIZE,
    });
  }
  const nameWidth = javaRound4(measurer.measure(classifier.display, nameFontSpec).width);
  const nameBaseline = theme.fontSize - measurer.getDescent(nameFontSpec, classifier.display);
  rows.push({
    text: classifier.display,
    y: stereoHeight + namePadding + nameBaseline,
    indent: (boxWidth - nameWidth) / 2,
    width: nameWidth,
  });
  // #lizard forgives -- 37 NLOC, CCN 2: a single optional stereo-row
  // branch plus the always-present name row, each a flat 6-8-field object
  // literal (PlacementStrategyY1Y2's centering/baseline math, faithfully
  // ported per this project's porting discipline) -- splitting either
  // row's literal into its own helper would only relocate the NLOC, not
  // reduce it, and would separate the two rows' shared `stereoHeight`
  // dependency from its single point of use.
  return rows;
}

// ---------------------------------------------------------------------------
// object
// ---------------------------------------------------------------------------

/** `classDiagram,componentDiagram,objectDiagram > object { Padding 2 2 }`
 *  (plantuml.skin) -> ClockwiseTopRightBottomLeft.read("2 2") = all sides 2. */
const OBJECT_NAME_PADDING = 2;
/** MethodsOrFieldsArea#asBlockMemberImpl: `withMargin(this, 6, 4)`. */
const OBJECT_FIELD_MARGIN_X = 6;
const OBJECT_FIELD_MARGIN_Y = 4;
/** `TextBlockEmpty(10, 16)` — the "no fields but shown" placeholder box
 *  (EntityImageObject ctor, `fieldsToDisplay.size() == 0 && showFields`). */
const OBJECT_EMPTY_FIELDS: Dim = { width: 10, height: 16 };
/** EntityImageObject.xMarginCircle. */
const OBJECT_X_MARGIN_CIRCLE = 5;
/** BodierLikeClassOrObject#marginEmptyFieldsOrMethod — substituted only when
 *  the fields area is BOTH empty and shown. Unreachable in practice for
 *  object (the empty-fields branch above always yields height 16, never 0),
 *  ported anyway per this project's "port the awkward code too" discipline. */
const OBJECT_EMPTY_HEIGHT_FALLBACK = 13;
/**
 * `MethodsOrFieldsArea#calculateDimensionOnlyMembers`'s `smallIcon` term —
 * `skinParam.getCircledCharacterRadius() + 3`, added to the block's width
 * ONCE (not per row) whenever ANY visible member carries an explicit
 * visibility char (`hasSmallIcon()`). Upstream's default radius is
 * `FontParam.CIRCLED_CHARACTER`'s size (17) integer-divided by 3, plus 6:
 * `17/3 + 6 = 5 + 6 = 11`; `+3` -> 14. Verified against nukera-08-dige359's
 * p1 (four visibility-char member rows, all sharing the same post-strip
 * text): `107.7125 (text) + 14 (icon) + 12 (2*marginX) = 133.7125` px, the
 * oracle width exactly.
 * @see ~/git/plantuml/.../skin/SkinParam.java:542-545 (getCircledCharacterRadius)
 * @see ~/git/plantuml/.../klimt/font/FontParam.java:55 (CIRCLED_CHARACTER size 17)
 * @see ~/git/plantuml/.../cucadiagram/MethodsOrFieldsArea.java:125-138,155-157
 */
const OBJECT_SMALL_ICON = 14;

/** Format a member text string for object diagram instances: the raw,
 *  visibility-stripped source line verbatim when present (upstream's
 *  `Member#getDisplay(false)` — `Bodier` never rejects a body line, see
 *  class-object-commands.ts#parseObjectField), else the structured
 *  `name = value` / bare `name` reconstruction for the two shapes this AST
 *  still parses eagerly. Exported: also used by tests constructing expected
 *  row text directly. */
export function formatObjectMemberText(member: Pick<Member, 'name' | 'type' | 'rawDisplay'>): string {
  if (member.rawDisplay !== undefined) return member.rawDisplay;
  return member.type !== undefined ? `${member.name} = ${member.type}` : member.name;
}

/** BodierLikeClassOrObject#getMethodOrFieldHeight (OBJECT branch). */
function methodOrFieldHeight(fieldsHeight: number, showFields: boolean): number {
  return fieldsHeight === 0 && showFields ? OBJECT_EMPTY_HEIGHT_FALLBACK : fieldsHeight;
}

interface FieldsResult {
  dim: Dim;
  rows: ClassifierGeo['rows'];
}

/**
 * MethodsOrFieldsArea (via BodyFactory.create1 -> BodyEnhanced1 -> a single
 * buildTextBlock, since object field lines never contain a block separator/
 * tree/table): one row per visible member, width = widest row + 2*marginX
 * (+ {@link OBJECT_SMALL_ICON} once, when any row has an explicit visibility
 * char — `MethodsOrFieldsArea#hasSmallIcon`), height = sum(rowHeights) +
 * 2*marginY. Every row's TEXT indent shifts by the same icon reserve when
 * `hasIcon` is true, even for a row with no modifier of its own — upstream's
 * `PlacementStrategyVisibility` reserves that column uniformly across the
 * whole block (a modifier-less row just draws nothing in it,
 * `getUBlock(null, ...)`). Falls back to the empty-fields placeholder / a
 * zero box per BodierLikeClassOrObject#getBody's OBJECT branch (see file doc
 * for the exact showFields/hasMembers matrix).
 *
 * G3/O1: each row's baseline is `OBJECT_FIELD_MARGIN_Y + i*fontSize +
 * baselineOffset` (the SAME "ascent-from-row-top" convention as
 * {@link headerRows}, one row-height stride per index `i`) -- NOT the
 * pre-O1 half-height guess (`i*fontSize + fontSize/2`), which only
 * coincided with jar for a font with zero descent (never, for real text).
 * Every row also carries its OWN `javaRound4`'d raw text width for
 * `textLength` -- jar-verified against figeze-77-fozi735's "user"
 * (`name = "Dummy"` -> 101.4125, `id = 123` -> 42.525, visibly DIFFERENT
 * per-row values, ruling out a shared-block-width hypothesis) and
 * nukera-08-dige359's p1 (4 identical-text visibility-icon rows, baseline
 * stride unperturbed by the icon reserve).
 */
function measureObjectFields(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  showFields: boolean,
): FieldsResult {
  const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
  if (!showFields) return { dim: { width: 0, height: 0 }, rows: [] };
  if (visibleMembers.length === 0) return { dim: OBJECT_EMPTY_FIELDS, rows: [] };

  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const texts = visibleMembers.map(formatObjectMemberText);
  const widths = texts.map((t) => measurer.measure(t, fontSpec).width);
  const hasIcon = visibleMembers.some((m) => m.visibilityExplicit === true);
  const iconReserve = hasIcon ? OBJECT_SMALL_ICON : 0;
  const textIndent = OBJECT_FIELD_MARGIN_X + iconReserve;
  const width = Math.max(...widths) + iconReserve + OBJECT_FIELD_MARGIN_X * 2;
  const height = visibleMembers.length * theme.fontSize + OBJECT_FIELD_MARGIN_Y * 2;
  const baselineOffset = baselineOffsetFor(fontSpec, measurer);
  const rows = texts.map((t, i) => ({
    text: t,
    y: OBJECT_FIELD_MARGIN_Y + i * theme.fontSize + baselineOffset,
    indent: textIndent,
    width: javaRound4(widths[i]!),
    ...(visibleMembers[i]!.visibilityExplicit === true
      ? { visibilityIcon: visibleMembers[i]!.visibility }
      : {}),
  }));
  return { dim: { width, height }, rows };
}

/**
 * Measure an `object` leaf (EntityImageObject#calculateDimensionSlow).
 *
 * @param suppressMemberSection - mapped to upstream's `showFields == false`
 *   (the "hide members" / "hide empty members" directives, same flag
 *   `measureClassifier` already threads through for every other kind).
 */
export function measureObjectClassifier(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  suppressMemberSection: boolean,
): MeasuredClassifier {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const nameM = measurer.measure(classifier.display, fontSpec);
  const nameDim: Dim = {
    width: nameM.width + OBJECT_NAME_PADDING * 2,
    height: nameM.height + OBJECT_NAME_PADDING * 2,
  };
  const stereoDim = measureStereo(classifier, theme, measurer);
  const title = titleDimension(nameDim, stereoDim);

  const showFields = !suppressMemberSection;
  const { dim: fieldsDim, rows: fieldRows } = measureObjectFields(classifier, theme, measurer, showFields);
  const fieldsHeight = methodOrFieldHeight(fieldsDim.height, showFields);

  const width = Math.max(fieldsDim.width, title.width + OBJECT_X_MARGIN_CIRCLE * 2);
  const height = title.height + fieldsHeight;

  const rows = headerRows(classifier, theme, measurer, width, OBJECT_NAME_PADDING);
  for (const r of fieldRows) rows.push({ ...r, y: title.height + r.y });

  // TextBlockLineBefore always draws its separator when reached — i.e.
  // whenever showFields is true, regardless of whether there are visible
  // members (the empty-fields placeholder is ALSO wrapped in one).
  return { width, height, rows, dividerYs: showFields ? [title.height] : [] };
}
