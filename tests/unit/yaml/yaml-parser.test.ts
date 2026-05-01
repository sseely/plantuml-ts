import { describe, expect, it } from 'vitest';
import { parseYamlLines, YamlSyntaxError } from '../../../src/diagrams/yaml/yaml-parser.js';
import { monomorphToJson } from '../../../src/diagrams/yaml/monomorph.js';

function parse(lines: string[]) {
  return monomorphToJson(parseYamlLines(lines));
}

describe('parseYamlLines', () => {
  // 1. Simple flat key-value pairs
  it('parses flat key-value pairs at root level', () => {
    expect(parse(['fruit: Apple', 'size: Large'])).toEqual({
      fruit: 'Apple',
      size: 'Large',
    });
  });

  // 2. Nested map via KEY_ONLY + indented children
  it('parses nested map from KEY_ONLY with indented children', () => {
    expect(
      parse(['metadata:', '  name: foo', '  namespace: bar']),
    ).toEqual({ metadata: { name: 'foo', namespace: 'bar' } });
  });

  // 3. KEY_ONLY with list children
  it('parses KEY_ONLY followed by list items into a map-of-list', () => {
    expect(parse(['color:', '  - Red', '  - Green'])).toEqual({
      color: ['Red', 'Green'],
    });
  });

  // 4. List of maps (Ansible-style)
  it('parses a list of maps with nested keys', () => {
    expect(
      parse([
        '- hosts: webservers',
        '  vars:',
        '    http_port: 80',
      ]),
    ).toEqual([{ hosts: 'webservers', vars: { http_port: '80' } }]);
  });

  // 5. KEY_ONLY with no subsequent line → empty string value
  it('maps a trailing KEY_ONLY to an empty string value', () => {
    expect(parse(['key:'])).toEqual({ key: '' });
  });

  // 6. KEY_ONLY followed immediately by NO_KEY_ONLY_TEXT continuation
  it('joins KEY_ONLY continuation text as the map value', () => {
    expect(parse(['key:', '  value text'])).toEqual({ key: 'value text' });
  });

  // 7. Block scalar (|) joins lines with newlines and trailing newline
  it('parses block scalar into newline-joined string with trailing newline', () => {
    expect(parse(['text: |', '  line1', '  line2'])).toEqual({
      text: 'line1\nline2\n',
    });
  });

  // 8. KEY_ONLY with an empty line before the continuation text
  it('skips empty lines when looking ahead for continuation text', () => {
    expect(parse(['key:', '', '  value text'])).toEqual({
      key: 'value text',
    });
  });

  // 9. KEY_AND_FOLDED_STYLE (>) degrades to empty string without throwing
  it('degrades KEY_AND_FOLDED_STYLE to an empty string value', () => {
    expect(parse(['key: >'])).toEqual({ key: '' });
  });

  // 10. Plain list items (PLAIN_ELEMENT_LIST)
  it('parses a plain list of strings', () => {
    expect(parse(['- item'])).toEqual(['item']);
  });

  // 11. Multiple list-of-map entries
  it('parses multiple list-of-map entries correctly', () => {
    expect(
      parse([
        '- name: Alice',
        '  age: 30',
        '- name: Bob',
        '  age: 25',
      ]),
    ).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ]);
  });

  // 12. Flow sequence (inline [a, b, c])
  it('parses a flow sequence into an array', () => {
    expect(parse(['tags: [a, b, c]'])).toEqual({ tags: ['a', 'b', 'c'] });
  });

  // 13. PLAIN_DASH ("- " with no content) sets root type to LIST
  it('sets root to LIST type on a bare dash line', () => {
    const result = parseYamlLines(['- ']);
    expect(result.type).toBe('LIST');
  });

  // 14. Empty input → UNDETERMINATE root → null from monomorphToJson
  it('returns null for empty input', () => {
    expect(parse([])).toBeNull();
  });

  // 15. Block scalar followed by a sibling key
  it('terminates block scalar at the next sibling key', () => {
    expect(
      parse(['key: |', '  block1', '  block2', 'next: val']),
    ).toEqual({ key: 'block1\nblock2\n', next: 'val' });
  });

  // Bonus: bare text at root level throws YamlSyntaxError
  it('throws YamlSyntaxError for bare text at root level', () => {
    expect(() => parse(['unexpected text'])).toThrow(YamlSyntaxError);
  });
});
