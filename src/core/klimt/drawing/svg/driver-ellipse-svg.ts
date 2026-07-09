/**
 * driver-ellipse-svg.ts — the `UEllipse` → SVG `<ellipse>` (full ellipse)
 * or `<path>` (elliptical arc) driver.
 *
 * Upstream: klimt/drawing/svg/DriverEllipseSvg.java (~97 ln). Ported in
 * full: `draw`, including the start/extend arc-angle math (identical
 * `sin`/`cos` formulas, ported 1:1). Fill/stroke resolution reuses
 * `DriverRectangleSvg.applyStrokeColor`/`applyFillColor` — see that
 * module's doc comment for the shared Paint-resolution seam (D3′).
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver's constructor takes no `clipContainer` param and never
 * early-returns for an off-clip ellipse.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { UEllipse } from '../../shape/UEllipse.js';
import type { SvgGraphics } from './svg-graphics.js';
import { DriverRectangleSvg } from './driver-rectangle-svg.js';

const DEG_TO_RAD = Math.PI / 180;

/** Center + radii grouping for `drawArc` below, kept under this port's
 * per-function param budget. */
interface EllipseGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** Upstream: `DriverEllipseSvg`. Ported in full — see the module doc
 * comment above. */
export class DriverEllipseSvg implements UDriver<UEllipse> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(shape: UEllipse, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    const width = shape.getWidth();
    const height = shape.getHeight();

    DriverRectangleSvg.applyStrokeColor(this.svg, param);
    DriverRectangleSvg.applyFillColor(this.svg, param);
    this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);

    const start = shape.getStart();
    const extend = shape.getExtend();
    const geo: EllipseGeometry = { cx: x + width / 2, cy: y + height / 2, rx: width / 2, ry: height / 2 };

    if (start === 0 && extend === 0) {
      this.svg.svgEllipse(geo.cx, geo.cy, geo.rx, geo.ry, shape.getDeltaShadow());
      return;
    }
    this.drawArc(geo, start + 90, extend);
  }

  // Upstream: the two symmetric `if (extend > 0) {...} else {...}` arc
  // branches inside `draw` — factored into a helper purely to stay under
  // this port's per-function NLOC/param budget; the sin/cos endpoint math
  // is identical in both branches modulo swapped operands, matching
  // upstream.
  private drawArc(geo: EllipseGeometry, start: number, extend: number): void {
    const angleA = extend > 0 ? start : start + extend;
    const angleB = extend > 0 ? start + extend : start;
    const x1 = geo.cx + Math.sin(angleA * DEG_TO_RAD) * geo.rx;
    const y1 = geo.cy + Math.cos(angleA * DEG_TO_RAD) * geo.ry;
    const x2 = geo.cx + Math.sin(angleB * DEG_TO_RAD) * geo.rx;
    const y2 = geo.cy + Math.cos(angleB * DEG_TO_RAD) * geo.ry;
    this.svg.svgArcEllipse(geo.rx, geo.ry, x1, y1, x2, y2);
  }
}
