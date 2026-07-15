/**
 * Unit tests for `frontier-cluster-bbox.ts` — wires `frontier-calculator
 * .ts` and `frontier-shadow-layout.ts` into the `Bbox` a port cluster's
 * `buildGeoNode` (layout.ts) uses in place of `computeContainerBbox`.
 */
import { describe, test, expect } from 'vitest';
import {
  computePortClusterBbox, type PortClusterInfo, type ClusterSpacing,
} from '../../../src/diagrams/description/frontier-cluster-bbox.js';
import type { DescriptionNodeGeo } from '../../../src/diagrams/description/layout-helpers.js';

function portGeo(id: string, x: number, y: number): DescriptionNodeGeo {
  return { id, symbol: 'port', display: id, x, y, width: 12, height: 12, children: [] };
}

function leafGeo(id: string, x: number, y: number, width: number, height: number): DescriptionNodeGeo {
  return { id, symbol: 'component', display: id, x, y, width, height, children: [] };
}

const TB_SPACING: ClusterSpacing = { nodeSep: 35, rankSep: 60, rankdir: 'TB' };

describe('computePortClusterBbox (insides empty — gafegu-06-nito976 shape)', () => {
  test('matches jar\'s exact 177x99 result once shifted to this cluster\'s own already-resolved port positions', () => {
    // Mirrors gafegu-06's real, already-resolved (raw, pre-ink-shift) port
    // x positions -- relative spacing (gaps of 47 = nodesep 35 + width 12)
    // is what the real pipeline already gets right; only the cluster's own
    // box needed FrontierCalculator. y arbitrary (23, distinct from the
    // shadow calc's own internal frame -- the alignment step must not
    // assume they coincide).
    const children = [
      portGeo('p80', 23, 23), portGeo('p81', 70, 23),
      portGeo('p82', 117, 23), portGeo('p83', 164, 23),
    ];
    const info: PortClusterInfo = {
      ranks: [{ rank: 'source', nodeIds: ['p80', 'p81', 'p82', 'p83'] }],
      anchorWidth: 50, anchorHeight: 17, titleWidth: 50, titleHeight: 17,
    };
    const bbox = computePortClusterBbox(children, info, TB_SPACING);
    expect(bbox.width).toBe(177);
    expect(bbox.height).toBe(99);
  });

  test('is translation-invariant: shifting every port by the same (dx,dy) shifts the bbox by the same amount, not the size', () => {
    const base = [
      portGeo('p80', 23, 23), portGeo('p81', 70, 23),
      portGeo('p82', 117, 23), portGeo('p83', 164, 23),
    ];
    const shifted = base.map((c) => ({ ...c, x: c.x + 1000, y: c.y + 500 }));
    const info: PortClusterInfo = {
      ranks: [{ rank: 'source', nodeIds: ['p80', 'p81', 'p82', 'p83'] }],
      anchorWidth: 50, anchorHeight: 17, titleWidth: 50, titleHeight: 17,
    };
    const bboxBase = computePortClusterBbox(base, info, TB_SPACING);
    const bboxShifted = computePortClusterBbox(shifted, info, TB_SPACING);
    expect(bboxShifted.width).toBe(bboxBase.width);
    expect(bboxShifted.height).toBe(bboxBase.height);
    expect(bboxShifted.x - bboxBase.x).toBeCloseTo(1000, 5);
    expect(bboxShifted.y - bboxBase.y).toBeCloseTo(500, 5);
  });

  test('ensureMinWidth widens the box when the cluster title is wider than the port-driven box', () => {
    const children = [portGeo('p0', 0, 0)];
    const info: PortClusterInfo = {
      ranks: [{ rank: 'source', nodeIds: ['p0'] }],
      anchorWidth: 40, anchorHeight: 16,
      titleWidth: 500, titleHeight: 16, // far wider than a single 12px port could drive
    };
    const bbox = computePortClusterBbox(children, info, TB_SPACING);
    expect(bbox.width).toBeGreaterThanOrEqual(510); // titleWidth + 10 (java:427-428)
  });
});

describe('computePortClusterBbox (fallback cases)', () => {
  test('falls back to the padded-union formula when the cluster has normal ("insides") children too', () => {
    // component/cuxelu-66-zopu195 shape: `[API Server]` (normal) +
    // `portout httpout` (port) in the SAME container -- regressed 26->27
    // diffs when routed through the (approximated) shadow-calc path; see
    // frontier-cluster-bbox.ts's own doc comment for why this case is
    // scoped OUT of mechanism B for now.
    const children = [
      leafGeo('api', 20, 20, 100, 40),
      portGeo('httpout', 150, 20),
    ];
    const info: PortClusterInfo = {
      ranks: [{ rank: 'sink', nodeIds: ['httpout'] }],
      anchorWidth: 40, anchorHeight: 16, titleWidth: 40, titleHeight: 16,
    };
    const bbox = computePortClusterBbox(children, info, TB_SPACING);
    // computeContainerBbox's own padded-union formula (layout-helpers.ts):
    // x = minX - 16, y = minY - 28, width = span + 32, height = span + 44.
    expect(bbox).toEqual({ x: 4, y: -8, width: 174, height: 84 });
  });

  test('falls back to the padded-union formula when no configured port id resolves a real child', () => {
    const children = [leafGeo('only', 0, 0, 50, 30)];
    const info: PortClusterInfo = {
      ranks: [{ rank: 'source', nodeIds: ['missing-port'] }],
      anchorWidth: 40, anchorHeight: 16, titleWidth: 0, titleHeight: 0,
    };
    const bbox = computePortClusterBbox(children, info, TB_SPACING);
    expect(bbox).toEqual({ x: -16, y: -28, width: 82, height: 74 });
  });
});
