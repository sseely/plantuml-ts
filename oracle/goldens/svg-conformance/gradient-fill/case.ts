/**
 * gradient-fill — T6 golden case: `Gradient` Paint fill/stroke
 * resolution (`DriverRectangleSvg.applyFillColor/applyStrokeColor` +
 * `SvgGraphics#createSvgGradient`'s seed/counter id policy). Real
 * (newer) jar class-diagram rendering draws a gradient-backed class
 * box as 4 stacked rects, not 1: full rounded rect (fill=gradient,
 * stroke=flat), header rect (fill=stroke=gradient), a thin separator
 * rect at the header's rounded-corner boundary (fill=stroke=gradient),
 * then a border-only outline (fill=none, stroke=flat) — all four
 * referencing the SAME `<linearGradient>` def via `createSvgGradient`'s
 * de-dup map (one def, five `url(#...)` references per class).
 *
 * Provenance: real jar output (plantuml-1.2026.7beta3.jar, `-tsvg`) for:
 *
 *   @startuml
 *   skinparam class {
 *     BackgroundColor Orange-White
 *   }
 *   class CRauFqu {
 *   }
 *   class CBGKJdzpHJ {
 *   }
 *   class CrJJZdJiIN {
 *   }
 *   @enduml
 *
 * `seed` was chosen the same way as `delta-shadow`'s (search over
 * ~4000 candidate `.puml` sources for a `UmlSource.seed()` hash within
 * `Number.MAX_SAFE_INTEGER` — see that case's provenance note and
 * `svg-graphics-core.ts:117-119`). `Math.abs(2393622455286742)
 * .toString(36)` reproduces the exact gradient id `nkguz4dl1y`
 * byte-for-byte. The gradient's resolved colors (`#FFA500`/`#FFFFFF`,
 * policy `-`) are constructed directly as a `Paint` literal — skinparam
 * name resolution (`Orange-White` -> hex) is a different layer, out of
 * this task's emitter-conformance scope.
 */
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { Back } from '../../../../src/core/klimt/Back.js';
import type { Gradient } from '../../../../src/core/paint.js';
import { drawEntity, drawClassBoxHeader, jarStringBounder } from '../_shared/class-box.js';
import type { ClassBoxSpec } from '../_shared/class-box.js';
import { CLASS1, CLASS2, CLASS3 } from './class-specs.js';

const SEED = 2393622455286742; // Math.abs(SEED).toString(36) === 'nkguz4dl1y'
const GRADIENT: Gradient = { color1: '#FFA500', color2: '#FFFFFF', policy: '-' };
const HEADER_HEIGHT = 32;
const CORNER = 2.5;

const WIDTHS = new Map<string, number>([
  ['sans-serif/14/CRauFqu', 59.9648],
  ['sans-serif/14/CBGKJdzpHJ', 81.6416],
  ['sans-serif/14/CrJJZdJiIN', 64.1758],
]);

function drawFullRect(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.x, spec.y))
    .apply(new Fore('#181818'))
    .apply(new Back(GRADIENT))
    .apply(UStroke.withThickness(0.5))
    .draw(URectangle.build(spec.width, spec.height).rounded(5));
}

function drawHeaderRect(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.x, spec.y))
    .apply(new Fore(GRADIENT))
    .apply(new Back(GRADIENT))
    .apply(UStroke.withThickness(0.5))
    .draw(URectangle.build(spec.width, HEADER_HEIGHT).rounded(5));
}

function drawSeparatorRect(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.x, spec.y + HEADER_HEIGHT - CORNER))
    .apply(new Fore(GRADIENT))
    .apply(new Back(GRADIENT))
    .apply(UStroke.withThickness(0.5))
    .draw(URectangle.build(spec.width, CORNER));
}

function drawBorderRect(root: UGraphicSvg, spec: ClassBoxSpec): void {
  root
    .apply(new UTranslate(spec.x, spec.y))
    .apply(new Fore('#181818'))
    .apply(new Back('none'))
    .apply(UStroke.withThickness(0.5))
    .draw(URectangle.build(spec.width, spec.height).rounded(5));
}

function drawGradientClassBox(root: UGraphicSvg, spec: ClassBoxSpec): void {
  drawFullRect(root, spec);
  drawHeaderRect(root, spec);
  drawSeparatorRect(root, spec);
  drawBorderRect(root, spec);
  drawClassBoxHeader(root, spec);
}

interface EntityRow {
  readonly meta: { comment: string; qualifiedName: string; uid: string; sourceLine: string };
  readonly spec: ClassBoxSpec;
}

const ENTITIES: readonly EntityRow[] = [
  { meta: { comment: 'class CRauFqu', qualifiedName: 'CRauFqu', uid: 'ent0001', sourceLine: '4' }, spec: CLASS1 },
  {
    meta: { comment: 'class CBGKJdzpHJ', qualifiedName: 'CBGKJdzpHJ', uid: 'ent0002', sourceLine: '6' },
    spec: CLASS2,
  },
  {
    meta: { comment: 'class CrJJZdJiIN', qualifiedName: 'CrJJZdJiIN', uid: 'ent0003', sourceLine: '8' },
    spec: CLASS3,
  },
];

function buildRoot(): UGraphicSvg {
  return UGraphicSvg.build(
    SEED,
    basicSvgOption({
      backcolor: '#FFFFFF',
      minDim: { width: 263, height: 177 },
      rootAttributes: new Map([['data-diagram-type', 'CLASS']]),
    }),
    '$version$',
    jarStringBounder(WIDTHS),
  );
}

export function render(): string {
  const root = buildRoot();
  for (const { meta, spec } of ENTITIES) drawEntity(root, meta, spec, drawGradientClassBox);
  return root.getSvgString();
}
