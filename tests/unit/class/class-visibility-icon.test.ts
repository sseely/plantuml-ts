import { describe, it, expect } from 'vitest';
import {
  renderVisibilityIcon,
  visibilityIconOriginY,
  visibilityModifierName,
  VISIBILITY_ICON_SIZE,
} from '../../../src/diagrams/class/class-visibility-icon.js';

// ---------------------------------------------------------------------------
// G2 N6: shape/color/wrapper for the member-row visibility icon --
// jar-verified against `sigoji-75-mojo941` (protected field, diamond),
// `cuxuni-25-doxi736` (public field + method, circle), and
// `lufide-34-cexu026` (all five visibility chars, both field and method
// variants, `plans/g2-class-svg/ledger.md` N6).
// ---------------------------------------------------------------------------

describe('visibilityModifierName', () => {
  it('maps each visibility char + isField to the jar VisibilityModifier enum name', () => {
    expect(visibilityModifierName('+', true)).toBe('PUBLIC_FIELD');
    expect(visibilityModifierName('+', false)).toBe('PUBLIC_METHOD');
    expect(visibilityModifierName('-', true)).toBe('PRIVATE_FIELD');
    expect(visibilityModifierName('-', false)).toBe('PRIVATE_METHOD');
    expect(visibilityModifierName('#', true)).toBe('PROTECTED_FIELD');
    expect(visibilityModifierName('#', false)).toBe('PROTECTED_METHOD');
    expect(visibilityModifierName('~', true)).toBe('PACKAGE_PRIVATE_FIELD');
    expect(visibilityModifierName('~', false)).toBe('PACKAGE_PRIVATE_METHOD');
  });

  it('IE_MANDATORY (*) has one shared name regardless of field/method', () => {
    expect(visibilityModifierName('*', true)).toBe('IE_MANDATORY');
    expect(visibilityModifierName('*', false)).toBe('IE_MANDATORY');
  });
});

describe('renderVisibilityIcon — field (stroke-only) vs method (filled)', () => {
  it('public field: unfilled circle, rx=ry=3, LineColor stroke', () => {
    // jar (lufide-34-cexu026, field5): geo.x=7 -> originX=13; row baseline
    // 109.8889 -> originY=102.5 -> ellipse cx=18 cy=107.5 rx=ry=3.
    const svg = renderVisibilityIcon('+', true, 13, 102.5);
    expect(svg).toBe(
      '<g data-visibility-modifier="PUBLIC_FIELD">' +
        '<ellipse cx="18" cy="107.5" rx="3" ry="3" fill="none" stroke="#038048" stroke-width="1"/></g>',
    );
  });

  it('public method: filled circle, BackgroundColor fill', () => {
    const svg = renderVisibilityIcon('+', false, 13, 102.5);
    expect(svg).toBe(
      '<g data-visibility-modifier="PUBLIC_METHOD">' +
        '<ellipse cx="18" cy="107.5" rx="3" ry="3" fill="#84BE84" stroke="#038048" stroke-width="1"/></g>',
    );
  });

  it('IE_MANDATORY is always filled, even on a field row', () => {
    const svg = renderVisibilityIcon('*', true, 13, 102.5);
    expect(svg).toContain('data-visibility-modifier="IE_MANDATORY"');
    expect(svg).toContain('fill="#000000" stroke="#000000"');
  });
});

describe('renderVisibilityIcon — shape geometry (jar-verified, lufide-34-cexu026)', () => {
  it('private: square via drawSquare(x+2,y+2,size-4)', () => {
    // jar field1: originX=13,originY=46.5 -> rect x=15 y=48.5 w=h=6.
    const svg = renderVisibilityIcon('-', true, 13, 46.5);
    expect(svg).toContain(
      '<rect x="15" y="48.5" width="6" height="6" fill="none" stroke="#C82930" stroke-width="1"/>',
    );
  });

  it('package: triangle polygon, translate(x+1,y)', () => {
    // jar field2: originX=13,originY=60.5 -> points 18,61.5,14,67.5,22,67.5.
    const svg = renderVisibilityIcon('~', true, 13, 60.5);
    expect(svg).toContain('points="18,61.5,14,67.5,22,67.5"');
    expect(svg).toContain('stroke="#1963A0"');
    expect(svg).toContain('stroke-linejoin="miter" stroke-miterlimit="10"');
  });

  it('protected: diamond polygon, translate(x+1,y)', () => {
    // jar field4: originX=13,originY=88.5 -> points 18,88.5,22,92.5,18,96.5,14,92.5.
    const svg = renderVisibilityIcon('#', true, 13, 88.5);
    expect(svg).toContain('points="18,88.5,22,92.5,18,96.5,14,92.5"');
    expect(svg).toContain('stroke="#B38D22"');
  });

  it('filled package method uses the BackgroundColor fill', () => {
    // jar method2: text baseline 145.8889 -> originY (via
    // visibilityIconOriginY) -> points ~18,139.5,14,145.5,22,145.5 (jar's
    // own 4-decimal-rounded baseline introduces a sub-0.001px float
    // remainder here -- assert numerically, not on the exact string).
    const originY = visibilityIconOriginY(145.8889, 14);
    const svg = renderVisibilityIcon('~', false, 13, originY);
    const points = /points="([^"]+)"/.exec(svg)?.[1]?.split(',').map(Number) ?? [];
    expect(points).toHaveLength(6);
    expect(points[0]).toBeCloseTo(18, 2);
    expect(points[1]).toBeCloseTo(139.5, 2);
    expect(points[2]).toBeCloseTo(14, 2);
    expect(points[3]).toBeCloseTo(145.5, 2);
    expect(points[4]).toBeCloseTo(22, 2);
    expect(points[5]).toBeCloseTo(145.5, 2);
    expect(svg).toContain('fill="#4177AF" stroke="#1963A0"');
  });
});

describe('visibilityIconOriginY', () => {
  it('reduces to the jar-verified constant offset at the default fontSize (14)', () => {
    // jar (cuxuni-25-doxi736, lufide-34-cexu026): rowBaseline - originY ==
    // 7.3888... at fontSize 14, for every sampled row (field and method).
    const originY = visibilityIconOriginY(53.8889, 14);
    expect(originY).toBeCloseTo(46.5, 2);
  });

  it('is a pure function of (rowBaselineY, rowHeight) -- no hidden state', () => {
    expect(visibilityIconOriginY(100, 14)).toBe(visibilityIconOriginY(100, 14));
  });
});

describe('VISIBILITY_ICON_SIZE', () => {
  it('matches classAttributeIconSize()\'s default (10)', () => {
    expect(VISIBILITY_ICON_SIZE).toBe(10);
  });
});
