/**
 * Annotation-command wiring for the JSON diagram parser (mission G0b/T6, T8).
 * `title` now routes through the shared annotation matcher along with
 * caption/legend/header/footer/mainframe (T8 migrated it off the bespoke
 * `ast.title` field onto `ast.annotations.title`).
 */

import { describe, expect, it } from 'vitest';
import { parseJson } from '../../../src/diagrams/json/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';

function parse(lines: string[]) {
  return parseJson({ lines, type: 'json' as const });
}

describe('parseJson — annotation commands (mission G0b/T6, T8)', () => {
  it('single-line `title X` populates annotations.title (T8), not the JSON body', () => {
    const ast = parse(['title My JSON', '{"a": 1}']);
    expect(ast.annotations?.title.display).toEqual(['My JSON']);
    expect(ast.root).toEqual({ a: 1 });
  });

  it('multi-line `title ... end title` populates annotations.title (bonus over the old bespoke single-line-only regex)', () => {
    const ast = parse(['title', 'Line One', 'Line Two', 'end title', '{"a": 1}']);
    expect(ast.annotations?.title.display).toEqual(['Line One', 'Line Two']);
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
