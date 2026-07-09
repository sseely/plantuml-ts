import type { UGraphic } from '../../klimt/UGraphic.js';
import type { Point2D } from '../../klimt/UTranslate.js';
import type { Paint } from '../../paint.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UStroke } from '../../klimt/UStroke.js';
import { Back } from '../../klimt/Back.js';
import { UPolygon } from '../../klimt/shape/UPolygon.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { ULine } from '../../klimt/shape/ULine.js';
import { Extremity } from './Extremity.js';
import type { ExtremityFactory } from './ExtremityFactory.js';
import type { Side } from './Side.js';

const XLEN = -19;
const HALF_WIDTH = 7;

/**
 * extendsLikeRotate — `ExtremityExtendsLike`'s private static nested
 * `Point.rotate(theta)` (svek/extremity/ExtremityExtendsLike.java),
 * ported verbatim. NOTE: this uses a DIFFERENT sign convention than
 * every other extremity class's rotation (`rotate-point.ts`'s
 * `rotatePoint`, which matches `XAffineTransform.getRotateInstance`):
 * `st = -sin(theta)`, `nx = x*ct - y*st`, `ny = -x*st - y*ct` — i.e.
 * `x' = x*cos(theta) + y*sin(theta)`, `y' = x*sin(theta) - y*cos
 * (theta)`. Bug-for-bug per this project's porting discipline: this is
 * upstream's own local, non-standard rotation helper, used ONLY by
 * this class — not a mistake in this port.
 */
function extendsLikeRotate(pt: Point2D, theta: number): Point2D {
  const ct = Math.cos(theta);
  const st = -Math.sin(theta);
  const nx = pt.x * ct - pt.y * st;
  const ny = -pt.x * st - pt.y * ct;
  return { x: nx, y: ny };
}

function addTrigPoint(up: UPolygon, x: number, y: number, angle: number, porig: Point2D): void {
  const r = extendsLikeRotate({ x, y }, angle);
  up.addPoint(r.x + porig.x, r.y + porig.y);
}

/**
 * ExtremityExtendsLike — the "redefines"/"defined-by" hollow-triangle
 * plus bar/dots decor for `LinkDecor.REDEFINES` (`<||`/`||>`) and
 * `LinkDecor.DEFINEDBY` (`<|:`/`:|>`).
 *
 * Upstream: svek/extremity/ExtremityExtendsLike.java (abstract base +
 * two static nested subclasses `Redefines`/`DefinedBy`) +
 * ExtremityFactoryExtendsLike.java. Ported: the base constructor
 * (`trig` polygon + `back`/`contact` fields — `trig`'s own points use
 * `manageround(angle)`, matching upstream's base constructor exactly),
 * `drawU`, `getDecorationLength` (18, fixed), and both subclasses in
 * full.
 *
 * Angle-rounding note (verified against upstream — do not "fix"): the
 * `Redefines`/`DefinedBy` subclasses' OWN bar/dot geometry uses the RAW
 * `angle` constructor parameter directly (`p1.rotate(angle)` /
 * `getDotPos(..., angle, ...)`), NOT the `manageround`-snapped value the
 * base class computes for `trig` — upstream never re-rounds it in the
 * subclass bodies. This port preserves that asymmetry exactly.
 *
 * Name flattening (TS has no static-nested-class equivalent): upstream
 * `ExtremityExtendsLike.Redefines`/`.DefinedBy` become the top-level
 * `ExtremityExtendsLikeRedefines`/`ExtremityExtendsLikeDefinedBy`
 * classes below — same behavior, flattened name path.
 *
 * `DefinedBy#drawU`'s `if (ug.getParam().getColor() != null)` guard is
 * always true in this port (`UParam#getColor()` returns `Paint`, never
 * `null | undefined` — see `UParam.ts`), so it is applied
 * unconditionally rather than re-checked (no null check on a value the
 * type system guarantees non-null, per this project's defensive-code
 * convention). `createTBRDrawableLegacy` NOT ported (see
 * `ExtremityFactory.ts`).
 */
export abstract class ExtremityExtendsLike extends Extremity {
  private readonly trig: UPolygon;
  private readonly back: Back;

  protected constructor(porig: Point2D, angleIn: number, backgroundColor: Paint) {
    super();
    this.back = new Back(backgroundColor);
    const angle = this.manageround(angleIn);
    this.trig = new UPolygon();
    this.trig.addPoint(porig);
    addTrigPoint(this.trig, XLEN, -HALF_WIDTH, angle, porig);
    addTrigPoint(this.trig, XLEN, HALF_WIDTH, angle, porig);
    this.trig.addPoint(porig);
  }

  drawU(ug: UGraphic): void {
    ug.apply(this.back).draw(this.trig);
  }

  override getDecorationLength(): number {
    return 18;
  }
}

/** Upstream: `ExtremityExtendsLike.Redefines` (`LinkDecor.REDEFINES`). */
export class ExtremityExtendsLikeRedefines extends ExtremityExtendsLike {
  private static readonly BAR_STROKE = UStroke.withThickness(2.0);

  private readonly pos: UTranslate;
  private readonly bar: ULine;

  constructor(porig: Point2D, angle: number, backgroundColor: Paint) {
    super(porig, angle, backgroundColor);
    const xsuffix = XLEN * 1.2;
    // Raw `angle`, not manageround(angle) — see the class doc comment's
    // "Angle-rounding note".
    const p1 = extendsLikeRotate({ x: xsuffix, y: -HALF_WIDTH }, angle);
    const p2 = extendsLikeRotate({ x: xsuffix, y: HALF_WIDTH }, angle);
    this.bar = new ULine(p2.x - p1.x, p2.y - p1.y);
    this.pos = new UTranslate(p1.x + porig.x, p1.y + porig.y);
  }

  override drawU(ug: UGraphic): void {
    super.drawU(ug);
    ug.apply(ExtremityExtendsLikeRedefines.BAR_STROKE).apply(this.pos).draw(this.bar);
  }
}

/** Upstream: `ExtremityExtendsLike.DefinedBy` (`LinkDecor.DEFINEDBY`). */
export class ExtremityExtendsLikeDefinedBy extends ExtremityExtendsLike {
  private static readonly DOT_SIZE = 2;

  private readonly pos1: UTranslate;
  private readonly pos2: UTranslate;
  private readonly dot: UEllipse;

  constructor(porig: Point2D, angle: number, backgroundColor: Paint) {
    super(porig, angle, backgroundColor);
    const xsuffix = XLEN * 1.3;
    const size = ExtremityExtendsLikeDefinedBy.DOT_SIZE;
    const w = HALF_WIDTH - size;
    // Raw `angle`, not manageround(angle) — see the class doc comment's
    // "Angle-rounding note".
    this.pos1 = ExtremityExtendsLikeDefinedBy.dotPos(xsuffix, -w, angle, size, porig);
    this.pos2 = ExtremityExtendsLikeDefinedBy.dotPos(xsuffix, w, angle, size, porig);
    this.dot = UEllipse.build(2 * size, 2 * size);
  }

  private static dotPos(x: number, y: number, angle: number, size: number, porig: Point2D): UTranslate {
    const r = extendsLikeRotate({ x, y }, angle);
    return new UTranslate(r.x - size + porig.x, r.y - size + porig.y);
  }

  override drawU(ug: UGraphic): void {
    super.drawU(ug);
    const applied = ug.apply(new Back(ug.getParam().getColor()));
    applied.apply(this.pos1).draw(this.dot);
    applied.apply(this.pos2).draw(this.dot);
  }
}

/** Upstream: svek/extremity/ExtremityFactoryExtendsLike.java. */
export class ExtremityFactoryExtendsLike implements ExtremityFactory {
  private readonly backgroundColor: Paint;
  private readonly definedBy: boolean;

  constructor(backgroundColor: Paint, definedBy: boolean) {
    this.backgroundColor = backgroundColor;
    this.definedBy = definedBy;
  }

  createUDrawable(p0: Point2D, angle: number, _side: Side | null): ExtremityExtendsLike {
    return this.definedBy
      ? new ExtremityExtendsLikeDefinedBy(p0, angle, this.backgroundColor)
      : new ExtremityExtendsLikeRedefines(p0, angle, this.backgroundColor);
  }
}
