import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import { HorizontalAlignment } from '../geom/HorizontalAlignment.js';
import { TextBlockMemoized } from './TextBlockMemoized.js';

/**
 * TextBlockVertical — stacks 2+ `TextBlock`s top-to-bottom, each
 * horizontally aligned within the merged width. `TextBlockUtils.mergeTB`
 * is the canonical factory for the 2-block case every `USymbol*#asSmall`/
 * `asBig` uses to stack a stereotype above a label.
 *
 * Upstream: klimt/shape/TextBlockVertical.java. Ported: both
 * constructors (2-block + N-ary `List<TextBlock>`),
 * `calculateDimensionSlow`, `drawU`.
 *
 * NOT ported (reported, consolidation of the per-file scope reductions
 * every one of the 7 duplicated local `mergeTB` copies already
 * documented before this task): `getBackcolor`-driven background-color
 * band in `drawU` — this port's `TextBlock` (T3) carries no
 * `getBackcolor()` member at all, so no caller anywhere in this port can
 * ever pass a colored block here; `getPorts`/`WithPorts` — a separate,
 * unported `svek` port-routing subsystem; `getInnerPosition` — not part
 * of this port's `TextBlock` interface either (same "no caller in
 * scope" reasoning `TextBlock.ts`'s own doc comment states for these
 * three members).
 */
export class TextBlockVertical extends TextBlockMemoized {
  private readonly blocks: readonly TextBlock[];
  private readonly horizontalAlignment: HorizontalAlignment;

  constructor(blocks: readonly TextBlock[], horizontalAlignment: HorizontalAlignment) {
    super();
    if (blocks.length < 2) throw new Error('TextBlockVertical: at least 2 blocks required');
    this.blocks = blocks;
    this.horizontalAlignment = horizontalAlignment;
  }

  protected calculateDimensionSlow(stringBounder: StringBounder): XDimension2D {
    let dim = this.blocks[0]!.calculateDimension(stringBounder);
    for (let i = 1; i < this.blocks.length; i++) {
      dim = dim.mergeTB(this.blocks[i]!.calculateDimension(stringBounder));
    }
    return dim;
  }

  private horizontalOffset(totalWidth: number, blockWidth: number): number {
    if (this.horizontalAlignment === HorizontalAlignment.LEFT) return 0;
    if (this.horizontalAlignment === HorizontalAlignment.CENTER) return (totalWidth - blockWidth) / 2;
    if (this.horizontalAlignment === HorizontalAlignment.RIGHT) return totalWidth - blockWidth;
    /* v8 ignore next 2 -- HorizontalAlignment's as-const union has exactly
       three members; this branch mirrors upstream's `else throw` for a
       fourth case that cannot occur through this port's type system. */
    throw new Error(`TextBlockVertical: unsupported HorizontalAlignment ${String(this.horizontalAlignment)}`);
  }

  drawU(ug: UGraphic): void {
    let y = 0;
    const dimtotal = this.calculateDimension(ug.getStringBounder());
    for (const block of this.blocks) {
      const dimb = block.calculateDimension(ug.getStringBounder());
      const dx = this.horizontalOffset(dimtotal.getWidth(), dimb.getWidth());
      block.drawU(ug.apply(new UTranslate(dx, y)));
      y += dimb.getHeight();
    }
  }
}
