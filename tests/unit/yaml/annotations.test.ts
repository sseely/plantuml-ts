/**
 * Annotation-command wiring for the YAML diagram parser (mission G0b/T6).
 * `title` stays on its existing bespoke `ast.title` path, UNCHANGED — the
 * shared annotation matcher below only newly covers caption/legend/header/
 * footer/mainframe, per the T6 spec (yaml shares `JsonDiagramAST` with
 * json, whose bespoke title rendering must not silently stop working this
 * batch).
 */

import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

describe('parseYaml — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` still populates the bespoke ast.title field, unchanged', () => {
    const ast = parseYaml(makeSource(['title My YAML', 'fruit: Apple']));
    expect(ast.title).toBe('My YAML');
    expect(ast.root).toEqual({ fruit: 'Apple' });
  });

  it('single-line caption populates annotations.caption, not the YAML body', () => {
    const ast = parseYaml(makeSource(['caption a caption', 'fruit: Apple']));
    expect(ast.annotations?.caption.display).toEqual(['a caption']);
    expect(ast.root).toEqual({ fruit: 'Apple' });
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not the YAML body', () => {
    const ast = parseYaml(makeSource(['legend', 'a legend line', 'end legend', 'fruit: Apple']));
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.root).toEqual({ fruit: 'Apple' });
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseYaml(makeSource(['fruit: Apple']));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.root).toEqual({ fruit: 'Apple' });
  });
});
