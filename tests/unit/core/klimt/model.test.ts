import { describe, expect, it } from 'vitest';
import { AbstractCommonUGraphic } from '../../../../src/core/klimt/AbstractCommonUGraphic.js';
import type { UDriver } from '../../../../src/core/klimt/AbstractCommonUGraphic.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { Back } from '../../../../src/core/klimt/Back.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { CopyForegroundColorToBackgroundColor } from '../../../../src/core/klimt/CopyForegroundColorToBackgroundColor.js';
import type { UShape } from '../../../../src/core/klimt/UShape.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';

/** A minimal concrete shape — UShape is an empty marker interface. */
class TestShape implements UShape {
  constructor(public readonly label: string) {}
}

/** A second shape class, used to prove per-class driver dispatch. */
class OtherShape implements UShape {}

/** Records every (shape, param) pair it was handed. */
class RecordingDriver<S extends UShape> implements UDriver<S> {
  readonly calls: Array<{ shape: S; param: UParam }> = [];

  draw(shape: S, param: UParam): void {
    this.calls.push({ shape, param });
  }
}

/**
 * A minimal concrete `UGraphic`, mirroring how upstream's `UGraphicSvg`
 * re-registers its drivers in the constructor of every fresh instance
 * `copyUGraphic()` creates (see `UGraphicSvg.java:73-86`).
 */
class TestUGraphic extends AbstractCommonUGraphic {
  readonly testShapeDriver = new RecordingDriver<TestShape>();

  constructor() {
    super();
    this.registerDriver(TestShape, this.testShapeDriver);
  }

  protected copyUGraphic(): TestUGraphic {
    const copy = new TestUGraphic();
    copy.basicCopy(this);
    return copy;
  }

  /** Exposes the protected translate accessors for direct testing. */
  debugTranslateXY(): readonly [number, number] {
    return [this.getTranslateX(), this.getTranslateY()];
  }
}

describe('klimt UGraphic model core', () => {
  describe('immutability of apply()', () => {
    it('composes chained translates and leaves the original untouched', () => {
      const root = new TestUGraphic();

      const once = root.apply(new UTranslate(10, 5));
      const twice = once.apply(new UTranslate(2, 0));

      expect(twice.getTranslate().getDx()).toBe(12);
      expect(twice.getTranslate().getDy()).toBe(5);

      // Immutability: the original and the intermediate are unaffected.
      expect(root.getTranslate().getDx()).toBe(0);
      expect(root.getTranslate().getDy()).toBe(0);
      expect(once.getTranslate().getDx()).toBe(10);
      expect(once.getTranslate().getDy()).toBe(5);
    });

    it('apply() returns a distinct instance from the receiver', () => {
      const root = new TestUGraphic();
      const changed = root.apply(new UTranslate(1, 1));
      expect(changed).not.toBe(root);
    });

    it('exposes the composed translate through the protected x/y accessors', () => {
      const root = new TestUGraphic();
      const moved = root.apply(new UTranslate(7, 9)) as TestUGraphic;
      expect(moved.debugTranslateXY()).toEqual([7, 9]);
      expect(root.debugTranslateXY()).toEqual([0, 0]);
    });
  });

  describe('state accumulation across applies', () => {
    it('accumulates a stroke change then a color change', () => {
      const root = new TestUGraphic();
      const stroke = new UStroke(4, 2, 3);

      const withStroke = root.apply(stroke);
      const withStrokeAndColor = withStroke.apply(new Fore('#ff0000'));

      const param = withStrokeAndColor.getParam();
      expect(param.getStroke()).toBe(stroke);
      expect(param.getColor()).toBe('#ff0000');

      // The root graphic's own state is untouched.
      expect(root.getParam().getStroke().getThickness()).toBe(1.0);
      expect(root.getParam().getColor()).toBe('none');
    });

    it('accumulates a background color change independently of stroke', () => {
      const root = new TestUGraphic();

      const withBack = root
        .apply(new UStroke(0, 0, 2))
        .apply(new Back('#00ff00'));

      const param = withBack.getParam();
      expect(param.getBackcolor()).toBe('#00ff00');
      expect(param.getStroke().getThickness()).toBe(2);
    });

    it('copies the current foreground into background on CopyForeground...', () => {
      const root = new TestUGraphic();
      const withColor = root.apply(new Fore('#123456'));

      const copied = withColor.apply(
        new CopyForegroundColorToBackgroundColor(),
      );

      expect(copied.getParam().getBackcolor()).toBe('#123456');
      // Foreground is unchanged by the copy.
      expect(copied.getParam().getColor()).toBe('#123456');
    });

    it('defaults stroke to simple() and colors to none', () => {
      const root = new TestUGraphic();
      const param = root.getParam();

      expect(param.getStroke().getThickness()).toBe(1.0);
      expect(param.getStroke().getDashVisible()).toBe(0);
      expect(param.getColor()).toBe('none');
      expect(param.getBackcolor()).toBe('none');
    });
  });

  describe('draw() dispatch', () => {
    it('routes a shape to the driver registered for its exact class', () => {
      const root = new TestUGraphic();
      const moved = root.apply(new UTranslate(3, 4)) as TestUGraphic;
      const shape = new TestShape('hello');

      moved.draw(shape);

      expect(moved.testShapeDriver.calls).toHaveLength(1);
      const call = moved.testShapeDriver.calls[0];
      expect(call?.shape).toBe(shape);
      expect(call?.param.getTranslate().getDx()).toBe(3);
      expect(call?.param.getTranslate().getDy()).toBe(4);
    });

    it('reflects accumulated stroke/color state in the param passed to the driver', () => {
      const root = new TestUGraphic();
      const stroke = new UStroke(1, 1, 5);
      const ready = root
        .apply(stroke)
        .apply(new Fore('#abcdef')) as TestUGraphic;

      ready.draw(new TestShape('styled'));

      const call = ready.testShapeDriver.calls[0];
      expect(call?.param.getStroke()).toBe(stroke);
      expect(call?.param.getColor()).toBe('#abcdef');
    });

    it('throws when no driver is registered for the shape class', () => {
      const root = new TestUGraphic();
      expect(() => root.draw(new OtherShape())).toThrow(
        /No driver registered for shape OtherShape/,
      );
    });
  });
});

describe('UTranslate', () => {
  it('stores dx/dy and exposes them via getDx/getDy', () => {
    const t = new UTranslate(3, 4);
    expect(t.getDx()).toBe(3);
    expect(t.getDy()).toBe(4);
  });

  it('none() is the zero offset', () => {
    expect(UTranslate.none().getDx()).toBe(0);
    expect(UTranslate.none().getDy()).toBe(0);
  });

  it('dx()/dy() build single-axis offsets', () => {
    expect(UTranslate.dx(5).getDx()).toBe(5);
    expect(UTranslate.dx(5).getDy()).toBe(0);
    expect(UTranslate.dy(7).getDx()).toBe(0);
    expect(UTranslate.dy(7).getDy()).toBe(7);
  });

  it('isAlmostSame is true when dx OR dy matches', () => {
    const a = new UTranslate(1, 2);
    expect(a.isAlmostSame(new UTranslate(1, 99))).toBe(true);
    expect(a.isAlmostSame(new UTranslate(99, 2))).toBe(true);
    expect(a.isAlmostSame(new UTranslate(99, 99))).toBe(false);
  });

  it('getTranslated offsets a point, and passes through undefined', () => {
    const t = new UTranslate(10, -5);
    expect(t.getTranslated({ x: 1, y: 1 })).toEqual({ x: 11, y: -4 });
    expect(t.getTranslated(undefined)).toBeUndefined();
  });

  it('scaled multiplies both components', () => {
    const t = new UTranslate(2, 3).scaled(10);
    expect(t.getDx()).toBe(20);
    expect(t.getDy()).toBe(30);
  });

  it('compose sums two translates', () => {
    const t = new UTranslate(1, 2).compose(new UTranslate(3, 4));
    expect(t.getDx()).toBe(4);
    expect(t.getDy()).toBe(6);
  });

  it('reverse negates both components', () => {
    const t = new UTranslate(5, -6).reverse();
    expect(t.getDx()).toBe(-5);
    expect(t.getDy()).toBe(6);
  });

  it('multiplyBy scales both components', () => {
    const t = new UTranslate(2, -3).multiplyBy(4);
    expect(t.getDx()).toBe(8);
    expect(t.getDy()).toBe(-12);
  });

  it('sym swaps dx and dy', () => {
    const t = new UTranslate(2, 9).sym();
    expect(t.getDx()).toBe(9);
    expect(t.getDy()).toBe(2);
  });

  it('getPosition returns {x, y} matching dx/dy', () => {
    expect(new UTranslate(6, 8).getPosition()).toEqual({ x: 6, y: 8 });
  });

  it('toString formats dx/dy', () => {
    expect(new UTranslate(1, 2).toString()).toBe('translate dx=1 dy=2');
  });
});

describe('UStroke', () => {
  it('stores dashVisible/dashSpace/thickness', () => {
    const s = new UStroke(1, 2, 3);
    expect(s.getDashVisible()).toBe(1);
    expect(s.getDashSpace()).toBe(2);
    expect(s.getThickness()).toBe(3);
  });

  it('withThickness() builds a solid stroke at the given thickness', () => {
    const s = UStroke.withThickness(6);
    expect(s.getDashVisible()).toBe(0);
    expect(s.getDashSpace()).toBe(0);
    expect(s.getThickness()).toBe(6);
  });

  it('simple() is a solid 1.0-thickness stroke', () => {
    const s = UStroke.simple();
    expect(s.getDashVisible()).toBe(0);
    expect(s.getDashSpace()).toBe(0);
    expect(s.getThickness()).toBe(1.0);
  });

  it('onlyThickness() drops the dash pattern', () => {
    const s = new UStroke(4, 5, 6).onlyThickness();
    expect(s.getDashVisible()).toBe(0);
    expect(s.getDashSpace()).toBe(0);
    expect(s.getThickness()).toBe(6);
  });

  it('getDasharraySvg() is undefined for a solid stroke', () => {
    expect(UStroke.simple().getDasharraySvg()).toBeUndefined();
  });

  it('getDasharraySvg() returns [dashVisible, dashSpace] when dashed', () => {
    expect(new UStroke(4, 2, 1).getDasharraySvg()).toEqual([4, 2]);
  });

  it('getDashTikz() is undefined for a solid stroke', () => {
    expect(UStroke.simple().getDashTikz()).toBeUndefined();
  });

  it('getDashTikz() formats "on Xpt off Ypt" when dashed', () => {
    expect(new UStroke(4, 2, 1).getDashTikz()).toBe('on 4pt off 2pt');
  });

  it('equals() compares all three fields', () => {
    const a = new UStroke(1, 2, 3);
    expect(a.equals(new UStroke(1, 2, 3))).toBe(true);
    expect(a.equals(new UStroke(1, 2, 4))).toBe(false);
    expect(a.equals(new UStroke(1, 9, 3))).toBe(false);
    expect(a.equals(new UStroke(9, 2, 3))).toBe(false);
  });

  it('toString formats dashVisible-dashSpace-thickness', () => {
    expect(new UStroke(1, 2, 3).toString()).toBe('1-2-3');
  });
});
