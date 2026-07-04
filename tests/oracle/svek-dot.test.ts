/**
 * Unit tests for the structural DOT comparator (mission dot-oracle-sync D1).
 *
 * Each new/tightened check (rankdir, nodesep, ranksep, medianSizeDeltaIn) is
 * exercised in isolation via small hand-written svek DOT strings, flipping a
 * single perturbation at a time so a regression pinpoints exactly which check
 * broke. One existing-check regression (minlen) is included as a control to
 * confirm the bar didn't get *looser* while being tightened.
 */
import { describe, it, expect } from 'vitest';
import { parseSvekDot, compareStructural } from './svek-dot.js';

/** Minimal two-node, one-edge svek DOT, with overridable graph attrs. */
function dot(opts: {
  rankdir?: string;
  nodesep?: number;
  ranksep?: number;
  minlen?: number;
}): string {
  const lines = ['digraph unix {'];
  if (opts.rankdir !== undefined) lines.push(`rankdir=${opts.rankdir};`);
  if (opts.nodesep !== undefined) lines.push(`nodesep=${opts.nodesep.toFixed(6)};`);
  if (opts.ranksep !== undefined) lines.push(`ranksep=${opts.ranksep.toFixed(6)};`);
  const minlen = opts.minlen ?? 1;
  lines.push(
    `sh0007->sh0006[arrowtail=none,arrowhead=none,minlen=${minlen},color="#000008"];`,
  );
  lines.push('sh0006 [shape=rect,label="",width=2.141873,height=0.985786,color="#000006"];');
  lines.push('sh0007 [shape=rect,label="",width=0.901204,height=1.402452,color="#000007"];');
  lines.push('}');
  return lines.join('\n');
}

describe('compareStructural — rankdir/nodesep/ranksep parity bar (T1)', () => {
  it('identical DOT on both sides: every check true, structurallyEqual true', () => {
    const both = dot({ nodesep: 0.486111, ranksep: 0.833333, minlen: 0 });
    const diff = compareStructural(parseSvekDot(both), parseSvekDot(both));

    expect(diff.rankdirOk).toBe(true);
    expect(diff.nodesepOk).toBe(true);
    expect(diff.ranksepOk).toBe(true);
    expect(diff.nodeCountOk).toBe(true);
    expect(diff.edgeCountOk).toBe(true);
    expect(diff.degreeOk).toBe(true);
    expect(diff.minlenOk).toBe(true);
    expect(diff.shapeOk).toBe(true);
    expect(diff.labelOk).toBe(true);
    expect(diff.clusterOk).toBe(true);
    expect(diff.structurallyEqual).toBe(true);
    expect(diff.maxSizeDeltaIn).toBe(0);
    expect(diff.medianSizeDeltaIn).toBe(0);
  });

  it('oracle has no rankdir, candidate emits rankdir=LR: rankdirOk false (babafi-51)', () => {
    const oracle = parseSvekDot(dot({ nodesep: 0.486111, ranksep: 0.833333, minlen: 0 }));
    const candidate = parseSvekDot(
      dot({ rankdir: 'LR', nodesep: 0.486111, ranksep: 0.833333, minlen: 0 }),
    );
    const diff = compareStructural(oracle, candidate);

    expect(diff.rankdirOk).toBe(false);
    expect(diff.structurallyEqual).toBe(false);
    // All other checks still pass — this proves the failure is isolated to rankdir.
    expect(diff.nodeCountOk).toBe(true);
    expect(diff.edgeCountOk).toBe(true);
    expect(diff.degreeOk).toBe(true);
    expect(diff.minlenOk).toBe(true);
    expect(diff.shapeOk).toBe(true);
    expect(diff.labelOk).toBe(true);
    expect(diff.clusterOk).toBe(true);
    expect(diff.nodesepOk).toBe(true);
    expect(diff.ranksepOk).toBe(true);
  });

  it('both sides emit the same rankdir: rankdirOk true', () => {
    const oracle = parseSvekDot(dot({ rankdir: 'LR', minlen: 0 }));
    const candidate = parseSvekDot(dot({ rankdir: 'LR', minlen: 0 }));
    expect(compareStructural(oracle, candidate).rankdirOk).toBe(true);
  });

  it('nodesep 0.486111 vs 0.833333: nodesepOk false, structurallyEqual false', () => {
    const oracle = parseSvekDot(dot({ nodesep: 0.486111, minlen: 0 }));
    const candidate = parseSvekDot(dot({ nodesep: 0.833333, minlen: 0 }));
    const diff = compareStructural(oracle, candidate);

    expect(diff.nodesepOk).toBe(false);
    expect(diff.structurallyEqual).toBe(false);
    expect(diff.ranksepOk).toBe(true);
    expect(diff.rankdirOk).toBe(true);
  });

  it('ranksep off by 0.01: ranksepOk false, structurallyEqual false', () => {
    const oracle = parseSvekDot(dot({ ranksep: 0.833333, minlen: 0 }));
    const candidate = parseSvekDot(dot({ ranksep: 0.843333, minlen: 0 }));
    const diff = compareStructural(oracle, candidate);

    expect(diff.ranksepOk).toBe(false);
    expect(diff.structurallyEqual).toBe(false);
    expect(diff.nodesepOk).toBe(true);
    expect(diff.rankdirOk).toBe(true);
  });

  it('nodesep within epsilon (1e-7 apart): nodesepOk stays true', () => {
    const oracle = parseSvekDot(dot({ nodesep: 0.4861111, minlen: 0 }));
    const candidate = parseSvekDot(dot({ nodesep: 0.4861112, minlen: 0 }));
    expect(compareStructural(oracle, candidate).nodesepOk).toBe(true);
  });

  it('nodesep/ranksep both absent on both sides: ok, equal to absent==absent', () => {
    const oracle = parseSvekDot(dot({ minlen: 0 }));
    const candidate = parseSvekDot(dot({ minlen: 0 }));
    const diff = compareStructural(oracle, candidate);
    expect(diff.nodesepOk).toBe(true);
    expect(diff.ranksepOk).toBe(true);
  });

  it('nodesep present on one side only: nodesepOk false (absent vs present)', () => {
    const oracle = parseSvekDot(dot({ minlen: 0 }));
    const candidate = parseSvekDot(dot({ nodesep: 0.486111, minlen: 0 }));
    expect(compareStructural(oracle, candidate).nodesepOk).toBe(false);
  });

  it('existing-check regression control: minlen multiset mismatch still fails', () => {
    const oracle = parseSvekDot(dot({ minlen: 0 }));
    const candidate = parseSvekDot(dot({ minlen: 1 }));
    const diff = compareStructural(oracle, candidate);

    expect(diff.minlenOk).toBe(false);
    expect(diff.structurallyEqual).toBe(false);
    // Confirms tightening the bar did not loosen the pre-existing minlen check.
    expect(diff.rankdirOk).toBe(true);
    expect(diff.nodesepOk).toBe(true);
    expect(diff.ranksepOk).toBe(true);
  });
});

describe('compareStructural — medianSizeDeltaIn', () => {
  it('is 0 when both sides have identical node dimensions', () => {
    const both = dot({ minlen: 0 });
    const diff = compareStructural(parseSvekDot(both), parseSvekDot(both));
    expect(diff.medianSizeDeltaIn).toBe(0);
    expect(diff.maxSizeDeltaIn).toBe(0);
  });

  it('is the median of the paired, sorted per-index size deltas', () => {
    // Oracle sizes sorted: [0.9, 0.99, 2.14, 1.40] -> sorted [0.9,0.99,1.4,2.14]
    // Candidate: width/height both bumped by a fixed amount per node.
    const oracle = parseSvekDot(
      [
        'digraph unix {',
        'sh0007->sh0006[arrowtail=none,arrowhead=none,minlen=0,color="#000008"];',
        'sh0006 [shape=rect,label="",width=1.000000,height=2.000000,color="#000006"];',
        'sh0007 [shape=rect,label="",width=3.000000,height=4.000000,color="#000007"];',
        '}',
      ].join('\n'),
    );
    const candidate = parseSvekDot(
      [
        'digraph unix {',
        'sh0007->sh0006[arrowtail=none,arrowhead=none,minlen=0,color="#000008"];',
        'sh0006 [shape=rect,label="",width=1.100000,height=2.500000,color="#000006"];',
        'sh0007 [shape=rect,label="",width=3.300000,height=5.000000,color="#000007"];',
        '}',
      ].join('\n'),
    );
    // Oracle sorted sizes: [1,2,3,4]; candidate sorted: [1.1,2.5,3.3,5]
    // Per-index deltas: [0.1, 0.5, 0.3, 1.0] -> sorted [0.1,0.3,0.5,1.0]
    // Median of 4 values = (0.3+0.5)/2 = 0.4; max = 1.0
    const diff = compareStructural(oracle, candidate);
    expect(diff.maxSizeDeltaIn).toBeCloseTo(1.0, 6);
    expect(diff.medianSizeDeltaIn).toBeCloseTo(0.4, 6);
  });

  it('is 0 when either side has no nodes', () => {
    const empty = parseSvekDot('digraph unix {\n}');
    const withNodes = parseSvekDot(dot({ minlen: 0 }));
    const diff = compareStructural(empty, withNodes);
    expect(diff.medianSizeDeltaIn).toBe(0);
    expect(diff.maxSizeDeltaIn).toBe(0);
  });
});
