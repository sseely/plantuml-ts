import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { Back } from '../../klimt/Back.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';
import { rotateAndTranslate } from './rotate-point.js';

/**
 * ExtremityTriangle — the plain (non-filled-by-default) triangle
 * arrowhead shared by `LinkDecor.EXTENDS` (generalization, `<|`/`|>`)
 * and `LinkDecor.ARROW_TRIANGLE` (`<<`/`>>`).
 *
 * Upstream: svek/extremity/ExtremityTriangle.java +
 * ExtremityFactoryTriangle.java. Ported: the constructor (polygon
 * built at the origin, rotated, translated — see `rotate-point.ts` for
 * why rotation is inlined per-point rather than via a `UPolygon.rotate`
 * mutator this port's `UPolygon` does not have), `drawU`,
 * `getDecorationLength`.
 *
 * `createTBRDrawableLegacy` NOT ported (see `ExtremityFactory.ts`).
 *
 * Fill semantics: both this port's reachable callers
 * (`LinkDecor.EXTENDS` via `getExtremityFactoryComplete`,
 * `LinkDecor.ARROW_TRIANGLE` via `getExtremityFactoryLegacy`)
 * construct with `backgroundColor=null, fill=false` — the actual
 * open-vs-filled look for these two decors is controlled by the OUTER
 * `SvekEdge#drawRainbow` mechanism (`Back(color)` vs `Back('none')`
 * applied to the `UGraphic` BEFORE calling `drawU`, keyed off
 * `LinkDecor.isFill()`), not by this class's own `fill`/`backgroundColor`
 * fields. Both fields are still ported (matching upstream's full
 * constructor signature) since they are real, reachable branches of
 * upstream's OWN class — just never exercised by this port's two
 * current callers.
 *
 * Constructor param collapse (project convention, see `URectangle.ts`'s
 * own `URectangleFields` precedent): upstream's 7-arg constructor
 * collapses into one options object to stay under this project's
 * 5-param-per-function budget. `TriangleGeom` (xWing/yAperture/
 * decorationLength/backgroundColor) is what `ExtremityFactoryTriangle`
 * itself stores; `fill` is added separately since only the direct
 * `ExtremityTriangle` constructor (never this port's factory) ever
 * passes `true`.
 */
export interface TriangleGeom {
  readonly backgroundColor: Paint | null;
  readonly xWing: number;
  readonly yAperture: number;
  readonly decorationLength: number;
}

export class ExtremityTriangle extends Extremity {
  private readonly polygon: UPolygon;
  private readonly fill: boolean;
  private readonly backgroundColor: Paint | null;
  private readonly decorationLength: number;

  constructor(p1: Point2D, angleIn: number, fill: boolean, geom: TriangleGeom) {
    super();
    this.fill = fill;
    this.backgroundColor = geom.backgroundColor;
    this.decorationLength = geom.decorationLength;
    const angle = this.manageround(angleIn) + Math.PI / 2;
    const local: Point2D[] = [
      { x: 0, y: 0 },
      { x: -geom.xWing, y: -geom.yAperture },
      { x: -geom.xWing, y: geom.yAperture },
      { x: 0, y: 0 },
    ];
    this.polygon = new UPolygon(local.map((pt) => rotateAndTranslate(pt, angle, p1)));
  }

  drawU(ug: UGraphic): void {
    let applied = ug;
    if (this.backgroundColor !== null) {
      applied = applied.apply(new Back(this.backgroundColor));
    } else if (this.fill) {
      applied = applied.apply(new Back(applied.getParam().getColor()));
    }
    applied.draw(this.polygon);
  }

  override getDecorationLength(): number {
    return this.decorationLength;
  }
}

/** Upstream: svek/extremity/ExtremityFactoryTriangle.java. */
export class ExtremityFactoryTriangle implements ExtremityFactory {
  private readonly geom: TriangleGeom;

  constructor(geom: TriangleGeom) {
    this.geom = geom;
  }

  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityTriangle {
    return new ExtremityTriangle(p0, angle - Math.PI / 2, false, this.geom);
  }
}
