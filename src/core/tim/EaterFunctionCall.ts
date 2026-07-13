/**
 * A call site -- `name(arg1, arg2, ...)` -- found inline in a source line by
 * `TContext#applyFunctionsAndVariables`. Eats the argument list, evaluating
 * each argument according to the callee's flavor:
 *
 *   - legacy `!define` macro: each arg is raw text, macro-expanded only;
 *   - `!unquoted` procedure/function: same, but `name=value` named args allowed;
 *   - everything else: each arg is a full TIM EXPRESSION (`TokenStack`).
 *
 * Batch SI5a-4 REPLACEMENT (debt payment): this file previously held
 * `findCallStart` / `parseCallArgs`, a pair of string-scanning helpers written
 * for the pre-TIM flat-line-loop `preprocessor.ts` (which had no expression
 * evaluator, so it could only capture raw argument text). They are replaced by
 * the real upstream class. Call-site LOCATION is not this class's job upstream
 * either -- `TContext#getFunctionNameAt` finds it via the `FunctionsSet` trie.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterFunctionCall.java
 */

import { Eater } from './Eater.js';
import { EaterException } from './EaterException.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import { TValue } from './expression/TValue.js';
import { TokenStack } from './expression/TokenStack.js';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterFunctionCall.java
 */
export class EaterFunctionCall extends Eater {
  private readonly values: TValue[] = [];
  private readonly namedArguments = new Map<string, TValue>();
  private readonly isLegacyDefine: boolean;
  private readonly unquoted: boolean;

  constructor(s: StringLocated, isLegacyDefine: boolean, unquoted: boolean) {
    super(s);
    this.isLegacyDefine = isLegacyDefine;
    this.unquoted = unquoted;
  }

  /** @throws EaterException (thrown, not returned) on a malformed call. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipUntilChar('(');
    this.checkAndEatChar('(');
    this.skipSpaces();
    if (this.peekChar() === ')') {
      this.checkAndEatChar(')');
      return;
    }
    while (true) {
      this.skipSpaces();
      this.eatOneArgument(context, memory);
      this.skipSpaces();
      const ch = this.eatOneChar();
      if (ch === ',') continue;

      if (ch === ')') break;

      if (this.unquoted)
        throw new EaterException('unquoted function/procedure cannot use expression.', this.getStringLocated());

      throw new EaterException('call001', this.getStringLocated());
    }
  }

  /** @throws EaterException (thrown, not returned) on a malformed argument. */
  private eatOneArgument(context: TContext, memory: TMemory): void {
    if (this.isLegacyDefine) {
      this.values.push(this.eatMacroArgument(context, memory));
      return;
    }
    if (this.unquoted) {
      if (this.matchAffectation()) {
        const varname = this.eatNamedArgumentName();
        this.namedArguments.set(varname, this.eatMacroArgument(context, memory));
      } else {
        this.values.push(this.eatMacroArgument(context, memory));
      }
      return;
    }
    if (this.matchAffectation()) {
      const varname = this.eatNamedArgumentName();
      this.namedArguments.set(varname, this.eatExpressionArgument(context, memory));
    } else {
      this.values.push(this.eatExpressionArgument(context, memory));
    }
  }

  /** The `varname` of a `varname=value` named argument, cursor left on `value`. */
  private eatNamedArgumentName(): string {
    const varname = this.eatAndGetVarname();
    this.skipSpaces();
    this.checkAndEatChar('=');
    this.skipSpaces();
    return varname;
  }

  /** Legacy-define / unquoted flavor: raw text, macro-and-variable-expanded. */
  private eatMacroArgument(context: TContext, memory: TMemory): TValue {
    const read = this.eatAndGetOptionalQuotedString();
    const value = context.applyFunctionsAndVariables(memory, new StringLocated(read, this.getLineLocation()));
    return TValue.fromString(value ?? '');
  }

  /** Normal flavor: a full TIM expression. */
  private eatExpressionArgument(context: TContext, memory: TMemory): TValue {
    const tokens = TokenStack.eatUntilCloseParenthesisOrComma(this).withoutSpace();
    tokens.guessFunctions(this.getStringLocated());
    return tokens.getResult(this.getStringLocated(), context, memory);
  }

  getValues(): readonly TValue[] {
    return this.values;
  }

  getNamedArguments(): ReadonlyMap<string, TValue> {
    return this.namedArguments;
  }

  /** @throws EaterException (thrown, not returned) on unterminated input. */
  getEndOfLine(): string {
    return this.eatAllToEnd();
  }
}
