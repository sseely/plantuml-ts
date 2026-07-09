/**
 * stencil-subsystem.test.ts — T3b: unit coverage for the base stencil/
 * horizontal-line clipping subsystem: `Stencil`, `UGraphicDelegator`,
 * `AbstractUGraphicHorizontalLine`, `UGraphicStencil`, `UHorizontalLine`.
 *
 * The centerpiece is a DIRECT interception test (mission-brief
 * requirement): a `UHorizontalLine` drawn through a plain `UGraphicSvg`
 * has no registered driver and throws; the same line drawn through
 * `UGraphicStencil.create(ug, dim)` is intercepted before ever reaching
 * `UGraphicSvg`'s dispatch, and renders as a real, clipped `<line>`.
 */
import { describe, expect, it } from 'vitest';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { UGraphicStencil } from '../../../../src/core/klimt/drawing/UGraphicStencil.js';
import { UHorizontalLine } from '../../../../src/core/klimt/shape/UHorizontalLine.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import { AbstractUGraphicHorizontalLine } from '../../../../src/core/klimt/drawing/AbstractUGraphicHorizontalLine.js';
import { UGraphicDelegator } from '../../../../src/core/klimt/drawing/UGraphicDelegator.js';

const stubStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: text.length * font.size * 0.5 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubStringBounder);
}

describe('UHorizontalLine + UGraphicStencil direct interception (mission-brief requirement)', () => {
  it('throws when drawn through a plain UGraphicSvg (no driver registered)', () => {
    const ug = newGraphic();
    const line = UHorizontalLine.infinite(1, 0, 0, '-');
    expect(() => line.drawMe(ug)).toThrow(/No driver registered/);
  });

  it('is intercepted and rendered as a clipped <line> when wrapped in UGraphicStencil', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(50, 10);
    const stenciled = UGraphicStencil.create(ug, dim);
    const line = UHorizontalLine.infinite(1, 0, 0, '-');
    expect(() => line.drawMe(stenciled)).not.toThrow();
    const svg = ug.getSvgString();
    expect(svg).toContain('<line x1="0" y1="0" x2="50" y2="0"');
  });

  it('honors skipAtStart/skipAtEnd clearance', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(50, 10);
    const stenciled = UGraphicStencil.create(ug, dim);
    const line = UHorizontalLine.infinite(1, 5, 8, '-');
    line.drawMe(stenciled);
    const svg = ug.getSvgString();
    expect(svg).toContain('<line x1="5" y1="0" x2="42" y2="0"');
  });

  it('draws two parallel lines for the "=" (double) style, 2px apart', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(20, 10);
    const stenciled = UGraphicStencil.create(ug, dim);
    const line = UHorizontalLine.infinite(1, 0, 0, '=');
    line.drawMe(stenciled);
    const svg = ug.getSvgString();
    expect(svg).toContain('<line x1="0" y1="0" x2="20" y2="0"');
    expect(svg).toContain('<line x1="0" y1="2" x2="20" y2="2"');
  });

  it('non-UHorizontalLine shapes pass through the stencil to the wrapped ug unchanged', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(50, 10);
    const stenciled = UGraphicStencil.create(ug, dim);
    stenciled.draw(URectangle.build(5, 5));
    const svg = ug.getSvgString();
    expect(svg).toContain('<rect x="0" y="0" width="5" height="5"');
  });

  it('composes translates before delegating to the wrapped ug', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(50, 10);
    const stenciled = UGraphicStencil.create(ug, dim).apply(new UTranslate(3, 4));
    stenciled.draw(URectangle.build(5, 5));
    const svg = ug.getSvgString();
    expect(svg).toContain('<rect x="3" y="4" width="5" height="5"');
  });

  it('getStroke() throws for an unset (\\0) style, matching upstream IllegalStateException', () => {
    const line = UHorizontalLine.infinite(1, 0, 0, '\0');
    expect(() => line.getStroke()).toThrow();
  });

  it('getStroke() returns a dashed UStroke(1,2,1) for "." style', () => {
    const line = UHorizontalLine.infinite(1, 0, 0, '.');
    expect(line.getStroke().getDashVisible()).toBe(1);
    expect(line.getStroke().getDashSpace()).toBe(2);
  });

  it('isDouble() is true only for "=" style', () => {
    expect(UHorizontalLine.infinite(1, 0, 0, '=').isDouble()).toBe(true);
    expect(UHorizontalLine.infinite(1, 0, 0, '-').isDouble()).toBe(false);
  });

  it('draws a centered title between the two half-line segments', () => {
    const ug = newGraphic();
    const dim = new XDimension2D(50, 10);
    const stenciled = UGraphicStencil.create(ug, dim);
    const title = {
      calculateDimension: () => new XDimension2D(10, 4),
      drawU: (g: UGraphic) => g.draw(URectangle.build(10, 4)),
    };
    const line = UHorizontalLine.infinite(1, 0, 0, '-', title);
    line.drawMe(stenciled);
    const svg = ug.getSvgString();
    // First half: 0 -> 20 (widthToUse=50, len=(50-10)/2=20); second half: 30 -> 50.
    expect(svg).toContain('<line x1="0" y1="0" x2="20" y2="0"');
    expect(svg).toContain('<line x1="30" y1="0" x2="50" y2="0"');
    expect(svg).toContain('<rect');
  });
});

describe('UGraphicDelegator (base delegation surface)', () => {
  class TrivialDelegator extends UGraphicDelegator {
    apply(_change: UChange): UGraphic {
      return this;
    }
  }

  it('delegates getStringBounder/getParam/getTranslate/draw to the wrapped ug', () => {
    const ug = newGraphic();
    const delegator = new TrivialDelegator(ug);
    const font = { family: 'sans-serif', size: 10 };
    expect(delegator.getStringBounder().calculateDimension(font, 'ab')).toEqual(
      ug.getStringBounder().calculateDimension(font, 'ab'),
    );
    expect(delegator.getTranslate()).toEqual(ug.getTranslate());
    expect(delegator.getParam().getColor()).toBe(ug.getParam().getColor());
    expect(delegator.getParam().getBackcolor()).toBe(ug.getParam().getBackcolor());
    delegator.draw(URectangle.build(1, 1));
    expect(ug.getSvgString()).toContain('<rect x="0" y="0" width="1" height="1"');
  });
});

describe('AbstractUGraphicHorizontalLine (base horizontal-line interception)', () => {
  class RecordingHLine extends AbstractUGraphicHorizontalLine {
    intercepted: { y: number } | undefined;

    constructor(ug: UGraphic) {
      super(ug);
    }

    protected copy(ug: UGraphic): AbstractUGraphicHorizontalLine {
      const copy = new RecordingHLine(ug);
      copy.intercepted = this.intercepted;
      return copy;
    }

    protected drawHline(_ug: UGraphic, _line: UHorizontalLine, translate: UTranslate): void {
      this.intercepted = { y: translate.getDy() };
    }
  }

  it('intercepts UHorizontalLine and passes the composed dy through', () => {
    const ug = newGraphic();
    const wrapper = new RecordingHLine(ug).apply(new UTranslate(0, 7)) as RecordingHLine;
    const line = UHorizontalLine.infinite(1, 0, 0, '-');
    wrapper.draw(line);
    expect(wrapper.intercepted).toEqual({ y: 7 });
  });

  it('passes non-UHorizontalLine shapes straight through to the wrapped ug, translated', () => {
    const ug = newGraphic();
    const wrapper = new RecordingHLine(ug).apply(new UTranslate(2, 3));
    wrapper.draw(URectangle.build(4, 4));
    expect(ug.getSvgString()).toContain('<rect x="2" y="3" width="4" height="4"');
  });
});

