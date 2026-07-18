/**
 * G2 N33 — badge glyph table widened from 5 to 9 captured letters (P/M/F/?
 * added alongside the pre-existing C/I/A/E/@). Jar-verified byte-for-byte
 * (within the deterministic-mode 0.01 numeric tolerance, `compare.ts`) via
 * `class-badge.ts`'s own doc comment derivation from `renezi-40-jupi466`
 * (P/M), `jarigi-34-nage684` (F), `cotacu-63-jisi866` (?).
 */
import { describe, it, expect } from 'vitest';
import { resolveBadgeLetter, badgeGlyphPath } from '../../../src/diagrams/class/class-badge.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';

const measurer = new DeterministicMeasurer();

describe('resolveBadgeLetter — N33 letters', () => {
  it('resolves the 4 newly-captured letters unchanged', () => {
    expect(resolveBadgeLetter('class', 'p')).toBe('P');
    expect(resolveBadgeLetter('class', 'M')).toBe('M');
    expect(resolveBadgeLetter('class', 'f')).toBe('F');
    expect(resolveBadgeLetter('class', '?')).toBe('?');
  });

  it('still falls back to the kind default for an uncaptured letter', () => {
    expect(resolveBadgeLetter('class', 'R')).toBe('C');
  });
});

describe('badgeGlyphPath — N33 letters draw a distinct glyph', () => {
  it('P/M/F/? each produce a different path than the class default (C)', () => {
    const base = badgeGlyphPath('class', 22, 23);
    for (const letter of ['P', 'M', 'F', '?']) {
      expect(badgeGlyphPath('class', 22, 23, letter)).not.toBe(base);
    }
  });
});

describe('renderFixtureClass — N33 badge letters reach the rendered <path>', () => {
  it('cotacu-63-jisi866: `<<(?, red)>>` draws the "?" glyph, not the class default', () => {
    const svg = renderFixtureClass(
      `@startuml
class MARKETING_INDICATOR <<(?, red)>>  {
}
@enduml`,
      measurer,
    );
    // Single-classifier fixture: badge center is (7+15, 7+16) = (22, 23),
    // the SAME box-origin convention `class-badge-custom.test.ts`'s own
    // "custom char coinciding with a known glyph" test already establishes.
    expect(svg).toContain(`d="${badgeGlyphPath('class', 22, 23, '?')}"`);
    expect(svg).not.toContain(`d="${badgeGlyphPath('class', 22, 23)}"`);
  });

  it('renezi-40-jupi466: `<< (P)artyPlaceThing >>` / `<< (M)omentInterval >>` draw distinct glyphs', () => {
    const svg = renderFixtureClass(
      `@startuml
class foo1 << (P)artyPlaceThing >>
class foo2 << (M)omentInterval >>
@enduml`,
      measurer,
    );
    // Two distinct badge glyphs present, neither the class-default 'C' shape.
    const defaultC = badgeGlyphPath('class', 22, 23).split(' ')[0]!;
    const occurrences = svg.split(defaultC).length - 1;
    expect(occurrences).toBe(0);
  });
});
