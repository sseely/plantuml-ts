/**
 * Annotation-command wiring for the YAML diagram parser (mission G0b/T6, T8).
 * `title` now routes through the shared annotation matcher along with
 * caption/legend/header/footer/mainframe (T8 migrated it off the bespoke
 * `ast.title` field onto `ast.annotations.title`, same as json — yaml
 * shares `JsonDiagramAST`/`layoutJson` with json, so json's T8 migration
 * covers yaml too).
 */

import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

describe('parseYaml — annotation commands (mission G0b/T6, T8)', () => {
  it('single-line `title X` populates annotations.title (T8), not the YAML body', () => {
    const ast = parseYaml(makeSource(['title My YAML', 'fruit: Apple']));
    expect(ast.annotations?.title.display).toEqual(['My YAML']);
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
