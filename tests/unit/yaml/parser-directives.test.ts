import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { isDisplayPositionedNull } from '../../../src/core/annotations/index.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines));
}

describe('YAML parser — directives', () => {
  it('extracts title into annotations.title (mission G0b/T8, not a bespoke ast.title field)', () => {
    const ast = parse(['title My YAML Diagram', 'fruit: Apple', 'size: Large']);
    expect(ast.annotations?.title.display).toEqual(['My YAML Diagram']);
    expect(ast.root).toEqual({ fruit: 'Apple', size: 'Large' });
  });

  it('litife-43: skinparam stripped from body', () => {
    const ast = parse([
      'skinparam handwritten true',
      'fruit: Apple', 'size: Large', 'color:', ' - Red', ' - Green',
    ]);
    expect(ast.root).toEqual({ fruit: 'Apple', size: 'Large', color: ['Red', 'Green'] });
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(true);
  });

  it('scale directive stripped', () => {
    const ast = parse(['scale 200', 'foo: bar']);
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  it('multiple directives before body all stripped', () => {
    const ast = parse(['title My Title', 'skinparam handwritten true', 'scale 200', 'key: val']);
    expect(ast.annotations?.title.display).toEqual(['My Title']);
    expect(ast.root).toEqual({ key: 'val' });
  });

  it('title alone (no space after) is treated as YAML key', () => {
    // 'title:' has no value after the colon separator, so it fails the
    // shared matcher's VALUE requirement (a non-empty quoted or unquoted
    // capture) same as the old bespoke /^title\s+/i regex rejected it.
    // It falls through to become YAML body: KEY_ONLY with key 'title'.
    const ast = parse(['title:', 'foo: bar']);
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(true);
    expect(ast.root).toHaveProperty('title');
  });

  it('highlight coexists with title directive', () => {
    const ast = parse(['title My Title', '#highlight "foo"', 'foo: bar']);
    expect(ast.annotations?.title.display).toEqual(['My Title']);
    expect(ast.highlights).toEqual([{ path: ['foo'], styleClass: '' }]);
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  it('parseError is always false', () => {
    const ast = parse(['key: value']);
    expect(ast.parseError).toBe(false);
  });

  it('skin directive stripped', () => {
    const ast = parse(['skin rose', 'foo: bar']);
    expect(ast.root).toEqual({ foo: 'bar' });
  });
});
