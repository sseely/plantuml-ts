import type { UChange } from '../../klimt/UChange.js';
import type { UShape } from '../../klimt/UShape.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { UParam } from '../../klimt/UParam.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { Back } from '../../klimt/Back.js';
import { Fore } from '../../klimt/Fore.js';
import type { UDrawable } from '../../klimt/shape/UDrawable.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import { UText } from '../../klimt/shape/UText.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { URectangle } from '../../klimt/shape/URectangle.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { UEmpty } from '../../klimt/shape/UEmpty.js';
import { UImage } from '../../klimt/shape/UImage.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { UHorizontalLine } from '../../klimt/shape/UHorizontalLine.js';
import { ContainingEllipse } from './ContainingEllipse.js';

/**
 * MyUGraphic — Footprint's private point-collecting `UGraphic`: instead
 * of rendering anything, `draw(shape)` records the corner points of
 * whatever shape a `UDrawable` draws through it, so `ContainingEllipse`
 * can fit a smallest-enclosing ellipse around them.
 *
 * Upstream: `Footprint.MyUGraphic` (a Java inner class, package-private
 * within `Footprint.java`). Ported as a module-local (non-exported)
 * class since it has no meaning outside `Footprint`.
 *
 * Scope reduction (this task — matches this port's narrower `UGraphic`
 * interface, T2): implements `UGraphic` directly rather than extending
 * `UGraphicNo` (upstream's base) — `UGraphicNo` requires `Url`/`UGroup`/
 * `HColor`/`ColorMapper`/`OutputStream` members this port's `UGraphic`
 * interface does not have at all (see `UGraphic.ts`'s own scope
 * reduction). `getColorMapper()` is dropped for the same reason (not on
 * this port's `UGraphic`). `apply`'s upstream guard
 * (`instanceOfAny(change, UBackground, HColor, UStroke, UTranslate)`,
 * throwing `UnsupportedOperationException` otherwise) narrows to this
 * port's actually-constructible `UChange` types (`UStroke`, `Back`,
 * `Fore`, `UTranslate`) — `UBackground`/`HColor` are not separate
 * `UChange` types in this port (see `Back.ts`/`Fore.ts`); any other
 * `UChange` falls through to the same "unsupported" throw.
 *
 * Shape dispatch: `UText`/`UHorizontalLine`/`ULine`/`UPath`/`URectangle`/
 * `UEllipse`/`UEmpty`/`UImage` are ported 1:1 from upstream's
 * `draw(UShape)` branches (`UImage` added SI5b+E2r T7 write-set expansion,
 * journaled — D7 sprite/img inline-atom rendering can now reach a usecase
 * ellipse's footprint fit via `TextBlockInEllipse`).
 */
class MyUGraphic implements UGraphic {
  private readonly stringBounder: StringBounder;
  private readonly translate: UTranslate;
  readonly all: XPoint2D[] = [];

  constructor(stringBounder: StringBounder, translate: UTranslate = UTranslate.none(), all: XPoint2D[] = []) {
    this.stringBounder = stringBounder;
    this.translate = translate;
    this.all = all;
  }

  getStringBounder(): StringBounder {
    return this.stringBounder;
  }

  getTranslate(): UTranslate {
    return this.translate;
  }

  getParam(): UParam {
    return {
      getStroke: () => UStroke.simple(),
      getColor: () => 'none',
      getBackcolor: () => 'none',
      getTranslate: () => this.translate,
    };
  }

  apply(change: UChange): UGraphic {
    const nextTranslate = change instanceof UTranslate ? this.translate.compose(change) : this.translate;
    if (
      !(change instanceof UTranslate) &&
      !(change instanceof UStroke) &&
      !(change instanceof Back) &&
      !(change instanceof Fore)
    ) {
      throw new Error(`Footprint.MyUGraphic.apply: unsupported UChange ${change.constructor.name}`);
    }
    return new MyUGraphic(this.stringBounder, nextTranslate, this.all);
  }

  private addPoint(x: number, y: number): void {
    this.all.push(new XPoint2D(x, y));
  }

  private drawText(x: number, y: number, text: UText): void {
    const dim = this.stringBounder.calculateDimension(text.getFontConfiguration(), text.getText());
    const yy = y - (dim.getHeight() - 1.5);
    this.addPoint(x, yy);
    this.addPoint(x, yy + dim.getHeight());
    this.addPoint(x + dim.getWidth(), yy);
    this.addPoint(x + dim.getWidth(), yy + dim.getHeight());
  }

  /** @see Footprint.java's inner `MyUGraphic#drawImage`. */
  private drawImage(x: number, y: number, image: UImage): void {
    this.addPoint(x, y);
    this.addPoint(x, y + image.getHeight());
    this.addPoint(x + image.getWidth(), y);
    this.addPoint(x + image.getWidth(), y + image.getHeight());
  }

  private drawPath(x: number, y: number, shape: UPath): void {
    this.addPoint(x + shape.getMinX(), y + shape.getMinY());
    this.addPoint(x + shape.getMaxX(), y + shape.getMaxY());
  }

  private drawRectangleLike(x: number, y: number, width: number, height: number): void {
    this.addPoint(x, y);
    this.addPoint(x + width, y + height);
  }

  draw(shape: UShape): void {
    const x = this.translate.getDx();
    const y = this.translate.getDy();
    if (shape instanceof UText) return this.drawText(x, y, shape);
    if (shape instanceof UHorizontalLine) return;
    if (shape instanceof ULine) return;
    if (shape instanceof UImage) return this.drawImage(x, y, shape);
    if (shape instanceof UPath) return this.drawPath(x, y, shape);
    if (shape instanceof URectangle) return this.drawRectangleLike(x, y, shape.getWidth(), shape.getHeight());
    if (shape instanceof UEllipse) return this.drawRectangleLike(x, y, shape.getWidth(), shape.getHeight());
    if (shape instanceof UEmpty) return this.drawRectangleLike(x, y, shape.getWidth(), shape.getHeight());
    throw new Error(`Footprint.MyUGraphic.draw: unsupported shape ${shape.constructor.name}`);
  }
}

/**
 * Footprint — measures a `UDrawable`'s drawn footprint (every corner
 * point of every shape it draws) and fits a `ContainingEllipse` (of
 * aspect ratio `alpha`) around them. `TextBlockInEllipse` is the sole
 * caller.
 *
 * Upstream: svek/image/Footprint.java. Ported: the constructor,
 * `getEllipse`.
 */
export class Footprint {
  private readonly stringBounder: StringBounder;

  constructor(stringBounder: StringBounder) {
    this.stringBounder = stringBounder;
  }

  getEllipse(drawable: UDrawable, alpha: number): ContainingEllipse {
    const ug = new MyUGraphic(this.stringBounder);
    drawable.drawU(ug);
    const circle = new ContainingEllipse(alpha);
    for (const pt of ug.all) circle.append(pt);
    return circle;
  }
}
