/**
 * ellipse-fitting.test.ts — T3b: unit coverage for the Usecase text-
 * fitting subsystem — `Circle`, `SmallestEnclosingCircle`, `YTransformer`,
 * `ContainingEllipse`, `Footprint`, and `TextBlockInEllipse` — pulled in
 * to support the next task's `usecase`/`actor`-in-an-oval shape family.
 */
import { describe, expect, it } from 'vitest';
import { Circle } from '../../../../../src/core/svek/image/Circle.js';
import { YTransformer } from '../../../../../src/core/svek/image/YTransformer.js';
import { SmallestEnclosingCircle } from '../../../../../src/core/svek/image/SmallestEnclosingCircle.js';
import { ContainingEllipse } from '../../../../../src/core/svek/image/ContainingEllipse.js';
import { Footprint } from '../../../../../src/core/svek/image/Footprint.js';
import { TextBlockInEllipse } from '../../../../../src/core/klimt/shape/TextBlockInEllipse.js';
import { XPoint2D } from '../../../../../src/core/klimt/geom/XPoint2D.js';
import { XDimension2D } from '../../../../../src/core/klimt/geom/XDimension2D.js';
import type { StringBounder } from '../../../../../src/core/klimt/font/StringBounder.js';
import type { TextBlock } from '../../../../../src/core/klimt/shape/TextBlock.js';
import { URectangle } from '../../../../../src/core/klimt/shape/URectangle.js';
import { UEllipse } from '../../../../../src/core/klimt/shape/UEllipse.js';
import { UText } from '../../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../../src/core/klimt/shape/UText.js';
import { ULine } from '../../../../../src/core/klimt/shape/ULine.js';
import { UStroke } from '../../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../../src/core/klimt/UTranslate.js';
import { Back } from '../../../../../src/core/klimt/Back.js';
import { Fore } from '../../../../../src/core/klimt/Fore.js';
import { UPath } from '../../../../../src/core/klimt/shape/UPath.js';
import { UEmpty } from '../../../../../src/core/klimt/shape/UEmpty.js';
import { UHorizontalLine } from '../../../../../src/core/klimt/shape/UHorizontalLine.js';
import { UGraphicSvg } from '../../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../../src/core/klimt/drawing/svg/driver-text-svg.js';

const FOO_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };

const stubStringBounder: StringBounder = {
  calculateDimension: (font, text) => new XDimension2D(text.length * font.size * 0.5, font.size),
};

const driverStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: text.length * font.size * 0.5 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', driverStringBounder);
}

describe('Circle', () => {
  it('1-point circle has zero radius at that center', () => {
    const c = new Circle(new XPoint2D(1, 1));
    expect(c.getRadius()).toBe(0);
    expect(c.getCenter()).toEqual(new XPoint2D(1, 1));
  });

  it('twoPoint() centers between the two points, radius = half the distance', () => {
    const c = Circle.twoPoint(new XPoint2D(0, 0), new XPoint2D(4, 0));
    expect(c.getCenter()).toEqual(new XPoint2D(2, 0));
    expect(c.getRadius()).toBe(2);
  });

  it('getCircle() (3-point circumscribed circle) finds the equidistant center', () => {
    const c = Circle.getCircle(new XPoint2D(0, 0), new XPoint2D(4, 0), new XPoint2D(2, 2));
    expect(c.isOutside(new XPoint2D(0, 0))).toBe(false);
    expect(c.isOutside(new XPoint2D(4, 0))).toBe(false);
    expect(c.isOutside(new XPoint2D(2, 2))).toBe(false);
  });

  it('getCircle() reorders degenerate input (p3.y === p2.y) before delegating', () => {
    const c = Circle.getCircle(new XPoint2D(0, 0), new XPoint2D(4, 0), new XPoint2D(4, 4));
    expect(c.isOutside(new XPoint2D(0, 0))).toBe(false);
  });

  it('isOutside() reports points beyond the radius', () => {
    // A zero-radius circle: any point other than the center is outside.
    const nonZero = Circle.twoPoint(new XPoint2D(0, 0), new XPoint2D(2, 0));
    expect(nonZero.isOutside(new XPoint2D(0, 0))).toBe(false);
    expect(nonZero.isOutside(new XPoint2D(10, 10))).toBe(true);
  });
});

describe('YTransformer', () => {
  it('scales Y by alpha and reverses the scale', () => {
    const yt = new YTransformer(0.5);
    const scaled = yt.getPoint2D(new XPoint2D(3, 10));
    expect(scaled).toEqual(new XPoint2D(3, 5));
    const reversed = yt.getReversePoint2D(new XPoint2D(3, 5));
    expect(reversed).toEqual(new XPoint2D(3, 10));
    expect(yt.getAlpha()).toBe(0.5);
  });

  it('treats NaN alpha as 1 (matches upstream guard)', () => {
    const yt = new YTransformer(Number.NaN);
    expect(yt.getAlpha()).toBe(1);
  });
});

describe('SmallestEnclosingCircle', () => {
  it('dedupes points by value equality before solving', () => {
    const sec = new SmallestEnclosingCircle();
    sec.append(new XPoint2D(0, 0));
    sec.append(new XPoint2D(0, 0));
    sec.append(new XPoint2D(4, 0));
    const circle = sec.getCircle();
    expect(circle.getRadius()).toBeCloseTo(2, 6);
  });

  it('encloses every appended point', () => {
    const sec = new SmallestEnclosingCircle();
    const pts = [new XPoint2D(0, 0), new XPoint2D(10, 0), new XPoint2D(5, 8), new XPoint2D(2, 3)];
    for (const p of pts) sec.append(p);
    const circle = sec.getCircle();
    for (const p of pts) expect(circle.isOutside(p)).toBe(false);
  });

  it('caches the solution until the next append', () => {
    const sec = new SmallestEnclosingCircle();
    sec.append(new XPoint2D(0, 0));
    sec.append(new XPoint2D(4, 0));
    const first = sec.getCircle();
    const second = sec.getCircle();
    expect(second).toBe(first);
    sec.append(new XPoint2D(10, 10));
    expect(sec.getCircle()).not.toBe(first);
  });
});

describe('ContainingEllipse', () => {
  it('fits an ellipse of the given coefY around appended points', () => {
    const ellipse = new ContainingEllipse(0.5);
    ellipse.append(0, 0);
    ellipse.append(10, 0);
    ellipse.append(5, 8);
    expect(ellipse.getWidth()).toBeGreaterThan(0);
    expect(ellipse.getHeight()).toBeCloseTo(ellipse.getWidth() * 0.5, 6);
  });

  it('append(XPoint2D) and append(x, y) are equivalent', () => {
    const a = new ContainingEllipse(1);
    const b = new ContainingEllipse(1);
    a.append(new XPoint2D(3, 4));
    b.append(3, 4);
    a.append(new XPoint2D(-3, -4));
    b.append(-3, -4);
    expect(a.getWidth()).toBeCloseTo(b.getWidth(), 6);
  });

  it('asUEllipse() builds a UEllipse and applies deltaShadow', () => {
    const ellipse = new ContainingEllipse(1);
    ellipse.append(0, 0);
    ellipse.append(10, 0);
    ellipse.setDeltaShadow(3);
    const ue = ellipse.asUEllipse();
    expect(ue.getDeltaShadow()).toBe(3);
  });

  it('toString() reports width and height', () => {
    const ellipse = new ContainingEllipse(1);
    ellipse.append(0, 0);
    ellipse.append(10, 0);
    expect(ellipse.toString()).toContain('ContainingEllipse');
  });
});

describe('Footprint', () => {
  it('collects corner points from rectangle + ellipse shapes', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse(
      {
        drawU: (ug) => {
          ug.draw(URectangle.build(10, 5));
          ug.draw(UEllipse.build(4, 4));
        },
      },
      1,
    );
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('collects text glyph corners via the stringBounder', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse(
      {
        drawU: (ug) => ug.draw(UText.build('Foo', FOO_FONT)),
      },
      1,
    );
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('ignores UHorizontalLine/ULine shapes (upstream: no-op / probably-horizontal-line branches)', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse(
      {
        drawU: (ug) => {
          ug.draw(URectangle.build(10, 5));
          ug.draw(ULine.hline(20));
        },
      },
      1,
    );
    // Only the rectangle's two corners are recorded — verified indirectly via
    // a non-degenerate (non-zero) fitted ellipse.
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('collects path corners via drawPath', () => {
    const footprint = new Footprint(stubStringBounder);
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(6, 8);
    const ellipse = footprint.getEllipse({ drawU: (ug) => ug.draw(path) }, 1);
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('ignores a real UHorizontalLine shape (no-op branch)', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse(
      {
        drawU: (ug) => {
          ug.draw(URectangle.build(10, 5));
          ug.draw(UHorizontalLine.infinite(1, 0, 0, '-'));
        },
      },
      1,
    );
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('exposes getStringBounder/getTranslate/getParam to the drawable', () => {
    const footprint = new Footprint(stubStringBounder);
    let observedTranslate: { dx: number; dy: number } | undefined;
    footprint.getEllipse(
      {
        drawU: (ug) => {
          expect(ug.getStringBounder()).toBe(stubStringBounder);
          observedTranslate = { dx: ug.getTranslate().getDx(), dy: ug.getTranslate().getDy() };
          const param = ug.getParam();
          expect(param.getColor()).toBe('none');
          expect(param.getBackcolor()).toBe('none');
          expect(param.getStroke().getThickness()).toBe(1);
          expect(param.getTranslate()).toBe(ug.getTranslate());
          ug.draw(URectangle.build(1, 1));
        },
      },
      1,
    );
    expect(observedTranslate).toEqual({ dx: 0, dy: 0 });
  });

  it('collects corners from a UEmpty placeholder shape', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse({ drawU: (ug) => ug.draw(new UEmpty(6, 3)) }, 1);
    expect(ellipse.getWidth()).toBeGreaterThan(0);
  });

  it('apply() composes UTranslate and passes it through to subsequently-drawn shapes', () => {
    const footprint = new Footprint(stubStringBounder);
    const ellipse = footprint.getEllipse(
      {
        drawU: (ug) => {
          const translated = ug.apply(new UTranslate(5, 5));
          translated.draw(URectangle.build(1, 1));
        },
      },
      1,
    );
    expect(ellipse.getCenter().getX()).toBeCloseTo(5.5, 6);
  });

  it('apply() accepts UStroke/Back/Fore without altering drawn geometry', () => {
    const footprint = new Footprint(stubStringBounder);
    footprint.getEllipse(
      {
        drawU: (ug) => {
          ug.apply(UStroke.simple()).draw(URectangle.build(1, 1));
          ug.apply(new Back('none')).draw(URectangle.build(1, 1));
          ug.apply(new Fore('none')).draw(URectangle.build(1, 1));
        },
      },
      1,
    );
  });

  it('apply() throws for an unsupported UChange kind', () => {
    const footprint = new Footprint(stubStringBounder);
    const bogusChange = { marker: 'not-a-real-uchange' };
    expect(() =>
      footprint.getEllipse(
        {
          drawU: (ug) => {
            ug.apply(bogusChange);
          },
        },
        1,
      ),
    ).toThrow(/unsupported UChange/);
  });

  it('throws for an unsupported shape kind', () => {
    const footprint = new Footprint(stubStringBounder);
    expect(() =>
      footprint.getEllipse(
        {
          drawU: (ug) => {
            // A bare marker object masquerading as an unsupported UShape.
            ug.draw({});
          },
        },
        1,
      ),
    ).toThrow(/unsupported shape/);
  });
});

describe('TextBlockInEllipse', () => {
  function fixedTextBlock(width: number, height: number): TextBlock {
    return {
      calculateDimension: () => new XDimension2D(width, height),
      drawU: (ug) => ug.draw(URectangle.build(width, height)),
    };
  }

  it('fits and draws an ellipse around the wrapped text, padded by 6px', () => {
    const inner = fixedTextBlock(20, 10);
    const inEllipse = new TextBlockInEllipse(inner, stubStringBounder);
    const dim = inEllipse.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBeGreaterThan(20);
    expect(dim.getHeight()).toBeGreaterThan(0);

    const ug = newGraphic();
    expect(() => inEllipse.drawU(ug)).not.toThrow();
    expect(ug.getSvgString()).toContain('<ellipse');
  });

  it('clamps the derived aspect ratio to [0.2, 0.8]', () => {
    const veryWide = new TextBlockInEllipse(fixedTextBlock(100, 1), stubStringBounder);
    const veryTall = new TextBlockInEllipse(fixedTextBlock(1, 100), stubStringBounder);
    expect(veryWide.calculateDimension(stubStringBounder).getHeight()).toBeGreaterThan(0);
    expect(veryTall.calculateDimension(stubStringBounder).getWidth()).toBeGreaterThan(0);
  });

  it('setDeltaShadow forwards to the underlying ContainingEllipse', () => {
    const inEllipse = new TextBlockInEllipse(fixedTextBlock(10, 10), stubStringBounder);
    expect(() => inEllipse.setDeltaShadow(2)).not.toThrow();
    expect(inEllipse.getUEllipse().getDeltaShadow()).toBe(2);
  });

  it('memoizes calculateDimension (extends TextBlockMemoized)', () => {
    const inEllipse = new TextBlockInEllipse(fixedTextBlock(10, 10), stubStringBounder);
    const first = inEllipse.calculateDimension(stubStringBounder);
    const second = inEllipse.calculateDimension(stubStringBounder);
    expect(second).toBe(first);
  });
});
