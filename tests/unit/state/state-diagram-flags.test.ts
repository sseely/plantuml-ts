/**
 * Feature family: diagram-level flags — `hide|show empty description`
 * (CommandHideEmptyDescription) and `left to right direction` /
 * `top to bottom direction` (CommandRankDir). T2 gap: both were previously
 * silently swallowed by the generic ignore rule with no AST representation.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

describe('hide/show empty description', () => {
  it('hide empty description sets hideEmptyDescription=true', () => {
    const ast = parse('hide empty description');
    expect(ast.hideEmptyDescription).toBe(true);
  });

  it('show empty description sets hideEmptyDescription=false', () => {
    const ast = parse('show empty description');
    expect(ast.hideEmptyDescription).toBe(false);
  });

  it('a later show empty description overrides an earlier hide', () => {
    const ast = parse('hide empty description\nshow empty description');
    expect(ast.hideEmptyDescription).toBe(false);
  });

  it('does not set the flag when absent from the source', () => {
    const ast = parse('A --> B');
    expect(ast.hideEmptyDescription).toBeUndefined();
  });

  it('generic "hide <element>" (not "empty description") is still ignored, not treated as the flag', () => {
    const ast = parse('hide <<foo>>\nA --> B');
    expect(ast.hideEmptyDescription).toBeUndefined();
    expect(ast.transitions).toHaveLength(1);
  });
});

describe('rankdir direction', () => {
  it('left to right direction sets rankdir=left-to-right', () => {
    const ast = parse('left to right direction');
    expect(ast.rankdir).toBe('left-to-right');
  });

  it('top to bottom direction sets rankdir=top-to-bottom', () => {
    const ast = parse('top to bottom direction');
    expect(ast.rankdir).toBe('top-to-bottom');
  });

  it('does not set rankdir when absent from the source', () => {
    const ast = parse('A --> B');
    expect(ast.rankdir).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const ast = parse('LEFT TO RIGHT DIRECTION');
    expect(ast.rankdir).toBe('left-to-right');
  });
});
