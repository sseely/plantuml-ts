import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parseHighlights(lines: string[]): ReadonlyArray<readonly string[]> {
  return parseYaml(makeSource(lines)).highlights;
}

describe('YAML parser — highlight unquoted paths + stereotypes', () => {
  it('unquoted path without spaces around slash', () => {
    expect(parseHighlights(['#highlight xmas-fifth-day/partridges', 'foo: bar']))
      .toEqual([['xmas-fifth-day', 'partridges']]);
  });

  it('wildcard * at first position', () => {
    expect(parseHighlights(['#highlight * /french-hens', 'foo: bar']))
      .toEqual([['*', 'french-hens']]);
  });

  it('double wildcard **', () => {
    expect(parseHighlights(['#highlight ** /location', 'foo: bar']))
      .toEqual([['**', 'location']]);
  });

  it('stereotype <<h1>> stripped from path', () => {
    expect(parseHighlights(['#highlight "french-hens" <<h1>>', 'foo: bar']))
      .toEqual([['french-hens']]);
  });

  it('stereotype with two-segment path', () => {
    expect(parseHighlights(['#highlight "xmas-fifth-day" / "partridges" <<h2>>', 'foo: bar']))
      .toEqual([['xmas-fifth-day', 'partridges']]);
  });

  it('mixed quoted and unquoted highlights in one diagram', () => {
    expect(parseHighlights(['#highlight "a"', '#highlight b/c', 'a: 1', 'b:', '  c: 2']))
      .toEqual([['a'], ['b', 'c']]);
  });

  it('leading and trailing spaces in unquoted segments are trimmed', () => {
    expect(parseHighlights(['#highlight  key / subkey ', 'foo: bar']))
      .toEqual([['key', 'subkey']]);
  });

  it('single ** wildcard', () => {
    expect(parseHighlights(['#highlight **', 'foo: bar']))
      .toEqual([['**']]);
  });
});
