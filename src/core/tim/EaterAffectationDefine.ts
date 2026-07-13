/**
 * `!define $var <rest of line>` -- a simple-form global assignment whose
 * value is the rest of the line after functions/variables are applied
 * (distinct from `EaterLegacyDefine`'s multi-arg `!define name(args) body`
 * form).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAffectationDefine.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import { TValue } from './expression/TValue.js';
import { TVariableScope } from './TVariableScope.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAffectationDefine.java
 */
export class EaterAffectationDefine extends Eater {
  constructor(s: StringLocated) {
    super(s.getTrimmed());
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!define');
    this.skipSpaces();
    const varname = this.eatAndGetVarname();
    this.skipSpaces();
    const tmp = this.eatAllToEnd();
    const tmp2 = context.applyFunctionsAndVariables(memory, new StringLocated(tmp, this.getLineLocation()));
    const value = TValue.fromString(tmp2);
    memory.putVariable(varname, value, TVariableScope.GLOBAL, this.getStringLocated());
  }
}
