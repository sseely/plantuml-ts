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
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { getHTitle } from '../../../src/diagrams/class/class-namespace-shape.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { javaRound4 } from '../../../src/core/number-format.js';

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

describe('buildNamespaceGeos — inkShape resolution (G2 N60, item 42)', () => {
  const ast = makeAST();
  const posMap = new Map([['c', { id: 'c', x: 100, y: 100, width: 50, height: 50 }]]);

  it('leaves inkShape undefined for the default (non-strict, non-rect) FOLDER style', () => {
    const [geo] = buildNamespaceGeos(ast, posMap, defaultTheme, measurer, new Map());
    expect(geo?.inkShape).toBeUndefined();
  });

  it('resolves "polygon" for FOLDER style under skinparam style strictuml', () => {
    const strictTheme = { ...defaultTheme, strictUml: true };
    const [geo] = buildNamespaceGeos(ast, posMap, strictTheme, measurer, new Map());
    expect(geo?.inkShape).toBe('polygon');
  });

  it('resolves "rect" for skinparam packageStyle rect, even under strictuml', () => {
    const rectTheme = { ...defaultTheme, strictUml: true, packageStyle: 'rect' as const };
    const [geo] = buildNamespaceGeos(ast, posMap, rectTheme, measurer, new Map());
    expect(geo?.inkShape).toBe('rect');
  });

  it('resolves "rect" for skinparam packageStyle rect without strictuml too', () => {
    const rectTheme = { ...defaultTheme, packageStyle: 'rect' as const };
    const [geo] = buildNamespaceGeos(ast, posMap, rectTheme, measurer, new Map());
    expect(geo?.inkShape).toBe('rect');
  });
});

/**
 * G2 N35: `buildEdgeGeos#attachPortLabels`/`portLabelAnchor`'s tail/head
 * multiplicity-label width was the raw `measurer.measure(...).width` float,
 * never rounded through `javaRound4` (`core/number-format.ts`'s Java-`%.4f`
 * rounding, ALREADY applied to every other measured width in this engine —
 * `class-layout-helpers.ts#measureClassifier`'s header/row widths,
 * `note-layout.ts#measureNote`'s per-line widths) -- jar-verified via
 * `jaloja-18-tisu915`'s cardinality label: our raw float
 * `19.418750000000003` vs jar's `%.4f`-formatted `19.4188`.
 */
describe('buildEdgeGeos — tail/head multiplicity-label width rounding (G2 N35)', () => {
  it('rounds the tail/head label width through javaRound4, matching every other measured-width field', () => {
    const ast: ClassDiagramAST = {
      classifiers: [
        { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
        { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
      ],
      relationships: [
        { from: 'A', to: 'B', type: 'association', fromMultiplicity: '1', toMultiplicity: '0..*' },
      ],
      namespaces: [],
      directives: [],
      notes: [],
    };
    const geo = layoutClass(ast, defaultTheme, new DeterministicMeasurer());
    const edge = geo.edges[0]!;
    expect(edge.tailLabel).toBeDefined();
    expect(edge.headLabel).toBeDefined();
    expect(edge.tailLabel!.width).toBe(javaRound4(edge.tailLabel!.width));
    expect(edge.headLabel!.width).toBe(javaRound4(edge.headLabel!.width));
  });
});

/**
 * G2 N51: `skinparam arrowThickness N` -- the class-edge DEFAULT stroke
 * width every edge without its own `-[thickness=N]->`/`-[bold]->` bracket
 * override picks up (`class-geo-builders.ts#buildStrokeOverride`,
 * `theme.ts#arrowThickness`'s doc comment for the exact upstream formula).
 */
describe('buildEdgeGeos — skinparam arrowThickness default (G2 N51)', () => {
  const twoClassAst: ClassDiagramAST = {
    classifiers: [
      { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
      { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
    ],
    namespaces: [],
    directives: [],
    notes: [],
    relationships: [{ from: 'A', to: 'B', type: 'association' }],
  };

  it('applies the theme-level default to an edge with no bracket override', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { graph: { arrowThickness: 0.4 } } });
    const geo = layoutClass(twoClassAst, theme, new DeterministicMeasurer());
    expect(geo.edges[0]!.strokeWidth).toBe(0.4);
  });

  it('leaves strokeWidth unset (renderer default of 1) when no skinparam default is set', () => {
    const geo = layoutClass(twoClassAst, defaultTheme, new DeterministicMeasurer());
    expect(geo.edges[0]!.strokeWidth).toBeUndefined();
  });

  it('a per-edge bracket thickness override wins over the theme-level default', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { graph: { arrowThickness: 0.4 } } });
    const ast: ClassDiagramAST = {
      ...twoClassAst,
      relationships: [{ from: 'A', to: 'B', type: 'association', thicknessOverride: 5 }],
    };
    const geo = layoutClass(ast, theme, new DeterministicMeasurer());
    expect(geo.edges[0]!.strokeWidth).toBe(5);
  });
});
