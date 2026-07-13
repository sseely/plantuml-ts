import type { TextBlock } from './TextBlock.js';
import type { UDrawable } from './UDrawable.js';
import type { StringBounder } from '../font/StringBounder.js';
import { XDimension2D } from '../geom/XDimension2D.js';
import type { MinMax } from '../geom/MinMax.js';
import { LimitFinder } from '../drawing/LimitFinder.js';
import type { XPoint2D } from '../geom/XPoint2D.js';
import type { HorizontalAlignment } from '../geom/HorizontalAlignment.js';
import type { VerticalAlignment } from '../geom/VerticalAlignment.js';
import type { ClockwiseTopRightBottomLeft } from '../geom/ClockwiseTopRightBottomLeft.js';
import type { Positionable } from '../geom/Positionable.js';
import { PositionableImpl } from '../geom/PositionableImpl.js';
import { TextBlockHorizontal } from './TextBlockHorizontal.js';
import { TextBlockVertical } from './TextBlockVertical.js';
import { TextBlockMarged } from './TextBlockMarged.js';
import { TextBlockMinWidth } from './TextBlockMinWidth.js';

function isTextBlock(value: TextBlock | XDimension2D): value is TextBlock {
  return typeof (value as Partial<TextBlock>).calculateDimension === 'function';
}

/**
 * TextBlockUtils — the shared static utility every `USymbol*#asSmall`/
 * `asBig` in upstream depends on: `mergeTB`/`mergeLR` (vertical/
 * horizontal `TextBlock` combinators), margin/min-width wrappers, and a
 * handful of predicates.
 *
 * Upstream: klimt/shape/TextBlockUtils.java. Ported in full where every
 * dependency is portable: `EMPTY_TEXT_BLOCK`, `withMargin` (all three
 * overloads — the 2-arg and 4-arg loose-number forms collapse to one
 * method with optional trailing params; the `ClockwiseTopRightBottomLeft`
 * quad overload is `withMarginQuad`, a distinct method name since TS
 * cannot overload on parameter type the way Java does), `withMinWidth`,
 * `empty`, `asPositionable` (both overloads, collapsed to one method
 * taking a union — mirrors `UGraphicStencil.create`'s identical
 * union-plus-type-guard pattern in this same task), `mergeLR`, `mergeTB`
 * (THE canonical target every one of the 7 duplicated per-file `mergeTB`
 * local helpers this task consolidates now points at), `isEmpty`.
 *
 * `getMinMax` (klimt/geom/limitfinder mission, T1 — write-set
 * expansion, journaled): now ported in full — `LimitFinder`/
 * `UGraphicNo`/`MinMax`/`MinMaxMutable` all exist in this port as of
 * this task. Three-line body matching upstream's own
 * `TextBlockUtils.java:138-142` exactly: build a `LimitFinder`, walk
 * `tb` through it, return the accumulated `MinMax`.
 *
 * Stubbed-to-throw (genuinely unported subsystem, per this task's
 * charter — "a method that drags in a genuinely unported subsystem may
 * throw with a clear message + doc note"):
 * - `bordered` — needs `TextBlockBordered` (not ported) + `HColor` (the
 *   whole color-model subsystem; this port uses `Paint`, a structurally
 *   different substitute with no `HColor#isTransparent()`/`bg()`
 *   equivalent at this seam). No caller in this task's write-set.
 * - `addBackcolor` — needs `HColor` (see `bordered` above); this port's
 *   `TextBlock` interface (T3) also carries no `getBackcolor()` member
 *   at all, so the wrapper this method builds could never be consumed
 *   by any TS caller even if `HColor` existed.
 */
export const TextBlockUtils = {
  EMPTY_TEXT_BLOCK: undefined as unknown as TextBlock,

  empty(width: number, height: number): TextBlock {
    return {
      drawU(): void {
        // Intentionally empty — matches upstream's `empty(w,h)` no-op `drawU`.
      },
      calculateDimension(_stringBounder: StringBounder): XDimension2D {
        return new XDimension2D(width, height);
      },
    };
  },

  asPositionable(dimOrBlock: TextBlock | XDimension2D, stringBounder: StringBounder, pt: XPoint2D): Positionable {
    const dim = isTextBlock(dimOrBlock) ? dimOrBlock.calculateDimension(stringBounder) : dimOrBlock;
    return PositionableImpl.create(pt, dim);
  },

  mergeLR(this: void, b1: TextBlock, b2: TextBlock, verticalAlignment: VerticalAlignment): TextBlock {
    if (b1 === TextBlockUtils.EMPTY_TEXT_BLOCK) return b2;
    if (b2 === TextBlockUtils.EMPTY_TEXT_BLOCK) return b1;
    return new TextBlockHorizontal([b1, b2], verticalAlignment);
  },

  mergeTB(this: void, b1: TextBlock, b2: TextBlock, horizontalAlignment: HorizontalAlignment): TextBlock {
    if (b1 === TextBlockUtils.EMPTY_TEXT_BLOCK) return b2;
    if (b2 === TextBlockUtils.EMPTY_TEXT_BLOCK) return b1;
    return new TextBlockVertical([b1, b2], horizontalAlignment);
  },

  withMargin(
    textBlock: TextBlock,
    marginX1: number,
    marginX2: number = marginX1,
    marginY1: number = marginX1,
    marginY2: number = marginX2,
  ): TextBlock {
    if (marginX1 === 0 && marginX2 === 0 && marginY1 === 0 && marginY2 === 0) return textBlock;
    return new TextBlockMarged(textBlock, marginY1, marginX2, marginY2, marginX1);
  },

  withMarginQuad(textBlock: TextBlock, margins: ClockwiseTopRightBottomLeft): TextBlock {
    return TextBlockMarged.fromMargins(textBlock, margins);
  },

  withMinWidth(textBlock: TextBlock, minWidth: number, horizontalAlignment: HorizontalAlignment): TextBlock {
    return new TextBlockMinWidth(textBlock, minWidth, horizontalAlignment);
  },

  isEmpty(text: TextBlock | null, dummyStringBounder: StringBounder): boolean {
    if (text === null || text === TextBlockUtils.EMPTY_TEXT_BLOCK) return true;
    const dim = text.calculateDimension(dummyStringBounder);
    return dim.getHeight() === 0 && dim.getWidth() === 0;
  },

  getMinMax(tb: UDrawable, stringBounder: StringBounder, initToZero: boolean): MinMax {
    const limitFinder = LimitFinder.create(stringBounder, initToZero);
    tb.drawU(limitFinder);
    return limitFinder.getMinMax();
  },

  bordered(): never {
    throw new Error('TextBlockUtils.bordered: not ported — requires TextBlockBordered + HColor, neither ported');
  },

  addBackcolor(): never {
    throw new Error(
      "TextBlockUtils.addBackcolor: not ported — requires HColor; this port's TextBlock also carries no getBackcolor()",
    );
  },
};

TextBlockUtils.EMPTY_TEXT_BLOCK = TextBlockUtils.empty(0, 0);
