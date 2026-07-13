/**
 * Annotation-command wiring for the JSON diagram parser (mission G0b/T6).
 * `title` stays on its existing bespoke `ast.title` path, UNCHANGED — the
 * shared annotation matcher below only newly covers caption/legend/header/
 * footer/mainframe (T8 migrates title to shared chrome).
 */

import { describe, expect, it } from 'vitest';
import { parseJson } from '../../../src/diagrams/json/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';

function parse(lines: string[]) {
  return parseJson({ lines, type: 'json' as const });
}

describe('parseJson — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` still populates the bespoke ast.title field, unchanged', () => {
    const ast = parse(['title My JSON', '{"a": 1}']);
    expect(ast.title).toBe('My JSON');
    expect(ast.root).toEqual({ a: 1 });
  });

  it('single-line caption populates annotations.caption, not the JSON body', () => {
    const ast = parse(['caption a caption', '{"a": 1}']);
    expect(ast.annotations?.caption.display).toEqual(['a caption']);
    expect(ast.root).toEqual({ a: 1 });
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not the JSON body', () => {
    const ast = parse(['legend', 'a legend line', 'end legend', '{"a": 1}']);
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.root).toEqual({ a: 1 });
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parse(['{"a": 1}']);
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.root).toEqual({ a: 1 });
  });
});
