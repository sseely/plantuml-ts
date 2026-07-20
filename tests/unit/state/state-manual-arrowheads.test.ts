/**
 * Mission G4 S8, mechanism 19 (transition `path/@d` routing): every state
 * `DotInputGraph` construction site must set `manualArrowheads: true`, the
 * SAME flag `class/class-dot-graph.ts` already carries (G2 N29) and
 * `description/layout.ts` already carries (I9). Jar's own svek-DOT emitter
 * unconditionally writes `arrowtail=none,arrowhead=none` on EVERY edge line
 * (`svek-dot-emit.ts`, corpus-wide) because state (mission G4 S1 mechanism
 * 3, matching class's G2 N1) draws its arrowhead as an inline `<polygon>`
 * at the raw spline endpoint, not an SVG `<marker>`. Without this flag,
 * `graph-layout-build.ts#addEdges` defaults to `arrowhead=normal` and
 * graphviz-ts reserves a ~10-11px arrow-clip gap when solving the spline,
 * shortening every routed transition well short of its target node's
 * boundary — verified directly against real `dot -Tplain` on
 * `nelupe-49-xova546`'s own pinned `oracle/goldens/state/<slug>/svek-3.dot`
 * golden (circle→rounded-rect, minlen=1): real dot's edge spans
 * y=85.69→50.27 (reaching to within 0.27px of the target's 50pt-high
 * boundary), matching jar's own final `*start*s7_2-to-chat1` path
 * (`M46.11,62.31 C46.11,71.35 46.11,80.49 46.11,92.73`, a single
 * 1+3*1-point bezier segment) — but the SAME node/edge geometry fed
 * through `layoutGraph()` without `manualArrowheads` stopped at y=44.51,
 * ~11.5px short of the 56px target boundary. This is the SAME root cause
 * G2 N29 already diagnosed and fixed for class (a seam invocation gap, not
 * a graphviz-ts engine bug) — state's S1 arrowhead-rendering switch never
 * carried the flag over.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../../src/index.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { renderFixtureState } from '../../oracle/svg-conformance/render-fixture-state.js';

const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test-results/dot-cache/state',
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

afterAll(() => setLayoutInputObserver(undefined));

describe('state DotInputGraph — manualArrowheads (mission G4 S8, mechanism 19)', () => {
  it('flat pipeline: a single-scope state diagram sets manualArrowheads on its ONE captured graph', () => {
    const puml = readFileSync(join(CACHE, 'gizati-67-kora187', 'in.puml'), 'utf8');
    const captured = captureAll(puml);
    expect(captured.length).toBeGreaterThan(0);
    for (const g of captured) {
      expect(g.manualArrowheads, 'every flat-pipeline layout call must set manualArrowheads').toBe(true);
    }
  });

  it('composite pipeline: EVERY pass (region + top-level) sets manualArrowheads', () => {
    const puml = readFileSync(join(CACHE, 'bajelo-54-dixe684', 'in.puml'), 'utf8');
    const captured = captureAll(puml);
    expect(captured.length).toBeGreaterThan(1); // composite: multiple svek passes
    for (const g of captured) {
      expect(g.manualArrowheads, 'every composite-pipeline layout call must set manualArrowheads').toBe(true);
    }
  });

  it('nelupe-49-xova546: the s7_2-to-chat1 transition path reaches the jar-exact endpoint', () => {
    // Numeric-tolerant, mirroring this project's own established
    // conformance bar (tests/oracle/svg-conformance/compare.ts's 0.01
    // absolute-delta tolerance) -- jar's own Smetana spline solver and
    // graphviz-ts's solver land on the SAME single-segment shape and
    // endpoints (both a 1+3*1 bezier from the circle's bottom to just
    // short of chat1's top boundary) but differ by a few thousandths of a
    // pixel on the two interior control points, well inside that bar.
    const puml = readFileSync(join(CACHE, 'nelupe-49-xova546', 'in.puml'), 'utf8');
    const svg = renderFixtureState(puml, new DeterministicMeasurer());
    const pathMatch = /<path d="([^"]*)"[^>]*id="\*start\*s7_2-to-chat1"/.exec(svg);
    expect(pathMatch, 'expected a <path> element carrying id="*start*s7_2-to-chat1"').not.toBeNull();
    const d = pathMatch![1]!;
    // 1+3*1 = 4 points, ONE C segment -- not the pre-S8 3-segment Catmull-Rom shape.
    expect(d.match(/C/g)?.length).toBe(1);
    const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    const jarNums = [46.11, 62.31, 46.11, 71.35, 46.11, 80.49, 46.11, 92.73];
    expect(nums).toHaveLength(jarNums.length);
    nums.forEach((n, i) => expect(n).toBeCloseTo(jarNums[i]!, 1));
  });
});
