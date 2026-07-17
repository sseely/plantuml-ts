import { describe, it, expect } from 'vitest';
import {
  badgeFill,
  hasBadge,
  resolveBadgeFill,
  resolveBadgeBorder,
  resolveBadgeGlyphColor,
  spotSnameForKind,
} from '../../../src/diagrams/class/class-badge.js';
import type { ClassifierKind } from '../../../src/diagrams/class/ast.js';

// ---------------------------------------------------------------------------
// G2 N4: badgeFill's per-kind spot colors -- jar-verified against
// ~/git/plantuml/src/main/resources/skin/plantuml.skin's `spot { ... }`
// block (the SAME style-signature lookup `EntityImageClassHeader.java#
// getCircledCharacter` reads: `spotClass`/`spotInterface`/`spotEnum`/
// `spotAbstractClass`/`spotAnnotation`). The PREVIOUS constants (`#4472B8`/
// `#7B5EA7`/`#3A8FA8`/`#4DA34D`/`#888888`) matched none of the 146+
// `fill="#ADD1B2"` (class) badge occurrences observed across the fresh
// 2026-07-16 oracle re-capture (`test-results/dot-cache/class/`) -- a
// universal, every-classifier, every-fixture divergence (`plans/g2-class-
// svg/ledger.md` N4).
// ---------------------------------------------------------------------------

describe('badgeFill', () => {
  it('returns #ADD1B2 (spotClass) for class kind', () => {
    expect(badgeFill('class')).toBe('#ADD1B2');
  });

  it('returns #A9DCDF (spotAbstractClass) for abstract kind', () => {
    expect(badgeFill('abstract')).toBe('#A9DCDF');
  });

  it('returns #B4A7E5 (spotInterface) for interface kind', () => {
    expect(badgeFill('interface')).toBe('#B4A7E5');
  });

  it('returns #EB937F (spotEnum) for enum kind', () => {
    expect(badgeFill('enum')).toBe('#EB937F');
  });

  it('returns #E3664A (spotAnnotation) for annotation kind', () => {
    expect(badgeFill('annotation')).toBe('#E3664A');
  });
});

// ---------------------------------------------------------------------------
// G2 N32: `spot<Kind>` theme-bucket overrides -- `skinparam stereotype<X>
// BackgroundColor/BorderColor` / `<style> spot<Kind> { BackgroundColor;
// LineColor; FontColor }` (both routed to the SAME `theme.colors
// .elements['spot<Kind>']` bucket by `skinparam.ts`). Jar-verified
// `bisisi-31-xasa026` (flat skinparam block, background+border) and
// `gekofe-43-lufa479` (`<style>` selector, background+font/glyph).
// ---------------------------------------------------------------------------

describe('spotSnameForKind (G2 N32)', () => {
  it('maps each badge kind to its spot<Kind> bucket name', () => {
    expect(spotSnameForKind('class')).toBe('spotclass');
    expect(spotSnameForKind('abstract')).toBe('spotabstractclass');
    expect(spotSnameForKind('interface')).toBe('spotinterface');
    expect(spotSnameForKind('enum')).toBe('spotenum');
    expect(spotSnameForKind('annotation')).toBe('spotannotation');
  });

  it('returns undefined for a non-badge-bearing kind', () => {
    expect(spotSnameForKind('object')).toBeUndefined();
  });
});

describe('resolveBadgeFill (G2 N32 spotBackground param)', () => {
  it('falls back to the kind default when neither override is set', () => {
    expect(resolveBadgeFill('class', undefined, undefined)).toBe('#ADD1B2');
  });

  it('spotBackground wins over the kind default', () => {
    expect(resolveBadgeFill('class', undefined, '#FFFFFF')).toBe('#FFFFFF');
  });

  it('the per-classifier colorOverride wins over spotBackground -- jar\'s ' +
    'exact precedence (EntityImageClassHeader.java:183)', () => {
    expect(resolveBadgeFill('class', 'orange', '#FFFFFF')).toBe('#FFA500');
  });
});

describe('resolveBadgeBorder (G2 N32)', () => {
  it('falls back to the default border when spotBorder is unset', () => {
    expect(resolveBadgeBorder('#181818', undefined)).toBe('#181818');
  });

  it('spotBorder overrides the default', () => {
    expect(resolveBadgeBorder('#181818', '#FFFF00')).toBe('#FFFF00');
  });
});

describe('resolveBadgeGlyphColor (G2 N32)', () => {
  it('falls back to #000000 when spotFont is unset', () => {
    expect(resolveBadgeGlyphColor(undefined)).toBe('#000000');
  });

  it('spotFont overrides the default glyph color', () => {
    expect(resolveBadgeGlyphColor('red')).toBe('#FF0000');
  });
});

describe('hasBadge', () => {
  const badgeKinds: readonly ClassifierKind[] = ['class', 'abstract', 'interface', 'enum', 'annotation'];
  const noBadgeKinds: readonly ClassifierKind[] = ['object', 'map', 'json'];

  it.each(badgeKinds)('is true for %s', (kind) => {
    expect(hasBadge(kind)).toBe(true);
  });

  it.each(noBadgeKinds)('is false for %s', (kind) => {
    expect(hasBadge(kind)).toBe(false);
  });
});
