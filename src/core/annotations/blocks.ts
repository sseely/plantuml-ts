/**
 * blocks.ts — mission G0b / T4: the drawable half of `Style
 * .createTextBlockBordered` (`style/Style.java:315-332`) +
 * `TextBlockBordered` (`klimt/shape/TextBlockBordered.java`) +
 * `TextBlockMarged` (`klimt/shape/TextBlockMarged.java`, applied via
 * `TextBlockUtils.withMargin`). `DisplayPositioned#createRibbon`
 * (header/footer) delegates straight into `Style.createTextBlockBordered`
 * whenever a non-null `Style` is supplied (verified —
 * `abel/DisplayPositioned.java:118-128`), which is always the case from
 * `DiagramChromeFactory`, so header/footer/title/caption/legend all share
 * this ONE geometry: padding insets the text, a border/background rect is
 * drawn at the padded size (+1 on each axis for the block's REPORTED
 * dimension only — the drawn rect stays at the un-plus-oned size, jar-
 * verified below), then margin wraps that OUTSIDE the border.
 *
 * `kind` is accepted per the T4 interface contract (buildAnnotationBlock's
 * mandated first parameter) but not branched on internally — all five
 * elements share identical box geometry; only their `AnnotationBoxStyle`
 * (T2's `resolveAnnotationStyles`) differs. Kept for call-site consistency
 * and as a forward-compatible hook, should a later diagram type (D10:
 * json/dot/chart) need a per-kind rendering nuance this shared box does
 * not yet have.
 *
 * Text-rendering path (journaled per the T4 task spec, "reuse the klimt
 * text path if it can emit a fragment; otherwise core/svg.ts primitives"):
 * `src/diagrams/description/renderer.ts`'s klimt path
 * (`buildTextBlock` → `TextBlock` → `UGraphicSvg.build(...).getSvgString()`)
 * produces a COMPLETE standalone `<svg>` document tied to its own
 * `SvgOption`/preamble/coordinate space — there is no fragment-extraction
 * seam, and building one would mean parsing back out of a full document
 * (exactly the "invasive" klimt extraction decisions.md D2 defers to T7,
 * scoped to the description engine's OWN plugin). Every OTHER plugin this
 * chrome module must serve (sequence/class/state/json/dot/chart) already
 * emits `RenderFragment.body` through `core/svg.ts` primitives, not klimt
 * — so building chrome atop the same primitive layer is the only path
 * every plugin can share uniformly, which is the entire point of a SHARED
 * chrome module (decisions.md D1). `src/core/creole.ts#parseCreole` IS
 * reused for inline bold/italic/underline/strikethrough/color markup — see
 * {@link measureLines} and {@link drawLine} below.
 *
 * G2 N45: `drawLine` used to hand every line's spans to `creole.ts
 * #spansToTspan` (one `<text>` wrapping one `<tspan>` per span) with raw,
 * un-normalized style literals (`font-family="SansSerif"`,
 * `fill="black"`, `font-weight="bold"`). jar's real deterministic-text SVG
 * draws one SIBLING `<text textLength="..." lengthAdjust="spacing">` PER
 * CREOLE RUN — no `<tspan>` at all — with CSS-ready attribute values
 * (`font-family="sans-serif"`, `fill="#000000"`, `font-weight="700"`),
 * exactly the shape `class/renderer-classifier-box.ts#renderRowAtoms`
 * already established for member-row creole runs (jar-verified:
 * `test-results/dot-cache/object/linazi-45-gevo553/in.svg`'s `title
 * **KO** on V1.2020.16` draws TWO sibling `<text>` elements, "KO" and
 * "on V1.2020.16", x-advanced by the first run's own `textLength`). This
 * was a universal, cross-engine gap (every `title`/`header`/`footer`/
 * `caption`/`legend` in every diagram type routes through this ONE
 * function) — 85-153 fixture reach per attribute in the class census alone
 * (`plans/g2-class-svg/ledger.md` N45). Fixed: {@link drawLine} now emits
 * one `core/svg.ts#text()` call per span (reusing that function's own
 * `Paint`-resolution + CSS quote-swap + XML-escaping, matching every other
 * text-emission call site in this codebase — see {@link measureLines}'s
 * doc comment for why per-span vs per-line width is a lossless split).
 *
 * @see ~/git/plantuml/.../style/Style.java:315-332 (createTextBlockBordered)
 * @see ~/git/plantuml/.../klimt/shape/TextBlockBordered.java
 * @see ~/git/plantuml/.../klimt/shape/TextBlockMarged.java
 * @see ~/git/plantuml/.../klimt/drawing/svg/DriverRectangleSvg.java:78 (rx/2 quirk)
 * @see ~/git/plantuml/.../klimt/font/FontStack.java:187 (getSvgFamily — logical->CSS)
 */

import type { AnnotationBoxStyle, AnnotationElement } from './style.js';
import type { FontSpec, StringMeasurer } from '../measurer.js';
import { parseCreole, type CreoleSpan } from '../creole.js';
import { rect, text } from '../svg.js';
import { shiftFragmentBody } from './coord-shift.js';
import type { BoxStyle } from '../svg.js';
import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { javaRound4 } from '../number-format.js';

/** The fragment shape {@link buildAnnotationBlock} returns — width/height
 *  are the block's OWN reported dimension (post padding/border/+1/margin),
 *  matching `TextBlock#calculateDimension`'s contract. */
export interface AnnotationBlock {
  readonly body: string;
  readonly width: number;
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Line-spacing (StringMeasurer, D4, reports only the em-box height — no
// ascent/line-box table of its own, so multi-line leading needs a formula).
// ---------------------------------------------------------------------------

/**
 * G2 N45 DIAGNOSIS CORRECTION: this module used to hardcode a fixed
 * `ASCENT_RATIO`/`LINE_ADVANCE_RATIO` pair (11.6016/12, 14.1328/12),
 * "jar-verified" against a `title A Title / header a header / footer a
 * footer / legend bottom left / This is / my legend / end legend / a->b`
 * fixture. Re-running that EXACT fixture directly against the real oracle
 * jar under `-DPLANTUML_DETERMINISTIC_TEXT=true` (the mode this port's
 * WHOLE conformance/ratchet pipeline measures against, `measurer-
 * deterministic.ts`'s own doc comment) produces DIFFERENT numbers than the
 * ones cited (legend rect y=155 not 164.2422, line-1 baseline=170.8889 not
 * 182.7773) — the original citation was evidently captured under a
 * different jar mode or version, never cross-checked against the
 * deterministic pipeline this port's tests actually run. Two independent
 * fresh, direct jar probes (`header`/`footer` at zero padding/margin,
 * size 10 -> baseline 7.7778; `legend`, size 14 AND size 20 -> line-1
 * baseline delta from block-top 10.8889 / 15.5556) confirm the REAL
 * formula is the SAME "ascent-from-line-top" convention every OTHER text
 * draw in this codebase already uses (`class-layout-helpers.ts
 * #measureGenericClassifier`'s `baselineOffset = fontSize -
 * measurer.getDescent(...)`): `ascent = fontSize - measurer.getDescent(
 * font, '')`, NOT a fixed literal ratio. Both fresh probes exactly match
 * `fontSize - fontSize/4.5` (10-2.2222=7.7778; 14-3.1111=10.8889;
 * 20-4.4444=15.5556) — precisely `WidthTableMeasurer`/`FixedMeasurer
 * .getDescent`'s own `size/4.5` formula (`measurer.ts`), confirming the
 * fix must route through the INJECTED `measurer`, not a new hardcoded
 * constant (the old bug's own shape), so it stays correct for BOTH
 * `DeterministicMeasurer` (conformance) and `jarMeasurer` (production).
 * Line-to-line advance is simply `fontSize` exactly (14, 20 in the two
 * probes) — the SAME `rowHeight = fontSpec.size` convention `class-
 * layout-helpers.ts#measureGenericClassifier`'s member rows already use,
 * not a separate ratio either.
 */
function lineAscent(font: FontSpec, measurer: StringMeasurer): number {
  return font.size - measurer.getDescent(font, '');
}

/** `TextBlockBordered#calculateDimension` reports `width + 1, height + 1`
 *  (TextBlockBordered.java:95-98) but `getPolygonNormal` draws the border
 *  rect at the UN-plus-oned `getTextWidth`/`getTextHeight` (:146-150) — the
 *  block's reported size is always 1px larger, on each axis, than what it
 *  actually paints. Re-verified (G2 N45) against the SAME legend fixture,
 *  read correctly this time: rect 70.725 × 38 == pureTextWidth(60.725)+
 *  padding(10) × pureTextHeight(2*14=28)+padding(10), no +1; the block's
 *  outward dimension (consumed one level up, by `decorateEntityImage` in
 *  chrome.ts) carries the +1. */
const BORDERED_DIMENSION_QUIRK = 1;

/** `DriverRectangleSvg.java:78`: `svg.svgRectangle(x, y, width, height,
 *  rx / 2, ry / 2, ...)` — `TextBlockBordered`'s own `URectangle
 *  .rounded(cornersize)` (TextBlockBordered.java:149) sets rx=ry=cornersize
 *  verbatim, but the SVG emission driver halves it again on the way out.
 *  Jar-verified: `plantuml.skin`'s legend `roundCorner: 15` (style.ts's
 *  `BASE_DEFAULTS.legend.roundCorner`) emits `rx="7.5"` in the oracle's
 *  own SVG, not `rx="15"`. */
const SVG_ROUND_CORNER_DIVISOR = 2;

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

function fontSpecFor(style: AnnotationBoxStyle): FontSpec {
  return {
    family: style.fontFamily,
    size: style.fontSize,
    weight: style.fontStyle === 'bold' ? 'bold' : 'normal',
    style: style.fontStyle === 'italic' ? 'italic' : 'normal',
  };
}

/** One Creole span plus its OWN measured advance width (summed against the
 *  line's shared base {@link FontSpec}, per {@link measureLines}'s doc
 *  comment — every `StringMeasurer` in this codebase sums per-codepoint
 *  advances with no cross-character kerning, so splitting a line's single
 *  whole-string measurement into per-span measurements is lossless: the
 *  sum below is bit-identical to measuring the joined plain text once). */
interface MeasuredSpan {
  readonly span: CreoleSpan;
  readonly width: number;
}

interface MeasuredLine {
  readonly spans: readonly MeasuredSpan[];
  readonly width: number;
}

/** Parses each line's Creole spans (bold/italic/underline/strikethrough/
 *  color) via `parseCreole`, measuring each span against the line's shared
 *  base font — per D4, only the plain (markup-stripped) text is handed to
 *  the injected `StringMeasurer`; the 0.6-heuristic Creole internally uses
 *  for its OWN layout is never consulted, and a span's own bold/italic
 *  never widens its measured advance (matches jar's real per-line, not
 *  per-run, `StringBounder` call for this box's own width/wrap geometry —
 *  only the render-time `<text>` attributes vary per run, see
 *  {@link drawLine}). */
function measureLines(lines: readonly string[], font: FontSpec, measurer: StringMeasurer): MeasuredLine[] {
  return lines.map((line) => {
    const spans = parseCreole(line).map((span) => ({ span, width: measurer.measure(span.text, font).width }));
    const width = spans.reduce((sum, s) => sum + s.width, 0);
    return { spans, width };
  });
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** G2 N50: jar's `TextBlockBordered#drawU` always applies an EXPLICIT
 *  stroke -- `stroke:none` when `lineColor` is `null`, never an omitted
 *  attribute -- with `stroke-width` set to the style's OWN
 *  `lineThickness` (`AnnotationBoxStyle#lineThickness`, `style.ts`'s
 *  `titleBorderThickness`/`legendBorderThickness` skinparam wiring) --
 *  jar-verified `bajula-59-puxi485` (`document { header { BackgroundColor
 *  lightGray } }`, no `LineColor`/`BorderThickness` override: oracle draws
 *  `style="stroke:none;stroke-width:1;"`, the root-default `lineThickness`,
 *  this port omitted both entirely) and `cifeta-62-xodi576`/`medexe-08-
 *  ledo064` (`skinparam Legend/title { BorderThickness N }`: oracle's
 *  `stroke-width` follows the override, not the fixed root default).
 *  `rx`/`ry` are likewise ALWAYS paired when `roundCorner` is non-zero
 *  (`URectangle.rounded` sets both to the SAME halved value) and BOTH
 *  omitted (never a literal `rx="0"`) when it is zero -- a
 *  `RoundRectangle2D` with zero radius degenerates to a plain
 *  `Rectangle2D` upstream, never reaching the rx/ry-emitting branch --
 *  jar-verified the SAME `bajula-59-puxi485` fixture (header, roundCorner 0:
 *  no `rx`/`ry` at all) and `mumefa-23-xoxe715` (legend, roundCorner 15: the
 *  oracle's `ry="7.5"` was missing from this port's rx-only output). Builds
 *  `fill` the same as before (omitted, not `undefined`, when
 *  `backgroundColor` is `null` — required under this project's
 *  `exactOptionalPropertyTypes`). */
function borderBoxStyle(style: AnnotationBoxStyle): BoxStyle {
  const box: BoxStyle = {
    stroke: style.lineColor ?? 'none',
    strokeWidth: style.lineThickness,
  };
  if (style.roundCorner !== 0) {
    const corner = style.roundCorner / SVG_ROUND_CORNER_DIVISOR;
    box.rx = corner;
    box.ry = corner;
  }
  if (style.backgroundColor !== null) box.fill = style.backgroundColor;
  return box;
}

/** Border/background rect at the un-plus-oned padded size (see
 *  {@link BORDERED_DIMENSION_QUIRK}), suppressed when both colors are
 *  `null` (`TextBlockBordered#drawU`: `back.isTransparent() == false ||
 *  color.isTransparent() == false`, collapsed to this port's `string |
 *  null` color model — `null` IS the transparent/absent case). */
function buildBorderRect(style: AnnotationBoxStyle, textWidth: number, textHeight: number): string {
  if (style.backgroundColor === null && style.lineColor === null) return '';
  return rect(0, 0, textWidth, textHeight, borderBoxStyle(style));
}

/** Per-line horizontal alignment INSIDE the block, driven by the style's
 *  own `horizontalAlignment` (the box CONTENT alignment — distinct from
 *  the band-placement alignment `chrome.ts#getTextX` resolves from the
 *  parsed `DisplayPositioned`; see batch-1 reconciliation notes). */
function alignLineX(lineWidth: number, blockTextWidth: number, halign: HorizontalAlignment): number {
  if (halign === HorizontalAlignment.CENTER) return (blockTextWidth - lineWidth) / 2;
  if (halign === HorizontalAlignment.RIGHT) return blockTextWidth - lineWidth;
  return 0;
}

/** G2 N45: a span's effective weight/style/decoration is the UNION of the
 *  block's own base `style.fontStyle` (title's default IS bold, e.g.) and
 *  the span's OWN Creole markup — jar-verified `linazi-45-gevo553`'s
 *  `title **KO** on V1.2020.16`: "on V1.2020.16" carries no `**bold**`
 *  markup of its own but still draws `font-weight="700"` because the
 *  title's BASE style is bold; Creole markup only ever ADDS emphasis on
 *  top of the surrounding context, never removes it. */
function spanIsBold(base: AnnotationBoxStyle['fontStyle'], span: CreoleSpan): boolean {
  return base === 'bold' || span.bold;
}

function spanIsItalic(base: AnnotationBoxStyle['fontStyle'], span: CreoleSpan): boolean {
  return base === 'italic' || span.italic;
}

/** Mirrors `class/renderer-classifier-box.ts#memberAtomDecoration`'s
 *  identical CSS `text-decoration` join (that function's own doc comment
 *  explains why it is duplicated here rather than imported: no shared
 *  `UDriver`/`UGraphic` seam links class's renderer to this module). */
function spanTextDecoration(span: CreoleSpan): string | undefined {
  const parts: string[] = [];
  if (span.underline) parts.push('underline');
  if (span.strikethrough) parts.push('line-through');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/** One sibling `<text>` per Creole run, x-advanced by each run's OWN
 *  (unrounded) measured width — mirrors `renderRowAtoms`'s identical
 *  "drawing and measuring agree by construction" shape. `textLength` is
 *  `javaRound4`'d per run (jar's own per-`<text>`-element `SvgGraphics
 *  #format` rounding), `x` stays unrounded like every other coordinate in
 *  this codebase (`renderRowAtoms`'s own doc comment). */
function drawLine(measured: MeasuredLine, x0: number, baseline: number, style: AnnotationBoxStyle): string {
  let x = x0;
  let out = '';
  for (const { span, width } of measured.spans) {
    const decoration = spanTextDecoration(span);
    out += text(x, baseline, span.text, {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fill: span.color ?? style.fontColor,
      lengthAdjust: 'spacing',
      textLength: javaRound4(width),
      ...(spanIsBold(style.fontStyle, span) ? { fontWeight: '700' as const } : {}),
      ...(spanIsItalic(style.fontStyle, span) ? { fontStyle: 'italic' as const } : {}),
      ...(decoration !== undefined ? { textDecoration: decoration } : {}),
    });
    x += width;
  }
  return out;
}

/** Stacks every measured line top-to-bottom inside the padded text box,
 *  each at its own {@link alignLineX} offset. Line advance is `fontSize`
 *  exactly and the first line's ascent is {@link lineAscent} — see that
 *  function's own doc comment for the jar-verified derivation (G2 N45). */
function drawLines(
  measured: readonly MeasuredLine[],
  style: AnnotationBoxStyle,
  pureTextWidth: number,
  font: FontSpec,
  measurer: StringMeasurer,
): string {
  const ascent = lineAscent(font, measurer);
  const advance = style.fontSize;
  const svgs: string[] = [];
  let cursorY = style.padding.top;
  for (const line of measured) {
    const x = style.padding.left + alignLineX(line.width, pureTextWidth, style.horizontalAlignment);
    svgs.push(drawLine(line, x, cursorY + ascent, style));
    cursorY += advance;
  }
  return svgs.join('');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Builds one bordered/margined annotation block: multiline text (padding-
 * inset, per-line aligned per `style.horizontalAlignment`), an optional
 * border/background rect (suppressed when both `backgroundColor` and
 * `lineColor` are `null` — title/caption/header/footer's transparent
 * defaults), then a margin wrap outside the border.
 *
 * Invariant (caller-enforced, not re-checked here per code-principles —
 * every `matchLegend*`/`matchTitle`/etc. command guards non-empty display
 * before storing a non-null `DisplayPositioned`, and `chrome.ts` only calls
 * this after its own `isDisplayPositionedNull` check): `displayLines` is
 * always non-empty.
 *
 * @see Style.java#createTextBlockBordered, TextBlockBordered.java,
 *   TextBlockMarged.java (module doc comment has the full citation list).
 */
export function buildAnnotationBlock(
  _kind: AnnotationElement,
  displayLines: readonly string[],
  style: AnnotationBoxStyle,
  measurer: StringMeasurer,
): AnnotationBlock {
  const font = fontSpecFor(style);
  const measured = measureLines(displayLines, font, measurer);

  const pureTextWidth = Math.max(0, ...measured.map((m) => m.width));
  const pureTextHeight = measured.length * style.fontSize;
  const textWidth = pureTextWidth + style.padding.left + style.padding.right;
  const textHeight = pureTextHeight + style.padding.top + style.padding.bottom;

  const borderedBody =
    buildBorderRect(style, textWidth, textHeight) + drawLines(measured, style, pureTextWidth, font, measurer);

  const width = textWidth + BORDERED_DIMENSION_QUIRK + style.margin.left + style.margin.right;
  const height = textHeight + BORDERED_DIMENSION_QUIRK + style.margin.top + style.margin.bottom;
  // G1d: margin is BAKED into borderedBody's own coordinates (no `<g
  // transform>` wrapper) — matches jar's bare `<g class="...">` shape
  // (annotation.ts#chrome.ts wraps the whole result in that class-bearing
  // `<g>` after this returns); a nested transform here would double-shift
  // when chrome.ts later bakes its OWN (xText,yText) offset on top.
  const body = shiftFragmentBody(borderedBody, style.margin.left, style.margin.top);

  return { body, width, height };
}
