import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — list items', () => {
  it('sudabi-56: simple scalar list under a key', () => {
    expect(parse(['fruit: Apple', 'size: Large', 'color:', ' - Red', ' - Green'])).toEqual({
      fruit: 'Apple', size: 'Large', color: ['Red', 'Green'],
    });
  });

  it('gatuva-87: list of objects', () => {
    expect(parse([
      '  - name: Mark McGwire', '    hr:   65', '    avg:  0.278',
      '  - name: Sammy Sosa',   '    hr:   63', '    avg:  0.288',
    ])).toEqual([
      { name: 'Mark McGwire', hr: '65', avg: '0.278' },
      { name: 'Sammy Sosa',   hr: '63', avg: '0.288' },
    ]);
  });

  it('gobavi-45: plain dash then object', () => {
    expect(parse(['- DATA', '-', '  data: value'])).toEqual(['DATA', { data: 'value' }]);
  });

  it('finofu-94: root-level scalar list', () => {
    expect(parse(['- A', '- B', '- C'])).toEqual(['A', 'B', 'C']);
  });

  it('Ansible-style: list with nested map and deeper nesting', () => {
    expect(parse([
      '- hosts: webservers',
      '  vars:',
      '    http_port: 80',
      '    max_clients: 200',
    ])).toEqual([{ hosts: 'webservers', vars: { http_port: '80', max_clients: '200' } }]);
  });

  it('nested list inside map', () => {
    expect(parse(['parent:', '  children:', '    - alpha', '    - beta'])).toEqual({
      parent: { children: ['alpha', 'beta'] },
    });
  });

  it('polela-38 style: plain dash then map', () => {
    expect(parse(['  -', '    name: Mark McGwire', '    hr:   65'])).toEqual([
      { name: 'Mark McGwire', hr: '65' },
    ]);
  });
});
