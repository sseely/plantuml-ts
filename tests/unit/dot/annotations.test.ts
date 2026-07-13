/**
 * Annotation-command wiring for the DOT diagram parser (mission G0b/T6).
 * `title` stays on its existing bespoke `ast.title` path, UNCHANGED — the
 * shared annotation matcher below only newly covers caption/legend/header/
 * footer/mainframe (T8 migrates title to shared chrome).
 */

import { describe, it, expect } from 'vitest';
import { parseDot } from '../../../src/diagrams/dot/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';

function wrap(inner: string): string {
  return `@startdot\n${inner}\n@enddot`;
}

describe('parseDot — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` still populates the bespoke ast.title field, unchanged', () => {
    const ast = parseDot(wrap('title My Graph\ndigraph { a -> b; }'));
    expect(ast.title).toBe('My Graph');
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
