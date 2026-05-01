import { describe, expect, it } from 'vitest';
import { build, YamlLineType } from '../../../src/diagrams/yaml/yaml-line.js';

describe('build (YamlLine)', () => {
  // 1. Simple key-value pair
  it('parses "fruit: Apple" as KEY_AND_VALUE', () => {
    const line = build('fruit: Apple');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    expect(line.key).toBe('fruit');
    expect(line.value).toBe('Apple');
    expect(line.indent).toBe(0);
    expect(line.listItem).toBe(false);
  });

  // 2. List element with text value
  it('parses "  - Red" as PLAIN_ELEMENT_LIST with indent=4', () => {
    const line = build('  - Red');
    expect(line.type).toBe(YamlLineType.PLAIN_ELEMENT_LIST);
    expect(line.value).toBe('Red');
    // count starts at 2 (two leading spaces), then += 2 for "- " prefix → 4
    expect(line.indent).toBe(4);
    expect(line.listItem).toBe(true);
  });

  // 3. Plain dash (bare "-")
  it('parses "  -" as PLAIN_DASH with indent=3', () => {
    const line = build('  -');
    expect(line.type).toBe(YamlLineType.PLAIN_DASH);
    // count=2, PLAIN_DASH returns count+1=3
    expect(line.indent).toBe(3);
    expect(line.listItem).toBe(true);
    expect(line.key).toBeNull();
    expect(line.value).toBeNull();
  });

  // 4. Tab expansion
  it('expands tabs to 4 spaces and parses correctly', () => {
    const line = build('\t\tkey: val');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    // 2 tabs → 8 spaces of indent
    expect(line.indent).toBe(8);
    expect(line.key).toBe('key');
    expect(line.value).toBe('val');
  });

  // 5. Full-line comment
  it('parses "# comment" as EMPTY_LINE', () => {
    const line = build('# comment');
    expect(line.type).toBe(YamlLineType.EMPTY_LINE);
  });

  // 6. Inline comment stripped from plain text
  it('strips inline comment from "value # inline"', () => {
    const line = build('value # inline');
    expect(line.type).toBe(YamlLineType.NO_KEY_ONLY_TEXT);
    expect(line.value).toBe('value');
  });

  // 7. Inline comment stripped from key-value
  it('strips inline comment from "name: val # comment"', () => {
    const line = build('name: val # comment');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    expect(line.key).toBe('name');
    expect(line.value).toBe('val');
  });

  // 8. Comment inside double quotes is not stripped
  it('does not strip comment inside quoted value', () => {
    const line = build('name: "val # not stripped"');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    expect(line.key).toBe('name');
    expect(line.value).toBe('val # not stripped');
  });

  // 9. Flow sequence with unquoted items
  it('parses "tags: [a, b, c]" as KEY_AND_FLOW_SEQUENCE', () => {
    const line = build('tags: [a, b, c]');
    expect(line.type).toBe(YamlLineType.KEY_AND_FLOW_SEQUENCE);
    expect(line.key).toBe('tags');
    expect(line.values).toEqual(['a', 'b', 'c']);
  });

  // 10. Flow sequence with quoted items (unquoted by toList)
  it('parses \'tags: ["x", "y"]\' as KEY_AND_FLOW_SEQUENCE with unquoted values', () => {
    const line = build('tags: ["x", "y"]');
    expect(line.type).toBe(YamlLineType.KEY_AND_FLOW_SEQUENCE);
    expect(line.values).toEqual(['x', 'y']);
  });

  // 11. Block style scalar
  it('parses "key: |" as KEY_AND_BLOCK_STYLE', () => {
    const line = build('key: |');
    expect(line.type).toBe(YamlLineType.KEY_AND_BLOCK_STYLE);
    expect(line.key).toBe('key');
    expect(line.value).toBeNull();
  });

  // 12. Folded style scalar
  it('parses "key: >" as KEY_AND_FOLDED_STYLE', () => {
    const line = build('key: >');
    expect(line.type).toBe(YamlLineType.KEY_AND_FOLDED_STYLE);
    expect(line.key).toBe('key');
    expect(line.value).toBeNull();
  });

  // 13. Key with no value
  it('parses "key:" as KEY_ONLY with null value', () => {
    const line = build('key:');
    expect(line.type).toBe(YamlLineType.KEY_ONLY);
    expect(line.key).toBe('key');
    expect(line.value).toBeNull();
  });

  // 14. Value in double quotes (unquoted by build)
  it('parses \'doe: "a deer"\' and unquotes the value', () => {
    const line = build('doe: "a deer"');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    expect(line.key).toBe('doe');
    expect(line.value).toBe('a deer');
  });

  // 15. List item with key-value pair
  it('parses "  - key: value" as KEY_AND_VALUE list item with indent=4', () => {
    const line = build('  - key: value');
    expect(line.type).toBe(YamlLineType.KEY_AND_VALUE);
    expect(line.key).toBe('key');
    expect(line.value).toBe('value');
    // count=2, then +2 for "- " → 4
    expect(line.indent).toBe(4);
    expect(line.listItem).toBe(true);
  });

  // 16. Empty string
  it('parses "" as EMPTY_LINE', () => {
    const line = build('');
    expect(line.type).toBe(YamlLineType.EMPTY_LINE);
  });

  // 17. Whitespace-only string
  it('parses "  " (whitespace only) as EMPTY_LINE', () => {
    const line = build('  ');
    expect(line.type).toBe(YamlLineType.EMPTY_LINE);
  });

  // 18. PlantUML highlight directive treated as comment
  it('parses "#highlight fruit" as EMPTY_LINE', () => {
    const line = build('#highlight fruit');
    expect(line.type).toBe(YamlLineType.EMPTY_LINE);
  });

  // 19. Flow sequence: backslash escape inside a quoted item
  it('parses flow sequence with escaped character inside quotes', () => {
    const line = build('tags: ["a\\/b", "c"]');
    expect(line.type).toBe(YamlLineType.KEY_AND_FLOW_SEQUENCE);
    // \/ inside quotes → literal "/" in the parsed value
    expect(line.values).toEqual(['a/b', 'c']);
  });

  // 20. Flow sequence: backslash escape outside quotes
  it('parses flow sequence with escaped character outside quotes', () => {
    const line = build('tags: [a\\,b, c]');
    expect(line.type).toBe(YamlLineType.KEY_AND_FLOW_SEQUENCE);
    // \, outside quotes → literal "," in the token, not a separator
    expect(line.values).toEqual(['a,b', 'c']);
  });
});
