import { describe, expect, it } from 'vitest';
import { USymbol, Margin } from '../../../../src/core/decoration/symbol/USymbol.js';
import { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { MagneticBorderNone } from '../../../../src/core/klimt/geom/MagneticBorderNone.js';
import type { MagneticBorder } from '../../../../src/core/klimt/geom/MagneticBorder.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { textBlockMagneticBorder } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { StringBounder } from '../../../../src/core/klimt/font/StringBounder.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';

const stubStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: text.length * font.size * 0.5 };
  },
};

const emptyTextBlock: TextBlock = {
  calculateDimension: () => new XDimension2D(0, 0),
  drawU: () => {
    // no-op: this stub carries no drawable content.
  },
};

/** A trivial concrete USymbol used only to exercise the base plumbing —
 * `asBig` draws a plain rectangle through the given SymbolContext,
 * `asSmall` is unused by the acceptance criteria and throws, matching
 * upstream's own `UnsupportedOperationException` pattern (e.g.
 * `USymbolSimpleAbstract#asBig`) for the unexercised half of the pair. */
class TrivialSymbol extends USymbol {
  getSNames(): readonly string[] {
    return ['trivial'];
  }

  asSmall(): TextBlock {
    throw new Error('asSmall not exercised by this trivial symbol');
  }

  asBig(
    _label: TextBlock,
    _labelAlignment: HorizontalAlignment,
    _stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    return {
      calculateDimension: (_sb: StringBounder) => new XDimension2D(width, height),
      drawU: (ug) => {
        const applied = symbolContext.apply(ug);
        applied.draw(URectangle.build(width, height));
      },
    };
  }
}

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubStringBounder);
}

describe('USymbol base + SymbolContext (T3, AC1)', () => {
  it('flows draw calls through with SymbolContext colors/stroke applied', () => {
    const ug = newGraphic();
    const ctx = new SymbolContext('#FF0000', '#0000FF').withStroke(UStroke.withThickness(2));
    const symbol = new TrivialSymbol();

    const big = symbol.asBig(emptyTextBlock, HorizontalAlignment.CENTER, emptyTextBlock, 40, 20, ctx, HorizontalAlignment.CENTER);
    big.drawU(ug);

    expect(ug.getSvgString()).toContain(
      '<rect x="0" y="0" width="40" height="20" fill="#FF0000" style="stroke:#0000FF;stroke-width:2;"/>',
    );
  });

  it('calculateDimension reports the requested width/height', () => {
    const symbol = new TrivialSymbol();
    const ctx = new SymbolContext(null, null);
    const big = symbol.asBig(emptyTextBlock, HorizontalAlignment.LEFT, emptyTextBlock, 40, 20, ctx, HorizontalAlignment.LEFT);
    const dim = big.calculateDimension({} as StringBounder);
    expect(dim.getWidth()).toBe(40);
    expect(dim.getHeight()).toBe(20);
  });

  it('null backColor/foreColor apply the none paint keyword', () => {
    const ug = newGraphic();
    const ctx = new SymbolContext(null, null);
    const symbol = new TrivialSymbol();
    symbol.asBig(emptyTextBlock, HorizontalAlignment.CENTER, emptyTextBlock, 10, 10, ctx, HorizontalAlignment.CENTER).drawU(ug);
    expect(ug.getSvgString()).toContain('fill="none"');
  });

  it('getSNames returns the symbol-declared names', () => {
    expect(new TrivialSymbol().getSNames()).toEqual(['trivial']);
  });

  it('suppHeightBecauseOfShape/suppWidthBecauseOfShape default to 0', () => {
    const symbol = new TrivialSymbol();
    expect(symbol.suppHeightBecauseOfShape()).toBe(0);
    expect(symbol.suppWidthBecauseOfShape()).toBe(0);
  });
});

describe('SymbolContext copy-on-write semantics (T3, AC2)', () => {
  it('withShadow/withDeltaShadow produce independent copies', () => {
    const base = new SymbolContext('#111111', '#222222');
    const shadowed = base.withShadow(5);
    const shadowed2 = base.withDeltaShadow(7);

    expect(base.getDeltaShadow()).toBe(0);
    expect(base.isShadowing()).toBe(false);
    expect(shadowed.getDeltaShadow()).toBe(5);
    expect(shadowed.isShadowing()).toBe(true);
    expect(shadowed2.getDeltaShadow()).toBe(7);
    expect(base).not.toBe(shadowed);
    expect(shadowed).not.toBe(shadowed2);
  });

  it('withStroke produces an independent copy, base stroke untouched', () => {
    const base = new SymbolContext('#111111', '#222222');
    const restroked = base.withStroke(UStroke.withThickness(9));

    expect(base.getStroke().getThickness()).toBe(1.0);
    expect(restroked.getStroke().getThickness()).toBe(9);
    expect(base.getStroke()).not.toBe(restroked.getStroke());
  });

  it('withBackColor/withForeColor produce independent copies', () => {
    const base = new SymbolContext('#111111', '#222222');
    const rebacked = base.withBackColor('#333333');
    const reforecolored = base.withForeColor('#444444');

    expect(base.getBackColor()).toBe('#111111');
    expect(rebacked.getBackColor()).toBe('#333333');
    expect(base.getForeColor()).toBe('#222222');
    expect(reforecolored.getForeColor()).toBe('#444444');
  });

  it('withCorner produces an independent copy', () => {
    const base = new SymbolContext('#111111', '#222222');
    const cornered = base.withCorner(4, 8);

    expect(base.getRoundCorner()).toBe(0);
    expect(base.getDiagonalCorner()).toBe(0);
    expect(cornered.getRoundCorner()).toBe(4);
    expect(cornered.getDiagonalCorner()).toBe(8);
  });

  it('toString reports back/fore colors', () => {
    const ctx = new SymbolContext('#111111', '#222222');
    expect(ctx.toString()).toContain('#111111');
    expect(ctx.toString()).toContain('#222222');
  });

  it('toString reports null colors and formats gradient paints', () => {
    expect(new SymbolContext(null, null).toString()).toContain('backColor=null');
    const gradientCtx = new SymbolContext(
      { color1: '#111111', color2: '#222222', policy: '/' },
      null,
    );
    expect(gradientCtx.toString()).toContain('backColor=#111111/#222222');
  });
});

describe('USymbol/Margin', () => {
  it('sums x1/x2 and y1/y2 for width/height, exposes x1/y1', () => {
    const margin = new Margin(10, 12, 3, 5);
    expect(margin.getWidth()).toBe(22);
    expect(margin.getHeight()).toBe(8);
    expect(margin.getX1()).toBe(10);
    expect(margin.getY1()).toBe(3);
  });

  it('addDimension pads a dimension by the margin', () => {
    const margin = new Margin(10, 12, 3, 5);
    const dim = margin.addDimension(new XDimension2D(100, 50));
    expect(dim.getWidth()).toBe(122);
    expect(dim.getHeight()).toBe(58);
  });
});

describe('XDimension2D', () => {
  it('rejects negative width/height/NaN', () => {
    expect(() => new XDimension2D(-1, 0)).toThrow();
    expect(() => new XDimension2D(0, -1)).toThrow();
    expect(() => new XDimension2D(NaN, 0)).toThrow();
  });

  it('delta shifts width/height by the same amount when only one arg is given', () => {
    const dim = new XDimension2D(10, 20).delta(5);
    expect(dim.getWidth()).toBe(15);
    expect(dim.getHeight()).toBe(25);
  });

  it('delta(0,0) returns the same instance', () => {
    const dim = new XDimension2D(10, 20);
    expect(dim.delta(0, 0)).toBe(dim);
  });

  it('delta shifts width/height independently with two args', () => {
    const dim = new XDimension2D(10, 20).delta(1, 2);
    expect(dim.getWidth()).toBe(11);
    expect(dim.getHeight()).toBe(22);
  });

  it('withWidth replaces only the width', () => {
    const dim = new XDimension2D(10, 20).withWidth(99);
    expect(dim.getWidth()).toBe(99);
    expect(dim.getHeight()).toBe(20);
  });

  it('applyTranslate offsets both dimensions', () => {
    const dim = new XDimension2D(10, 20).applyTranslate(new UTranslate(3, 4));
    expect(dim.getWidth()).toBe(13);
    expect(dim.getHeight()).toBe(24);
  });

  it('mergeTB (2-arg) stacks top/bottom: max width, summed height', () => {
    const merged = new XDimension2D(10, 5).mergeTB(new XDimension2D(20, 7));
    expect(merged.getWidth()).toBe(20);
    expect(merged.getHeight()).toBe(12);
  });

  it('mergeTB (3-arg) stacks three dimensions: max width, summed height', () => {
    const merged = new XDimension2D(10, 5).mergeTB(new XDimension2D(20, 7), new XDimension2D(5, 3));
    expect(merged.getWidth()).toBe(20);
    expect(merged.getHeight()).toBe(15);
  });

  it('mergeLR lays out left/right: summed width, max height', () => {
    const merged = new XDimension2D(10, 5).mergeLR(new XDimension2D(20, 7));
    expect(merged.getWidth()).toBe(30);
    expect(merged.getHeight()).toBe(7);
  });

  it('atLeast enforces a floor on width/height', () => {
    const dim = new XDimension2D(10, 5).atLeast(20, 20);
    expect(dim.getWidth()).toBe(20);
    expect(dim.getHeight()).toBe(20);
  });

  it('atLeast returns the same instance when already above both floors', () => {
    const dim = new XDimension2D(30, 30);
    expect(dim.atLeast(10, 10)).toBe(dim);
  });

  it('mergeLayoutT12B3 stacks two tops and a bottom: max width, summed height', () => {
    const merged = XDimension2D.mergeLayoutT12B3(new XDimension2D(5, 1), new XDimension2D(9, 2), new XDimension2D(3, 4));
    expect(merged.getWidth()).toBe(9);
    expect(merged.getHeight()).toBe(7);
  });

  it('max grows to the larger of two dimensions', () => {
    const merged = XDimension2D.max(new XDimension2D(5, 50), new XDimension2D(10, 10));
    expect(merged.getWidth()).toBe(10);
    expect(merged.getHeight()).toBe(50);
  });

  it('toString reports [width,height]', () => {
    expect(new XDimension2D(3, 4).toString()).toBe('[3,4]');
  });
});

describe('HorizontalAlignment', () => {
  it('exposes LEFT/CENTER/RIGHT', () => {
    expect(HorizontalAlignment.LEFT).toBe('LEFT');
    expect(HorizontalAlignment.CENTER).toBe('CENTER');
    expect(HorizontalAlignment.RIGHT).toBe('RIGHT');
  });
});

describe('MagneticBorder / MagneticBorderNone / textBlockMagneticBorder', () => {
  it('MagneticBorderNone.getForceAt always returns a zero translate', () => {
    const border = new MagneticBorderNone();
    const force = border.getForceAt({ x: 12, y: 34 });
    expect(force.getDx()).toBe(0);
    expect(force.getDy()).toBe(0);
  });

  it('textBlockMagneticBorder defaults to MagneticBorderNone when unset', () => {
    const border = textBlockMagneticBorder(emptyTextBlock);
    expect(border.getForceAt({ x: 0, y: 0 }).getDx()).toBe(0);
    expect(border.getForceAt({ x: 0, y: 0 }).getDy()).toBe(0);
  });

  it('textBlockMagneticBorder uses the override when present', () => {
    const customForce = new UTranslate(1, 2);
    const custom: MagneticBorder = { getForceAt: () => customForce };
    const overridden: TextBlock = {
      ...emptyTextBlock,
      getMagneticBorder: () => custom,
    };
    const border = textBlockMagneticBorder(overridden);
    expect(border.getForceAt({ x: 0, y: 0 })).toBe(customForce);
  });
});
