/**
 * Feature family: stereotype-driven pseudostate kinds (start/end, history,
 * history*) and `=name=` synchronization-bar transition endpoints — T2 gaps
 * against `Stereogroup#getLeafType` and
 * `CommandLinkStateCommon#getEntity`'s sync-bar branch.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State, Transition } from '../../../src/diagrams/state/ast.js';

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

function findTransition(ast: StateDiagramAST, from: string, to: string): Transition | undefined {
  return ast.transitions.find((t) => t.from === from && t.to === to);
}

// ---------------------------------------------------------------------------
// Named start/end pseudostates
// ---------------------------------------------------------------------------

describe('named start/end pseudostates', () => {
  it('<<start>> maps to kind=initial', () => {
    const ast = parse('state S <<start>>');
    expect(findState(ast, 'S')?.kind).toBe('initial');
  });

  it('<<end>> maps to kind=final', () => {
    const ast = parse('state E <<end>>');
    expect(findState(ast, 'E')?.kind).toBe('final');
  });

  it('a named start/end state is distinct from the anonymous [*] sentinel', () => {
    const ast = parse(`
      state S <<start>>
      [*] --> A
    `);
    expect(findState(ast, 'S')?.kind).toBe('initial');
    // The anonymous pseudostate never becomes a State node.
    expect(findState(ast, '[*]')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// history* stereotype (faithful upstream spelling)
// ---------------------------------------------------------------------------

describe('history* stereotype (faithful upstream spelling)', () => {
  it('<<history*>> maps to kind=deepHistory', () => {
    const ast = parse('state S <<history*>>');
    expect(findState(ast, 'S')?.kind).toBe('deepHistory');
  });

  it('<<history>> (no star) still maps to kind=history', () => {
    const ast = parse('state S <<history>>');
    expect(findState(ast, 'S')?.kind).toBe('history');
  });

  it('pre-existing <<deepHistory>> spelling still resolves (backward compat)', () => {
    const ast = parse('state S <<deepHistory>>');
    expect(findState(ast, 'S')?.kind).toBe('deepHistory');
  });

  it('stores the raw stereotype string as written ("history*")', () => {
    const ast = parse('state S <<history*>>');
    expect(findState(ast, 'S')?.stereotype).toBe('history*');
  });
});

// ---------------------------------------------------------------------------
// `==name==` synchronization bar endpoints
//
// A SINGLE `=name=` is NOT a valid sync-bar reference upstream (jar-
// verified via `-DPLANTUML_DUMP_DOT`: `=X=` alone is a parse error).
// Upstream's `getStatePattern` sync-bar alternative is `(?:==+)...(?:==+)`
// -- minimum TWO `=` on each side. Once matched, upstream's
// `removeEquals()` strips ALL of them before the `quarkInContext` lookup,
// so `==fork1==` and `===fork1===` (any count >= 2) unify to the SAME
// entity keyed by the stripped name -- also jar-verified.
// ---------------------------------------------------------------------------

describe('synchronization bar `==name==` transition endpoints', () => {
  it('auto-creates a State with kind=syncBar from a bare ==name== endpoint', () => {
    const ast = parse('==fork1== --> A');
    const s = findState(ast, 'fork1');
    expect(s).toBeDefined();
    expect(s?.kind).toBe('syncBar');
  });

  it('the sync bar can be the target of a transition too', () => {
    const ast = parse('A --> ==fork1==');
    expect(findState(ast, 'fork1')?.kind).toBe('syncBar');
    expect(findTransition(ast, 'A', 'fork1')).toBeDefined();
  });

  it('multiple transitions referencing the same base name (any = count >= 2) share one State', () => {
    const ast = parse(`
      ==fork1== --> A
      ===fork1=== --> B
      C --> ==fork1==
    `);
    const copies = ast.states.filter((s) => s.id === 'fork1');
    expect(copies).toHaveLength(1);
  });

  it('an undecorated reference to the same base name reuses the sync bar entity', () => {
    // Jar-verified: "fork1" (no "=") resolves through the SAME
    // quarkInContext lookup as "==fork1==" once stripped -- decoration is
    // not part of the entity's identity, so the two collide into one State
    // (kind=syncBar, set by whichever reference created it first).
    const ast = parse(`
      ==fork1== --> A
      fork1 --> B
    `);
    const copies = ast.states.filter((s) => s.id === 'fork1');
    expect(copies).toHaveLength(1);
    expect(copies[0]?.kind).toBe('syncBar');
  });
});

// ---------------------------------------------------------------------------
// Unrecognized stereotype — falls back to kind=normal
// ---------------------------------------------------------------------------

describe('unrecognized stereotype', () => {
  it('an unknown <<stereotype>> falls back to kind=normal', () => {
    const ast = parse('state S <<somethingElse>>');
    expect(findState(ast, 'S')?.kind).toBe('normal');
    expect(findState(ast, 'S')?.stereotype).toBe('somethingElse');
  });
});
