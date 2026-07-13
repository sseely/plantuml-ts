import { describe, expect, it } from 'vitest';
import { TrieImpl } from '../../../../src/core/tim/TrieImpl.js';

describe('TrieImpl', () => {
  it('finds the longest match starting at a position', () => {
    const trie = new TrieImpl();
    trie.add('$foo');
    trie.add('$foobar');
    expect(trie.getLonguestMatchStartingIn('$foobar rest', 0)).toBe('$foobar');
    expect(trie.getLonguestMatchStartingIn('$foo rest', 0)).toBe('$foo');
  });

  it('returns empty string when no entry matches at the position', () => {
    const trie = new TrieImpl();
    trie.add('$foo');
    expect(trie.getLonguestMatchStartingIn('$bar', 0)).toBe('');
  });

  it('matches starting mid-string via pos', () => {
    const trie = new TrieImpl();
    trie.add('$x');
    expect(trie.getLonguestMatchStartingIn('a $x', 2)).toBe('$x');
  });

  it('remove() drops a previously added entry', () => {
    const trie = new TrieImpl();
    trie.add('$foo');
    expect(trie.remove('$foo')).toBe(true);
    expect(trie.getLonguestMatchStartingIn('$foo', 0)).toBe('');
  });

  it('remove() returns false for an entry that was never added', () => {
    const trie = new TrieImpl();
    trie.add('$foo');
    expect(trie.remove('$bar')).toBe(false);
  });

  it('add() rejects a string already containing the NUL sentinel', () => {
    const trie = new TrieImpl();
    expect(() => trie.add('$foo\0bar')).toThrow('IllegalArgumentException');
  });

  it('add() accepts an empty string as a zero-length matchable entry', () => {
    const trie = new TrieImpl();
    trie.add('');
    expect(trie.getLonguestMatchStartingIn('', 0)).toBe('');
  });

  it('remove() rejects an empty string', () => {
    const trie = new TrieImpl();
    expect(() => trie.remove('')).toThrow('UnsupportedOperationException');
  });

  it('coexisting prefix/suffix entries do not shadow each other', () => {
    const trie = new TrieImpl();
    trie.add('$a');
    trie.add('$ab');
    trie.add('$abc');
    expect(trie.getLonguestMatchStartingIn('$abc', 0)).toBe('$abc');
    expect(trie.getLonguestMatchStartingIn('$ab', 0)).toBe('$ab');
    expect(trie.getLonguestMatchStartingIn('$a', 0)).toBe('$a');
  });
});
