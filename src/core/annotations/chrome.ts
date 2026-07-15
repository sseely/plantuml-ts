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
 * SVG shape note (RESOLVED by mission G1d, maintainer decision
 * 2026-07-15 — this paragraph used to document a deliberate G0b/T4
 * divergence; kept as history). Upstream bakes each block's final
 * absolute x/y directly into its own `<text>` coordinates (via `UGraphic
 * .apply(UTranslate)`'s coordinate-context threading), so a jar `<g
 * class="title">` never itself carries a `transform`, and title/legend/
 * caption/header/footer nest INSIDE the SAME single content `<g>` the
 * diagram body uses (one top-level `<g>` per document, not two). G0b/T4
 * originally diverged on both counts: a `<g transform="translate(x,y)">`
 * wrapper around each slot (`RenderFragment` is a flat string, not a
 * coordinate-context object) and a SEPARATE sibling `<g>` around the
 * "original" body. G1d closes both: {@link decorateEntityImage} now calls
 * `shiftFragmentBody` (`./coord-shift.js`) — the eager-arithmetic
 * equivalent of `UGraphic.apply(UTranslate)`, baking (dx,dy) into every
 * coordinate-bearing attribute of an already-serialized fragment string —
 * instead of wrapping in `<g transform>`, and {@link applyChrome} wraps
 * the fully-composed result in exactly ONE bare `<g>` (no class, no
 * transform) rather than each `decorateEntityImage` step adding its own
 * wrapper around "original". `description/renderer.ts#unwrapKlimtSvg` was
 * widened to match: it now strips klimt's OWN content `<g>` (and its
 * leading `<?plantuml?>` PI) too, so `RenderFragment.body` is uniformly
 * flat (no wrapping element) for EVERY engine, klimt included — the ONE
 * outer `<g>` `applyChrome` adds is the only one that survives.
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
import { shiftFragmentBody } from './coord-shift.js';

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
 *  addLegend/addTitle/addCaption/addHeaderAndFooter), applied to the `<g
 *  class="...">` `decorateEntityImage` wraps the slot's (now coordinate-
 *  shifted, transform-free) body in — matching jar's own bare `<g
 *  class="...">` shape (G1d). */
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
    parts.push(group(shiftFragmentBody(text1.block.body, xText1, 0), { class: text1.className }));
  }
  parts.push(shiftFragmentBody(original.body, xImage, yImage));
  if (text2 !== null) {
    const xText2 = getTextX(dim2, dimTotal, text2.halign);
    parts.push(group(shiftFragmentBody(text2.block.body, xText2, yText2), { class: text2.className }));
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
 * G1d: the fully-composed result (every active slot + the original body,
 * already transform-free per {@link decorateEntityImage}) is wrapped in
 * exactly ONE bare `<g>` — matching jar's single top-level content `<g>`
 * per annotated document (`test-results/dot-cache/<type>/<slug>/in.svg`, the 19 G1 I1
 * chrome fixtures: `<g><g class="title">...</g><!--entity foo-->...</g>`).
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
  // D9: `mainframe` participates in `isEmpty()` (chrome still RUNS for a
  // mainframe-only diagram) but is not yet drawn (`BigFrame` unported) --
  // tracked separately from `block` so a mainframe-only bag still returns
  // `fragment.body` byte-identical (no new outer `<g>` either), matching
  // `annotations-mainframe.test.ts`'s pinned D5-adjacent invariant.
  let decorated = false;

  if (!isDisplayPositionedNull(annotations.legend)) {
    block = addLegend(block, annotations.legend, styles.legend, measurer);
    decorated = true;
  }
  if (!isDisplayPositionedNull(annotations.title)) {
    block = addTitle(block, annotations.title, styles.title, measurer);
    decorated = true;
  }
  if (!isDisplayPositionedNull(annotations.caption)) {
    block = addCaption(block, annotations.caption, styles.caption, measurer);
    decorated = true;
  }
  if (!isDisplayPositionedNull(annotations.header) || !isDisplayPositionedNull(annotations.footer)) {
    block = addHeaderAndFooter(block, annotations, styles, measurer);
    decorated = true;
  }

  if (!decorated) return fragment;

  // Spread `fragment` first so `background`/`extraDefs` are inherited
  // exactly as present-or-absent (exactOptionalPropertyTypes forbids
  // explicitly assigning `background: undefined`), then override the
  // three fields chrome composition actually changed.
  return { ...fragment, body: group(block.body), width: block.width, height: block.height };
}
