import { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import { UEllipse } from '../../klimt/shape/UEllipse.js';
import { SmallestEnclosingCircle } from './SmallestEnclosingCircle.js';
import { YTransformer } from './YTransformer.js';

/**
 * ContainingEllipse — the smallest ellipse (of a fixed height/width
 * ratio, `coefY`) enclosing a set of points, computed by Y-squashing the
 * points, running `SmallestEnclosingCircle`, then un-squashing the
 * result. `TextBlockInEllipse` uses this to fit the "actor in an oval"
 * usecase-diagram shape around arbitrary label content.
 *
 * Upstream: svek/image/ContainingEllipse.java. Ported in full: the
 * constructor, `append` (both overloads), `getWidth`/`getHeight`/
 * `getCenter`, `asUEllipse`, `setDeltaShadow`, `toString`.
 */
export class ContainingEllipse {
  private readonly sec = new SmallestEnclosingCircle();
  private readonly ytransformer: YTransformer;
  private deltaShadow = 0;

  constructor(coefY: number) {
    this.ytransformer = new YTransformer(coefY);
  }

  toString(): string {
    return `ContainingEllipse ${this.getWidth()} ${this.getHeight()}`;
  }

  append(ptOrX: XPoint2D | number, y?: number): void {
    const pt = typeof ptOrX === 'number' ? new XPoint2D(ptOrX, y!) : ptOrX;
    this.sec.append(this.ytransformer.getReversePoint2D(pt));
  }

  getWidth(): number {
    return 2 * this.sec.getCircle().getRadius();
  }

  getHeight(): number {
    return 2 * this.sec.getCircle().getRadius() * this.ytransformer.getAlpha();
  }

  getCenter(): XPoint2D {
    return this.ytransformer.getPoint2D(this.sec.getCircle().getCenter());
  }

  asUEllipse(): UEllipse {
    const ellipse = UEllipse.build(this.getWidth(), this.getHeight());
    ellipse.setDeltaShadow(this.deltaShadow);
    return ellipse;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
