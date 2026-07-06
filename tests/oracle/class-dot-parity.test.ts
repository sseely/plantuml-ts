/**
 * Oracle DOT-parity HARNESS check for class diagrams.
 *
 * Goal right now is NOT parity — plantuml-ts is not yet faithful to PlantUML.
 * The oracle is the target we are mapping, not a bar to pass. So this test only
 * asserts the comparison HARNESS is healthy (each class golden renders, the
 * layout seam is captured, and a well-formed structural diff is produced). The
 * actual oracle-vs-candidate gap is reported by `scripts/oracle-gap.ts` into
 * oracle/GAP.md — that report, not a green assertion, is the deliverable.
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

const GOLDENS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../oracle/goldens/class',
);

const fixtures = readdirSync(GOLDENS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => existsSync(join(GOLDENS, name, 'svek-1.dot')))
  .sort();

let captured: DotInputGraph[] = [];
beforeAll(() => setLayoutInputObserver((g) => captured.push(g)));
afterAll(() => setLayoutInputObserver(undefined));

describe('oracle DOT parity harness — class diagrams', () => {
  it('has goldens to compare', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const name of fixtures) {
    it(`${name}: renders, captures, and produces a structural diff`, () => {
      captured = [];
      const svg = renderSync(readFileSync(join(GOLDENS, name, 'input.puml'), 'utf8'), {
        measurer: new WidthTableMeasurer(),
      });
      expect(svg).not.toContain('PlantUML error');
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
