/**
 * `!$var = <expr>` (and `!local`/`!global $var = <expr>`, `!$var ?= <expr>`
 * conditional assignment).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAffectation.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import { lazzyParse } from './TVariableScope.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterAffectation.java
 */
export class EaterAffectation extends Eater {
  constructor(sl: StringLocated) {
    super(sl.getTrimmed());
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!');
    this.skipSpaces();
    let varname = this.eatAndGetVarname();
    let scope = lazzyParse(varname);
    if (scope !== undefined) {
      this.skipSpaces();
      if (this.peekChar() === '?' || this.peekChar() === '=') {
        // The variable itself is "local" or "global", which is not a good
        // idea by the way
        scope = undefined;
      } else {
        varname = this.eatAndGetVarname();
      }
    }
    this.skipSpaces();
    let conditional = false;
    if (this.peekChar() === '?') {
      this.checkAndEatChar('?');
      conditional = true;
    }
    this.checkAndEatChar('=');
    if (conditional && memory.getVariable(varname) !== undefined) return;

    this.skipSpaces();
    const value = this.eatExpression(context, memory);
    memory.putVariable(varname, value, scope, this.getStringLocated());
  }
}
