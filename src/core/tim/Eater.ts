/**
 * Character-cursor base class for every TIM directive parser
 * (`!procedure`, `!function`, `!if`, `!foreach`, ...). Every `Eater*`
 * subclass (a later batch) extends this; its public API is therefore
 * load-bearing beyond this batch.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/Eater.java
 */

import { StringLocated, type LineLocation } from './StringLocated.js';
import type { TMemory } from './TMemory.js';
import type { TContext } from './TFunction.js';
import { EaterException } from './EaterException.js';
import { TValue } from './expression/TValue.js';
import type { JsonValue, Token } from './expression/Token.js';
import { TokenType, eatOneToken } from './expression/TokenType.js';
import { TokenStack } from './expression/TokenStack.js';
import { TFunctionImpl } from './TFunctionImpl.js';
import { TFunctionArgument } from './TFunctionArgument.js';
import { TFunctionType } from './TFunctionType.js';

/**
 * Local, minimal duplicates of the `TLineType` character predicates this
 * file needs. `TLineType`'s home package (`text/`) is out of this batch's
 * scope (see `StringLocated.ts`'s file header); `tim/expression/TokenType.ts`
 * (Batch 1, not in this batch's write-set) independently duplicates the
 * predicates *it* needs the same way, so this follows established project
 * precedent rather than introducing a new shared module for a handful of
 * one-line pure functions.
 * @see ~/git/plantuml/.../text/TLineType.java
 */
function isQuoteChar(ch: string): boolean {
  return ch === '"' || ch === "'";
}
function isLatinDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
/** `TLineType#isSpaceChar` -- Unicode SPACE_SEPARATOR/LINE_SEPARATOR/
 * PARAGRAPH_SEPARATOR only; narrower than `Character.isWhitespace` (does
 * NOT match `\t\n\r`). */
function isSpaceCharTLineType(ch: string): boolean {
  return ch !== '' && /^[\p{Zs}\p{Zl}\p{Zp}]$/u.test(ch);
}
function isEmojiChar(ch: string): boolean {
  if (ch === '') return false;
  const code = ch.charCodeAt(0);
  return code >= 0xd800 && code <= 0xdfff;
}
function isLetterOrUnderscoreChar(ch: string): boolean {
  return ch !== '' && (/\p{L}/u.test(ch) || ch === '_');
}
function isLetterOrEmojiOrUnderscoreOrDollarChar(ch: string): boolean {
  return isLetterOrUnderscoreChar(ch) || ch === '$' || isEmojiChar(ch);
}
function isLetterOrEmojiOrUnderscoreOrDigitChar(ch: string): boolean {
  return isLetterOrUnderscoreChar(ch) || isLatinDigitChar(ch) || isEmojiChar(ch);
}

/** `Eater#matchAffectation`'s own private pattern (not from `TLineType`). */
const AFFECTATION_PATTERN = /^\$?[_\p{L}][_\p{L}0-9]*\s*=/u;

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/Eater.java
 */
export abstract class Eater {
  private i = 0;
  private readonly stringLocated: StringLocated;

  constructor(stringLocated: StringLocated) {
    this.stringLocated = stringLocated;
  }

  getLineLocation(): LineLocation | undefined {
    return this.stringLocated.getLocation();
  }

  getStringLocated(): StringLocated {
    return this.stringLocated;
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  abstract analyze(context: TContext, memory: TMemory): void;

  getCurrentPosition(): number {
    return this.i;
  }

  protected eatAllToEnd(): string {
    const result = this.stringLocated.getString().slice(this.i);
    this.i = this.stringLocated.length();
    return result;
  }

  /**
   * Upstream calls `net.sourceforge.plantuml.json.Json.parse` for the
   * `{`/`[` (raw JSON literal) branch -- that package (a full boxed JSON
   * AST library) is out of scope for this port; native `JSON.parse`
   * implements the same standard JSON grammar `minimal-json` does, so it
   * is a faithful mechanical substitute here (not a special case worth
   * preserving byte-for-byte).
   * @throws EaterException (thrown, not returned) on a missing expression.
   */
  eatExpression(context: TContext, memory: TMemory): TValue {
    const ch = this.peekChar();
    if (ch === '{' || ch === '[') {
      const data = this.eatAllToEnd();
      const json = JSON.parse(data) as JsonValue;
      return TValue.fromJson(json);
    }
    const tokenStack = this.eatTokenStack();
    return tokenStack.getResult(this.getStringLocated(), context, memory);
  }

  /** @throws EaterException (thrown, not returned) if no token is found. */
  protected eatTokenStack(): TokenStack {
    const tokenStack = new TokenStack();
    this.addIntoTokenStack(tokenStack, false);
    if (tokenStack.size() === 0) throw new EaterException('Missing expression', this.stringLocated);

    return tokenStack;
  }

  /** @throws EaterException (thrown, not returned) on a malformed expression. */
  protected eatExpressionStopAtColon(context: TContext, memory: TMemory): TValue {
    const tokenStack = new TokenStack();
    this.addIntoTokenStack(tokenStack, true);
    return tokenStack.getResult(this.getStringLocated(), context, memory);
  }

  protected addIntoTokenStack(tokenStack: TokenStack, stopAtColon: boolean): void {
    let lastToken: Token | null = null;
    while (true) {
      const token = eatOneToken(lastToken, this, stopAtColon);
      if (token === null) return;

      tokenStack.add(token);
      if (token.getTokenType() !== TokenType.SPACES) lastToken = token;
    }
  }

  /** @throws EaterException (thrown, not returned) if not positioned at a quote. */
  eatAndGetQuotedString(): string {
    const separator = this.peekChar();
    if (!isQuoteChar(separator)) throw new EaterException('quote10', this.stringLocated);

    this.checkAndEatChar(separator);
    const value = this.addUpTo(separator, '');
    this.checkAndEatChar(separator);
    return value;
  }

  /** @throws EaterException (thrown, not returned) on unterminated input. */
  protected eatAndGetOptionalQuotedString(): string {
    const quote = this.peekChar();
    if (isQuoteChar(quote)) return this.eatAndGetQuotedString();

    let value = '';
    let level = 0;
    while (true) {
      let ch = this.peekChar();
      if (ch === '') throw new EaterException('until001', this.stringLocated);

      if (level === 0 && (ch === ',' || ch === ')')) return value.trim();

      ch = this.eatOneChar();
      if (ch === '(') level++;
      else if (ch === ')') level--;

      value += ch;
    }
  }

  eatAndGetNumber(): string {
    let result = '';
    while (true) {
      const ch = this.peekChar();
      if (result.length === 0 && ch === '-') {
        result += this.eatOneChar();
        continue;
      }

      if (ch === '' || !isLatinDigitChar(ch)) return result;

      result += this.eatOneChar();
    }
  }

  eatAndGetSpaces(): string {
    let result = '';
    while (true) {
      const ch = this.peekChar();
      if (ch === '' || !isSpaceCharTLineType(ch)) return result;

      result += this.eatOneChar();
    }
  }

  /** @throws EaterException (thrown, not returned) if not positioned at a valid varname start. */
  protected eatAndGetVarname(): string {
    let varname = this.eatOneChar();
    if (!isLetterOrEmojiOrUnderscoreOrDollarChar(varname)) throw new EaterException('a002', this.stringLocated);

    varname = this.addUpToLastLetterOrEmojiOrUnderscoreOrDigit(varname);
    return varname;
  }

  /** @throws EaterException (thrown, not returned) if not positioned at a valid function-name start. */
  protected eatAndGetFunctionName(): string {
    let varname = this.eatOneChar();
    if (!isLetterOrEmojiOrUnderscoreOrDollarChar(varname)) throw new EaterException('a003', this.stringLocated);

    varname = this.addUpToLastLetterOrEmojiOrUnderscoreOrDigit(varname);
    return varname;
  }

  /** Upstream uses `Character.isWhitespace` here (broader than
   * `TLineType#isSpaceChar` -- also matches `\t\n\r`), unlike
   * `eatAndGetSpaces` above. */
  skipSpaces(): void {
    while (this.i < this.stringLocated.length() && /\s/u.test(this.stringLocated.charAt(this.i))) this.i++;
  }

  protected skipUntilChar(ch: string): void {
    while (this.i < this.stringLocated.length() && this.stringLocated.charAt(this.i) !== ch) this.i++;
  }

  peekChar(): string {
    if (this.i >= this.stringLocated.length()) return '';

    return this.stringLocated.charAt(this.i);
  }

  matchAffectation(): boolean {
    return AFFECTATION_PATTERN.test(this.stringLocated.getString().slice(this.i));
  }

  peekCharN2(): string {
    if (this.i + 1 >= this.stringLocated.length()) return '';

    return this.stringLocated.charAt(this.i + 1);
  }

  protected hasNextChar(): boolean {
    return this.i < this.stringLocated.length();
  }

  eatOneChar(): string {
    const ch = this.stringLocated.charAt(this.i);
    this.i++;
    return ch;
  }

  /** @throws EaterException (thrown, not returned) if `s` is not eaten char-for-char at the cursor. */
  protected checkAndEatChar(s: string): void {
    for (let j = 0; j < s.length; j++) {
      const ch = s.charAt(j);
      if (this.i >= this.stringLocated.length() || this.stringLocated.charAt(this.i) !== ch)
        throw new EaterException('a001', this.stringLocated);

      this.i++;
    }
  }

  protected safeCheckAndEatChar(ch: string): boolean {
    if (this.i >= this.stringLocated.length() || this.stringLocated.charAt(this.i) !== ch) return false;

    this.i++;
    return true;
  }

  protected optionallyEatChar(ch: string): void {
    if (this.i >= this.stringLocated.length() || this.stringLocated.charAt(this.i) !== ch) return;

    this.i++;
  }

  /**
   * Upstream mutates a `StringBuilder sb` in place; adapted here to take
   * and return the accumulated string (this port's convention for ported
   * `StringBuilder` out-params -- see `VariableManager.ts`).
   */
  protected addUpToLastLetterOrEmojiOrUnderscoreOrDigit(prefix: string): string {
    let sb = prefix;
    while (this.i < this.stringLocated.length()) {
      const ch = this.stringLocated.charAt(this.i);
      if (!isLetterOrEmojiOrUnderscoreOrDigitChar(ch)) return sb;

      this.i++;
      sb += ch;
    }
    return sb;
  }

  protected addUpTo(separator: string, prefix: string): string {
    let sb = prefix;
    while (this.i < this.stringLocated.length()) {
      const ch = this.peekChar();
      if (ch === separator) return sb;

      this.i++;
      sb += ch;
    }
    return sb;
  }

  /**
   * `location` is a caller-supplied `StringLocated` distinct from
   * `this.getStringLocated()` -- upstream threads it separately (see
   * `def.guessFunctions(location)` below) rather than using the cursor's
   * own location, so this port keeps the same explicit parameter rather
   * than substituting `getStringLocated()`.
   * @throws EaterException (thrown, not returned) on a malformed argument list.
   */
  protected eatDeclareFunction(
    context: TContext,
    memory: TMemory,
    unquoted: boolean,
    location: StringLocated,
    allowNoParenthesis: boolean,
    type: TFunctionType,
  ): TFunctionImpl {
    const args: TFunctionArgument[] = [];
    const functionName = this.eatAndGetFunctionName();
    this.skipSpaces();
    if (!this.safeCheckAndEatChar('(')) {
      if (allowNoParenthesis) return new TFunctionImpl(functionName, args, unquoted, type);

      throw new EaterException('Missing opening parenthesis', this.stringLocated);
    }
    while (true) {
      this.skipSpaces();
      const ch = this.peekChar();
      if (isLetterOrEmojiOrUnderscoreOrDollarChar(ch)) {
        const varname = this.eatAndGetVarname();
        this.skipSpaces();
        let defValue: TValue | undefined;
        if (this.peekChar() === '=') {
          this.eatOneChar();
          const def = TokenStack.eatUntilCloseParenthesisOrComma(this);
          def.guessFunctions(location);
          defValue = def.getResult(this.getStringLocated(), context, memory);
        } else {
          defValue = undefined;
        }
        args.push(new TFunctionArgument(varname, defValue));
      } else if (ch === ',') {
        this.checkAndEatChar(',');
      } else if (ch === ')') {
        this.checkAndEatChar(')');
        break;
      } else {
        throw new EaterException('Error in function definition', this.stringLocated);
      }
      // #lizard forgives -- faithful port of Eater#eatDeclareFunction's
      // argument-list dispatch loop, mirroring upstream verbatim.
    }
    this.skipSpaces();
    return new TFunctionImpl(functionName, args, unquoted, type);
  }

  /** @throws EaterException (thrown, not returned) on a malformed declaration. */
  protected eatDeclareReturnFunctionWithOptionalReturn(
    context: TContext,
    memory: TMemory,
    unquoted: boolean,
    location: StringLocated,
  ): TFunctionImpl {
    const result = this.eatDeclareFunction(context, memory, unquoted, location, false, TFunctionType.RETURN_FUNCTION);
    if (this.peekChar() === 'r') {
      this.checkAndEatChar('return');
      this.skipSpaces();
      const line = `!return ${this.eatAllToEnd()}`;
      // Explicitly RETURN-classified at construction: this line is
      // synthesized here (it always starts with "!return "), so no real
      // `TLineType` classifier is needed -- see `StringLocated.ts`'s file
      // header.
      result.addBody(new StringLocated(line, location.getLocation(), 'RETURN'));
    } else if (this.peekChar() === '!') {
      this.checkAndEatChar('!return');
      this.skipSpaces();
      const line = `!return ${this.eatAllToEnd()}`;
      result.addBody(new StringLocated(line, location.getLocation(), 'RETURN'));
    }
    return result;
  }

  /** @throws EaterException (thrown, not returned) on a malformed declaration. */
  protected eatDeclareProcedure(
    context: TContext,
    memory: TMemory,
    unquoted: boolean,
    location: StringLocated,
  ): TFunctionImpl {
    return this.eatDeclareFunction(context, memory, unquoted, location, false, TFunctionType.PROCEDURE);
  }
}
