/**
 * class-box.ts — shared draw-sequence helper for the "class box" element
 * (rounded rect + green ellipse + letter-glyph icon + name text + two
 * divider lines) that recurs across several svg-conformance golden
 * cases (T6). Factored out so each case file stays lean/data-focused
 * per the mission brief's file-size guidance, and so the cases that
 * reuse this exact visual (class-boxes-and-link, delta-shadow,
 * gradient-fill) do not duplicate the draw-order logic.
 *
 * The letter-glyph icon is NOT drawn via `UPath`/`svgPath` — real jar
 * output for this icon has no `style` attribute and its `d` string ends
 * in a literal " Z " that `svgPath`'s segment renderer cannot produce
 * (`SEG_CLOSE` renders as "nothing", matching upstream exactly — see
 * `svg-graphics-elements.ts`). The " Z " instead comes from
 * `SvgGraphics`'s legacy `newpath/moveto/quadto/lineto/closepath/fill`
 * path-builder API (verified against
 * `tests/unit/core/klimt/svg-graphics.test.ts`'s own
 * "newpath/moveto/lineto/curveto/quadto/closepath/fill build one <path>"
 * case, which asserts the exact same `Z ` tail). Upstream draws this
 * icon via a real AWT font-glyph outline (`drawPathIterator`, explicitly
 * NOT ported — see that file's doc comment); this helper reproduces the
 * literal op sequence read off real jar bytes instead of a font pipeline.
 */
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UEllipse } from '../../../../src/core/klimt/shape/UEllipse.js';
import { ULine } from '../../../../src/core/klimt/shape/ULine.js';
import { UText } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UComment } from '../../../../src/core/klimt/shape/UComment.js';
import { UGroup, UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { Back } from '../../../../src/core/klimt/Back.js';
import type { StringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';

/** One legacy-path-builder op: a moveto/lineto (2 coords) or a quadto
 * (control point + endpoint, 4 coords). Absolute coordinates, matching
 * `SvgGraphics#moveto/lineto/quadto`'s own signatures. */
export type GlyphOp =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['Q', number, number, number, number];

export interface ClassBoxSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly deltaShadow: number;
  readonly ellipseX: number;
  readonly ellipseY: number;
  readonly ellipseSize: number;
  readonly glyphOps: readonly GlyphOp[];
  readonly textX: number;
  readonly textY: number;
  readonly text: string;
  readonly textWidth: number;
  readonly lineX1: number;
  readonly lineX2: number;
  readonly line1Y: number;
  readonly line2Y: number;
}

/** `<!--comment--><g class="entity" ...>` wrapper metadata for one
 * `drawEntity` call — the `UComment` text plus the four `UGroupType`
 * attributes every class-box entity group in this suite's goldens
 * carries (`class`, `data-qualified-name`, `id` via `DATA_UID`,
 * `data-source-line`). */
export interface EntityMeta {
  readonly comment: string;
  readonly qualifiedName: string;
  readonly uid: string;
  readonly sourceLine: string;
}

const SANS_SERIF_14: FontConfiguration = {
  family: 'sans-serif',
  size: 14,
  color: '#000000',
  styles: new Set(),
};

/** Draws the letter-glyph icon via the legacy path-builder API — see the
 * module doc comment above for why this bypasses `UPath`/`svgPath`. */
export function drawGlyph(root: UGraphicSvg, ops: readonly GlyphOp[]): void {
  const svg = root.getSvgGraphics();
  svg.setFillColor('#000000');
  svg.newpath();
  for (const op of ops) {
    if (op[0] === 'M') svg.moveto(op[1], op[2]);
    else if (op[0] === 'L') svg.lineto(op[1], op[2]);
    else svg.quadto(op[1], op[2], op[3], op[4]);
  }
  svg.closepath();
  svg.fill(0);
}

function drawBoxRect(root: UGraphicSvg, spec: ClassBoxSpec): void {
  const rect = URectangle.build(spec.width, spec.height).rounded(5);
  rect.setDeltaShadow(spec.deltaShadow);
  root
    .apply(new UTranslate(spec.x, spec.y))
    .apply(new Fore('#181818'))
    .apply(new Back('#F1F1F1'))
    .apply(UStroke.withThickness(0.5))
    .draw(rect);
}

export function drawBoxEllipse(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.ellipseX, spec.ellipseY))
    .apply(new Fore('#181818'))
    .apply(new Back('#ADD1B2'))
    .apply(UStroke.withThickness(1))
    .draw(UEllipse.build(spec.ellipseSize, spec.ellipseSize));
}

export function drawBoxText(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.textX, spec.textY))
    .apply(new Fore('#000000'))
    .draw(UText.build(spec.text, SANS_SERIF_14));
}

export function drawBoxLine(root: UGraphicSvg, spec: ClassBoxSpec, y: number): void {
  root
    .apply(new UTranslate(spec.lineX1, y))
    .apply(new Fore('#181818'))
    .apply(UStroke.withThickness(0.5))
    .draw(ULine.hline(spec.lineX2 - spec.lineX1));
}

/** Ellipse + glyph + text + 2 lines — everything in a class box EXCEPT
 * the rect(s), so gradient-header variants (4 rects instead of 1) can
 * reuse this tail without duplicating it. */
export function drawClassBoxHeader(root: UGraphicSvg, spec: ClassBoxSpec): void {
  drawBoxEllipse(root, spec);
  drawGlyph(root, spec.glyphOps);
  drawBoxText(root, spec);
  drawBoxLine(root, spec, spec.line1Y);
  drawBoxLine(root, spec, spec.line2Y);
}

/** Draws one "class box" entity (rect + ellipse + glyph + text + 2
 * lines) — the standard `EntityImageClass` visual shared by every class
 * in the `class-boxes-and-link` and `delta-shadow` golden cases. Does
 * NOT emit the surrounding `UComment`/`startGroup`/`closeGroup` — use
 * `drawEntity` for the full comment+group+box sequence. */
export function drawClassBox(root: UGraphicSvg, spec: ClassBoxSpec): void {
  drawBoxRect(root, spec);
  drawClassBoxHeader(root, spec);
}

/** Draws `<!--comment--><g class="entity" ...>body(...)</g>` — the full
 * per-entity sequence shared by every class in this suite's multi-class
 * goldens. `body` defaults to `drawClassBox`; the gradient-fill case
 * passes its own 4-rect body instead. */
export function drawEntity(
  root: UGraphicSvg,
  meta: EntityMeta,
  spec: ClassBoxSpec,
  body: (root: UGraphicSvg, spec: ClassBoxSpec) => void = drawClassBox,
): void {
  root.draw(new UComment(meta.comment));
  const group = new UGroup();
  group.put(UGroupType.CLASS, 'entity');
  group.put(UGroupType.DATA_QUALIFIED_NAME, meta.qualifiedName);
  group.put(UGroupType.DATA_UID, meta.uid);
  group.put(UGroupType.DATA_SOURCE_LINE, meta.sourceLine);
  root.startGroup(group);
  body(root, spec);
  root.closeGroup();
}

/** Shared text-measurement stub: returns the EXACT widths recorded in
 * the cached jar fixtures this suite conforms against (per
 * `driver-text-svg.ts`'s own doc comment on this seam) — never invents
 * font metrics. Throws on an unregistered key so a missing width fails
 * loud rather than silently measuring wrong. */
export function jarStringBounder(widths: ReadonlyMap<string, number>): StringBounder {
  return {
    calculateDimension(font, text) {
      const key = `${font.family}/${font.size}/${text}`;
      const width = widths.get(key);
      if (width === undefined) throw new Error(`jarStringBounder: no known width for "${key}"`);
      return { width };
    },
  };
}
