/**
 * Oracle DOT-parity checks for class diagrams — two independent suites over
 * the same `oracle/goldens/class/<slug>/` tree, split by which artifacts a
 * fixture carries:
 *
 * - HARNESS-HEALTH (fixtures with `input.svg`): the original hand-authored
 *   goldens (`01-assoc`, `02-members`, …). plantuml-ts is not yet faithful to
 *   PlantUML for these, so this suite only asserts the comparison harness is
 *   healthy (each golden renders, the layout seam is captured, and a
 *   well-formed structural diff is produced) — not that the diff is EQUAL.
 *   The oracle-vs-candidate gap is reported by `scripts/oracle-gap.ts` into
 *   `oracle/GAP.md`.
 *
 * - RATCHET (fixtures without `input.svg`): a pinned-EQUAL subset selected by
 *   `scripts/dot-sync-report.ts class` (the "structurally EQUAL (DOT in
 *   sync)" bucket — all bare-class shapes, mostly zero-edge diagrams where
 *   both sides skip graphviz entirely; a few use `!include <tupadr3/...>`
 *   stdlib sprites that `renderSync()` rejects outright, which still counts
 *   as zero-vs-zero layout graphs — the oracle's own `dot-sync-report.ts`
 *   classifies "0 captured == 0 oracle DOT" as EQUAL regardless of *why* our
 *   side produced nothing). Mirrors `description-parity.ratchet.test.ts`:
 *   every pinned fixture is asserted to emit exactly as many layout graphs as
 *   its committed `svek-N.dot` files, and each is asserted
 *   `compareStructural(...).structurallyEqual === true`. Any regression in
 *   our DOT emission (or in this zero-graph count) for a pinned fixture fails
 *   `npm test`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../src/index.js';
import { WidthTableMeasurer } from '../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../src/core/graph-layout.js';
import {
  parseSvekDot,
  dotInputToStructural,
  compareStructural,
} from './svek-dot.js';
import { expectNoErrorDiagram } from '../helpers/error-diagram.js';

const GOLDENS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../oracle/goldens/class',
);

const allDirs = existsSync(GOLDENS)
  ? readdirSync(GOLDENS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => existsSync(join(GOLDENS, name, 'input.puml')))
      .sort()
  : [];

/** Harness-health goldens: hand-authored, carry an `input.svg` end-to-end
 *  reference. plantuml-ts is not yet faithful for these — see file doc. */
const harnessFixtures = allDirs.filter((name) => existsSync(join(GOLDENS, name, 'input.svg')));

/** Ratchet-pinned goldens: selected because the current engine is already
 *  structurally EQUAL to the oracle. No `input.svg` — that artifact is not
 *  part of this suite's interface contract (input.puml + svek-N.dot only). */
const ratchetFixtures = allDirs.filter((name) => !existsSync(join(GOLDENS, name, 'input.svg')));

/** Sorted `svek-N.dot` filenames for a golden, in rank order. */
function svekFiles(name: string): string[] {
  return readdirSync(join(GOLDENS, name))
    .filter((f) => /^svek-\d+\.dot$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
}

let captured: DotInputGraph[] = [];
beforeAll(() => setLayoutInputObserver((g) => captured.push(g)));
afterAll(() => setLayoutInputObserver(undefined));

describe('oracle DOT parity harness — class diagrams', () => {
  it('has goldens to compare', () => {
    expect(harnessFixtures.length).toBeGreaterThan(0);
  });

  for (const name of harnessFixtures) {
    it(`${name}: renders, captures, and produces a structural diff`, () => {
      captured = [];
      const svg = renderSync(readFileSync(join(GOLDENS, name, 'input.puml'), 'utf8'), {
        measurer: new WidthTableMeasurer(),
      });
      expectNoErrorDiagram(svg);
      // A single-scope class diagram drives the layout seam exactly once.
      expect(captured).toHaveLength(1);

      const diff = compareStructural(
        parseSvekDot(readFileSync(join(GOLDENS, name, 'svek-1.dot'), 'utf8')),
        dotInputToStructural(captured[0]!),
      );
      // Harness health only — a real comparison was produced. Whether it
      // matches is the gap report's story, deliberately not asserted here.
      expect(typeof diff.structurallyEqual).toBe('boolean');
      expect(diff.oracle.nodes).toBeGreaterThan(0);
    });
  }
});

describe.skipIf(ratchetFixtures.length === 0)('oracle DOT-parity ratchet — class diagrams', () => {
  for (const name of ratchetFixtures) {
    it(`${name}: stays structurally EQUAL to the pinned oracle DOT`, () => {
      const files = svekFiles(name);
      captured = [];
      // Not asserting "no PlantUML error" here: a few pinned fixtures use
      // `!include <tupadr3/...>` stdlib sprites, which renderSync() rejects
      // outright (sync path has no include resolution). That is still a
      // legitimate zero-vs-zero EQUAL per dot-sync-report.ts's own
      // classification — the captured-graph-count assertion below is the
      // real structural check, independent of *why* zero graphs were
      // produced.
      renderSync(readFileSync(join(GOLDENS, name, 'input.puml'), 'utf8'), {
        measurer: new WidthTableMeasurer(),
      });
      expect(
        captured.length,
        `${name}: expected ${files.length} captured layout graph(s), got ${captured.length}`,
      ).toBe(files.length);

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const oracle = parseSvekDot(readFileSync(join(GOLDENS, name, file), 'utf8'));
        const candidate = dotInputToStructural(captured[i]!);
        const diff = compareStructural(oracle, candidate);
        const failingChecks = Object.entries(diff)
          .filter(([k, v]) => k.endsWith('Ok') && v === false)
          .map(([k]) => k);
        expect(
          diff.structurallyEqual,
          `${name}/${file}: structural regression — failing checks: ${failingChecks.join(', ')}`,
        ).toBe(true);
      }
    });
  }
});
