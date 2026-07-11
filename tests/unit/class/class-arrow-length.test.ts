/**
 * Cross-relationship arrow-length normalization (mission A2, class-dot-sync
 * Group 10): a single-dash arrow (`<|-`, `-*`, ...) between two entities has
 * arrow length 1 (`arrowLength` in class-relationship-parser.ts, already
 * correct). Upstream additionally forces every OTHER relationship
 * connecting that SAME (unordered) pair of classifiers to length 1 too, in
 * one post-parse pass over the complete link list — even when that other
 * relationship's own arrow body would normally default to length 2 (minlen
 * 1). Confirmed against the oracle jar: `A ..> B` alone emits `minlen=1`,
 * but `A ..> B` + `A -* B` together (same pair, oracle jar probe) emits
 * `minlen=0` on BOTH edges.
 *
 * plantuml-ts had no equivalent pass, so a second relationship between an
 * already-length-1 pair kept its own default length
 * (givoli-70-rade072, nadepi-13-mufu566, tedeba-19-lisi250).
 *
 * NOT WIRED IN: this pass must run once, after all lines are parsed, over
 * the complete `ast.relationships` list — the only such hook is
 * `parseClass`'s post-loop finalize in parser.ts (alongside its existing
 * `applyDirectives(state.ast)` call), which is outside this task's write-set
 * (parser.ts is not in {class-declaration-parser, class-relationship-parser,
 * class-namespace, class-magma, class-commands}.ts). See mission report.
 *
 * @see ~/git/plantuml/.../classdiagram/ClassDiagram.java:74-82 (checkFinalError)
 * @see ~/git/plantuml/.../abel/Link.java:462-470 (sameConnections)
 */
import { describe, it, expect } from 'vitest';
import { normalizeSameConnectionLengths } from '../../../src/diagrams/class/class-namespace.js';
import type { Relationship } from '../../../src/diagrams/class/ast.js';

function rel(from: string, to: string, length?: number): Relationship {
  return { from, to, type: 'association', ...(length !== undefined ? { length } : {}) };
}

describe('normalizeSameConnectionLengths', () => {
  it('forces a same-pair relationship (default length 2) to length 1', () => {
    const rels = [rel('Potential', 'CompositePotential', 1), rel('Potential', 'CompositePotential')];
    normalizeSameConnectionLengths(rels);
    expect(rels[1]!.length).toBe(1);
  });

  it('matches the pair regardless of direction (reversed from/to)', () => {
    const rels = [rel('Graphic', 'GraphicDecorator', 1), rel('GraphicDecorator', 'Graphic')];
    normalizeSameConnectionLengths(rels);
    expect(rels[1]!.length).toBe(1);
  });

  it('leaves an unrelated pair untouched', () => {
    const rels = [rel('A', 'B', 1), rel('C', 'D')];
    normalizeSameConnectionLengths(rels);
    expect(rels[1]!.length).toBeUndefined();
  });

  it('forces every relationship in a >2-way same-pair group', () => {
    const rels = [rel('A', 'B'), rel('A', 'B', 1), rel('B', 'A'), rel('A', 'B', 3)];
    normalizeSameConnectionLengths(rels);
    expect(rels.map((r) => r.length)).toEqual([1, 1, 1, 1]);
  });

  it('is a no-op when no relationship in a pair has length 1', () => {
    const rels = [rel('A', 'B', 2), rel('A', 'B', 3)];
    normalizeSameConnectionLengths(rels);
    expect(rels[0]!.length).toBe(2);
    expect(rels[1]!.length).toBe(3);
  });

  it('does not touch a relationship whose length is already 1', () => {
    const rels = [rel('A', 'B', 1), rel('A', 'B', 1)];
    normalizeSameConnectionLengths(rels);
    expect(rels.map((r) => r.length)).toEqual([1, 1]);
  });
});
