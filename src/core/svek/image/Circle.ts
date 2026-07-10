import { XPoint2D } from '../../klimt/geom/XPoint2D.js';

/**
 * Circle — a center + radius, with the 3-point "circumscribed circle"
 * constructor `SmallestEnclosingCircle`'s Welzl-style recursion needs.
 *
 * Upstream: svek/image/Circle.java. Ported in full: all four
 * constructors (default, 1-point, 2-point, 3-point — the 3-point ctor
 * is private, reached only via `getCircle`), `getCircle` (the
 * degenerate-input reordering factory), `getCenter`/`getRadius`,
 * `isOutside`.
 */
export class Circle {
  private center: XPoint2D;
  private radius: number;

  constructor(center: XPoint2D = new XPoint2D(0, 0)) {
    this.center = center;
    this.radius = 0;
  }

  static twoPoint(p1: XPoint2D, p2: XPoint2D): Circle {
    const center = new XPoint2D((p1.getX() + p2.getX()) / 2, (p1.getY() + p2.getY()) / 2);
    const circle = new Circle(center);
    circle.radius = p1.distance(center);
    return circle;
  }

  static getCircle(p1: XPoint2D, p2: XPoint2D, p3: XPoint2D): Circle {
    if (p3.getY() !== p2.getY()) return Circle.threePoint(p1, p2, p3);
    return Circle.threePoint(p2, p1, p3);
  }

  private static threePoint(p1: XPoint2D, p2: XPoint2D, p3: XPoint2D): Circle {
    const num1 =
      p3.getX() * p3.getX() * (p1.getY() - p2.getY()) +
      (p1.getX() * p1.getX() + (p1.getY() - p2.getY()) * (p1.getY() - p3.getY())) * (p2.getY() - p3.getY()) +
      p2.getX() * p2.getX() * (-p1.getY() + p3.getY());
    const den1 =
      2 *
      (p3.getX() * (p1.getY() - p2.getY()) + p1.getX() * (p2.getY() - p3.getY()) + p2.getX() * (-p1.getY() + p3.getY()));
    const x = num1 / den1;
    const den2 = p3.getY() - p2.getY();
    const y = (p2.getY() + p3.getY()) / 2 - ((p3.getX() - p2.getX()) / den2) * (x - (p2.getX() + p3.getX()) / 2);
    const center = new XPoint2D(x, y);
    const circle = new Circle(center);
    circle.radius = center.distance(p1);
    return circle;
  }

  getCenter(): XPoint2D {
    return this.center;
  }

  getRadius(): number {
    return this.radius;
  }

  isOutside(point: XPoint2D): boolean {
    return this.center.distance(point) > this.radius;
  }
}
