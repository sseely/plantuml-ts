import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — quoted strings + flow sequences', () => {
  it('gabalo-23: double-quoted value strips outer quotes', () => {
    expect(parse(['doe: "a deer, a female deer"'])).toEqual({ doe: 'a deer, a female deer' });
  });

  it('double-quoted key strips outer quotes', () => {
    expect(parse(['"quoted key": value'])).toEqual({ 'quoted key': 'value' });
  });

  it('flow sequence: simple unquoted items', () => {
    expect(parse(['tags: [a, b, c]'])).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('flow sequence: double-quoted items have quotes stripped', () => {
    expect(parse(['tags: ["alpha", "beta"]'])).toEqual({ tags: ['alpha', 'beta'] });
  });

  it('flow sequence: quoted item with internal comma is not split', () => {
    expect(parse(['tags: ["a, b", "c"]'])).toEqual({ tags: ['a, b', 'c'] });
  });

  it('flow sequence: escaped quote inside quoted item', () => {
    expect(parse(['tags: ["it\\"s", "ok"]'])).toEqual({ tags: ['it"s', 'ok'] });
  });

  it('boolean and numeric values stay as strings', () => {
    expect(parse(['pi: 3.14159', 'xmas: true', 'count: 3'])).toEqual({
      pi: '3.14159', xmas: 'true', count: '3',
    });
  });

  it('poxedu-72: nested flow sequence under key with hyphenated key', () => {
    expect(parse(['calling-birds: [huey, dewey, louie, fred]'])).toEqual({
      'calling-birds': ['huey', 'dewey', 'louie', 'fred'],
    });
  });
});
