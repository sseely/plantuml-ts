/**
 * T5 — degenerate-diagram skip (0-1 entities -> no DOT graph).
 *
 * GraphvizImageBuilder.buildImage:211-223 (dotData.isDegeneratedWithFewEntities,
 * dot/DotData.java:69-71) skips graphviz entirely for a diagram with zero
 * groups, zero links, and 0 or 1 leaf entities. This mirrors the description
 * engine's `degenerateSingleLeaf` (description/layout-helpers.ts:410) into
 * `layoutClass` (see `degenerateSingleClassifier` in ../../../src/diagrams/
 * class/layout.ts).
 */
import { describe, it, expect } from 'vitest';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type {
  ClassDiagramAST,
  Classifier,
  Namespace,
  Relationship,
  ClassNote,
} from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import { renderFixture } from '../../helpers/render.js';

const measurer = new FormulaMeasurer();

function makeAST(overrides?: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
    ...overrides,
  };
}

function makeClassifier(id: string, overrides?: Partial<Classifier>): Classifier {
  return { id, display: id, kind: 'class', typeParams: [], members: [], ...overrides };
}

/** Run layoutClass while counting how many DOT graphs the layout engine sees. */
function layoutAndCount(ast: ClassDiagramAST): { geo: ReturnType<typeof layoutClass>; captured: number } {
  let captured = 0;
  const graphs: DotInputGraph[] = [];
  setLayoutInputObserver((g) => {
    captured++;
    graphs.push(g);
  });
  try {
    const geo = layoutClass(ast, defaultTheme, measurer);
    return { geo, captured };
  } finally {
    setLayoutInputObserver(undefined);
  }
}

describe('layoutClass -- degenerate diagram skip (T5)', () => {
  it('single classifier, no relationships, no namespaces -- 0 graphs', () => {
    const ast = makeAST({ classifiers: [makeClassifier('A')] });
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(0);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.classifiers[0]?.id).toBe('A');
    expect(geo.classifiers[0]?.x).toBe(0);
    expect(geo.classifiers[0]?.y).toBe(0);
    expect(geo.totalWidth).toBeGreaterThan(0);
    expect(geo.totalHeight).toBeGreaterThan(0);
    expect(geo.edges).toHaveLength(0);
    expect(geo.namespaces).toHaveLength(0);
    expect(geo.notes).toHaveLength(0);
  });

  it('two classifiers + one relationship -- exactly 1 graph (unchanged)', () => {
    const ast = makeAST({
      classifiers: [makeClassifier('A'), makeClassifier('B')],
      relationships: [{ from: 'A', to: 'B', type: 'association' } satisfies Relationship],
    });
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
    expect(geo.classifiers).toHaveLength(2);
    expect(geo.edges).toHaveLength(1);
  });

  it('one classifier + a note attached to it -- NOT degenerate (notes count as leafs upstream)', () => {
    const note: ClassNote = { id: '__note_0', target: 'A', position: 'right', text: 'hi' };
    const ast = makeAST({ classifiers: [makeClassifier('A')], notes: [note] });
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.notes).toHaveLength(1);
  });

  it('one classifier + a floating (unattached) note -- NOT degenerate', () => {
    const note: ClassNote = { id: 'N1', text: 'floating' };
    const ast = makeAST({ classifiers: [makeClassifier('A')], notes: [note] });
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.notes).toHaveLength(1);
  });

  it('single classifier inside a declared namespace -- NOT degenerate (any declared group disqualifies, even non-empty)', () => {
    const ns: Namespace = { id: 'P', display: 'P', classifiers: ['A'] };
    const ast = makeAST({ classifiers: [makeClassifier('A')], namespaces: [ns] });
    const { captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
  });

  it('single hexagon-usymbol descriptive classifier -- excluded, falls through to normal layout', () => {
    const ast = makeAST({
      classifiers: [makeClassifier('A', { kind: 'descriptive', usymbol: 'hexagon' })],
    });
    const { captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
  });

  it('single freestanding note, zero classifiers -- falls through to normal layout (not dropped)', () => {
    // GraphvizImageBuilder.java's isDegeneratedWithFewEntities(1) counts notes
    // as leafs too (DotData.java:69-71 -- getLeafs() includes LeafType.NOTE),
    // so upstream *would* treat a lone note as degenerate. This port only
    // special-cases the single-classifier leaf (see degenerateSingleClassifier
    // in src/diagrams/class/layout.ts): a lone note goes through the normal
    // dot path instead of a dedicated direct-placement path -- it must still
    // be rendered (not silently dropped by the 0-entity shortcut above it).
    const note: ClassNote = { id: 'N1', text: 'alone' };
    const ast = makeAST({ notes: [note] });
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
    expect(geo.notes).toHaveLength(1);
  });

  it('empty diagram (0 classifiers, 0 namespaces) -- 0 graphs, zero-size geometry', () => {
    const { geo, captured } = layoutAndCount(makeAST());
    expect(captured).toBe(0);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
    expect(geo.classifiers).toHaveLength(0);
  });

  it('end-to-end: "class A" alone renders an SVG containing the class box', () => {
    const svg = renderFixture('@startuml\nclass A\n@enduml');
    expect(svg).toContain('<svg');
    expect(svg).toContain('A');
  });
});
