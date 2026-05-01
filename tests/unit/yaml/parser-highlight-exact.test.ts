import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parseHighlights(lines: string[]): ReadonlyArray<readonly string[]> {
  return parseYaml(makeSource(lines)).highlights;
}

describe('YAML parser — highlight exact paths', () => {
  it('single-key highlight', () => {
    expect(parseHighlights(['#highlight "fruit"', 'fruit: Apple'])).toEqual([['fruit']]);
  });

  it('two-segment path', () => {
    expect(parseHighlights([
      '#highlight "xmas-fifth-day" / "partridges"',
      'xmas-fifth-day:',
      '  partridges:',
      '    count: 1',
    ])).toEqual([['xmas-fifth-day', 'partridges']]);
  });

  it('multiple highlight lines produce multiple paths', () => {
    expect(parseHighlights(['#highlight "a"', '#highlight "b"', 'a: 1', 'b: 2'])).toEqual([
      ['a'], ['b'],
    ]);
  });

  it('highlight mixed with title directive', () => {
    const ast = parseYaml(makeSource(['title My Diagram', '#highlight "key"', 'key: val']));
    expect(ast.title).toBe('My Diagram');
    expect(ast.highlights).toEqual([['key']]);
  });

  it('layoutJson marks highlighted row for single-segment path', () => {
    const ast = parseYaml(makeSource(['#highlight "fruit"', 'fruit: Apple', 'size: Large']));
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    // Find the root node rows
    const rootNode = geo.nodes[0];
    expect(rootNode).toBeDefined();
    const fruitRow = rootNode!.rows.find(r => r.key === 'fruit');
    const sizeRow = rootNode!.rows.find(r => r.key === 'size');
    expect(fruitRow?.highlight).toBe(true);
    expect(sizeRow?.highlight).toBe(false);
  });

  it('layoutJson marks highlighted row for two-segment path in child node', () => {
    const ast = parseYaml(makeSource([
      '#highlight "address" / "city"',
      'address:',
      '  city: NYC',
      '  state: NY',
    ]));
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    // Root node: "address" row should NOT be highlighted
    const rootNode = geo.nodes[0]!;
    const addressRow = rootNode.rows.find(r => r.key === 'address');
    expect(addressRow?.highlight).toBe(false);
    // Child node (address): "city" highlighted, "state" not
    const addrNode = geo.nodes.find(n => n !== rootNode && n.rows.some(r => r.key === 'city'));
    expect(addrNode).toBeDefined();
    const cityRow = addrNode!.rows.find(r => r.key === 'city');
    const stateRow = addrNode!.rows.find(r => r.key === 'state');
    expect(cityRow?.highlight).toBe(true);
    expect(stateRow?.highlight).toBe(false);
  });
});
