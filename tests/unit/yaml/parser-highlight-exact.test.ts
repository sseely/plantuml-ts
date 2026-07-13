import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parseHighlights(lines: string[]) {
  return parseYaml(makeSource(lines)).highlights;
}

describe('YAML parser — highlight exact paths', () => {
  it('single-key highlight', () => {
    const h = parseHighlights(['#highlight "fruit"', 'fruit: Apple']);
    expect(h).toHaveLength(1);
    expect(h[0]!.path).toEqual(['fruit']);
    expect(h[0]!.styleClass).toBe('');
  });

  it('two-segment path', () => {
    const h = parseHighlights([
      '#highlight "xmas-fifth-day" / "partridges"',
      'xmas-fifth-day:',
      '  partridges:',
      '    count: 1',
    ]);
    expect(h).toHaveLength(1);
    expect(h[0]!.path).toEqual(['xmas-fifth-day', 'partridges']);
    expect(h[0]!.styleClass).toBe('');
  });

  it('multiple highlight lines produce multiple directives', () => {
    const h = parseHighlights(['#highlight "a"', '#highlight "b"', 'a: 1', 'b: 2']);
    expect(h).toHaveLength(2);
    expect(h[0]!.path).toEqual(['a']);
    expect(h[1]!.path).toEqual(['b']);
  });

  it('highlight mixed with title directive', () => {
    const ast = parseYaml(makeSource(['title My Diagram', '#highlight "key"', 'key: val']));
    expect(ast.annotations?.title.display).toEqual(['My Diagram']);
    expect(ast.highlights).toHaveLength(1);
    expect(ast.highlights[0]!.path).toEqual(['key']);
  });

  it('layoutJson marks highlighted row for single-segment path', () => {
    const ast = parseYaml(makeSource(['#highlight "fruit"', 'fruit: Apple', 'size: Large']));
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    // Find the root node rows
    const rootNode = geo.nodes[0];
    expect(rootNode).toBeDefined();
    const fruitRow = rootNode!.rows.find(r => r.key === 'fruit');
    const sizeRow = rootNode!.rows.find(r => r.key === 'size');
    expect(fruitRow?.highlight).not.toBe(false);
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
    expect(cityRow?.highlight).not.toBe(false);
    expect(stateRow?.highlight).toBe(false);
  });
});
