/**
 * Unit tests for class-geo-builders.ts#buildNamespaceGeos — G2 N18: the
 * anchor-in-cluster footprint case (a package used as a relationship/note
 * endpoint carries a real `zaent-*` point anchor as an extra direct member
 * of its own dot cluster, occupying a rank slot ABOVE the topmost
 * classifier — `plans/g2-class-svg/ledger.md` N17/N18).
 */
import { describe, it, expect } from 'vitest';
import { buildNamespaceGeos } from '../../../src/diagrams/class/class-geo-builders.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { getHTitle } from '../../../src/diagrams/class/class-namespace-shape.js';

const measurer = new WidthTableMeasurer();

function makeAST(overrides?: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [{ id: 'p', display: 'p', classifiers: ['c'] }],
    directives: [],
    notes: [],
    ...overrides,
  };
}

describe('buildNamespaceGeos — anchor-in-cluster footprint (G2 N18)', () => {
  const ast = makeAST();
  const topPad = getHTitle(measurer, defaultTheme, 'p') + 13;

  it('uses the classifier position alone when no anchor exists for the namespace', () => {
    const posMap = new Map([['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }]]);
    const [geo] = buildNamespaceGeos(ast, posMap, defaultTheme, measurer, new Map());
    expect(geo?.y).toBeCloseTo(100 - topPad, 6);
  });

  it('folds the anchor position into the footprint walk when the namespace is an edge endpoint', () => {
    // Anchor sits ABOVE the classifier (smaller y) — the real jar-observed
    // rank-slot mechanism (ledger.md N17/N18's 41px vs 33px pair).
    const posMap = new Map([
      ['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }],
      ['zaent-p', { id: 'zaent-p', x: 120, y: 92, width: 1, height: 1 }],
    ]);
    const anchors = new Map([['p', 'zaent-p']]);
    const [geo] = buildNamespaceGeos(ast, posMap, defaultTheme, measurer, anchors);
    // Top boundary now derives from the anchor's y (92), not the
    // classifier's y (100) -- the box grows upward to enclose the anchor.
    expect(geo?.y).toBeCloseTo(92 - topPad, 6);
    expect(geo?.y).toBeLessThan(100 - topPad);
  });

  it('does not affect left/right/bottom when the anchor sits within the classifier footprint', () => {
    const posMap = new Map([
      ['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }],
      ['zaent-p', { id: 'zaent-p', x: 120, y: 92, width: 1, height: 1 }],
    ]);
    const anchors = new Map([['p', 'zaent-p']]);
    const withAnchor = buildNamespaceGeos(ast, posMap, defaultTheme, measurer, anchors)[0]!;
    const without = buildNamespaceGeos(
      ast,
      new Map([['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }]]),
      defaultTheme,
      measurer,
      new Map(),
    )[0]!;
    expect(withAnchor.x).toBeCloseTo(without.x, 6);
    expect(withAnchor.width).toBeCloseTo(without.width, 6);
    expect(withAnchor.y + withAnchor.height).toBeCloseTo(without.y + without.height, 6);
  });

  it('ignores an anchor id that has no matching dot-layout position', () => {
    const posMap = new Map([['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }]]);
    const anchors = new Map([['p', 'zaent-p']]); // never laid out
    const [geo] = buildNamespaceGeos(ast, posMap, defaultTheme, measurer, anchors);
    expect(geo?.y).toBeCloseTo(100 - topPad, 6);
  });
});
