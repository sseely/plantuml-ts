/**
 * Global autarkic-pass firing order (mission A4 Phase L iteration 17) —
 * `CucaDiagramSimplifierState.getOrdered` port. Upstream resolves autarkic
 * groups across the WHOLE diagram tree in one GLOBAL order: deepest nesting
 * level first, source/declaration order as tie-break within a level — not
 * per-branch depth-first (finish sibling A's whole subtree before starting
 * sibling B). `state-composite-pass.ts`'s old recursion fired each
 * composite's own pass INLINE the moment `resolveMember` reached it, which
 * swaps the dump order for structurally-twin sibling composites at different
 * depths across branches: leloja-87-tebi184 has TWO top-level siblings
 * (comp1, comp2), each containing one further-nested autonom composite
 * (common_comp1, common_comp2) — the correct global order resolves BOTH
 * depth-2 composites (common_comp1, common_comp2) before EITHER depth-1
 * composite's own pass (comp1, comp2), but the old per-branch recursion
 * resolved comp1's own pass before common_comp2 even started.
 *
 * These tests pin the EXACT POSITIONAL firing order against the cached
 * oracle svek-N.dot dumps (test-results/dot-cache/state/<slug>/) — a
 * strictly stronger assertion than `state-autarkic.test.ts`'s "same graph
 * COUNT" checks, since a content-preserving reorder passes those.
 *
 * @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#getOrdered
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

/** Asserts every captured pass (except `skipIndices`) is structurally EQUAL
 *  to the oracle dump at the SAME position (0-based candidate index ==
 *  1-based svek-N.dot). A content-preserving swap (twin siblings) fails
 *  here even though it would pass a graph-COUNT-only check. */
function expectPositionalOrderEqual(slug: string, skipIndices: ReadonlySet<number> = new Set()): void {
  const files = svekFiles(slug);
  const captured = captureAll(readPuml(slug));
  expect(captured, `${slug}: graph count`).toHaveLength(files.length);
  for (let i = 0; i < files.length; i++) {
    if (skipIndices.has(i)) continue;
    const oracle = parseSvekDot(readFileSync(join(CACHE, slug, files[i]!), 'utf8'));
    const candidate = dotInputToStructural(captured[i]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `${slug} graph #${i}: failing checks: ${failing.join(', ')}`).toBe(true);
  }
}

describe('global autarkic-pass ordering — leloja-87-tebi184 (twin sibling composites)', () => {
  it('fires exactly 5 passes, each positionally EQUAL to the oracle dump', () => {
    expectPositionalOrderEqual('leloja-87-tebi184');
  });
});

describe('global autarkic-pass ordering — joleju-94-maru748 (nested concurrent siblings)', () => {
  it('fires exactly 12 passes, ALL positionally EQUAL to the oracle dump', () => {
    // Iteration 17 left graphs #5/#6 as a known residual (a DIFFERENT
    // mechanism than the twin-sibling composite reorder this describe
    // block's OTHER test pins): oracle #5 is `OS1.IS1`'s 2nd concurrent
    // region (a NOTE-only region, `Note.OS1.IS1`) and oracle #6 is
    // `OS1.IS2`'s own region-0 build (`IS2.1`, a plain leaf) -- both are
    // depth-3 firing-order entries, correctly ordered RELATIVE TO EACH
    // OTHER, but the OLD (iteration 17) port had no firing-order entry for
    // a concurrent REGION at all: it fired a composite's ENTIRE region set
    // (region-0's build LAST, each `--` region before it) as one atomic
    // bundle at the composite's OWN turn. `OS1.IS2`'s region-0 build
    // (`IS2.1`) rode along INSIDE `OS1.IS2`'s bundle instead of at ITS OWN
    // depth-3 slot, landing one position too early (#4) and pushing
    // `OS1.IS1`'s 2nd region (also depth-3, but belonging to a DIFFERENT
    // composite) one slot late (#5/#6 swapped relative to `OS1.IS1`'s CONC1
    // region, which correctly lands at #4 as the flattened `IS1.2` node).
    // Mission A4 Phase L iteration 19 (joleju-94-maru748) promotes every
    // `--`-delimited region to its own firing-order entry (`FiringUnit`,
    // state-composite-classify.ts) at the region's TRUE depth
    // (`owner.depth + 1` -- `Entity.isAutarkic`'s `GroupType.CONCURRENT_STATE`
    // short-circuit, abel/Entity.java:700-701, means a region is
    // unconditionally autarkic regardless of its owner's own
    // autonom/cluster classification), fixing the residual.
    expectPositionalOrderEqual('joleju-94-maru748');
  });
});

describe('global autarkic-pass ordering — jijuze-43-ceva131 (region under a non-autarkic owner)', () => {
  it('fires exactly 2 passes — the CONC region is NOT double-built by resolveClusterComposite', () => {
    // `XA6 { XA6 --> XA1 -- state XA13 }`: the crossing `XA6 --> XA1`
    // self-reference disqualifies XA6 itself from 'autonom' (classified
    // 'cluster'), but its lone `--` region (XA13) is UNCONDITIONALLY
    // autarkic regardless (`Entity.isAutarkic`'s `GroupType.CONCURRENT_STATE`
    // short-circuit) and still gets its own firing-order pass. Mission A4
    // Phase L iteration 19 promoted every region to a firing-order entry
    // (`resolveAllAutonomPasses` -> `ctx.resolvedRegions`), but
    // `resolveClusterComposite`'s PRE-EXISTING iteration-16
    // `buildConcurrentRegionLeaf` mechanism (state-composite-cluster.ts)
    // independently rebuilt the SAME region inline, producing a spurious
    // 3rd graph the oracle never has (oracle=2, candidate=3) until
    // `buildConcurrentRegionLeaf` was rewritten to LOOK UP the
    // already-resolved pass from `ctx.resolvedRegions` instead.
    expectPositionalOrderEqual('jijuze-43-ceva131');
  });
});
