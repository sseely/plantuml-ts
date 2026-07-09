import { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import type { UEllipse } from '../../klimt/shape/UEllipse.js';

/**
 * RotatedEllipse — the geometry of an ellipse rotated by a fixed angle
 * `beta`, used only by `USymbolUsecase`'s "business" diagonal-slash
 * decoration to find the two points where a `beta`-rotated chord exits
 * the (unrotated) ellipse boundary.
 *
 * Upstream: svek/image/RotatedEllipse.java. Ported in full: the
 * constructor, `getA`/`getB`/`getBeta`, `getPoint`, `getOtherTheta`, and
 * the private `other` helper (upstream dead code — `other` has no
 * caller anywhere in `RotatedEllipse.java` itself; preserved verbatim
 * per this project's porting discipline rather than dropped).
 */
export class RotatedEllipse {
  private readonly ellipse: UEllipse;
  private readonly beta: number;

  constructor(ellipse: UEllipse, beta: number) {
    this.ellipse = ellipse;
    this.beta = beta;
  }

  getA(): number {
    return this.ellipse.getWidth() / 2;
  }

  getB(): number {
    return this.ellipse.getHeight() / 2;
  }

  getBeta(): number {
    return this.beta;
  }

  getPoint(theta: number): XPoint2D {
    const x = this.getA() * Math.cos(theta);
    const y = this.getB() * Math.sin(theta);

    const xp = x * Math.cos(this.beta) - y * Math.sin(this.beta);
    const yp = x * Math.sin(this.beta) + y * Math.cos(this.beta);

    return new XPoint2D(xp, yp);
  }

  getOtherTheta(theta1: number): number {
    const z = this.getPoint(theta1).getX();
    const a = this.getA() * Math.cos(this.beta);
    const b = this.getB() * Math.sin(this.beta);
    const sum = (2 * a * z) / (a * a + b * b);
    const other = sum - Math.cos(theta1);
    return -Math.acos(other);
  }

  // Preserved dead code (upstream, reported): `other` has no caller in
  // RotatedEllipse.java itself — kept verbatim per this project's
  // porting discipline (see class doc comment).
  private other(all: readonly [number, number], some: number): number {
    const diff0 = Math.abs(some - all[0]);
    const diff1 = Math.abs(some - all[1]);

    if (diff0 > diff1) {
      return all[0];
    }
    return all[1];
  }
}
