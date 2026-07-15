/**
 * Unit tests for `frontier-shadow-layout.ts` — the isolated graphviz-ts
 * shadow graph that reproduces `Cluster.getRectangleArea()`'s pre-
 * `manageEntryExitPoint` value (the `initial` `FrontierCalculator` needs,
 * see that module's doc comment for why the real `layoutGraph()`
 * construction isn't reused for this).
 *
 * `component/gafegu-06-nito976`'s real graphviz-native numbers (`dot
 * -Txdot` on the jar's own cached `svek-1.dot`, cross-checked against
 * graphviz-ts directly — decision-journal.md's J2 entry) are the oracle:
 * cluster bb `(8,8)-(177,121)` (native y-up), 4 ports at native y=107,
 * x=22/69/116/163, each 12x12, nodesep=35/ranksep=60, anchor 50x17 (this
 * fixture's own title-table render size).
 */
import { describe, test, expect } from 'vitest';
import { computePortClusterInitialRect } from '../../../src/diagrams/description/frontier-shadow-layout.js';

describe('computePortClusterInitialRect', () => {
  test('reproduces gafegu-06\'s exact cluster bb and port centers (converted to y-DOWN)', () => {
    const result = computePortClusterInitialRect({
      ranks: [{
        rank: 'source',
        ports: [
          { id: 'p80', width: 12, height: 12 },
          { id: 'p81', width: 12, height: 12 },
          { id: 'p82', width: 12, height: 12 },
          { id: 'p83', width: 12, height: 12 },
        ],
      }],
      anchorWidth: 50, anchorHeight: 17,
      nodeSep: 35, rankSep: 60, rankdir: 'TB',
    });

    // Width/height are frame-invariant (unaffected by the native-y-up ->
    // y-DOWN flip this function applies internally) -- the strongest,
    // least frame-fragile check, matching jar's own raw graphviz bb
    // `(8,8)-(177,121)` (`dot -Txdot` on the jar's cached svek-1.dot).
    expect(result.initial.maxX - result.initial.minX).toBe(169);
    expect(result.initial.maxY - result.initial.minY).toBe(113);
    // X is unaffected by the y-flip too -- assert the exact jar values.
    expect(result.initial.minX).toBeCloseTo(8, 5);
    expect(result.initial.maxX).toBeCloseTo(177, 5);

    // Port centers: x positions match jar's exactly; y is uniform across
    // the single rank (all ports at the same native y=107). This isolated
    // shadow graph is self-contained (just the cluster, no other diagram
    // content), so its own root bb total height differs from the real
    // fixture's full-diagram height -- 22 is this SELF-CONTAINED graph's
    // own y-DOWN value (verified directly against graphviz-ts's own xdot
    // output, not derived from the real fixture's unrelated total height).
    const xs = ['p80', 'p81', 'p82', 'p83'].map((id) => result.portCenters.get(id)!.x);
    expect(xs).toEqual([22, 69, 116, 163]);
    const ys = ['p80', 'p81', 'p82', 'p83'].map((id) => result.portCenters.get(id)!.y);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBe(22);
  });

  test('a two-rank (source+sink) cluster produces TWO distinct port-center y values', () => {
    const result = computePortClusterInitialRect({
      ranks: [
        { rank: 'source', ports: [{ id: 'in0', width: 12, height: 12 }] },
        { rank: 'sink', ports: [{ id: 'out0', width: 12, height: 12 }] },
      ],
      anchorWidth: 40, anchorHeight: 16,
      nodeSep: 20, rankSep: 40, rankdir: 'TB',
    });
    const inY = result.portCenters.get('in0')!.y;
    const outY = result.portCenters.get('out0')!.y;
    expect(inY).not.toBeCloseTo(outY, 1);
  });

  test('ids requiring DOT quoting (a qualified id with a period, e.g. `set separator .`) round-trip correctly', () => {
    // Regression: this module's internal xdot text-parsing must never key
    // off the caller's own id text directly (a bare-vs-quoted DOT
    // serialization mismatch broke `component/bujige-52-gase998`'s
    // `srv1.br0`/`srv2.br0` ids before the synthetic-safe-id fix -- see
    // decision-journal.md's J2 entry).
    const result = computePortClusterInitialRect({
      ranks: [{
        rank: 'source',
        ports: [
          { id: 'srv1.br0', width: 12, height: 12 },
          { id: 'srv2.br0', width: 12, height: 12 },
        ],
      }],
      anchorWidth: 40, anchorHeight: 16,
      nodeSep: 35, rankSep: 60, rankdir: 'TB',
    });
    expect(result.portCenters.has('srv1.br0')).toBe(true);
    expect(result.portCenters.has('srv2.br0')).toBe(true);
    expect(result.portCenters.get('srv1.br0')!.x).not.toBe(result.portCenters.get('srv2.br0')!.x);
  });

  test('rankdir=LR is accepted without throwing', () => {
    expect(() => computePortClusterInitialRect({
      ranks: [{ rank: 'source', ports: [{ id: 'a', width: 12, height: 12 }] }],
      anchorWidth: 40, anchorHeight: 16,
      nodeSep: 20, rankSep: 40, rankdir: 'LR',
    })).not.toThrow();
  });
});
