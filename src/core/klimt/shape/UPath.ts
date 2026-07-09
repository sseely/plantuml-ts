import type { UShape } from '../UShape.js';
import type { Point2D } from '../UTranslate.js';

/**
 * USegmentType — the six path-op kinds a `UPath` records.
 *
 * Upstream: klimt/geom/USegmentType.java (a Java `enum`). Ported as an
 * as-const string-union object rather than a TS `enum`/`const enum` per
 * project convention (see `.claude/CLAUDE.md` — no `const enum`, prefer
 * as-const objects). `SEG_CLOSE` is kept for parity even though upstream
 * never actually emits it (`UPath#closePath` is a documented no-op — see
 * below); `getNbPoints()` is not ported, nothing in this port's scope
 * reads it.
 */
export const USegmentType = {
  SEG_MOVETO: 'SEG_MOVETO',
  SEG_LINETO: 'SEG_LINETO',
  SEG_QUADTO: 'SEG_QUADTO',
  SEG_CUBICTO: 'SEG_CUBICTO',
  SEG_CLOSE: 'SEG_CLOSE',
  SEG_ARCTO: 'SEG_ARCTO',
} as const;
export type USegmentType = (typeof USegmentType)[keyof typeof USegmentType];

/**
 * USegment — one recorded path operation: its raw coordinate operands
 * (interpretation depends on `segmentType`, exactly as upstream's
 * `double[] coord`) plus the op kind.
 *
 * Upstream: klimt/geom/USegment.java. Ported: the two accessors and
 * `translate`. NOT ported: `rotate`/`affine` — both require
 * `XAffineTransform`, out of scope per this task's geometry-type
 * adaptation (see `UPath` doc comment).
 */
export interface USegment {
  readonly coord: readonly number[];
  readonly segmentType: USegmentType;
}

function translateSegment(seg: USegment, dx: number, dy: number): USegment {
  const c = seg.coord;
  if (seg.segmentType === USegmentType.SEG_ARCTO) {
    return {
      coord: [c[0]!, c[1]!, c[2]!, c[3]!, c[4]!, c[5]! + dx, c[6]! + dy],
      segmentType: seg.segmentType,
    };
  }
  if (seg.segmentType === USegmentType.SEG_CUBICTO) {
    return {
      coord: [c[0]! + dx, c[1]! + dy, c[2]! + dx, c[3]! + dy, c[4]! + dx, c[5]! + dy],
      segmentType: seg.segmentType,
    };
  }
  if (c.length !== 2) throw new Error('translateSegment: unsupported coord length');
  return { coord: [c[0]! + dx, c[1]! + dy], segmentType: seg.segmentType };
}

interface MinMaxState {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function emptyMinMax(): MinMaxState {
  return { minX: Number.MAX_VALUE, minY: Number.MAX_VALUE, maxX: -Number.MAX_VALUE, maxY: -Number.MAX_VALUE };
}

function addPoint(mm: MinMaxState, x: number, y: number): MinMaxState {
  return {
    minX: Math.min(mm.minX, x),
    minY: Math.min(mm.minY, y),
    maxX: Math.max(mm.maxX, x),
    maxY: Math.max(mm.maxY, y),
  };
}

/**
 * UPath — a recorded, replayable path op list (moveTo/lineTo/cubicTo/
 * quadTo/arcTo), the shape `DriverPathSvg.java` and `DotPath#toUPath`
 * serialize to an SVG `<path d="...">`.
 *
 * Upstream: klimt/UPath.java. Ported: the full op-recording surface
 * (`add`, `moveTo`, `lineTo`, `cubicTo`, `quadTo`, `arcTo`, `closePath`),
 * `isEmpty`/`size`/`isInvisible`/`translate`, the min/max bounds
 * accessors, `iterator`/`getComment`/`getCodeLine`, and `deltaShadow`
 * (upstream inherits this from `AbstractShadowable` — see the
 * mechanical adaptation note below).
 *
 * Deferred (out of D3' scope, reported):
 * - `rotate(theta)` / `affine(transform, angle, scale)` — both require
 *   `XAffineTransform`, not part of this port's geometry surface.
 * - `setIgnoreForCompressionOnX/Y` / `isIgnoreForCompressionOn` /
 *   `drawWhenCompressed` — require `CompressionMode` (compression
 *   subsystem), not built yet.
 *
 * Geometry-type adaptation: upstream's `XPoint2D` overloads
 * (`moveTo(XPoint2D)`, etc.) use the `Point2D` `{x, y}` stand-in already
 * established in `UTranslate.ts` (T2), not a new local type. Overloaded
 * Java methods collapse to a single TS method taking a rest-tuple union
 * (`...args`) rather than separate overload signatures with many
 * positional params, to stay under the project's per-function param
 * complexity budget.
 *
 * Mechanical adaptation: `AbstractShadowable` (upstream's shared base
 * class for `getDeltaShadow`/`setDeltaShadow`) is not itself ported —
 * that class lives outside this task's `shape/` write-set. `UPath`
 * implements the same two-method surface directly rather than via a
 * shared base type; TS structural typing makes the formal `Shadowable`
 * marker interface unnecessary. Same adaptation applies to
 * `URectangle`, `UEllipse`, `ULine`, and `UPolygon` below.
 */
export class UPath implements UShape {
  private readonly comment: string | null;
  private readonly codeLine: string | null;
  private readonly segments: USegment[] = [];
  private minmax: MinMaxState = emptyMinMax();
  private deltaShadow = 0;

  constructor(comment: string | null, codeLine: string | null) {
    this.comment = comment;
    this.codeLine = codeLine;
  }

  static none(): UPath {
    return new UPath(null, null);
  }

  add(coord: readonly number[], pathType: USegmentType): void {
    this.addInternal({ coord, segmentType: pathType });
  }

  isEmpty(): boolean {
    return this.segments.length === 0;
  }

  size(): number {
    return this.segments.length;
  }

  private addInternal(segment: USegment): void {
    this.segments.push(segment);
    const coord = segment.coord;
    if (segment.segmentType === USegmentType.SEG_ARCTO) {
      this.minmax = addPoint(this.minmax, coord[5]!, coord[6]!);
    } else {
      for (let i = 0; i < coord.length; i += 2) this.minmax = addPoint(this.minmax, coord[i]!, coord[i + 1]!);
    }
  }

  private getLastCoord(): readonly number[] | null {
    if (this.segments.length === 0) return null;
    return this.segments[this.segments.length - 1]!.coord;
  }

  isInvisible(): boolean {
    return this.segments.every((seg) => seg.segmentType === USegmentType.SEG_MOVETO);
  }

  translate(dx: number, dy: number): UPath {
    if (dx === 0 && dy === 0) return this;
    const result = new UPath(this.comment, this.codeLine);
    for (const seg of this.segments) result.addInternal(translateSegment(seg, dx, dy));
    return result;
  }

  moveTo(...args: [number, number] | [Point2D]): void {
    const [x, y] = args.length === 1 ? [args[0].x, args[0].y] : args;
    const last = this.getLastCoord();
    if (last !== null && last[0] === x && last[1] === y) return;
    this.add([x, y], USegmentType.SEG_MOVETO);
  }

  lineTo(...args: [number, number] | [Point2D]): void {
    const [x, y] = args.length === 1 ? [args[0].x, args[0].y] : args;
    this.add([x, y], USegmentType.SEG_LINETO);
  }

  cubicTo(
    ...args: [number, number, number, number, number, number] | [Point2D, Point2D, Point2D]
  ): void {
    if (args.length === 3) {
      const [p1, p2, p] = args;
      this.add([p1.x, p1.y, p2.x, p2.y, p.x, p.y], USegmentType.SEG_CUBICTO);
      return;
    }
    const [x1, y1, x2, y2, x, y] = args;
    this.add([x1, y1, x2, y2, x, y], USegmentType.SEG_CUBICTO);
  }

  quadTo(...args: [number, number, number, number] | [Point2D, Point2D]): void {
    if (args.length === 2) {
      const [ctrl, pt] = args;
      this.add([ctrl.x, ctrl.y, ctrl.x, ctrl.y, pt.x, pt.y], USegmentType.SEG_CUBICTO);
      return;
    }
    const [ctrlx, ctrly, x2, y2] = args;
    this.add([ctrlx, ctrly, ctrlx, ctrly, x2, y2], USegmentType.SEG_CUBICTO);
  }

  arcTo(
    ...args:
      | [number, number, number, number, number, number, number]
      | [Point2D, number, number, number]
  ): void {
    if (args.length === 4) {
      const [pt, radius, largeArcFlag, sweepFlag] = args;
      this.add([radius, radius, 0, largeArcFlag, sweepFlag, pt.x, pt.y], USegmentType.SEG_ARCTO);
      return;
    }
    const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = args;
    this.add([rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y], USegmentType.SEG_ARCTO);
  }

  /**
   * No-op, faithfully — upstream's `closePath()` body is empty (a
   * commented-out debug print), so no `SEG_CLOSE` segment is ever
   * recorded. Kept as a method for call-site parity with Java callers
   * being ported.
   */
  closePath(): void {
    // Intentionally empty — matches UPath.java#closePath.
  }

  getMaxX(): number {
    return this.minmax.maxX;
  }

  getMaxY(): number {
    return this.minmax.maxY;
  }

  getMinX(): number {
    return this.minmax.minX;
  }

  getMinY(): number {
    return this.minmax.minY;
  }

  toString(): string {
    return this.segments.map((s) => `${s.segmentType} [${s.coord.join(', ')}]`).join(', ');
  }

  iterator(): IterableIterator<USegment> {
    return this.segments[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<USegment> {
    return this.iterator();
  }

  getComment(): string | null {
    return this.comment;
  }

  getCodeLine(): string | null {
    return this.codeLine;
  }

  getDeltaShadow(): number {
    return this.deltaShadow;
  }

  setDeltaShadow(deltaShadow: number): void {
    this.deltaShadow = deltaShadow;
  }
}
