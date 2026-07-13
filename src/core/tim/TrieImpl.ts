/**
 * A character trie used to find the longest declared variable/function
 * name starting at a given position in a source line (`$` sigils and all)
 * -- the "longest match" lookup that lets `!$foo` and `!$foobar` coexist
 * without one shadowing the other's prefix.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TrieImpl.java
 */

import type { Trie } from './Trie.js';

/** Upstream's `'\0'` (NUL) end-of-word sentinel key. */
const END_OF_WORD = '\0';

export class TrieImpl implements Trie {
  private readonly brothers = new Map<string, TrieImpl>();

  add(s: string): void {
    if (s.includes(END_OF_WORD)) throw new Error('IllegalArgumentException');

    TrieImpl.addInternal(this, s + END_OF_WORD);
  }

  private static addInternal(start: TrieImpl, s: string): void {
    if (s.length === 0) throw new Error('UnsupportedOperationException');

    let current = start;
    for (let i = 0; i < s.length; i++) current = current.getOrCreate(s.charAt(i));
  }

  remove(s: string): boolean {
    return TrieImpl.removeInternal(this, s + END_OF_WORD);
  }

  private static removeInternal(start: TrieImpl, s: string): boolean {
    if (s.length <= 1) throw new Error('UnsupportedOperationException');

    let current = start;
    for (let i = 0; i < s.length; i++) {
      const first = s.charAt(i);
      const child = current.brothers.get(first);
      if (child === undefined) return false;

      if (i === s.length - 2) return child.brothers.delete(END_OF_WORD);

      current = child;
    }
    throw new Error('IllegalStateException');
  }

  private getOrCreate(added: string): TrieImpl {
    const existing = this.brothers.get(added);
    if (existing !== undefined) return existing;

    const created = new TrieImpl();
    this.brothers.set(added, created);
    return created;
  }

  getLonguestMatchStartingIn(s: string, pos: number): string {
    return TrieImpl.getLonguestMatchStartingInInternal(this, s, pos);
  }

  private static getLonguestMatchStartingInInternal(start: TrieImpl, s: string, pos: number): string {
    let result = '';
    let current: TrieImpl | undefined = start;
    let p = pos;
    while (current !== undefined) {
      if (s.length === p) return current.brothers.has(END_OF_WORD) ? result : '';

      const child = current.brothers.get(s.charAt(p));
      if (child === undefined || child.brothers.size === 0)
        return current.brothers.has(END_OF_WORD) ? result : '';

      result += s.charAt(p);
      current = child;
      p++;
    }
    return '';
  }
}
