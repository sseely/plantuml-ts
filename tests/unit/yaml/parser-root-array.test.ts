import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { renderSync } from '../../../src/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — root-level arrays', () => {
  it('finofu-94: pure scalar list at root', () => {
    const root = parse(['- A', '- B', '- C']);
    expect(Array.isArray(root)).toBe(true);
    expect(root).toEqual(['A', 'B', 'C']);
  });

  it('gatuva-87: list of objects at root', () => {
    expect(parse([
      '  - name: Mark McGwire', '    hr:   65',
      '  - name: Sammy Sosa',   '    hr:   63',
    ])).toEqual([
      { name: 'Mark McGwire', hr: '65' },
      { name: 'Sammy Sosa',   hr: '63' },
    ]);
  });

  it('gobavi-45: mixed scalar and object in list', () => {
    expect(parse(['- DATA', '-', '  data: value'])).toEqual(['DATA', { data: 'value' }]);
  });

  it('Ansible-style root list with nested map', () => {
    expect(parse(['- hosts: webservers', '  vars:', '    http_port: 80'])).toEqual([
      { hosts: 'webservers', vars: { http_port: '80' } },
    ]);
  });

  it('list items with inline flow sequences', () => {
    expect(parse(['- tags: [a, b]', '- tags: [c, d]'])).toEqual([
      { tags: ['a', 'b'] }, { tags: ['c', 'd'] },
    ]);
  });

  it('renderSync produces SVG for root-array YAML', () => {
    const svg = renderSync('@startyaml\n- A\n- B\n- C\n@endyaml');
    expect(svg).toContain('<svg');
    expect(svg.length).toBeGreaterThan(100);
  });
});
