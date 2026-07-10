import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { EntityDomain } from '../../svek/EntityDomain.js';

/**
 * USymbolEntityDomain — the UML robustness-diagram "entity" descriptive/
 * deployment element.
 *
 * Upstream: decoration/symbol/USymbolEntityDomain.java. Ported in full:
 * `getSNames`, `getDrawing` (constructs an `EntityDomain` with
 * `deltaShadow` conditionally raised to 4.0 when the ambient
 * `SymbolContext` is shadowing). Upstream's `// ::remove folder when
 * __HAXE__` comment is a Haxe-transpile-target directive with no TS
 * analog — dropped (not behavior, a build-tool directive for a target
 * this port does not have).
 */
export class USymbolEntityDomain extends USymbolSimpleAbstract {
  getSNames(): readonly SName[] {
    return ['entity'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    return new EntityDomain(symbolContext.withDeltaShadow(symbolContext.isShadowing() ? 4.0 : 0.0));
  }
}
