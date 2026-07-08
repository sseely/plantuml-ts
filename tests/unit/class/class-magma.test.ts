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
      `${e.from}->${e.to}:${e.attributes.minLen}`;
    expect(edges.map(key).sort()).toEqual(
      ['A->B:0', 'A->D:1', 'B->C:0', 'D->E:0', 'E->F:0'].sort(),
    );
    expect(edges.every((e) => e.attributes.invis === true)).toBe(true);
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
});
