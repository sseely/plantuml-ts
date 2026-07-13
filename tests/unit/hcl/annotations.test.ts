/**
 * Annotation-command wiring for the HCL diagram parser (mission G0b/T6).
 * Unlike json/yaml, HCL never captured `title` into its own AST field
 * (it was silently discarded pre-T6) — routing it through the shared
 * annotation matcher here is a straight migration, not a dual-mechanism
 * conflict, so `title` participates here (unlike json/yaml/dot/chart).
 */

import { describe, it, expect } from 'vitest';
import { parseHcl } from '../../../src/diagrams/hcl/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'hcl' };
}

describe('parseHcl — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title (previously silently discarded)', () => {
    const ast = parseHcl(makeSource(['title My HCL', 'key = "value"']));
    expect(ast.annotations?.title.display).toEqual(['My HCL']);
    expect(ast.root).toEqual({ key: 'value' });
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not body content', () => {
    const ast = parseHcl(makeSource(['legend', 'a legend line', 'end legend', 'key = "value"']));
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.root).toEqual({ key: 'value' });
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseHcl(makeSource(['key = "value"']));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.root).toEqual({ key: 'value' });
  });
});
