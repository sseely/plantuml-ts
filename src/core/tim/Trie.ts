/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/Trie.java
 */

export interface Trie {
  add(s: string): void;

  getLonguestMatchStartingIn(s: string, pos: number): string;
}
