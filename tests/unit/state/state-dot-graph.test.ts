/**
 * Mission G5/C1, site 1: `state-dot-graph.ts#buildDotEdges` (the FLAT
 * pipeline's transition-label `FontSpec`) must measure edge/transition
 * label text at upstream's `FontParam.ARROW` default size (13), not
 * `theme.fontSize` (14, `FontParam.STATE`'s body-text default) —
 * `plans/g5-measurer-calibration/ledger.md` §C0's jar-verified diagnosis.
 *
 * `buniva-95-zije634` (flat, two states, `A -> B : xxx` / `B -> A : xxx`,
 * zero composite nesting — this port's own `nested-markers` grep confirms
 * the FLAT pipeline, not `state-composite-pass.ts`) is the corpus's
 * minimal oracle fixture directly exercising this exact call site: its
 * cached `in.svg` (`test-results/dot-cache/state/buniva-95-zije634/in.svg`)
 * reports `<text font-size="13" textLength="19.5">xxx</text>` for BOTH
 * transitions — jar's own ground truth for "xxx" at size 13.
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
  '../../../test-results/dot-cache/state',
);

const measurer = new WidthTableMeasurer();

function captureFirst(puml: string): DotInputGraph {
  let captured: DotInputGraph | undefined;
  setLayoutInputObserver((g) => { captured ??= g; });
  try {
    renderSync(puml, { measurer });
  } finally {
    setLayoutInputObserver(undefined);
  }
  return captured!;
}

describe('state-dot-graph.ts buildDotEdges — flat-pipeline transition label font size', () => {
  it('measures "xxx" at font-size 13 (jar-exact 19.5px), not 14 (buniva-95-zije634)', () => {
    const puml = readFileSync(join(CACHE, 'buniva-95-zije634', 'in.puml'), 'utf8');
    const graph = captureFirst(puml);
    const labeled = graph.edges.filter((e) => e.attributes?.label === 'xxx');
    expect(labeled).toHaveLength(2);
    const expectedAt13 = measurer.measure('xxx', { family: 'sans-serif', size: 13 }).width;
    const expectedAt14 = measurer.measure('xxx', { family: 'sans-serif', size: 14 }).width;
    expect(expectedAt13).toBeCloseTo(19.5, 3);
    expect(expectedAt14).not.toBeCloseTo(expectedAt13, 3);
    for (const e of labeled) {
      expect(e.attributes!.labelWidth).toBeCloseTo(expectedAt13, 6);
      expect(e.attributes!.labelWidth).not.toBeCloseTo(expectedAt14, 3);
    }
  });
});
