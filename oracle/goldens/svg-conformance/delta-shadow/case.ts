/**
 * delta-shadow — T6 golden case: `deltaShadow` filter def registration
 * (`manageShadow`/`addFilterShadowId`, `svg-graphics-shadow.ts`) plus
 * `filter="url(#...)"` reference on the shadowed rect only (ellipse/
 * line/text stay unshadowed, matching upstream — `EntityImageClass`
 * only calls `rect.setDeltaShadow(shadow)`, no other shape).
 *
 * Provenance: `skinparam shadowing true` sets `deltaShadow = 3` for
 * every class box (`Style#getShadowing()`'s "true" -> "3" mapping,
 * `FromSkinparamToStyle.java:390`). Real jar output
 * (plantuml-1.2026.7beta3.jar, `-tsvg`) for:
 *
 *   @startuml
 *   skinparam shadowing true
 *   class CMlFdwyKD {
 *   }
 *   class CQWK {
 *   }
 *   @enduml
 *
 * `seed` (2 classes, `Cxxx` names) was chosen by search over ~3000
 * candidate `.puml` sources so that the seed hash (`UmlSource.seed()`,
 * a 64-bit Java `long`) lands within `Number.MAX_SAFE_INTEGER` — this
 * port's `getSeed` takes a JS `number`, which cannot exactly represent
 * the ~19-digit seeds real diagrams typically hash to (see
 * `svg-graphics-core.ts:117-119`'s own doc comment on this assumption).
 * `Math.abs(449118147854199).toString(36)` reproduces the exact filter
 * id `f4f7611cfp3` byte-for-byte.
 */
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import { drawEntity, jarStringBounder } from '../_shared/class-box.js';
import type { ClassBoxSpec } from '../_shared/class-box.js';

const SEED = 449118147854199; // Math.abs(SEED).toString(36) === '4f7611cfp3'

const WIDTHS = new Map<string, number>([
  ['sans-serif/14/CMlFdwyKD', 79.8369],
  ['sans-serif/14/CQWK', 41.6787],
]);

const CLASS1: ClassBoxSpec = {
  x: 7,
  y: 7,
  width: 111.8369,
  height: 48,
  deltaShadow: 3,
  ellipseX: 11,
  ellipseY: 12,
  ellipseSize: 22,
  glyphOps: [
    ['M', 24.4731, 29.1431],
    ['Q', 23.8921, 29.4419, 23.2529, 29.5913],
    ['Q', 22.6138, 29.7407, 21.9082, 29.7407],
    ['Q', 19.4014, 29.7407, 18.0815, 28.0889],
    ['Q', 16.7617, 26.437, 16.7617, 23.3159],
    ['Q', 16.7617, 20.1865, 18.0815, 18.5347],
    ['Q', 19.4014, 16.8828, 21.9082, 16.8828],
    ['Q', 22.6138, 16.8828, 23.2612, 17.0322],
    ['Q', 23.9087, 17.1816, 24.4731, 17.4805],
    ['L', 24.4731, 20.2031],
    ['Q', 23.8423, 19.6221, 23.2488, 19.3523],
    ['Q', 22.6553, 19.0825, 22.0244, 19.0825],
    ['Q', 20.6797, 19.0825, 19.9949, 20.1492],
    ['Q', 19.3101, 21.2158, 19.3101, 23.3159],
    ['Q', 19.3101, 25.4077, 19.9949, 26.4744],
    ['Q', 20.6797, 27.541, 22.0244, 27.541],
    ['Q', 22.6553, 27.541, 23.2488, 27.2712],
    ['Q', 23.8423, 27.0015, 24.4731, 26.4204],
  ],
  textX: 36,
  textY: 28.291,
  text: 'CMlFdwyKD',
  textWidth: 79.8369,
  lineX1: 8,
  lineX2: 117.8369,
  line1Y: 39,
  line2Y: 47,
};

const CLASS2: ClassBoxSpec = {
  x: 154.08,
  y: 7,
  width: 73.6787,
  height: 48,
  deltaShadow: 3,
  ellipseX: 158.08,
  ellipseY: 12,
  ellipseSize: 22,
  glyphOps: [
    ['M', 171.5531, 29.1431],
    ['Q', 170.9721, 29.4419, 170.3329, 29.5913],
    ['Q', 169.6938, 29.7407, 168.9882, 29.7407],
    ['Q', 166.4814, 29.7407, 165.1615, 28.0889],
    ['Q', 163.8417, 26.437, 163.8417, 23.3159],
    ['Q', 163.8417, 20.1865, 165.1615, 18.5347],
    ['Q', 166.4814, 16.8828, 168.9882, 16.8828],
    ['Q', 169.6938, 16.8828, 170.3412, 17.0322],
    ['Q', 170.9887, 17.1816, 171.5531, 17.4805],
    ['L', 171.5531, 20.2031],
    ['Q', 170.9223, 19.6221, 170.3288, 19.3523],
    ['Q', 169.7353, 19.0825, 169.1044, 19.0825],
    ['Q', 167.7597, 19.0825, 167.0749, 20.1492],
    ['Q', 166.3901, 21.2158, 166.3901, 23.3159],
    ['Q', 166.3901, 25.4077, 167.0749, 26.4744],
    ['Q', 167.7597, 27.541, 169.1044, 27.541],
    ['Q', 169.7353, 27.541, 170.3288, 27.2712],
    ['Q', 170.9223, 27.0015, 171.5531, 26.4204],
  ],
  textX: 183.08,
  textY: 28.291,
  text: 'CQWK',
  textWidth: 41.6787,
  lineX1: 155.08,
  lineX2: 226.7587,
  line1Y: 39,
  line2Y: 47,
};

export function render(): string {
  const root = UGraphicSvg.build(
    SEED,
    basicSvgOption({
      backcolor: '#FFFFFF',
      minDim: { width: 246, height: 74 },
      rootAttributes: new Map([['data-diagram-type', 'CLASS']]),
    }),
    '$version$',
    jarStringBounder(WIDTHS),
  );

  drawEntity(root, { comment: 'class CMlFdwyKD', qualifiedName: 'CMlFdwyKD', uid: 'ent0001', sourceLine: '2' }, CLASS1);
  drawEntity(root, { comment: 'class CQWK', qualifiedName: 'CQWK', uid: 'ent0002', sourceLine: '4' }, CLASS2);

  return root.getSvgString();
}
