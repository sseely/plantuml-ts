import { describe, expect, it } from 'vitest';
import { UPath, USegmentType } from '../../../../src/core/klimt/shape/UPath.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UEllipse } from '../../../../src/core/klimt/shape/UEllipse.js';
import { ULine } from '../../../../src/core/klimt/shape/ULine.js';
import { UPolygon } from '../../../../src/core/klimt/shape/UPolygon.js';
import { UText, FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UComment } from '../../../../src/core/klimt/shape/UComment.js';
import { UGroup, UGroupType, getSvgKeyAttributeName } from '../../../../src/core/klimt/shape/UGroup.js';
import { DotPath } from '../../../../src/core/klimt/shape/DotPath.js';

describe('UPath', () => {
  it('records moveTo/cubicTo/closePath in exact operand order (AC1)', () => {
    const w = 20;
    const path = UPath.none();
    path.moveTo(0, 10);
    path.cubicTo(0, 0, w / 2, 0, w / 2, 0);
    path.lineTo(w, 10);
    path.closePath();

    const ops = [...path];
    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({ coord: [0, 10], segmentType: USegmentType.SEG_MOVETO });
    expect(ops[1]).toEqual({ coord: [0, 0, w / 2, 0, w / 2, 0], segmentType: USegmentType.SEG_CUBICTO });
    expect(ops[2]).toEqual({ coord: [w, 10], segmentType: USegmentType.SEG_LINETO });
  });

  it('closePath is a faithful no-op (matches UPath.java)', () => {
    const path = UPath.none();
    path.moveTo(0, 0);
    path.closePath();
    expect(path.size()).toBe(1);
  });

  it('dedupes a moveTo that repeats the last coordinate', () => {
    const path = UPath.none();
    path.moveTo(5, 5);
    path.moveTo(5, 5);
    expect(path.size()).toBe(1);
  });

  it('accepts Point2D-object overloads equivalent to (x, y) overloads', () => {
    const a = UPath.none();
    a.moveTo(1, 2);
    a.lineTo(3, 4);

    const b = UPath.none();
    b.moveTo({ x: 1, y: 2 });
    b.lineTo({ x: 3, y: 4 });

    expect([...b]).toEqual([...a]);
  });

  it('quadTo records a SEG_CUBICTO with duplicated control points', () => {
    const path = UPath.none();
    path.quadTo(5, 5, 10, 0);
    expect([...path]).toEqual([{ coord: [5, 5, 5, 5, 10, 0], segmentType: USegmentType.SEG_CUBICTO }]);
  });

  it('arcTo records the 7-operand SEG_ARCTO tuple in order', () => {
    const path = UPath.none();
    path.arcTo(3, 3, 0, 0, 1, 10, 10);
    expect([...path]).toEqual([{ coord: [3, 3, 0, 0, 1, 10, 10], segmentType: USegmentType.SEG_ARCTO }]);
  });

  it('tracks min/max bounds across ops, including arcTo endpoint-only', () => {
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(10, 20);
    path.arcTo(100, 100, 0, 0, 1, 5, 5);
    expect(path.getMinX()).toBe(0);
    expect(path.getMinY()).toBe(0);
    expect(path.getMaxX()).toBe(10);
    expect(path.getMaxY()).toBe(20);
  });

  it('isInvisible is true iff every op is SEG_MOVETO', () => {
    const invisible = UPath.none();
    invisible.moveTo(0, 0);
    expect(invisible.isInvisible()).toBe(true);

    invisible.lineTo(1, 1);
    expect(invisible.isInvisible()).toBe(false);
  });

  it('isEmpty reflects op count', () => {
    const path = UPath.none();
    expect(path.isEmpty()).toBe(true);
    path.moveTo(0, 0);
    expect(path.isEmpty()).toBe(false);
  });

  it('translate(0,0) returns the same instance (identity fast-path)', () => {
    const path = UPath.none();
    path.moveTo(1, 1);
    expect(path.translate(0, 0)).toBe(path);
  });

  it('translate shifts every coordinate operand and preserves op order', () => {
    const path = UPath.none();
    path.moveTo(0, 0);
    path.cubicTo(1, 1, 2, 2, 3, 3);
    const moved = path.translate(10, 100);
    expect([...moved]).toEqual([
      { coord: [10, 100], segmentType: USegmentType.SEG_MOVETO },
      { coord: [11, 101, 12, 102, 13, 103], segmentType: USegmentType.SEG_CUBICTO },
    ]);
  });

  it('translates an arcTo segment only on its endpoint (x, y)', () => {
    const path = UPath.none();
    path.arcTo(3, 3, 0, 0, 1, 10, 10);
    const moved = path.translate(5, 5);
    expect([...moved]).toEqual([{ coord: [3, 3, 0, 0, 1, 15, 15], segmentType: USegmentType.SEG_ARCTO }]);
  });

  it('deltaShadow round-trips (AC4)', () => {
    const path = UPath.none();
    expect(path.getDeltaShadow()).toBe(0);
    path.setDeltaShadow(4.5);
    expect(path.getDeltaShadow()).toBe(4.5);
  });

  it('exposes comment and codeLine as constructed', () => {
    const path = new UPath('a comment', 'file.puml:12');
    expect(path.getComment()).toBe('a comment');
    expect(path.getCodeLine()).toBe('file.puml:12');
  });

  it('cubicTo accepts a 3-Point2D-object overload equivalent to the 6-number form', () => {
    const a = UPath.none();
    a.cubicTo(0, 0, 1, 1, 2, 2);

    const b = UPath.none();
    b.cubicTo({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 });

    expect([...b]).toEqual([...a]);
  });

  it('quadTo accepts a 2-Point2D-object overload equivalent to the 4-number form', () => {
    const a = UPath.none();
    a.quadTo(5, 5, 10, 0);

    const b = UPath.none();
    b.quadTo({ x: 5, y: 5 }, { x: 10, y: 0 });

    expect([...b]).toEqual([...a]);
  });

  it('arcTo accepts a (Point2D, radius, largeArcFlag, sweepFlag) overload', () => {
    const a = UPath.none();
    a.arcTo(3, 3, 0, 0, 1, 10, 10);

    const b = UPath.none();
    b.arcTo({ x: 10, y: 10 }, 3, 0, 1);

    expect([...b]).toEqual([...a]);
  });

  it('toString renders every op as "TYPE [coords]", comma-joined', () => {
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(1, 1);
    expect(path.toString()).toBe('SEG_MOVETO [0, 0], SEG_LINETO [1, 1]');
  });

  it('translate throws on a malformed (non-2-coord) MOVETO/LINETO segment', () => {
    // Defensive guard mirroring upstream USegment#translate's
    // UnsupportedOperationException — only reachable via a manually
    // malformed op list, not through the faithful moveTo/lineTo API.
    const path = UPath.none();
    path.add([1, 2, 3], USegmentType.SEG_MOVETO);
    expect(() => path.translate(1, 1)).toThrow('unsupported coord length');
  });
});

describe('URectangle', () => {
  it('build(w, h) exposes width/height with rx/ry defaulting to 0', () => {
    const rect = URectangle.build(15, 10);
    expect(rect.getWidth()).toBe(15);
    expect(rect.getHeight()).toBe(10);
    expect(rect.getRx()).toBe(0);
    expect(rect.getRy()).toBe(0);
  });

  it('rounded(r) stores r directly as rx AND ry — unhalved (AC2)', () => {
    const rect = URectangle.build(15, 10).rounded(5);
    expect(rect.getWidth()).toBe(15);
    expect(rect.getHeight()).toBe(10);
    expect(rect.getRx()).toBe(5);
    expect(rect.getRy()).toBe(5);
  });

  it('build accepts a {width, height} dimension object', () => {
    const rect = URectangle.build({ width: 8, height: 4 });
    expect(rect.getWidth()).toBe(8);
    expect(rect.getHeight()).toBe(4);
  });

  it('withWidth/withHeight return new immutable instances', () => {
    const rect = URectangle.build(15, 10);
    const wider = rect.withWidth(30);
    expect(wider.getWidth()).toBe(30);
    expect(wider.getHeight()).toBe(10);
    expect(rect.getWidth()).toBe(15);
  });

  it('throws on a zero width or height (matches URectangle.java)', () => {
    expect(() => URectangle.build(0, 10)).toThrow('width=0');
    expect(() => URectangle.build(10, 0)).toThrow('height=0');
  });

  it('diagonalCorner(0) returns the same instance', () => {
    const rect = URectangle.build(10, 10);
    expect(rect.diagonalCorner(0)).toBe(rect);
  });

  it('diagonalCorner(n) returns a 9-point UPath outline', () => {
    const rect = URectangle.build(10, 10);
    const outline = rect.diagonalCorner(2);
    expect(outline).toBeInstanceOf(UPath);
    expect((outline as UPath).size()).toBe(9);
  });

  it('halfRounded(0) returns the same instance', () => {
    const rect = URectangle.build(10, 10);
    expect(rect.halfRounded(0)).toBe(rect);
  });

  it('halfRounded(n) returns a UPath with two arcTo segments', () => {
    const rect = URectangle.build(10, 10);
    const outline = rect.halfRounded(4) as UPath;
    const arcOps = [...outline].filter((op) => op.segmentType === USegmentType.SEG_ARCTO);
    expect(arcOps).toHaveLength(2);
  });

  it('deltaShadow round-trips', () => {
    const rect = URectangle.build(10, 10);
    rect.setDeltaShadow(3);
    expect(rect.getDeltaShadow()).toBe(3);
  });

  it('carries deltaShadow across withHeight/withWidth', () => {
    const rect = URectangle.build(10, 10);
    rect.setDeltaShadow(7);
    expect(rect.withHeight(20).getDeltaShadow()).toBe(7);
    expect(rect.withWidth(20).getDeltaShadow()).toBe(7);
  });

  it('ignoreForCompressionOnX/Y derive new instances and gate diagonalCorner', () => {
    const rect = URectangle.build(10, 10);
    const ignoredX = rect.ignoreForCompressionOnX();
    const ignoredY = rect.ignoreForCompressionOnY();
    expect(() => ignoredX.diagonalCorner(2)).toThrow('illegal state');
    expect(() => ignoredY.diagonalCorner(2)).toThrow('illegal state');
    expect(() => rect.diagonalCorner(2)).not.toThrow();
  });

  it('toString reports width and height', () => {
    expect(URectangle.build(15, 10).toString()).toBe('width=15 height=10');
  });
});

describe('UEllipse', () => {
  it('build(w, h) defaults start/extend to 0', () => {
    const e = UEllipse.build(40, 20);
    expect(e.getWidth()).toBe(40);
    expect(e.getHeight()).toBe(20);
    expect(e.getStart()).toBe(0);
    expect(e.getExtend()).toBe(0);
  });

  it('getDimension returns {width, height}', () => {
    const e = UEllipse.build(40, 20);
    expect(e.getDimension()).toEqual({ width: 40, height: 20 });
  });

  it('bigger/scale derive a new ellipse and carry deltaShadow', () => {
    const e = UEllipse.build(10, 10);
    e.setDeltaShadow(2);
    const bigger = e.bigger(5);
    expect(bigger.getWidth()).toBe(15);
    expect(bigger.getHeight()).toBe(15);
    expect(bigger.getDeltaShadow()).toBe(2);

    const scaled = e.scale(2);
    expect(scaled.getWidth()).toBe(20);
    expect(scaled.getHeight()).toBe(20);
  });

  it('getPointAtAngle(0) is the rightmost point of the ellipse', () => {
    const e = UEllipse.build(10, 10);
    const pt = e.getPointAtAngle(0);
    expect(pt.x).toBeCloseTo(10);
    expect(pt.y).toBeCloseTo(5);
  });

  it('getStartingX/getEndingX bound the ellipse chord at a given y', () => {
    const e = UEllipse.build(10, 10);
    expect(e.getStartingX(5)).toBeCloseTo(0);
    expect(e.getEndingX(5)).toBeCloseTo(10);
  });
});

describe('ULine', () => {
  it('create(p1, p2) computes the relative offset', () => {
    const line = ULine.create({ x: 1, y: 1 }, { x: 4, y: 5 });
    expect(line.getDX()).toBe(3);
    expect(line.getDY()).toBe(4);
    expect(line.getLength()).toBe(5);
  });

  it('hline/vline build axis-aligned lines', () => {
    expect(ULine.hline(7).getDX()).toBe(7);
    expect(ULine.hline(7).getDY()).toBe(0);
    expect(ULine.vline(9).getDY()).toBe(9);
    expect(ULine.vline(9).getDX()).toBe(0);
  });

  it('deltaShadow round-trips', () => {
    const line = new ULine(1, 1);
    line.setDeltaShadow(2.5);
    expect(line.getDeltaShadow()).toBe(2.5);
  });

  it('toString and getWidth/getHeight report dx/dy', () => {
    const line = new ULine(3, 4);
    expect(line.toString()).toBe('ULine dx=3 dy=4');
    expect(line.getWidth()).toBe(3);
    expect(line.getHeight()).toBe(4);
  });
});

describe('UPolygon', () => {
  it('preserves insertion order across N points (AC3)', () => {
    const poly = new UPolygon();
    poly.addPoint(0, 0);
    poly.addPoint(10, 0);
    poly.addPoint(5, 10);
    expect(poly.getPoints()).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]);
    expect(poly.getPoint(1)).toEqual({ x: 10, y: 0 });
  });

  it('constructor(points) preserves the given order', () => {
    const poly = new UPolygon([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(poly.getPoints()).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('addPoint accepts a Point2D-object overload', () => {
    const poly = new UPolygon();
    poly.addPoint({ x: 3, y: 4 });
    expect(poly.getPoints()).toEqual([{ x: 3, y: 4 }]);
  });

  it('getPointArray offsets every point by (x, y), interleaved', () => {
    const poly = new UPolygon([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
    ]);
    expect(poly.getPointArray(10, 20)).toEqual([10, 20, 11, 22]);
  });

  it('translate returns a new polygon with every point shifted', () => {
    const poly = new UPolygon([{ x: 1, y: 1 }]);
    const moved = poly.translate(4, 4);
    expect(moved.getPoints()).toEqual([{ x: 5, y: 5 }]);
    expect(poly.getPoints()).toEqual([{ x: 1, y: 1 }]);
  });

  it('deltaShadow round-trips', () => {
    const poly = new UPolygon();
    poly.setDeltaShadow(1.5);
    expect(poly.getDeltaShadow()).toBe(1.5);
  });

  it('getPoint throws for an out-of-range index', () => {
    const poly = new UPolygon([{ x: 0, y: 0 }]);
    expect(() => poly.getPoint(5)).toThrow('out of range');
  });
});

describe('UText', () => {
  const font: FontConfiguration = {
    family: 'sans-serif',
    size: 12,
    color: '#000000',
    styles: new Set([FontStyle.BOLD]),
  };

  it('build exposes text, font, and orientation 0', () => {
    const text = UText.build('hello', font);
    expect(text.getText()).toBe('hello');
    expect(text.getFontConfiguration()).toBe(font);
    expect(text.getOrientation()).toBe(0);
  });

  it('withOrientation derives a new UText with the same text/font', () => {
    const text = UText.build('hello', font).withOrientation(90);
    expect(text.getOrientation()).toBe(90);
    expect(text.getText()).toBe('hello');
  });

  it('normalizes the Jaws newline/breakline markers to visible glyphs', () => {
    const text = UText.build('abc', font);
    expect(text.getText()).toBe('a↵b⏎c');
  });

  it('toString reports the raw text', () => {
    expect(UText.build('hi', font).toString()).toBe('UText[hi]');
  });
});

describe('UComment', () => {
  it('exposes the comment text as constructed', () => {
    expect(new UComment('note').getComment()).toBe('note');
  });
});

describe('UGroup', () => {
  it('put/asMap sanitizes non-word characters to "."', () => {
    const group = new UGroup();
    group.put(UGroupType.CLASS, 'foo bar!baz');
    expect(group.asMap().get(UGroupType.CLASS)).toBe('foo bar.baz');
  });

  it('singletonMap builds a one-entry map', () => {
    const group = UGroup.singletonMap(UGroupType.ID, 'node1');
    expect(group.asMap()).toEqual(new Map([[UGroupType.ID, 'node1']]));
  });

  it('constructor(location) sets DATA_SOURCE_LINE from position', () => {
    const group = new UGroup({ position: 42 });
    expect(group.asMap().get(UGroupType.DATA_SOURCE_LINE)).toBe('42');
  });

  it('getSvgKeyAttributeName lowercases and hyphenates', () => {
    expect(getSvgKeyAttributeName(UGroupType.DATA_SOURCE_LINE)).toBe('data-source-line');
    expect(getSvgKeyAttributeName(UGroupType.ID)).toBe('id');
  });
});

describe('DotPath', () => {
  it('toUPath flattens beziers to MOVETO + CUBICTO ops (driver contract)', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
      { x1: 3, y1: 3, ctrlx1: 4, ctrly1: 4, ctrlx2: 5, ctrly2: 5, x2: 6, y2: 6 },
    ]);
    const upath = dot.toUPath();
    expect([...upath]).toEqual([
      { coord: [0, 0], segmentType: USegmentType.SEG_MOVETO },
      { coord: [1, 1, 2, 2, 3, 3], segmentType: USegmentType.SEG_CUBICTO },
      { coord: [4, 4, 5, 5, 6, 6], segmentType: USegmentType.SEG_CUBICTO },
    ]);
  });

  it('addCurve(pt1,pt2,pt3,pt4) appends one bezier segment', () => {
    const dot = new DotPath().addCurve({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 });
    expect(dot.getBeziers()).toEqual([{ x1: 0, y1: 0, ctrlx1: 1, ctrly1: 0, ctrlx2: 2, ctrly2: 0, x2: 3, y2: 0 }]);
  });

  it('addCurve(pt2,pt3,pt4) implies pt1 from the prior endpoint', () => {
    const dot = new DotPath()
      .addCurve({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })
      .addCurve({ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 });
    expect(dot.getBeziers()[1]).toEqual({
      x1: 3,
      y1: 0,
      ctrlx1: 4,
      ctrly1: 0,
      ctrlx2: 5,
      ctrly2: 0,
      x2: 6,
      y2: 0,
    });
  });

  it('getStartPoint/getEndPoint read the first/last bezier endpoints', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    expect(dot.getStartPoint()).toEqual({ x: 0, y: 0 });
    expect(dot.getEndPoint()).toEqual({ x: 3, y: 3 });
  });

  it('reverse flips segment order and swaps each bezier endpoint/control pair', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    const reversed = dot.reverse();
    expect(reversed.getBeziers()).toEqual([
      { x1: 3, y1: 3, ctrlx1: 2, ctrly1: 2, ctrlx2: 1, ctrly2: 1, x2: 0, y2: 0 },
    ]);
  });

  it('moveStartPoint(dx, dy) shifts the first anchor + its control point', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.moveStartPoint(10, 10);
    expect(dot.getBeziers()[0]).toEqual({
      x1: 10,
      y1: 10,
      ctrlx1: 11,
      ctrly1: 11,
      ctrlx2: 2,
      ctrly2: 2,
      x2: 3,
      y2: 3,
    });
  });

  it('moveStartPoint accepts a UTranslate-shaped {getDx, getDy} object', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.moveStartPoint({ getDx: () => 5, getDy: () => 5 });
    expect(dot.getBeziers()[0]!.x1).toBe(5);
  });

  it('moveEndPoint(dx, dy) shifts the last anchor + its control point', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.moveEndPoint(10, 10);
    expect(dot.getBeziers()[0]).toEqual({
      x1: 0,
      y1: 0,
      ctrlx1: 1,
      ctrly1: 1,
      ctrlx2: 12,
      ctrly2: 12,
      x2: 13,
      y2: 13,
    });
  });

  it('moveDelta shifts every field of every bezier', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.moveDelta(100, 200);
    expect(dot.getBeziers()[0]).toEqual({
      x1: 100,
      y1: 200,
      ctrlx1: 101,
      ctrly1: 201,
      ctrlx2: 102,
      ctrly2: 202,
      x2: 103,
      y2: 203,
    });
  });

  it('getStartAngle/getEndAngle report the tangent direction', () => {
    // A straight horizontal bezier: tangent is 0 radians at both ends.
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 0, ctrlx2: 2, ctrly2: 0, x2: 3, y2: 0 },
    ]);
    expect(dot.getStartAngle()).toBeCloseTo(0);
    expect(dot.getEndAngle()).toBeCloseTo(0);
  });

  it('isLine is true for a flattened (straight) bezier, false for a curved one', () => {
    const straight = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 0, ctrlx2: 2, ctrly2: 0, x2: 3, y2: 0 },
    ]);
    expect(straight.isLine()).toBe(true);

    const curved = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 0, ctrly1: 10, ctrlx2: 3, ctrly2: 10, x2: 3, y2: 0 },
    ]);
    expect(curved.isLine()).toBe(false);
  });

  it('getMinDist returns the distance to the closest control/anchor point', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    expect(dot.getMinDist({ x: 0, y: 0 })).toBe(0);
  });

  it('copy() produces an independent, structurally-equal snapshot', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    const copy = dot.copy();
    expect(copy.getBeziers()).toEqual(dot.getBeziers());
    dot.moveDelta(1, 1);
    expect(copy.getBeziers()[0]!.x1).toBe(0);
  });

  it('setCommentAndCodeLine propagates into toUPath output', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.setCommentAndCodeLine('c', 'file.puml:1');
    const upath = dot.toUPath();
    expect(upath.getComment()).toBe('c');
    expect(upath.getCodeLine()).toBe('file.puml:1');
  });

  it('moveStartPoint drops the first segment when the shift exceeds its length', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 0, ctrly1: 0, ctrlx2: 1, ctrly2: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 0, ctrlx1: 1, ctrly1: 0, ctrlx2: 2, ctrly2: 0, x2: 2, y2: 0 },
    ]);
    dot.moveStartPoint(5, 0);
    expect(dot.getBeziers()).toEqual([
      { x1: 5, y1: 0, ctrlx1: 5, ctrly1: 0, ctrlx2: 2, ctrly2: 0, x2: 2, y2: 0 },
    ]);
  });

  it('moveEndPoint accepts a UTranslate-shaped {getDx, getDy} object', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    dot.moveEndPoint({ getDx: () => 3, getDy: () => 4 });
    expect(dot.getBeziers()[0]!.x2).toBe(6);
    expect(dot.getBeziers()[0]!.y2).toBe(7);
  });

  it('getStartAngle falls back to the chord when the start control point is degenerate', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 0, ctrly1: 0, ctrlx2: 5, ctrly2: 5, x2: 10, y2: 0 },
    ]);
    expect(dot.getStartAngle()).toBeCloseTo(0);
  });

  it('getEndAngle falls back to the chord when the end control point is degenerate', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 10, ctrly2: 0, x2: 10, y2: 0 },
    ]);
    expect(dot.getEndAngle()).toBeCloseTo(0);
  });

  it('toString reports each bezier\'s 4 control points', () => {
    const dot = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 },
    ]);
    expect(dot.toString()).toBe('(0,0) (1,1) (2,2) (3,3) ');
  });

  it('throws on getStartPoint/getEndPoint/getStartAngle/getEndAngle for an empty path', () => {
    const empty = new DotPath();
    expect(() => empty.getStartPoint()).toThrow('empty path');
    expect(() => empty.getEndPoint()).toThrow('empty path');
    expect(() => empty.getStartAngle()).toThrow('empty path');
    expect(() => empty.getEndAngle()).toThrow('empty path');
  });

  it('throws on moveStartPoint/moveEndPoint for an empty path', () => {
    const empty = new DotPath();
    expect(() => empty.moveStartPoint(1, 1)).toThrow('empty path');
    expect(() => empty.moveEndPoint(1, 1)).toThrow('empty path');
  });

  it('throws on addCurve(pt2,pt3,pt4) with no prior segment to imply pt1 from', () => {
    const empty = new DotPath();
    expect(() => empty.addCurve({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toThrow(
      'no prior segment',
    );
  });
});
