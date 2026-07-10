import type { UGraphic } from '../UGraphic.js';
import { UStroke } from '../UStroke.js';
import type { UTranslate } from '../UTranslate.js';
import type { Stencil } from '../creole/Stencil.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import type { UHorizontalLine } from '../shape/UHorizontalLine.js';
import { AbstractUGraphicHorizontalLine } from './AbstractUGraphicHorizontalLine.js';

/**
 * UGraphicStencil — wraps a `UGraphic` so any `UHorizontalLine` shape
 * drawn through it (a Creole horizontal-rule decoration inside a
 * `TextBlock`) is clipped to a rectangle's width instead of extending
 * across the whole page. This is the seam every `USymbol*#asSmall` opens
 * its `drawU` with (`ug = UGraphicStencil.create(ug, dim)`), documented
 * as a no-op placeholder across the whole `USymbol*` family until this
 * class existed.
 *
 * Upstream: klimt/drawing/UGraphicStencil.java. Ported: both `create`
 * factories, `getRectangleStencil`, the constructor, `copy`, `drawHline`.
 */
export class UGraphicStencil extends AbstractUGraphicHorizontalLine {
  private readonly stencil: Stencil;
  private readonly defaultStroke: UStroke;

  static create(ug: UGraphic, stencilOrDim: Stencil | XDimension2D, defaultStroke?: UStroke): UGraphic {
    if (UGraphicStencil.isStencil(stencilOrDim)) {
      return new UGraphicStencil(ug, stencilOrDim, defaultStroke ?? UStroke.simple());
    }
    return new UGraphicStencil(ug, UGraphicStencil.getRectangleStencil(stencilOrDim), UStroke.simple());
  }

  private static isStencil(value: Stencil | XDimension2D): value is Stencil {
    return typeof (value as Partial<Stencil>).getStartingX === 'function';
  }

  private static getRectangleStencil(dim: XDimension2D): Stencil {
    return {
      getStartingX: (_stringBounder: StringBounder, _y: number): number => 0,
      getEndingX: (_stringBounder: StringBounder, _y: number): number => dim.getWidth(),
    };
  }

  private constructor(ug: UGraphic, stencil: Stencil, defaultStroke: UStroke) {
    super(ug);
    this.stencil = stencil;
    this.defaultStroke = defaultStroke;
  }

  protected copy(ug: UGraphic): AbstractUGraphicHorizontalLine {
    return new UGraphicStencil(ug, this.stencil, this.defaultStroke);
  }

  protected drawHline(ug: UGraphic, line: UHorizontalLine, translate: UTranslate): void {
    line.drawLineInternal(ug, this.stencil, translate.getDy(), this.defaultStroke);
  }
}
