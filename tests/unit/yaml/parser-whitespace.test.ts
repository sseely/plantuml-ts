import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — comments + whitespace', () => {
  it('strips full-line comment', () => {
    expect(parse(['# this is a comment', 'fruit: Apple'])).toEqual({ fruit: 'Apple' });
  });

  it('strips inline comment after value', () => {
    expect(parse(['fruit: Apple # juicy'])).toEqual({ fruit: 'Apple' });
  });

  it('does not strip # that is not preceded by a space (URL)', () => {
    expect(parse(['url: http://example.com'])).toEqual({ url: 'http://example.com' });
  });

  it('does not strip # inside double-quoted value', () => {
    expect(parse(['msg: "hello # world"'])).toEqual({ msg: 'hello # world' });
  });

  it('strips multiple full-line comments between entries', () => {
    expect(parse(['# header', 'a: 1', '# between', 'b: 2', '# footer'])).toEqual({
      a: '1', b: '2',
    });
  });

  it('poxedu-72 style: tab-indented YAML (tabs expanded to 4 spaces)', () => {
    expect(parse(['metadata:', '\tname: foo'])).toEqual({ metadata: { name: 'foo' } });
  });

  it('tab-prefixed key (1 tab = 4-space indent)', () => {
    expect(parse(['\tkey: val'])).toEqual({ key: 'val' });
  });

  it('ignores empty lines between entries', () => {
    expect(parse(['a: 1', '', '', 'b: 2'])).toEqual({ a: '1', b: '2' });
  });

  it('trailing comment at end of file does not crash', () => {
    expect(parse(['fruit: Apple', '# final comment'])).toEqual({ fruit: 'Apple' });
  });
});
