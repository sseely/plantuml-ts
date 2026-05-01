import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — basic key-value + nested objects', () => {
  it('parses two simple key-value pairs', () => {
    expect(parse(['FOO1: bar1', 'FOO2: bar2'])).toEqual({ FOO1: 'bar1', FOO2: 'bar2' });
  });

  it('parses nested object via indentation', () => {
    expect(parse(['metadata:', '  name: foo', '  namespace: bar'])).toEqual({
      metadata: { name: 'foo', namespace: 'bar' },
    });
  });

  it('parses three levels deep', () => {
    expect(parse(['a:', '  b:', '    c: deep'])).toEqual({ a: { b: { c: 'deep' } } });
  });

  it('produces empty string for KEY_ONLY with no deeper content', () => {
    expect(parse(['test:'])).toEqual({ test: '' });
  });

  it('produces empty string for KEY_ONLY followed by sibling at same level', () => {
    expect(parse(['key:', 'other: val'])).toEqual({ key: '', other: 'val' });
  });

  it('parses common-indented YAML (all lines have same leading spaces)', () => {
    expect(parse(['  fruit: Apple', '  size: Large'])).toEqual({
      fruit: 'Apple',
      size: 'Large',
    });
  });

  it('parses key containing a space', () => {
    expect(parse(['the key: the value'])).toEqual({ 'the key': 'the value' });
  });

  it('parses dot-prefixed value (medosa-24 style)', () => {
    const root = parse(['compile:', '  extends: .sbt-compile-cross']) as Record<string, Record<string, string>>;
    expect(root.compile?.extends).toBe('.sbt-compile-cross');
  });

  it('ignores empty lines between entries', () => {
    expect(parse(['a: 1', '', 'b: 2'])).toEqual({ a: '1', b: '2' });
  });

  it('preserves number values as strings', () => {
    expect(parse(['replicas: 1'])).toEqual({ replicas: '1' });
  });
});
