import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';
import { UPath, USegmentType } from './UPath.js';
import { MinMax } from '../geom/MinMax.js';

/**
 * Bezier — a plain data equivalent of upstream's `XCubicCurve2D`
 * (klimt/geom/XCubicCurve2D.java): the 4 control points of one cubic
 * segment as 8 numeric fields, using upstream's own field names for
 * grep-traceability. The full `XCubicCurve2D` class (`subdivide`,
 * `getFlatnessSq`, `getCtrlP1`/`getCtrlP2`, mutable `setCurve`, ...) is
 * NOT ported — see the deferred-methods note on `DotPath` below for
 * which of its consumers that takes off the table.
 */
export interface Bezier {
  readonly x1: number;
  readonly y1: number;
  readonly ctrlx1: number;
  readonly ctrly1: number;
  readonly ctrlx2: number;
  readonly ctrly2: number;
  readonly x2: number;
  readonly y2: number;
}

function bezierLength(b: Bezier): number {
  const dx = b.x2 - b.x1;
  const dy = b.y2 - b.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Standard point-to-segment squared-distance formula (java.awt.geom
// Line2D algorithm), ported from klimt/geom/XLine2D.java#ptSegDistSq —
// needed by `isLine()` below. Upstream takes 6 loose doubles; here the
// segment endpoints and test point are grouped as `Point2D`s (3 params)
// rather than 6 positional numbers.
function ptSegDistSq(segStart: Point2D, segEnd: Point2D, pt: Point2D): number {
  const x2 = segEnd.x - segStart.x;
  const y2 = segEnd.y - segStart.y;
  let px = pt.x - segStart.x;
  let py = pt.y - segStart.y;
  let dotprod = px * x2 + py * y2;
  let projlenSq: number;
  if (dotprod <= 0) {
    projlenSq = 0;
  } else {
    px = x2 - px;
    py = y2 - py;
    dotprod = px * x2 + py * y2;
    projlenSq = dotprod <= 0 ? 0 : (dotprod * dotprod) / (x2 * x2 + y2 * y2);
  }
  const lenSq = px * px + py * py - projlenSq;
  return lenSq < 0 ? 0 : lenSq;
}

function bezierFlatnessSq(b: Bezier): number {
  const p1 = { x: b.x1, y: b.y1 };
  const p2 = { x: b.x2, y: b.y2 };
  return Math.max(
    ptSegDistSq(p1, p2, { x: b.ctrlx1, y: b.ctrly1 }),
    ptSegDistSq(p1, p2, { x: b.ctrlx2, y: b.ctrly2 }),
  );
}

// Named tuple aliases so lizard's (brace/comma-based) complexity
// scanner does not misattribute a large inline union-tuple type
// literal to the enclosing function's line span (observed with
// `addCurve` during this port — see project complexity-hook notes).
type AddCurveArgs = [Point2D, Point2D, Point2D, Point2D] | [Point2D, Point2D, Point2D];
type MoveEndpointArgs = [number, number] | [MoveDelta];
interface MoveDelta {
  getDx(): number;
  getDy(): number;
}

/**
 * DotPath — the svek edge-spline shape: an ordered list of cubic
 * Bezier segments, the shape `DriverDotPathSvg.java` serializes to an
 * SVG `<path>`.
 *
 * Upstream: klimt/shape/DotPath.java (~706 ln — the largest klimt
 * shape by far). `DriverDotPathSvg.draw` reads exactly ONE method off
 * this shape: `shape.toUPath()` (plus `getDeltaShadow()`, which
 * `DotPath` does not have upstream — it is not `Shadowable`). This
 * task's mission brief, explicit: "port the point/bezier-list surface
 * that DriverDotPathSvg.java serializes ... defer label-position
 * extras unreferenced by the driver, with a note."
 *
 * Ported (the toUPath()-serialization surface, plus cheap
 * self-contained accessors that need no unported geometry class):
 * `fromBeziers`, `copy`, `addCurve` (both the 4-point and
 * last-endpoint-implied 3-point forms), `getStartPoint`/`getEndPoint`,
 * `getBeziers`, `toUPath`, `reverse`, `moveStartPoint`/`moveEndPoint`
 * (needs only `Bezier`'s straight-line length, see `bezierLength`),
 * `moveDelta`, `setCommentAndCodeLine`, `getMinDist`,
 * `getStartAngle`/`getEndAngle` (tangent-line `atan2`, no subdivision
 * needed), `isLine` (needs only point-to-segment distance, ported as
 * `ptSegDistSq`/`bezierFlatnessSq` above), and `getMinMax()` (klimt/geom/
 * limitfinder mission, T1 — write-set expansion, journaled: no longer
 * "not read by the driver" now that `LimitFinder#drawDotPath` reads it
 * directly).
 *
 * Deferred (NOT read by `DriverDotPathSvg`, out of D3' scope,
 * reported — these belong to the svek layout/label-positioning
 * subsystem, a separate future task):
 * - `getMiddle()` / `PointAndAngle` — needs Bezier subdivision
 *   (De Casteljau) + `BezierUtils.getStartingAngle/getEndingAngle`.
 * - `getMinFinder()` — needs the full `MinFinder` class.
 * - `sample()` — needs Bezier subdivision + flatness-driven recursion.
 * - `simulateCompound(head, tail)` — needs `RectangleArea` +
 *   subdivision, for compound-edge clipping against node shapes.
 * - `muteToRoundOrthogonalPaths(radius)` + its private corner-detection
 *   helpers (~190 ln) — an edge-styling heuristic layered on top of the
 *   raw beziers, not part of the driver's serialization contract.
 * - `draw(Graphics2D, x, y)` — AWT drawing; N/A for an SVG-only
 *   renderer (superseded entirely by `toUPath()` + the SVG driver).
 * - `manageEnsureVisible(x, y, visible)` — needs the `EnsureVisible`
 *   interface.
 * - `addBefore`/`addAfter` (both the single-`Bezier` and `DotPath`
 *   overloads) — svek path-stitching utilities used when composing
 *   multi-segment connectors, not by the driver.
 * - The `Moveable` marker interface itself is not ported (matches this
 *   task's `Shadowable`/`UShapeSized` mechanical-adaptation pattern —
 *   `DotPath` exposes the same `moveStartPoint`/`moveEndPoint` methods
 *   structurally, without formally implementing the interface type).
 */
export class DotPath implements UShape {
  private beziers: Bezier[] = [];
  private comment: string | null = null;
  private codeLine: string | null = null;

  copy(): DotPath {
    const result = new DotPath();
    result.beziers = this.beziers.map((b) => ({ ...b }));
    return result;
  }

  static fromBeziers(beziers: readonly Bezier[]): DotPath {
    const result = new DotPath();
    result.beziers = [...beziers];
    return result;
  }

  addCurve(...args: AddCurveArgs): DotPath {
    if (args.length === 3) {
      const last = this.beziers[this.beziers.length - 1];
      if (last === undefined) throw new Error('DotPath.addCurve: no prior segment to imply pt1 from');
      const p1: Point2D = { x: last.x2, y: last.y2 };
      return this.addCurve(p1, args[0], args[1], args[2]);
    }
    const [pt1, pt2, pt3, pt4] = args;
    const bezier: Bezier = {
      x1: pt1.x,
      y1: pt1.y,
      ctrlx1: pt2.x,
      ctrly1: pt2.y,
      ctrlx2: pt3.x,
      ctrly2: pt3.y,
      x2: pt4.x,
      y2: pt4.y,
    };
    return DotPath.fromBeziers([...this.beziers, bezier]);
  }

  getStartPoint(): Point2D {
    const first = this.beziers[0];
    if (first === undefined) throw new Error('DotPath.getStartPoint: empty path');
    return { x: first.x1, y: first.y1 };
  }

  getEndPoint(): Point2D {
    const last = this.beziers[this.beziers.length - 1];
    if (last === undefined) throw new Error('DotPath.getEndPoint: empty path');
    return { x: last.x2, y: last.y2 };
  }

  getBeziers(): readonly Bezier[] {
    return this.beziers;
  }

  /**
   * The running (min,max) bounding box over every bezier's four points
   * (endpoints + control points) — what `LimitFinder#drawDotPath` reads
   * to fold this shape's ink extent into its enclosing `MinMax`
   * accumulator.
   *
   * Upstream: klimt/shape/DotPath.java#getMinMax.
   */
  getMinMax(): MinMax {
    let result = MinMax.getEmpty(false);
    for (const c of this.beziers) {
      result = result.addPoint(c.x1, c.y1);
      result = result.addPoint(c.x2, c.y2);
      result = result.addPoint(c.ctrlx1, c.ctrly1);
      result = result.addPoint(c.ctrlx2, c.ctrly2);
    }
    return result;
  }

  /** THE method `DriverDotPathSvg.java` reads: flattens beziers to a UPath op list. */
  toUPath(): UPath {
    const result = new UPath(this.comment, this.codeLine);
    let start = true;
    for (const bez of this.beziers) {
      if (start) {
        result.add([bez.x1, bez.y1], USegmentType.SEG_MOVETO);
        start = false;
      }
      result.add([bez.ctrlx1, bez.ctrly1, bez.ctrlx2, bez.ctrly2, bez.x2, bez.y2], USegmentType.SEG_CUBICTO);
    }
    return result;
  }

  reverse(): DotPath {
    const reversed = [...this.beziers].reverse().map((c) => reverseBezier(c));
    return DotPath.fromBeziers(reversed);
  }

  moveStartPoint(...args: MoveEndpointArgs): void {
    const [dx, dy] = args.length === 1 ? [args[0].getDx(), args[0].getDy()] : args;
    this.moveStartPointXY(dx, dy);
  }

  private moveStartPointXY(dxIn: number, dyIn: number): void {
    let dx = dxIn;
    let dy = dyIn;
    const first = this.beziers[0];
    if (first === undefined) throw new Error('DotPath.moveStartPoint: empty path');
    if (this.beziers.length > 1 && Math.sqrt(dx * dx + dy * dy) >= bezierLength(first)) {
      const second = this.beziers[1]!;
      dx -= second.x1 - first.x1;
      dy -= second.y1 - first.y1;
      this.beziers.shift();
    }
    const b = this.beziers[0]!;
    this.beziers[0] = { ...b, x1: b.x1 + dx, y1: b.y1 + dy, ctrlx1: b.ctrlx1 + dx, ctrly1: b.ctrly1 + dy };
  }

  moveEndPoint(...args: MoveEndpointArgs): void {
    const [dx, dy] = args.length === 1 ? [args[0].getDx(), args[0].getDy()] : args;
    const idx = this.beziers.length - 1;
    const b = this.beziers[idx];
    if (b === undefined) throw new Error('DotPath.moveEndPoint: empty path');
    this.beziers[idx] = { ...b, x2: b.x2 + dx, y2: b.y2 + dy, ctrlx2: b.ctrlx2 + dx, ctrly2: b.ctrly2 + dy };
  }

  moveDelta(deltaX: number, deltaY: number): void {
    this.beziers = this.beziers.map((c) => ({
      x1: c.x1 + deltaX,
      y1: c.y1 + deltaY,
      ctrlx1: c.ctrlx1 + deltaX,
      ctrly1: c.ctrly1 + deltaY,
      ctrlx2: c.ctrlx2 + deltaX,
      ctrly2: c.ctrly2 + deltaY,
      x2: c.x2 + deltaX,
      y2: c.y2 + deltaY,
    }));
  }

  setCommentAndCodeLine(comment: string | null, codeLine: string | null): void {
    this.comment = comment;
    this.codeLine = codeLine;
  }

  getMinDist(ref: Point2D): number {
    let result = Number.MAX_VALUE;
    for (const c of this.beziers) {
      result = Math.min(
        result,
        Math.hypot(ref.x - c.x1, ref.y - c.y1),
        Math.hypot(ref.x - c.x2, ref.y - c.y2),
        Math.hypot(ref.x - c.ctrlx1, ref.y - c.ctrly1),
        Math.hypot(ref.x - c.ctrlx2, ref.y - c.ctrly2),
      );
    }
    return result;
  }

  getStartAngle(): number {
    const first = this.beziers[0];
    if (first === undefined) throw new Error('DotPath.getStartAngle: empty path');
    let dx = first.ctrlx1 - first.x1;
    let dy = first.ctrly1 - first.y1;
    if (dx === 0 && dy === 0) {
      dx = first.x2 - first.x1;
      dy = first.y2 - first.y1;
    }
    return Math.atan2(dy, dx);
  }

  getEndAngle(): number {
    const last = this.beziers[this.beziers.length - 1];
    if (last === undefined) throw new Error('DotPath.getEndAngle: empty path');
    let dx = last.x2 - last.ctrlx2;
    let dy = last.y2 - last.ctrly2;
    if (dx === 0 && dy === 0) {
      dx = last.x2 - last.x1;
      dy = last.y2 - last.y1;
    }
    return Math.atan2(dy, dx);
  }

  isLine(): boolean {
    return this.beziers.every((c) => bezierFlatnessSq(c) <= 0.001);
  }

  toString(): string {
    return this.beziers
      .map((c) => `(${c.x1},${c.y1}) (${c.ctrlx1},${c.ctrly1}) (${c.ctrlx2},${c.ctrly2}) (${c.x2},${c.y2}) `)
      .join('- ');
  }
}

function reverseBezier(c: Bezier): Bezier {
  return {
    x1: c.x2,
    y1: c.y2,
    ctrlx1: c.ctrlx2,
    ctrly1: c.ctrly2,
    ctrlx2: c.ctrlx1,
    ctrly2: c.ctrly1,
    x2: c.x1,
    y2: c.y1,
  };
}
