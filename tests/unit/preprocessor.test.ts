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

  it('keeps a bare mid-line apostrophe as ordinary text (not a comment)', () => {
    // Upstream only recognizes full-line comments (preproc2/
    // ReadFilterQuoteComment.java:66) and `/' ... '/` block comments
    // (text/StringLocated.java:209-229) — a mid-line `'` is not comment
    // syntax at all (live-oracle-verified: the full label, including
    // " ' ignored", renders unchanged).
    const result = run(["Alice -> Bob: hi ' ignored"]);
    expect(result).toEqual(["Alice -> Bob: hi ' ignored"]);
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

  // ── parametric macros ────────────────────────────────────────────────────

  it('single-param macro expands ##param## in body', () => {
    const result = run([
      '!define BOLD(x) <b>##x##</b>',
      'BOLD(hello)',
    ]);
    expect(result).toEqual(['<b>hello</b>']);
  });

  it('two-param macro substitutes both params', () => {
    const result = run([
      '!define PAIR(a,b) ##a## and ##b##',
      'PAIR(cats,dogs)',
    ]);
    expect(result).toEqual(['cats and dogs']);
  });

  it('adjacent ##param## tokens produce concatenated output', () => {
    const result = run([
      '!define CONCAT(a,b) ##a####b##',
      'CONCAT(foo,bar)',
    ]);
    expect(result).toEqual(['foobar']);
  });

  it('wrong arg count leaves call-site unchanged', () => {
    const result = run([
      '!define BOLD(x) <b>##x##</b>',
      'BOLD(x,y)',
    ]);
    expect(result).toEqual(['BOLD(x,y)']);
  });

  it('parametric macro with space-padded args trims correctly', () => {
    const result = run([
      '!define PAIR(a,b) ##a## and ##b##',
      'PAIR( cats , dogs )',
    ]);
    expect(result).toEqual(['cats and dogs']);
  });

  it('multiple call-sites on one line are all expanded', () => {
    const result = run([
      '!define BOLD(x) <b>##x##</b>',
      'BOLD(one) and BOLD(two)',
    ]);
    expect(result).toEqual(['<b>one</b> and <b>two</b>']);
  });

  it('!undefine removes a parametric macro', () => {
    const result = run([
      '!define BOLD(x) <b>##x##</b>',
      '!undefine BOLD',
      'BOLD(hello)',
    ]);
    expect(result).toEqual(['BOLD(hello)']);
  });

  it('simple define still works after a parametric define is added (regression)', () => {
    const result = run([
      '!define FOO bar',
      '!define WRAP(x) [##x##]',
      'FOO',
      'WRAP(baz)',
    ]);
    expect(result).toEqual(['bar', '[baz]']);
  });

  // ── skinparam: ReadonlyMap<string, string> ───────────────────────────────

  it('single-line skinparam is collected with lowercase key', () => {
    const { skinparam, lines } = preprocess(
      'skinparam backgroundColor #FF0000\nAlice -> Bob',
    );
    expect(skinparam.get('backgroundcolor')).toBe('#FF0000');
    expect(lines).not.toContain('skinparam backgroundColor #FF0000');
    expect(lines).toContain('Alice -> Bob');
  });

  it('single-line skinparam stores plain lowercase key (no arrow normalisation)', () => {
    const { skinparam } = preprocess('skinparam classArrowColor red');
    expect(skinparam.get('classarrowcolor')).toBe('red');
    // Full normalisation to 'arrowcolor' happens in resolveSkinparam (T2).
    expect(skinparam.has('arrowcolor')).toBe(false);
  });

  it('block-form skinparam collects all entries', () => {
    const { skinparam, lines } = preprocess(
      'skinparam {\n  backgroundColor red\n  borderColor blue\n}',
    );
    expect(skinparam.get('backgroundcolor')).toBe('red');
    expect(skinparam.get('bordercolor')).toBe('blue');
    // Neither the block lines nor the braces should appear in output.
    expect(lines).toEqual([]);
  });

  it('block-form skinparam line is not emitted to outputLines', () => {
    const { lines } = preprocess(
      'skinparam {\n  fontSize 14\n}\nAlice -> Bob',
    );
    expect(lines).toEqual(['Alice -> Bob']);
  });

  it('duplicate skinparam key: last value wins', () => {
    const { skinparam } = preprocess(
      'skinparam foo a\nskinparam foo b',
    );
    expect(skinparam.get('foo')).toBe('b');
  });

  it('skinparam inside inactive !ifdef is skipped (not collected)', () => {
    const { skinparam } = preprocess(
      '!ifdef X\nskinparam foo bar\n!endif',
    );
    expect(skinparam.size).toBe(0);
  });

  it('skinparam block inside inactive !ifdef is skipped (not collected)', () => {
    const { skinparam } = preprocess(
      '!ifdef X\nskinparam {\n  foo bar\n}\n!endif',
    );
    expect(skinparam.size).toBe(0);
  });

  it('source with no skinparam directives returns empty map', () => {
    const { skinparam } = preprocess('Alice -> Bob: hi');
    expect(skinparam.size).toBe(0);
  });

  it('empty source returns empty skinparam map', () => {
    const { skinparam } = preprocess('');
    expect(skinparam.size).toBe(0);
  });

  it('skinparam value is trimmed of surrounding whitespace', () => {
    const { skinparam } = preprocess('skinparam backgroundColor   #AABBCC  ');
    expect(skinparam.get('backgroundcolor')).toBe('#AABBCC');
  });

  it('block-form skinparam duplicate key last wins', () => {
    const { skinparam } = preprocess(
      'skinparam foo a\nskinparam {\n  foo b\n}',
    );
    expect(skinparam.get('foo')).toBe('b');
  });

  it('mixed single-line and block skinparam both collected', () => {
    const { skinparam } = preprocess(
      'skinparam backgroundColor red\nskinparam {\n  borderColor blue\n}',
    );
    expect(skinparam.get('backgroundcolor')).toBe('red');
    expect(skinparam.get('bordercolor')).toBe('blue');
  });
});

describe('%n() and %newline() built-in expansion', () => {
  it('%n() in a content line splits into two output lines', () => {
    const { lines } = preprocess('@startuml\n:hello %n() world;\n@enduml');
    // trimEnd() strips the trailing space from the first segment
    expect(lines).toContain(':hello');
    expect(lines).toContain(' world;');
  });

  it('%newline() behaves identically to %n()', () => {
    const { lines } = preprocess('@startuml\n:a %newline() b;\n@enduml');
    expect(lines).toContain(':a');
    expect(lines).toContain(' b;');
  });

  it('multiple %n() calls produce multiple splits', () => {
    const { lines } = preprocess('@startuml\n:x %n() y %n() z;\n@enduml');
    expect(lines).toContain(':x');
    expect(lines).toContain(' y');
    expect(lines).toContain(' z;');
  });

  it('line without %n() is emitted unchanged', () => {
    const { lines } = preprocess('@startuml\n:hello;\n@enduml');
    expect(lines).toContain(':hello;');
  });

  it('%n() is case-insensitive', () => {
    const { lines } = preprocess('@startuml\n:a %N() b;\n@enduml');
    expect(lines).toContain(':a');
    expect(lines).toContain(' b;');
  });
});
