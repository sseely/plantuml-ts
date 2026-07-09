import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import { VerticalAlignment } from '../geom/VerticalAlignment.js';
import { TextBlockMemoized } from './TextBlockMemoized.js';

/**
 * TextBlockHorizontal — lays out 2+ `TextBlock`s left-to-right, each
 * vertically aligned within the merged height. `TextBlockUtils.mergeLR`
 * is the canonical factory for the 2-block case.
 *
 * Upstream: klimt/shape/TextBlockHorizontal.java. Ported: both
 * constructors (2-block + N-ary `List<TextBlock>`),
 * `calculateDimensionSlow`, `drawU`.
 */
export class TextBlockHorizontal extends TextBlockMemoized {
  private readonly blocks: readonly TextBlock[];
  private readonly alignment: VerticalAlignment;

  constructor(blocks: readonly TextBlock[], alignment: VerticalAlignment) {
    super();
    if (blocks.length < 2) throw new Error('TextBlockHorizontal: at least 2 blocks required');
    this.blocks = blocks;
    this.alignment = alignment;
  }

  protected calculateDimensionSlow(stringBounder: StringBounder): XDimension2D {
    let dim = this.blocks[0]!.calculateDimension(stringBounder);
    for (let i = 1; i < this.blocks.length; i++) {
      dim = dim.mergeLR(this.blocks[i]!.calculateDimension(stringBounder));
    }
    return dim;
  }

  private verticalOffset(totalHeight: number, blockHeight: number): number {
    if (this.alignment === VerticalAlignment.CENTER) return (totalHeight - blockHeight) / 2;
    if (this.alignment === VerticalAlignment.BOTTOM) return totalHeight - blockHeight;
    return 0;
  }

  drawU(ug: UGraphic): void {
    let x = 0;
    const dimtotal = this.calculateDimension(ug.getStringBounder());
    for (const block of this.blocks) {
      const dimb = block.calculateDimension(ug.getStringBounder());
      const dy = this.verticalOffset(dimtotal.getHeight(), dimb.getHeight());
      block.drawU(ug.apply(new UTranslate(x, dy)));
      x += dimb.getWidth();
    }
  }
}
