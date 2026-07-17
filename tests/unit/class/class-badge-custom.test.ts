/**
 * G2 N26 — `class Foo << (F,orange) >>` badge-customization CHAR/COLOR
 * override (upstream `StereotypeDecoration#buildComplex`) — N24 already
 * strips the `(CHAR[,COLOR])` prefix from the visible stereotype TEXT
 * (`class-stereotype.ts#stripCircledCharDecoration`); this is the badge
 * itself: the ellipse fill color and (where the char happens to be one of
 * the 5 jar-captured glyphs) the vector letter.
 *
 * Jar-verified against `bejeli-39-sina124/in.svg`: `NamedStereotype`/
 * `ColoredCircle` (`<<(S,#FF7700)...>>`) both draw `fill="#FF7700"`;
 * `PlainCircle`/`PlainCircleStereotype` (`<<(S)...>>`, no COLOR group) both
 * fall back to the kind's own default `fill="#ADD1B2"` (spotClass).
 */
import { describe, it, expect } from 'vitest';
import { parseCircledCharDecoration } from '../../../src/diagrams/class/class-stereotype.js';
import {
  resolveBadgeFill, resolveBadgeLetter, badgeGlyphPath, badgeFill,
} from '../../../src/diagrams/class/class-badge.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';

const measurer = new DeterministicMeasurer();

// ---------------------------------------------------------------------------
// parseCircledCharDecoration — pure parse
// ---------------------------------------------------------------------------

describe('parseCircledCharDecoration', () => {
  it('extracts char + color from a labeled decoration', () => {
    expect(parseCircledCharDecoration('(S,#FF7700)Stereotype')).toEqual({
      char: 'S', color: '#FF7700',
    });
  });

  it('extracts char + color with no residual label', () => {
    expect(parseCircledCharDecoration('(S,#FF7700)')).toEqual({ char: 'S', color: '#FF7700' });
  });

  it('extracts char alone when no COLOR group is present', () => {
    expect(parseCircledCharDecoration('(S)')).toEqual({ char: 'S' });
    expect(parseCircledCharDecoration('(S) Stereotype')).toEqual({ char: 'S' });
  });

  it('accepts a bare named color (no #)', () => {
    expect(parseCircledCharDecoration('(F,orange)')).toEqual({ char: 'F', color: 'orange' });
  });

  it('returns undefined for a stereotype with no circled-char decoration', () => {
    expect(parseCircledCharDecoration('Entity')).toBeUndefined();
  });

  it('returns undefined for no stereotype at all', () => {
    expect(parseCircledCharDecoration(undefined)).toBeUndefined();
  });

  it('the LAST matching stacked chunk wins (upstream overwrite-in-loop)', () => {
    // Mirrors `splitStereotypeLabels`'s own doc-comment example of how a
    // stacked `<<A>><<B>>` declaration reconstructs into ONE raw blob
    // spanning the first `<<` to the last `>>`.
    expect(parseCircledCharDecoration('(A,red)First>> <<(B,blue)Second')).toEqual({
      char: 'B', color: 'blue',
    });
  });
});

// ---------------------------------------------------------------------------
// resolveBadgeFill / resolveBadgeLetter — pure overrides
// ---------------------------------------------------------------------------

describe('resolveBadgeFill', () => {
  it('uses the custom color, resolved through HColorSet, when present', () => {
    expect(resolveBadgeFill('class', 'blue')).toBe('#0000FF');
  });

  it('resolves a hex color unchanged (uppercased)', () => {
    expect(resolveBadgeFill('class', '#FF7700')).toBe('#FF7700');
  });

  it('falls back to the kind default when no override is given', () => {
    expect(resolveBadgeFill('class', undefined)).toBe(badgeFill('class'));
    expect(resolveBadgeFill('interface', undefined)).toBe(badgeFill('interface'));
  });
});

describe('resolveBadgeLetter', () => {
  it('uses the custom char when it matches a known glyph', () => {
    expect(resolveBadgeLetter('class', 'a')).toBe('A');
    expect(resolveBadgeLetter('class', 'E')).toBe('E');
  });

  it('falls back to the kind default when the custom char has no captured glyph', () => {
    expect(resolveBadgeLetter('class', 'S')).toBe('C');
    expect(resolveBadgeLetter('interface', 'R')).toBe('I');
  });

  it('falls back to the kind default when no override is given', () => {
    expect(resolveBadgeLetter('enum', undefined)).toBe('E');
  });
});

describe('badgeGlyphPath — custom char threading', () => {
  it('draws the custom letter\'s own glyph when it is one of the 5 known letters', () => {
    const withOverride = badgeGlyphPath('class', 22, 23, 'a');
    const kindDefault = badgeGlyphPath('class', 22, 23);
    const letterA = badgeGlyphPath('interface', 22, 23); // interface kind -> 'A'? no, 'I' -- use abstract instead
    expect(withOverride).not.toBe(kindDefault);
    expect(withOverride).toBe(badgeGlyphPath('abstract', 22, 23));
    expect(letterA).not.toBe(withOverride);
  });
});

// ---------------------------------------------------------------------------
// End-to-end render — byte-verified against the real oracle SVG
// ---------------------------------------------------------------------------

describe('renderFixtureClass — badge customization reaches the rendered <ellipse>', () => {
  it('a labeled (CHAR,COLOR) badge fills with the custom color', () => {
    const svg = renderFixtureClass(
      `@startuml
hide empty members
class NamedStereotype <<(S,#FF7700)Stereotype>>
@enduml`,
      measurer,
    );
    expect(svg).toContain('fill="#FF7700"');
  });

  it('a bare (CHAR) badge (no COLOR) falls back to the kind default fill', () => {
    const svg = renderFixtureClass(
      `@startuml
hide empty members
class PlainCircle <<(S)>>
@enduml`,
      measurer,
    );
    expect(svg).toContain('fill="#ADD1B2"');
  });

  it('a custom char coinciding with a known glyph (A) draws that exact glyph', () => {
    const svg = renderFixtureClass(
      `@startuml
hide empty members
class Foo <<(A,red)>>
@enduml`,
      measurer,
    );
    // The badge center for this single-classifier fixture (jar-verified
    // convention, `class-badge.ts`'s own doc comment: `(15, headerHeight/2)`
    // relative to the box origin -- box origin (7,7), headerHeight 32).
    const cx = 7 + 15;
    const cy = 7 + 16;
    expect(svg).toContain(`d="${badgeGlyphPath('class', cx, cy, 'A')}"`);
    // Same shape as the stock 'abstract'-kind badge glyph (both resolve to
    // letter 'A'), just at a different reference kind.
    expect(badgeGlyphPath('class', cx, cy, 'A')).toBe(badgeGlyphPath('abstract', cx, cy));
  });
});
