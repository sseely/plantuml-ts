/**
 * Link-hoisting — mission A4 Phase L iteration 6.
 *
 * Upstream link ownership is by ENDPOINT ENTITY CONTAINER, not by the
 * syntactic scope that wrote the transition
 * (`~/git/plantuml/.../abel/EntityUtils.java#isPureInnerLink12`,
 * `~/git/plantuml/.../svek/GroupMakerState.java#getPureInnerLinks`,
 * `~/git/plantuml/.../svek/GraphvizImageBuilder.java#buildImage`). Upstream
 * attempts EVERY diagram link at the TOP pass (`dotData.getLinks()` is
 * unfiltered) and only the subtree-contained subset at a group's own pass
 * (`getPureInnerLinks`); a link whose endpoint has no `SvekNode` at a given
 * pass throws `IllegalStateException`, caught and logged, silently dropping
 * it from THAT pass only.
 *
 * This port's `state-composite-pass.ts` used to add a composite's own
 * transitions ONLY at its literal declaring scope
 * (`addLevelEdges(s.id, s.transitions, ...)`), so a transition declared in
 * the WRONG scope relative to where its real endpoints resolve was never
 * emitted at ANY pass:
 *
 *   1. `state A { A --> B }` where `B` lives elsewhere and `A` itself has no
 *      other local content — `A` collapses to a leaf (mission A4 Phase L
 *      iter 5's `hasLocalContent` fallback), and the leaf branch of
 *      `resolveMember` never calls `addLevelEdges` at all, so `A.transitions`
 *      (holding `A --> B`) was silently discarded (figiza-55-migo973,
 *      zageca-24-zino008).
 *   2. A transition written at the diagram's TOP scope (`ast.transitions`)
 *      whose BOTH real endpoints are nested INSIDE a deeper autonom
 *      composite's own separate pass — the top-level pass attempts it (per
 *      upstream) but the endpoints aren't top-level nodes, so it silently
 *      dangles there (`graph-layout.ts#addEdges`'s pre-existing dangling-edge
 *      filter) and is never re-attempted at the pass that WOULD succeed
 *      (nimana-36-veco708's `yesno --> yesyes` / `yesyes --> yesno`, written
 *      outside `state "YES" as yes { ... }` but nested inside it).
 *
 * Fixed via `collectRegularTransitions` (a diagram-wide flat pool of every
 * non-`'[*]'` transition, regardless of declaring scope) + `sweepOrphanEdges`
 * (run once per pass boundary — top level and each autonom composite's own
 * accumulator — AFTER the existing per-scope `addLevelEdges` calls, so every
 * fixture with zero orphans gets byte-identical output). A transition's
 * resolved endpoints are only ever valid node ids in exactly one pass's
 * accumulator (entity ids are globally unique), so the sweep can never
 * produce a duplicate edge. `'[*]'` transitions are excluded from the pool —
 * upstream materializes each usage as a genuine scope-local pseudostate
 * CHILD of the scope that wrote it, so those stay on the untouched
 * `addLocalPseudoNodes`/`addLevelEdges` path.
 *
 * `zageca-24-zino008` additionally exposed a routing gap: `layout.ts`'s
 * `hasAnyComposite` diagram-wide FLAT-vs-COMPOSITE gate only checked
 * `hasLocalContent`, so a diagram where EVERY state collapses to a leaf
 * (`state A { A --> B }` / `state B { }`, both zero real children) never
 * even reached the composite pipeline's `sweepOrphanEdges` — the FLAT
 * pipeline's `buildFlatTransitionGeos` only ever reads `ast.transitions`
 * (never a state's own `.transitions`), so the link was invisible to it
 * entirely. Fixed by also gating on `s.transitions.length > 0` (any `{ }`
 * block was opened at all).
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

describe('link-hoisting — declared inside a leaf-fallback composite, real endpoint outside', () => {
  const slug = 'figiza-55-migo973';
  const puml = readPuml(slug);
  const files = svekFiles(slug);
  const captured = captureAll(puml);

  it('fires 2 passes — A is a plain leaf, B is an autonom composite wrapping "inner"', () => {
    expect(files).toHaveLength(2);
    expect(captured).toHaveLength(2);
  });

  it('the top-level pass carries the A --> B edge (declared inside A, which has zero local content)', () => {
    const top = captured[1]!;
    expect(top.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
    expect(top.edges).toHaveLength(1);
    expect(top.edges[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('is structurally EQUAL to the oracle dump on every pass', () => {
    for (let i = 0; i < files.length; i++) expectStructurallyEqual(join(GOLDENS, slug, files[i]!), captured[i]!);
  });
});

describe('link-hoisting — both endpoints ALSO leaf-fallback (whole-diagram FLAT-pipeline routing)', () => {
  const slug = 'zageca-24-zino008';
  const puml = readPuml(slug);
  const files = svekFiles(slug);
  const captured = captureAll(puml);

  it('fires exactly 1 pass — every state collapses to a plain leaf', () => {
    expect(files).toHaveLength(1);
    expect(captured).toHaveLength(1);
  });

  it('the single pass still carries the A --> B edge even though A.transitions never reaches ast.transitions', () => {
    expect(captured[0]!.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
    expect(captured[0]!.edges).toHaveLength(1);
    expect(captured[0]!.edges[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('is structurally EQUAL to the oracle dump', () => {
    expectStructurallyEqual(join(GOLDENS, slug, files[0]!), captured[0]!);
  });
});

describe('link-hoisting — declared at the top scope, real endpoints nested inside a deeper autonom pass', () => {
  const slug = 'nimana-36-veco708';
  const puml = readPuml(slug);
  const files = svekFiles(slug);
  const captured = captureAll(puml);

  it('fires 2 passes — "yes" is autonom (no crossing link touches a descendant from outside)', () => {
    expect(files).toHaveLength(2);
    expect(captured).toHaveLength(2);
  });

  it('"yes"\'s OWN pass carries yesno<->yesyes, even though written at the diagram\'s top scope', () => {
    const innerPass = captured[0]!;
    expect(innerPass.nodes.map((n) => n.id).sort()).toEqual(['yesno', 'yesyes']);
    expect(innerPass.edges).toHaveLength(2);
    const pairs = innerPass.edges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toEqual(['yesno->yesyes', 'yesyes->yesno']);
  });

  it('the top-level pass still carries its OWN no<->yes edges, unaffected by the sweep', () => {
    // The captured DotInputGraph is the SWEEP's attempt, before
    // graph-layout.ts's dangling-node filter drops the 2 orphaned
    // yesno/yesyes attempts that don't belong at this pass (they succeed at
    // "yes"'s own inner pass instead, asserted above) -- filter to edges
    // whose endpoints are actually this pass's own nodes.
    const top = captured[1]!;
    expect(top.nodes.map((n) => n.id).sort()).toEqual(['no', 'yes']);
    const topNodeIds = new Set(top.nodes.map((n) => n.id));
    const ownEdges = top.edges.filter((e) => topNodeIds.has(e.from) && topNodeIds.has(e.to));
    expect(ownEdges).toHaveLength(2);
    const pairs = ownEdges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toEqual(['no->yes', 'yes->no']);
  });

  it('is structurally EQUAL to the oracle dump on every pass', () => {
    for (let i = 0; i < files.length; i++) expectStructurallyEqual(join(GOLDENS, slug, files[i]!), captured[i]!);
  });
});

describe('link-hoisting — composite\'s OWN transitions self-reference its own id (autonom re-entry proxy)', () => {
  // giniti-22-fexo000 (mission A4 Phase L iter 18): `Radio_Configuring`,
  // written as `state Radio_Configuring { ... Radio_Configuring --> X ... }`,
  // is itself classified AUTONOM — its two outgoing transitions have
  // `t.from === 'Radio_Configuring'` (upstream's per-state `:`/`-->` scoping
  // convention repeats the CURRENT state's own name), which is never a node
  // in Radio_Configuring's OWN content pass (only its CHILDREN are). Both
  // only resolve once Radio_Configuring's autonom re-entry PROXY node exists
  // in the top-level pass. `buildPlainAutonomSpec` excludes self-referencing
  // entries from its OWN `addLevelEdges` call (a FRESH, immediately-finalized
  // accumulator can never grow the missing node later); `collectRegularTransitions`
  // still pools them (only the STATE's own transitions were previously
  // excluded, not its subtree, when an ancestor owns a concurrent region —
  // giniti's `Radio_Root` has one); `sweepOrphanEdges` retries them at the
  // top-level pass, where the proxy node does exist.
  const slug = 'giniti-22-fexo000';
  const puml = readPuml(slug);
  const files = svekFiles(slug);
  const captured = captureAll(puml);

  it('fires 6 passes', () => {
    expect(files).toHaveLength(6);
    expect(captured).toHaveLength(6);
  });

  it("Radio_Configuring's own content pass carries neither self-referencing transition", () => {
    const ownPass = captured[0]!;
    expect(ownPass.nodes.map((n) => n.id).sort()).toEqual([
      'Vendor_Radio_Configuring',
      '__init_Radio_Configuring',
    ]);
    expect(ownPass.edges).toHaveLength(1);
    expect(ownPass.edges[0]).toMatchObject({
      from: '__init_Radio_Configuring',
      to: 'Vendor_Radio_Configuring',
    });
  });

  it('the top-level pass carries both of Radio_Configuring\'s cross-composite transitions', () => {
    const top = captured[2]!;
    const topNodeIds = new Set(top.nodes.map((n) => n.id));
    expect(topNodeIds.has('Radio_Configuring')).toBe(true);
    const ownEdges = top.edges.filter((e) => topNodeIds.has(e.from) && topNodeIds.has(e.to));
    const pairs = ownEdges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toContain('Radio_Configuring->Vendor_Radio_Disabled');
    expect(pairs).toContain('Radio_Configuring->__zaent_Vendor_Radio_Enabled');
  });

  it('is structurally EQUAL to the oracle dump on every pass', () => {
    for (let i = 0; i < files.length; i++) expectStructurallyEqual(join(GOLDENS, slug, files[i]!), captured[i]!);
  });
});
