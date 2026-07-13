/**
 * Legacy `!definelong name(args)` / `!enddefinelong` (multi-line macro-style
 * substitution). Multi-line body collection is `CodeIteratorProcedure`'s
 * job (it treats `LEGACY_DEFINELONG` the same as `PROCEDURE` for body
 * buffering); `TFunctionImpl#finalizeEnddefinelong` collapses a
 * single-line body down to a plain `LEGACY_DEFINE` on `!enddefinelong`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLegacyDefineLong.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TFunctionImpl } from './TFunctionImpl.js';
import type { TMemory } from './TMemory.js';
import { TFunctionType } from './TFunctionType.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLegacyDefineLong.java
 */
export class EaterLegacyDefineLong extends Eater {
  private function: TFunctionImpl | undefined;

  constructor(s: StringLocated) {
    super(s.getTrimmed());
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!definelong');
    this.skipSpaces();
    this.function = this.eatDeclareFunction(
      context,
      memory,
      true,
      this.getStringLocated(),
      true,
      TFunctionType.LEGACY_DEFINELONG,
    );
  }

  /** Non-null after `analyze` has run successfully. */
  getFunction(): TFunctionImpl {
    return this.function as TFunctionImpl;
  }
}
