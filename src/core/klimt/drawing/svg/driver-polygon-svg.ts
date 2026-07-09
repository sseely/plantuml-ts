/**
 * driver-polygon-svg.ts — the `UPolygon` → SVG `<polygon>` driver.
 *
 * Upstream: klimt/drawing/svg/DriverPolygonSvg.java (~70 ln). Ported:
 * `draw`. Fill/stroke resolution reuses `DriverRectangleSvg
 * .applyFillColor`/`applyStrokeColor` — see that module's doc comment
 * for the shared Paint-resolution seam (D3′).
 *
 * NOT ported: the `TeaVM.a()`-gated `assert points.length % 2 == 0`
 * (debug-only, compiles out of production Java too — see
 * `svg-graphics-elements.ts`'s own note on the same pattern).
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver's constructor takes no `clipContainer` param and never
 * early-returns for an off-clip vertex.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { UPolygon } from '../../shape/UPolygon.js';
import type { SvgGraphics } from './svg-graphics.js';
import { DriverRectangleSvg } from './driver-rectangle-svg.js';

/** Upstream: `DriverPolygonSvg`. Ported in full — see the module doc
 * comment above. */
export class DriverPolygonSvg implements UDriver<UPolygon> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(shape: UPolygon, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    const points = shape.getPointArray(x, y);

    DriverRectangleSvg.applyFillColor(this.svg, param);
    DriverRectangleSvg.applyStrokeColor(this.svg, param);
    this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);

    this.svg.svgPolygon(shape.getDeltaShadow(), ...points);
  }
}
