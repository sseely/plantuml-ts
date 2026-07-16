import { describe, it, expect } from 'vitest';
import { badgeFill, hasBadge } from '../../../src/diagrams/class/class-badge.js';
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
