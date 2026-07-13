/**
 * Annotation-command wiring for the activity-diagram parser (mission
 * G0b/T6): title/caption/legend/header/footer land in `ast.annotations`
 * instead of being silently dropped by the unknown-line fallback.
 */

import { describe, it, expect } from 'vitest';
import { parseActivity } from '../../../src/diagrams/activity/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ActivityDiagramAST } from '../../../src/diagrams/activity/ast.js';

function parse(lines: readonly string[]): ActivityDiagramAST {
  const block: UmlSource = { lines, type: 'activity' };
  return parseActivity(block);
}

describe('activity parser — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title, not a node', () => {
    const ast = parse(['title My Activity', 'start', ':Step one;', 'stop']);
    expect(ast.annotations?.title.display).toEqual(['My Activity']);
    expect(ast.nodes.map((n) => n.kind)).toEqual(['start', 'action', 'stop']);
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not a node', () => {
    const ast = parse(['start', 'legend', 'a legend line', 'end legend', 'stop']);
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.nodes.map((n) => n.kind)).toEqual(['start', 'stop']);
  });

  it('single-line caption/header/footer populate annotations', () => {
    const ast = parse(['caption a caption', 'header a header', 'footer a footer', 'start', 'stop']);
    expect(ast.annotations?.caption.display).toEqual(['a caption']);
    expect(ast.annotations?.header.display).toEqual(['a header']);
    expect(ast.annotations?.footer.display).toEqual(['a footer']);
    expect(ast.nodes.map((n) => n.kind)).toEqual(['start', 'stop']);
  });

  it('a `title`-shaped line inside a note body is kept as note text, not stolen', () => {
    const ast = parse(['note left', 'title not a title', 'end note']);
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.nodes).toHaveLength(1);
    expect(ast.nodes[0]).toEqual({ kind: 'note', text: 'title not a title', position: 'left' });
  });

  it('title/legend inside an if/while/repeat body still land in annotations, not the branch', () => {
    const ast = parse([
      'start',
      'if (cond?) then (yes)',
      'title from inside if',
      ':do something;',
      'endif',
      'stop',
    ]);
    expect(ast.annotations?.title.display).toEqual(['from inside if']);
    const ifNode = ast.nodes.find((n) => n.kind === 'if');
    expect(ifNode?.kind).toBe('if');
    if (ifNode?.kind === 'if') {
      expect(ifNode.thenBranch.map((n) => n.kind)).toEqual(['action']);
    }
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parse(['start', ':Step one;', 'if (cond?) then (yes)', ':a;', 'else (no)', ':b;', 'endif', 'stop']);
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.nodes.map((n) => n.kind)).toEqual(['start', 'action', 'if', 'stop']);
  });
});
