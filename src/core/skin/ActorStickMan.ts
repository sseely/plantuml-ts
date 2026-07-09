import type { TextBlock } from '../klimt/shape/TextBlock.js';
import type { UGraphic } from '../klimt/UGraphic.js';
import { UTranslate } from '../klimt/UTranslate.js';
import { Back } from '../klimt/Back.js';
import { UEllipse } from '../klimt/shape/UEllipse.js';
import { UPath } from '../klimt/shape/UPath.js';
import { ULine } from '../klimt/shape/ULine.js';
import type { StringBounder } from '../klimt/font/StringBounder.js';
import type { Point2D } from '../klimt/UTranslate.js';
import { XDimension2D } from '../klimt/geom/XDimension2D.js';
import type { SymbolContext } from '../decoration/symbol/SymbolContext.js';

/**
 * ActorStickMan — the stick-figure drawn for `actor`/`actor/` (business)
 * entities: a head circle plus a body/arms/legs path, with an optional
 * diagonal "business" slash across the head.
 *
 * Upstream: skin/ActorStickMan.java. Ported in full: the constructor,
 * `drawU`, `specialBusiness`, `getOnCircle`, `thickness`,
 * `getPreferredWidth`/`getPreferredHeight`, `calculateDimension`.
 *
 * Shared by `USymbolActor` (constructed with `actorBusiness=false`) and
 * `USymbolActorBusiness` (via `ActorStyle.STICKMAN_BUSINESS`, `true`) —
 * "Actor vs ActorBusiness: the slash is the only delta" (T9 acceptance
 * criterion 2) falls directly out of this one class's `actorBusiness`
 * flag; no separate business-variant class exists upstream or here.
 *
 * `HColors.none().bg()` seam: upstream draws the body/limb path with the
 * ambient foreground stroke but an explicit "no fill" background — this
 * port's equivalent is `new Back('none')` (see `Back.ts`'s own doc
 * comment on the `NONE_PAINT` convention), applied AFTER `fashion.apply`
 * so it overrides only the fill, not the stroke color already set by the
 * `Fashion`/`SymbolContext` apply.
 *
 * `UTranslate.point(XPoint2D)` (TS-mechanics deviation, reported):
 * upstream's `getOnCircle`/`specialBusiness` do not actually call
 * `UTranslate.point` (that factory is `USymbolUsecase`'s own
 * `drawLine` helper) — this class instead composes `new UTranslate(p.x,
 * p.y)` directly from the `Point2D`-shaped return of `getOnCircle`,
 * since this port's `UTranslate.ts` does not carry a `point(XPoint2D)`
 * factory (see that file's own doc comment) and `Point2D`'s `{x,y}`
 * shape is already what the constructor needs — no behavioral
 * difference from upstream, which does the same composition via a
 * two-arg `UTranslate` construction at this call site.
 */
export class ActorStickMan implements TextBlock {
  private readonly armsY = 8;
  private readonly armsLenght = 13;
  private readonly bodyLenght = 27;
  private readonly legsX = 13;
  private readonly legsY = 15;
  private readonly headDiam = 16;

  private readonly fashion: SymbolContext;
  private readonly actorBusiness: boolean;

  constructor(fashion: SymbolContext, actorBusiness: boolean) {
    this.fashion = fashion;
    this.actorBusiness = actorBusiness;
  }

  drawU(ug: UGraphic): void {
    const startX = Math.max(this.armsLenght, this.legsX) - this.headDiam / 2 + this.thickness();

    const head = UEllipse.build(this.headDiam, this.headDiam);
    const centerX = startX + this.headDiam / 2;

    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(0, this.bodyLenght);
    path.moveTo(-this.armsLenght, this.armsY);
    path.lineTo(this.armsLenght, this.armsY);
    path.moveTo(0, this.bodyLenght);
    path.lineTo(-this.legsX, this.bodyLenght + this.legsY);
    path.moveTo(0, this.bodyLenght);
    path.lineTo(this.legsX, this.bodyLenght + this.legsY);
    if (this.fashion.getDeltaShadow() !== 0) {
      head.setDeltaShadow(this.fashion.getDeltaShadow());
      path.setDeltaShadow(this.fashion.getDeltaShadow());
    }

    const applied = this.fashion.apply(ug);
    applied.apply(new UTranslate(startX, this.thickness())).draw(head);
    if (this.actorBusiness) {
      this.specialBusiness(applied.apply(new UTranslate(startX + this.headDiam / 2, this.thickness() + this.headDiam / 2)));
    }
    applied.apply(new UTranslate(centerX, this.headDiam + this.thickness())).apply(new Back('none')).draw(path);
  }

  private specialBusiness(ug: UGraphic): void {
    const alpha = (21 * Math.PI) / 64;
    const p1 = this.getOnCircle(Math.PI / 4 + alpha);
    const p2 = this.getOnCircle(Math.PI / 4 - alpha);
    const translated = ug.apply(new UTranslate(p1.x, p1.y));
    translated.draw(new ULine(p2.x - p1.x, p2.y - p1.y));
  }

  private getOnCircle(alpha: number): Point2D {
    const x = (this.headDiam / 2) * Math.cos(alpha);
    const y = (this.headDiam / 2) * Math.sin(alpha);
    return { x, y };
  }

  private thickness(): number {
    return this.fashion.getStroke().getThickness();
  }

  getPreferredWidth(): number {
    return Math.max(this.armsLenght, this.legsX) * 2 + 2 * this.thickness();
  }

  getPreferredHeight(): number {
    return this.headDiam + this.bodyLenght + this.legsY + 2 * this.thickness() + this.fashion.getDeltaShadow() + 1;
  }

  calculateDimension(_stringBounder: StringBounder): XDimension2D {
    return new XDimension2D(this.getPreferredWidth(), this.getPreferredHeight());
  }
}
