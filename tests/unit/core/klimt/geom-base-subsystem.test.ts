/**
 * geom-base-subsystem.test.ts — T3b: unit coverage for the small geometry
 * value types ported to support `TextBlockUtils`/the Usecase ellipse
 * subsystem: `VerticalAlignment`, `XPoint2D`, `Moveable`/`Positionable`/
 * `PositionableImpl`, `ClockwiseTopRightBottomLeft`, and the widened
 * `MagneticBorder.getForceAt` signature.
 */
import { describe, expect, it } from 'vitest';
import { VerticalAlignment } from '../../../../src/core/klimt/geom/VerticalAlignment.js';
import { XPoint2D } from '../../../../src/core/klimt/geom/XPoint2D.js';
import { PositionableImpl } from '../../../../src/core/klimt/geom/PositionableImpl.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { ClockwiseTopRightBottomLeft } from '../../../../src/core/klimt/geom/ClockwiseTopRightBottomLeft.js';
import { MagneticBorderNone } from '../../../../src/core/klimt/geom/MagneticBorderNone.js';
import type { MagneticBorder } from '../../../../src/core/klimt/geom/MagneticBorder.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';

describe('VerticalAlignment', () => {
  it('exposes the three upstream enum values', () => {
    expect(VerticalAlignment.TOP).toBe('TOP');
    expect(VerticalAlignment.CENTER).toBe('CENTER');
    expect(VerticalAlignment.BOTTOM).toBe('BOTTOM');
  });
});

describe('XPoint2D', () => {
  it('exposes x/y via constructor and accessors', () => {
    const p = new XPoint2D(3, 4);
    expect(p.getX()).toBe(3);
    expect(p.getY()).toBe(4);
  });

  it('computes distance between two points (3-4-5 triangle)', () => {
    const a = new XPoint2D(0, 0);
    const b = new XPoint2D(3, 4);
    expect(a.distance(b)).toBe(5);
    expect(a.distanceSq(b)).toBe(25);
  });

  it('computes the static 4-arg distance the same way', () => {
    expect(XPoint2D.distance(0, 0, 3, 4)).toBe(5);
  });

  it('move() returns a new translated point, leaving the original unchanged', () => {
    const p = new XPoint2D(1, 1);
    const moved = p.move(2, 3);
    expect(moved.getX()).toBe(3);
    expect(moved.getY()).toBe(4);
    expect(p.getX()).toBe(1);
  });

  it('moveByPoint() adds another XPoint2D as a delta', () => {
    const p = new XPoint2D(1, 1);
    const moved = p.moveByPoint(new XPoint2D(5, 5));
    expect(moved.getX()).toBe(6);
    expect(moved.getY()).toBe(6);
  });

  it('equals() compares by value, not reference', () => {
    expect(new XPoint2D(1, 2).equals(new XPoint2D(1, 2))).toBe(true);
    expect(new XPoint2D(1, 2).equals(new XPoint2D(1, 3))).toBe(false);
  });

  it('toString() renders "(x,y)"', () => {
    expect(new XPoint2D(1, 2).toString()).toBe('(1,2)');
  });
});

describe('PositionableImpl', () => {
  it('create() builds from an XPoint2D + XDimension2D', () => {
    const dim = new XDimension2D(10, 20);
    const p = PositionableImpl.create(new XPoint2D(1, 2), dim);
    expect(p.getPosition().getX()).toBe(1);
    expect(p.getPosition().getY()).toBe(2);
    expect(p.getSize()).toBe(dim);
  });

  it('moveDelta shifts the position in place', () => {
    const p = new PositionableImpl(1, 1, new XDimension2D(5, 5));
    p.moveDelta(2, 3);
    expect(p.getPosition().getX()).toBe(3);
    expect(p.getPosition().getY()).toBe(4);
  });
});

describe('ClockwiseTopRightBottomLeft', () => {
  it('same(v) sets all four sides equal', () => {
    const m = ClockwiseTopRightBottomLeft.same(5);
    expect(m.getTop()).toBe(5);
    expect(m.getRight()).toBe(5);
    expect(m.getBottom()).toBe(5);
    expect(m.getLeft()).toBe(5);
  });

  it('none() is all-zero and isZero() reports it', () => {
    const m = ClockwiseTopRightBottomLeft.none();
    expect(m.isZero()).toBe(true);
  });

  it('topRightBottomLeft() sets each side independently', () => {
    const m = ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4);
    expect(m.getTop()).toBe(1);
    expect(m.getRight()).toBe(2);
    expect(m.getBottom()).toBe(3);
    expect(m.getLeft()).toBe(4);
    expect(m.isZero()).toBe(false);
  });

  it('margin1margin2() mirrors CSS 2-value shorthand', () => {
    const m = ClockwiseTopRightBottomLeft.margin1margin2(1, 2);
    expect([m.getTop(), m.getRight(), m.getBottom(), m.getLeft()]).toEqual([1, 2, 1, 2]);
  });

  it('read() parses 1/2/3/4-number space-separated shorthand', () => {
    expect(ClockwiseTopRightBottomLeft.read('10').getTop()).toBe(10);
    const two = ClockwiseTopRightBottomLeft.read('1 2');
    expect([two.getTop(), two.getRight(), two.getBottom(), two.getLeft()]).toEqual([1, 2, 1, 2]);
    const three = ClockwiseTopRightBottomLeft.read('1 2 3');
    expect([three.getTop(), three.getRight(), three.getBottom(), three.getLeft()]).toEqual([1, 2, 3, 2]);
    const four = ClockwiseTopRightBottomLeft.read('1 2 3 4');
    expect([four.getTop(), four.getRight(), four.getBottom(), four.getLeft()]).toEqual([1, 2, 3, 4]);
  });

  it('read() falls back to none() for non-numeric or out-of-range input', () => {
    expect(ClockwiseTopRightBottomLeft.read('abc').isZero()).toBe(true);
    expect(ClockwiseTopRightBottomLeft.read('1 2 3 4 5').isZero()).toBe(true);
  });

  it('incTop() returns a new instance with only top changed', () => {
    const m = ClockwiseTopRightBottomLeft.same(1).incTop(4);
    expect(m.getTop()).toBe(5);
    expect(m.getRight()).toBe(1);
  });

  it('toString() renders top:right:bottom:left', () => {
    expect(ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4).toString()).toBe('1:2:3:4');
  });

  it('getTranslate() returns a UTranslate(left, top)', () => {
    const t = ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4).getTranslate();
    expect(t.getDx()).toBe(4);
    expect(t.getDy()).toBe(1);
  });

  it('apply() widens an XDimension2D by the quad', () => {
    const m = ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4);
    const widened = m.apply(new XDimension2D(10, 10));
    expect(widened.getWidth()).toBe(16);
    expect(widened.getHeight()).toBe(14);
  });
});

describe('MagneticBorder widening (T3b)', () => {
  it('MagneticBorderNone.getForceAt still works with only the position arg', () => {
    const border = new MagneticBorderNone();
    const force = border.getForceAt({ x: 1, y: 2 });
    expect(force).toEqual(UTranslate.none());
  });

  it('the widened interface accepts an optional stringBounder without breaking callers', () => {
    const border: MagneticBorder = new MagneticBorderNone();
    const stubBounder = { calculateDimension: () => new XDimension2D(0, 0) };
    const force = border.getForceAt({ x: 0, y: 0 }, stubBounder);
    expect(force).toEqual(UTranslate.none());
  });
});
