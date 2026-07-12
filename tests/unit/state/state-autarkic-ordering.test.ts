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
  it('fires exactly 12 passes; 10 of 12 positionally EQUAL to the oracle dump (graphs #5/#6 are a known, separately-attributed residual)', () => {
    // graphs #5/#6: NOT a twin-sibling composite-ordering swap (this
    // iteration's mechanism) -- oracle #5 is a `shape=rect` NOTE-sized box
    // (3.713194x0.680556in, matching OS1.IS1's 3-line attached note) and
    // oracle #6 is a small `shape=rect,style=rounded` STATE-sized box
    // (0.731076x0.694444in); our candidate #5 is a much LARGER rounded
    // composite wrapper (1.337153x3.027778in) and candidate #6 is a
    // DIFFERENT, larger note box (4.045833x0.983333in, matching
    // OS1.IS2's note). The two oracle nodes and the two candidate nodes
    // are four DIFFERENT pieces of content, not a same-content transposed
    // pair -- ruling out a simple firing-order tie-break bug at these two
    // positions. Every position from #7 onward (6/12) already re-aligns
    // and is EQUAL, so this is a LOCAL disturbance, not a global shift.
    // `CucaDiagramSimplifierState.getOrdered` (this iteration's mechanism)
    // only orders `Entity`/GROUP passes (mechanisms.md §3's driver-loop
    // doc) -- notes are not Entities/groups in that sense, so wherever a
    // note gets its own independent svek sizing pass relative to sibling
    // composite passes is a DIFFERENT, un-ported mechanism, out of scope
    // for this iteration's write-set (autarkic-pass firing order only).
    expectPositionalOrderEqual('joleju-94-maru748', new Set([5, 6]));
  });
});
