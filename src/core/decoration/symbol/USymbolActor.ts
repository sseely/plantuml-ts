import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { actorStyleGetTextBlock } from '../../skin/ActorStyle.js';
import type { ActorStyle } from '../../skin/ActorStyle.js';

/**
 * USymbolActor — the `actor` descriptive/deployment element: a
 * style-selectable stick figure (`STICKMAN` by default; `HOLLOW`/
 * `AWESOME` deferred, see `ActorStyle.ts`).
 *
 * Upstream: decoration/symbol/USymbolActor.java (~26 ln). Ported in
 * full: the constructor (takes an `ActorStyle`), `getSNames`,
 * `getDrawing` (delegates to `actorStyle.getTextBlock(symbolContext)`).
 *
 * Commented-out shadow/stroke override (preserved, not activated):
 * upstream's `getDrawing` has two commented-out lines building a
 * `deltaShadow`/2px-stroke `SymbolContext` variant that is never
 * actually used (the method returns `actorStyle.getTextBlock
 * (symbolContext)` with the ORIGINAL `symbolContext`, unmodified) — kept
 * as a comment here too, matching upstream's own dead-code-as-comment
 * state exactly (not activated, not deleted).
 */
export class USymbolActor extends USymbolSimpleAbstract {
  private readonly actorStyle: ActorStyle;

  constructor(actorStyle: ActorStyle) {
    super();
    this.actorStyle = actorStyle;
  }

  getSNames(): readonly SName[] {
    return ['actor'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    // final double deltaShadow = symbolContext.isShadowing() ? 4.0 : 0.0;
    // final SymbolContext tmp =
    // symbolContext.withDeltaShadow(deltaShadow).withStroke(UStroke.withThickness(2));
    return actorStyleGetTextBlock(this.actorStyle, symbolContext);
  }
}
