/**
 * driver-path-svg.ts — the `UPath` → SVG `<path>` driver.
 *
 * Upstream: klimt/drawing/svg/DriverPathSvg.java (~80 ln). Ported:
 * `draw`, including the "color equals backcolor, neither a gradient"
 * fast path (flat fill, no stroke — `svg.setStrokeColor("")`,
 * `setStrokeWidth(0, null)`, both ported literally, including the empty-
 * string stroke value upstream itself passes). Fill/stroke resolution in
 * the general branch reuses `DriverRectangleSvg.applyFillColor`/
 * `applyStrokeColor` — see that module's doc comment for the shared
 * Paint-resolution seam (D3′).
 *
 * `paintsEqual` stands in for `HColor#equals` restricted to this port's
 * `Paint` model: two plain-string paints compare `===`; a `Gradient`
 * paint is never "equal" to anything here (matching upstream's own
 * `&& !(color instanceof HColorGradient) && !(color instanceof
 * HColorLinearGradient)` guard — a gradient never takes the fast path).
 *
 * NOT ported: `DriverShadowedG2d` (upstream's `extends
 * DriverShadowedG2d` — an AWT-`Graphics2D` shadow-rendering base class
 * for the G2D/PNG backend family; irrelevant to the pure-SVG renderer,
 * `SvgGraphics#svgPath` already handles `deltaShadow` itself via
 * `manageShadow`/`addFilterShadowId`, see `svg-graphics-elements.ts`).
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver's constructor takes no `clipContainer` param and never
 * early-returns for an off-clip path.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { Paint } from '../../../paint.js';
import type { UPath } from '../../shape/UPath.js';
import type { SvgGraphics } from './svg-graphics.js';
import { DriverRectangleSvg } from './driver-rectangle-svg.js';

// See the module doc comment above for the HColor#equals adaptation.
function paintsEqual(a: Paint, b: Paint): boolean {
  return typeof a === 'string' && typeof b === 'string' && a === b;
}

/** Upstream: `DriverPathSvg`. Ported in full — see the module doc
 * comment above. */
export class DriverPathSvg implements UDriver<UPath> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(shape: UPath, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    const color = param.getColor();
    const back = param.getBackcolor();

    if (paintsEqual(color, back)) {
      this.svg.setFillColor(color as string);
      this.svg.setStrokeColor('');
      this.svg.setStrokeWidth(0, null);
    } else {
      DriverRectangleSvg.applyFillColor(this.svg, param);
      DriverRectangleSvg.applyStrokeColor(this.svg, param);
      this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);
    }

    this.svg.svgPath(x, y, shape, shape.getDeltaShadow());
  }
}
