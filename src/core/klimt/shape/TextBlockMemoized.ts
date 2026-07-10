import type { TextBlock } from './TextBlock.js';
import type { UGraphic } from '../UGraphic.js';
import type { StringBounder } from '../font/StringBounder.js';
import type { XDimension2D } from '../geom/XDimension2D.js';

/**
 * TextBlockMemoized — abstract base for `TextBlock`s whose
 * `calculateDimension` is expensive: the result is memoized and
 * invalidated only when the `StringBounder` implementation changes.
 *
 * Upstream: klimt/shape/TextBlockMemoized.java. Ported: `calculateDimension`
 * (final, cached), the abstract `calculateDimensionSlow`,
 * `invalidateDimensionCache`.
 *
 * Adaptation: upstream keys the cache invalidation off
 * `stringBounder.getClass()` (a `Class<? extends StringBounder>`). TS
 * interfaces have no runtime `Class` object; `stringBounder.constructor`
 * (the JS runtime function the value was built from) is the structural
 * equivalent — any two `StringBounder` VALUES built from the same
 * concrete implementation share one `constructor`, exactly matching
 * upstream's "same concrete class" invalidation trigger.
 */
export abstract class TextBlockMemoized implements TextBlock {
  private cachedDimension: XDimension2D | undefined;
  private lastCaller: unknown;

  calculateDimension(stringBounder: StringBounder): XDimension2D {
    const currentCaller: unknown = (stringBounder as { constructor: unknown }).constructor;
    if (this.cachedDimension === undefined || this.lastCaller !== currentCaller) {
      this.cachedDimension = this.calculateDimensionSlow(stringBounder);
      this.lastCaller = currentCaller;
    }
    return this.cachedDimension;
  }

  protected abstract calculateDimensionSlow(stringBounder: StringBounder): XDimension2D;

  protected invalidateDimensionCache(): void {
    this.cachedDimension = undefined;
    this.lastCaller = undefined;
  }

  abstract drawU(ug: UGraphic): void;
}
