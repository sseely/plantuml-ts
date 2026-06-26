/**
 * Oracle DOT-parity gate for class diagrams.
 *
 * For each committed golden under oracle/goldens/class/, render the fixture
 * through plantuml-ts (capturing the DotInputGraph it feeds graphviz via the
 * layout chokepoint's observer seam) and compare its structure against the
 * oracle's svek-*.dot. The structural checks (node/edge counts, topology,
 * minlen) must match; node sizes are tolerant metrics, reported only.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../src/index.js';
import { FormulaMeasurer } from '../../src/core/measurer.js';
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

// Fixtures plantuml-ts is known to lay out differently from Svek. Tracked, not
// silenced: each is asserted to STILL diverge, so if plantuml-ts ever matches
// the oracle the test fails and prompts promotion into the strict gate.
const KNOWN_DIVERGENCES: Record<string, string> = {
  // Svek wraps the package's members in a graphviz cluster (User, Role as two
  // clustered nodes); plantuml-ts's class layout does not model packages as
  // clusters — it feeds the seam the package node itself, not its members.
  '06-package': 'packages are not modeled as graphviz clusters',
};

// Capture every DotInputGraph layoutGraph() receives during a render.
let captured: DotInputGraph[] = [];
beforeAll(() => setLayoutInputObserver((g) => captured.push(g)));
afterAll(() => setLayoutInputObserver(undefined));

describe('oracle DOT parity — class diagrams', () => {
  it('has goldens to compare', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const name of fixtures) {
    describe(name, () => {
      const puml = readFileSync(join(GOLDENS, name, 'input.puml'), 'utf8');
      const oracleDot = readFileSync(join(GOLDENS, name, 'svek-1.dot'), 'utf8');
      const knownDivergence = KNOWN_DIVERGENCES[name];

      const diffFor = () => {
        captured = [];
        const svg = renderSync(puml, { measurer: new FormulaMeasurer() });
        expect(svg).not.toContain('PlantUML error');
        // A class diagram drives the layout seam exactly once.
        expect(captured).toHaveLength(1);
        return compareStructural(
          parseSvekDot(oracleDot),
          dotInputToStructural(captured[0]!),
        );
      };

      if (knownDivergence !== undefined) {
        it(`known divergence: ${knownDivergence}`, () => {
          // Tracked, not silenced — fails (prompting promotion) if it matches.
          expect(diffFor().structurallyEqual).toBe(false);
        });
        return;
      }

      it('matches the oracle DOT structurally', () => {
        const diff = diffFor();
        // Structural gate (fail-fast): topology must match the oracle.
        expect({
          nodeCountOk: diff.nodeCountOk,
          edgeCountOk: diff.edgeCountOk,
          degreeOk: diff.degreeOk,
          minlenOk: diff.minlenOk,
        }).toEqual({
          nodeCountOk: true,
          edgeCountOk: true,
          degreeOk: true,
          minlenOk: true,
        });
      });
    });
  }
});
