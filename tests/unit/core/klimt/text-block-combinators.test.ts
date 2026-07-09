/**
 * text-block-combinators.test.ts — T3b: unit coverage for the shared
 * `TextBlock` combinator base ported alongside `TextBlockUtils`:
 * `TextBlockMemoized`, `TextBlockVertical`, `TextBlockHorizontal`,
 * `TextBlockMarged`, `TextBlockMinWidth`, `UEmpty`.
 */
import { describe, expect, it } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { StringBounder } from '../../../../src/core/klimt/font/StringBounder.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../../../../src/core/klimt/geom/VerticalAlignment.js';
import { ClockwiseTopRightBottomLeft } from '../../../../src/core/klimt/geom/ClockwiseTopRightBottomLeft.js';
import { TextBlockMemoized } from '../../../../src/core/klimt/shape/TextBlockMemoized.js';
import { TextBlockVertical } from '../../../../src/core/klimt/shape/TextBlockVertical.js';
import { TextBlockHorizontal } from '../../../../src/core/klimt/shape/TextBlockHorizontal.js';
import { TextBlockMarged } from '../../../../src/core/klimt/shape/TextBlockMarged.js';
import { TextBlockMinWidth } from '../../../../src/core/klimt/shape/TextBlockMinWidth.js';
import { UEmpty } from '../../../../src/core/klimt/shape/UEmpty.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import type { UShape } from '../../../../src/core/klimt/UShape.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';

const stubStringBounder: StringBounder = { calculateDimension: () => new XDimension2D(0, 0) };

/**
 * A minimal translate-composing `UGraphic` test double — deliberately
 * NOT `UGraphicSvg`, since no driver is registered for `UEmpty`
 * (`TextBlockMarged#drawU` draws one) and this test suite's assertions
 * are all about translate composition (via `recordingTextBlock`), not
 * SVG serialization. `draw()` is a no-op for every shape, matching the
 * "observe, don't mock" testability principle: the combinator under
 * test is exercised for real, only the terminal draw sink is stubbed.
 */
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
    // no-op sink — see class doc comment.
  }

  getParam(): UParam {
    return {
      getStroke: () => {
        throw new Error('not needed by this test suite');
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

function newGraphic(): UGraphic {
  return new TranslatingUGraphic();
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

describe('TextBlockMemoized', () => {
  class CountingBlock extends TextBlockMemoized {
    calls = 0;
    calculateDimensionSlow(_sb: StringBounder): XDimension2D {
      this.calls++;
      return new XDimension2D(1, 1);
    }
    drawU(_ug: UGraphic): void {
      // no-op
    }
    invalidate(): void {
      this.invalidateDimensionCache();
    }
  }

  it('memoizes calculateDimension for the same StringBounder implementation', () => {
    const block = new CountingBlock();
    const sb: StringBounder = { calculateDimension: () => new XDimension2D(0, 0) };
    block.calculateDimension(sb);
    block.calculateDimension(sb);
    expect(block.calls).toBe(1);
  });

  it('recomputes after invalidateDimensionCache() is called', () => {
    const block = new CountingBlock();
    const sb: StringBounder = { calculateDimension: () => new XDimension2D(0, 0) };
    block.calculateDimension(sb);
    block.invalidate();
    block.calculateDimension(sb);
    expect(block.calls).toBe(2);
  });

  it('recomputes when the StringBounder implementation (constructor) changes', () => {
    const block = new CountingBlock();
    const sbA: StringBounder = { calculateDimension: () => new XDimension2D(0, 0) };
    class OtherBounder implements StringBounder {
      calculateDimension(): XDimension2D {
        return new XDimension2D(0, 0);
      }
    }
    const sbB = new OtherBounder();
    block.calculateDimension(sbA);
    block.calculateDimension(sbB);
    expect(block.calls).toBe(2);
  });
});

describe('TextBlockVertical', () => {
  it('throws when constructed with fewer than 2 blocks', () => {
    expect(() => new TextBlockVertical([recordingTextBlock(1, 1, [])], HorizontalAlignment.LEFT)).toThrow();
  });

  it('stacks blocks and merges their dimensions (mergeTB semantics)', () => {
    const top = recordingTextBlock(6, 4, []);
    const bottom = recordingTextBlock(10, 5, []);
    const vertical = new TextBlockVertical([top, bottom], HorizontalAlignment.CENTER);
    const dim = vertical.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(10);
    expect(dim.getHeight()).toBe(9);
  });

  it('LEFT alignment stacks both blocks flush to x=0', () => {
    const sink: Recorded[] = [];
    const vertical = new TextBlockVertical(
      [recordingTextBlock(6, 4, sink), recordingTextBlock(10, 5, sink)],
      HorizontalAlignment.LEFT,
    );
    vertical.drawU(newGraphic());
    expect(sink).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 4 },
    ]);
  });

  it('RIGHT alignment right-aligns each block against the merged width', () => {
    const sink: Recorded[] = [];
    const vertical = new TextBlockVertical(
      [recordingTextBlock(6, 4, sink), recordingTextBlock(10, 5, sink)],
      HorizontalAlignment.RIGHT,
    );
    vertical.drawU(newGraphic());
    expect(sink).toEqual([
      { dx: 4, dy: 0 },
      { dx: 0, dy: 4 },
    ]);
  });

  it('supports N-ary (3+) block stacks', () => {
    const sink: Recorded[] = [];
    const vertical = new TextBlockVertical(
      [recordingTextBlock(4, 2, sink), recordingTextBlock(6, 3, sink), recordingTextBlock(8, 4, sink)],
      HorizontalAlignment.LEFT,
    );
    const dim = vertical.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(8);
    expect(dim.getHeight()).toBe(9);
    vertical.drawU(newGraphic());
    expect(sink.map((r) => r.dy)).toEqual([0, 2, 5]);
  });
});

describe('TextBlockHorizontal', () => {
  it('throws when constructed with fewer than 2 blocks', () => {
    expect(() => new TextBlockHorizontal([recordingTextBlock(1, 1, [])], VerticalAlignment.TOP)).toThrow();
  });

  it('lays out blocks left-to-right and merges dimensions (mergeLR semantics)', () => {
    const left = recordingTextBlock(6, 4, []);
    const right = recordingTextBlock(10, 5, []);
    const horizontal = new TextBlockHorizontal([left, right], VerticalAlignment.TOP);
    const dim = horizontal.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(16);
    expect(dim.getHeight()).toBe(5);
  });

  it('TOP alignment keeps every block at dy=0', () => {
    const sink: Recorded[] = [];
    const horizontal = new TextBlockHorizontal(
      [recordingTextBlock(6, 4, sink), recordingTextBlock(10, 8, sink)],
      VerticalAlignment.TOP,
    );
    horizontal.drawU(newGraphic());
    expect(sink).toEqual([
      { dx: 0, dy: 0 },
      { dx: 6, dy: 0 },
    ]);
  });

  it('CENTER alignment vertically centers each block in the merged height', () => {
    const sink: Recorded[] = [];
    const horizontal = new TextBlockHorizontal(
      [recordingTextBlock(6, 4, sink), recordingTextBlock(10, 8, sink)],
      VerticalAlignment.CENTER,
    );
    horizontal.drawU(newGraphic());
    expect(sink).toEqual([
      { dx: 0, dy: 2 },
      { dx: 6, dy: 0 },
    ]);
  });

  it('BOTTOM alignment bottom-aligns each block in the merged height', () => {
    const sink: Recorded[] = [];
    const horizontal = new TextBlockHorizontal(
      [recordingTextBlock(6, 4, sink), recordingTextBlock(10, 8, sink)],
      VerticalAlignment.BOTTOM,
    );
    horizontal.drawU(newGraphic());
    expect(sink).toEqual([
      { dx: 0, dy: 4 },
      { dx: 6, dy: 0 },
    ]);
  });
});

describe('TextBlockMarged', () => {
  it('calculateDimension pads by the margins on each side', () => {
    const inner = recordingTextBlock(10, 5, []);
    const marged = new TextBlockMarged(inner, 1, 2, 3, 4);
    const dim = marged.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(10 + 2 + 4);
    expect(dim.getHeight()).toBe(5 + 1 + 3);
  });

  it('fromMargins() builds from a ClockwiseTopRightBottomLeft quad', () => {
    const inner = recordingTextBlock(10, 5, []);
    const margins = ClockwiseTopRightBottomLeft.topRightBottomLeft(1, 2, 3, 4);
    const marged = TextBlockMarged.fromMargins(inner, margins);
    const dim = marged.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(16);
    expect(dim.getHeight()).toBe(9);
  });

  it('drawU offsets the inner block by (left, top) and draws a padding UEmpty', () => {
    const sink: Recorded[] = [];
    const inner = recordingTextBlock(10, 5, sink);
    const marged = new TextBlockMarged(inner, 1, 2, 3, 4);
    marged.drawU(newGraphic());
    expect(sink).toEqual([{ dx: 4, dy: 1 }]);
  });

  it('drawU is a no-op when the padded dimension has zero width', () => {
    const inner: TextBlock = { calculateDimension: () => new XDimension2D(0, 0), drawU: () => undefined };
    const marged = new TextBlockMarged(inner, 0, 0, 0, 0);
    expect(() => marged.drawU(newGraphic())).not.toThrow();
  });
});

describe('TextBlockMinWidth', () => {
  it('calculateDimension widens to at least minWidth, height unchanged', () => {
    const inner = recordingTextBlock(5, 3, []);
    const wrapped = new TextBlockMinWidth(inner, 20, HorizontalAlignment.LEFT);
    const dim = wrapped.calculateDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(20);
    expect(dim.getHeight()).toBe(3);
  });

  it('LEFT alignment draws the inner block untranslated', () => {
    const sink: Recorded[] = [];
    const wrapped = new TextBlockMinWidth(recordingTextBlock(5, 3, sink), 20, HorizontalAlignment.LEFT);
    wrapped.drawU(newGraphic());
    expect(sink).toEqual([{ dx: 0, dy: 0 }]);
  });

  it('CENTER alignment centers the inner block in the extra width', () => {
    const sink: Recorded[] = [];
    const wrapped = new TextBlockMinWidth(recordingTextBlock(10, 3, sink), 20, HorizontalAlignment.CENTER);
    wrapped.drawU(newGraphic());
    expect(sink).toEqual([{ dx: 5, dy: 0 }]);
  });

  it('RIGHT alignment right-aligns the inner block against the extra width', () => {
    const sink: Recorded[] = [];
    const wrapped = new TextBlockMinWidth(recordingTextBlock(10, 3, sink), 20, HorizontalAlignment.RIGHT);
    wrapped.drawU(newGraphic());
    expect(sink).toEqual([{ dx: 10, dy: 0 }]);
  });
});

describe('UEmpty', () => {
  it('exposes width/height', () => {
    const e = new UEmpty(10, 20);
    expect(e.getWidth()).toBe(10);
    expect(e.getHeight()).toBe(20);
  });

  it('create() builds from an XDimension2D', () => {
    const e = UEmpty.create(new XDimension2D(3, 4));
    expect(e.getWidth()).toBe(3);
    expect(e.getHeight()).toBe(4);
  });

  it('throws on a zero width (matches upstream IllegalArgumentException)', () => {
    expect(() => new UEmpty(0, 10)).toThrow();
  });
});
