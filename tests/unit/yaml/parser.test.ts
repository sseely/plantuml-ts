import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { renderSync } from '../../../src/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

describe('parseYaml', () => {
  // -------------------------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------------------------

  it('returns parseError: false always', () => {
    const ast = parseYaml(makeSource(['fruit: Apple']));
    expect(ast.parseError).toBe(false);
  });

  it('parses simple key-values into an object', () => {
    const ast = parseYaml(makeSource(['fruit: Apple', 'size: Large']));
    expect(ast.root).toEqual({ fruit: 'Apple', size: 'Large' });
  });

  it('parses nested objects', () => {
    const ast = parseYaml(
      makeSource(['metadata:', '  name: foo', '  namespace: bar']),
    );
    expect(ast.root).toEqual({ metadata: { name: 'foo', namespace: 'bar' } });
  });

  it('returns root null for empty source', () => {
    const ast = parseYaml(makeSource([]));
    expect(ast.root).toBeNull();
    expect(ast.parseError).toBe(false);
  });

  it('returns root null for source with only blank lines', () => {
    const ast = parseYaml(makeSource(['', '   ', '']));
    expect(ast.root).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Title directive
  // -------------------------------------------------------------------------

  it('extracts title directive before body', () => {
    const ast = parseYaml(makeSource(['title My Title', 'foo: bar']));
    expect(ast.title).toBe('My Title');
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  it('title is undefined when not present', () => {
    const ast = parseYaml(makeSource(['foo: bar']));
    expect(ast.title).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // skinparam and other directives
  // -------------------------------------------------------------------------

  it('strips skinparam directive before body', () => {
    const ast = parseYaml(
      makeSource(['skinparam handwritten true', 'foo: bar']),
    );
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  it('strips scale directive before body', () => {
    const ast = parseYaml(makeSource(['scale 2', 'foo: bar']));
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  // -------------------------------------------------------------------------
  // <style> block
  // -------------------------------------------------------------------------

  it('strips <style> block before parsing', () => {
    const ast = parseYaml(
      makeSource(['<style>', 'yamlDiagram { }', '</style>', 'foo: bar']),
    );
    expect(ast.root).toEqual({ foo: 'bar' });
  });

  // -------------------------------------------------------------------------
  // @startyaml / @endyaml wrappers
  // -------------------------------------------------------------------------

  it('ignores @startyaml and @endyaml wrapper lines defensively', () => {
    const ast = parseYaml(
      makeSource(['@startyaml', 'fruit: Apple', '@endyaml']),
    );
    expect(ast.root).toEqual({ fruit: 'Apple' });
  });

  // -------------------------------------------------------------------------
  // #highlight parsing
  // -------------------------------------------------------------------------

  it('parses a single quoted highlight segment', () => {
    const ast = parseYaml(
      makeSource(['#highlight "fruit"', 'fruit: Apple']),
    );
    expect(ast.highlights).toEqual([{ path: ['fruit'], styleClass: '' }]);
  });

  it('parses unquoted multi-segment highlight', () => {
    const ast = parseYaml(
      makeSource(['#highlight xmas-fifth-day/partridges', 'a: b']),
    );
    expect(ast.highlights).toEqual([{ path: ['xmas-fifth-day', 'partridges'], styleClass: '' }]);
  });

  it('parses quoted multi-segment highlight with spaces around slash', () => {
    const ast = parseYaml(
      makeSource(['#highlight "xmas-fifth-day" / "partridges"', 'a: b']),
    );
    expect(ast.highlights).toEqual([{ path: ['xmas-fifth-day', 'partridges'], styleClass: '' }]);
  });

  it('parses wildcard single-star highlight', () => {
    const ast = parseYaml(
      makeSource(['#highlight * /french-hens', 'a: b']),
    );
    expect(ast.highlights).toEqual([{ path: ['*', 'french-hens'], styleClass: '' }]);
  });

  it('parses double-star highlight', () => {
    const ast = parseYaml(makeSource(['#highlight **', 'a: b']));
    expect(ast.highlights).toEqual([{ path: ['**'], styleClass: '' }]);
  });

  it('parses double-star with additional segment', () => {
    const ast = parseYaml(makeSource(['#highlight ** /location', 'a: b']));
    expect(ast.highlights).toEqual([{ path: ['**', 'location'], styleClass: '' }]);
  });

  it('captures stereotype from highlight line as styleClass', () => {
    const ast = parseYaml(
      makeSource(['#highlight "fruit" <<h1>>', 'fruit: Apple']),
    );
    expect(ast.highlights).toEqual([{ path: ['fruit'], styleClass: 'h1' }]);
  });

  it('collects multiple highlights', () => {
    const ast = parseYaml(
      makeSource([
        '#highlight "fruit"',
        '#highlight "size"',
        'fruit: Apple',
        'size: Large',
      ]),
    );
    expect(ast.highlights).toHaveLength(2);
    expect(ast.highlights[0]).toEqual({ path: ['fruit'], styleClass: '' });
    expect(ast.highlights[1]).toEqual({ path: ['size'], styleClass: '' });
  });

  it('has empty highlights array when no #highlight lines', () => {
    const ast = parseYaml(makeSource(['foo: bar']));
    expect(ast.highlights).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Integration smoke test
  // -------------------------------------------------------------------------

  it('renderSync produces an SVG string for a simple YAML diagram', () => {
    const result = renderSync('@startyaml\nfruit: Apple\nsize: Large\n@endyaml');
    expect(result).toContain('<svg');
  });
});
