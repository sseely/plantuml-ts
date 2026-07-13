/**
 * Annotation-command wiring for the descriptive-diagram parser (mission
 * G0b/T6): title/caption/legend/header/footer land in `ast.annotations`
 * instead of leaking into entities or being silently dropped.
 */

import { describe, it, expect } from 'vitest';
import { parseDescription } from '../../../src/diagrams/description/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { DescriptionDiagramAST } from '../../../src/diagrams/description/ast.js';

function parse(source: string): DescriptionDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'description' };
  return parseDescription(block);
}

describe('description parser — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title, not an entity', () => {
    const ast = parse('title My Diagram\ncomponent A');
    expect(ast.annotations?.title.display).toEqual(['My Diagram']);
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.id).toBe('A');
  });

  it('multi-line `legend ... end legend` populates annotations.legend with no entity leakage', () => {
    const ast = parse('component A\nlegend\nfoo bar\nend legend\ncomponent B');
    expect(ast.annotations?.legend.display).toEqual(['foo bar']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
  });

  it('title + legend + component/usecase fixture: annotations populated, no leakage into entities', () => {
    const ast = parse(
      [
        'title Component Overview',
        'component [Comp1] as C1',
        'usecase (Use Case A) as UC1',
        'C1 --> UC1',
        'legend right',
        'Legend text here',
        'end legend',
      ].join('\n'),
    );
    expect(ast.annotations?.title.display).toEqual(['Component Overview']);
    expect(ast.annotations?.legend.display).toEqual(['Legend text here']);
    expect(ast.nodes.map((n) => n.id)).toEqual(['C1', 'UC1']);
    expect(ast.links).toHaveLength(1);
  });

  it('single-line caption populates annotations.caption', () => {
    const ast = parse('caption a small caption\ncomponent A');
    expect(ast.annotations?.caption.display).toEqual(['a small caption']);
  });

  it('single-line header/footer populate annotations.header/footer', () => {
    const ast = parse('header a header\nfooter a footer\ncomponent A');
    expect(ast.annotations?.header.display).toEqual(['a header']);
    expect(ast.annotations?.footer.display).toEqual(['a footer']);
  });

  it('a `title`-shaped line inside a note body is kept as note text, not stolen', () => {
    const ast = parse('note as tott\ntitle not a title\nend note');
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]!.symbol).toBe('note');
    expect(ast.nodes[0]!.display).toBe('title not a title');
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parse('component A\ncomponent B\nA --> B');
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    expect(ast.links).toHaveLength(1);
  });
});
