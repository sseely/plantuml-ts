import { describe, it, expect } from 'vitest';
import { buildClassMagmaEdges } from '../../../src/diagrams/class/class-magma.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';

function ast(partial: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
    ...partial,
  };
}
const leaf = (id: string) =>
  ({ id, display: id, kind: 'class', typeParams: [], members: [] }) as never;

describe('buildClassMagmaEdges — standalone-leaf invisible chaining', () => {
  it('chains 6 disconnected leaves into a 2×3 grid (5 invisible edges)', () => {
    const a = ast({
      classifiers: ['A', 'B', 'C', 'D', 'E', 'F'].map(leaf),
    });
    const edges = buildClassMagmaEdges(a, new Map());
    // computeBranch(6)=3 → rows [A,B,C],[D,E,F]; within-row leftRight (minLen 0),
    // row-head topDown A→D (minLen 1).
    expect(edges).toHaveLength(5);
    const key = (e: (typeof edges)[number]) =>
      `${e.from}->${e.to}:${e.attributes!.minLen}`;
    expect(edges.map(key).sort()).toEqual(
      ['A->B:0', 'A->D:1', 'B->C:0', 'D->E:0', 'E->F:0'].sort(),
    );
    expect(edges.every((e) => e.attributes!.invis === true)).toBe(true);
  });

  it('does not chain when fewer than 3 leaves are standalone', () => {
    const a = ast({ classifiers: ['A', 'B'].map(leaf) });
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(0);
  });

  it('excludes leaves touched by a relationship', () => {
    const a = ast({
      classifiers: ['A', 'B', 'C', 'D'].map(leaf),
      relationships: [
        { from: 'A', to: 'B', type: 'association' } as never,
      ],
    });
    // A and B are touched → only C, D standalone → < 3 → no edges
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(0);
  });

  // gatula-10-bifu561: `package foo {}` / `namespace bar {}` / `class qux {}`.
  // Upstream computes magma (applySingleStrategy, CucaDiagram.java:679-706)
  // over `Entity.leafs()`, which explicitly excludes isGroup()==true children
  // (abel/Entity.java:649-655) — package/namespace entities are still groups
  // at that point. The empty→leaf-classifier mute (LeafType.EMPTY_PACKAGE)
  // happens later, at DOT-export time (GraphvizImageBuilder#printGroups),
  // strictly AFTER applySingleStrategy already ran. Our port instead computes
  // magma from an AST where `foo`/`bar` have already been collapsed
  // (class-namespace.ts#collapseEmptyNamespace) into `kind: 'descriptive'`
  // classifiers with NO `usymbol` — the one shape only that collapse
  // produces (every genuinely-declared descriptive leaf/container always
  // carries a usymbol) — so buildClassMagmaEdges must recognize and exclude
  // that shape itself, otherwise 3 unrelated top-level entities (one real
  // class + two collapsed empty containers) wrongly clear the >=3 standalone
  // threshold and get square-chained, while the oracle emits zero magma
  // edges here.
  const collapsedGroup = (id: string) =>
    ({ id, display: id, kind: 'descriptive', typeParams: [], members: [] }) as never;

  it('excludes collapsed-empty-namespace classifiers even though only 1 true leaf remains', () => {
    const a = ast({
      classifiers: [collapsedGroup('foo'), collapsedGroup('bar'), leaf('qux')],
    });
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(0);
  });

  it('still chains a genuine descriptive leaf (has a usymbol) among 3 standalones', () => {
    const database = (id: string) =>
      ({ id, display: id, kind: 'descriptive', usymbol: 'database', typeParams: [], members: [] }) as never;
    const a = ast({ classifiers: ['foo', 'bar', 'qux'].map(database) });
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(2);
  });
});
