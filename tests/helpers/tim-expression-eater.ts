/**
 * Test-only implementation of the character-cursor subset of
 * `net.sourceforge.plantuml.tim.Eater` (`peekChar`, `peekCharN2`,
 * `eatOneChar`, `eatAndGetQuotedString`, `eatAndGetNumber`,
 * `eatAndGetSpaces`, `skipSpaces`) needed to exercise
 * `TokenType.eatOneToken` and `TokenStack.eatUntilCloseParenthesisOrComma`
 * end-to-end from a raw source string, matching the `src/core/tim/
 * expression/TokenType.ts` `Eater` structural interface.
 *
 * `Eater.java` itself lives outside `tim/expression/` (in `tim/`) and is
 * not ported yet — this is a faithful but partial port of just the cursor
 * behavior, for tests only. It is not production code and is outside the
 * `src/**` coverage glob in `vitest.config.ts`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/Eater.java
 */
import { eatOneToken, type Eater, type StringLocated, type Token } from '../../src/core/tim/expression/index.js';

class TestStringLocated implements StringLocated {
  getLocation(): unknown {
    return undefined;
  }
}

export class StringEater implements Eater {
  private i = 0;
  private readonly source: string;
  private readonly located = new TestStringLocated();

  constructor(source: string) {
    this.source = source;
  }

  peekChar(): string {
    if (this.i >= this.source.length) return '';
    return this.source.charAt(this.i);
  }

  peekCharN2(): string {
    if (this.i + 1 >= this.source.length) return '';
    return this.source.charAt(this.i + 1);
  }

  eatOneChar(): string {
    const ch = this.source.charAt(this.i);
    this.i++;
    return ch;
  }

  eatAndGetQuotedString(): string {
    const separator = this.peekChar();
    this.checkAndEatChar(separator);
    let value = '';
    while (this.i < this.source.length && this.peekChar() !== separator) {
      value += this.source.charAt(this.i);
      this.i++;
    }
    this.checkAndEatChar(separator);
    return value;
  }

  eatAndGetNumber(): string {
    let result = '';
    while (true) {
      const ch = this.peekChar();
      if (result.length === 0 && ch === '-') {
        result += this.eatOneChar();
        continue;
      }
      if (ch === '' || !(ch >= '0' && ch <= '9')) return result;
      result += this.eatOneChar();
    }
  }

  eatAndGetSpaces(): string {
    let result = '';
    while (true) {
      const ch = this.peekChar();
      if (ch === '' || !/^[\p{Zs}\p{Zl}\p{Zp}]$/u.test(ch)) return result;
      result += this.eatOneChar();
    }
  }

  skipSpaces(): void {
    while (this.i < this.source.length && /\s/.test(this.source.charAt(this.i))) this.i++;
  }

  getStringLocated(): StringLocated {
    return this.located;
  }

  private checkAndEatChar(ch: string): void {
    if (this.i >= this.source.length || this.source.charAt(this.i) !== ch) {
      throw new Error(`checkAndEatChar failed at index ${this.i} for "${ch}"`);
    }
    this.i++;
  }
}

/** Tokenize `source` end-to-end via `eatOneToken`, using a fresh
 * `StringEater`. Convenience for tests that don't need to drive the
 * cursor manually. */
export function tokenizeAll(source: string, manageColon = false): Token[] {
  const eater = new StringEater(source);
  const tokens: Token[] = [];
  let last: Token | null = null;
  for (;;) {
    const token = eatOneToken(last, eater, manageColon);
    if (token === null) break;
    tokens.push(token);
    last = token;
  }
  return tokens;
}
