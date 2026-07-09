/**
 * driver-line-svg.ts — the `ULine` → SVG `<line>` driver.
 *
 * Upstream: klimt/drawing/svg/DriverLineSvg.java (~86 ln). Ported:
 * `draw`. The shadow branch is upstream's own commented-out dead code
 * (`// if (shape.getDeltaShadow() != 0) svg.svgLineShadow(...)` — no
 * `svgLineShadow` method exists anywhere in `SvgGraphics.java`), so it is
 * not ported either, matching upstream's own inactive state (same
 * "commented-out and never active" pattern already applied to
 * `UPath#closePath`, T2).
 *
 * Stroke-color resolution here is deliberately NOT shared with
 * `DriverRectangleSvg.applyStrokeColor` — upstream's own `DriverLineSvg
 * .draw` has its own narrower gradient handling: a `Gradient` stroke
 * Paint (upstream: `HColorGradient`) uses `color1` as a flat solid
 * stroke, with NO `<linearGradient>` def registered — unlike every other
 * driver in this file set. Ported faithfully, including the asymmetry.
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver's constructor takes no `clipContainer` param and never
 * clips the line's endpoints.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { ULine } from '../../shape/ULine.js';
import type { SvgGraphics } from './svg-graphics.js';

/** Upstream: `DriverLineSvg`. Ported in full — see the module doc
 * comment above. */
export class DriverLineSvg implements UDriver<ULine> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(shape: ULine, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    const x2 = x + shape.getDX();
    const y2 = y + shape.getDY();

    const color = param.getColor();
    if (typeof color === 'string') {
      this.svg.setStrokeColor(color);
    } else {
      // Upstream: HColorGradient's plain (non-url) flat-color fallback —
      // see the module doc comment above.
      this.svg.setStrokeColor(color.color1);
    }
    this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);
    this.svg.svgLine(x, y, x2, y2, shape.getDeltaShadow());
  }
}
