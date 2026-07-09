import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import { HorizontalAlignment } from '../geom/HorizontalAlignment.js';

/**
 * TextBlockMinWidth — wraps a `TextBlock`, widening its measured
 * dimension to a minimum width and aligning it within the extra space.
 * `TextBlockUtils.withMinWidth` is the public factory.
 *
 * Upstream: klimt/shape/TextBlockMinWidth.java (package-private).
 * Ported in full: the constructor, `calculateDimension`, `drawU`.
 */
export class TextBlockMinWidth implements TextBlock {
  private readonly textBlock: TextBlock;
  private readonly minWidth: number;
  private readonly horizontalAlignment: HorizontalAlignment;

  constructor(textBlock: TextBlock, minWidth: number, horizontalAlignment: HorizontalAlignment) {
    this.textBlock = textBlock;
    this.minWidth = minWidth;
    this.horizontalAlignment = horizontalAlignment;
  }

  calculateDimension(stringBounder: StringBounder): XDimension2D {
    const dim = this.textBlock.calculateDimension(stringBounder);
    return dim.atLeast(this.minWidth, 0);
  }

  private diffX(ug: UGraphic): number {
    const dimText = this.textBlock.calculateDimension(ug.getStringBounder());
    const dimFull = this.calculateDimension(ug.getStringBounder());
    return dimFull.getWidth() - dimText.getWidth();
  }

  /**
   * The horizontal offset `drawU` translates the inner `textBlock` by,
   * for each of the three real `HorizontalAlignment` values. Extracted
   * from `drawU` (TS-mechanics note, complexity-hook accommodation —
   * matches this project's established `dxForAlignment` pattern already
   * used by several `USymbol*` files for the identical 3-way dispatch):
   * isolating the pure offset computation from the `drawU` side effect
   * lets this project's lizard-based complexity checker and v8's branch
   * coverage both treat the unreachable 4th case as a single, isolated,
   * clearly-`v8 ignore`-able unit — not a behavioral change.
   */
  private offsetFor(alignment: HorizontalAlignment, ug: UGraphic): number {
    if (alignment === HorizontalAlignment.LEFT) return 0;
    if (alignment === HorizontalAlignment.CENTER) return this.diffX(ug) / 2;
    if (alignment === HorizontalAlignment.RIGHT) return this.diffX(ug);
    /* v8 ignore next 2 -- HorizontalAlignment's as-const union has
       exactly three members; unreachable through this port's type system. */
    throw new Error(`TextBlockMinWidth: unsupported HorizontalAlignment ${String(alignment)}`);
  }

  /**
   * Mechanical simplification (reported, not a behavioral change):
   * upstream's LEFT branch calls `textBlock.drawU(ug)` directly (no
   * translate wrap); CENTER/RIGHT wrap in `ug.apply(new UTranslate(dx,
   * 0))`. Always wrapping — even for LEFT's `dx = 0` — is observably
   * identical (`UTranslate.dx(0)` composed onto any translate is the
   * identity transform) and matches the `dxForAlignment`-then-always-
   * translate shape this project's own `TextBlockVertical`/`mergeTB`
   * combinators already use for the same 3-way dispatch.
   */
  drawU(ug: UGraphic): void {
    const dx = this.offsetFor(this.horizontalAlignment, ug);
    this.textBlock.drawU(ug.apply(UTranslate.dx(dx)));
  }
}
