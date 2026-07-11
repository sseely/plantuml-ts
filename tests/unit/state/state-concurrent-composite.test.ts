/**
 * Feature family: concurrent region separators (`--`/`||`, one-or-more
 * repeats), the `state X begin ... end state` block form, and the `frame`
 * composite keyword — T2 gaps against CommandConcurrentState /
 * CommandCreatePackageState / CommandCreatePackage2 / CommandEndState.
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

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

// ---------------------------------------------------------------------------
// Concurrent separator generalization: `--`, `---`, `||`, `||||`
// ---------------------------------------------------------------------------

describe('concurrent region separator — pipe form', () => {
  it('|| starts a new concurrent region, same as --', () => {
    const ast = parse(`
      state S {
        [*] --> A
        ||
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(2);
    expect(s?.concurrentRegions[0]?.some((st) => st.id === 'A')).toBe(true);
    expect(s?.concurrentRegions[1]?.some((st) => st.id === 'B')).toBe(true);
  });

  it('a longer run of dashes (---) also separates regions', () => {
    const ast = parse(`
      state S {
        [*] --> A
        ---
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(2);
  });

  it('a longer run of pipes (||||) also separates regions', () => {
    const ast = parse(`
      state S {
        [*] --> A
        ||||
        [*] --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(2);
  });

  it('three regions via two || separators', () => {
    const ast = parse(`
      state S {
        [*] --> A
        ||
        [*] --> B
        ||
        [*] --> C
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.concurrentRegions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// `state X begin ... end state` block form
// ---------------------------------------------------------------------------

describe('composite state — begin/end state block form', () => {
  it('state X begin ... end state parses as a composite', () => {
    const ast = parse(`
      state Composite begin
        A --> B
      end state
    `);
    const s = findState(ast, 'Composite');
    expect(s).toBeDefined();
    expect(s?.children.map((c) => c.id)).toEqual(['A', 'B']);
  });

  it('end state (case-insensitive, "END STATE") closes the block', () => {
    const ast = parse(`
      state Composite begin
        A --> B
      END STATE
    `);
    const s = findState(ast, 'Composite');
    expect(s?.children).toHaveLength(2);
  });

  it('} still closes a begin-opened block (mixed closer)', () => {
    const ast = parse(`
      state Composite begin
        A --> B
      }
    `);
    const s = findState(ast, 'Composite');
    expect(s?.children).toHaveLength(2);
  });

  it('quoted display name with begin/end state', () => {
    const ast = parse(`
      state 'My Composite' as MC begin
        A --> B
      end state
    `);
    const s = findState(ast, 'MC');
    expect(s?.display).toBe('My Composite');
  });
});

// ---------------------------------------------------------------------------
// `frame` composite keyword
// ---------------------------------------------------------------------------

describe('frame composite container', () => {
  it('frame X { ... } creates a State with container="frame"', () => {
    const ast = parse(`
      frame F {
        A --> B
      }
    `);
    const s = findState(ast, 'F');
    expect(s).toBeDefined();
    expect(s?.container).toBe('frame');
    expect(s?.children.map((c) => c.id)).toEqual(['A', 'B']);
  });

  it('frame X begin ... end state also works', () => {
    const ast = parse(`
      frame F begin
        A --> B
      end state
    `);
    const s = findState(ast, 'F');
    expect(s?.container).toBe('frame');
  });

  it('a plain state composite has container=undefined (not "frame")', () => {
    const ast = parse(`
      state S {
        A --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.container).toBeUndefined();
  });

  it('frame with quoted display name and color', () => {
    const ast = parse(`
      frame "My Frame" as MF #yellow {
        A --> B
      }
    `);
    const s = findState(ast, 'MF');
    expect(s?.display).toBe('My Frame');
    expect(s?.color).toBe('#yellow');
    expect(s?.container).toBe('frame');
  });
});

// ---------------------------------------------------------------------------
// Composite state opener with a stereotype (rare, but a valid grammar slot
// per CommandCreatePackageState's Stereogroup capture)
// ---------------------------------------------------------------------------

describe('composite state opener with stereotype', () => {
  it('state S <<fork>> { ... } resolves kind from the stereotype', () => {
    const ast = parse(`
      state S <<fork>> {
        A --> B
      }
    `);
    const s = findState(ast, 'S');
    expect(s?.kind).toBe('fork');
    expect(s?.stereotype).toBe('fork');
  });
});

// ---------------------------------------------------------------------------
// Re-declaration merges container in-place (declareState's update branch)
// ---------------------------------------------------------------------------

describe('re-declaring an auto-created state as a frame', () => {
  it('a state auto-created by a transition, then opened as a frame, merges container in-place', () => {
    const ast = parse(`
      A --> F
      frame F {
        X --> Y
      }
    `);
    const copies = ast.states.filter((s) => s.id === 'F');
    expect(copies).toHaveLength(1);
    expect(copies[0]?.container).toBe('frame');
  });
});

// ---------------------------------------------------------------------------
// Stray closer at top level — popScope's "never pop the root scope" guard
// ---------------------------------------------------------------------------

describe('stray closer with no open composite', () => {
  it('a bare `}` with nothing open does not crash and leaves the diagram intact', () => {
    const ast = parse(`
      A --> B
      }
      C --> D
    `);
    expect(ast.transitions).toHaveLength(2);
  });

  it('a bare `end state` with nothing open does not crash', () => {
    const ast = parse(`
      end state
      A --> B
    `);
    expect(ast.transitions).toHaveLength(1);
  });
});
