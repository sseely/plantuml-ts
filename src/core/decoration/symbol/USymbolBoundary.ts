import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { Boundary } from '../../svek/Boundary.js';

/**
 * USymbolBoundary — the UML robustness-diagram "boundary" descriptive/
 * deployment element.
 *
 * Upstream: decoration/symbol/USymbolBoundary.java. Ported in full:
 * `getSNames`, `getDrawing` (constructs a `Boundary` with `deltaShadow`
 * conditionally raised to 4.0 when the ambient `SymbolContext` is
 * shadowing — matches upstream's `symbolContext.withDeltaShadow
 * (symbolContext.isShadowing() ? 4.0 : 0.0)` exactly).
 */
export class USymbolBoundary extends USymbolSimpleAbstract {
  getSNames(): readonly SName[] {
    return ['boundary'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    return new Boundary(symbolContext.withDeltaShadow(symbolContext.isShadowing() ? 4.0 : 0.0));
  }
}
