import { describe, it, expect } from 'vitest';
import {
  isEnhancedBody,
  splitEnhancedBlocks,
} from '../../../src/diagrams/class/class-body-enhanced.js';

// ---------------------------------------------------------------------------
// isEnhancedBody — trigger detection
// ---------------------------------------------------------------------------

describe('isEnhancedBody', () => {
  it('is false for undefined (no rawBodyLines captured)', () => {
    expect(isEnhancedBody(undefined)).toBe(false);
  });

  it('is false for a plain member body with no separator/tree', () => {
    expect(isEnhancedBody(['+field: int', 'method()'])).toBe(false);
  });

  it('is true when any line is a bare `--` block separator', () => {
    expect(isEnhancedBody(['field', '--', 'method()'])).toBe(true);
  });

  it('is true when any line is a labeled `-- Label --` block separator', () => {
    expect(isEnhancedBody(['-- Label --', 'field'])).toBe(true);
  });

  it('is true for `==`/`__` separator variants', () => {
    expect(isEnhancedBody(['==', 'x'])).toBe(true);
    expect(isEnhancedBody(['__', 'x'])).toBe(true);
  });

  it('is true for a `..` separator but not for a bare `...`', () => {
    expect(isEnhancedBody(['..', 'x'])).toBe(true);
    expect(isEnhancedBody(['...'])).toBe(false);
  });

  it('is true when any line is a `|_` tree-start line (indented ok)', () => {
    expect(isEnhancedBody(['  |_ child'])).toBe(true);
  });

  it('is false for a `**bold**` member line (same-char guard, not a separator)', () => {
    expect(isEnhancedBody(['**Bar(Model)**'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// splitEnhancedBlocks — block structure
// ---------------------------------------------------------------------------

describe('splitEnhancedBlocks', () => {
  it('produces a single leading empty rows block (sep=_) for a body with no lines', () => {
    expect(splitEnhancedBlocks([])).toEqual([{ kind: 'rows', separator: { char: '_' }, lines: [] }]);
  });

  it('a plain member body (no separator/tree) is one rows block, initial sep', () => {
    expect(splitEnhancedBlocks(['a', 'b'])).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: ['a', 'b'] },
    ]);
  });

  it('a bare separator splits into a leading block and a trailing sep=char block', () => {
    expect(splitEnhancedBlocks(['coco', '--', 'toto'])).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: ['coco'] },
      { kind: 'rows', separator: { char: '-' }, lines: ['toto'] },
    ]);
  });

  it('a labeled separator captures its title, trimmed', () => {
    expect(splitEnhancedBlocks(['-- A1 --', 'coco'])).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: [] },
      { kind: 'rows', separator: { char: '-', title: 'A1' }, lines: ['coco'] },
    ]);
  });

  it('a bare 2-char separator ("--") carries no title (getTitle early return)', () => {
    const blocks = splitEnhancedBlocks(['--']);
    expect(blocks[1]).toEqual({ kind: 'rows', separator: { char: '-' }, lines: [] });
  });

  it('a contiguous |_ run becomes one tree block with level/text per cell', () => {
    const blocks = splitEnhancedBlocks(['|_ A1', '|_ b()', '  |_ b1', '  |_ b2', '    |_ b2.1', '|_ c()']);
    expect(blocks).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: [] },
      {
        kind: 'tree',
        cells: [
          { level: 1, text: 'A1' },
          { level: 1, text: 'b()' },
          { level: 2, text: 'b1' },
          { level: 2, text: 'b2' },
          { level: 3, text: 'b2.1' },
          { level: 1, text: 'c()' },
        ],
      },
      { kind: 'rows', lines: [] },
    ]);
  });

  it('purges the first tree line\'s own leading-indent prefix from every consumed line', () => {
    const blocks = splitEnhancedBlocks(['        |_ Tree item 11', '        |_ Tree item 12']);
    expect(blocks[1]).toEqual({
      kind: 'tree',
      cells: [
        { level: 1, text: 'Tree item 11' },
        { level: 1, text: 'Tree item 12' },
      ],
    });
  });

  it('computes tab-indent tree levels (StripeTree#computeLevel\'s tab branch)', () => {
    const blocks = splitEnhancedBlocks(['|_ a', '\t|_ b']);
    expect(blocks[1]).toEqual({
      kind: 'tree',
      cells: [
        { level: 1, text: 'a' },
        { level: 2, text: 'b' },
      ],
    });
  });

  it('a normal (non-tree) line after a tree run starts a new rows block, sep undefined', () => {
    const blocks = splitEnhancedBlocks(['|_ a', 'after']);
    expect(blocks).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: [] },
      { kind: 'tree', cells: [{ level: 1, text: 'a' }] },
      { kind: 'rows', lines: ['after'] },
    ]);
  });

  it('fecolo-08-gepu579\'s exact shape: labeled separator, one field, then a tree', () => {
    const blocks = splitEnhancedBlocks([
      '-- A1 --', 'coco', '|_ A1', '|_ b()', '  |_ b1', '  |_ b2', '    |_ b2.1', '|_ c()',
    ]);
    expect(blocks).toEqual([
      { kind: 'rows', separator: { char: '_' }, lines: [] },
      { kind: 'rows', separator: { char: '-', title: 'A1' }, lines: ['coco'] },
      {
        kind: 'tree',
        cells: [
          { level: 1, text: 'A1' },
          { level: 1, text: 'b()' },
          { level: 2, text: 'b1' },
          { level: 2, text: 'b2' },
          { level: 3, text: 'b2.1' },
          { level: 1, text: 'c()' },
        ],
      },
      { kind: 'rows', lines: [] },
    ]);
  });
});
