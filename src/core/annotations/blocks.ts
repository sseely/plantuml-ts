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
 * chrome module (decisions.md D1). `src/core/creole.ts` (`parseCreole`/
 * `spansToTspan`) IS reused for inline bold/color markup — see
 * {@link measureLines} and {@link drawLine} below.
 *
 * @see ~/git/plantuml/.../style/Style.java:315-332 (createTextBlockBordered)
 * @see ~/git/plantuml/.../klimt/shape/TextBlockBordered.java
 * @see ~/git/plantuml/.../klimt/shape/TextBlockMarged.java
 * @see ~/git/plantuml/.../klimt/drawing/svg/DriverRectangleSvg.java:78 (rx/2 quirk)
 */

import type { AnnotationBoxStyle, AnnotationElement } from './style.js';
import type { FontSpec, StringMeasurer } from '../measurer.js';
import { parseCreole, spansToTspan, type CreoleSpan } from '../creole.js';
import { group, rect } from '../svg.js';
import type { BoxStyle } from '../svg.js';
import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';

/** The fragment shape {@link buildAnnotationBlock} returns — width/height
 *  are the block's OWN reported dimension (post padding/border/+1/margin),
 *  matching `TextBlock#calculateDimension`'s contract. */
export interface AnnotationBlock {
  readonly body: string;
  readonly width: number;
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Line-spacing ratios (StringMeasurer, D4, reports only the em-box height —
// no ascent/line-box table, so multi-line leading needs a ratio model, same
// approach `src/core/error/error-renderer.ts` already establishes for the
// identical reason).
// ---------------------------------------------------------------------------

/** `GraphicStrings` sans-serif line advance / size-12 reference, reused from
 *  `error-renderer.ts`'s own jar citation. Re-verified here 2026-07-13
 *  against a two-line legend fixture (`legend bottom left` / `This is` /
 *  `my legend`, size 14): line 1 baseline 182.7773, line 2 baseline
 *  199.2656 — delta 16.4883 == 14 * (14.1328 / 12) exactly. */
const LINE_ADVANCE_RATIO = 14.1328 / 12;
/** Same fixture: block top (rect y + padding.top) 169.2422, line-1 baseline
 *  182.7773 — delta 13.5352 == 14 * (11.6016 / 12) exactly. */
const ASCENT_RATIO = 11.6016 / 12;

/** `TextBlockBordered#calculateDimension` reports `width + 1, height + 1`
 *  (TextBlockBordered.java:95-98) but `getPolygonNormal` draws the border
 *  rect at the UN-plus-oned `getTextWidth`/`getTextHeight` (:146-150) — the
 *  block's reported size is always 1px larger, on each axis, than what it
 *  actually paints. Jar-verified: the same legend fixture's rect is
 *  80.6904 × 42.9766 == pureTextWidth(70.6904)+padding(10) ×
 *  pureTextHeight(32.9766)+padding(10), no +1; the block's outward
 *  dimension (consumed one level up, by `decorateEntityImage` in
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
// XML escaping (element CONTENT only — span text is always placed inside a
// `<tspan>`, never an attribute value, so `"`/`'` need no escaping here).
// `src/core/creole.ts#spansToTspan` does not escape its input (this task is
// its first consumer); duplicating the 3-entity content subset locally
// avoids reaching into `src/core/svg.ts`'s private `escapeXml` (outside
// T4's write-set).
// ---------------------------------------------------------------------------

const XML_CONTENT_ESCAPE_RE = new RegExp('[&<>]', 'g');
const XML_CONTENT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapeSpanText(s: string): string {
  /* v8 ignore start -- `?? ch` is an unreachable defensive fallback: every
   * character XML_CONTENT_ESCAPE_RE can match ([&<>]) is a key of
   * XML_CONTENT_ESCAPES by construction (same 3-character set in both). */
  return s.replace(XML_CONTENT_ESCAPE_RE, (ch) => XML_CONTENT_ESCAPES[ch] ?? ch);
  /* v8 ignore stop */
}

function escapedSpans(spans: readonly CreoleSpan[]): CreoleSpan[] {
  return spans.map((s) => ({ ...s, text: escapeSpanText(s.text) }));
}

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

interface MeasuredLine {
  readonly spans: readonly CreoleSpan[];
  readonly width: number;
}

/** Parses each line's Creole TOKENS (bold/italic/underline/color) via
 *  `parseCreole` — per D4, only the plain (markup-stripped) text is handed
 *  to the injected `StringMeasurer` for width; the 0.6-heuristic Creole
 *  internally uses for its OWN layout is never consulted. */
function measureLines(lines: readonly string[], font: FontSpec, measurer: StringMeasurer): MeasuredLine[] {
  return lines.map((line) => {
    const spans = parseCreole(line);
    const plainText = spans.map((s) => s.text).join('');
    return { spans, width: measurer.measure(plainText, font).width };
  });
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Builds the `rect()` `BoxStyle`, omitting `fill`/`stroke` entirely (rather
 *  than setting them to `undefined`) when the corresponding color is
 *  `null` — required under this project's `exactOptionalPropertyTypes`. */
function borderBoxStyle(style: AnnotationBoxStyle): BoxStyle {
  const box: BoxStyle = { rx: style.roundCorner / SVG_ROUND_CORNER_DIVISOR };
  if (style.backgroundColor !== null) box.fill = style.backgroundColor;
  if (style.lineColor !== null) box.stroke = style.lineColor;
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

function drawLine(measured: MeasuredLine, x: number, baseline: number, style: AnnotationBoxStyle): string {
  const weightAttr = style.fontStyle === 'bold' ? ' font-weight="bold"' : '';
  const styleAttr = style.fontStyle === 'italic' ? ' font-style="italic"' : '';
  const tspans = spansToTspan(escapedSpans(measured.spans), { fill: style.fontColor });
  return (
    `<text x="${x}" y="${baseline}" font-family="${style.fontFamily}" ` +
    `font-size="${style.fontSize}" fill="${style.fontColor}"${weightAttr}${styleAttr}>${tspans}</text>`
  );
}

/** Stacks every measured line top-to-bottom inside the padded text box,
 *  each at its own {@link alignLineX} offset, using the jar-verified
 *  {@link LINE_ADVANCE_RATIO}/{@link ASCENT_RATIO} leading model. */
function drawLines(measured: readonly MeasuredLine[], style: AnnotationBoxStyle, pureTextWidth: number): string {
  const ascent = style.fontSize * ASCENT_RATIO;
  const advance = style.fontSize * LINE_ADVANCE_RATIO;
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
  const pureTextHeight = measured.length * style.fontSize * LINE_ADVANCE_RATIO;
  const textWidth = pureTextWidth + style.padding.left + style.padding.right;
  const textHeight = pureTextHeight + style.padding.top + style.padding.bottom;

  const borderedBody = buildBorderRect(style, textWidth, textHeight) + drawLines(measured, style, pureTextWidth);

  const width = textWidth + BORDERED_DIMENSION_QUIRK + style.margin.left + style.margin.right;
  const height = textHeight + BORDERED_DIMENSION_QUIRK + style.margin.top + style.margin.bottom;
  const body = group(borderedBody, { transform: `translate(${style.margin.left},${style.margin.top})` });

  return { body, width, height };
}
