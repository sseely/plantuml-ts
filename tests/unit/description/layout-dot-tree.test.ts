/**
 * Mission G5/C1, site 5: `description/layout.ts#layoutDescription`'s
 * edge-label `FontSpec` (feeding `layout-dot-tree.ts#buildDotEdges` via
 * `link-edge-attrs.ts#buildLinkEdgeAttributes`/`computeGraphSpacing`) must
 * measure link-label text at upstream's `FontParam.ARROW` default size
 * (13), not `theme.fontSize` (14, `FontParam.COMPONENT`'s body-text
 * default) — `plans/g5-measurer-calibration/ledger.md` §C0's jar-verified
 * diagnosis. The RENDER-side sibling (`renderer-edge.ts`'s
 * `ARROW_LABEL_FONT_SIZE`) was already fixed under an earlier mission
 * ("G1 I2"); this is the LAYOUT side.
 *
 * Unlike state/class, `layoutDescription`'s `fontSpec` is shared with
 * NODE/title measurement (`buildDotNodes`, `buildPortClusterInfoByAstId`)
 * — those must stay at `theme.fontSize` (14, `FontParam.COMPONENT`
 * default). The fix threads a SEPARATE `edgeFontSpec` (13) to ONLY the
 * two edge-label-consuming calls inside `runLayout`
 * (`buildDotEdges`/`computeGraphSpacing`), leaving node measurement
 * (`buildDotNodes`, `buildPortClusterInfoByAstId`) on the unchanged
 * `fontSpec` (14).
 *
 * `babafi-51-dixi026`'s `a ..> b : use` is the corpus's real oracle
 * fixture exercising this exact call site: its cached `in.svg` reports
 * `<text font-size="13" textLength="20.9625">use</text>` — jar's own
 * ground truth. The SAME fixture's entity body text (`"b"`, `"can be
 * used by a"`) stays at font-size 14 — used here as a regression guard
 * that node measurement was NOT accidentally narrowed too.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../../src/index.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test-results/dot-cache/component',
);

const measurer = new WidthTableMeasurer();

function captureAll(puml: string): DotInputGraph[] {
  const captured: DotInputGraph[] = [];
  setLayoutInputObserver((g) => captured.push(g));
  try {
    renderSync(puml, { measurer });
  } finally {
    setLayoutInputObserver(undefined);
  }
  return captured;
}

describe('description/layout.ts layoutDescription — edge-label font size (site 5)', () => {
  it('measures "use" at font-size 13 (jar-exact 20.9625px), not 14 (babafi-51-dixi026)', () => {
    const puml = readFileSync(join(CACHE, 'babafi-51-dixi026', 'in.puml'), 'utf8');
    const graphs = captureAll(puml);
    const edge = graphs.flatMap((g) => g.edges).find((e) => e.attributes?.label === 'use');
    expect(edge, 'expected a DOT edge labeled "use"').toBeDefined();
    const expectedAt13 = measurer.measure('use', { family: 'sans-serif', size: 13 }).width;
    const expectedAt14 = measurer.measure('use', { family: 'sans-serif', size: 14 }).width;
    expect(expectedAt13).toBeCloseTo(20.9625, 3);
    expect(expectedAt14).not.toBeCloseTo(expectedAt13, 3);
    expect(edge!.attributes!.labelWidth).toBeCloseTo(expectedAt13, 6);
    expect(edge!.attributes!.labelWidth).not.toBeCloseTo(expectedAt14, 3);
  });

  it('does NOT narrow node/title measurement — "b" entity node stays at font-size 14', () => {
    const puml = readFileSync(join(CACHE, 'babafi-51-dixi026', 'in.puml'), 'utf8');
    const graphs = captureAll(puml);
    const node = graphs.flatMap((g) => g.nodes).find((n) => n.id === 'b');
    expect(node, 'expected a DOT node "b"').toBeDefined();
    // "can be used by a" is b's second body line -- the corpus's own
    // widest measured string for this entity (91.0875px @ size 14 per
    // the oracle in.svg); node width must still reflect the SIZE-14
    // measurement, not the (now correct, but node-irrelevant) size-13
    // edge-label default.
    const expectedBodyAt14 = measurer.measure('can be used by a', { family: 'sans-serif', size: 14 }).width;
    expect(expectedBodyAt14).toBeCloseTo(91.0875, 3);
    expect(node!.width).toBeGreaterThanOrEqual(expectedBodyAt14);
  });
});
