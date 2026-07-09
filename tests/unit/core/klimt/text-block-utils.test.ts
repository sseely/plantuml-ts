/**
 * text-block-utils.test.ts — T3b: unit coverage for the consolidated
 * `TextBlockUtils` shared static utility — the canonical `mergeTB`
 * target every USymbol* class was pointed at during this task's
 * consolidation, plus its other ported members and throw-stubs.
 */
import { describe, expect, it } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { StringBounder } from '../../../../src/core/klimt/font/StringBounder.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { XPoint2D } from '../../../../src/core/klimt/geom/XPoint2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../../../../src/core/klimt/geom/VerticalAlignment.js';
import { ClockwiseTopRightBottomLeft } from '../../../../src/core/klimt/geom/ClockwiseTopRightBottomLeft.js';
import { TextBlockUtils } from '../../../../src/core/klimt/shape/TextBlockUtils.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import type { UShape } from '../../../../src/core/klimt/UShape.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';

const stubStringBounder: StringBounder = { calculateDimension: () => new XDimension2D(0, 0) };

class TranslatingUGraphic implements UGraphic {
  private readonly translate: UTranslate;
  constructor(translate: UTranslate = UTranslate.none()) {
    this.translate = translate;
  }
  apply(change: UChange): UGraphic {
    if (change instanceof UTranslate) return new TranslatingUGraphic(this.translate.compose(change));
    return this;
  }
  draw(_shape: UShape): void {
    // no-op sink
  }
  getParam(): UParam {
    return {
      getStroke: () => {
        throw new Error('not needed');
      },
      getColor: () => 'none',
      getBackcolor: () => 'none',
      getTranslate: () => this.translate,
    };
  }
  getTranslate(): UTranslate {
    return this.translate;
  }
  getStringBounder(): StringBounder {
    return stubStringBounder;
  }
}

interface Recorded {
  readonly dx: number;
  readonly dy: number;
}

function recordingTextBlock(width: number, height: number, sink: Recorded[]): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(width, height),
    drawU: (ug) => {
      sink.push({ dx: ug.getTranslate().getDx(), dy: ug.getTranslate().getDy() });
    },
  };
}

describe('TextBlockUtils.empty / EMPTY_TEXT_BLOCK', () => {
  it('empty(w, h) reports the given dimension and draws nothing', () => {
    const block = TextBlockUtils.empty(3, 4);
    expect(block.calculateDimension(stubStringBounder)).toEqual(new XDimension2D(3, 4));
    expect(() => block.drawU(new TranslatingUGraphic())).not.toThrow();
  });

  it('EMPTY_TEXT_BLOCK is a (0,0) empty block', () => {
    const dim = TextBlockUtils.EMPTY_TEXT_BLOCK.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBe(0);
    expect(dim.getHeight()).toBe(0);
  });
});

describe('TextBlockUtils.mergeTB (canonical, consolidation target)', () => {
  it('merges two blocks top-to-bottom, matching XDimension2D.mergeTB', () => {
    const top = recordingTextBlock(6, 4, []);
    const bottom = recordingTextBlock(10, 5, []);
    const merged = TextBlockUtils.mergeTB(top, bottom, HorizontalAlignment.CENTER);
    const dim = merged.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBe(10);
    expect(dim.getHeight()).toBe(9);
  });

  it('returns b2 unchanged when b1 is EMPTY_TEXT_BLOCK', () => {
    const bottom = recordingTextBlock(10, 5, []);
    const merged = TextBlockUtils.mergeTB(TextBlockUtils.EMPTY_TEXT_BLOCK, bottom, HorizontalAlignment.LEFT);
    expect(merged).toBe(bottom);
  });

  it('returns b1 unchanged when b2 is EMPTY_TEXT_BLOCK', () => {
    const top = recordingTextBlock(10, 5, []);
    const merged = TextBlockUtils.mergeTB(top, TextBlockUtils.EMPTY_TEXT_BLOCK, HorizontalAlignment.LEFT);
    expect(merged).toBe(top);
  });

  it('draws with CENTER horizontal alignment (per-block dx centering)', () => {
    const sink: Recorded[] = [];
    const merged = TextBlockUtils.mergeTB(
      recordingTextBlock(6, 4, sink),
      recordingTextBlock(10, 5, sink),
      HorizontalAlignment.CENTER,
    );
    merged.drawU(new TranslatingUGraphic());
    expect(sink).toEqual([
      { dx: 2, dy: 0 },
      { dx: 0, dy: 4 },
    ]);
  });
});

describe('TextBlockUtils.mergeLR', () => {
  it('merges two blocks left-to-right, matching XDimension2D.mergeLR', () => {
    const left = recordingTextBlock(6, 4, []);
    const right = recordingTextBlock(10, 5, []);
    const merged = TextBlockUtils.mergeLR(left, right, VerticalAlignment.TOP);
    const dim = merged.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBe(16);
    expect(dim.getHeight()).toBe(5);
  });

  it('returns b2/b1 unchanged for EMPTY_TEXT_BLOCK fast paths', () => {
    const right = recordingTextBlock(10, 5, []);
    expect(TextBlockUtils.mergeLR(TextBlockUtils.EMPTY_TEXT_BLOCK, right, VerticalAlignment.TOP)).toBe(right);
    const left = recordingTextBlock(10, 5, []);
    expect(TextBlockUtils.mergeLR(left, TextBlockUtils.EMPTY_TEXT_BLOCK, VerticalAlignment.TOP)).toBe(left);
  });
});

describe('TextBlockUtils.withMargin / withMarginQuad', () => {
  it('returns the same block unchanged for all-zero margins', () => {
    const inner = recordingTextBlock(5, 5, []);
    expect(TextBlockUtils.withMargin(inner, 0, 0, 0, 0)).toBe(inner);
  });

  it('pads the dimension for non-zero margins', () => {
    const inner = recordingTextBlock(10, 5, []);
    const wrapped = TextBlockUtils.withMargin(inner, 1, 2, 3, 4);
    const dim = wrapped.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBe(10 + 1 + 2);
    expect(dim.getHeight()).toBe(5 + 3 + 4);
  });

  it('withMarginQuad delegates to TextBlockMarged.fromMargins', () => {
    const inner = recordingTextBlock(10, 5, []);
    const margins = ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4);
    const wrapped = TextBlockUtils.withMarginQuad(inner, margins);
    const dim = wrapped.calculateDimension(stubStringBounder);
    expect(dim.getWidth()).toBe(16);
    expect(dim.getHeight()).toBe(9);
  });
});

describe('TextBlockUtils.withMinWidth', () => {
  it('widens the dimension to at least minWidth', () => {
    const inner = recordingTextBlock(5, 3, []);
    const wrapped = TextBlockUtils.withMinWidth(inner, 20, HorizontalAlignment.LEFT);
    expect(wrapped.calculateDimension(stubStringBounder).getWidth()).toBe(20);
  });
});

describe('TextBlockUtils.asPositionable', () => {
  it('wraps a TextBlock, measuring its dimension at the given point', () => {
    const block = recordingTextBlock(10, 20, []);
    const p = TextBlockUtils.asPositionable(block, stubStringBounder, new XPoint2D(1, 2));
    expect(p.getPosition().getX()).toBe(1);
    expect(p.getPosition().getY()).toBe(2);
    expect(p.getSize().getWidth()).toBe(10);
    expect(p.getSize().getHeight()).toBe(20);
  });

  it('wraps a bare XDimension2D directly (no TextBlock measurement)', () => {
    const dim = new XDimension2D(7, 8);
    const p = TextBlockUtils.asPositionable(dim, stubStringBounder, new XPoint2D(0, 0));
    expect(p.getSize()).toBe(dim);
  });
});

describe('TextBlockUtils.isEmpty', () => {
  it('is true for null', () => {
    expect(TextBlockUtils.isEmpty(null, stubStringBounder)).toBe(true);
  });

  it('is true for EMPTY_TEXT_BLOCK', () => {
    expect(TextBlockUtils.isEmpty(TextBlockUtils.EMPTY_TEXT_BLOCK, stubStringBounder)).toBe(true);
  });

  it('is true for any (0,0)-dimension block', () => {
    expect(TextBlockUtils.isEmpty(TextBlockUtils.empty(0, 0), stubStringBounder)).toBe(true);
  });

  it('is false for a non-empty block', () => {
    expect(TextBlockUtils.isEmpty(recordingTextBlock(1, 1, []), stubStringBounder)).toBe(false);
  });
});

describe('TextBlockUtils throw-stubs (genuinely unported subsystems)', () => {
  it('getMinMax throws (requires LimitFinder/UGraphicNo/ColorMapper)', () => {
    expect(() => TextBlockUtils.getMinMax(recordingTextBlock(1, 1, []), stubStringBounder, true)).toThrow(
      /LimitFinder/,
    );
  });

  it('bordered throws (requires TextBlockBordered + HColor)', () => {
    expect(() => TextBlockUtils.bordered()).toThrow(/TextBlockBordered/);
  });

  it('addBackcolor throws (requires HColor)', () => {
    expect(() => TextBlockUtils.addBackcolor()).toThrow(/HColor/);
  });
});
