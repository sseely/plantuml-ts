/**
 * Entity.isAutarkic composite-classification predicate — mission A4 Phase L
 * iteration 2. Two bugs fixed here, both TDD-pinned:
 *
 *   1. `state-composite-detect.ts#isAutarkic` used to SKIP any transition
 *      whose endpoint literally equalled the group's own id
 *      (`t.from === state.id || t.to === state.id`) before the boundary
 *      check. That is wrong: `Entity.isAutarkic`
 *      (`~/git/plantuml/.../abel/Entity.java:690-715`) via
 *      `EntityUtils.isPureInnerLink3` (`:76-88`) compares each endpoint's
 *      CONTAINER — for an endpoint that IS the group, its container is the
 *      group's own PARENT (outside), which is exactly what
 *      `subtreeIds(state)` already encodes by excluding `state.id`. No
 *      exemption is needed; removing it makes `A --> AInternal` (group A
 *      linking to its own DIRECT CHILD) correctly disqualify A
 *      (bupani-17-puxi938), while a true self-loop on the group itself
 *      (`X --> X`) still correctly does NOT disqualify (both sides read
 *      "outside", matching Java).
 *
 *   2. `state-composite-classify.ts#classifyDiagram` only ever received
 *      `ast.states` (composite/leaf declarations), never
 *      `ast.transitions` (the diagram's TOP-LEVEL transitions, written
 *      outside every `state X { ... }` block) — so any diagram whose
 *      cross-composite links are all written at top level (the common
 *      case) had ZERO disqualifying links visible to the classifier, and
 *      every composite in the diagram was wrongly seen as autonom
 *      (desebo-47-maro096: 9 nested composites, all wrongly split into
 *      their own passes). `Entity.isAutarkic` iterates
 *      `this.diagram.getLinks()` — literally every link, regardless of
 *      syntactic scope — so `classifyDiagram` now takes a
 *      `topLevelTransitions` parameter and folds it into the same
 *      whole-diagram link set `collectAllTransitions` already builds from
 *      nested scopes.
 *
 * cesifo-37-rugu443 / dapunu-39-kava045 / kenuci-20-cane702 (also part of
 * the original under-split evidence) are NOT fixed by this predicate: they
 * are blocked by separate, larger parser mechanisms — dapunu/kenuci fail to
 * parse `state X [[{X}]] { ... }` (the `[[url]]` link-syntax annotation
 * breaks composite `{`-block detection entirely, both composites end up as
 * flat leaf states with children=0 — confirmed via direct parser probe);
 * cesifo's `state 1.2` / `state a.b` are dotted ids, which upstream resolves
 * via `Quark` hierarchical splitting on the diagram's separator into NESTED
 * groups — our parser treats them as single literal ids (the "dotted-id
 * branch" iteration 1 already deferred). Both are journaled as separate
 * next-mechanism candidates, not attempted here — see decision-journal.md.
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
import type { State } from '../../../src/diagrams/state/ast.js';
import { isAutarkic } from '../../../src/diagrams/state/state-composite-detect.js';
import { classifyDiagram } from '../../../src/diagrams/state/state-composite-classify.js';

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

/** Minimal `State` builder for direct predicate-level unit tests — only the
 *  fields `isAutarkic`/`classifyDiagram` read are populated. */
function mkState(overrides: Partial<State> & { id: string }): State {
  return {
    display: overrides.id,
    kind: 'normal',
    children: [],
    concurrentRegions: [],
    transitions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Direct predicate unit tests (state-composite-detect.ts#isAutarkic)
// ---------------------------------------------------------------------------

describe('isAutarkic — link touching the group itself', () => {
  it('a link from the group to its OWN DIRECT CHILD disqualifies (bupani-17-puxi938 shape)', () => {
    const aInternal = mkState({ id: 'AInternal' });
    const a = mkState({ id: 'A', children: [aInternal], transitions: [{ from: 'A', to: 'AInternal' }] });
    expect(isAutarkic(a, [{ from: 'A', to: 'AInternal' }])).toBe(false);
  });

  it('a true self-loop on the group itself does NOT disqualify (dapunu-39-kava045 shape)', () => {
    const waitingMeasure = mkState({ id: 'WaitingMeasure' });
    const first = mkState({
      id: 'Main_Connected_First',
      children: [waitingMeasure],
      transitions: [],
    });
    // The self-loop is written OUTSIDE Main_Connected_First's own block in
    // the source (top-level scope) — passed in as part of the whole-diagram
    // link set, exactly like classifyDiagram would supply it.
    const allTransitions = [{ from: 'Main_Connected_First', to: 'Main_Connected_First' }];
    expect(isAutarkic(first, allTransitions)).toBe(true);
  });

  it('a link from an OUTSIDE entity to the group itself does not, by itself, disqualify (both containers agree: outside)', () => {
    const child = mkState({ id: 'Child' });
    const group = mkState({ id: 'G', children: [child] });
    // Device_0_Function_2 --> SharedMemory shape (desebo): both endpoints'
    // containers are the top-level scope — no crossing.
    expect(isAutarkic(group, [{ from: 'Outside', to: 'G' }])).toBe(true);
  });

  it('a link crossing from a nested descendant to an unrelated composite disqualifies (desebo Entry10-->Status_A shape)', () => {
    const entry10 = mkState({ id: 'Entry10' });
    const dataTable = mkState({ id: 'DataTable', children: [entry10] });
    const sharedMemory = mkState({ id: 'SharedMemory', children: [dataTable] });
    // Status_A lives entirely outside SharedMemory's subtree.
    const allTransitions = [{ from: 'Entry10', to: 'Status_A' }];
    expect(isAutarkic(sharedMemory, allTransitions)).toBe(false);
    expect(isAutarkic(dataTable, allTransitions)).toBe(false);
  });
});

describe('isAutarkic — entry/exit border-point leaf disqualifies regardless of links', () => {
  it('a composite with an entrypoint-stereotype leaf is never autarkic, even with zero transitions', () => {
    const entry = mkState({ id: 'd', stereotype: 'entrypoint' });
    const composite = mkState({ id: 'C', children: [entry] });
    expect(isAutarkic(composite, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyDiagram wiring — top-level transitions must be visible
// ---------------------------------------------------------------------------

describe('classifyDiagram — top-level (out-of-scope) transitions participate in classification', () => {
  it('a composite disqualified ONLY by a top-level transition is classified cluster, not autonom', () => {
    const child = mkState({ id: 'Inner' });
    const group = mkState({ id: 'Group', children: [child] });
    const other = mkState({ id: 'Other' });
    // `Other --> Inner` written at top level (not in any State.transitions)
    // must still disqualify Group.
    const topLevelTransitions = [{ from: 'Other', to: 'Inner' }];
    const result = classifyDiagram([group, other], topLevelTransitions);
    expect(result.kindOf.get('Group')).toBe('cluster');
  });

  it('with no topLevelTransitions argument, whole-diagram classification still works from nested scopes alone', () => {
    const child = mkState({ id: 'Inner' });
    const group = mkState({ id: 'Group', children: [child], transitions: [{ from: 'Group', to: 'Inner' }] });
    const result = classifyDiagram([group]);
    expect(result.kindOf.get('Group')).toBe('cluster');
  });
});

// ---------------------------------------------------------------------------
// End-to-end DOT-parity: bupani (over-split fixed) and desebo (over-split
// fixed, wiring bug)
// ---------------------------------------------------------------------------

describe('layoutState composite — bupani-17-puxi938 (group-touching link no longer exempted)', () => {
  const puml = readPuml('bupani-17-puxi938');
  const files = svekFiles('bupani-17-puxi938');
  const captured = captureAll(puml);

  it('fires exactly 1 layout pass — A is non-autonom (A-->AInternal crosses its own boundary)', () => {
    expect(files).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  it('the pass contains exactly 1 cluster (A) with a zaent anchor (a link touches A itself)', () => {
    expect(captured[0]?.clusters).toHaveLength(1);
    const pointNodes = captured[0]?.nodes.filter((n) => n.shape === 'point') ?? [];
    expect(pointNodes).toHaveLength(1);
  });

  it('is structurally EQUAL to the oracle dump', () => {
    const oracle = parseSvekDot(readFileSync(join(CACHE, 'bupani-17-puxi938', files[0]!), 'utf8'));
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `failing checks: ${failing.join(', ')}`).toBe(true);
  });
});

describe('layoutState composite — desebo-47-maro096 (top-level transitions now classified)', () => {
  const puml = readPuml('desebo-47-maro096');
  const files = svekFiles('desebo-47-maro096');
  const captured = captureAll(puml);

  it('fires exactly 1 layout pass — every composite is disqualified by a top-level crossing link', () => {
    expect(files).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  it('is structurally EQUAL to the oracle dump', () => {
    const oracle = parseSvekDot(readFileSync(join(CACHE, 'desebo-47-maro096', files[0]!), 'utf8'));
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `failing checks: ${failing.join(', ')}`).toBe(true);
  });
});
