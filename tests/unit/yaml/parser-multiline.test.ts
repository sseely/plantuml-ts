import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function parse(lines: string[]) {
  return parseYaml(makeSource(lines)).root;
}

describe('YAML parser — multiline values', () => {
  it('block scalar | joins lines with newlines and trailing newline', () => {
    expect(parse(['text: |', '  line1', '  line2', '  line3'])).toEqual({
      text: 'line1\nline2\nline3\n',
    });
  });

  it('block scalar stops at a line with less or equal indentation', () => {
    expect(parse(['text: |', '  line1', '  line2', 'key: val'])).toEqual({
      text: 'line1\nline2\n', key: 'val',
    });
  });

  it('KEY_ONLY + NO_KEY_ONLY_TEXT continuation: lines space-joined', () => {
    expect(parse(['multiline:', '  line 1', '  line 2', '  line 3'])).toEqual({
      multiline: 'line 1 line 2 line 3',
    });
  });

  it('comment within continuation block is skipped', () => {
    expect(parse(['multiline:', '  # comment', '  actual value'])).toEqual({
      multiline: 'actual value',
    });
  });

  it('multiple comment-skips in continuation', () => {
    expect(parse(['text:', '  # comment 1', '  part 1', '  # comment 2', '  part 2'])).toEqual({
      text: 'part 1 part 2',
    });
  });

  it('KEY_ONLY where next sibling is at same level → empty string, not continuation', () => {
    expect(parse(['key:', 'other: value'])).toEqual({ key: '', other: 'value' });
  });

  it('block scalar inside list item (content at deeper indent than key)', () => {
    // '- text: |' → key indent=2 (0 + 2 for list item prefix)
    // content at 4-space indent: 4 > 2 → captured
    expect(parse(['- text: |', '    line1', '    line2'])).toEqual([
      { text: 'line1\nline2\n' },
    ]);
  });

  it('block scalar: leading whitespace trimmed from each content line', () => {
    expect(parse(['text: |', '   indented  '])).toEqual({ text: 'indented\n' });
  });
});
