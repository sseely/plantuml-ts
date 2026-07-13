/**
 * An ordered, mutable list of {@link Token}s — the tokenizer's output, the
 * shunting-yard's output queue, and the input to
 * {@link ReversePolishInterpretor}.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/TokenStack.java
 */
import { Token } from './Token.js';
import { TokenType } from './TokenType.js';
import { eatOneToken, type Eater } from './TokenType.js';
import type { TokenIterator } from './TokenIterator.js';
import { EaterException, type StringLocated, type TContext, type TMemory } from './Knowledge.js';
import { ShuntingYard } from './ShuntingYard.js';
import { ReversePolishInterpretor } from './ReversePolishInterpretor.js';
import type { TValue } from './TValue.js';

export class TokenStack {
  private readonly tokens: Token[];

  constructor(list: Token[] = []) {
    this.tokens = list;
  }

  size(): number {
    return this.tokens.length;
  }

  subTokenStack(i: number): TokenStack {
    // Upstream returns an unmodifiable *view* (`Collections
    // .unmodifiableList(tokens.subList(...))`) rather than a copy; every
    // caller in this package (`guessFunctions`) only reads the result
    // immediately for a fresh iteration, never retains it across further
    // mutation of `tokens`, so an independent copy (`slice`) is observably
    // equivalent here.
    return new TokenStack(this.tokens.slice(i));
  }

  toString(): string {
    return `[${this.tokens.map((t) => t.toString()).join(', ')}]`;
  }

  add(token: Token): void {
    this.tokens.push(token);
  }

  withoutSpace(): TokenStack {
    const result = new TokenStack();
    for (const token of this.tokens) if (token.getTokenType() !== TokenType.SPACES) result.add(token);

    return result;
  }

  /**
   * Upstream overloads this name for two unrelated purposes: eating a
   * fresh token stream from an {@link Eater} (returns the collected
   * {@link TokenStack}), and skipping over an already-tokenized function
   * call's argument list via a {@link TokenIterator} (returns nothing —
   * it only advances the iterator). TypeScript overload signatures
   * preserve the single upstream name for both; the actual bodies live in
   * the private `eatFromEater` / `eatFromIterator` helpers below (upstream
   * has no equivalent split — it's a TS-overload-dispatch implementation
   * detail, not a load-bearing identifier).
   */
  static eatUntilCloseParenthesisOrComma(eater: Eater): TokenStack;
  static eatUntilCloseParenthesisOrComma(it: TokenIterator, location: StringLocated): void;
  static eatUntilCloseParenthesisOrComma(
    eaterOrIt: Eater | TokenIterator,
    location?: StringLocated,
  ): TokenStack | void {
    if (location === undefined) return TokenStack.eatFromEater(eaterOrIt as Eater);
    TokenStack.eatFromIterator(eaterOrIt as TokenIterator, location);
  }

  private static eatFromEater(eater: Eater): TokenStack {
    const result = new TokenStack();
    let level = 0;
    let lastToken: Token | null = null;
    while (true) {
      eater.skipSpaces();
      const ch = eater.peekChar();
      if (ch === '') throw new EaterException('until001', eater.getStringLocated());

      if (level === 0 && (ch === ',' || ch === ')')) return result;

      // Invariant established by the peekChar() !== '' check above:
      // eatOneToken(..., manageColon=false) only returns null at end of
      // input, which cannot be the case here.
      const token: Token = eatOneToken(lastToken, eater, false)!;
      const type = token.getTokenType();
      if (type === TokenType.OPEN_PAREN_MATH) level++;
      else if (type === TokenType.CLOSE_PAREN_MATH) level--;

      if (token.getTokenType() !== TokenType.SPACES) lastToken = token;
      result.add(token);
    }
  }

  private static eatFromIterator(it: TokenIterator, location: StringLocated): void {
    let level = 0;
    while (true) {
      // Upstream calls `it.peekToken()` unconditionally here (no
      // `hasMoreTokens()` guard) and only null-checks the *result* — this
      // package's own iterator implementation (see `tokenIterator` below)
      // never actually returns null from `peekToken` (it throws instead,
      // mirroring `List#get`'s `IndexOutOfBoundsException`), making this
      // check dead code for that implementation but meaningful for the
      // general `TokenIterator` interface contract. Preserved verbatim.
      const ch = it.peekToken();
      if (ch === null) throw new EaterException('until002', location);

      const typech = ch.getTokenType();
      if (
        (level === 0 && (typech === TokenType.COMMA || typech === TokenType.CLOSE_PAREN_MATH)) ||
        typech === TokenType.CLOSE_PAREN_FUNC
      )
        return;

      const token = it.nextToken()!;
      const type = token.getTokenType();
      if (type === TokenType.OPEN_PAREN_MATH || type === TokenType.OPEN_PAREN_FUNC) level++;
      else if (type === TokenType.CLOSE_PAREN_MATH || type === TokenType.CLOSE_PAREN_FUNC) level--;
      // #lizard forgives -- faithful port of
      // TokenStack.java#eatUntilCloseParenthesisOrComma(TokenIterator,...).
    }
  }

  private countFunctionArg(it: TokenIterator, location: StringLocated): number {
    // Upstream doesn't null-check `peekToken()` here either.
    const type1 = it.peekToken()!.getTokenType();
    if (type1 === TokenType.CLOSE_PAREN_MATH || type1 === TokenType.CLOSE_PAREN_FUNC) return 0;

    let result = 1;
    while (it.hasMoreTokens()) {
      TokenStack.eatUntilCloseParenthesisOrComma(it, location);
      const token = it.nextToken()!;
      const type = token.getTokenType();
      if (type === TokenType.CLOSE_PAREN_MATH || type === TokenType.CLOSE_PAREN_FUNC) return result;
      else if (type === TokenType.COMMA) result++;
      else throw new EaterException('count13', location);
    }
    throw new EaterException('count12', location);
  }

  /**
   * Rewrites `name(` immediately-adjacent-PLAIN_TEXT + OPEN_PAREN_MATH +
   * ... + CLOSE_PAREN_MATH triples into FUNCTION_NAME + OPEN_PAREN_FUNC
   * (carrying the resolved argument count) + CLOSE_PAREN_FUNC, in place.
   *
   * Paren-pairing note: upstream collects pairs into a `HashMap`, whose
   * iteration order is unspecified; this port uses a `Map` (insertion-
   * ordered) instead. This does not change the result: each pair's three
   * mutated indices (`iopen - 1`, `iopen`, `iclose`) are disjoint across
   * pairs (nesting or sequential parens never share a boundary index), so
   * the order pairs are processed in has no effect on the final token
   * array.
   *
   * Malformed-input note: if `tokens` contains an unmatched `)` (more
   * closes than opens), upstream's `open.pollFirst()` returns `null` and
   * `parens.put(null, i)` still succeeds (`HashMap` permits a null key);
   * a later `iopen - 1` auto-unboxes that null and throws
   * `NullPointerException`. This port instead simply skips registering a
   * pairing for that unmatched close-paren (see the `undefined` guard
   * below) rather than reproducing a null-key round-trip through a Map —
   * TypeScript's `Map<number, number>` cannot hold `undefined` as a
   * faithful analogue of a boxed-null key without contorting the type.
   * This is a deliberate, narrow divergence for malformed/unbalanced
   * input only; well-formed expressions (the entire real corpus) are
   * unaffected.
   */
  guessFunctions(location: StringLocated): void {
    const open: number[] = [];
    const parens = new Map<number, number>();
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i]!;
      if (token.getTokenType() === TokenType.OPEN_PAREN_MATH) open.unshift(i);
      else if (token.getTokenType() === TokenType.CLOSE_PAREN_MATH) {
        const openIndex = open.shift();
        if (openIndex !== undefined) parens.set(openIndex, i);
      }
    }

    for (const [iopen, iclose] of parens) {
      if (iopen > 0 && this.tokens[iopen - 1]!.getTokenType() === TokenType.PLAIN_TEXT) {
        this.tokens[iopen - 1] = new Token(this.tokens[iopen - 1]!.getSurface(), TokenType.FUNCTION_NAME, undefined);
        const nbArg = this.countFunctionArg(this.subTokenStack(iopen + 1).tokenIterator(), location);
        this.tokens[iopen] = new Token(String(nbArg), TokenType.OPEN_PAREN_FUNC, undefined);
        this.tokens[iclose] = new Token(')', TokenType.CLOSE_PAREN_FUNC, undefined);
      }
    }
  }

  tokenIterator(): TokenIterator {
    const tokens = this.tokens;
    let pos = 0;
    return {
      peekToken(): Token {
        const token = tokens[pos];
        // List#get(pos) throws IndexOutOfBoundsException when unguarded,
        // as it is here (no hasMoreTokens() check) — preserved as a thrown
        // Error rather than silently returning `undefined`.
        if (token === undefined) throw new Error(`IndexOutOfBoundsException: index ${pos}, size ${tokens.length}`);
        return token;
      },
      nextToken(): Token | null {
        if (pos >= tokens.length) return null;
        const token = tokens[pos]!;
        pos++;
        return token;
      },
      hasMoreTokens(): boolean {
        return pos < tokens.length;
      },
    };
  }

  getResult(location: StringLocated, context: TContext, memory: TMemory): TValue {
    const knowledge = context.asKnowledge(memory, location.getLocation());
    const tmp = this.withoutSpace();
    tmp.guessFunctions(location);
    const it = tmp.tokenIterator();
    const shuntingYard = new ShuntingYard(it, knowledge, location);
    const rpn = new ReversePolishInterpretor(location, shuntingYard.getQueue(), knowledge, memory, context);
    return rpn.getResult();
  }
}
