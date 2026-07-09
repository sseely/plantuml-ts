import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import { UTranslate } from '../UTranslate.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';
import type { ClockwiseTopRightBottomLeft } from '../geom/ClockwiseTopRightBottomLeft.js';
import { UEmpty } from './UEmpty.js';

/**
 * TextBlockMarged — wraps a `TextBlock` with a fixed (top, right,
 * bottom, left) margin, padding its measured dimension and offsetting
 * its draw position. `TextBlockUtils.withMargin` is the public factory.
 *
 * Upstream: klimt/shape/TextBlockMarged.java. Ported: both constructors
 * (4 loose numbers + the `ClockwiseTopRightBottomLeft` quad overload),
 * `calculateDimension`, `drawU`.
 *
 * NOT ported (reported, same "no caller in scope" reasoning as
 * `TextBlockVertical.ts`): `getInnerPosition` — not part of this port's
 * `TextBlock` interface; `getPorts`/`WithPorts` — a separate, unported
 * `svek` port-routing subsystem.
 */
export class TextBlockMarged implements TextBlock {
  private readonly textBlock: TextBlock;
  private readonly top: number;
  private readonly right: number;
  private readonly bottom: number;
  private readonly left: number;

  constructor(textBlock: TextBlock, top: number, right: number, bottom: number, left: number) {
    this.textBlock = textBlock;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }

  static fromMargins(textBlock: TextBlock, margins: ClockwiseTopRightBottomLeft): TextBlockMarged {
    return new TextBlockMarged(textBlock, margins.getTop(), margins.getRight(), margins.getBottom(), margins.getLeft());
  }

  calculateDimension(stringBounder: StringBounder): XDimension2D {
    const dim = this.textBlock.calculateDimension(stringBounder);
    return dim.delta(this.left + this.right, this.top + this.bottom);
  }

  drawU(ug: UGraphic): void {
    const dim = this.calculateDimension(ug.getStringBounder());
    if (dim.getWidth() > 0) {
      ug.draw(UEmpty.create(dim));
      const translate = new UTranslate(this.left, this.top);
      this.textBlock.drawU(ug.apply(translate));
    }
  }
}
