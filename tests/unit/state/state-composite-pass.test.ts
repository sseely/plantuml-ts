/**
 * Mission G5/C1, sites 2 and 3 — WRITTEN TDD-first, PROVEN CORRECT, but
 * NOT LANDED this iteration (see `plans/g5-measurer-calibration/
 * ledger.md` §C1 for the full finding). `state-composite-pass.ts
 * #addLevelEdges` (site 2) and `#sweepOrphanEdges` (site 3) DO need to
 * measure transition-label text at upstream's `FontParam.ARROW` default
 * size (13), not `theme.fontSize` (14) — every assertion below is
 * jar-verified (real oracle `textLength` values from `in.svg`) and PASSES
 * once the one-line font-size fix is applied. (Site 2 is also the S13
 * `bemena-23-zebu249`/`"EvNewValueSaved"` founding evidence's own call
 * site.)
 *
 * REVERTED after landing: applying the fix regressed the PROTECTED
 * `tests/oracle/state-dot-parity.test.ts` size-backlog ratchet (16/17
 * fixtures' `maxSizeDeltaIn` grew past their pinned `size-backlog.json`
 * tolerance — e.g. `bemena-23-zebu249`: 0.2055in actual delta before the
 * fix, 0.2651in after, against a pinned ceiling of 0.2312in). Root cause
 * (bisected site-by-site, `git show HEAD:<path>` A/B, per diagnosis.md):
 * NOT a defect in this fix — every affected fixture ALREADY carried a
 * nonzero `size-backlog.json` entry BEFORE this change (a pre-existing,
 * unrelated gap in how an autonom composite's solved-layout bbox width
 * gets computed from its own internal content, under-crediting the
 * horizontal space an edge label actually needs — the SAME family of gap
 * G4 S11-S13 named "a label-placement divergence" compounding with the
 * measurement gap). Shrinking the label width INPUT (13pt, jar-correct)
 * feeds a SMALLER number through that already-lossy formula, widening the
 * VISIBLE symptom for 16-17 already-imperfect fixtures even though the
 * font-size input itself is now exactly right. Fixing the bbox formula is
 * a separate, larger mechanism (state-composite-autonom.ts or its
 * frontier-bbox equivalent) outside this iteration's five-site write-set
 * -- queued for C2, see the ledger's §C1 recommendation.
 *
 * `nimana-36-veco708` (`plans/state-dot-sync` link-hoisting fixture,
 * `tests/unit/state/state-link-hoisting.test.ts`'s own primary evidence)
 * exercises BOTH call sites in one diagram:
 *   - `no --> yes : go to yes` / `yes --> no : go to no` are declared at
 *     the diagram's TOP scope, both endpoints top-level states — resolved
 *     directly by `addLevelEdges('', ast.transitions, ...)` (site 2's own
 *     top-level call, `state-composite-pass.ts`'s last two lines).
 *   - `yesno --> yesyes : go to yes-yes` / `yesyes --> yesno : go to
 *     yes-no` are declared OUTSIDE the `yes { ... }` block but nested
 *     inside it (real endpoints), so `addLevelEdges` never claims them at
 *     any scope — they land in `ctx.pool` and are picked up by
 *     `sweepOrphanEdges` (site 3) at whichever pass boundary first sees
 *     both endpoints resolved.
 *
 * `bemena-23-zebu249`'s `Configuring { ... NewValuePreview --> NewValueSelection
 * : EvNewValueSaved }` block additionally covers site 2 for a NON-top-level
 * scope call (`state-composite-cluster.ts`'s `addLevelEdges(s.id, ...)`) —
 * the exact S13 founding-evidence call site.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../../src/index.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph, DotInputEdge } from '../../../src/core/graph-layout.js';

const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test-results/dot-cache/state',
);

const measurer = new WidthTableMeasurer();
const size13 = (text: string): number => measurer.measure(text, { family: 'sans-serif', size: 13 }).width;
const size14 = (text: string): number => measurer.measure(text, { family: 'sans-serif', size: 14 }).width;

function readPuml(slug: string): string {
  return readFileSync(join(CACHE, slug, 'in.puml'), 'utf8');
}

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

function findEdgeByLabel(graphs: readonly DotInputGraph[], label: string): DotInputEdge {
  for (const g of graphs) {
    const e = g.edges.find((edge) => edge.attributes?.label === label);
    if (e !== undefined) return e;
  }
  throw new Error(`no edge with label "${label}" found in any captured graph`);
}

// Skipped: source fix reverted this iteration (see file header). Re-enable
// once C2 lands the composite-bbox-width companion fix these depend on.
describe.skip('state-composite-pass.ts addLevelEdges — site 2, top-level scope call', () => {
  const graphs = captureAll(readPuml('nimana-36-veco708'));

  it('measures "go to yes" at font-size 13 (jar-exact 45.5px), not 14', () => {
    const edge = findEdgeByLabel(graphs, 'go to yes');
    expect(size13('go to yes')).toBeCloseTo(45.5, 3);
    expect(size14('go to yes')).not.toBeCloseTo(size13('go to yes'), 3);
    expect(edge.attributes!.labelWidth).toBeCloseTo(size13('go to yes'), 6);
  });

  it('measures "go to no" at font-size 13, not 14', () => {
    const edge = findEdgeByLabel(graphs, 'go to no');
    expect(edge.attributes!.labelWidth).toBeCloseTo(size13('go to no'), 6);
    expect(edge.attributes!.labelWidth).not.toBeCloseTo(size14('go to no'), 3);
  });
});

describe.skip('state-composite-pass.ts addLevelEdges — non-top-level scope call (bemena-23-zebu249, S13 founding evidence)', () => {
  const graphs = captureAll(readPuml('bemena-23-zebu249'));

  it('measures "EvNewValueSaved" at font-size 13 (jar-exact 111.475px), not 14 (120.05px)', () => {
    const edge = findEdgeByLabel(graphs, 'EvNewValueSaved');
    expect(size13('EvNewValueSaved')).toBeCloseTo(111.475, 3);
    expect(size14('EvNewValueSaved')).toBeCloseTo(120.05, 3);
    expect(edge.attributes!.labelWidth).toBeCloseTo(111.475, 3);
    expect(edge.attributes!.labelWidth).not.toBeCloseTo(120.05, 1);
  });
});

describe.skip('state-composite-pass.ts sweepOrphanEdges — site 3', () => {
  const graphs = captureAll(readPuml('nimana-36-veco708'));

  it('measures "go to yes-yes" at font-size 13 (jar-exact 70.0375px), not 14', () => {
    const edge = findEdgeByLabel(graphs, 'go to yes-yes');
    expect(size13('go to yes-yes')).toBeCloseTo(70.0375, 3);
    expect(size14('go to yes-yes')).not.toBeCloseTo(size13('go to yes-yes'), 3);
    expect(edge.attributes!.labelWidth).toBeCloseTo(size13('go to yes-yes'), 6);
  });

  it('measures "go to yes-no" at font-size 13 (jar-exact 64.2688px), not 14', () => {
    const edge = findEdgeByLabel(graphs, 'go to yes-no');
    expect(size13('go to yes-no')).toBeCloseTo(64.2688, 3);
    expect(edge.attributes!.labelWidth).toBeCloseTo(size13('go to yes-no'), 6);
    expect(edge.attributes!.labelWidth).not.toBeCloseTo(size14('go to yes-no'), 3);
  });
});
