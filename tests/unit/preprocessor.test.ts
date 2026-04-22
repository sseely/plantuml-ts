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
});
