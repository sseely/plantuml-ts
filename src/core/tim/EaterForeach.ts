/**
 * `!foreach $var in <expr>`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterForeach.java
 */

import { Eater } from './Eater.js';
import type { JsonValue } from './expression/Token.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

/**
 * `JsonValue`'s array/object size. Local duplicate of `TMemory.ts`'s own
 * `jsonSize` -- see that file's `jsonSize` doc comment for why this tiny
 * predicate is intentionally duplicated rather than shared (established
 * project precedent; see `Eater.ts`'s file header).
 * @see ~/git/plantuml/.../tim/EaterForeach.java#size
 */
export function size(value: JsonValue): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === 'object') return Object.keys(value).length;

  throw new Error('IllegalArgumentException');
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterForeach.java
 */
export class EaterForeach extends Eater {
  private varname = '';
  private jsonValue: JsonValue | undefined;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!foreach');
    this.skipSpaces();
    this.varname = this.eatAndGetVarname();
    this.skipSpaces();
    this.checkAndEatChar('in');
    this.skipSpaces();
    const value = this.eatExpression(context, memory);
    this.jsonValue = value.toJson();
  }

  isSkip(): boolean {
    if (this.jsonValue === undefined) return true;

    return size(this.jsonValue) === 0;
  }

  getVarname(): string {
    return this.varname;
  }

  /** Non-null after `analyze` has run successfully; `analyze` always
   * assigns `jsonValue` before returning normally. */
  getJsonValue(): JsonValue {
    return this.jsonValue as JsonValue;
  }
}
