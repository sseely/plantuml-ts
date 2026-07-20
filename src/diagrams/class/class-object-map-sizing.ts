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
import type { SpriteRegistry } from '../../core/sprite-commands.js';
import type { ClassifierGeo } from './layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';
import { splitStereotypeLabels, measureStereoLabelWidths } from './class-stereotype.js';
import { isEnhancedBody } from './class-body-enhanced.js';
import { measureEnhancedBody } from './class-body-enhanced-layout.js';

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

/**
 * G3/O4: `AtomText#getTabSize`/`tabString` -- the pixel width of ONE tab
 * stop, matching upstream's own quirky clamp: a configured `skinparam
 * tabSize N` in [1,6] uses N literal spaces; ANY other value (including
 * the upstream default 8, and `skinparam tabSize 20`) falls back to a
 * HARDCODED 8-space string regardless of N (`AtomText.java:258-264`'s own
 * `nb >= 1 && nb < 7` gate -- a genuine upstream quirk, ported faithfully
 * per this project's "port the awkward code too" discipline). When that
 * string measures to width 0 (`DeterministicMeasurer`'s width table has no
 * entry for the space glyph -- jar-verified), the tab stop becomes
 * `fontSize * 4` instead (`AtomText.java:272-274`'s own `width == 0`
 * fallback) -- jar-verified against `nufoju-44-dabi767` (`skinparam
 * tabSize 20`, 14pt font -> tab stop 56 = 14*4, NOT a function of the
 * configured `20` at all).
 */
function tabStopWidthPx(theme: Theme, measurer: StringMeasurer): number {
  const nb = theme.tabSize ?? 8;
  const spaces = nb >= 1 && nb < 7 ? ' '.repeat(nb) : '        ';
  const width = measurer.measure(spaces, { family: theme.fontFamily, size: theme.fontSize }).width;
  return width === 0 ? theme.fontSize * 4 : width;
}

/** One drawn text run within a tab-expanded line -- {@link layoutTabRuns}. */
interface TabRun {
  text: string;
  x: number;
  width: number;
}

/**
 * G3/O4: `AtomText#drawU`/`getWidth` -- splits a member line containing
 * literal `\t` characters into independently-positioned text runs. Jar
 * draws ONE `<text>` per non-tab token, advancing `x` by each token's own
 * measured width; a tab TOKEN instead jumps `x` to the next tab-stop
 * boundary (`x += tabStopPx - (x % tabStopPx)`) and draws nothing.
 * `totalWidth` is the final cursor position after every token -- the value
 * jar's OWN `getWidth()` uses for the line's box-sizing contribution
 * (`AtomText.java:241-256`, the SAME tokenize-and-jump algorithm as
 * `drawU`, not a naive whole-string measurement). A tab-free line degrades
 * to the pre-O4 shape exactly: one run at `x:0`, `totalWidth ===
 * run.width` -- zero behavior change for the common no-tab case.
 */
function layoutTabRuns(
  text: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
  tabStopPx: number,
): { runs: TabRun[]; totalWidth: number } {
  const tokens = text.split(/(\t)/).filter((t) => t.length > 0);
  let x = 0;
  const runs: TabRun[] = [];
  for (const token of tokens) {
    if (token === '\t') {
      const remainder = x % tabStopPx;
      x += tabStopPx - remainder;
      continue;
    }
    const runWidth = measurer.measure(token, fontSpec).width;
    runs.push({ text: token, x, width: runWidth });
    x += runWidth;
  }
  return { runs, totalWidth: x };
}

/** EntityImageObject/Map#getNameAndSteretypeDimension: width = max of the two
 *  (both already margin-padded by the caller), height = sum (stacked). */
export function titleDimension(nameDim: Dim, stereoDim: Dim): Dim {
  return { width: Math.max(nameDim.width, stereoDim.width), height: nameDim.height + stereoDim.height };
}

/**
 * The (un-padded) stacked stereotype BLOCK dimension, zero when absent --
 * mirrors upstream's `stereoDim = new XDimension2D(0, 0)` fallback. No
 * margin is applied to the stereo TextBlock in either EntityImageObject or
 * EntityImageMap (unlike the name block, which gets a style/fixed margin).
 *
 * G3/O2: `classifier.stereotype` carries the RAW, possibly multi-bracket
 * blob the parser's own greedy-regex-collision quirk captures for stacked
 * stereotypes (`object X <<Bar>> <<Foo>>` -> `"Bar>> <<Foo"`,
 * `class-object-stacked-stereo.test.ts`'s own doc comment) -- split via
 * {@link splitStereotypeLabels} (the SAME helper `class-stereotype.ts
 * #buildStereoRows` already uses for CLASS) into one label per stacked
 * line: width = the WIDEST individual label (each line centers against
 * boxWidth independently, {@link headerRows} below), height = `labels.length
 * * STEREO_FONT_SIZE` (one stacked line per label, `Stereotype#getLabels()`'s
 * own shape) -- jar-verified `fafozi-27-reja300`'s node2 (`<<Bar>> <<Foo>>`,
 * no fields): box height 58 = stereoHeight(24, 2 lines) + nameHeight(18) +
 * fieldsHeight(16, OBJECT_EMPTY_FIELDS).
 */
export function measureStereo(classifier: Classifier, theme: Theme, measurer: StringMeasurer): Dim {
  // G3/O4: `hide <object|...> stereotypes` (`EntityPortion.STEREOTYPE`,
  // `CucaDiagram#showPortion`) -- object/map/json ONLY consult this flag
  // (`ast.ts#Classifier.hideStereotype`'s own doc comment); jar-verified
  // `kocupi-02-ripa662`.
  if (classifier.stereotype === undefined || classifier.hideStereotype === true) return { width: 0, height: 0 };
  const labels = splitStereotypeLabels(classifier.stereotype);
  if (labels.length === 0) return { width: 0, height: 0 };
  const widths = measureStereoLabelWidths(labels, theme.fontFamily, measurer, undefined, STEREO_FONT_SIZE);
  return { width: Math.max(...widths), height: labels.length * STEREO_FONT_SIZE };
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
/**
 * G3/O4: `Display#underlinedName`'s split pattern (`Display.java:468`) --
 * matches ONLY up to the FIRST colon: group1 excludes ':' entirely (so it
 * can only end right before the first colon encountered), group2's `\s*`
 * backtracks to absorb any trailing whitespace group1 would otherwise
 * capture. `null` when the display has no colon at all (the whole-name-
 * underlined case, `firstObject` in `jotaga-99-fatu830`).
 */
const INSTANCE_NAME_TYPE_PATTERN = /^([^:]+?)(\s*:.+)$/;

/**
 * G3/O4: `EntityImageObject#getUnderlinedName` -- `skinparam style
 * strictuml`'s UML instance-notation convention. No colon: the WHOLE name
 * draws underlined, one row. With a colon: the name splits into TWO
 * ADJACENT runs sharing the SAME row `y` -- the name portion (underlined)
 * at `indent`, the `: type` portion (plain, LEADING whitespace stripped --
 * jar's own rendered `<text>` never carries it, `jotaga-99-fatu830`'s own
 * `": type"` citation) immediately following at `indent + nameRawWidth`
 * (raw, unrounded -- matches this file's own "round once for textLength,
 * reuse raw for position math" convention, `headerRows`'s own stereo-row
 * precedent). `indent` is the CALLER's already-centered offset for the
 * COMBINED block (both runs together occupy the same span the un-split
 * name would have) -- jar-verified `jotaga-99-fatu830`'s `o2`: full-name
 * width 117.425 == "instance name" (87.15) + " : type" (30.275) exactly,
 * so splitting never perturbs the block's own centering math.
 */
function buildUnderlinedNameRows(
  display: string,
  y: number,
  indent: number,
  nameFontSpec: FontSpec,
  measurer: StringMeasurer,
  // G3/O4: `<style> object { header { FontSize N } } }` -- `fcHeader`'s
  // OWN FontConfiguration wraps the WHOLE underlined-name TextBlock
  // (`EntityImageObject.java:98`, `getUnderlinedName(entity).create(fcHeader,
  // ...)`), so BOTH split runs (name + type suffix) carry the SAME override
  // when set -- unverified in combination (no corpus fixture combines
  // strictuml + header FontSize), but the most defensible reading of the
  // single-FontConfiguration construction above.
  fontSizeOverride?: number,
): ClassifierGeo['rows'] {
  const fontSizeField = fontSizeOverride !== undefined ? { fontSize: fontSizeOverride } : {};
  const match = INSTANCE_NAME_TYPE_PATTERN.exec(display);
  if (match === null) {
    return [
      {
        text: display, y, indent,
        width: javaRound4(measurer.measure(display, nameFontSpec).width),
        underline: true,
        ...fontSizeField,
      },
    ];
  }
  const namePart = match[1]!;
  const typePart = match[2]!.replace(/^\s+/, '');
  const nameRawWidth = measurer.measure(namePart, nameFontSpec).width;
  const typeRawWidth = measurer.measure(typePart, nameFontSpec).width;
  return [
    { text: namePart, y, indent, width: javaRound4(nameRawWidth), underline: true, ...fontSizeField },
    { text: typePart, y, indent: indent + nameRawWidth, width: javaRound4(typeRawWidth), ...fontSizeField },
  ];
}

export function headerRows(
  classifier: Classifier,
  theme: Theme,
  measurer: StringMeasurer,
  boxWidth: number,
  namePadding: number,
  // G3/O4: `skinparam style strictuml` -- OBJECT kind only (`class-object-
  // map-sizing.ts#buildUnderlinedNameRows`'s own doc comment); map/json
  // callers never pass `true` (`EntityImageMap`/`Json` never call
  // `underlinedName()`, jar-verified).
  underlineName = false,
  // G3/O4: `<style> <sname> { header { FontSize N } } }` -- the CALLER
  // resolves this (it also feeds `nameDim`/`title.width`, upstream of this
  // function's own `boxWidth` parameter -- `measureObjectClassifier`'s own
  // doc comment) and passes it through so the name row's OWN width/baseline
  // use the SAME size the caller already measured with, rather than
  // re-deriving it here.
  nameFontSizeOverride?: number,
): ClassifierGeo['rows'] {
  const rows: ClassifierGeo['rows'] = [];
  const nameFontSpec = { family: theme.fontFamily, size: nameFontSizeOverride ?? theme.fontSize };
  const stereoFontSpec = { family: theme.fontFamily, size: STEREO_FONT_SIZE };
  // G3/O2: one stacked line PER label (`Stereotype#getLabels()` shape) --
  // see `measureStereo`'s own doc comment for the split mechanism and the
  // `fafozi-27-reja300` jar citation. Each line centers against `boxWidth`
  // independently using its OWN raw width (not a shared block width) --
  // `getDescent` is content-independent (every `StringMeasurer`
  // implementation, `baselineOffsetFor`'s own doc comment), so the
  // baseline offset is computed once and reused per stacked line.
  // G3/O4: `hide <kind> stereotypes` -- {@link measureStereo}'s own doc
  // comment; suppresses every stacked label line identically to "no
  // stereotype at all" for header-row PURPOSES (the raw `classifier
  // .stereotype` string itself is untouched -- only rendering skips it).
  const stereoLabels =
    classifier.stereotype === undefined || classifier.hideStereotype === true
      ? []
      : splitStereotypeLabels(classifier.stereotype);
  const stereoWidths = measureStereoLabelWidths(stereoLabels, theme.fontFamily, measurer, undefined, STEREO_FONT_SIZE);
  const stereoBaselineOffset = STEREO_FONT_SIZE - measurer.getDescent(stereoFontSpec, '');
  stereoLabels.forEach((label, i) => {
    const width = stereoWidths[i]!;
    rows.push({
      text: wrapGuillemet(label),
      y: i * STEREO_FONT_SIZE + stereoBaselineOffset,
      indent: (boxWidth - width) / 2,
      italic: true,
      width,
      fontSize: STEREO_FONT_SIZE,
    });
  });
  const stereoHeight = stereoLabels.length * STEREO_FONT_SIZE;
  const nameWidth = javaRound4(measurer.measure(classifier.display, nameFontSpec).width);
  const nameBaseline = nameFontSpec.size - measurer.getDescent(nameFontSpec, classifier.display);
  const nameY = stereoHeight + namePadding + nameBaseline;
  const nameIndent = (boxWidth - nameWidth) / 2;
  if (underlineName) {
    rows.push(
      ...buildUnderlinedNameRows(classifier.display, nameY, nameIndent, nameFontSpec, measurer, nameFontSizeOverride),
    );
  } else {
    rows.push({
      text: classifier.display, y: nameY, indent: nameIndent, width: nameWidth,
      ...(nameFontSizeOverride !== undefined ? { fontSize: nameFontSizeOverride } : {}),
    });
  }
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
 *  row text directly.
 *
 *  G3/O4: a literal `\t` (backslash + 't', TWO source chars -- `skinparam
 *  tabSize`'s own trigger, `nufoju-44-dabi767`) is unescaped to a REAL tab
 *  byte (U+0009) here, mirroring `Display.getWithNewlines`'s own `c2 ==
 *  't'` branch (`Display.java:302-304`, `current.append('\t')`) -- the
 *  GENERIC backslash-escape site every Display-backed text line (title/
 *  caption/legend/member) routes through upstream. Scoped to ONLY the `\t`
 *  escape (not the full `\n`/`\r`/`\l`/`\\` family Display.java also
 *  handles) -- no corpus object-field fixture exercises the others, and
 *  `\n` specifically has NO meaning inside a single already-newline-split
 *  field line. `layoutTabRuns` (below) consumes the resulting real tab
 *  byte via `AtomText#drawU`'s own tokenizer shape. */
export function formatObjectMemberText(member: Pick<Member, 'name' | 'type' | 'rawDisplay'>): string {
  const raw =
    member.rawDisplay !== undefined
      ? member.rawDisplay
      : member.type !== undefined
        ? `${member.name} = ${member.type}`
        : member.name;
  return raw.includes('\\t') ? raw.replace(/\\t/g, '\t') : raw;
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
  // G3/O4: `\t` characters (`skinparam tabSize`) split a line into
  // multiple independently-positioned text runs -- see `layoutTabRuns`'s
  // own doc comment. `tabStopWidthPx` is computed once per block (font-
  // dependent only, not per-row).
  const tabStopPx = tabStopWidthPx(theme, measurer);
  const layouts = texts.map((t) => layoutTabRuns(t, fontSpec, measurer, tabStopPx));
  const widths = layouts.map((l) => l.totalWidth);
  const hasIcon = visibleMembers.some((m) => m.visibilityExplicit === true);
  const iconReserve = hasIcon ? OBJECT_SMALL_ICON : 0;
  const textIndent = OBJECT_FIELD_MARGIN_X + iconReserve;
  const width = Math.max(...widths) + iconReserve + OBJECT_FIELD_MARGIN_X * 2;
  const height = visibleMembers.length * theme.fontSize + OBJECT_FIELD_MARGIN_Y * 2;
  const baselineOffset = baselineOffsetFor(fontSpec, measurer);
  const rows: ClassifierGeo['rows'] = [];
  layouts.forEach((layout, i) => {
    const y = OBJECT_FIELD_MARGIN_Y + i * theme.fontSize + baselineOffset;
    layout.runs.forEach((run, runIndex) => {
      rows.push({
        text: run.text,
        y,
        indent: textIndent + run.x,
        width: javaRound4(run.width),
        // G3/O4: `visibilityIsField: true` UNCONDITIONALLY -- upstream's
        // `BodierLikeClassOrObject#getFieldsToDisplay` OBJECT branch
        // constructs EVERY member via `Member.field(s)` (never `Member
        // .method(s)`, regardless of the text looking method-like, e.g.
        // `getName()`), so `MethodsOrFieldsArea`'s own icon-fill derivation
        // (`modifier.isField()`, baked in at Member-construction time, NOT
        // a dynamic per-row check) is ALWAYS true for an object field --
        // `class-visibility-icon.ts#isFilled`'s own `!memberIsField` rule
        // therefore ALWAYS resolves to stroke-only (`fill="none"`) for
        // object rows, regardless of the visibility char -- jar-verified
        // `xuvesu-44-laru205` (`+`/`-` icons both `fill="none"`, `PUBLIC_
        // FIELD`/`PRIVATE_FIELD` data-attributes, never `_METHOD`). Absent
        // pre-O4, `row.visibilityIsField === true` evaluated false for
        // every object row, incorrectly filling `+` icons like a method.
        ...(runIndex === 0 && visibleMembers[i]!.visibilityExplicit === true
          ? { visibilityIcon: visibleMembers[i]!.visibility, visibilityIsField: true as const }
          : {}),
      });
    });
  });
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
  // G3/O4: threaded through to `measureEnhancedBody`'s `EnhancedLayoutCtx`
  // (an enhanced-body member row may carry a `<$sprite>`/img atom, same as
  // class's own wiring, `class-layout-helpers.ts#measureClassifier`'s own
  // call site) -- absent for every hand-built test geometry that bypasses
  // `measureClassifier` (zero behavior change, `buildMemberRow`'s own
  // `sprites?: SpriteRegistry` optionality).
  sprites?: SpriteRegistry,
): MeasuredClassifier {
  // G3/O4: `<style> object { header { FontSize N } } }` -- resolved HERE
  // (not inside `headerRows`) because it feeds `nameDim`/`title.width`,
  // upstream of the box's own final `width` -- `headerRows`'s own
  // `nameFontSizeOverride` doc comment.
  const nameFontSizeOverride = theme.colors.elements?.['object']?.headerFontSize;
  const nameFontSpec = { family: theme.fontFamily, size: nameFontSizeOverride ?? theme.fontSize };
  const nameM = measurer.measure(classifier.display, nameFontSpec);
  const nameDim: Dim = {
    width: nameM.width + OBJECT_NAME_PADDING * 2,
    height: nameM.height + OBJECT_NAME_PADDING * 2,
  };
  const stereoDim = measureStereo(classifier, theme, measurer);
  const title = titleDimension(nameDim, stereoDim);

  const showFields = !suppressMemberSection;

  // G3/O4: `BodierLikeClassOrObject#getBody`'s OBJECT branch ALWAYS routes
  // through `BodyFactory.create1` (`BodyEnhanced1`) when `showFields` --
  // the SAME renderer class uses ONLY when a separator/tree-list trigger
  // is present (`class-layout-helpers.ts`'s own `enhancedBody` doc
  // comment) -- see `ast.ts#Classifier.rawBodyLines`'s own G3/O4 doc
  // comment for why gating on `isEnhancedBody` (rather than always
  // routing through this engine, matching jar's literal structure) is
  // safe: the plain-content case is numerically IDENTICAL either way
  // (this port's own `measureObjectFields` was independently jar-derived
  // and verified against it since O0/O1), so gating avoids regressing the
  // already-verified common case while adding ONLY the separator/tree
  // capability. `fontSpec` here is the FIELD font (theme default) -- the
  // header override above is name-row-only, unrelated.
  const fontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const enhancedBody =
    isEnhancedBody(classifier.rawBodyLines) && showFields
      ? measureEnhancedBody(classifier.rawBodyLines!, {
          fontSpec, measurer, sprites, baselineOffset: baselineOffsetFor(fontSpec, measurer), bodyTop: title.height,
        })
      : undefined;

  if (enhancedBody !== undefined) {
    const width = Math.max(enhancedBody.width, title.width + OBJECT_X_MARGIN_CIRCLE * 2);
    const patchedHeaderRows = headerRows(
      classifier, theme, measurer, width, OBJECT_NAME_PADDING, theme.strictUml === true, nameFontSizeOverride,
    );
    return {
      width, height: title.height + enhancedBody.height, rows: patchedHeaderRows,
      dividerYs: [title.height], enhancedBody,
    };
  }

  const { dim: fieldsDim, rows: fieldRows } = measureObjectFields(classifier, theme, measurer, showFields);
  const fieldsHeight = methodOrFieldHeight(fieldsDim.height, showFields);

  const width = Math.max(fieldsDim.width, title.width + OBJECT_X_MARGIN_CIRCLE * 2);
  const height = title.height + fieldsHeight;

  const rows = headerRows(
    classifier, theme, measurer, width, OBJECT_NAME_PADDING, theme.strictUml === true, nameFontSizeOverride,
  );
  for (const r of fieldRows) rows.push({ ...r, y: title.height + r.y });

  // TextBlockLineBefore always draws its separator when reached — i.e.
  // whenever showFields is true, regardless of whether there are visible
  // members (the empty-fields placeholder is ALSO wrapped in one).
  return { width, height, rows, dividerYs: showFields ? [title.height] : [] };
}
