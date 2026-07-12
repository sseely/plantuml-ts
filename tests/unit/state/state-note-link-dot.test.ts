/**
 * `note on link` edge-label DOT parity + `skinparam linetype ortho`
 * xlabel-routing tests (mission A4 Phase L, labelOk bucket close-out).
 * TDD-pinned to cached oracle dumps under
 * `test-results/dot-cache/state/<slug>/svek-N.dot`.
 *
 * Two DISTINCT mechanisms close this bucket (diagnosed via drilldown, NOT
 * conflated — see the decision journal):
 *
 *  1. `note on link` text was parsed (`Transition.linkNote`) but never fed
 *     into the edge's DOT label at all — `SvekEdge.java:308-326` merges a
 *     transition's own label with any attached `note on link` (mergeLR for
 *     LEFT/RIGHT, mergeTB for TOP/BOTTOM) into ONE combined `labelText`
 *     before the `hasNoteLabelText()`/`label=`/`xlabel=` branch below even
 *     runs. Fixtures: fotigo-12-gufu949 (2 colored notes, no own label),
 *     vateco-92-pece508 (1 uncolored inline note), tumaba-64-tosu281 and
 *     xupefu-98-roni234 (multi-line `note [pos] on link ... end note`
 *     block form — a parser gap, not just a DOT-emission gap: this form was
 *     entirely unparsed before this iteration).
 *  2. `skinparam linetype ortho` routes ANY non-empty edge label (own label
 *     OR merged note) through `xlabel=` instead of `label=`
 *     (`SvekEdge.java:434-441`, `dotSplines == DotSplines.ORTHO` branch) —
 *     completely independent of note-on-link; pavuzo-79-zodu430 has NO
 *     `note on link` at all, its `Idle --> Configuring : EvConfig` plain
 *     transition label is what gets rerouted. Ported from the class engine's
 *     PRE-EXISTING `moveLabelToXlabel` (class-dot-graph.ts) — same upstream
 *     citation, small enough to close in the same iteration as (1).
 *
 * Mirrors state-dot-flat.test.ts / state-composites-dot.test.ts's capture
 * harness (`setLayoutInputObserver` + `compareStructural`).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../../src/index.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import { parseSvekDot, dotInputToStructural, compareStructural } from '../../oracle/svek-dot.js';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '../../../test-results/dot-cache/state');

const measurer = new WidthTableMeasurer();

function readPuml(slug: string): string {
  return readFileSync(join(CACHE, slug, 'in.puml'), 'utf8');
}

function svekFiles(slug: string): string[] {
  return readdirSync(join(CACHE, slug))
    .filter((f) => /^svek-\d+\.dot$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
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

/** Assert every captured pass is structurally EQUAL to its oracle dump,
 *  reporting which checks failed (mirrors the other state-*-dot test files'
 *  loop). */
function expectAllPassesEqual(slug: string): void {
  const files = svekFiles(slug);
  const captured = captureAll(readPuml(slug));
  expect(captured, `${slug}: expected ${files.length} captured pass(es)`).toHaveLength(files.length);
  for (let i = 0; i < files.length; i++) {
    const oracle = parseSvekDot(readFileSync(join(CACHE, slug, files[i]!), 'utf8'));
    const candidate = dotInputToStructural(captured[i]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `${slug} svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Mechanism 1: note-on-link text merged into the edge label
// ---------------------------------------------------------------------------

describe('note-on-link edge labels — mechanism 1 (merge into label=)', () => {
  it('fotigo-12-gufu949: two colored notes on separate links, no own label', () => {
    expectAllPassesEqual('fotigo-12-gufu949');
  });

  it('vateco-92-pece508: single inline note on link, no own label', () => {
    expectAllPassesEqual('vateco-92-pece508');
  });

  it('tumaba-64-tosu281: multi-line block-form note on link (composite)', () => {
    expectAllPassesEqual('tumaba-64-tosu281');
  });

  it('xupefu-98-roni234: multi-line block-form note top/bottom on link (composite)', () => {
    expectAllPassesEqual('xupefu-98-roni234');
  });

  it('fotigo-12-gufu949: both edges carry a label (presence, not size)', () => {
    const captured = captureAll(readPuml('fotigo-12-gufu949'));
    const candidate = dotInputToStructural(captured[0]!);
    expect(candidate.edges.filter((e) => e.hasLabel)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Mechanism 2: skinparam linetype ortho routes the label through xlabel=
// ---------------------------------------------------------------------------

describe('skinparam linetype ortho — mechanism 2 (label routed to xlabel=)', () => {
  it('pavuzo-79-zodu430: both svek passes are structurally EQUAL (xlabel, not label)', () => {
    expectAllPassesEqual('pavuzo-79-zodu430');
  });

  it('pavuzo-79-zodu430: EvConfig edges carry xlabel, never label', () => {
    const captured = captureAll(readPuml('pavuzo-79-zodu430'));
    for (const g of captured) {
      const candidate = dotInputToStructural(g);
      for (const e of candidate.edges) {
        if (e.hasLabel || e.hasTailLabel || e.hasHeadLabel) {
          expect.fail('ortho linetype must never emit label=/taillabel=/headlabel=');
        }
      }
    }
    const withXlabel = dotInputToStructural(captured[1]!).edges.filter((e) => e.hasXLabel);
    expect(withXlabel).toHaveLength(2);
  });
});
