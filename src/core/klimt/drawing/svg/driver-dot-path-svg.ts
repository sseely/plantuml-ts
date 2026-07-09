/**
 * driver-dot-path-svg.ts — the `DotPath` → SVG `<path>` driver (svek
 * edge splines).
 *
 * Upstream: klimt/drawing/svg/DriverDotPathSvg.java (~56 ln). Ported:
 * `draw`, including the `deltaShadow`-less `svgPath` call (upstream
 * passes a literal `0`, not `shape.getDeltaShadow()` — `DotPath` is not
 * `Shadowable` upstream and has no such accessor either; T2's `DotPath`
 * port carries the same omission, see `DotPath.ts`).
 *
 * `isTransparent()` adaptation (D3′, this task's decision): upstream
 * guards the whole body on `param.getColor().isTransparent() == false`.
 * This port's `Paint` has no `isTransparent()` — `'none'` is the
 * established "nothing painted" sentinel (see `AbstractCommonUGraphic
 * .ts`'s `NONE_PAINT` doc comment), and `'#00000000'` (explicit
 * zero-alpha) is the equivalent sentinel `SvgGraphicsCore#fixColor`
 * already treats as "none" (`svg-graphics-core.ts`). Both are treated as
 * "transparent" here, matching `fixColor`'s own equivalence class.
 *
 * `UClip`/`ClipContainer` — not ported (same as `DriverRectangleSvg`);
 * this driver has no clip param at all upstream either (its constructor
 * is already zero-arg).
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { Paint } from '../../../paint.js';
import type { DotPath } from '../../shape/DotPath.js';
import type { SvgGraphics } from './svg-graphics.js';
import { DriverRectangleSvg } from './driver-rectangle-svg.js';

// See the module doc comment above for the isTransparent() adaptation.
function isTransparentPaint(p: Paint): boolean {
  return p === 'none' || p === '#00000000';
}

/** Upstream: `DriverDotPathSvg`. Ported in full — see the module doc
 * comment above. */
export class DriverDotPathSvg implements UDriver<DotPath> {
  constructor(private readonly svg: SvgGraphics) {}

  draw(shape: DotPath, param: UParam): void {
    if (isTransparentPaint(param.getColor())) return;

    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();

    DriverRectangleSvg.applyStrokeColor(this.svg, param);
    this.svg.setFillColor(null);
    this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);
    this.svg.svgPath(x, y, shape.toUPath(), 0);
  }
}
