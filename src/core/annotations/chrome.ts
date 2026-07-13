/**
 * chrome.ts — mission G0b / T4: `DiagramChromeFactory.create`'s
 * warnings-less, mainframe-less half (legend → title → caption →
 * header/footer, header/footer outermost — decisions.md D1/D9) plus
 * `DecorateEntityImage`'s vertical-stack composition math (`mergeTB`,
 * `getTextX`, the `xImage`/`yImage`/`yText2` layout).
 *
 * Implementation note (not a divergence from the ported algorithm, a
 * divergence from the Java's OOP shape only): upstream builds a chain of
 * `TextBlock` objects that each recompute their dimension lazily against a
 * shared `StringBounder`. This port has no such object graph — every block
 * this module composes is already a fully-measured {@link AnnotationBlock}
 * / {@link RenderFragment} (string body + fixed width/height), so
 * {@link decorateEntityImage} below performs the SAME arithmetic
 * `DecorateEntityImage#calculateDimension`/`#drawU` do, once, eagerly,
 * instead of via `TextBlock#calculateDimension(StringBounder)` calls
 * threaded through nested wrapper objects. The nested-CENTER telescoping
 * upstream's recursion produces for granted (each wrap re-centers the
 * previous "original" in its own new total) is reproduced exactly by
 * calling this same function once per `DiagramChromeFactory.create` step,
 * in the same order, each time treating the PREVIOUS step's result as the
 * next step's "original" — i.e. the recursion itself, not just its output,
 * is ported; only the "lazy dimension recomputation via StringBounder"
 * mechanism is collapsed to eager arithmetic on plain numbers.
 *
 * SVG shape note (also mechanism-only): upstream bakes each block's final
 * absolute x/y directly into its own `<text>` coordinates (via `UGraphic
 * .apply(UTranslate)`'s coordinate-context threading), so a jar `<g
 * class="title">` never itself carries a `transform`. This port instead
 * nests `<g transform="translate(x,y)">` wrappers (T3's `RenderFragment`
 * is a flat string, not a coordinate-context object) — the CSS class still
 * lands on the correct group and the rendered position is identical, only
 * the DOM shape differs from the jar's own.
 *
 * @see ~/git/plantuml/.../core/DiagramChromeFactory.java:137-149 (create, stacking order)
 * @see ~/git/plantuml/.../core/DiagramChromeFactory.java:320-413 (addLegend/addTitle/addCaption/addHeaderAndFooter)
 * @see ~/git/plantuml/.../svek/DecorateEntityImage.java (composition math)
 * @see ~/git/plantuml/.../klimt/geom/XDimension2D.java#mergeTB
 */

import type { RenderFragment } from '../dispatcher.js';
import type { DiagramAnnotations, DisplayPositioned } from './model.js';
import { isDisplayPositionedNull, isEmpty } from './model.js';
import type { AnnotationBoxStyle, AnnotationElement } from './style.js';
import type { StringMeasurer } from '../measurer.js';
import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../klimt/geom/VerticalAlignment.js';
import { group } from '../svg.js';
import { buildAnnotationBlock, type AnnotationBlock } from './blocks.js';

/** T2's `resolveAnnotationStyles` return shape, re-exported under the name
 *  T4's interface contract (`plans/g0b-annotations/batch-2/T4-chrome-core.md`)
 *  calls it. */
export type AnnotationStyles = Record<AnnotationElement, AnnotationBoxStyle>;

interface Dim {
  readonly width: number;
  readonly height: number;
}

/** @see ~/git/plantuml/.../klimt/geom/XDimension2D.java#mergeTB —
 *  width = max, height = sum. */
export function mergeTB(a: Dim, b: Dim): Dim {
  return { width: Math.max(a.width, b.width), height: a.height + b.height };
}

/** @see ~/git/plantuml/.../svek/DecorateEntityImage.java:144-154 */
export function getTextX(dimText: Dim, dimTotal: Dim, h: HorizontalAlignment): number {
  if (h === HorizontalAlignment.CENTER) return (dimTotal.width - dimText.width) / 2;
  if (h === HorizontalAlignment.RIGHT) return dimTotal.width - dimText.width;
  // LEFT — DecorateEntityImage#getTextX throws IllegalStateException for any
  // other enum value; HorizontalAlignment (as-const object, 3 members) makes
  // a 4th value a compile-time impossibility, so LEFT is the exhaustive
  // fallthrough rather than a throw.
  return 0;
}

const EMPTY_DIM: Dim = { width: 0, height: 0 };

/** One text slot (title/caption/header/footer/legend) `decorateEntityImage`
 *  wraps around the running "original" — `className` mirrors upstream's
 *  `UGroup.put(UGroupType.CLASS, "title"/"legend"/...)` (DiagramChromeFactory
 *  addLegend/addTitle/addCaption/addHeaderAndFooter), applied to the SAME
 *  translated `<g>` this port already wraps the slot's body in (see this
 *  module's doc comment — mechanism-only DOM-shape difference from upstream,
 *  which wraps the class on a separate `startGroup`/`closeGroup` pair). */
interface TextSlot {
  readonly block: AnnotationBlock;
  readonly halign: HorizontalAlignment;
  readonly className: string;
}

/**
 * `DecorateEntityImage#calculateDimension` + `#drawU`, collapsed to one
 * function (see this module's doc comment for why): `add`/`addTop`/
 * `addBottom`/`addTopAndBottom`'s four upstream static factories all reduce
 * to this one shape — callers pass `null` for whichever slot they don't use.
 *
 * @see ~/git/plantuml/.../svek/DecorateEntityImage.java:103-167
 */
function decorateEntityImage(original: AnnotationBlock, text1: TextSlot | null, text2: TextSlot | null): AnnotationBlock {
  const dim1: Dim = text1?.block ?? EMPTY_DIM;
  const dim2: Dim = text2?.block ?? EMPTY_DIM;
  const dimText = mergeTB(dim1, dim2);
  const dimTotal = mergeTB(original, dimText);

  const yImage = dim1.height;
  const yText2 = yImage + original.height;
  const xImage = (dimTotal.width - original.width) / 2;

  const parts: string[] = [];
  if (text1 !== null) {
    const xText1 = getTextX(dim1, dimTotal, text1.halign);
    parts.push(group(text1.block.body, { transform: `translate(${xText1},0)`, class: text1.className }));
  }
  parts.push(group(original.body, { transform: `translate(${xImage},${yImage})` }));
  if (text2 !== null) {
    const xText2 = getTextX(dim2, dimTotal, text2.halign);
    parts.push(group(text2.block.body, { transform: `translate(${xText2},${yText2})`, class: text2.className }));
  }

  return { body: parts.join(''), width: dimTotal.width, height: dimTotal.height };
}

// ---------------------------------------------------------------------------
// Per-element wrap steps — DiagramChromeFactory.addLegend/addTitle/
// addCaption/addHeaderAndFooter
// ---------------------------------------------------------------------------

/** Every `matchLegend`/`matchLegendMultiline`/etc. command guards a
 *  non-empty display before storing a non-null `DisplayPositioned` (see
 *  model.ts/commands.ts); callers here only reach this after their own
 *  `isDisplayPositionedNull` check, so `display` is non-null by
 *  construction — a non-null assertion documents that invariant rather
 *  than re-validating an internal invariant already enforced upstream. */
function nonNullDisplay(dp: DisplayPositioned): readonly string[] {
  return dp.display!;
}

/** @see DiagramChromeFactory.java:324-336 */
function addLegend(original: AnnotationBlock, legend: DisplayPositioned, style: AnnotationBoxStyle, measurer: StringMeasurer): AnnotationBlock {
  const block = buildAnnotationBlock('legend', nonNullDisplay(legend), style, measurer);
  const halign = legend.horizontalAlignment ?? HorizontalAlignment.CENTER;
  const slot: TextSlot = { block, halign, className: 'legend' };
  return legend.verticalAlignment === VerticalAlignment.TOP
    ? decorateEntityImage(original, slot, null)
    : decorateEntityImage(original, null, slot);
}

/** D8: title is forced CENTER at draw time regardless of the stored
 *  alignment. @see DiagramChromeFactory.java:342-356 */
function addTitle(original: AnnotationBlock, title: DisplayPositioned, style: AnnotationBoxStyle, measurer: StringMeasurer): AnnotationBlock {
  const block = buildAnnotationBlock('title', nonNullDisplay(title), style, measurer);
  return decorateEntityImage(original, { block, halign: HorizontalAlignment.CENTER, className: 'title' }, null);
}

/** D8: caption is forced CENTER at draw time regardless of the stored
 *  alignment. @see DiagramChromeFactory.java:362-376 */
function addCaption(original: AnnotationBlock, caption: DisplayPositioned, style: AnnotationBoxStyle, measurer: StringMeasurer): AnnotationBlock {
  const block = buildAnnotationBlock('caption', nonNullDisplay(caption), style, measurer);
  return decorateEntityImage(original, null, { block, halign: HorizontalAlignment.CENTER, className: 'caption' });
}

function headerFooterSlot(
  dp: DisplayPositioned,
  style: AnnotationBoxStyle,
  className: 'header' | 'footer',
  measurer: StringMeasurer,
): TextSlot | null {
  if (isDisplayPositionedNull(dp)) return null;
  const block = buildAnnotationBlock(className, nonNullDisplay(dp), style, measurer);
  // D8: header defaults RIGHT, footer defaults CENTER, both FROM STYLE, only
  // when no explicit left|right|center prefix was parsed (dp.horizontalAlignment
  // null — see commands.ts matchHeader/matchFooter). style.horizontalAlignment
  // already carries the D8 default (BASE_DEFAULTS.header/footer in style.ts).
  const halign = dp.horizontalAlignment ?? style.horizontalAlignment;
  return { block, halign, className };
}

/** @see DiagramChromeFactory.java:382-413. Takes the full `annotations`/
 *  `styles` bags (rather than four separate header/footer args) to stay
 *  under this port's per-function param-count budget. */
function addHeaderAndFooter(
  original: AnnotationBlock,
  annotations: DiagramAnnotations,
  styles: AnnotationStyles,
  measurer: StringMeasurer,
): AnnotationBlock {
  const text1 = headerFooterSlot(annotations.header, styles.header, 'header', measurer);
  const text2 = headerFooterSlot(annotations.footer, styles.footer, 'footer', measurer);
  return decorateEntityImage(original, text1, text2);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * `DiagramChromeFactory.create`, minus warnings (no caller in this port —
 * `Collection<Warning>` has no producer yet) and minus mainframe
 * (decisions.md D9 — deferred whole to T9). Skips entirely — returning the
 * SAME `fragment` object, `===` — when `isEmpty(annotations)` (decisions.md
 * D5, byte-stability for annotation-free diagrams).
 *
 * @see ~/git/plantuml/.../core/DiagramChromeFactory.java:137-149
 */
export function applyChrome(
  fragment: RenderFragment,
  annotations: DiagramAnnotations,
  styles: AnnotationStyles,
  measurer: StringMeasurer,
): RenderFragment {
  if (isEmpty(annotations)) return fragment;

  let block: AnnotationBlock = { body: fragment.body, width: fragment.width, height: fragment.height };

  if (!isDisplayPositionedNull(annotations.legend)) {
    block = addLegend(block, annotations.legend, styles.legend, measurer);
  }
  if (!isDisplayPositionedNull(annotations.title)) {
    block = addTitle(block, annotations.title, styles.title, measurer);
  }
  if (!isDisplayPositionedNull(annotations.caption)) {
    block = addCaption(block, annotations.caption, styles.caption, measurer);
  }
  if (!isDisplayPositionedNull(annotations.header) || !isDisplayPositionedNull(annotations.footer)) {
    block = addHeaderAndFooter(block, annotations, styles, measurer);
  }

  // Spread `fragment` first so `background`/`extraDefs` are inherited
  // exactly as present-or-absent (exactOptionalPropertyTypes forbids
  // explicitly assigning `background: undefined`), then override the
  // three fields chrome composition actually changed.
  return { ...fragment, body: block.body, width: block.width, height: block.height };
}
