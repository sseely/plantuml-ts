import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { AbstractUGraphicHorizontalLine } from '../../klimt/drawing/AbstractUGraphicHorizontalLine.js';
import type { Stencil } from '../../klimt/creole/Stencil.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import type { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import type { UEllipse } from '../../klimt/shape/UEllipse.js';
import type { UHorizontalLine } from '../../klimt/shape/UHorizontalLine.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { TextBlockInEllipse } from '../../klimt/shape/TextBlockInEllipse.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';
import { RotatedEllipse } from '../../svek/image/RotatedEllipse.js';
import { USymbol } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';

/**
 * MyUGraphicEllipse — `USymbolUsecase`'s private `UHorizontalLine`
 * clipping wrapper: any Creole horizontal-rule decoration inside the
 * usecase's merged stereotype/label `TextBlock` is clipped to the
 * FITTED ELLIPSE's own curved boundary at each `y` (via `UEllipse
 * .getStartingX`/`getEndingX`), rather than to a rectangle the way
 * `UGraphicStencil` does for every other `USymbol*` family.
 *
 * Upstream: `USymbolUsecase.MyUGraphicEllipse` (a Java static nested
 * class). Ported as a module-local (non-exported) class — same
 * treatment as `Footprint.MyUGraphic` (`Footprint.ts`) — since it has no
 * meaning outside `USymbolUsecase`.
 *
 * Ported in full: the constructor, `copy`, `getNormalized`,
 * `getStartingX/EndingXInternal`, `getStencil2`, `drawHline`.
 */
class MyUGraphicEllipse extends AbstractUGraphicHorizontalLine {
  private readonly startingX: number;
  private readonly yTheoricalPosition: number;
  private readonly ellipse: UEllipse;

  constructor(ug: UGraphic, startingX: number, yTheoricalPosition: number, ellipse: UEllipse) {
    super(ug);
    this.startingX = startingX;
    this.ellipse = ellipse;
    this.yTheoricalPosition = yTheoricalPosition;
  }

  protected copy(ug: UGraphic): AbstractUGraphicHorizontalLine {
    return new MyUGraphicEllipse(ug, this.startingX, this.yTheoricalPosition, this.ellipse);
  }

  private getNormalized(y: number): number {
    if (y < this.yTheoricalPosition) {
      throw new Error('MyUGraphicEllipse.getNormalized: y below yTheoricalPosition');
    }
    const yy = y - this.yTheoricalPosition;
    if (yy > this.ellipse.getHeight()) {
      throw new Error('MyUGraphicEllipse.getNormalized: y above ellipse height');
    }
    return yy;
  }

  private getStartingXInternal(y: number): number {
    return this.startingX + this.ellipse.getStartingX(this.getNormalized(y));
  }

  private getEndingXInternal(y: number): number {
    return this.startingX + this.ellipse.getEndingX(this.getNormalized(y));
  }

  private getStencil2(translate: UTranslate): Stencil {
    const dy = translate.getDy();
    return {
      getStartingX: (_stringBounder: StringBounder, y: number): number => this.getStartingXInternal(y + dy),
      getEndingX: (_stringBounder: StringBounder, y: number): number => this.getEndingXInternal(y + dy),
    };
  }

  protected drawHline(ug: UGraphic, line: UHorizontalLine, translate: UTranslate): void {
    const stroke = UStroke.withThickness(1.5);
    line.drawLineInternal(ug.apply(translate), this.getStencil2(translate), 0, stroke);
  }
}

/**
 * USymbolUsecase — the `usecase`/`usecase/` (business) descriptive/
 * deployment element: an ellipse fitted around its stereotype/label
 * content (`TextBlockInEllipse`), with an optional diagonal "business"
 * slash decoration.
 *
 * Upstream: decoration/symbol/USymbolUsecase.java. Ported in full: the
 * constructor (`isBusiness`), `getSNames`, `specialBusiness`, `drawLine`,
 * `asSmall`, `asBig` (throws), and the nested `MyUGraphicEllipse` class
 * above.
 *
 * `desc` construction (T9 porting-fidelity note — verified against
 * `TextBlockUtils.java:64-69`/`:75-78`): upstream's business-variant call
 * is `TextBlockUtils.withMargin(tmp, 7, 0)` — the Java 3-arg `(textBlock,
 * marginX, marginY)` overload (`marginX=7` both left/right, `marginY=0`
 * both top/bottom), which builds `new TextBlockMarged(tb, marginY,
 * marginX, marginY, marginX)` = `(top=0, right=7, bottom=0, left=7)`.
 * This port's consolidated `TextBlockUtils.withMargin(tb, marginX1,
 * marginX2, marginY1, marginY2)` (T3b) builds `new TextBlockMarged(tb,
 * marginY1, marginX2, marginY2, marginX1)` — a DIFFERENT parameter
 * order, so the naive positional translation `withMargin(tmp, 7, 0)`
 * would silently produce `(top=7, right=0, bottom=0, left=7)`, the WRONG
 * margins. The correct call, reproducing upstream's `(top=0, right=7,
 * bottom=0, left=7)`, is `TextBlockUtils.withMargin(tmp, 7, 7, 0, 0)`
 * (`marginX1=7, marginX2=7, marginY1=0, marginY2=0`) — used below.
 *
 * `UTranslate.point(XPoint2D)` (TS-mechanics deviation, same as
 * `ActorStickMan.ts`'s identical note): `drawLine` composes `new
 * UTranslate(p1.x, p1.y)` directly rather than via a `point()` factory
 * this port's `UTranslate.ts` does not have.
 */
export class USymbolUsecase extends USymbol {
  private readonly isBusiness: boolean;

  constructor(isBusiness: boolean) {
    super();
    this.isBusiness = isBusiness;
  }

  getSNames(): readonly SName[] {
    if (this.isBusiness) return ['usecase', 'business'];
    return ['usecase'];
  }

  private specialBusiness(ug: UGraphic, frontier: UEllipse): void {
    const rotatedEllipse = new RotatedEllipse(frontier, Math.PI / 4);

    const theta1 = (20.0 * Math.PI) / 180;
    const theta2 = rotatedEllipse.getOtherTheta(theta1);

    const frontier2 = frontier.scale(0.99);
    const p1 = frontier2.getPointAtAngle(-theta1);
    const p2 = frontier2.getPointAtAngle(-theta2);
    this.drawLine(ug, p1, p2);
  }

  private drawLine(ug: UGraphic, p1: Point2D, p2: Point2D): void {
    const translated = ug.apply(new UTranslate(p1.x, p1.y));
    translated.draw(new ULine(p2.x - p1.x, p2.y - p1.y));
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    const tmp = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
    const desc = this.isBusiness ? TextBlockUtils.withMargin(tmp, 7, 7, 0, 0) : tmp;
    const isBusiness = this.isBusiness;
    const specialBusiness = (ug: UGraphic, frontier: UEllipse): void => this.specialBusiness(ug, frontier);

    return {
      calculateDimension(stringBounder: StringBounder): XDimension2D {
        return new TextBlockInEllipse(desc, stringBounder).calculateDimension(stringBounder);
      },
      drawU(ug: UGraphic): void {
        const stringBounder = ug.getStringBounder();
        ug = symbolContext.apply(ug);

        const ellipse = new TextBlockInEllipse(desc, stringBounder);
        const ug2: UGraphic = new MyUGraphicEllipse(ug, 0, 0, ellipse.getUEllipse());

        ellipse.drawU(ug2);
        if (isBusiness) specialBusiness(ug, ellipse.getUEllipse());
      },
    };
  }

  asBig(
    _title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    _stereotype: TextBlock,
    _width: number,
    _height: number,
    _symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    throw new Error('USymbolUsecase.asBig: not supported (matches upstream UnsupportedOperationException)');
  }
}
