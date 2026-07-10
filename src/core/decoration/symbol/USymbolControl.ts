import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { Control } from '../../svek/Control.js';

/**
 * USymbolControl — the UML robustness-diagram "control" descriptive/
 * deployment element.
 *
 * Upstream: decoration/symbol/USymbolControl.java. Ported in full:
 * `getSNames`, `getDrawing` (constructs a `Control` with `deltaShadow`
 * conditionally raised to 4.0 when the ambient `SymbolContext` is
 * shadowing).
 */
export class USymbolControl extends USymbolSimpleAbstract {
  getSNames(): readonly SName[] {
    return ['control'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    return new Control(symbolContext.withDeltaShadow(symbolContext.isShadowing() ? 4.0 : 0.0));
  }
}
