import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parseHighlights(lines: string[]) {
  return parseYaml(makeSource(lines)).highlights;
}

describe('YAML parser — highlight unquoted paths + stereotypes', () => {
  it('unquoted path without spaces around slash', () => {
    expect(parseHighlights(['#highlight xmas-fifth-day/partridges', 'foo: bar']))
      .toEqual([{ path: ['xmas-fifth-day', 'partridges'], styleClass: '' }]);
  });

  it('wildcard * at first position', () => {
    expect(parseHighlights(['#highlight * /french-hens', 'foo: bar']))
      .toEqual([{ path: ['*', 'french-hens'], styleClass: '' }]);
  });

  it('double wildcard **', () => {
    expect(parseHighlights(['#highlight ** /location', 'foo: bar']))
      .toEqual([{ path: ['**', 'location'], styleClass: '' }]);
  });

  it('stereotype <<h1>> captured as styleClass from path', () => {
    expect(parseHighlights(['#highlight "french-hens" <<h1>>', 'foo: bar']))
      .toEqual([{ path: ['french-hens'], styleClass: 'h1' }]);
  });

  it('stereotype with two-segment path captured as styleClass', () => {
    expect(parseHighlights(['#highlight "xmas-fifth-day" / "partridges" <<h2>>', 'foo: bar']))
      .toEqual([{ path: ['xmas-fifth-day', 'partridges'], styleClass: 'h2' }]);
  });

  it('mixed quoted and unquoted highlights in one diagram', () => {
    expect(parseHighlights(['#highlight "a"', '#highlight b/c', 'a: 1', 'b:', '  c: 2']))
      .toEqual([
        { path: ['a'], styleClass: '' },
        { path: ['b', 'c'], styleClass: '' },
      ]);
  });

  it('leading and trailing spaces in unquoted segments are trimmed', () => {
    expect(parseHighlights(['#highlight  key / subkey ', 'foo: bar']))
      .toEqual([{ path: ['key', 'subkey'], styleClass: '' }]);
  });

  it('single ** wildcard', () => {
    expect(parseHighlights(['#highlight **', 'foo: bar']))
      .toEqual([{ path: ['**'], styleClass: '' }]);
  });
});
