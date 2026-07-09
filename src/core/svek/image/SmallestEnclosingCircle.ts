import type { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import { Circle } from './Circle.js';

/**
 * SmallestEnclosingCircle — Welzl's randomized-incremental smallest-
 * enclosing-circle algorithm (deterministic variant, no shuffling —
 * matches upstream exactly). `ContainingEllipse` feeds it every
 * Y-squashed footprint point and reads back `getCircle()`.
 *
 * Upstream: svek/image/SmallestEnclosingCircle.java. Ported in full:
 * `append` (dedupes by point value-equality, matching Java's
 * `List#contains` via `XPoint2D#equals`), `getCircle` (cached until the
 * next `append`), the recursive `findSec` helper.
 */
export class SmallestEnclosingCircle {
  private readonly all: XPoint2D[] = [];
  private lastSolution: Circle | undefined;

  append(pt: XPoint2D): void {
    if (!this.all.some((p) => p.equals(pt))) this.all.push(pt);
    this.lastSolution = undefined;
  }

  getCircle(): Circle {
    if (this.lastSolution === undefined) {
      this.lastSolution = this.findSec(this.all.length, this.all, 0, [...this.all]);
    }
    return this.lastSolution;
  }

  private findSec(n: number, p: readonly XPoint2D[], m: number, b: XPoint2D[]): Circle {
    let sec = this.baseCircle(m, b);
    if (m === 3) return sec;

    for (let i = 0; i < n; i++) {
      if (sec.isOutside(p[i]!)) {
        b[m] = p[i]!;
        sec = this.findSec(i, p, m + 1, b);
      }
    }
    return sec;
  }

  private baseCircle(m: number, b: readonly XPoint2D[]): Circle {
    if (m === 1) return new Circle(b[0]);
    if (m === 2) return Circle.twoPoint(b[0]!, b[1]!);
    if (m === 3) return Circle.getCircle(b[0]!, b[1]!, b[2]!);
    return new Circle();
  }
}
