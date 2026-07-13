/**
 * Tests for description/link-edge-attrs.ts's graph-spacing computation —
 * DotStringFactory.createDotString's nodesep/ranksep formula, including the
 * `!pragma kermor on` ranksep variant (DotStringFactory.java:111-114,
 * 247-249). See description-dot-100 decision-journal.md I2.
 */
import { describe, it, expect } from 'vitest';
import { computeGraphSpacing } from '../../../src/diagrams/description/link-edge-attrs.js';
import type { DescriptiveLink } from '../../../src/diagrams/description/ast.js';
import type { FontSpec, StringMeasurer } from '../../../src/core/measurer.js';

const fontSpec: FontSpec = { family: 'Helvetica', size: 12 };
const measurer: StringMeasurer = {
  measure: () => ({ width: 0, height: 0 }),
  getDescent: () => 0,
};

describe('computeGraphSpacing — kermor ranksep variant', () => {
  it('floors ranksep at 60 (non-kermor) with no links', () => {
    const { nodeSep, rankSep } = computeGraphSpacing([], fontSpec, measurer);
    expect(nodeSep).toBe(35);
    expect(rankSep).toBe(60);
  });

  it('floors ranksep at 40 under kermor with no links — DotStringFactory.getMinRankSep():247-249', () => {
    const { nodeSep, rankSep } = computeGraphSpacing([], fontSpec, measurer, true);
    expect(nodeSep).toBe(35); // getMinNodeSep never checks kermor
    expect(rankSep).toBe(40);
  });

  it('divides vertical dzeta by 100 (not 10) under kermor — DotStringFactory.getVerticalDzeta():111-114', () => {
    const links: DescriptiveLink[] = [
      { from: 'a', to: 'b', length: 2, arrowHead: 'none', label: 'x' } as DescriptiveLink,
    ];
    const wideMeasurer: StringMeasurer = {
      measure: () => ({ width: 0, height: 5000 }),
      getDescent: () => 0,
    };
    const nonKermor = computeGraphSpacing(links, fontSpec, wideMeasurer, false);
    const kermor = computeGraphSpacing(links, fontSpec, wideMeasurer, true);
    // Both have the SAME decorDzeta+label height input; only the divisor differs.
    expect(nonKermor.rankSep).toBeCloseTo(kermor.rankSep * 10, 5);
  });
});
