import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import { Back } from '../../klimt/Back.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotateAndTranslate } from './rotate-point.js';

/**
 * ExtremityDiamond — the diamond decor for `LinkDecor.AGGREGATION`
 * (`o`, hollow) and `LinkDecor.COMPOSITION` (`*`, filled).
 *
 * Upstream: svek/extremity/ExtremityDiamond.java +
 * ExtremityFactoryDiamond.java. Ported: the constructor, `drawU`,
 * `getDecorationLength` (12, fixed).
 *
 * NOT ported: `getDeltaForKal()` / the `deltaForKal` field (see
 * `Extremity.ts`'s doc comment — Kal is not part of this port) and the
 * commented-out `isTooSmallSoGiveThePointCloserToThisOne` (dead in
 * upstream itself). `createTBRDrawableLegacy` NOT ported (see
 * `ExtremityFactory.ts`).
 */
export class ExtremityDiamond extends Extremity {
  private readonly polygon: UPolygon;
  private readonly fill: boolean;

  constructor(p1: Point2D, angleIn: number, fill: boolean) {
    super();
    this.fill = fill;
    const angle = this.manageround(angleIn) + Math.PI / 2;
    const xWing = 6;
    const yAperture = 4;
    const local: Point2D[] = [
      { x: 0, y: 0 },
      { x: -xWing, y: -yAperture },
      { x: -xWing * 2, y: 0 },
      { x: -xWing, y: yAperture },
      { x: 0, y: 0 },
    ];
    this.polygon = new UPolygon(local.map((pt) => rotateAndTranslate(pt, angle, p1)));
  }

  drawU(ug: UGraphic): void {
    const applied = this.fill ? ug.apply(new Back(ug.getParam().getColor())) : ug.apply(new Back('none'));
    applied.draw(this.polygon);
  }

  override getDecorationLength(): number {
    return 12;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryDiamond.java. */
export class ExtremityFactoryDiamond implements ExtremityFactory {
  private readonly fill: boolean;

  constructor(fill: boolean) {
    this.fill = fill;
  }

  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityDiamond {
    return new ExtremityDiamond(p0, angle - Math.PI / 2, this.fill);
  }
}
