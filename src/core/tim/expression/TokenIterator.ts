/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/TokenIterator.java
 *
 * Both `nextToken` and `peekToken` are typed nullable, matching the Java
 * method signatures exactly (Java's type system does not distinguish
 * nullable from non-nullable reference types). `TokenStack`'s own
 * iterator implementation only ever returns `null` from `nextToken` (at
 * end of input) and never from `peekToken` (it throws instead, mirroring
 * `List#get`'s `IndexOutOfBoundsException`) — but the interface itself
 * permits either, since `TokenStack.eatUntilCloseParenthesisOrComma`'s
 * iterator-based overload explicitly null-checks `peekToken()`'s result.
 */
import type { Token } from './Token.js';

export interface TokenIterator {
  nextToken(): Token | null;

  peekToken(): Token | null;

  hasMoreTokens(): boolean;
}
