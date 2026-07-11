import { describe, it, expect } from 'vitest';
import { buildClassMagmaEdges } from '../../../src/diagrams/class/class-magma.js';
import type { ClassDiagramAST, ClassNote } from '../../../src/diagrams/class/ast.js';

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
const note = (id: string, target?: string): ClassNote =>
  ({ id, target, text: '' }) as never;

describe('buildClassMagmaEdges — note connectors count as links', () => {
  it('excludes a classifier touched only by an attached note (< 3 remain standalone)', () => {
    // A has a note attached; B, C, D have no links and no notes.
    const a = ast({
      classifiers: ['A', 'B', 'C', 'D'].map(leaf),
      notes: [note('__note_0', 'A')],
    });
    // A and __note_0 are touched → only B, C, D standalone → still 3 → chains.
    // To isolate "A excluded from standalone", drop to exactly 2 remaining
    // (B, C) by removing D, which must fall below the chaining threshold.
    const a2 = ast({
      classifiers: ['A', 'B', 'C'].map(leaf),
      notes: [note('__note_0', 'A')],
    });
    expect(buildClassMagmaEdges(a2, new Map())).toHaveLength(0);
    // Sanity: with D re-added, only B/C/D are standalone (3 of them) — chains.
    const edges = buildClassMagmaEdges(a, new Map());
    expect(edges).toHaveLength(2);
    const ids = new Set(edges.flatMap((e) => [e.from, e.to]));
    expect(ids.has('A')).toBe(false);
    expect(ids).toEqual(new Set(['B', 'C', 'D']));
  });

  it('does not chain when the note-touched classifier is the only non-standalone one and < 3 remain', () => {
    const a = ast({
      classifiers: ['A', 'B'].map(leaf),
      notes: [note('__note_0', 'A')],
    });
    // A touched by note → only B standalone → < 3 → no edges.
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(0);
  });

  it('control: 3 genuinely-standalone classifiers (no relationships, no notes) still chain', () => {
    const a = ast({ classifiers: ['A', 'B', 'C'].map(leaf) });
    const edges = buildClassMagmaEdges(a, new Map());
    expect(edges).toHaveLength(2);
  });

  it('a floating note (no target) is not marked touched and joins the standalone chain', () => {
    // Mirrors upstream: a floating `note as N ... end note` creates no Link
    // unless a later relationship connects it — untouched here, and upstream
    // `g.leafs()` yields note leaves alongside classifiers (same Quark tree),
    // so it IS a standalone leaf (oracle-verified via nuxoni-26-xala894:
    // two floating notes + one class = 3 standalones, square-chained).
    const a = ast({
      classifiers: ['A', 'B', 'C'].map(leaf),
      notes: [note('N1')], // no target — floating
    });
    // 4 standalones (A, B, C, N1) → branch 2: A→B (len 1), A→C (len 2),
    // C→N1 (len 1) — 3 invisible edges over all four leaves.
    const edges = buildClassMagmaEdges(a, new Map());
    expect(edges).toHaveLength(3);
    const ids = new Set(edges.flatMap((e) => [e.from, e.to]));
    expect(ids).toEqual(new Set(['A', 'B', 'C', 'N1']));
  });

  it('two floating notes + one class reach the >=3 threshold (nuxoni-26-xala894)', () => {
    const a = ast({
      classifiers: [leaf('MyClass')],
      notes: [note('Note1'), note('Note2')],
    });
    const edges = buildClassMagmaEdges(a, new Map());
    // branch 2: MyClass→Note1 leftRight (minlen 0), MyClass→Note2 topDown
    // (minlen 1) — the oracle emits the same two-invis-edge square (its leaf
    // order differs; every parity multiset is order-invariant).
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.attributes?.minLen).sort()).toEqual([0, 1]);
    expect(edges.every((e) => e.attributes?.invis === true)).toBe(true);
  });

  it('note id itself is excluded from standalone chaining when reachable as a namespace leaf', () => {
    // Namespaced notes register into Namespace.classifiers (per ast.ts
    // ClassNote.namespace doc) — simulate that here: the note id sits
    // alongside classifiers in a namespace's leaf list, attached to one of
    // them. Only 2 non-note-touched classifiers remain — below threshold.
    const a = ast({
      classifiers: ['A', 'B'].map(leaf),
      namespaces: [
        {
          id: 'ns1',
          display: 'ns1',
          classifiers: ['A', 'B', '__note_0'],
        },
      ],
      notes: [note('__note_0', 'A')],
    });
    // A and __note_0 touched → only B standalone in ns1 → < 3 → no edges.
    expect(buildClassMagmaEdges(a, new Map())).toHaveLength(0);
  });
});
