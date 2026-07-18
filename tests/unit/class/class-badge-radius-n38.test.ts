/**
 * G2 N38 — badge radius formula (`skinparam circledCharacterFontSize`/
 * `circledCharacterRadius`) + per-font-size 'C' glyph captures.
 *
 * Formula source: `SkinParam#getCircledCharacterRadius()`
 * (`skin/SkinParam.java:542-545`):
 * ```java
 * public int getCircledCharacterRadius() {
 *   final int value = getAsInt("circledCharacterRadius", -1);
 *   return value == -1 ? getFontSize(null, FontParam.CIRCLED_CHARACTER) / 3 + 6 : value;
 * }
 * ```
 * Jar-verified byte-exact against 12/12 class-corpus samples spanning
 * `circledCharacterFontSize` 13-30 and both the formula and explicit-
 * override paths — see `class-badge.ts#resolveBadgeRadius`'s own doc
 * comment and `plans/g2-class-svg/ledger.md` N38 for the full derivation.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveBadgeRadius,
  badgeBoxWidth,
  badgeBoxHeight,
  badgeGlyphPath,
  BADGE_RADIUS,
  DEFAULT_CIRCLED_CHARACTER_FONT_SIZE,
} from '../../../src/diagrams/class/class-badge.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureClass } from '../../oracle/svg-conformance/render-fixture-class.js';

const measurer = new DeterministicMeasurer();

describe('resolveBadgeRadius', () => {
  it('defaults to 11 (the pre-existing BADGE_RADIUS constant) with no args', () => {
    expect(resolveBadgeRadius()).toBe(BADGE_RADIUS);
    expect(resolveBadgeRadius(undefined, undefined)).toBe(11);
  });

  it('DEFAULT_CIRCLED_CHARACTER_FONT_SIZE (17) reduces to the default radius', () => {
    expect(resolveBadgeRadius(DEFAULT_CIRCLED_CHARACTER_FONT_SIZE)).toBe(11);
  });

  // jar-verified samples (munepa/macira/mudune/pafare/defipi/pucebe/
  // fipezi/zijaso/koloba) -- floor(fontSize/3)+6.
  it.each([
    [13, 10], [14, 10], [15, 11], [16, 11], [18, 12], [19, 12], [20, 12], [21, 13], [22, 13],
  ])('fontSize %d -> radius %d', (fontSize, radius) => {
    expect(resolveBadgeRadius(fontSize)).toBe(radius);
  });

  it('an explicit circledCharacterRadius override wins unconditionally, ' +
    'even when the formula would predict a different value', () => {
    // depulu-53-xoca727: fontSize 20 (formula predicts 12), radius 13.
    expect(resolveBadgeRadius(20, 13)).toBe(13);
    // gateja-70-losi738: fontSize 30 (formula predicts 16), radius 18.
    expect(resolveBadgeRadius(30, 18)).toBe(18);
  });

  it('an explicit override with NO fontSize set also wins', () => {
    expect(resolveBadgeRadius(undefined, 9)).toBe(9);
  });
});

describe('badgeBoxWidth / badgeBoxHeight', () => {
  it('reduce to BADGE_BOX_WIDTH/HEIGHT-equivalent values at the default radius', () => {
    expect(badgeBoxWidth(11)).toBe(11 * 2 + 4); // BADGE_LEFT_MARGIN = 4
    expect(badgeBoxHeight(11)).toBe(11 * 2 + 5 * 2); // BADGE_TOP_BOTTOM_MARGIN = 5
  });

  it('scale linearly with an arbitrary radius', () => {
    expect(badgeBoxWidth(13)).toBe(13 * 2 + 4);
    expect(badgeBoxHeight(13)).toBe(13 * 2 + 10);
  });
});

describe('badgeGlyphPath — per-fontSize glyph capture (G2 N38)', () => {
  it('an untouched call (no 5th arg) is unchanged from the size-17 default', () => {
    expect(badgeGlyphPath('class', 22, 23)).toBe(badgeGlyphPath('class', 22, 23, undefined, undefined));
  });

  it('circledCharacterFontSize 17 (the default) falls through to the SAME shape', () => {
    expect(badgeGlyphPath('class', 22, 23, undefined, 17)).toBe(badgeGlyphPath('class', 22, 23));
  });

  it('a captured non-default size produces a DIFFERENT path than the default', () => {
    expect(badgeGlyphPath('class', 23, 24, undefined, 18)).not.toBe(badgeGlyphPath('class', 23, 24));
  });

  it('an uncaptured size (e.g. 25) falls back to the default-size shape, translated', () => {
    expect(badgeGlyphPath('class', 22, 23, undefined, 25)).toBe(badgeGlyphPath('class', 22, 23));
  });

  it('a non-C letter at a captured size falls back to that letter\'s default shape ' +
    '(only C is captured per-size)', () => {
    expect(badgeGlyphPath('interface', 22, 23, undefined, 18)).toBe(badgeGlyphPath('interface', 22, 23));
  });
});

describe('renderFixtureClass — N38 badge radius/glyph reach fixtures zero-diff', () => {
  it('defipi-14-xunu847 (circledCharacterFontSize 18): badge ellipse rx=12', () => {
    const svg = renderFixtureClass(
      `@startuml
skinparam CircledCharacterFontSize 18
class Toto
@enduml`,
      measurer,
    );
    expect(svg).toContain('rx="12" ry="12"');
  });

  it('an explicit circledCharacterRadius override reaches the rendered ellipse', () => {
    const svg = renderFixtureClass(
      `@startuml
skinparam CircledCharacterRadius 9
class Toto
@enduml`,
      measurer,
    );
    expect(svg).toContain('rx="9" ry="9"');
  });
});
