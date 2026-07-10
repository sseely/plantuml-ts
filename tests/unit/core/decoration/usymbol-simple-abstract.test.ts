/**
 * usymbol-simple-abstract.test.ts — T3b: unit coverage for
 * `USymbolSimpleAbstract`, the template-method base for "icon above
 * label, stereotype above both" symbols, deferred by T3 and ported now
 * that `UGraphicStencil` exists.
 */
import { describe, expect, it } from 'vitest';
import { USymbolSimpleAbstract } from '../../../../src/core/decoration/symbol/USymbolSimpleAbstract.js';
import { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';

const stubStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: text.length * font.size * 0.5 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubStringBounder);
}

function fixedTextBlock(width: number, height: number): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(width, height),
    drawU: (ug) => ug.draw(URectangle.build(width, height)),
  };
}

/** A trivial concrete `USymbolSimpleAbstract` — `getDrawing` returns a
 * fixed "stickman" TextBlock, exercising the template method's own
 * layout math (stereotype above stickman above label) independent of
 * any real actor/person icon geometry. */
class TrivialSimpleSymbol extends USymbolSimpleAbstract {
  getSNames(): readonly string[] {
    return ['trivial-simple'];
  }

  protected getDrawing(_symbolContext: SymbolContext): TextBlock {
    return fixedTextBlock(8, 6);
  }
}

describe('USymbolSimpleAbstract', () => {
  it('calculateDimension merges stereotype/stickman/label per mergeLayoutT12B3', () => {
    const symbol = new TrivialSimpleSymbol();
    const ctx = new SymbolContext(null, null);
    const label = fixedTextBlock(10, 4);
    const stereotype = fixedTextBlock(6, 3);
    const tb = symbol.asSmall(fixedTextBlock(0, 0), label, stereotype, ctx, HorizontalAlignment.CENTER);
    const dim = tb.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(10);
    expect(dim.getHeight()).toBe(4 + 6 + 3);
  });

  it('drawU draws the stickman, label (through a stencil wrap), and stereotype', () => {
    const symbol = new TrivialSimpleSymbol();
    const ctx = new SymbolContext('#FF0000', null);
    const label = fixedTextBlock(10, 4);
    const stereotype = fixedTextBlock(6, 3);
    const tb = symbol.asSmall(fixedTextBlock(0, 0), label, stereotype, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    tb.drawU(ug);
    const svg = ug.getSvgString();
    // Three distinct rectangles: stickman (8x6), label (10x4), stereotype (6x3).
    expect(svg).toContain('width="8" height="6"');
    expect(svg).toContain('width="10" height="4"');
    expect(svg).toContain('width="6" height="3"');
  });

  it('positions the stickman centered above the label, below the stereotype', () => {
    const symbol = new TrivialSimpleSymbol();
    const ctx = new SymbolContext(null, null);
    const label = fixedTextBlock(10, 4);
    const stereotype = fixedTextBlock(6, 3);
    const tb = symbol.asSmall(fixedTextBlock(0, 0), label, stereotype, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    tb.drawU(ug);
    const svg = ug.getSvgString();
    // dimTotal.width = 10; stickman (8 wide) centers at x=(10-8)/2=1, y=dimStereo.height=3.
    expect(svg).toContain('x="1" y="3" width="8" height="6"');
    // label centers at x=(10-10)/2=0, y=dimStickMan.height(6)+dimStereo.height(3)=9.
    expect(svg).toContain('x="0" y="9" width="10" height="4"');
    // stereotype centers at x=(10-6)/2=2, y=0 (UTranslate.dx only).
    expect(svg).toContain('x="2" y="0" width="6" height="3"');
  });

  it('asBig throws (matches upstream UnsupportedOperationException)', () => {
    const symbol = new TrivialSimpleSymbol();
    const ctx = new SymbolContext(null, null);
    const label = fixedTextBlock(10, 4);
    const stereotype = fixedTextBlock(6, 3);
    expect(() =>
      symbol.asBig(label, HorizontalAlignment.CENTER, stereotype, 10, 10, ctx, HorizontalAlignment.CENTER),
    ).toThrow();
  });
});
