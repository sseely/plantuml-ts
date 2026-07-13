/**
 * Legacy `!define name(args) <body>` (single line, unquoted, macro-style
 * substitution) -- distinct from `EaterAffectationDefine`'s `!define $var
 * <rest of line>` simple form.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLegacyDefine.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext, TFunction } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import { TFunctionType } from './TFunctionType.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterLegacyDefine.java
 */
export class EaterLegacyDefine extends Eater {
  private function: TFunction | undefined;

  constructor(s: StringLocated) {
    super(s.getTrimmed());
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!define');
    this.skipSpaces();
    const func = this.eatDeclareFunction(context, memory, true, this.getStringLocated(), false, TFunctionType.LEGACY_DEFINE);
    const def = this.eatAllToEnd();
    func.setLegacyDefinition(def);
    this.function = func;
  }

  /** Non-null after `analyze` has run successfully. */
  getFunction(): TFunction {
    return this.function as TFunction;
  }
}
