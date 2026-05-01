import { describe, it, expect } from 'vitest';
import { parseBoard } from '../../../src/diagrams/board/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'board' };
}

describe('parseBoard', () => {
  it('AC1: single activity creates one activity with correct name', () => {
    const ast = parseBoard(makeSource(['World']));
    expect(ast.activities.length).toBe(1);
    expect(ast.activities[0]!.name).toBe('World');
  });

  it('AC2: depth-1 and depth-2 cards nest correctly', () => {
    const ast = parseBoard(makeSource(['World', '+Europe', '++France']));
    const root = ast.activities[0]!.root;
    expect(root.children[0]!.name).toBe('Europe');
    expect(root.children[0]!.children[0]!.name).toBe('France');
  });

  it('AC3: skipping a stage — +++ under + nests directly under +', () => {
    const ast = parseBoard(makeSource(['World', '+A', '+++C']));
    const root = ast.activities[0]!.root;
    expect(root.children[0]!.name).toBe('A');
    expect(root.children[0]!.children[0]!.name).toBe('C');
  });

  it('AC4: two + cards are siblings under root', () => {
    const ast = parseBoard(makeSource(['World', '+A', '+B']));
    const root = ast.activities[0]!.root;
    expect(root.children.length).toBe(2);
    expect(root.children[0]!.name).toBe('A');
    expect(root.children[1]!.name).toBe('B');
  });

  it('AC5: blank lines are ignored', () => {
    const ast = parseBoard(makeSource(['World', '', '+Card']));
    expect(ast.activities.length).toBe(1);
    expect(ast.activities[0]!.root.children[0]!.name).toBe('Card');
  });

  it('AC6: @startboard/@endboard wrapper lines are stripped', () => {
    const ast = parseBoard(makeSource(['@startboard', 'World', '@endboard']));
    expect(ast.activities.length).toBe(1);
    expect(ast.activities[0]!.name).toBe('World');
  });

  it('AC7: two plain lines create two activities each with their own cards', () => {
    const ast = parseBoard(makeSource(['World', '+A', 'Other', '+B']));
    expect(ast.activities.length).toBe(2);
    expect(ast.activities[0]!.root.children[0]!.name).toBe('A');
    expect(ast.activities[1]!.root.children[0]!.name).toBe('B');
  });

  it('AC8: empty source returns empty activities without throwing', () => {
    const ast = parseBoard(makeSource([]));
    expect(ast.activities).toEqual([]);
  });

  it('@STARTBOARD uppercase wrapper is stripped', () => {
    const ast = parseBoard(makeSource(['@STARTBOARD', 'World', '@ENDBOARD']));
    expect(ast.activities.length).toBe(1);
  });

  it('card before any activity is silently ignored', () => {
    const ast = parseBoard(makeSource(['+OrphanCard', 'World']));
    expect(ast.activities.length).toBe(1);
    expect(ast.activities[0]!.root.children.length).toBe(0);
  });

  it('card label is trimmed of leading/trailing whitespace', () => {
    const ast = parseBoard(makeSource(['World', '+  Card  ']));
    expect(ast.activities[0]!.root.children[0]!.name).toBe('Card');
  });

  it('going back up the tree then deeper works correctly', () => {
    const ast = parseBoard(makeSource(['World', '+A', '++P', '+B']));
    const root = ast.activities[0]!.root;
    expect(root.children.length).toBe(2);
    expect(root.children[0]!.name).toBe('A');
    expect(root.children[0]!.children[0]!.name).toBe('P');
    expect(root.children[1]!.name).toBe('B');
  });

  it('activity root node has stage=0', () => {
    const ast = parseBoard(makeSource(['World']));
    expect(ast.activities[0]!.root.stage).toBe(0);
  });

  it('depth-1 card has stage=1', () => {
    const ast = parseBoard(makeSource(['World', '+Card']));
    expect(ast.activities[0]!.root.children[0]!.stage).toBe(1);
  });

  it('line of only + signs is ignored', () => {
    const ast = parseBoard(makeSource(['World', '++++']));
    expect(ast.activities[0]!.root.children.length).toBe(0);
  });

  it('depth-3 card has stage=3', () => {
    const ast = parseBoard(makeSource(['World', '+A', '++B', '+++C']));
    expect(ast.activities[0]!.root.children[0]!.children[0]!.children[0]!.stage).toBe(3);
  });

  it('two activities separated by blank line', () => {
    const ast = parseBoard(makeSource(['World', '+A', '', 'Other', '+B']));
    expect(ast.activities.length).toBe(2);
  });

  it('full fixture trace: world geography board', () => {
    const lines = [
      'World',
      '+Europe',
      '++France',
      '+++Paris',
      '+++Brest',
      '++Espagne',
      '+++Madrid',
      '+++Barcelone',
      '+++Pamplune',
      '+America',
      '+++Montreal',
    ];
    const ast = parseBoard(makeSource(lines));
    expect(ast.activities.length).toBe(1);
    const root = ast.activities[0]!.root;
    const europe = root.children[0]!;
    const america = root.children[1]!;
    expect(europe.name).toBe('Europe');
    expect(america.name).toBe('America');
    expect(europe.children[0]!.name).toBe('France');
    expect(europe.children[0]!.children.length).toBe(2);
    expect(europe.children[1]!.name).toBe('Espagne');
    expect(europe.children[1]!.children.length).toBe(3);
    expect(america.children[0]!.name).toBe('Montreal');
    expect(america.children[0]!.stage).toBe(3);
  });
});
