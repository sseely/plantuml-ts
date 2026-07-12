/**
 * Dotted-id Quark hierarchy — mission A4 Phase L iteration 10.
 *
 * Ports `CucaDiagram#quarkInContextSafe`'s `full.indexOf(sep) != -1` branch
 * (`CucaDiagram.java:263-284`) + `Quark#child`'s per-segment walk
 * (`plasma/Quark.java:116-132`), deferred since iteration 1. A dotted id
 * (default separator `.`, `StateDiagram.java:62`) splits hierarchically:
 * each segment becomes (or reuses) a DIRECT child of the previous segment's
 * own scope, auto-creating any missing intermediate composite.
 *
 * Two DISTINCT ancestor-promotion mechanisms, both ported here
 * (`state-parse-resolve.ts#DottedAncestorMode`):
 *   - A LEAF-style declare (`state A.X`, no `{ }`) promotes its ancestors
 *     EAGERLY to ordinary `GroupType.STATE` composites (upstream
 *     `ensureParentState`, `StateDiagram.java:268-280`) — autonom-eligible,
 *     evaluated by the normal `isAutarkic` link-crossing rules (cesifo,
 *     matezo, fovafu, tubojo, zoxutu below).
 *   - A composite/frame BLOCK opener with a dotted id (`state S.I { ... }`)
 *     instead auto-creates its ancestor as upstream `GroupType.PACKAGE`
 *     (`eventuallyBuildPhantomGroups`, materialized once at end-of-parse
 *     for any quark still lacking Entity data) — `Entity.isAutarkic`'s
 *     very first line unconditionally disqualifies a PACKAGE-type group
 *     from autonom (`abel/Entity.java:691-692`), regardless of link
 *     topology (tuvugi below).
 *
 * A dotted REFERENCE into an already-declared composite (`Somp.entry1`,
 * `Foo3.inner2`, `ma.Foo1`) just reuses the existing nested entity — no new
 * ancestor is created at all (bujuta/peliro/vujuru/kiniro/vedapo shapes).
 *
 * `set separator none`/`null` (`CommandNamespaceSeparator.java`) disables
 * splitting entirely — every dotted-LOOKING id stays one flat, unsplit
 * string (joleju-94-maru748's `set separator none` guard below; also the
 * pre-existing bemena-23-zebu249 golden, unaffected by this iteration).
 *
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#quarkInContextSafe
 * @see ~/git/plantuml/.../plasma/Quark.java#child
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#eventuallyBuildPhantomGroups
 * @see ~/git/plantuml/.../statediagram/StateDiagram.java#ensureParentState
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
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '../../../test-results/dot-cache/state');
const measurer = new WidthTableMeasurer();

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

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

/** Assert every oracle-cached `svek-N.dot` for `slug` is structurally EQUAL
 *  to our candidate output, in order. */
function expectDotParity(slug: string): void {
  const files = svekFiles(slug);
  const captured = captureAll(readPuml(slug));
  expect(captured).toHaveLength(files.length);
  files.forEach((f, i) => {
    const oracle = parseSvekDot(readFileSync(join(CACHE, slug, f), 'utf8'));
    const diff = compareStructural(oracle, dotInputToStructural(captured[i]!));
    expect(diff.structurallyEqual, `graph #${i} of ${slug}`).toBe(true);
  });
}

describe('dotted-id hierarchy — LEAF-style declare auto-creates STATE-type (autonom-eligible) ancestors', () => {
  it('a 2-level dotted declare ("state A.X" / "state A.Y") creates ONE composite "A" with two leaf children, no autoPhantom flag (cesifo-37-rugu443 / matezo-28-duka427 shape)', () => {
    const ast = parse(`
      state A.X
      state A.Y
    `);

    const a = findState(ast, 'A');
    expect(a?.autoPhantom).toBeUndefined();
    expect(a?.children.map((c) => c.id)).toEqual(['X', 'Y']);
    expect(findState(ast, 'A.X')).toBeUndefined();
  });

  it('an UNDOTTED reference to the auto-created composite\'s own name resolves globally, to the composite itself -- and to its nested leaf by LOCAL name (matezo-28-duka427\'s "A -> Y")', () => {
    const ast = parse(`
      state A.X
      state A.Y
      A -> Y
    `);

    // Written at the diagram's own top scope (outside every block), so it
    // lands in `ast.transitions`, not `A`'s own `.transitions`.
    expect(ast.transitions).toEqual([{ from: 'A', to: 'Y', length: 1 }]);
    // No phantom duplicate leaf/composite was created by the reference.
    expect(ast.states).toHaveLength(1);
    expect(findState(ast, 'A')?.children).toHaveLength(2);
  });

  it('a 3-level dotted declare ("state B.A.X" / "state B.A.Y") auto-creates BOTH ancestors ("B" containing "A" containing X/Y), neither phantom (fovafu-44-mifu394 / tubojo-49-tudu915 shape)', () => {
    const ast = parse(`
      state B.A.X
      state B.A.Y
    `);

    const b = findState(ast, 'B');
    expect(b?.autoPhantom).toBeUndefined();
    expect(b?.children).toHaveLength(1);
    const a = b?.children[0];
    expect(a?.id).toBe('A');
    expect(a?.autoPhantom).toBeUndefined();
    expect(a?.children.map((c) => c.id)).toEqual(['X', 'Y']);
  });

  it('cesifo-37-rugu443 -- "state 1.2" / "state a.b" / "1 -> b": auto-created ancestors "1" and "a" are structurally EQUAL to the oracle (2 svek passes -- "1" autonom, "a" a cluster)', () => {
    expectDotParity('cesifo-37-rugu443');
  });

  it('matezo-28-duka427 -- "A -> Y" (link touches the group A itself, disqualifying it) is structurally EQUAL to the oracle', () => {
    expectDotParity('matezo-28-duka427');
  });

  it('zoxutu-11-giru788 -- near-duplicate of matezo, same mechanism -- structurally EQUAL to the oracle', () => {
    expectDotParity('zoxutu-11-giru788');
  });

  it('fovafu-44-mifu394 -- 3-level "B.A.X"/"B.A.Y", "A -> Y" -- "A" disqualified (cluster), "B" stays autonom (own child pass) -- structurally EQUAL', () => {
    expectDotParity('fovafu-44-mifu394');
  });

  it('tubojo-49-tudu915 -- 3-level, "B -> Y" (the OUTER composite itself touched) -- both "B" and "A" disqualified, nested clusters -- structurally EQUAL', () => {
    expectDotParity('tubojo-49-tudu915');
  });
});

describe('dotted-id hierarchy — dotted REFERENCE into an already-declared composite reuses the existing nested entity', () => {
  it('bujuta-44-rovo666 -- "Somp.entry1" / "Somp.exitA" reused from OUTSIDE the block, no new state created -- structurally EQUAL to the oracle', () => {
    expectDotParity('bujuta-44-rovo666');
  });

  it('peliro-87-guva098 -- "comp1.en2" reused, structurally EQUAL to the oracle', () => {
    expectDotParity('peliro-87-guva098');
  });

  it('kiniro-32-mama877 -- explicit "set separator ." (same as default) + alias "ma" + "ma.Foo1" reused -- structurally EQUAL to the oracle', () => {
    expectDotParity('kiniro-32-mama877');
  });
});

describe('dotted-id hierarchy — composite/frame BLOCK opener with a dotted id (PACKAGE-type ancestor, never autonom)', () => {
  it('tuvugi-94-gapi519 -- "state S.I { S.I --> S.I }" splits into phantom ancestor "S" containing real composite "I"; the self-loop converges onto "I" itself (zero real children) -- structurally EQUAL to the oracle', () => {
    const ast = parse(`
      state S.I {
        S.I --> S.I
      }
    `);

    const outer = findState(ast, 'S');
    expect(outer?.autoPhantom).toBe(true);
    expect(outer?.children.map((c) => c.id)).toEqual(['I']);

    const inner = outer?.children[0];
    expect(inner?.autoPhantom).toBeUndefined();
    expect(inner?.children).toEqual([]);
    expect(inner?.transitions).toEqual([{ from: 'I', to: 'I', length: 2 }]);

    expectDotParity('tuvugi-94-gapi519');
  });

  it('a phantom ancestor is UPGRADED (flag cleared) the moment a later leaf-style declare passes through it -- mirrors ensureParentState\'s permanent promotion', () => {
    const ast = parse(`
      state S.I {
      }
      state S.other
    `);

    const s = findState(ast, 'S');
    expect(s?.autoPhantom).toBeUndefined();
    expect(s?.children.map((c) => c.id).sort()).toEqual(['I', 'other']);
  });
});

describe('"set separator none" disables dotted-id splitting entirely (regression guard)', () => {
  it('a dotted-LOOKING id stays ONE flat, unsplit string -- no hierarchy is built (joleju-94-maru748\'s "OS1.IS1" shape)', () => {
    const ast = parse(`
      set separator none
      state OS1 {
        state OS1.IS1
      }
    `);

    const os1 = findState(ast, 'OS1');
    expect(os1?.children.map((c) => c.id)).toEqual(['OS1.IS1']);
    // No auto-created "OS1" ancestor phantom-split from the child's id --
    // "OS1" here is the EXPLICITLY declared outer composite itself.
    expect(os1?.autoPhantom).toBeUndefined();
  });

  it('an undotted reference still resolves globally under "set separator none" (bemena-23-zebu249\'s pre-existing golden, unaffected by this iteration)', () => {
    expectDotParity('bemena-23-zebu249');
  });
});
