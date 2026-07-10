import { describe, it, expect } from 'vitest';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';

/**
 * Locks in the jar-golden verification numbers captured for this task
 * (`measurer-deterministic.ts`'s doc comment table) — real output from
 * `java -DPLANTUML_DETERMINISTIC_TEXT=true -jar plantuml-1.2026.7beta3.jar
 * -tsvg -pipe` (openjdk 21.0.1), read off each `<text>` element's
 * `textLength` attribute. `DeterministicMeasurer` is a re-export of
 * `WidthTableMeasurer` (see that module's own test file for full
 * per-glyph/table coverage) — this file's job is only to pin the exact
 * jar-observed values under the stable `DeterministicMeasurer` name.
 */
describe('DeterministicMeasurer — jar-golden verification (2026-07-10)', () => {
  const m = new DeterministicMeasurer();
  const font = { family: 'sans-serif', size: 14 };

  it.each<[string, number]>([
    ['Component', 72.3625],
    ['comp1', 42],
    ['A', 9.3625],
  ])('%s at size 14 matches jar textLength %f', (text, jarTextLength) => {
    expect(m.measure(text, font).width).toBeCloseTo(jarTextLength, 6);
  });

  it('astral codepoint (U+1F600) matches jar textLength 14 — getCharWidth fallback, not /10', () => {
    expect(m.measure('\u{1F600}', font).width).toBeCloseTo(14, 6);
  });

  it('block-255-overflow codepoint (U+FF21, fullwidth A) matches jar textLength 11.375', () => {
    expect(m.measure('Ａ', font).width).toBeCloseTo(11.375, 6);
  });

  it('height equals font size (SVG_DETERMINISTIC formula: height = size)', () => {
    expect(m.measure('Component', font).height).toBe(14);
  });
});
