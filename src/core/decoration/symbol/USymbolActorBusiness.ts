import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { ActorStyle, actorStyleGetTextBlock } from '../../skin/ActorStyle.js';

/**
 * USymbolActorBusiness — the `actor/` descriptive/deployment element: an
 * `ActorStickMan` with the diagonal "business" slash across the head.
 *
 * Upstream: decoration/symbol/USymbolActorBusiness.java (~18 ln). Ported
 * in full: the hardcoded `ActorStyle.STICKMAN_BUSINESS` field,
 * `getSNames`, `getDrawing`.
 *
 * "Actor vs ActorBusiness: the slash is the only delta" (T9 acceptance
 * criterion 2): this class differs from `USymbolActor` only in (a) which
 * `ActorStyle` it hardcodes and (b) its `SName` (`business` vs `actor`)
 * — both delegate to the SAME `ActorStickMan` class, whose own
 * `actorBusiness` boolean flag is the sole geometric difference (see
 * `ActorStickMan.ts`).
 */
export class USymbolActorBusiness extends USymbolSimpleAbstract {
  private readonly actorStyle = ActorStyle.STICKMAN_BUSINESS;

  getSNames(): readonly SName[] {
    return ['business'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    return actorStyleGetTextBlock(this.actorStyle, symbolContext);
  }
}
