import { describe, it, expect } from 'vitest';
import { preprocess } from '../../src/core/preprocessor.js';

/**
 * Helper: build a source string from an array of lines, then run preprocess.
 * Returns the resulting lines array.
 */
function run(
  lines: string[],
  defines?: ReadonlyMap<string, string>,
): readonly string[] {
  return preprocess(lines.join('\n'), defines).lines;
}

describe('preprocessor', () => {
  it('strips single-line comments', () => {
    const result = run(["' this is a comment", 'Alice -> Bob: hi']);
    expect(result).toEqual(['Alice -> Bob: hi']);
  });

  it('strips mid-line trailing comments', () => {
    const result = run(["Alice -> Bob: hi ' ignored"]);
    expect(result).toEqual(['Alice -> Bob: hi']);
  });

  it('replaces !define token in subsequent lines', () => {
    const result = run(['!define TIMEOUT 30', 'delay TIMEOUT']);
    expect(result).toEqual(['delay 30']);
  });

  it('!define with no value substitutes empty string', () => {
    const result = run(['!define DEBUG', 'note DEBUG over Alice']);
    expect(result).toEqual(['note  over Alice']);
  });

  it('!undefine removes a previous definition', () => {
    const result = run(['!define FOO bar', '!undefine FOO', 'text FOO']);
    expect(result).toEqual(['text FOO']);
  });

  it('!ifdef includes block when token is defined', () => {
    const result = run([
      '!define DEBUG',
      '!ifdef DEBUG',
      'note debug',
      '!endif',
      'Alice -> Bob',
    ]);
    expect(result).toEqual(['note debug', 'Alice -> Bob']);
  });

  it('!ifdef skips block when token is not defined', () => {
    const result = run(['!ifdef DEBUG', 'note debug', '!endif', 'Alice -> Bob']);
    expect(result).toEqual(['Alice -> Bob']);
  });

  it('!ifndef includes block when token is not defined', () => {
    const result = run(['!ifndef PROD', 'note dev only', '!endif']);
    expect(result).toEqual(['note dev only']);
  });

  it('!ifndef skips block when token is defined', () => {
    const result = run([
      '!define PROD',
      '!ifndef PROD',
      'note dev only',
      '!endif',
    ]);
    expect(result).toEqual([]);
  });

  it('nested !ifdef works correctly', () => {
    const result = run([
      '!define A',
      '!define B',
      '!ifdef A',
      '!ifdef B',
      'both',
      '!endif',
      '!endif',
    ]);
    expect(result).toEqual(['both']);
  });

  it('!theme directive is stripped from output', () => {
    const { lines, theme } = preprocess('!theme dark\nAlice -> Bob');
    expect(lines).not.toContain('!theme dark');
    expect(lines).toContain('Alice -> Bob');
    expect(theme).toBe('dark');
  });

  it('returns null theme when no !theme directive is present', () => {
    const { theme } = preprocess('Alice -> Bob: hi');
    expect(theme).toBeNull();
  });

  it('accepts pre-seeded defines from the defines parameter', () => {
    const defines = new Map([['VERSION', '42']]);
    const result = run(['note VERSION'], defines);
    expect(result).toEqual(['note 42']);
  });

  it('strips block comments spanning multiple lines', () => {
    const result = run(["/' this is", 'a block comment', "'/", 'Alice -> Bob']);
    expect(result).toEqual(['Alice -> Bob']);
  });

  it('returns empty lines array for empty source', () => {
    const { lines } = preprocess('');
    expect(lines).toEqual([]);
  });

  it('preserves lines that are not directives or comments', () => {
    const result = run(['participant Alice', 'Alice -> Bob: hello']);
    expect(result).toEqual(['participant Alice', 'Alice -> Bob: hello']);
  });

  // ── styles: readonly string[] ────────────────────────────────────────────

  it('returns empty styles array when no <style> block is present', () => {
    const { styles } = preprocess('Alice -> Bob');
    expect(styles).toEqual([]);
  });

  it('extracts a single <style> block and excludes it from lines', () => {
    const { lines, styles } = preprocess(
      '<style>\nbackground: red\n</style>\nAlice -> Bob',
    );
    expect(lines).toEqual(['Alice -> Bob']);
    expect(styles).toEqual(['background: red']);
  });

  it('collects multiple <style> blocks as separate entries', () => {
    const { styles } = preprocess(
      '<style>\ncolor: blue\n</style>\nnote\n<style>\nfont: bold\n</style>',
    );
    expect(styles).toHaveLength(2);
    expect(styles[0]).toBe('color: blue');
    expect(styles[1]).toBe('font: bold');
  });

  it('style block content is collected verbatim (no define substitution)', () => {
    const { styles } = preprocess(
      '!define BG red\n<style>\nbackground: BG\n</style>',
    );
    expect(styles).toEqual(['background: BG']);
  });

  it('style block with multi-line content joins lines with newline', () => {
    const { styles } = preprocess(
      '<style>\nline one\nline two\n</style>',
    );
    expect(styles).toEqual(['line one\nline two']);
  });

  it('<style> tag matching is case-insensitive', () => {
    const { lines, styles } = preprocess(
      '<STYLE>\nbold\n</STYLE>\nAlice -> Bob',
    );
    expect(lines).toEqual(['Alice -> Bob']);
    expect(styles).toEqual(['bold']);
  });

  it('style block inside inactive !ifdef is discarded (not collected)', () => {
    const { styles } = preprocess(
      '!ifdef NOPE\n<style>\ncolor: red\n</style>\n!endif',
    );
    expect(styles).toEqual([]);
  });

  it('empty source returns empty styles', () => {
    const { styles } = preprocess('');
    expect(styles).toEqual([]);
  });

  // ── !else clause ─────────────────────────────────────────────────────────

  it('!ifdef with !else: includes if-branch when token is defined', () => {
    const result = run([
      '!define X',
      '!ifdef X',
      'yes',
      '!else',
      'no',
      '!endif',
    ]);
    expect(result).toEqual(['yes']);
  });

  it('!ifdef with !else: includes else-branch when token is not defined', () => {
    const result = run(['!ifdef X', 'yes', '!else', 'no', '!endif']);
    expect(result).toEqual(['no']);
  });

  it('!ifndef with !else: includes if-branch when token is not defined', () => {
    const result = run(['!ifndef X', 'yes', '!else', 'no', '!endif']);
    expect(result).toEqual(['yes']);
  });

  it('!ifndef with !else: includes else-branch when token is defined', () => {
    const result = run([
      '!define X',
      '!ifndef X',
      'yes',
      '!else',
      'no',
      '!endif',
    ]);
    expect(result).toEqual(['no']);
  });

  it('!else with no enclosing conditional is a no-op', () => {
    // Stray !else without an open ifdef/ifndef — should not throw.
    const result = run(['Alice -> Bob', '!else', 'Carol -> Dave']);
    expect(result).toEqual(['Alice -> Bob', 'Carol -> Dave']);
  });
});
