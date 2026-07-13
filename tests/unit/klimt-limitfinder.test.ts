import { describe, it, expect } from 'vitest';
import { MinMax } from '../../src/core/klimt/geom/MinMax.js';
import { MinMaxMutable } from '../../src/core/klimt/geom/MinMaxMutable.js';
import { XDimension2D } from '../../src/core/klimt/geom/XDimension2D.js';
import { XPoint2D } from '../../src/core/klimt/geom/XPoint2D.js';
import { LimitFinder } from '../../src/core/klimt/drawing/LimitFinder.js';
import type { UChange } from '../../src/core/klimt/UChange.js';
import type { UShape } from '../../src/core/klimt/UShape.js';
import type { StringBounder } from '../../src/core/klimt/font/StringBounder.js';
import type { TextBlock } from '../../src/core/klimt/shape/TextBlock.js';
import { TextBlockUtils } from '../../src/core/klimt/shape/TextBlockUtils.js';
import { TextBlockMarged } from '../../src/core/klimt/shape/TextBlockMarged.js';
import { UTranslate } from '../../src/core/klimt/UTranslate.js';
import { UStroke } from '../../src/core/klimt/UStroke.js';
import { Back } from '../../src/core/klimt/Back.js';
import { Fore } from '../../src/core/klimt/Fore.js';
import { CopyForegroundColorToBackgroundColor } from '../../src/core/klimt/CopyForegroundColorToBackgroundColor.js';
import { DotPath } from '../../src/core/klimt/shape/DotPath.js';
import { ULine } from '../../src/core/klimt/shape/ULine.js';
import { UPath } from '../../src/core/klimt/shape/UPath.js';
import { UPolygon } from '../../src/core/klimt/shape/UPolygon.js';
import { URectangle } from '../../src/core/klimt/shape/URectangle.js';
import { UEllipse } from '../../src/core/klimt/shape/UEllipse.js';
import { UEmpty } from '../../src/core/klimt/shape/UEmpty.js';
import { UComment } from '../../src/core/klimt/shape/UComment.js';
import { UText, type FontConfiguration } from '../../src/core/klimt/shape/UText.js';
import { FixedMeasurer } from '../../src/core/measurer.js';

/**
 * Adapts `FixedMeasurer` (src/core/measurer.ts — `{width,height}`) onto
 * this port's `StringBounder` interface (`XDimension2D`), the seam the
 * mission task names ("the existing driverBounder/measurer seams
 * (FixedMeasurer)").
 */
function fixedStringBounder(charWidth: number, lineHeight: number): StringBounder {
  const measurer = new FixedMeasurer(charWidth, lineHeight);
  return {
    calculateDimension(font, text) {
      const m = measurer.measure(text, { family: font.family, size: font.size });
      return new XDimension2D(m.width, m.height);
    },
  };
}

const FONT: FontConfiguration = { family: 'sans-serif', size: 12, color: null, styles: new Set() };

class UnknownShape implements UShape {}
class UnknownChange implements UChange {}

describe('MinMax', () => {
  it('getEmpty(true) is (0,0,0,0)', () => {
    const mm = MinMax.getEmpty(true);
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
    expect(mm.getMaxY()).toBe(0);
  });

  it('getEmpty(false) is the +/-MAX_VALUE sentinel', () => {
    const mm = MinMax.getEmpty(false);
    expect(mm.getMinX()).toBe(Number.MAX_VALUE);
    expect(mm.getMinY()).toBe(Number.MAX_VALUE);
    expect(mm.getMaxX()).toBe(-Number.MAX_VALUE);
    expect(mm.getMaxY()).toBe(-Number.MAX_VALUE);
  });

  it('addPoint grows both corners independently', () => {
    const mm = MinMax.getEmpty(true).addPoint(5, -3).addPoint(-2, 10);
    expect(mm.getMinX()).toBe(-2);
    expect(mm.getMinY()).toBe(-3);
    expect(mm.getMaxX()).toBe(5);
    expect(mm.getMaxY()).toBe(10);
  });

  it('addPoint accepts an XPoint2D overload', () => {
    const mm = MinMax.getEmpty(true).addPoint(new XPoint2D(7, 8));
    expect(mm.getMaxX()).toBe(7);
    expect(mm.getMaxY()).toBe(8);
  });

  it('addMinMax merges two boxes', () => {
    const a = MinMax.getEmpty(true).addPoint(0, 0).addPoint(10, 10);
    const b = MinMax.getEmpty(true).addPoint(-5, 20).addPoint(3, 3);
    const merged = a.addMinMax(b);
    expect(merged.getMinX()).toBe(-5);
    expect(merged.getMinY()).toBe(0);
    expect(merged.getMaxX()).toBe(10);
    expect(merged.getMaxY()).toBe(20);
  });

  it('fromMax / fromDim seed from (0,0)', () => {
    const fromMax = MinMax.fromMax(30, 20);
    expect(fromMax.getMinX()).toBe(0);
    expect(fromMax.getMinY()).toBe(0);
    expect(fromMax.getMaxX()).toBe(30);
    expect(fromMax.getMaxY()).toBe(20);

    const fromDim = MinMax.fromDim(new XDimension2D(30, 20));
    expect(fromDim.getMaxX()).toBe(30);
    expect(fromDim.getMaxY()).toBe(20);
  });

  it('getWidth/getHeight/getDimension', () => {
    const mm = MinMax.getEmpty(true).addPoint(10, 4);
    expect(mm.getWidth()).toBe(10);
    expect(mm.getHeight()).toBe(4);
    const dim = mm.getDimension();
    expect(dim.getWidth()).toBe(10);
    expect(dim.getHeight()).toBe(4);
  });

  it('translate shifts both corners by (dx,dy)', () => {
    const mm = MinMax.getEmpty(true).addPoint(10, 4).translate(new UTranslate(3, -2));
    expect(mm.getMinX()).toBe(3);
    expect(mm.getMinY()).toBe(-2);
    expect(mm.getMaxX()).toBe(13);
    expect(mm.getMaxY()).toBe(2);
  });

  it('enlarge grows the MAX corner only -- the MIN corner is untouched', () => {
    const mm = MinMax.getEmpty(true).addPoint(10, 4).enlarge(5, 7);
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(15);
    expect(mm.getMaxY()).toBe(11);
  });

  it('throws on NaN in any coordinate', () => {
    expect(() => MinMax.getEmpty(true).addPoint(Number.NaN, 0)).toThrow();
  });

  it('doesHorizontalCross: true when the segment straddles the box (either direction)', () => {
    const mm = MinMax.getEmpty(true).addPoint(0, 0).addPoint(10, 10);
    expect(mm.doesHorizontalCross(new XPoint2D(-5, 5), new XPoint2D(15, 5))).toBe(true);
    expect(mm.doesHorizontalCross(new XPoint2D(15, 5), new XPoint2D(-5, 5))).toBe(true);
    expect(mm.doesHorizontalCross(new XPoint2D(-5, 50), new XPoint2D(15, 50))).toBe(false);
  });

  it('doesHorizontalCross: false when the segment does not straddle both edges', () => {
    const mm = MinMax.getEmpty(true).addPoint(0, 0).addPoint(10, 10);
    expect(mm.doesHorizontalCross(new XPoint2D(2, 5), new XPoint2D(8, 5))).toBe(false);
  });

  it('doesHorizontalCross: throws on a non-horizontal or zero-width segment', () => {
    const mm = MinMax.getEmpty(true).addPoint(0, 0).addPoint(10, 10);
    expect(() => mm.doesHorizontalCross(new XPoint2D(0, 0), new XPoint2D(1, 1))).toThrow();
    expect(() => mm.doesHorizontalCross(new XPoint2D(3, 3), new XPoint2D(3, 3))).toThrow();
  });

  it('toString reports (minX,minY)->(maxX,maxY)', () => {
    const mm = MinMax.getEmpty(true).addPoint(10, 4);
    expect(mm.toString()).toBe('(0,0)->(10,4)');
  });
});

describe('MinMaxMutable', () => {
  it('isInfinity is true only for the initToZero=false sentinel', () => {
    expect(MinMaxMutable.getEmpty(false).isInfinity()).toBe(true);
    expect(MinMaxMutable.getEmpty(true).isInfinity()).toBe(false);
  });

  it('addPoint mutates in place and clears isInfinity', () => {
    const mm = MinMaxMutable.getEmpty(false);
    mm.addPoint(3, 4);
    expect(mm.isInfinity()).toBe(false);
    expect(mm.getMinX()).toBe(3);
    expect(mm.getMaxX()).toBe(3);
  });

  it('addPoint accepts an XPoint2D overload', () => {
    const mm = MinMaxMutable.getEmpty(true);
    mm.addPoint(new XPoint2D(6, 9));
    expect(mm.getMaxX()).toBe(6);
    expect(mm.getMaxY()).toBe(9);
  });

  it('addPoint throws on NaN in either coordinate', () => {
    const mm = MinMaxMutable.getEmpty(true);
    expect(() => mm.addPoint(Number.NaN, 0)).toThrow();
    expect(() => mm.addPoint(0, Number.NaN)).toThrow();
  });

  it('reset zeroes all four corners', () => {
    const mm = MinMaxMutable.getEmpty(false);
    mm.addPoint(3, 4);
    mm.reset();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMaxY()).toBe(0);
  });

  it('fromMax seeds from (0,0)', () => {
    const mm = MinMaxMutable.fromMax(30, 20);
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(30);
    expect(mm.getMaxY()).toBe(20);
  });

  it('fromMax throws on NaN', () => {
    expect(() => MinMaxMutable.fromMax(Number.NaN, 0)).toThrow();
    expect(() => MinMaxMutable.fromMax(0, Number.NaN)).toThrow();
  });

  it('getDimension and toString', () => {
    const mm = MinMaxMutable.getEmpty(true);
    mm.addPoint(10, 4);
    expect(mm.getDimension().getWidth()).toBe(10);
    expect(mm.getDimension().getHeight()).toBe(4);
    expect(mm.toString()).toBe('X=0 to 10 and Y=0 to 4');
  });
});

describe('LimitFinder -- per-shape extent math', () => {
  const sb = fixedStringBounder(6, 14);

  it('URectangle: (x-1,y-1) -> (x+w-1+shadow*2, y+h-1+shadow*2) at a translate (the -1 quirk)', () => {
    const lf = LimitFinder.create(sb, false);
    const rect = URectangle.build(100, 50);
    lf.apply(new UTranslate(10, 10)).draw(rect);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(9);
    expect(mm.getMinY()).toBe(9);
    expect(mm.getMaxX()).toBe(109);
    expect(mm.getMaxY()).toBe(59);
  });

  it('URectangle: deltaShadow*2 grows the max corner only', () => {
    const lf = LimitFinder.create(sb, true);
    const rect = URectangle.build(100, 50);
    rect.setDeltaShadow(3);
    lf.draw(rect);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(-1);
    expect(mm.getMinY()).toBe(-1);
    expect(mm.getMaxX()).toBe(100 - 1 + 6);
    expect(mm.getMaxY()).toBe(50 - 1 + 6);
  });

  it('ULine: (x,y) and (x+dx,y+dy)', () => {
    const lf = LimitFinder.create(sb, false);
    lf.apply(new UTranslate(3, 4)).draw(new ULine(20, -5));
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(3);
    expect(mm.getMinY()).toBe(-1);
    expect(mm.getMaxX()).toBe(23);
    expect(mm.getMaxY()).toBe(4);
  });

  it('UPolygon: minX-10 / maxX+10 (HACK_X_FOR_POLYGON), minY/maxY unpadded', () => {
    const lf = LimitFinder.create(sb, false);
    const poly = new UPolygon([
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 10, y: 20 },
    ]);
    lf.draw(poly);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(5 - 10);
    expect(mm.getMinY()).toBe(5);
    expect(mm.getMaxX()).toBe(15 + 10);
    expect(mm.getMaxY()).toBe(20);
  });

  it('UPolygon: zero points is a no-op (upstream early-return)', () => {
    const lf = LimitFinder.create(sb, true);
    lf.draw(new UPolygon());
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
  });

  it('UPath: shape offsets (own min/max)', () => {
    const lf = LimitFinder.create(sb, false);
    const path = UPath.none();
    path.moveTo(2, -3);
    path.lineTo(30, 12);
    lf.apply(new UTranslate(100, 100)).draw(path);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(102);
    expect(mm.getMinY()).toBe(97);
    expect(mm.getMaxX()).toBe(130);
    expect(mm.getMaxY()).toBe(112);
  });

  it('DotPath: via its MinMax (all four points of every bezier)', () => {
    const lf = LimitFinder.create(sb, true);
    const dp = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 10, ctrly1: -5, ctrlx2: 20, ctrly2: 15, x2: 30, y2: 10 },
    ]);
    lf.draw(dp);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(-5);
    expect(mm.getMaxX()).toBe(30);
    expect(mm.getMaxY()).toBe(15);
  });

  it('DotPath: translate composes into every accumulated point', () => {
    const lf = LimitFinder.create(sb, false);
    const dp = DotPath.fromBeziers([
      { x1: 0, y1: 0, ctrlx1: 0, ctrly1: 0, ctrlx2: 0, ctrly2: 0, x2: 10, y2: 10 },
    ]);
    lf.apply(new UTranslate(5, 5)).draw(dp);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(5);
    expect(mm.getMinY()).toBe(5);
    expect(mm.getMaxX()).toBe(15);
    expect(mm.getMaxY()).toBe(15);
  });

  it('UText: dim=40x14 at (0,20) -> y-=(14-1.5), all four corners (the -1.5 quirk)', () => {
    const lf = LimitFinder.create(fixedStringBounder(20, 14), false);
    // 'AB' * 2 chars * charWidth(20) = 40; lineHeight = 14
    const text = UText.build('AB', FONT);
    lf.apply(new UTranslate(0, 20)).draw(text);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(7.5);
    expect(mm.getMaxX()).toBe(40);
    expect(mm.getMaxY()).toBe(21.5);
  });

  it('UEllipse: (x,y) + (x+w-1+shadow*2, y+h-1+shadow*2)', () => {
    const lf = LimitFinder.create(sb, true);
    const ellipse = UEllipse.build(30, 10);
    ellipse.setDeltaShadow(2);
    lf.draw(ellipse);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(30 - 1 + 4);
    expect(mm.getMaxY()).toBe(10 - 1 + 4);
  });

  it('UEmpty: full box, (x,y) -> (x+w,y+h)', () => {
    const lf = LimitFinder.create(sb, false);
    lf.apply(new UTranslate(2, 3)).draw(new UEmpty(15, 8));
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(2);
    expect(mm.getMinY()).toBe(3);
    expect(mm.getMaxX()).toBe(17);
    expect(mm.getMaxY()).toBe(11);
  });

  it('UComment: no-op', () => {
    const lf = LimitFinder.create(sb, true);
    lf.draw(new UComment('a comment'));
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
    expect(mm.getMaxY()).toBe(0);
  });

  it('CopyForegroundColorToBackgroundColor as a shape: unreachable dead branch, no-op', () => {
    const lf = LimitFinder.create(sb, true);
    // CopyForegroundColorToBackgroundColor implements UChange, not UShape, in both
    // codebases -- this cast mirrors upstream's own structurally-permitted but
    // never-true `instanceof` check (see LimitFinder.ts doc comment).
    lf.draw(new CopyForegroundColorToBackgroundColor());
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
  });

  it('TextBlock: recurse tb.drawU(this)', () => {
    const lf = LimitFinder.create(sb, true);
    const tb: TextBlock = {
      drawU(ug): void {
        ug.draw(URectangle.build(10, 10));
      },
      calculateDimension: () => new XDimension2D(10, 10),
    };
    lf.draw(tb);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(-1);
    expect(mm.getMinY()).toBe(-1);
    expect(mm.getMaxX()).toBe(9);
    expect(mm.getMaxY()).toBe(9);
  });

  it('unknown shape: throws', () => {
    const lf = LimitFinder.create(sb, true);
    expect(() => lf.draw(new UnknownShape())).toThrow();
  });

  it('getMinX/getMinY/getMaxX/getMaxY expose the running accumulator directly', () => {
    const lf = LimitFinder.create(sb, false);
    lf.draw(new UEmpty(5, 7));
    expect(lf.getMinX()).toBe(0);
    expect(lf.getMinY()).toBe(0);
    expect(lf.getMaxX()).toBe(5);
    expect(lf.getMaxY()).toBe(7);
  });
});

describe('LimitFinder -- apply() whitelist', () => {
  const sb = fixedStringBounder(6, 14);

  it('UTranslate composes', () => {
    const lf = LimitFinder.create(sb, false);
    const composed = lf.apply(new UTranslate(5, 5)).apply(new UTranslate(3, 2)) as LimitFinder;
    composed.draw(new UEmpty(1, 1));
    const mm = composed.getMinMax();
    expect(mm.getMinX()).toBe(8);
    expect(mm.getMinY()).toBe(7);
    expect(mm.getMaxX()).toBe(9);
    expect(mm.getMaxY()).toBe(8);
  });

  it('accepts UStroke, Back, Fore, CopyForegroundColorToBackgroundColor without throwing', () => {
    const lf = LimitFinder.create(sb, true);
    expect(() => lf.apply(UStroke.simple())).not.toThrow();
    expect(() => lf.apply(new Back('red'))).not.toThrow();
    expect(() => lf.apply(new Fore('blue'))).not.toThrow();
    expect(() => lf.apply(new CopyForegroundColorToBackgroundColor())).not.toThrow();
  });

  it('getParam() default (UGraphicNo): black/simple-stroke/zero-translate', () => {
    const lf = LimitFinder.create(sb, true);
    const param = lf.getParam();
    expect(param.getColor()).toBe('black');
    expect(param.getBackcolor()).toBe('black');
    expect(param.getStroke().getThickness()).toBe(1.0);
    expect(param.getTranslate().getDx()).toBe(0);
    expect(param.getTranslate().getDy()).toBe(0);
  });

  it('throws on an unsupported UChange', () => {
    const lf = LimitFinder.create(sb, true);
    expect(() => lf.apply(new UnknownChange())).toThrow();
  });
});

describe('LimitFinder -- initToZero duality', () => {
  const sb = fixedStringBounder(6, 14);

  it('initToZero=true, nothing drawn: getMinMax = (0,0,0,0)', () => {
    const lf = LimitFinder.create(sb, true);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
    expect(mm.getMaxY()).toBe(0);
  });

  it('initToZero=false, nothing drawn: collapses to getEmpty(true)', () => {
    const lf = LimitFinder.create(sb, false);
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(0);
    expect(mm.getMaxY()).toBe(0);
  });

  it('initToZero=false with a real point does NOT collapse', () => {
    const lf = LimitFinder.create(sb, false);
    lf.draw(new UEmpty(5, 5));
    const mm = lf.getMinMax();
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMaxX()).toBe(5);
  });
});

describe('TextBlockUtils.getMinMax -- small TextBlock trees via FixedMeasurer', () => {
  it('a single-rectangle TextBlock', () => {
    const sb = fixedStringBounder(6, 14);
    const tb: TextBlock = {
      drawU(ug): void {
        ug.draw(URectangle.build(20, 10));
      },
      calculateDimension: () => new XDimension2D(20, 10),
    };
    const mm = TextBlockUtils.getMinMax(tb, sb, false);
    expect(mm.getMinX()).toBe(-1);
    expect(mm.getMinY()).toBe(-1);
    expect(mm.getMaxX()).toBe(19);
    expect(mm.getMaxY()).toBe(9);
  });

  it('a TextBlockMarged-wrapped rectangle merges the padding UEmpty and the inner rect', () => {
    const sb = fixedStringBounder(6, 14);
    const inner: TextBlock = {
      drawU(ug): void {
        ug.draw(URectangle.build(20, 10));
      },
      calculateDimension: () => new XDimension2D(20, 10),
    };
    const marged = new TextBlockMarged(inner, 5, 5, 5, 5);
    const mm = TextBlockUtils.getMinMax(marged, sb, true);
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(0);
    expect(mm.getMaxX()).toBe(30);
    expect(mm.getMaxY()).toBe(20);
  });

  it('a UText-drawing TextBlock, measured through FixedMeasurer', () => {
    const sb = fixedStringBounder(6, 14);
    const tb: TextBlock = {
      drawU(ug): void {
        ug.draw(UText.build('AB', FONT));
      },
      calculateDimension: (bounder) => bounder.calculateDimension(FONT, 'AB'),
    };
    const mm = TextBlockUtils.getMinMax(tb, sb, true);
    // dim = 12x14 (2 chars * 6px, lineHeight 14); y -= (14 - 1.5) = -12.5
    expect(mm.getMinX()).toBe(0);
    expect(mm.getMinY()).toBe(-12.5);
    expect(mm.getMaxX()).toBe(12);
    expect(mm.getMaxY()).toBe(1.5);
  });
});
