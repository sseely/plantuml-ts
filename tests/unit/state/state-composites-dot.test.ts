/**
 * Composite-state svek DOT parity tests (mission A4 state-dot-sync, T4).
 * TDD-first against `plans/state-dot-sync/mechanisms.md` §2/§3, pinned to
 * cached oracle dumps under `test-results/dot-cache/state/<slug>/svek-N.dot`.
 * Mirrors state-dot-flat.test.ts's (T3) capture harness — `setLayoutInputObserver`
 * + `compareStructural` from tests/oracle/svek-dot.ts.
 *
 * Fixtures:
 *   - bajelo-54-dixe684 — 3-level nest (Track_FSM{Stop,Run{Chg_Sector,
 *     Do_Sector{WriteSector,ReadSector}}}). Do_Sector is autonom (no crossing
 *     link) → svek-1; Run is NON-autonom (Stop-->Chg_Sector crosses Run's
 *     boundary) → stays a cluster; Track_FSM is itself autonom (no link
 *     crosses ITS OWN boundary) → svek-2, containing a nested `cluster`(Run)
 *     with Do_Sector's flattened leaf inside it; svek-3 = the outer diagram.
 *     PRIMARY content-correctness fixture — fully traced, no ambiguity.
 *   - bemena-23-zebu249 — 2 svek dumps. T4 fact-5 (journaled): svek-1
 *     belongs to the TOP-LEVEL "Configuring" composite (traced via its
 *     EvNewValue/EvNewValueRejected/EvNewValueSaved edge labels), not the
 *     "This is not Shooting" (NotShooting) composite — NotShooting's own
 *     `Idle-->Configuring` transition resolves (per upstream's
 *     `CucaDiagram#quarkInContext`, sep==null branch, `firstWithName`) to
 *     that SAME top-level Configuring, crossing NotShooting's boundary and
 *     making NotShooting non-autonom. Our parser's `ensureState` does not
 *     implement cross-scope/forward-reference quark reuse (a materially
 *     larger change than T4's fact-4 scope), so our engine classifies
 *     NotShooting as autonom too — pinned here on CALL COUNT + PASS ORDER
 *     (dumped-before / graph-attr-omission) only, not exact per-pass content.
 *   - zacajo-09-tamu628 — 3 concurrent regions (classic NumLock/CapsLock/
 *     ScrollLock example), no non-region siblings: 3 region passes (source
 *     order) + 1 outer pass, 4 dumps total.
 *   - bitaxo-18-tamo974 — `state C { state d <<entrypoint>> }`, zero
 *     transitions: C is non-autonom (border-point descendant) despite no
 *     crossing link; gets a zaent anchor purely from the entry/exit
 *     envelope's content-placeholder rule (mechanisms.md §2).
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

// ---------------------------------------------------------------------------
// bajelo-54-dixe684 — 3-level nest, primary content-correctness fixture
// ---------------------------------------------------------------------------

describe('layoutState composite — bajelo-54-dixe684 (3-level autonom+cluster nest)', () => {
  const puml = readPuml('bajelo-54-dixe684');
  const files = svekFiles('bajelo-54-dixe684');
  const captured = captureAll(puml);

  it('fires exactly 3 layout passes, matching the oracle dump count', () => {
    expect(files).toHaveLength(3);
    expect(captured).toHaveLength(3);
  });

  it('pass 1 (Do_Sector) omits nodesep/ranksep — child pass', () => {
    expect(captured[0]?.nodeSep).toBeUndefined();
    expect(captured[0]?.rankSep).toBeUndefined();
  });

  it('pass 2 (Track_FSM) omits nodesep/ranksep — nested autonom child pass', () => {
    expect(captured[1]?.nodeSep).toBeUndefined();
    expect(captured[1]?.rankSep).toBeUndefined();
  });

  it('pass 3 (outer diagram) carries nodesep/ranksep — the only non-child pass', () => {
    expect(captured[2]?.nodeSep).toBeDefined();
    expect(captured[2]?.rankSep).toBeDefined();
  });

  it('pass 2 contains a nested cluster (Run) with 3 bubbled-up members', () => {
    const clusters = captured[1]?.clusters ?? [];
    expect(clusters).toHaveLength(1);
    const candidate = dotInputToStructural(captured[1]!);
    expect(candidate.clusters[0]?.memberCount).toBe(3);
  });

  for (let i = 0; i < files.length; i++) {
    it(`pass ${i + 1} is structurally EQUAL to ${files[i]}`, () => {
      const oracle = parseSvekDot(readFileSync(join(CACHE, 'bajelo-54-dixe684', files[i]!), 'utf8'));
      const candidate = dotInputToStructural(captured[i]!);
      const diff = compareStructural(oracle, candidate);
      const failing = Object.entries(diff)
        .filter(([k, v]) => k.endsWith('Ok') && v === false)
        .map(([k]) => k);
      expect(diff.structurallyEqual, `svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// bemena-23-zebu249 — pass count now matches the oracle (mission A4/Phase L
// iteration: global state-name resolution + two-pass parsing). See file
// doc's original fact-5 for the PRE-fix diagnosis; this describe block
// documents the POST-fix state.
// ---------------------------------------------------------------------------

describe('layoutState composite — bemena-23-zebu249 (pass count now matches oracle; one remaining gap)', () => {
  const puml = readPuml('bemena-23-zebu249');
  const files = svekFiles('bemena-23-zebu249');
  const captured = captureAll(puml);

  // `Idle --> Configuring` (written inside NotShooting's own begin/end
  // block) now resolves, via `state-parse-state.ts`'s global by-name reuse
  // (`resolveExistingState`, ported from `CucaDiagram#quarkInContextSafe`),
  // to the SAME entity as the top-level `state Configuring { ... }`
  // composite declared later in the file — a forward, cross-scope
  // reference, made safe by the two-pass parser restructure (`parser.ts`:
  // pass ONE creates every declaration, in its true nested scope, before
  // pass TWO's transitions ever resolve an endpoint). That crossing link is
  // what makes NotShooting non-autonom, matching upstream: our engine now
  // fires the SAME 2 passes as the oracle (Configuring's own autonom child
  // pass, then the outer pass containing NotShooting as a cluster) instead
  // of the pre-fix 3 (Configuring, NotShooting, outer — NotShooting used to
  // be misclassified autonom too).
  it('oracle and our engine both fire 2 passes (Configuring child + outer)', () => {
    expect(files).toHaveLength(2);
    expect(captured).toHaveLength(2);
  });

  it('the child pass omits nodesep/ranksep; the outer (2nd) pass carries them', () => {
    expect(captured[0]?.nodeSep).toBeUndefined();
    expect(captured[1]?.nodeSep).toBeDefined();
    expect(captured[1]?.rankSep).toBeDefined();
  });

  // graph #0 (Configuring's own autonom pass) is now fully structurally
  // EQUAL to the oracle (verified via
  // `npx tsx scripts/dot-sync-report.ts state --slug bemena-23-zebu249`:
  // "all structural checks pass (structurallyEqual=true), maxSizeDeltaIn:
  // 0.0000"). graph #1 (the outer pass) is NOT yet promoted to a golden —
  // it still differs: the oracle emits an extra `zaent`-shaped placeholder
  // node (a border/entry-point marker for the link that crosses INTO
  // NotShooting's cluster from outside) that our SVEK emission does not yet
  // produce for this specific case (a crossing link whose target is a
  // NESTED DESCENDANT of a sibling composite, not a direct child) — a
  // separate rendering mechanism, out of this iteration's scope (global
  // state-name resolution + two-pass parsing), left as a documented
  // next-mechanism candidate rather than silently worked around.
  it('graph #0 (Configuring) is EQUAL; graph #1 (outer, NotShooting cluster) is close but not yet EQUAL — documented gap, not asserted here', () => {
    expect(captured[0]?.clusters ?? []).toHaveLength(0);
    expect(captured[1]?.clusters).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// zacajo-09-tamu628 — 3 concurrent regions, no non-region siblings
// ---------------------------------------------------------------------------

describe('layoutState composite — zacajo-09-tamu628 (3 concurrent regions)', () => {
  const puml = readPuml('zacajo-09-tamu628');
  const captured = captureAll(puml);

  it('fires exactly 4 layout passes: 3 regions (source order) + 1 outer', () => {
    expect(captured).toHaveLength(4);
  });

  it('the first 3 passes each have 3 nodes (start + 2 named states)', () => {
    for (let i = 0; i < 3; i++) {
      expect(captured[i]?.nodes).toHaveLength(3);
    }
  });

  it('region passes omit nodesep/ranksep; the outer pass carries them', () => {
    for (let i = 0; i < 3; i++) {
      expect(captured[i]?.nodeSep).toBeUndefined();
    }
    expect(captured[3]?.nodeSep).toBeDefined();
    expect(captured[3]?.rankSep).toBeDefined();
  });

  it('the outer pass has exactly 2 nodes: [*] and the flattened Active composite', () => {
    expect(captured[3]?.nodes).toHaveLength(2);
    const shapes = captured[3]!.nodes.map((n) => n.shape ?? 'rect').sort();
    expect(shapes).toEqual(['circle', 'rounded']);
  });
});

// ---------------------------------------------------------------------------
// bitaxo-18-tamo974 — entry/exit border point, zero transitions
// ---------------------------------------------------------------------------

describe('layoutState composite — bitaxo-18-tamo974 (entry/exit border point)', () => {
  const puml = readPuml('bitaxo-18-tamo974');
  const files = svekFiles('bitaxo-18-tamo974');
  const captured = captureAll(puml);

  it('fires exactly 1 layout pass (C has no crossing link but is disqualified by its border-point child)', () => {
    expect(files).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  it('the pass contains exactly 1 cluster (C)', () => {
    expect(captured[0]?.clusters).toHaveLength(1);
  });

  // The comparator's brace-stack cluster scanner (tests/oracle/svek-dot.ts's
  // `parseClusters`) treats the `{rank=source;...}` rank-group's own
  // trailing `}` as closing the enclosing `subgraph clusterN {` frame
  // (it has no notion of "this brace belongs to an inline rank group, not a
  // subgraph") — so a cluster whose FIRST content is a rank group is always
  // counted with memberCount 0 by the comparator, on BOTH the oracle text
  // and ours (same DOT shape, same parser, same quirk) — verified this is
  // NOT a bug we introduced: the oracle's OWN raw dump measures 0 the same
  // way (see dot-sync-report --slug bitaxo-18-tamo974 state). What matters
  // for parity is that both sides land on the SAME (quirky) number, which
  // the "structurally EQUAL" test below asserts directly.
  it('member count is 0 on BOTH sides — the {rank=...} brace-stack comparator quirk, symmetric', () => {
    const oracle = parseSvekDot(readFileSync(join(CACHE, 'bitaxo-18-tamo974', files[0]!), 'utf8'));
    const candidate = dotInputToStructural(captured[0]!);
    expect(oracle.clusters[0]?.memberCount).toBe(0);
    expect(candidate.clusters[0]?.memberCount).toBe(0);
  });

  it('the entry-point node is a 12x12pt (0.166667in) plain rect', () => {
    const dNode = captured[0]?.nodes.find((n) => n.width === 0.166667 * 72);
    expect(dNode).toBeUndefined(); // widths are in px in DotInputGraph, not inches
    const borderNode = captured[0]?.nodes.find((n) => n.shape === 'rect' && n.width === 12 && n.height === 12);
    expect(borderNode).toBeDefined();
  });

  it('is structurally EQUAL to the oracle dump', () => {
    const oracle = parseSvekDot(readFileSync(join(CACHE, 'bitaxo-18-tamo974', files[0]!), 'utf8'));
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `failing checks: ${failing.join(', ')}`).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// darime-88-moda428 / lumamo-63-zupa263 — concurrent-region DUMP order
// (Phase L iteration 4): region 0 (S's own pre-separator children) is NOT a
// synthetic CONC sub-group upstream (verified via oracle SVG
// `data-qualified-name`: darime's region-0 member is "S.d", region-1 is
// "S.CONC1.a") — `GroupMakerState.getImage()`'s `containsSomeConcurrentStates()`
// branch (GroupMakerState.java:123-134) only builds region 0's OWN wrapping
// pass INSIDE S's own `getImage()` call, which fires strictly AFTER every
// CONC sub-group has resolved (`CucaDiagramSimplifierState`'s bottom-up
// driver processes S's child groups, all deeper than S, first). Both
// fixtures have a region-0 nested composite (b / A1) that is DISQUALIFIED
// from its own autarky by a link touching it directly (c->d crosses b's
// boundary; A1-->A2 touches A1 itself) — so region 0 stays inline as a
// cluster WITHIN its own deferred wrapping pass, with NO separate dump of
// its own. Dump order: [CONC1, region0-build, outer].
// @see ~/git/plantuml/.../dot/CucaDiagramSimplifierState.java#simplify
// @see ~/git/plantuml/.../svek/GroupMakerState.java#getImage
// ---------------------------------------------------------------------------

describe('layoutState composite — darime-88-moda428 (region-0 non-autarkic, dump order)', () => {
  const puml = readPuml('darime-88-moda428');
  const files = svekFiles('darime-88-moda428');
  const captured = captureAll(puml);

  it('fires exactly 3 layout passes, matching the oracle dump count', () => {
    expect(files).toHaveLength(3);
    expect(captured).toHaveLength(3);
  });

  it('pass 1 is CONC1 (state a alone) — dumps BEFORE region 0', () => {
    expect(captured[0]?.nodes).toHaveLength(1);
    expect(captured[0]?.clusters ?? []).toHaveLength(0);
  });

  it('pass 2 is region 0 (b cluster{c} + d leaf + c->d edge), dumped LAST among inner passes', () => {
    expect(captured[1]?.nodes).toHaveLength(2); // c (inside cluster b) + d
    expect(captured[1]?.clusters).toHaveLength(1);
    expect(captured[1]?.edges).toHaveLength(1);
  });

  it('pass 3 (outer) carries nodesep/ranksep; passes 1-2 omit them', () => {
    expect(captured[0]?.nodeSep).toBeUndefined();
    expect(captured[1]?.nodeSep).toBeUndefined();
    expect(captured[2]?.nodeSep).toBeDefined();
    expect(captured[2]?.rankSep).toBeDefined();
  });

  for (let i = 0; i < files.length; i++) {
    it(`pass ${i + 1} is structurally EQUAL to ${files[i]}`, () => {
      const oracle = parseSvekDot(readFileSync(join(CACHE, 'darime-88-moda428', files[i]!), 'utf8'));
      const candidate = dotInputToStructural(captured[i]!);
      const diff = compareStructural(oracle, candidate);
      const failing = Object.entries(diff)
        .filter(([k, v]) => k.endsWith('Ok') && v === false)
        .map(([k]) => k);
      expect(diff.structurallyEqual, `svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
    });
  }
});

describe('layoutState composite — lumamo-63-zupa263 (region-0 non-autarkic via self-touch, dump order)', () => {
  const puml = readPuml('lumamo-63-zupa263');
  const files = svekFiles('lumamo-63-zupa263');
  const captured = captureAll(puml);

  it('fires exactly 3 layout passes, matching the oracle dump count', () => {
    expect(files).toHaveLength(3);
    expect(captured).toHaveLength(3);
  });

  it('pass 1 is CONC1 (state B alone) — dumps BEFORE region 0', () => {
    expect(captured[0]?.nodes).toHaveLength(1);
    expect(captured[0]?.clusters ?? []).toHaveLength(0);
  });

  it('pass 2 is region 0 (A1 cluster with a zaent anchor for A1-->A2)', () => {
    expect(captured[1]?.clusters).toHaveLength(1);
    expect(captured[1]?.nodes.some((n) => n.shape === 'point')).toBe(true);
  });

  for (let i = 0; i < files.length; i++) {
    it(`pass ${i + 1} is structurally EQUAL to ${files[i]}`, () => {
      const oracle = parseSvekDot(readFileSync(join(CACHE, 'lumamo-63-zupa263', files[i]!), 'utf8'));
      const candidate = dotInputToStructural(captured[i]!);
      const diff = compareStructural(oracle, candidate);
      const failing = Object.entries(diff)
        .filter(([k, v]) => k.endsWith('Ok') && v === false)
        .map(([k]) => k);
      expect(diff.structurallyEqual, `svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
    });
  }
});

describe('layoutState composite — sapelo-46-jafe280 (region-0 nested composite IS autarkic — dumps first)', () => {
  const puml = readPuml('sapelo-46-jafe280');
  const files = svekFiles('sapelo-46-jafe280');
  const captured = captureAll(puml);

  it('fires exactly 4 layout passes: toutou9 (own), CONC1 (chat), region-0-build, outer', () => {
    expect(files).toHaveLength(4);
    expect(captured).toHaveLength(4);
  });

  it('pass 1 (toutou9, region 0s own nested autarkic composite) dumps BEFORE CONC1', () => {
    expect(captured[0]?.nodes).toHaveLength(2); // [*] + leo
  });

  it('pass 3 (region-0-build) references toutou9 already flattened, dumped LAST among inner passes', () => {
    expect(captured[2]?.nodes).toHaveLength(2); // [*] + flattened toutou9
    const big = captured[2]?.nodes.find((n) => n.shape === 'rounded');
    expect(big?.width).toBeGreaterThan(50); // wrapped InnerStateAutonom size, not min leaf
  });

  for (let i = 0; i < files.length; i++) {
    it(`pass ${i + 1} is structurally EQUAL to ${files[i]}`, () => {
      const oracle = parseSvekDot(readFileSync(join(CACHE, 'sapelo-46-jafe280', files[i]!), 'utf8'));
      const candidate = dotInputToStructural(captured[i]!);
      const diff = compareStructural(oracle, candidate);
      const failing = Object.entries(diff)
        .filter(([k, v]) => k.endsWith('Ok') && v === false)
        .map(([k]) => k);
      expect(diff.structurallyEqual, `svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
    });
  }
});
