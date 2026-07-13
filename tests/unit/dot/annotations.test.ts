/**
 * Annotation-command wiring for the DOT diagram parser (mission G0b/T6, T8).
 * `title` now routes through the shared annotation matcher along with
 * caption/legend/header/footer/mainframe (T8 migrated it off the bespoke
 * `ast.title` field onto `ast.annotations.title`).
 */

import { describe, it, expect } from 'vitest';
import { parseDot } from '../../../src/diagrams/dot/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';

function wrap(inner: string): string {
  return `@startdot\n${inner}\n@enddot`;
}

describe('parseDot — annotation commands (mission G0b/T6, T8)', () => {
  it('single-line `title X` populates annotations.title (T8), not a DOT statement', () => {
    const ast = parseDot(wrap('title My Graph\ndigraph { a -> b; }'));
    expect(ast.annotations?.title.display).toEqual(['My Graph']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('multi-line `title ... end title` populates annotations.title (bonus over the old bespoke single-line-only regex)', () => {
    const ast = parseDot(wrap('title\nLine One\nLine Two\nend title\ndigraph { a -> b; }'));
    expect(ast.annotations?.title.display).toEqual(['Line One', 'Line Two']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('single-line caption populates annotations.caption, not a DOT statement', () => {
    const ast = parseDot(wrap('caption a caption\ndigraph { a -> b; }'));
    expect(ast.annotations?.caption.display).toEqual(['a caption']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not a DOT statement', () => {
    const ast = parseDot(wrap('legend\na legend line\nend legend\ndigraph { a -> b; }'));
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseDot(wrap('digraph { a -> b; }'));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});
