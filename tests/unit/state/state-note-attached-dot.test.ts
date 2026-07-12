/**
 * Notes attached to states — DOT node + connector-edge emission (mission A4
 * Phase L iter 9). Before this iteration `note <pos> [of <State>]` / `note
 * "text" as <alias>` were fully PARSED (`ast.notes`, state-notes.ts) but
 * never reached DOT graph construction at all — `state-dot-graph.ts` (flat
 * pipeline) and `state-composite-pass.ts` (composite pipeline) both ignored
 * `ast.notes` entirely, so an attached note's oracle-emitted seam node +
 * connector edge was silently dropped (nodeCount/edgeCount/degree/shape
 * mismatches).
 *
 * TDD-pinned to cached oracle dumps under
 * `test-results/dot-cache/state/<slug>/svek-N.dot`. Mirrors
 * state-note-link-dot.test.ts's capture harness (`setLayoutInputObserver` +
 * `compareStructural`).
 *
 * Fixtures:
 *   - fatupo-62-bemu777 — flat pipeline, `note right of X` (explicit
 *     target), multi-line table body.
 *   - xodazu-26-cube992 — flat pipeline, `note left of state1 : coucou`
 *     single-line, alongside a `[*]-->` transition (verifies the note edge
 *     coexists with a regular transition edge).
 *   - gedude-95-subi666 — flat pipeline, `note bottom of state1` multi-line.
 *   - labono-83-nega255 / pexuve-81-suxi717 — flat pipeline, freestanding
 *     `note "text" as N1` (no host, no connector edge — just an isolated
 *     DOT node); pexuve has TWO independent freestanding notes (never merge).
 *   - dajipi-09-doki542 — COMPOSITE pipeline: `note left of NewValuePreview`
 *     + `note right of NewValuePreview`, both declared at the diagram's TOP
 *     scope, targeting an AUTONOM composite's own flattened node in the
 *     PARENT pass (graph #1/svek-2) — verifies scope-based note placement
 *     and `resolveEndpoint`-based host resolution across the composite
 *     pipeline's per-pass accumulators.
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

/** Assert every captured pass is structurally EQUAL to its oracle dump. */
function expectAllPassesEqual(slug: string): void {
  const files = svekFiles(slug);
  const captured = captureAll(readPuml(slug));
  expect(captured, `${slug}: expected ${files.length} captured pass(es)`).toHaveLength(files.length);
  for (let i = 0; i < files.length; i++) {
    const oracle = parseSvekDot(readFileSync(join(CACHE, slug, files[i]!), 'utf8'));
    const candidate = dotInputToStructural(captured[i]!);
    const diff = compareStructural(oracle, candidate);
    const failing = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `${slug} svek-${i + 1}.dot: failing checks: ${failing.join(', ')}`).toBe(true);
  }
}

describe('notes attached to states — flat pipeline', () => {
  it('fatupo-62-bemu777: note right of X (multi-line table body)', () => {
    expectAllPassesEqual('fatupo-62-bemu777');
  });

  it('xodazu-26-cube992: note left of state1 : coucou (single-line, plus [*]--> edge)', () => {
    expectAllPassesEqual('xodazu-26-cube992');
  });

  it('gedude-95-subi666: note bottom of state1 (multi-line)', () => {
    expectAllPassesEqual('gedude-95-subi666');
  });

  it('xodazu-26-cube992: the note edge has minlen=0, the [*] edge has minlen=1', () => {
    const candidate = dotInputToStructural(captureAll(readPuml('xodazu-26-cube992'))[0]!);
    const minlens = candidate.edges.map((e) => e.minlen).sort((a, b) => a - b);
    expect(minlens).toEqual([0, 1]);
  });
});

describe('freestanding notes — no host, no connector edge', () => {
  it('labono-83-nega255: note "text" as N1 alongside a plain state', () => {
    expectAllPassesEqual('labono-83-nega255');
  });

  it('pexuve-81-suxi717: two independent freestanding notes never merge', () => {
    expectAllPassesEqual('pexuve-81-suxi717');
    const candidate = dotInputToStructural(captureAll(readPuml('pexuve-81-suxi717'))[0]!);
    // 2 states + 2 notes, only 1 edge (foo-->foo2 — neither note is connected).
    expect(candidate.nodes).toHaveLength(4);
    expect(candidate.edges).toHaveLength(1);
  });
});

describe('notes attached to states — composite pipeline (scope-based placement)', () => {
  it('dajipi-09-doki542: note left/right of an autonom composite, both passes EQUAL', () => {
    expectAllPassesEqual('dajipi-09-doki542');
  });

  it('dajipi-09-doki542: the top-level pass carries both note connector edges', () => {
    const captured = captureAll(readPuml('dajipi-09-doki542'));
    const topLevel = dotInputToStructural(captured[1]!);
    expect(topLevel.nodes).toHaveLength(4); // NewValuePreview, Other, note-left, note-right
    expect(topLevel.edges).toHaveLength(2);
    expect(topLevel.edges.every((e) => e.minlen === 0)).toBe(true);
  });
});
