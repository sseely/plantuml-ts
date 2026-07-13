/**
 * Annotation-command wiring for the board diagram parser (mission G0b/T6).
 */

import { describe, it, expect } from 'vitest';
import { parseBoard } from '../../../src/diagrams/board/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'board' };
}

describe('parseBoard — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title, not an activity', () => {
    const ast = parseBoard(makeSource(['title My Board', 'World']));
    expect(ast.annotations?.title.display).toEqual(['My Board']);
    expect(ast.activities.map((a) => a.name)).toEqual(['World']);
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not an activity', () => {
    const ast = parseBoard(makeSource(['World', 'legend', 'a legend line', 'end legend']));
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.activities.map((a) => a.name)).toEqual(['World']);
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseBoard(makeSource(['World', '+Europe', '++France']));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.activities.length).toBe(1);
    expect(ast.activities[0]!.root.children[0]!.name).toBe('Europe');
  });
});
