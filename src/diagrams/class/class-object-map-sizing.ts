/**
 * Object/map classifier sizing — `kind:'object'` and `kind:'map'` leaves in
 * the class diagram layout engine (./layout.ts). Split into its own module
 * (mirrors class-lollipop.ts / class-magma.ts's precedent for a synthesising
 * helper) to keep class-layout-helpers.ts under the repo's 500-line-per-file
 * cap and every function under the CCN/NLOC caps.
 *
 * Faithful port of the dimension math:
 *   @see ~/git/plantuml/.../svek/image/EntityImageObject.java
 *   @see ~/git/plantuml/.../svek/image/EntityImageMap.java
 *   @see ~/git/plantuml/.../cucadiagram/TextBlockMap.java
 *   @see ~/git/plantuml/.../cucadiagram/MethodsOrFieldsArea.java (asBlockMemberImpl)
 *   @see ~/git/plantuml/.../cucadiagram/BodierLikeClassOrObject.java (getBody, OBJECT branch)
 *   @see ~/git/plantuml/.../klimt/font/FontParam.java (OBJECT_STEREOTYPE = size 12, italic)
 *
 * Verified byte-for-byte (WidthTableMeasurer, matching the jar's
 * `-DPLANTUML_DETERMINISTIC_TEXT=true` svek DOT dump) against:
 *   - test-results/dot-cache/object/beleso-08-ruca459 — plain object, no
 *     stereotype/fields (dimTitle only, both nodes).
 *   - test-results/dot-cache/object/figeze-77-fozi735 — object with 2 fields,
 *     no stereotype (field-area width/height formula).
 *   - test-results/dot-cache/object/majake-62-pero492 — object with/without 1
 *     stereotype + 1 field (stereo line HEIGHT only — no fixture in the
 *     corpus has a stereo-dominant WIDTH, so the guillemet-wrapped stereo
 *     WIDTH formula below is a faithful port but numerically unverified).
 *   - test-results/dot-cache/object/bepafe-03-teda035 — map, 3 plain rows,
 *     no stereotype (full TextBlockMap width/height formula, exact match).
 *   - oracle/goldens/object/nukera-08-dige359 — object with 4 raw (non-
 *     structured) member lines, each carrying a distinct explicit visibility
 *     char (-#~+) — verifies {@link OBJECT_SMALL_ICON}'s fixed per-block icon
 *     reserve (p1: 133.7125 x 82.0 px exact).
 * See this task's mission-brief return for the worked numbers.
 *
 * `titleDimension`/`measureStereo`/`headerRows` are exported — EntityImageJson
 * shares the SAME header formula as EntityImageObject/EntityImageMap (name
 * margin 2,2 + optional italic stereotype line, both centered and stacked),
 * so class-json-sizing.ts (mission object-dot-sync Phase L) reuses them
 * rather than duplicating the header math a third time.
 */

import type { Classifier, Member, MapRow } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { ClassifierGeo } from './layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';

// ---------------------------------------------------------------------------
// Shared object/map header sizing (name + optional stereotype, stacked)
// ---------------------------------------------------------------------------

/** FontParam.OBJECT_STEREOTYPE's hardcoded size (12, italic) — shared by
 *  EntityImageObject and EntityImageMap; independent of theme.fontSize. */
const STEREO_FONT_SIZE = 12;

/** Guillemet.GUILLEMET (`«`/`»`) — upstream's default wrapping when
 *  no `skinparam guillemet` override is configured. */
function wrapGuillemet(label: string): string {
  return `«${label}»`;
}

interface Dim {
  width: number;
  height: number;
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
 * `MAP_NAME_MARGIN`, `class-json-sizing.ts`'s `JSON_NAME_MARGIN` --
 * all `2`, per each file's own doc-comment precedent for NOT sharing a
 * single named constant across files for a coincidental numeric match).
 *
 * OUT OF SCOPE for this fix (named, not silently dropped): the SAME
 * missing-`width`/wrong-baseline pattern also affects object FIELD rows
 * (`measureObjectFields`), map DATA rows (`buildMapRowGeo`), and json entry
 * rows (`class-json-sizing.ts#buildJsonRows`) -- a related but functionally
 * separate mechanism (different padding constants, variable per-row
 * heights for map/json), deferred to a dedicated O1+ iteration rather than
 * folded into this header-only fix (see `plans/g3-object-svg/ledger.md`).
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
  const rows = texts.map((t, i) => ({
    text: t,
    y: i * theme.fontSize + theme.fontSize / 2,
    indent: textIndent,
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

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

/** EntityImageMap: `withMargin(name, 2, 2)` — fixed, not style-driven
 *  (unlike object's Padding-based name margin, which happens to share the
 *  same numeric value). */
const MAP_NAME_MARGIN = 2;
/** TextBlockMap#getTextBlock: `withMargin(result, 5, 2)` per key/value cell. */
export const MAP_CELL_MARGIN_X = 5;
const MAP_CELL_MARGIN_Y = 2;
/** TextBlockMap.Point#getDiameter — the linked-row value-cell placeholder;
 *  never actually drawn (see buildMapRowGeo doc), only sized. */
const MAP_POINT_DIAMETER = 7;
/** EntityImageMap.xMarginCircle. */
const MAP_X_MARGIN_CIRCLE = 5;

interface MapRowMetrics {
  keyWidth: number;
  valueWidth: number;
  height: number;
  /** A `key *-> dest` linked row (or an unresolved one) — value == '' is
   *  this AST's placeholder for TextBlockMap's Point sentinel (ast.ts
   *  MapRow doc). */
  isPoint: boolean;
}

/** One TextBlockMap row: getHeightOfRow = max(key, value) cell height; each
 *  cell (key always, value only for a non-point row) gets the 5,2 margin;
 *  a point row's value cell is the 7x7 Point diameter instead. */
function measureMapRow(row: MapRow, fontSpec: { family: string; size: number }, measurer: StringMeasurer): MapRowMetrics {
  const keyM = measurer.measure(row.key, fontSpec);
  const keyDim: Dim = { width: keyM.width + MAP_CELL_MARGIN_X * 2, height: keyM.height + MAP_CELL_MARGIN_Y * 2 };
  const isPoint = row.value === '';
  if (isPoint) {
    return { keyWidth: keyDim.width, valueWidth: MAP_POINT_DIAMETER, height: Math.max(keyDim.height, MAP_POINT_DIAMETER), isPoint };
  }
  const valueM = measurer.measure(row.value, fontSpec);
  const valueDim: Dim = { width: valueM.width + MAP_CELL_MARGIN_X * 2, height: valueM.height + MAP_CELL_MARGIN_Y * 2 };
  return { keyWidth: keyDim.width, valueWidth: valueDim.width, height: Math.max(keyDim.height, valueDim.height), isPoint };
}

/**
 * Build the per-row rendering rows[] + dividerYs[] for the map's data rows.
 *
 * Every row contributes exactly TWO rows[] entries (key, value) so the
 * renderer can reconstruct row/column geometry from rows[] + dividerYs alone
 * (no ClassifierGeo schema change needed — layout.ts is at the project's
 * 500-line cap). A point row's "value" entry carries empty text: the
 * renderer skips drawing it (TextBlockMap#drawU never calls `value.drawU`
 * for a Point cell — only the key, left-aligned same as any other row) and
 * skips that row's vertical column divider.
 */
function buildMapRowGeo(
  rows: readonly MapRow[],
  metrics: readonly MapRowMetrics[],
  titleHeight: number,
  colAWidth: number,
): { rows: ClassifierGeo['rows']; dividerYs: number[] } {
  const outRows: ClassifierGeo['rows'] = [];
  const dividerYs: number[] = [];
  let y = titleHeight;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const m = metrics[i]!;
    dividerYs.push(y);
    const midY = y + m.height / 2;
    outRows.push({ text: row.key, y: midY, indent: MAP_CELL_MARGIN_X });
    outRows.push({ text: m.isPoint ? '' : row.value, y: midY, indent: colAWidth + MAP_CELL_MARGIN_X });
    y += m.height;
  }
  return { rows: outRows, dividerYs };
}

/**
 * Measure a `map` leaf (EntityImageMap#calculateDimensionSlow +
 * TextBlockMap#calculateDimensionSlow). Unlike object, `showFields` is
 * irrelevant here — `BodierMap#getBody` ignores its showFields parameter
 * entirely and always returns the full row table (`hide members` / `hide
 * empty members` have no effect on a map's body, matching upstream).
 */
export function measureMapClassifier(classifier: Classifier, theme: Theme, measurer: StringMeasurer): MeasuredClassifier {
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const nameM = measurer.measure(classifier.display, fontSpec);
  const nameDim: Dim = { width: nameM.width + MAP_NAME_MARGIN * 2, height: nameM.height + MAP_NAME_MARGIN * 2 };
  const stereoDim = measureStereo(classifier, theme, measurer);
  const title = titleDimension(nameDim, stereoDim);

  const rows = classifier.rows ?? [];
  const metrics = rows.map((r) => measureMapRow(r, fontSpec, measurer));
  const colA = metrics.length === 0 ? 0 : Math.max(...metrics.map((m) => m.keyWidth));
  const colB = metrics.length === 0 ? 0 : Math.max(...metrics.map((m) => m.valueWidth));
  const fieldsHeight = metrics.reduce((sum, m) => sum + m.height, 0);

  const width = Math.max(colA + colB, title.width + MAP_X_MARGIN_CIRCLE * 2);
  // getMethodOrFieldHeight's empty-substitution never fires for MAP
  // (leafType === MAP is excluded in the upstream condition) — height is
  // titleHeight + the raw (possibly zero, for an empty map body) fields height.
  const height = title.height + fieldsHeight;

  const headerGeo = headerRows(classifier, theme, measurer, width, MAP_NAME_MARGIN);
  const { rows: rowGeo, dividerYs } = buildMapRowGeo(rows, metrics, title.height, colA);

  return { width, height, rows: [...headerGeo, ...rowGeo], dividerYs };
}
