import { XPoint2D } from '../../klimt/geom/XPoint2D.js';

/**
 * YTransformer — scales a point's Y coordinate by a fixed `alpha`
 * (and its inverse). `ContainingEllipse` uses this to fit an ellipse
 * (rather than a circle) around a `TextBlock`'s footprint points, by
 * "squashing" Y before running the circle-enclosing algorithm and then
 * un-squashing the result.
 *
 * Upstream: svek/image/YTransformer.java. Ported in full: the
 * constructor (incl. its `NaN → 1` guard), `getPoint2D`/
 * `getReversePoint2D`, `getAlpha`.
 */
export class YTransformer {
  private readonly alpha: number;

  constructor(alpha: number) {
    this.alpha = Number.isNaN(alpha) ? 1 : alpha;
  }

  getPoint2D(pt: XPoint2D): XPoint2D {
    return new XPoint2D(pt.getX(), pt.getY() * this.alpha);
  }

  getReversePoint2D(pt: XPoint2D): XPoint2D {
    return new XPoint2D(pt.getX(), pt.getY() / this.alpha);
  }

  getAlpha(): number {
    return this.alpha;
  }
}
