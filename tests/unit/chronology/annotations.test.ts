/**
 * Annotation-command wiring for the chronology diagram parser (mission
 * G0b/T6).
 */

import { describe, it, expect } from 'vitest';
import { parseChronology } from '../../../src/diagrams/chronology/parser.js';
import { isEmpty } from '../../../src/core/annotations/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'unknown' };
}

describe('parseChronology — annotation commands (mission G0b/T6)', () => {
  it('single-line `title X` populates annotations.title, not an event', () => {
    const ast = parseChronology(
      makeSource(['title My Timeline', '[Event1] happens at 2023-11-24 10:11:50.750']),
    );
    expect(ast.annotations?.title.display).toEqual(['My Timeline']);
    expect(ast.events.length).toBe(1);
    expect(ast.events[0]!.name).toBe('Event1');
  });

  it('multi-line `legend ... end legend` populates annotations.legend, not an event', () => {
    const ast = parseChronology(
      makeSource(['[Event1] happens at 2023-11-24 10:11:50.750', 'legend', 'a legend line', 'end legend']),
    );
    expect(ast.annotations?.legend.display).toEqual(['a legend line']);
    expect(ast.events.length).toBe(1);
  });

  it('annotation-free fixture parses identically (no chrome, empty annotations)', () => {
    const ast = parseChronology(makeSource(['[Event1] happens at 2023-11-24 10:11:50.750']));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.events.length).toBe(1);
  });
});
