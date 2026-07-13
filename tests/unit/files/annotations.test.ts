/**
 * Annotation-command wiring for the files diagram parser (mission G0b/T6).
 */

import { describe, it, expect } from 'vitest';
import { parseFiles } from '../../../src/diagrams/files/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'files' };
}

describe('parseFiles — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title, not a file/folder', () => {
    const ast = parseFiles(makeSource(['@startfiles', 'title My Files', '/src/foo.ts', '@endfiles']));
    expect(ast.annotations?.title.display).toEqual(['My Files']);
    expect(ast.root.children.map((c) => c.name)).toEqual(['src']);
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not a file/folder', () => {
    const ast = parseFiles(
      makeSource(['@startfiles', '/src/foo.ts', 'legend', 'a legend line', 'end legend', '@endfiles']),
    );
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.root.children.map((c) => c.name)).toEqual(['src']);
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseFiles(makeSource(['@startfiles', '/src/foo.ts', '@endfiles']));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.root.children.map((c) => c.name)).toEqual(['src']);
  });
});
