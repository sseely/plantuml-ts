/**
 * driver-rectangle-svg.ts — the `URectangle` → SVG `<rect>` driver.
 *
 * Upstream: klimt/drawing/svg/DriverRectangleSvg.java (~113 ln). Ported:
 * `draw`, plus the two `static` fill/stroke-color resolution helpers
 * (`applyFillColor`, `applyStrokeColor`) that `DriverEllipseSvg`,
 * `DriverPolygonSvg`, and `DriverPathSvg` also call — kept as `static`
 * methods on this class, matching upstream's own placement and call
 * sites (`DriverRectangleSvg.applyFillColor(svg, mapper, param)`)
 * exactly, just dropping the `mapper: ColorMapper` param (this port's
 * `UParam` already carries resolved `Paint` values, not raw `HColor` —
 * see `UParam.ts`, T2).
 *
 * Color-resolution seam (D3′, this task's decision — see the module doc
 * comment on `u-graphic-svg.ts` for the full rationale): a plain-string
 * `Paint` is used as-is for `setFillColor`/`setStrokeColor`, mirroring
 * `HColor#toSvg(mapper)` for the non-gradient branch. A `Gradient` Paint
 * is registered through `SvgGraphics#createSvgGradient` (T4's
 * seed/counter id policy — see `svg-graphics-core.ts`'s doc comment),
 * NOT through `paint.ts#paintToSvg`'s content-hash id scheme — the two
 * id schemes are deliberately kept separate; only `SvgGraphics`'s is
 * used at this driver seam, matching upstream's `svg.createSvgGradient
 * (...)` call exactly. Our `Paint`'s `Gradient` variant models exactly
 * one gradient shape (2-stop, `color1`/`color2`/`policy`), corresponding
 * to upstream's `HColorGradient` only — there is no port-side equivalent
 * of `HColorLinearGradient` (multi-stop), so that upstream branch (which
 * calls the `createSvgGradient(HColorLinearGradient, ColorMapper)`
 * overload — itself NOT ported, see `svg-graphics-core.ts`'s doc
 * comment) has nothing to dispatch to here and is dropped.
 *
 * Deferred (out of scope, reported): `background.transparentFillBehavior
 * ()` — upstream's second `setFillColor` arg, an `HColor`-only property
 * (`WITH_FILL_NONE` default vs. `WITH_FILL_OPACITY` override) with no
 * representation on this port's `Paint` type (`src/core/paint.ts`, not in
 * this task's write-set). `setFillColor` is called with its default
 * (`TransparentFillBehavior.WITH_FILL_NONE`, see `svg-graphics-core.ts`),
 * matching upstream's overwhelmingly common case — every `HColor` except
 * the rare caller of `withTransparentFillBehavior(WITH_FILL_OPACITY)`
 * (`HColorSimple.java:231`) already resolves to `WITH_FILL_NONE`.
 *
 * `UClip`/`ClipContainer` — not ported (see `URectangle.ts`'s own
 * deferred-methods note); this driver's constructor accordingly takes no
 * `clipContainer` param and never early-returns for an off-clip rect.
 */

import type { UDriver } from '../../AbstractCommonUGraphic.js';
import type { UParam } from '../../UParam.js';
import type { URectangle } from '../../shape/URectangle.js';
import type { SvgGraphics } from './svg-graphics.js';

/** Upstream: `DriverRectangleSvg`. Ported in full (see the module doc
 * comment above for the two `static` helpers' scope). */
export class DriverRectangleSvg implements UDriver<URectangle> {
  constructor(private readonly svg: SvgGraphics) {}

  /** Upstream: `DriverRectangleSvg.applyFillColor(SvgGraphics, ColorMapper, UParam)`. */
  static applyFillColor(svg: SvgGraphics, param: UParam): void {
    const background = param.getBackcolor();
    if (typeof background === 'string') {
      svg.setFillColor(background);
    } else {
      const id = svg.createSvgGradient(background.color1, background.color2, background.policy);
      svg.setFillColor(`url(#${id})`);
    }
  }

  /** Upstream: `DriverRectangleSvg.applyStrokeColor(SvgGraphics, ColorMapper, UParam)`. */
  static applyStrokeColor(svg: SvgGraphics, param: UParam): void {
    const color = param.getColor();
    if (typeof color === 'string') {
      svg.setStrokeColor(color);
    } else {
      const id = svg.createSvgGradient(color.color1, color.color2, color.policy);
      svg.setStrokeColor(`url(#${id})`);
    }
  }

  /** Upstream: `draw(URectangle, double x, double y, ColorMapper, UParam, SvgGraphics)`. */
  draw(rect: URectangle, param: UParam): void {
    const x = param.getTranslate().getDx();
    const y = param.getTranslate().getDy();
    const rx = rect.getRx();
    const ry = rect.getRy();
    const width = rect.getWidth();
    const height = rect.getHeight();

    DriverRectangleSvg.applyFillColor(this.svg, param);
    DriverRectangleSvg.applyStrokeColor(this.svg, param);
    this.svg.setStrokeWidth(param.getStroke().getThickness(), param.getStroke().getDasharraySvg() ?? null);

    // rx/ry halved at serialization time — see URectangle.ts's own note
    // on `rounded()` storing the round value un-halved.
    this.svg.svgRectangle({ x, y, width, height, rx: rx / 2, ry: ry / 2 }, rect.getDeltaShadow());
  }
}
