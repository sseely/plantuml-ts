/**
 * The lexical categories the TIM expression tokenizer (`eatOneToken`)
 * produces, plus the tokenizer itself.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/TokenType.java
 */

import { Token } from './Token.js';
import { TokenOperator, COMMERCIAL_MINUS_SIGN } from './TokenOperator.js';
import type { StringLocated } from './Knowledge.js';

export enum TokenType {
  QUOTED_STRING = 'QUOTED_STRING',
  JSON_DATA = 'JSON_DATA',
  OPERATOR = 'OPERATOR',
  OPEN_PAREN_MATH = 'OPEN_PAREN_MATH',
  COMMA = 'COMMA',
  CLOSE_PAREN_MATH = 'CLOSE_PAREN_MATH',
  NUMBER = 'NUMBER',
  PLAIN_TEXT = 'PLAIN_TEXT',
  SPACES = 'SPACES',
  FUNCTION_NAME = 'FUNCTION_NAME',
  OPEN_PAREN_FUNC = 'OPEN_PAREN_FUNC',
  CLOSE_PAREN_FUNC = 'CLOSE_PAREN_FUNC',
  AFFECTATION = 'AFFECTATION',
}

/**
 * Java `char` -> TS: represented as a single-character `string` throughout
 * this package; the "no more input" sentinel (Java char `0`) is `''`.
 * `COMMERCIAL_MINUS_SIGN` (imported above) is defined in TokenOperator.ts
 * rather than here, despite being `TokenType.COMMERCIAL_MINUS_SIGN` in
 * upstream Java: TokenOperator's `static readonly SUBSTRACTION` singleton
 * reads it eagerly at class-definition time, and ESM only guarantees a
 * circularly-imported module's top-level `const` is initialized once BOTH
 * modules finish loading -- reading it from here at that point is a race.
 * Hosting it in TokenOperator.ts (its only eager consumer) and importing it
 * here for eatOneToken/fromChar's (lazy, call-time-only) uses is safe in
 * either load order. Purely a module-boundary consequence of translating
 * Java's free same-package reference into real ESM modules; the exported
 * name and value are unchanged, and both files re-export it identically
 * via the barrel (`index.ts`).
 */

/**
 * Structural stand-in for the character-cursor surface of
 * `net.sourceforge.plantuml.tim.Eater` that `eatOneToken` (below) and
 * `TokenStack.eatUntilCloseParenthesisOrComma` depend on. `Eater.java`
 * lives in `tim/` (outside this package's write-set) and carries much more
 * (the abstract `analyze()` entry point, `eatExpression`, variable/
 * function-name eating, etc.) that belongs to a future `tim/Eater.ts` port.
 * Only the subset actually called from `tim/expression/` is declared here;
 * a real `Eater` implementation satisfies this interface structurally, with
 * zero adapter code, once it exists.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/Eater.java
 */
export interface Eater {
  peekChar(): string;
  peekCharN2(): string;
  eatOneChar(): string;
  eatAndGetQuotedString(): string;
  eatAndGetNumber(): string;
  eatAndGetSpaces(): string;
  skipSpaces(): void;
  getStringLocated(): StringLocated;
}

function isSingleChar1(t: TokenType): boolean {
  return t === TokenType.OPEN_PAREN_MATH || t === TokenType.COMMA || t === TokenType.CLOSE_PAREN_MATH;
}

function isPlainTextBreak(ch: string, ch2: string): boolean {
  const tmp = fromChar(ch, ch2);
  if (isSingleChar1(tmp) || tmp === TokenType.OPERATOR || tmp === TokenType.SPACES || tmp === TokenType.AFFECTATION)
    return true;

  return false;
}

/**
 * `net.sourceforge.plantuml.text.TLineType#isQuote` — preserved verbatim
 * (double or single quote only).
 */
function isQuoteChar(ch: string): boolean {
  return ch === '"' || ch === "'";
}

/** `TLineType#isLatinDigit` — ASCII '0'-'9' only, not `\p{Nd}`. */
function isLatinDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * `TLineType#isSpaceChar` delegates to `Character.isSpaceChar`, which is
 * the Unicode SPACE_SEPARATOR / LINE_SEPARATOR / PARAGRAPH_SEPARATOR
 * category test — narrower than `Character.isWhitespace` (used by
 * `Eater#skipSpaces`, out of this package's scope): it does NOT match
 * `\t` `\n` `\r`. `\p{Zs}\p{Zl}\p{Zp}` is the exact TS/ICU equivalent.
 */
const SPACE_CHAR_PATTERN = /^[\p{Zs}\p{Zl}\p{Zp}]$/u;

function isSpaceCharTLineType(ch: string): boolean {
  return ch !== '' && SPACE_CHAR_PATTERN.test(ch);
}

function fromChar(ch: string, ch2: string): TokenType {
  let result: TokenType = TokenType.PLAIN_TEXT;
  if (isQuoteChar(ch)) result = TokenType.QUOTED_STRING;
  else if (ch === '=') result = TokenType.AFFECTATION;
  else if (ch === '(') result = TokenType.OPEN_PAREN_MATH;
  else if (ch === ')') result = TokenType.CLOSE_PAREN_MATH;
  else if (ch === ',') result = TokenType.COMMA;
  else if (isLatinDigitChar(ch)) result = TokenType.NUMBER;
  else if (isSpaceCharTLineType(ch)) result = TokenType.SPACES;
  else if (ch === '-' || TokenOperator.getTokenOperator(ch, ch2) !== undefined) result = TokenType.OPERATOR;

  return result;
}

function isSubtractionOperator(lastToken: Token | null): boolean {
  if (lastToken === null) return false;

  const type = lastToken.getTokenType();
  if (
    type === TokenType.OPERATOR ||
    type === TokenType.OPEN_PAREN_MATH ||
    type === TokenType.COMMA ||
    type === TokenType.AFFECTATION
  )
    return false;

  return true;
}

function eatAndGetTokenPlainText(eater: Eater): string {
  let result = '';
  while (true) {
    const ch = eater.peekChar();
    if (ch === '' || isPlainTextBreak(ch, eater.peekCharN2())) return result;

    result += eater.eatOneChar();
  }
}

/**
 * Reads exactly one token from `eater`'s current cursor position, or
 * `null` at end of input (or, when `manageColon` is set, at an unescaped
 * `:`). `lastToken` (the previously-eaten non-space token, or `null` at the
 * start of an expression) disambiguates a leading `-` as a binary
 * subtraction operator vs. a unary/negative-number-literal sign — see
 * {@link isSubtractionOperator}.
 */
export function eatOneToken(lastToken: Token | null, eater: Eater, manageColon: boolean): Token | null {
  let ch = eater.peekChar();
  if (ch === '') return null;

  if (manageColon && ch === ':') return null;

  // Reclassify a binary-context '-' as the COMMERCIAL_MINUS_SIGN sentinel
  // so it resolves to TokenOperator.SUBSTRACTION below; a unary/leading '-'
  // is left as plain '-' and falls through to the NUMBER branch instead
  // (a negative number literal). Note the resulting single-char OPERATOR
  // token's surface is `ch` (i.e. the reclassified sentinel), NOT the
  // literal '-' character consumed from the source — preserved verbatim,
  // see TokenOperator#getTokenOperator's COMMERCIAL_MINUS_SIGN case.
  if (ch === '-' && isSubtractionOperator(lastToken)) ch = COMMERCIAL_MINUS_SIGN;

  const tokenOperator = TokenOperator.getTokenOperator(ch, eater.peekCharN2());
  if (isQuoteChar(ch)) return new Token(eater.eatAndGetQuotedString(), TokenType.QUOTED_STRING, undefined);
  else if (tokenOperator !== undefined) {
    if (tokenOperator.getDisplay().length === 1) {
      eater.eatOneChar();
      return new Token(ch, TokenType.OPERATOR, undefined);
    }

    return new Token(eater.eatOneChar() + eater.eatOneChar(), TokenType.OPERATOR, undefined);
  } else if (ch === '=') return new Token(eater.eatOneChar(), TokenType.AFFECTATION, undefined);
  else if (ch === '(') return new Token(eater.eatOneChar(), TokenType.OPEN_PAREN_MATH, undefined);
  else if (ch === ')') return new Token(eater.eatOneChar(), TokenType.CLOSE_PAREN_MATH, undefined);
  else if (ch === ',') return new Token(eater.eatOneChar(), TokenType.COMMA, undefined);
  else if (isLatinDigitChar(ch) || ch === '-') return new Token(eater.eatAndGetNumber(), TokenType.NUMBER, undefined);
  else if (isSpaceCharTLineType(ch)) return new Token(eater.eatAndGetSpaces(), TokenType.SPACES, undefined);

  // #lizard forgives -- faithful port of eatOneToken's dispatch chain,
  // mirroring upstream TokenType.java#eatOneToken verbatim.
  return new Token(eatAndGetTokenPlainText(eater), TokenType.PLAIN_TEXT, undefined);
}
