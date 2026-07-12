/**
 * zaent PLACEHOLDER POINT node — mission A4 Phase L iteration 18.
 *
 * `ClusterDotString.java`'s trailing content-placeholder branch emits a
 * `shape=point` zaent node whenever a composite has border-point
 * (entry/exit/pin) direct children AND `Cluster#printCluster2`'s `added`
 * variable stays `null` — that variable is set ONLY from
 * `getNodesOrderedWithoutTop(lines)` (this cluster's own DIRECT, non-cluster
 * SvekNodes: plain leaves and flattened autonom composites), NEVER from
 * `for (Cluster child : children) child.printInternal(...)` — a NESTED
 * CLUSTER child recurses into its own `Cluster` object and is invisible to
 * `added`.
 *
 * `hasNonBorderEeContent` (state-composite-detect.ts) previously checked
 * `state.children.some(c => !isBorderPoint(c))` — TRUE for any non-border
 * direct child, INCLUDING a nested cluster composite. This mis-classified
 * `temuxi-28-cega322`'s `module` (direct children: three nested composite
 * clusters `Somp`/`flop`/`counter` plus two border points `ex`/`exitAx`,
 * zero plain leaves) as having "real ee content", suppressing the zaent
 * point the oracle actually emits. Fixed to check `kindOf.get(c.id) !==
 * 'cluster'` — a nested cluster child no longer counts as content;
 * `state-composite-classify.ts`'s `walkClassify` now classifies children
 * (and concurrent regions) BEFORE computing `s`'s own `needsZaentPoint`, so
 * `kindOf` is populated for every direct child by the time this check runs.
 *
 * @see ~/git/plantuml/.../svek/ClusterDotString.java (:91-186)
 * @see ~/git/plantuml/.../svek/Cluster.java#printCluster2 (:550-580, `added`)
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

const GOLDENS = join(dirname(fileURLToPath(import.meta.url)), '../../../oracle/goldens/state');

const measurer = new WidthTableMeasurer();

function readPuml(slug: string): string {
  return readFileSync(join(GOLDENS, slug, 'input.puml'), 'utf8');
}

function svekFiles(slug: string): string[] {
  return readdirSync(join(GOLDENS, slug))
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

function expectStructurallyEqual(oracleFile: string, candidate: DotInputGraph): void {
  const oracle = parseSvekDot(readFileSync(oracleFile, 'utf8'));
  const diff = compareStructural(oracle, dotInputToStructural(candidate));
  const failing = Object.entries(diff)
    .filter(([k, v]) => k.endsWith('Ok') && v === false)
    .map(([k]) => k);
  expect(diff.structurallyEqual, `failing checks: ${failing.join(', ')}`).toBe(true);
}

describe('zaent point — composite whose only non-border direct children are nested CLUSTERS', () => {
  const slug = 'temuxi-28-cega322';
  const puml = readPuml(slug);
  const files = svekFiles(slug);
  const captured = captureAll(puml);

  it('fires exactly 1 pass — "module" is a cluster (border-point direct children disqualify autonom)', () => {
    expect(files).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  it('the pass carries a zaent point node (module has zero direct plain-leaf/autonom children)', () => {
    const pointNodes = captured[0]!.nodes.filter((n) => n.shape === 'point');
    // "module"'s own zaent (Somp/flop/counter's own zaent-eligible children,
    // if any, are asserted separately by structural-equality below — this
    // targets the specific regression: at least module's OWN placeholder.
    expect(pointNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('is structurally EQUAL to the oracle dump (node count 19, incl. the point)', () => {
    expectStructurallyEqual(join(GOLDENS, slug, files[0]!), captured[0]!);
  });
});
