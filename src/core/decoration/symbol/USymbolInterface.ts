import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import { USymbolSimpleAbstract } from './USymbolSimpleAbstract.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { CircleInterface2 } from '../../svek/CircleInterface2.js';

/**
 * USymbolInterface — the `interface`/`circle`/`()` descriptive/
 * deployment element: a small lollipop circle (`CircleInterface2`).
 *
 * Upstream: decoration/symbol/USymbolInterface.java. Ported in full:
 * `getSNames`, `getDrawing`.
 *
 * `circle`/`()` keyword mapping (T9 acceptance criterion, verified
 * against `USymbols.java:98-120,176-179`): `circle` and `()` are
 * alternate spellings resolved to this SAME class via `USymbols
 * .fromString` — there is no separate `USymbolCircle` class upstream or
 * here; both spellings and the literal `interface` keyword all dispatch
 * to `USymbols.INTERFACE`, i.e. this class. That registry dispatch
 * lives in the (unported) `USymbols.ts` — out of this task's write-set,
 * noted here only as the verified mapping fact.
 *
 * `SName` string (seam note, per `USymbol.ts`'s own `SName` doc
 * comment): upstream's enum member is `SName.interface_` (trailing
 * underscore — `interface` is a Java reserved word), but this port's
 * `SName` is a plain lowercase string matching the style-selector
 * convention every other `USymbol*` class in this codebase already
 * uses (`'boundary'`, `'control'`, `'entity'`, …) — represented here as
 * `'interface'`, not `'interface_'` (the underscore is a Java-keyword
 * escape artifact, not part of the semantic selector name).
 *
 * `hideText` (EntityImageDescription.java, out of this task's write-set
 * — reported): production calls this class's `asSmall` with ALL-EMPTY
 * `name`/`label`/`stereotype` `TextBlock`s (`hideText = symbol ==
 * USymbols.INTERFACE`) and draws the entity's real label SEPARATELY,
 * below the icon — so a faithful standalone `asSmall` render of this
 * class draws ONLY the `CircleInterface2` icon, never any label text.
 * The T9 conformance test for this class calls `asSmall` with empty
 * blocks accordingly (matching production's actual call shape), per
 * this suite's "take the value the caller passes in" convention.
 */
export class USymbolInterface extends USymbolSimpleAbstract {
  getSNames(): readonly SName[] {
    return ['interface'];
  }

  protected getDrawing(symbolContext: SymbolContext): TextBlock {
    return new CircleInterface2(symbolContext.getBackColor(), symbolContext.getForeColor(), symbolContext.isShadowing() ? 4.0 : 0.0);
  }
}
